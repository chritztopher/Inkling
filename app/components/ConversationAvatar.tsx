import React, { memo, useMemo } from 'react';
import { View, StyleSheet } from 'react-native';
import { SvgXml } from 'react-native-svg';
import { Ionicons } from '@expo/vector-icons';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
} from 'react-native-reanimated';
import LottieView from 'lottie-react-native';

interface ConversationAvatarProps {
  inkBlotSvg: string | null;
  isSpeaking: boolean;
  screenWidth: number;
}

const ConversationAvatar = memo<ConversationAvatarProps>(({
  inkBlotSvg,
  isSpeaking,
  screenWidth,
}) => {
  const avatarScale = useSharedValue(1);
  const avatarOpacity = useSharedValue(1);

  // Memoize SVG dimensions to prevent recalculation
  const svgDimensions = useMemo(() => ({
    width: screenWidth * 0.8,
    height: screenWidth * 0.8,
  }), [screenWidth]);

  // Memoize animation styles
  const avatarAnimatedStyle = useAnimatedStyle(() => {
    return {
      transform: [{ scale: avatarScale.value }],
      opacity: avatarOpacity.value,
    };
  }, []);

  // Memoize waveform animation logic
  const showWaveform = useMemo(() => isSpeaking, [isSpeaking]);

  return (
    <View style={styles.container}>
      {/* Ink-blot background */}
      <View style={styles.inkBlotContainer}>
        {inkBlotSvg && (
          <SvgXml
            xml={inkBlotSvg}
            width={svgDimensions.width}
            height={svgDimensions.height}
            style={styles.inkBlot}
          />
        )}
      </View>

      {/* Avatar */}
      <Animated.View style={[styles.avatarContainer, avatarAnimatedStyle]}>
        <View style={styles.avatar}>
          <Ionicons 
            name="person" 
            size={80} 
            color="#525252" 
            style={styles.avatarIcon}
          />
        </View>
      </Animated.View>

      {/* Waveform overlay - only render when speaking */}
      {showWaveform && (
        <View style={styles.waveformOverlay}>
          <LottieView
            source={require('../../assets/waveform.json')}
            autoPlay
            loop
            style={styles.waveform}
          />
        </View>
      )}
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  inkBlotContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    position: 'absolute',
  },
  inkBlot: {
    position: 'absolute',
  },
  avatarContainer: {
    zIndex: 10,
  },
  avatar: {
    width: 160,
    height: 160,
    borderRadius: 80,
    backgroundColor: '#ffffff',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000000',
    shadowOffset: {
      width: 0,
      height: 8,
    },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 16,
  },
  avatarIcon: {
    // Avatar icon styles
  },
  waveformOverlay: {
    position: 'absolute',
    bottom: 100,
    left: 0,
    right: 0,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 15,
  },
  waveform: {
    width: 100,
    height: 30,
    opacity: 0.7,
  },
});

ConversationAvatar.displayName = 'ConversationAvatar';

export default ConversationAvatar;