/**
 * Audio Playback Wrapper
 * 
 * Abstracts audio playback to enable easy migration from expo-av to expo-audio
 * without breaking changes. Provides consistent error handling and supports
 * progressive audio streaming for immediate playback.
 * 
 * Requirements: 8.1, 8.2, 8.3, 8.4, 8.5
 */

import { Audio } from 'expo-av';
import { AudioError, logError } from './errors';

// Audio instance interface for consistent API
export interface AudioInstance {
  id: string;
  uri: string;
  sound: Audio.Sound;
  status: AudioStatus;
  duration?: number;
  position?: number;
}

// Audio status enum
export enum AudioStatus {
  LOADING = 'loading',
  READY = 'ready',
  PLAYING = 'playing',
  PAUSED = 'paused',
  STOPPED = 'stopped',
  ERROR = 'error',
  FINISHED = 'finished'
}

// Audio playback options
export interface AudioPlaybackOptions {
  shouldPlay?: boolean;
  volume?: number;
  rate?: number;
  shouldLoop?: boolean;
  progressUpdateIntervalMillis?: number;
  onPlaybackStatusUpdate?: (status: AudioPlaybackStatus) => void;
  onLoadStart?: () => void;
  onLoadComplete?: (duration: number) => void;
  onPlaybackComplete?: () => void;
  onError?: (error: Error) => void;
}

// Audio playback status
export interface AudioPlaybackStatus {
  isLoaded: boolean;
  isPlaying: boolean;
  position: number;
  duration?: number;
  volume: number;
  rate: number;
  shouldLoop: boolean;
  error?: string;
}

// Global audio session configuration and resource management
let isAudioSessionConfigured = false;
const activeAudioInstances = new Map<string, AudioInstance>();
const audioResourcePool = new Set<Audio.Sound>();

// Performance optimization constants
const MAX_POOLED_SOUNDS = 5;
const CLEANUP_INTERVAL = 30000; // 30 seconds
const PRELOAD_BUFFER_SIZE = 2; // Number of sounds to keep ready

// Periodic cleanup timer
let cleanupTimer: NodeJS.Timeout | null = null;

/**
 * Configure audio session for optimal playback
 * This should be called once when the app starts
 */
export async function configureAudioSession(): Promise<void> {
  if (isAudioSessionConfigured) {
    return;
  }

  try {
    // Configure audio session for playback
    await Audio.setAudioModeAsync({
      allowsRecordingIOS: false,
      staysActiveInBackground: false,
      interruptionModeIOS: 1, // Audio.InterruptionModeIOS.DoNotMix
      playsInSilentModeIOS: true,
      shouldDuckAndroid: true,
      interruptionModeAndroid: 1, // Audio.InterruptionModeAndroid.DoNotMix
      playThroughEarpieceAndroid: false,
    });

    isAudioSessionConfigured = true;
    console.log('✅ Audio session configured successfully');
  } catch (error) {
    logError(error, { operation: 'configure_audio_session' });
    throw new AudioError(
      'Failed to configure audio session',
      'LOAD',
      { originalError: error instanceof Error ? error.message : String(error) },
      error instanceof Error ? error : undefined
    );
  }
}

/**
 * Reset audio session configuration (for testing)
 * @internal
 */
export function resetAudioSessionForTesting(): void {
  isAudioSessionConfigured = false;
}

/**
 * Generate unique ID for audio instances
 */
function generateAudioId(): string {
  return `audio_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Play audio from URI with comprehensive error handling and progress tracking
 * 
 * @param uri - Audio URI (blob URL, file URI, or network URL)
 * @param options - Playback configuration options
 * @returns Promise resolving to AudioInstance for control
 */
export async function playAudio(
  uri: string,
  options: AudioPlaybackOptions = {}
): Promise<AudioInstance> {
  if (!uri || typeof uri !== 'string') {
    throw new AudioError(
      'Audio URI is required and must be a string',
      'PLAY',
      { uri }
    );
  }

  // Ensure audio session is configured
  await configureAudioSession();

  const audioId = generateAudioId();
  const context = {
    operation: 'play_audio',
    audioId,
    uri: uri.substring(0, 100) + '...', // Truncate for logging
    options: {
      shouldPlay: options.shouldPlay ?? true,
      volume: options.volume ?? 1.0,
      rate: options.rate ?? 1.0,
      shouldLoop: options.shouldLoop ?? false
    }
  };

  try {
    // Create new sound instance
    const { sound } = await Audio.Sound.createAsync(
      { uri },
      {
        shouldPlay: options.shouldPlay ?? true,
        volume: options.volume ?? 1.0,
        rate: options.rate ?? 1.0,
        isLooping: options.shouldLoop ?? false,
        progressUpdateIntervalMillis: options.progressUpdateIntervalMillis ?? 100,
      }
    );

    // Create audio instance
    const audioInstance: AudioInstance = {
      id: audioId,
      uri,
      sound,
      status: AudioStatus.LOADING,
    };

    // Set up status update listener
    sound.setOnPlaybackStatusUpdate((status) => {
      updateAudioInstanceStatus(audioInstance, status);
      
      if (options.onPlaybackStatusUpdate) {
        options.onPlaybackStatusUpdate(mapToAudioPlaybackStatus(status));
      }
    });

    // Handle load start
    if (options.onLoadStart) {
      options.onLoadStart();
    }

    // Store active instance
    activeAudioInstances.set(audioId, audioInstance);

    // Wait for initial status to determine if loaded successfully
    const initialStatus = await sound.getStatusAsync();
    
    if (!initialStatus.isLoaded) {
      throw new AudioError(
        'Failed to load audio file',
        'LOAD',
        { uri, error: (initialStatus as any).error }
      );
    }

    // Update instance with loaded status
    audioInstance.status = initialStatus.isPlaying ? AudioStatus.PLAYING : AudioStatus.READY;
    audioInstance.duration = initialStatus.durationMillis ?? 0;
    audioInstance.position = initialStatus.positionMillis;

    // Handle load complete
    if (options.onLoadComplete && initialStatus.durationMillis) {
      options.onLoadComplete(initialStatus.durationMillis);
    }

    console.log(`🎵 Audio loaded successfully: ${audioId}`);
    return audioInstance;

  } catch (error) {
    logError(error, context);
    
    // Clean up failed instance
    activeAudioInstances.delete(audioId);
    
    // Call error callback if provided
    if (options.onError) {
      options.onError(error instanceof Error ? error : new Error(String(error)));
    }
    
    if (error instanceof AudioError) {
      throw error;
    }
    
    throw new AudioError(
      `Audio playback failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      'PLAY',
      context,
      error instanceof Error ? error : undefined
    );
  }
}

/**
 * Stop audio playback and clean up resources
 * 
 * @param instance - Audio instance to stop
 * @returns Promise that resolves when audio is stopped
 */
export async function stopAudio(instance: AudioInstance): Promise<void> {
  if (!instance || !instance.sound) {
    throw new AudioError(
      'Invalid audio instance provided',
      'STOP',
      { instanceId: instance?.id }
    );
  }

  const context = {
    operation: 'stop_audio',
    audioId: instance.id,
    currentStatus: instance.status
  };

  try {
    // Stop and unload the sound
    await instance.sound.stopAsync();
    await instance.sound.unloadAsync();
    
    // Update instance status
    instance.status = AudioStatus.STOPPED;
    
    // Remove from active instances
    activeAudioInstances.delete(instance.id);
    
    console.log(`🛑 Audio stopped: ${instance.id}`);
    
  } catch (error) {
    logError(error, context);
    
    // Still remove from active instances even if stop failed
    activeAudioInstances.delete(instance.id);
    
    throw new AudioError(
      `Failed to stop audio: ${error instanceof Error ? error.message : 'Unknown error'}`,
      'STOP',
      context,
      error instanceof Error ? error : undefined
    );
  }
}

/**
 * Pause audio playback
 * 
 * @param instance - Audio instance to pause
 * @returns Promise that resolves when audio is paused
 */
export async function pauseAudio(instance: AudioInstance): Promise<void> {
  if (!instance || !instance.sound) {
    throw new AudioError(
      'Invalid audio instance provided',
      'PAUSE',
      { instanceId: instance?.id }
    );
  }

  const context = {
    operation: 'pause_audio',
    audioId: instance.id,
    currentStatus: instance.status
  };

  try {
    await instance.sound.pauseAsync();
    instance.status = AudioStatus.PAUSED;
    
    console.log(`⏸️ Audio paused: ${instance.id}`);
    
  } catch (error) {
    logError(error, context);
    
    throw new AudioError(
      `Failed to pause audio: ${error instanceof Error ? error.message : 'Unknown error'}`,
      'PAUSE',
      context,
      error instanceof Error ? error : undefined
    );
  }
}

/**
 * Resume paused audio playback
 * 
 * @param instance - Audio instance to resume
 * @returns Promise that resolves when audio is resumed
 */
export async function resumeAudio(instance: AudioInstance): Promise<void> {
  if (!instance || !instance.sound) {
    throw new AudioError(
      'Invalid audio instance provided',
      'PLAY',
      { instanceId: instance?.id }
    );
  }

  const context = {
    operation: 'resume_audio',
    audioId: instance.id,
    currentStatus: instance.status
  };

  try {
    await instance.sound.playAsync();
    instance.status = AudioStatus.PLAYING;
    
    console.log(`▶️ Audio resumed: ${instance.id}`);
    
  } catch (error) {
    logError(error, context);
    
    throw new AudioError(
      `Failed to resume audio: ${error instanceof Error ? error.message : 'Unknown error'}`,
      'PLAY',
      context,
      error instanceof Error ? error : undefined
    );
  }
}

/**
 * Seek to specific position in audio
 * 
 * @param instance - Audio instance to seek
 * @param positionMillis - Position to seek to in milliseconds
 * @returns Promise that resolves when seek is complete
 */
export async function seekAudio(instance: AudioInstance, positionMillis: number): Promise<void> {
  if (!instance || !instance.sound) {
    throw new AudioError(
      'Invalid audio instance provided',
      'PLAY',
      { instanceId: instance?.id }
    );
  }

  if (positionMillis < 0) {
    throw new AudioError(
      'Seek position must be non-negative',
      'PLAY',
      { positionMillis }
    );
  }

  const context = {
    operation: 'seek_audio',
    audioId: instance.id,
    positionMillis
  };

  try {
    await instance.sound.setPositionAsync(positionMillis);
    instance.position = positionMillis;
    
    console.log(`⏭️ Audio seeked to ${positionMillis}ms: ${instance.id}`);
    
  } catch (error) {
    logError(error, context);
    
    throw new AudioError(
      `Failed to seek audio: ${error instanceof Error ? error.message : 'Unknown error'}`,
      'PLAY',
      context,
      error instanceof Error ? error : undefined
    );
  }
}

/**
 * Set audio volume
 * 
 * @param instance - Audio instance to modify
 * @param volume - Volume level (0.0 to 1.0)
 * @returns Promise that resolves when volume is set
 */
export async function setAudioVolume(instance: AudioInstance, volume: number): Promise<void> {
  if (!instance || !instance.sound) {
    throw new AudioError(
      'Invalid audio instance provided',
      'PLAY',
      { instanceId: instance?.id }
    );
  }

  if (volume < 0 || volume > 1) {
    throw new AudioError(
      'Volume must be between 0.0 and 1.0',
      'PLAY',
      { volume }
    );
  }

  const context = {
    operation: 'set_audio_volume',
    audioId: instance.id,
    volume
  };

  try {
    await instance.sound.setVolumeAsync(volume);
    
    console.log(`🔊 Audio volume set to ${volume}: ${instance.id}`);
    
  } catch (error) {
    logError(error, context);
    
    throw new AudioError(
      `Failed to set audio volume: ${error instanceof Error ? error.message : 'Unknown error'}`,
      'PLAY',
      context,
      error instanceof Error ? error : undefined
    );
  }
}

/**
 * Get current audio playback status
 * 
 * @param instance - Audio instance to check
 * @returns Promise resolving to current playback status
 */
export async function getAudioStatus(instance: AudioInstance): Promise<AudioPlaybackStatus> {
  if (!instance || !instance.sound) {
    throw new AudioError(
      'Invalid audio instance provided',
      'PLAY',
      { instanceId: instance?.id }
    );
  }

  const context = {
    operation: 'get_audio_status',
    audioId: instance.id
  };

  try {
    const status = await instance.sound.getStatusAsync();
    return mapToAudioPlaybackStatus(status);
  } catch (error) {
    logError(error, context);
    
    throw new AudioError(
      `Failed to get audio status: ${error instanceof Error ? error.message : 'Unknown error'}`,
      'PLAY',
      context,
      error instanceof Error ? error : undefined
    );
  }
}

/**
 * Stop all active audio instances
 * Useful for cleanup when app goes to background or user navigates away
 */
export async function stopAllAudio(): Promise<void> {
  const instances = Array.from(activeAudioInstances.values());
  
  if (instances.length === 0) {
    return;
  }

  console.log(`🛑 Stopping ${instances.length} active audio instances`);
  
  const stopPromises = instances.map(instance => 
    stopAudio(instance).catch(error => {
      logError(error, { operation: 'stop_all_audio', audioId: instance.id });
    })
  );

  await Promise.all(stopPromises);
}

/**
 * Progressive audio playback for streaming
 * Starts playback as soon as enough data is available
 * 
 * @param uri - Audio URI (typically a blob URL from streaming TTS)
 * @param options - Playback options with progress callbacks
 * @returns Promise resolving to AudioInstance
 */
export async function playAudioProgressive(
  uri: string,
  options: AudioPlaybackOptions & {
    onBuffering?: (isBuffering: boolean) => void;
    onReadyToPlay?: () => void;
  } = {}
): Promise<AudioInstance> {
  const progressiveOptions: AudioPlaybackOptions = {
    ...options,
    shouldPlay: true, // Start playing immediately when ready
    onLoadStart: () => {
      if (options.onBuffering) {
        options.onBuffering(true);
      }
      if (options.onLoadStart) {
        options.onLoadStart();
      }
    },
    onLoadComplete: (duration) => {
      if (options.onBuffering) {
        options.onBuffering(false);
      }
      if (options.onReadyToPlay) {
        options.onReadyToPlay();
      }
      if (options.onLoadComplete) {
        options.onLoadComplete(duration);
      }
    },
    onPlaybackStatusUpdate: (status) => {
      // Handle buffering states for progressive playback
      if (status.isLoaded && !status.isPlaying && status.position === 0) {
        if (options.onBuffering) {
          options.onBuffering(true);
        }
      } else if (status.isPlaying) {
        if (options.onBuffering) {
          options.onBuffering(false);
        }
      }
      
      if (options.onPlaybackStatusUpdate) {
        options.onPlaybackStatusUpdate(status);
      }
    }
  };

  return playAudio(uri, progressiveOptions);
}

/**
 * Update audio instance status based on expo-av status
 */
function updateAudioInstanceStatus(instance: AudioInstance, status: any): void {
  if (!status.isLoaded) {
    instance.status = status.error ? AudioStatus.ERROR : AudioStatus.LOADING;
    return;
  }

  instance.duration = status.durationMillis;
  instance.position = status.positionMillis;

  if (status.didJustFinish) {
    instance.status = AudioStatus.FINISHED;
  } else if (status.isPlaying) {
    instance.status = AudioStatus.PLAYING;
  } else if (status.positionMillis === 0 && !status.isPlaying) {
    instance.status = AudioStatus.READY;
  } else {
    instance.status = AudioStatus.PAUSED;
  }
}

/**
 * Map expo-av status to our AudioPlaybackStatus interface
 */
function mapToAudioPlaybackStatus(status: any): AudioPlaybackStatus {
  return {
    isLoaded: status.isLoaded || false,
    isPlaying: status.isPlaying || false,
    position: status.positionMillis || 0,
    duration: status.durationMillis,
    volume: status.volume || 1.0,
    rate: status.rate || 1.0,
    shouldLoop: status.shouldLoop || false,
    error: status.error,
  };
}

/**
 * Start automatic resource cleanup timer
 */
function startResourceCleanup(): void {
  if (!cleanupTimer) {
    cleanupTimer = setInterval(() => {
      // Clean up finished audio instances
      for (const [id, instance] of activeAudioInstances.entries()) {
        if (instance.status === AudioStatus.FINISHED || instance.status === AudioStatus.ERROR) {
          activeAudioInstances.delete(id);
        }
      }
      
      // Limit pooled sounds to prevent memory leaks
      if (audioResourcePool.size > MAX_POOLED_SOUNDS) {
        const soundsToRemove = Array.from(audioResourcePool).slice(MAX_POOLED_SOUNDS);
        soundsToRemove.forEach(sound => {
          sound.unloadAsync().catch(() => {}); // Silent cleanup
          audioResourcePool.delete(sound);
        });
      }
    }, CLEANUP_INTERVAL);
  }
}

/**
 * Stop automatic resource cleanup timer
 */
function stopResourceCleanup(): void {
  if (cleanupTimer) {
    clearInterval(cleanupTimer);
    cleanupTimer = null;
  }
}

/**
 * Cleanup function to be called when app is backgrounded or closed
 * This prevents memory leaks and ensures proper resource cleanup
 */
export async function cleanupAudioResources(): Promise<void> {
  try {
    stopResourceCleanup();
    await stopAllAudio();
    
    // Clean up pooled resources
    for (const sound of audioResourcePool) {
      await sound.unloadAsync().catch(() => {}); // Silent cleanup
    }
    audioResourcePool.clear();
    
    console.log('🧹 Audio resources cleaned up');
  } catch (error) {
    logError(error, { operation: 'cleanup_audio_resources' });
  }
}

// Start resource cleanup when module loads
startResourceCleanup();

// Export types for external use
// Types are already exported above

// Export constants
export const AUDIO_CONSTANTS = {
  DEFAULT_VOLUME: 1.0,
  DEFAULT_RATE: 1.0,
  DEFAULT_PROGRESS_UPDATE_INTERVAL: 100,
  MAX_CONCURRENT_AUDIO: 5, // Prevent too many simultaneous audio instances
} as const;