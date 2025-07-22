import React, { useEffect, useCallback, useMemo } from 'react';
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

// Assets removed to focus on functionality
const criticalAssets: any[] = [];
const nonCriticalAssets: any[] = [];

export default function App() {
  const statusBarStyle = useMemo(() => 
    Platform.OS === 'ios' ? 'dark' : 'auto', 
    []
  );

  const loadCriticalAssets = useCallback(async () => {
    try {
      await Asset.loadAsync(criticalAssets);
    } catch (error) {
      console.warn('Failed to load critical assets:', error);
    }
  }, []);

  const loadNonCriticalAssets = useCallback(async () => {
    try {
      // Load non-critical assets in background
      await Asset.loadAsync(nonCriticalAssets);
    } catch (error) {
      console.warn('Failed to load non-critical assets:', error);
    }
  }, []);

  useEffect(() => {
    const prepare = async () => {
      try {
        // Load critical assets first
        await loadCriticalAssets();
        
        // Hide splash screen as soon as critical assets are loaded
        await SplashScreen.hideAsync();
        
        // Load non-critical assets in background
        loadNonCriticalAssets();
      } catch (error) {
        console.warn('Failed to prepare app:', error);
        // Still hide splash screen even if assets fail to load
        await SplashScreen.hideAsync();
      }
    };

    prepare();
  }, [loadCriticalAssets, loadNonCriticalAssets]);

  return (
    <>
      <StatusBar style={statusBarStyle} />
      <Navigation />
    </>
  );
} 