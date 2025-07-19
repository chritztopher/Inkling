import { Audio } from 'expo-av';
// import * as FileSystem from 'expo-file-system';

// Types
export interface VoiceRecordingOptions {
  android: {
    extension: string;
    outputFormat: number;
    audioEncoder: number;
    sampleRate: number;
    numberOfChannels: number;
    bitRate: number;
  };
  ios: {
    extension: string;
    outputFormat: number;
    audioQuality: number;
    sampleRate: number;
    numberOfChannels: number;
    bitRate: number;
    linearPCMBitDepth?: number;
    linearPCMIsBigEndian?: boolean;
    linearPCMIsFloat?: boolean;
  };
  web: {
    mimeType: string;
    bitsPerSecond: number;
  };
}

export interface RecordingState {
  isRecording: boolean;
  recording: Audio.Recording | null;
  uri: string | null;
}

// Default recording options
const recordingOptions: VoiceRecordingOptions = {
  android: {
    extension: '.m4a',
    outputFormat: Audio.AndroidOutputFormat.MPEG_4,
    audioEncoder: Audio.AndroidAudioEncoder.AAC,
    sampleRate: 44100,
    numberOfChannels: 1, // Use mono for better compatibility
    bitRate: 128000,
  },
  ios: {
    extension: '.m4a',
    outputFormat: Number(Audio.IOSOutputFormat.MPEG4AAC),
    audioQuality: Number(Audio.IOSAudioQuality.MEDIUM), // Use medium quality for better compatibility
    sampleRate: 44100,
    numberOfChannels: 1, // Use mono for better compatibility
    bitRate: 128000,
    // Remove linearPCM settings as they conflict with AAC format
  },
  web: {
    mimeType: 'audio/webm;codecs=opus',
    bitsPerSecond: 128000,
  },
};

/**
 * Initialize audio recording permissions and setup
 */
export const initializeAudio = async (): Promise<boolean> => {
  try {
    const { status } = await Audio.requestPermissionsAsync();
    if (status !== 'granted') {
      console.error('Audio permission not granted');
      return false;
    }

    await Audio.setAudioModeAsync({
      allowsRecordingIOS: true,
      playsInSilentModeIOS: true,
      playThroughEarpieceAndroid: false,
      shouldDuckAndroid: true,
      staysActiveInBackground: false, // Changed to false to prevent background issues
    });

    return true;
  } catch (error) {
    console.error('Failed to initialize audio:', error);
    return false;
  }
};

/**
 * Start recording audio
 */
export const startRecording = async (): Promise<Audio.Recording | null> => {
  try {
    const hasPermission = await initializeAudio();
    if (!hasPermission) {
      throw new Error('Audio permission not granted');
    }

    // Add a small delay to ensure audio mode is set
    await new Promise(resolve => setTimeout(resolve, 100));

    const { recording } = await Audio.Recording.createAsync(recordingOptions);
    return recording;
  } catch (error) {
    console.error('Failed to start recording:', error);
    
    // Try with minimal configuration if default fails
    try {
      console.log('Attempting recording with minimal configuration...');
      const minimalOptions = {
        android: {
          extension: '.m4a',
          outputFormat: Audio.AndroidOutputFormat.MPEG_4,
          audioEncoder: Audio.AndroidAudioEncoder.AAC,
          sampleRate: 44100,
          numberOfChannels: 1,
          bitRate: 128000,
        },
        ios: {
          extension: '.m4a',
          outputFormat: Number(Audio.IOSOutputFormat.MPEG4AAC),
          audioQuality: Number(Audio.IOSAudioQuality.LOW),
          sampleRate: 44100,
          numberOfChannels: 1,
          bitRate: 128000,
        },
        web: {
          mimeType: 'audio/webm;codecs=opus',
          bitsPerSecond: 128000,
        },
      };
      
      const { recording } = await Audio.Recording.createAsync(minimalOptions);
      return recording;
    } catch (fallbackError) {
      console.error('Fallback recording also failed:', fallbackError);
      return null;
    }
  }
};

/**
 * Stop recording and return the audio URI
 */
export const stopRecording = async (recording: Audio.Recording): Promise<string | null> => {
  try {
    await recording.stopAndUnloadAsync();
    const uri = recording.getURI();
    return uri;
  } catch (error) {
    console.error('Failed to stop recording:', error);
    return null;
  }
};

/**
 * Convert audio to text using OpenAI Whisper
 */
export const transcribeAudio = async (audioUri: string): Promise<string | null> => {
  try {
    // Import the OpenAI wrapper function
    // Import the sttWhisper function directly
    const { sttWhisper: whisperTranscribe } = await import('./api');
    
    // Use the OpenAI Whisper API
    const result = await whisperTranscribe(audioUri);
    return result;
  } catch (error) {
    console.error('Failed to transcribe audio:', error);
    return null;
  }
};

/**
 * Convert text to speech using ElevenLabs TTS
 * This is a mock implementation - replace with actual ElevenLabs API call
 */
export const synthesizeSpeech = async (text: string, voiceId: string = 'default'): Promise<string | null> => {
  try {
    // In a real implementation, you would:
    // 1. Call ElevenLabs API with text and voice ID
    // 2. Get back audio URL or base64 audio
    // 3. Return the audio URL
    
    // Mock implementation for now
    const response = await fetch('https://your-api-endpoint.com/elevenlabs/tts', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        text,
        voice_id: voiceId,
        model_id: 'eleven_monolingual_v1',
        voice_settings: {
          stability: 0.5,
          similarity_boost: 0.5,
        },
      }),
    });

    if (!response.ok) {
      throw new Error(`TTS failed: ${response.statusText}`);
    }

    const audioBlob = await response.blob();
    const audioUrl = URL.createObjectURL(audioBlob);
    return audioUrl;
  } catch (error) {
    console.error('Failed to synthesize speech:', error);
    return null;
  }
};

/**
 * Play audio from URL
 */
export const playAudio = async (audioUrl: string, existingSound?: Audio.Sound | null): Promise<Audio.Sound | null> => {
  try {
    // Clean up existing sound if provided
    if (existingSound) {
      try {
        await existingSound.stopAsync();
        await existingSound.unloadAsync();
      } catch (cleanupError) {
        console.warn('Failed to cleanup existing sound:', cleanupError);
      }
    }

    const { sound } = await Audio.Sound.createAsync({ uri: audioUrl });
    
    // Set up unload listener to prevent memory leaks
    sound.setOnPlaybackStatusUpdate((status) => {
      if (status.isLoaded && status.didJustFinish) {
        sound.unloadAsync().catch(console.error);
      }
    });
    
    await sound.playAsync();
    return sound;
  } catch (error) {
    console.error('Failed to play audio:', error);
    return null;
  }
};

/**
 * Stop audio playback
 */
export const stopAudio = async (sound: Audio.Sound): Promise<void> => {
  try {
    await sound.stopAsync();
    await sound.unloadAsync();
  } catch (error) {
    console.error('Failed to stop audio:', error);
  }
};

/**
 * Get audio duration
 */
export const getAudioDuration = async (sound: Audio.Sound): Promise<number> => {
  try {
    const status = await sound.getStatusAsync();
    if (status.isLoaded) {
      return status.durationMillis || 0;
    }
    return 0;
  } catch (error) {
    console.error('Failed to get audio duration:', error);
    return 0;
  }
};

/**
 * Clean up audio resources
 */
export const cleanupAudio = async (recording?: Audio.Recording, sound?: Audio.Sound): Promise<void> => {
  try {
    if (recording) {
      await recording.stopAndUnloadAsync();
    }
    if (sound) {
      await sound.stopAsync();
      await sound.unloadAsync();
    }
  } catch (error) {
    console.error('Failed to cleanup audio:', error);
  }
}; 