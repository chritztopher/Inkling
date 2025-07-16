import React, { memo, useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert, ActionSheetIOS, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface ConversationHeaderProps {
  personaName: string;
  onEndChat: () => void;
}

const ConversationHeader = memo<ConversationHeaderProps>(({
  personaName,
  onEndChat,
}) => {
  const handleOverflowMenu = useCallback(() => {
    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          options: ['Change Persona', 'Bookmarks', 'End Chat', 'Cancel'],
          destructiveButtonIndex: 2,
          cancelButtonIndex: 3,
        },
        (buttonIndex) => {
          switch (buttonIndex) {
            case 0:
              // Change Persona
              Alert.alert('Change Persona', 'Feature coming soon!');
              break;
            case 1:
              // Bookmarks
              Alert.alert('Bookmarks', 'Feature coming soon!');
              break;
            case 2:
              // End Chat
              onEndChat();
              break;
            default:
              break;
          }
        }
      );
    } else {
      // Android fallback
      Alert.alert(
        'Conversation Options',
        'Choose an option',
        [
          { text: 'Change Persona', onPress: () => Alert.alert('Change Persona', 'Feature coming soon!') },
          { text: 'Bookmarks', onPress: () => Alert.alert('Bookmarks', 'Feature coming soon!') },
          { text: 'End Chat', onPress: onEndChat },
          { text: 'Cancel', style: 'cancel' },
        ]
      );
    }
  }, [onEndChat]);

  return (
    <View style={styles.header}>
      <Text style={styles.headerText}>
        Talking to: {personaName}
      </Text>
      <TouchableOpacity
        style={styles.overflowButton}
        onPress={handleOverflowMenu}
        accessibilityRole="button"
        accessibilityLabel="Conversation options"
        accessibilityHint="Opens menu with conversation options"
      >
        <Ionicons name="ellipsis-horizontal" size={24} color="#525252" />
      </TouchableOpacity>
    </View>
  );
});

const styles = StyleSheet.create({
  header: {
    height: 64,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 8,
    backgroundColor: '#ffffff',
  },
  headerText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#374151',
  },
  overflowButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#f3f4f6',
    justifyContent: 'center',
    alignItems: 'center',
  },
});

ConversationHeader.displayName = 'ConversationHeader';

export default ConversationHeader;