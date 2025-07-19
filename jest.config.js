module.exports = {
  preset: 'react-native',
  testEnvironment: 'node',
  testMatch: [
    '**/__tests__/**/*.(js|jsx|ts|tsx)',
    '**/*.(test|spec).(js|jsx|ts|tsx)'
  ],
  testPathIgnorePatterns: [
    '<rootDir>/supabase/functions/whisper/index.test.ts',
    '<rootDir>/supabase/functions/chat/index.test.ts', 
    '<rootDir>/supabase/functions/tts/index.test.ts',
  ],
  collectCoverageFrom: [
    'supabase/functions/**/*.{js,ts}',
    'utils/**/*.{js,ts}',
    '!supabase/functions/**/*.test.{js,ts}',
    '!supabase/functions/**/*.d.ts',
    '!utils/**/*.test.{js,ts}',
    '!utils/**/*.d.ts'
  ],
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'html'],
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  verbose: true,
  transform: {
    '^.+\\.(js|jsx|ts|tsx)$': 'babel-jest',
  },
  transformIgnorePatterns: [
    'node_modules/(?!(expo-constants|expo-modules-core|@expo|expo-av|react-native|@react-native|react-native-toast-message)/)',
  ],
  moduleNameMapper: {
    '^expo-constants$': '<rootDir>/__mocks__/expo-constants.js',
    '^expo-av$': '<rootDir>/__mocks__/expo-av.js',
    '^react-native-toast-message$': '<rootDir>/__mocks__/react-native-toast-message.js',
  },
};