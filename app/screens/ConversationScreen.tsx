import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  StatusBar,
  Alert,
  ActionSheetIOS,
  Platform,
  AccessibilityInfo,
} from 'react-native';
import Toast from 'react-native-toast-message';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import { type NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { Audio } from 'expo-av';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withRepeat,
  withSequence,
} from 'react-native-reanimated';
import LottieView from 'lottie-react-native';

// Components
import MicButton, { type MicButtonState } from '../components/MicButton';

// Services and Utils
import { startRecording, stopRecording, cleanupAudio } from '../../utils/voice';
import { getPersona, getBook, createMessage } from '../../services/chat';
import { sttWhisper, chatLLM, ttsAudioStream } from '../../utils/api';
import { useChatStore } from '../../stores/chatStore';

// Types
type RootStackParamList = {
  Conversation: {
    personaId: string;
    bookId: string;
  };
};

type ConversationScreenRouteProp = RouteProp<RootStackParamList, 'Conversation'>;
type ConversationScreenNavigationProp = NativeStackNavigationProp<RootStackParamList, 'Conversation'>;

interface ConversationScreenProps {}

const ConversationScreen: React.FC<ConversationScreenProps> = () => {
  const navigation = useNavigation<ConversationScreenNavigationProp>();
  const route = useRoute<ConversationScreenRouteProp>();
  const { personaId, bookId } = route.params;

  // Store
  const {
    setCurrentConversation,
    isRecording,
    isThinking,
    isSpeaking,
    setRecording,
    setThinking,
    setSpeaking,
    addMessage,
    setCurrentAudio,
    resetConversationState,
  } = useChatStore();

  // State
  const [personaName, setPersonaName] = useState<string>('');
  const [currentRecording, setCurrentRecording] = useState<Audio.Recording | null>(null);
  const [currentSound, setCurrentSound] = useState<Audio.Sound | null>(null);

  // Refs
  const mountedRef = useRef(true);
  const avatarScale = useSharedValue(1);
  const avatarOpacity = useSharedValue(1);

  // Load assets and initialize conversation
  useEffect(() => {
    const initializeConversation = async () => {
      try {
        // Load persona and book data
        const persona = await getPersona(personaId);
        const book = await getBook(bookId);

        if (persona) {
          setPersonaName(persona.name);
          
          // Set up conversation context
          setCurrentConversation({
            personaId,
            bookId,
            messages: [],
            persona,
            ...(book && { book }),
          });
        }
      } catch (error) {
        console.error('Failed to initialize conversation:', error);
        Alert.alert('Error', 'Failed to load conversation. Please try again.');
      }
    };

    initializeConversation();

    // Cleanup on unmount
    return () => {
      mountedRef.current = false;
      
      // Enhanced cleanup with proper audio resource management
      if (currentRecording) {
        currentRecording.stopAndUnloadAsync().catch(console.error);
      }
      
      if (currentSound) {
        currentSound.stopAsync()
          .then(() => currentSound.unloadAsync())
          .catch(console.error);
      }
      
      cleanupAudio(currentRecording || undefined, currentSound || undefined);
      resetConversationState();
    };
  }, [personaId, bookId]);

  // Avatar animations
  useEffect(() => {
    if (isThinking) {
      avatarOpacity.value = withRepeat(
        withSequence(
          withTiming(0.6, { duration: 1000 }),
          withTiming(1, { duration: 1000 })
        ),
        -1,
        false
      );
    } else if (isSpeaking) {
      avatarScale.value = withRepeat(
        withSequence(
          withTiming(1.02, { duration: 800 }),
          withTiming(1, { duration: 800 })
        ),
        -1,
        false
      );
    } else {
      avatarOpacity.value = withTiming(1, { duration: 500 });
      avatarScale.value = withTiming(1, { duration: 500 });
    }
  }, [isThinking, isSpeaking]);

  // Handle recording start
  const handleStartRecording = useCallback(async () => {
    try {
      const recording = await startRecording();
      if (recording) {
        setCurrentRecording(recording);
        setRecording(true);
      }
    } catch (error) {
      console.error('Failed to start recording:', error);
      Toast.show({
        type: 'error',
        text1: 'Recording Error',
        text2: 'Failed to start recording. Please check microphone permissions.',
        visibilityTime: 4000,
      });
    }
  }, []);

  // Handle recording stop
  const handleStopRecording = useCallback(async () => {
    if (!currentRecording) return;

    try {
      setRecording(false);
      setThinking(true);

      const audioUri = await stopRecording(currentRecording);
      setCurrentRecording(null);

      if (audioUri) {
        // Handle complete turn with streaming
        await handleTurn(audioUri);
      }
    } catch (error) {
      console.error('Failed to stop recording or process response:', error);
      Toast.show({
        type: 'error',
        text1: 'Processing Error',
        text2: 'Failed to process recording. Please try again.',
        visibilityTime: 4000,
      });
    } finally {
      if (mountedRef.current) {
        setThinking(false);
      }
    }
  }, [currentRecording, personaId, bookId]);

  // Handle complete turn with streaming
  const handleTurn = useCallback(async (audioUri: string) => {
    try {
      const transcript = await sttWhisper(audioUri);
      
      if (!transcript || !mountedRef.current) return;

      // Add user message
      const userMessage = createMessage('user', transcript);
      addMessage(userMessage);

      // Initialize streaming response
      let streamingText = '';
      
      const reply = await chatLLM(
        transcript,
        personaId,
        bookId,
        (delta: string) => {
          streamingText += delta;
          // Optional: update UI with streaming text
          console.log('Streaming chunk:', delta);
        }
      );

      if (!mountedRef.current) return;

      // Add assistant message
      const assistantMessage = createMessage('assistant', reply);
      addMessage(assistantMessage);

      // Generate and play audio
      const audioUrl = await ttsAudioStream(reply);
      const { sound } = await Audio.Sound.createAsync({ uri: audioUrl });
      setCurrentSound(sound);
      setCurrentAudio(sound);
      
      setSpeaking(true);
      AccessibilityInfo.announceForAccessibility('Inkling is talking');
      
      await sound.playAsync();

      // Listen for completion
      sound.setOnPlaybackStatusUpdate((status) => {
        if (status.isLoaded && status.didJustFinish) {
          setSpeaking(false);
          sound.unloadAsync();
          setCurrentSound(null);
          setCurrentAudio(null);
        }
      });
    } catch (error) {
      console.error('Failed to process turn:', error);
      setSpeaking(false);
      setCurrentSound(null);
      setCurrentAudio(null);
      
      Toast.show({
        type: 'error',
        text1: 'Processing Error',
        text2: 'Failed to process conversation turn. Please try again.',
        visibilityTime: 4000,
      });
    }
  }, [personaId, bookId]);



  // Handle overflow menu
  const handleOverflowMenu = useCallback(() => {
    const options = ['Change Persona', 'Bookmarks', 'End Chat', 'Cancel'];
    const cancelButtonIndex = 3;

    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          options,
          cancelButtonIndex,
          title: 'Conversation Options',
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
              handleEndChat();
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
          { text: 'End Chat', onPress: handleEndChat },
          { text: 'Cancel', style: 'cancel' },
        ]
      );
    }
  }, []);

  // Handle end chat
  const handleEndChat = useCallback(() => {
    Alert.alert(
      'End Chat',
      'Are you sure you want to end this conversation?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'End Chat',
          style: 'destructive',
          onPress: () => {
            cleanupAudio(currentRecording || undefined, currentSound || undefined);
            resetConversationState();
            navigation.goBack();
          },
        },
      ]
    );
  }, [currentRecording, currentSound, navigation]);

  // Handle exit button
  const handleExitButton = useCallback(() => {
    // Later this will be swapped for mini-player
    navigation.goBack();
  }, [navigation]);

  // Get mic button state
  const getMicButtonState = (): MicButtonState => {
    if (isRecording) return 'listening';
    if (isThinking) return 'thinking';
    if (isSpeaking) return 'speaking';
    return 'idle';
  };

  // Animated styles
  const avatarAnimatedStyle = useAnimatedStyle(() => {
    return {
      transform: [{ scale: avatarScale.value }],
      opacity: avatarOpacity.value,
    };
  });

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#ffffff" />
      
      {/* Header */}
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

      {/* Body */}
      <View style={styles.body}>
        {/* Background removed for now - focusing on core voice functionality */}

        {/* Avatar */}
        <Animated.View style={[styles.avatarContainer, avatarAnimatedStyle]}>
          <View style={styles.avatar}>
            <Ionicons
              name="person-circle"
              size={140}
              color="#0ea5e9"
              style={styles.avatarIcon}
            />
          </View>
        </Animated.View>

        {/* Speaking waveform overlay */}
        {isSpeaking && (
          <View style={styles.waveformOverlay}>
            <LottieView
              source={require('../../assets/waveform.json')}
              autoPlay={true}
              loop={true}
              style={styles.waveform}
            />
          </View>
        )}
      </View>

      {/* Footer */}
      <View style={styles.footer}>
        <View style={styles.footerContent}>
          {/* Mic Button */}
          <MicButton
            state={getMicButtonState()}
            onPressIn={handleStartRecording}
            onPressOut={handleStopRecording}
            disabled={isThinking || isSpeaking}
            size={72}
            style={styles.micButton}
          />

          {/* Exit Button */}
          <TouchableOpacity
            style={styles.exitButton}
            onPress={handleExitButton}
            accessibilityRole="button"
            accessibilityLabel="Exit conversation"
            accessibilityHint="Goes back to previous screen"
          >
            <Ionicons name="close" size={24} color="#525252" />
          </TouchableOpacity>
        </View>
      </View>

      {/* Toast notifications */}
      <Toast />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  header: {
    height: 56, // 14 * 4 (h-14 in Tailwind)
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e5e5',
  },
  headerText: {
    fontSize: 14,
    color: '#737373',
    fontFamily: 'System',
  },
  overflowButton: {
    padding: 8,
  },
  body: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
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

export default ConversationScreen; 