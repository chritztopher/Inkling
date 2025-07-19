import React, { memo, useCallback } from 'react';
import { View, TouchableOpacity, StyleSheet, type GestureResponderEvent, type ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import MicButton, { type MicButtonState } from './MicButton';

interface ConversationFooterProps {
  micButtonState: MicButtonState;
  onMicPressIn: (event: GestureResponderEvent) => void;
  onMicPressOut: (event: GestureResponderEvent) => void;
  onExit: () => void;
  micButtonDisabled?: boolean;
  style?: ViewStyle;
}

const ConversationFooter = memo<ConversationFooterProps>(({
  micButtonState,
  onMicPressIn,
  onMicPressOut,
  onExit,
  micButtonDisabled = false,
  style,
}) => {
  const handleExitPress = useCallback(() => {
    onExit();
  }, [onExit]);

  return (
    <View style={[styles.footer, style]}>
      <View style={styles.footerContent}>
        <TouchableOpacity
          style={styles.exitButton}
          onPress={handleExitPress}
          accessibilityRole="button"
          accessibilityLabel="Exit conversation"
          accessibilityHint="Returns to previous screen"
        >
          <Ionicons name="arrow-back" size={24} color="#525252" />
        </TouchableOpacity>
        
        <MicButton
          state={micButtonState}
          onPressIn={onMicPressIn}
          onPressOut={onMicPressOut}
          disabled={micButtonDisabled}
          style={styles.micButton}
        />
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  footer: {
    height: 96, // 24 * 4 (h-24 in Tailwind)
    paddingBottom: 16, // pb-safe approximation
  },
  footerContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  micButton: {
    marginLeft: 16,
  },
  exitButton: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#e5e5e5',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
});

ConversationFooter.displayName = 'ConversationFooter';

export default ConversationFooter;