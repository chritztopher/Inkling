# Inkling ConversationScreen v0.1

Your AI Reading Companion - A React Native Expo app for immersive literary conversations.

## Project Overview

This React Native Expo application implements the ConversationScreen v0.1 for Inkling, featuring:

- **Voice-to-Voice Conversations**: Talk with AI personas of famous literary figures
- **Immersive Design**: Beautiful ink-blot backgrounds and avatar animations
- **Real-time Audio**: Whisper STT for voice input and ElevenLabs TTS for responses
- **Responsive UI**: Tailwind-styled components with proper accessibility
- **ElevenLabs Integration**: High-quality text-to-speech with persona-specific voices

## Features

### ConversationScreen Components

1. **Header**: Shows current persona name with overflow menu
2. **Body**: Ink-blot SVG background with animated avatar
3. **Footer**: Microphone button and exit button
4. **States**: Idle, listening, thinking, and speaking animations
5. **Accessibility**: Full VoiceOver/TalkBack support

### Technical Stack

- **React Native**: 0.76.2 with Expo 52
- **TypeScript**: Fully typed codebase
- **Zustand**: Global state management
- **NativeWind**: Tailwind CSS for React Native
- **React Navigation**: Stack navigation
- **React Native Reanimated**: Smooth animations
- **Expo AV**: Audio recording and playback
- **Lottie**: Waveform animations

## Setup Instructions

### Prerequisites

- Node.js (16 or higher)
- npm or yarn
- Expo CLI
- iOS Simulator / Android Emulator

### Installation

1. **Clone and install dependencies**:
   ```bash
   npm install
   # or
   yarn install
   ```

2. **Set up ElevenLabs TTS**:
   ```bash
   # Create .env file
   touch .env
   
   # Add your ElevenLabs API key
   echo "ELEVENLABS_API_KEY=your_api_key_here" >> .env
   ```
   
   **Important**: Get your API key from [ElevenLabs](https://elevenlabs.io) and replace `your_api_key_here`.

3. **Start the development server**:
   ```bash
   npm start
   # or
   yarn start
   ```

4. **Run on iOS Simulator**:
   ```bash
   npm run ios
   # or
   yarn ios
   ```

5. **Run on Android Emulator**:
   ```bash
   npm run android
   # or
   yarn android
   ```

## Project Structure

```
├── app/
│   ├── components/
│   │   └── MicButton.tsx           # Animated microphone button
│   ├── navigation/
│   │   └── index.tsx               # Navigation stack setup
│   └── screens/
│       ├── ConversationScreen.tsx  # Main conversation interface
│       ├── PersonasScreen.tsx      # Persona selection
│       └── HomeScreen.tsx          # Home screen
├── assets/
│   ├── inkblot.svg                 # Background ink-blot design
│   └── waveform.json               # Lottie waveform animation
├── services/
│   └── chat.ts                     # Chat API and persona management
├── stores/
│   └── chatStore.ts                # Zustand state management
├── utils/
│   ├── voice.ts                    # Voice recording utilities
│   ├── eleven.ts                   # ElevenLabs API wrapper
│   └── tts.ts                      # Provider-agnostic TTS interface
├── App.tsx                         # Main app entry point
├── ELEVENLABS_INTEGRATION.md       # Detailed ElevenLabs integration docs
└── SETUP_GUIDE.md                  # Quick setup guide
```

## Usage

### Navigation Flow

1. **Home Screen**: Welcome screen with "Start Conversation" button
2. **Personas Screen**: Select from available literary figures (Jane Austen, Shakespeare, etc.)
3. **Conversation Screen**: Voice-to-voice conversation with selected persona

### Voice Interaction

1. **Hold** the microphone button to start recording
2. **Release** to stop recording and process your voice
3. **Listen** to the AI persona's response
4. **Tap** the overflow menu (⋯) for conversation options

### Accessibility

- Full VoiceOver/TalkBack support
- Proper accessibility labels and hints
- Screen reader announcements for state changes
- Keyboard navigation support

## API Integration

### ElevenLabs TTS (Production-Ready)

The app includes a **complete ElevenLabs TTS integration**:

- **Real-time synthesis**: Convert text to speech using ElevenLabs API
- **Persona-specific voices**: Different voices for Jane Austen, Shakespeare, etc.
- **Streaming audio**: Fast playback with blob URLs
- **Error handling**: Graceful fallbacks with user-friendly notifications
- **Usage tracking**: Monitor API credits and consumption

**Quick Setup**:
1. Get API key from [ElevenLabs](https://elevenlabs.io)
2. Add to `.env`: `ELEVENLABS_API_KEY=your_key_here`
3. Start the app and test voice interactions

See `ELEVENLABS_INTEGRATION.md` for detailed documentation.

### Voice Services (Mock Implementation)

The app includes mock implementations for:

- **Whisper STT**: `utils/voice.ts` - `transcribeAudio()`
- **Chat API**: `services/chat.ts` - `getInklingResponse()`

To integrate with real APIs:

1. Replace the mock implementations with actual API calls
2. Add your API keys to environment variables
3. Update the service URLs in the respective files

### Example STT Integration

```typescript
// In utils/voice.ts
export const transcribeAudio = async (audioUri: string): Promise<string | null> => {
  const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
      'Content-Type': 'multipart/form-data',
    },
    body: formData, // Your audio file
  });
  
  const result = await response.json();
  return result.text;
};
```

## Testing

### Acceptance Test

Run the app and verify:

1. **Navigation**: Home → Personas → Conversation works
2. **Voice Recording**: Hold mic button to record
3. **Audio Playback**: Receive and play AI responses
4. **Accessibility**: All buttons are tappable with proper labels
5. **Safe Areas**: UI respects device safe areas
6. **No Errors**: No red error screens or console errors

### Manual Testing

1. Select "Jane Austen" persona
2. Hold microphone button and speak
3. Release and wait for response
4. Verify audio playback and animations
5. Test overflow menu functionality
6. Test exit button navigation

## Customization

### Adding New Personas

1. Update `services/chat.ts` with new persona data
2. Add persona to `PersonasScreen.tsx` mock data
3. Update voice mappings in TTS service

### Styling

- Modify `tailwind.config.js` for custom colors/spacing
- Update component styles in respective files
- Customize animations in `MicButton.tsx`

## Troubleshooting

### Common Issues

1. **Audio Permission**: Ensure microphone permissions are granted
2. **Metro Bundle**: Clear cache with `npx expo start --clear`
3. **Dependencies**: Run `npm install` if modules are missing
4. **Simulator**: Use physical device for audio testing

### Debug Mode

Enable debug logging in `utils/voice.ts` and `services/chat.ts`:

```typescript
const DEBUG = true;
if (DEBUG) console.log('Voice operation:', result);
```

## Future Enhancements

- Real-time conversation streaming
- Multiple book contexts per persona
- Conversation history persistence
- Voice cloning for authentic persona voices
- Multi-language support

## License

MIT License - See LICENSE file for details

## Contributing

1. Fork the repository
2. Create a feature branch
3. Commit your changes
4. Push to the branch
5. Create a Pull Request

---

**Note**: This is a demo implementation with mock APIs. For production use, integrate with actual Whisper STT and ElevenLabs TTS services. 