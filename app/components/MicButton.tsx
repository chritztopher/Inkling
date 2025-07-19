import React, { useEffect, useRef } from 'react';
import {
  View,
  Pressable,
  StyleSheet,
  type GestureResponderEvent,
  type PressableStateCallbackType,
  type ViewStyle,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withRepeat,
  withSequence,
  cancelAnimation,
} from 'react-native-reanimated';
import LottieView from 'lottie-react-native';

// Types
export type MicButtonState = 'idle' | 'listening' | 'thinking' | 'speaking';

interface MicButtonProps {
  state: MicButtonState;
  onPressIn: (event: GestureResponderEvent) => void;
  onPressOut: (event: GestureResponderEvent) => void;
  disabled?: boolean;
  size?: number;
  style?: ViewStyle;
}

const MicButton: React.FC<MicButtonProps> = ({
  state,
  onPressIn,
  onPressOut,
  disabled = false,
  size = 72,
  style,
}) => {
  const scale = useSharedValue(1);
  const opacity = useSharedValue(1);
  const pulseScale = useSharedValue(1);
  const lottieRef = useRef<LottieView>(null);

  // Handle state changes and animations
  useEffect(() => {
    switch (state) {
      case 'idle':
        cancelAnimation(scale);
        cancelAnimation(pulseScale);
        scale.value = withTiming(1, { duration: 200 });
        pulseScale.value = withTiming(1, { duration: 200 });
        opacity.value = withTiming(1, { duration: 200 });
        break;

      case 'listening':
        // Pulsing animation for listening state
        pulseScale.value = withRepeat(
          withSequence(
            withTiming(1.1, { duration: 600 }),
            withTiming(1, { duration: 600 })
          ),
          -1,
          false
        );
        opacity.value = withTiming(1, { duration: 200 });
        break;

      case 'thinking':
        cancelAnimation(pulseScale);
        scale.value = withTiming(1, { duration: 200 });
        pulseScale.value = withTiming(1, { duration: 200 });
        // Subtle opacity pulse for thinking
        opacity.value = withRepeat(
          withSequence(
            withTiming(0.7, { duration: 800 }),
            withTiming(1, { duration: 800 })
          ),
          -1,
          false
        );
        break;

      case 'speaking':
        cancelAnimation(pulseScale);
        cancelAnimation(opacity);
        scale.value = withTiming(1, { duration: 200 });
        pulseScale.value = withTiming(1, { duration: 200 });
        opacity.value = withTiming(1, { duration: 200 });
        // Start lottie animation
        lottieRef.current?.play();
        break;

      default:
        break;
    }
  }, [state]);

  // Stop lottie animation when not speaking
  useEffect(() => {
    if (state !== 'speaking') {
      lottieRef.current?.pause();
    }
  }, [state]);

  const animatedStyle = useAnimatedStyle(() => {
    return {
      transform: [{ scale: scale.value * pulseScale.value }],
      opacity: opacity.value,
    };
  });

  const handlePressIn = (event: GestureResponderEvent) => {
    if (disabled || state !== 'idle') return;
    
    scale.value = withTiming(0.95, { duration: 100 });
    onPressIn(event);
  };

  const handlePressOut = (event: GestureResponderEvent) => {
    if (disabled) return;
    
    scale.value = withTiming(1, { duration: 100 });
    onPressOut(event);
  };

  const getButtonStyle = ({ pressed }: PressableStateCallbackType) => {
    const baseStyle = [
      styles.button,
      {
        width: size,
        height: size,
        borderRadius: size / 2,
      },
      style,
    ];

    if (disabled) {
      return [...baseStyle, styles.disabled];
    }

    if (pressed && state === 'idle') {
      return [...baseStyle, styles.pressed];
    }

    return baseStyle;
  };

  const getIconName = () => {
    switch (state) {
      case 'listening':
        return 'mic';
      case 'thinking':
        return 'mic-outline';
      case 'speaking':
        return 'mic';
      default:
        return 'mic-outline';
    }
  };

  const getIconColor = () => {
    if (disabled) return '#a3a3a3';
    
    switch (state) {
      case 'listening':
        return '#ffffff';
      case 'thinking':
        return '#ffffff';
      case 'speaking':
        return '#ffffff';
      default:
        return '#ffffff';
    }
  };

  const getAccessibilityLabel = () => {
    switch (state) {
      case 'listening':
        return 'Recording voice message';
      case 'thinking':
        return 'Processing voice message';
      case 'speaking':
        return 'Playing response';
      default:
        return 'Start voice recording';
    }
  };

  const getAccessibilityHint = () => {
    switch (state) {
      case 'idle':
        return 'Press and hold to start recording';
      case 'listening':
        return 'Release to stop recording';
      case 'thinking':
        return 'Processing your message';
      case 'speaking':
        return 'Response is playing';
      default:
        return '';
    }
  };

  return (
    <Animated.View style={[animatedStyle]}>
      <Pressable
        style={getButtonStyle}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        disabled={disabled}
        accessibilityRole="button"
        accessibilityLabel={getAccessibilityLabel()}
        accessibilityHint={getAccessibilityHint()}
        accessibilityState={{
          disabled,
          busy: state === 'thinking',
        }}
      >
        <View style={styles.iconContainer}>
          {state === 'speaking' && (
            <View style={styles.lottieContainer}>
              <LottieView
                ref={lottieRef}
                source={require('../../assets/waveform.json')}
                autoPlay={false}
                loop={true}
                style={styles.lottie}
              />
            </View>
          )}
          
          <Ionicons
            name={getIconName()}
            size={size * 0.4}
            color={getIconColor()}
            style={[
              styles.icon,
              state === 'speaking' && styles.iconWithLottie,
            ]}
          />
          
          {state === 'thinking' && (
            <View style={styles.thinkingIndicator}>
              <View style={styles.dot} />
              <View style={[styles.dot, styles.dotDelayed]} />
              <View style={[styles.dot, styles.dotDelayed2]} />
            </View>
          )}
        </View>
      </Pressable>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  button: {
    backgroundColor: '#0ea5e9', // primary color
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 8,
  },
  pressed: {
    backgroundColor: '#0284c7', // primary-600
  },
  disabled: {
    backgroundColor: '#a3a3a3', // neutral-400
    shadowOpacity: 0.1,
    elevation: 2,
  },
  iconContainer: {
    position: 'relative',
    justifyContent: 'center',
    alignItems: 'center',
  },
  icon: {
    // Default icon styles
  },
  iconWithLottie: {
    opacity: 0.8,
  },
  lottieContainer: {
    position: 'absolute',
    top: -15,
    left: -15,
    right: -15,
    bottom: -15,
    justifyContent: 'center',
    alignItems: 'center',
  },
  lottie: {
    width: 60,
    height: 60,
  },
  thinkingIndicator: {
    position: 'absolute',
    top: -8,
    right: -8,
    flexDirection: 'row',
    alignItems: 'center',
  },
  dot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#ffffff',
    marginHorizontal: 1,
    opacity: 0.6,
  },
  dotDelayed: {
    // Animation will be handled by the parent component
  },
  dotDelayed2: {
    // Animation will be handled by the parent component
  },
});

export default MicButton; 