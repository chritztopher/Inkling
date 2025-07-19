// Mock for expo-av
module.exports = {
  Audio: {
    requestPermissionsAsync: jest.fn().mockResolvedValue({ status: 'granted' }),
    setAudioModeAsync: jest.fn().mockResolvedValue(),
    Recording: jest.fn().mockImplementation(() => ({
      prepareToRecordAsync: jest.fn().mockResolvedValue(),
      startAsync: jest.fn().mockResolvedValue(),
      stopAndUnloadAsync: jest.fn().mockResolvedValue(),
      getURI: jest.fn().mockReturnValue('blob:test-recording-uri'),
    })),
    Sound: {
      createAsync: jest.fn().mockResolvedValue({
        sound: {
          playAsync: jest.fn().mockResolvedValue(),
          pauseAsync: jest.fn().mockResolvedValue(),
          stopAsync: jest.fn().mockResolvedValue(),
          unloadAsync: jest.fn().mockResolvedValue(),
          setOnPlaybackStatusUpdate: jest.fn(),
          getStatusAsync: jest.fn().mockResolvedValue({
            isLoaded: true,
            isPlaying: false,
            positionMillis: 0,
            durationMillis: 5000,
          }),
        }
      }),
    },
    RecordingStatus: {
      RECORDING: 'recording',
      STOPPED: 'stopped',
    },
    AudioStatus: {
      READY: 'ready',
      LOADING: 'loading',
      PLAYING: 'playing',
      PAUSED: 'paused',
      STOPPED: 'stopped',
      ERROR: 'error',
    },
  },
};