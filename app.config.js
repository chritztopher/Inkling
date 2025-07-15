import "dotenv/config";

export default {
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
      "**/*"
    ],
    ios: {
      supportsTablet: true,
      bundleIdentifier: "com.inkling.conversation"
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
      "expo-av"
    ]
  },
  extra: {
    ELEVENLABS_API_KEY: process.env.ELEVENLABS_API_KEY,
    OPENAI_API_KEY: process.env.OPENAI_API_KEY,
  },
}; 