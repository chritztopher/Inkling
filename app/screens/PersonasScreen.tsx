import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, FlatList } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { Ionicons } from '@expo/vector-icons';
import { RootStackParamList } from '../navigation';

type PersonasScreenNavigationProp = StackNavigationProp<RootStackParamList, 'Personas'>;

interface PersonaItem {
  id: string;
  name: string;
  description: string;
  avatar: string;
}

const mockPersonas: PersonaItem[] = [
  {
    id: 'jane-austen',
    name: 'Jane Austen',
    description: 'English novelist known for her wit and social commentary',
    avatar: 'person-circle',
  },
  {
    id: 'shakespeare',
    name: 'William Shakespeare',
    description: 'English playwright and poet',
    avatar: 'person-circle',
  },
  {
    id: 'hemingway',
    name: 'Ernest Hemingway',
    description: 'American novelist and journalist',
    avatar: 'person-circle',
  },
];

const PersonasScreen: React.FC = () => {
  const navigation = useNavigation<PersonasScreenNavigationProp>();
  const [selectedPersona, setSelectedPersona] = useState<string>('jane-austen');

  const handlePersonaSelect = (personaId: string) => {
    setSelectedPersona(personaId);
  };

  const handleStartConversation = () => {
    // Default book ID for demo
    const bookId = 'pride-and-prejudice';
    
    navigation.navigate('Conversation', {
      personaId: selectedPersona,
      bookId,
    });
  };

  const renderPersonaItem = ({ item }: { item: PersonaItem }) => (
    <TouchableOpacity
      style={[
        styles.personaCard,
        selectedPersona === item.id && styles.selectedPersonaCard,
      ]}
      onPress={() => handlePersonaSelect(item.id)}
    >
      <View style={styles.personaHeader}>
        <Ionicons
          name={item.avatar as any}
          size={48}
          color={selectedPersona === item.id ? '#0ea5e9' : '#737373'}
        />
        <View style={styles.personaInfo}>
          <Text style={[
            styles.personaName,
            selectedPersona === item.id && styles.selectedPersonaName,
          ]}>
            {item.name}
          </Text>
          <Text style={styles.personaDescription}>
            {item.description}
          </Text>
        </View>
      </View>
      
      {selectedPersona === item.id && (
        <View style={styles.selectedIndicator}>
          <Ionicons name="checkmark-circle" size={24} color="#0ea5e9" />
        </View>
      )}
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="arrow-back" size={24} color="#0ea5e9" />
        </TouchableOpacity>
        <Text style={styles.title}>Choose a Persona</Text>
        <View style={styles.placeholder} />
      </View>

      <View style={styles.content}>
        <Text style={styles.subtitle}>
          Select a literary figure to guide your reading journey
        </Text>

        <FlatList
          data={mockPersonas}
          renderItem={renderPersonaItem}
          keyExtractor={(item) => item.id}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.listContainer}
        />

        <TouchableOpacity
          style={styles.continueButton}
          onPress={handleStartConversation}
        >
          <Text style={styles.continueButtonText}>Start Conversation</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e5e5',
  },
  backButton: {
    padding: 8,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: '#171717',
  },
  placeholder: {
    width: 40,
  },
  content: {
    flex: 1,
    paddingHorizontal: 16,
  },
  subtitle: {
    fontSize: 16,
    color: '#737373',
    textAlign: 'center',
    marginVertical: 24,
  },
  listContainer: {
    paddingBottom: 100,
  },
  personaCard: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 2,
    borderColor: '#e5e5e5',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  selectedPersonaCard: {
    borderColor: '#0ea5e9',
    backgroundColor: '#f0f9ff',
  },
  personaHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  personaInfo: {
    flex: 1,
    marginLeft: 16,
  },
  personaName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#171717',
    marginBottom: 4,
  },
  selectedPersonaName: {
    color: '#0ea5e9',
  },
  personaDescription: {
    fontSize: 14,
    color: '#737373',
    lineHeight: 20,
  },
  selectedIndicator: {
    position: 'absolute',
    top: 12,
    right: 12,
  },
  continueButton: {
    backgroundColor: '#0ea5e9',
    paddingHorizontal: 24,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 16,
    marginBottom: 24,
  },
  continueButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default PersonasScreen; 