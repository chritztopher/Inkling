# ElevenLabs TTS Setup Guide

Quick setup guide for ElevenLabs Text-to-Speech integration in Inkling.

## Prerequisites

1. **ElevenLabs Account**: Sign up at [elevenlabs.io](https://elevenlabs.io)
2. **API Key**: Get your API key from the ElevenLabs dashboard
3. **Node.js**: Version 16 or higher
4. **Expo CLI**: Install globally with `npm install -g expo-cli`

## Step-by-Step Setup

### 1. Environment Configuration

Create a `.env` file in your project root:

```bash
# Create .env file
touch .env

# Add your API key
echo "ELEVENLABS_API_KEY=your_api_key_here" >> .env
```

**Important**: Replace `your_api_key_here` with your actual ElevenLabs API key.

### 2. Install Dependencies

```bash
# Install all dependencies
npm install

# Or with yarn
yarn install
```

### 3. Start the Development Server

```bash
# Start Expo development server
npm start

# Or with yarn
yarn start
```

### 4. Test the Integration

1. **Open the app** in iOS Simulator or Android Emulator
2. **Navigate** to Home → Personas → Select "Jane Austen"
3. **Hold the mic button** and speak a message
4. **Release** and wait for the response
5. **Listen** for the synthesized voice response

## Verification Checklist

- [ ] `.env` file created with API key
- [ ] App starts without errors
- [ ] Navigation works (Home → Personas → Conversation)
- [ ] Voice recording works (mic button responds)
- [ ] TTS audio plays after speaking
- [ ] Console shows "Eleven credits used: X"
- [ ] Error handling works (try with invalid key)

## Troubleshooting

### Common Issues

1. **No audio**: 
   - Check device volume
   - Verify API key is correct
   - Test with different text

2. **API errors**:
   - Check ElevenLabs account balance
   - Verify API key format
   - Test network connectivity

3. **App crashes**:
   - Check Metro bundler logs
   - Verify all dependencies installed
   - Clear cache: `expo start --clear`

### Testing with Invalid Key

To test error handling:

1. Set `ELEVENLABS_API_KEY=invalid_key` in `.env`
2. Restart the app
3. Try voice interaction
4. Should see error toast: "ElevenLabs API key not configured"

## API Key Security

- **Never commit** `.env` to version control
- **Use different keys** for development/production
- **Rotate keys** periodically
- **Monitor usage** in ElevenLabs dashboard

## Next Steps

1. **Test different personas** (Shakespeare, Hemingway)
2. **Monitor credit usage** in console logs
3. **Test error scenarios** (network issues, invalid keys)
4. **Explore voice customization** options

## Support

If you encounter issues:

1. Check the console for error messages
2. Review `ELEVENLABS_INTEGRATION.md` for detailed documentation
3. Test with minimal text examples
4. Verify ElevenLabs account status

---

**Ready to go!** Your Inkling app now has ElevenLabs TTS integration. 🎉 