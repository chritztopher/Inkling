require('dotenv').config();

module.exports = ({ config }) => ({
  ...config,
  expo: {
    name: "Inkling",
    slug: "inkling-conversation",
    version: "1.0.0",
    orientation: "portrait",
    // icon: "./assets/icon.png", // Removed for now - focusing on core functionality
    userInterfaceStyle: "light",
    splash: {
      // image: "./assets/splash.png", // Removed for now - focusing on core functionality
      resizeMode: "contain",
      backgroundColor: "#ffffff"
    },
    assetBundlePatterns: [
      // Assets removed to focus on functionality
    ],
    ios: {
      supportsTablet: true,
      bundleIdentifier: "com.inkling.conversation",
      infoPlist: {
        NSMicrophoneUsageDescription: "This app needs access to the microphone to record voice messages for conversation with AI personas.",
        NSCameraUsageDescription: "This app does not use the camera.",
        UIBackgroundModes: ["audio"]
      }
    },
    android: {
      adaptiveIcon: {
        // foregroundImage: "./assets/adaptive-icon.png", // Removed for now - focusing on core functionality
        backgroundColor: "#ffffff"
      },
      package: "com.inkling.conversation"
    },
    web: {
      // favicon: "./assets/favicon.png" // Removed for now - focusing on core functionality
    },
    plugins: [
      "expo-av",
      "expo-audio"
    ],
    // Add optimization settings
    optimization: {
      tree_shaking: {
        enabled: true
      }
    }
  },
  extra: {
    SUPABASE_URL: process.env.SUPABASE_URL,
    SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY,
  },
}); 