import React, { useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { Platform } from 'react-native';
import * as SplashScreen from 'expo-splash-screen';
import { Asset } from 'expo-asset';

// Navigation
import Navigation from './app/navigation';

// NativeWind styles
import './global.css';

// Prevent the splash screen from auto-hiding before asset loading is complete
SplashScreen.preventAutoHideAsync();

export default function App() {
  useEffect(() => {
    const prepare = async () => {
      try {
        // No assets to preload currently - JSON files are loaded directly when needed
        // await Asset.loadAsync([]);
      } catch (error) {
        console.warn('Failed to load assets:', error);
      } finally {
        // Hide splash screen
        await SplashScreen.hideAsync();
      }
    };

    prepare();
  }, []);

  return (
    <>
      <StatusBar style={Platform.OS === 'ios' ? 'dark' : 'auto'} />
      <Navigation />
    </>
  );
} 