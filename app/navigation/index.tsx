import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { SafeAreaProvider } from 'react-native-safe-area-context';

// Screens
import ConversationScreen from '../screens/ConversationScreen';
import PersonasScreen from '../screens/PersonasScreen';
import HomeScreen from '../screens/HomeScreen';

// Types
export type RootStackParamList = {
  Home: undefined;
  Personas: undefined;
  Conversation: {
    personaId: string;
    bookId: string;
  };
};

const Stack = createNativeStackNavigator<RootStackParamList>();

const Navigation: React.FC = () => {
  return (
    <SafeAreaProvider>
      <NavigationContainer>
        <Stack.Navigator
          initialRouteName="Home"
          screenOptions={{
            headerShown: false,
            animation: 'slide_from_right',
          }}
        >
          <Stack.Screen
            name="Home"
            component={HomeScreen}
            options={{
              title: 'Inkling',
            }}
          />
          
          <Stack.Screen
            name="Personas"
            component={PersonasScreen}
            options={{
              title: 'Choose a Persona',
              headerShown: true,
              headerBackVisible: true,
            }}
          />
          
          <Stack.Screen
            name="Conversation"
            component={ConversationScreen}
            options={{
              title: 'Conversation',
              presentation: 'fullScreenModal',
              animation: 'slide_from_bottom',
            }}
          />
        </Stack.Navigator>
      </NavigationContainer>
    </SafeAreaProvider>
  );
};

export default Navigation; 