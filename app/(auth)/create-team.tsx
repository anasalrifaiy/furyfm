import { useState } from 'react';
import { StyleSheet, View, Text, TextInput, TouchableOpacity, Image, ActivityIndicator, ScrollView } from 'react-native';
import { router } from 'expo-router';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/lib/supabase';

const FORMATIONS = [
  { id: '4-4-2', name: '4-4-2', description: 'Classic balanced formation' },
  { id: '4-3-3', name: '4-3-3', description: 'Attacking formation' },
  { id: '3-5-2', name: '3-5-2', description: 'Midfield control' },
  { id: '4-2-3-1', name: '4-2-3-1', description: 'Modern balanced formation' },
];

const TEAM_LOGOS = [
  'https://images.unsplash.com/photo-1589487391730-58f20eb2c308?w=200',
  'https://images.unsplash.com/photo-1517466787929-bc90951d0974?w=200',
  'https://images.unsplash.com/photo-1434648957308-5e6a859697e8?w=200',
  'https://images.unsplash.com/photo-1431324155629-1a6deb1dec8d?w=200',
];

const PROFILE_PICTURES = [
  'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=200',
  'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=200',
  'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=200',
  'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=200',
];

export default function CreateTeamScreen() {
  const { user } = useAuth();
  const [teamName, setTeamName] = useState('');
  const [selectedFormation, setSelectedFormation] = useState(FORMATIONS[0].id);
  const [selectedLogo, setSelectedLogo] = useState(TEAM_LOGOS[0]);
  const [selectedProfile, setSelectedProfile] = useState(PROFILE_PICTURES[0]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const createTeam = async () => {
    if (!teamName.trim()) {
      setError('Team name is required');
      return;
    }

    setLoading(true);
    try {
      const { data: existingTeam, error: checkError } = await supabase
        .from('teams')
        .select()
        .eq('user_id', user?.id)
        .single();

      if (checkError && checkError.code !== 'PGRST116') {
        throw checkError;
      }

      if (existingTeam) {
        router.replace('/(tabs)/squad');
        return;
      }

      const { data: newTeam, error: createError } = await supabase
        .from('teams')
        .insert([
          {
            name: teamName,
            user_id: user?.id,
            rating: 70,
            budget: 100000000,
            formation: selectedFormation,
            logo_url: selectedLogo,
            profile_picture_url: selectedProfile,
          },
        ])
        .select()
        .single();

      if (createError) throw createError;
      if (!newTeam) throw new Error('Failed to create team');

      router.replace('/(tabs)/squad');
    } catch (err) {
      console.error('Error creating team:', err);
      setError('Failed to create team. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.title}>Create Your Team</Text>

        {error && (
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        <View style={styles.inputContainer}>
          <Text style={styles.label}>Team Name</Text>
          <TextInput
            style={styles.input}
            value={teamName}
            onChangeText={setTeamName}
            placeholder="Enter team name"
            placeholderTextColor="#666"
          />
        </View>

        <View style={styles.section}>
          <Text style={styles.label}>Choose Team Logo</Text>
          <View style={styles.imageGrid}>
            {TEAM_LOGOS.map((logo) => (
              <TouchableOpacity
                key={logo}
                style={[
                  styles.imageOption,
                  selectedLogo === logo && styles.selectedImage,
                ]}
                onPress={() => setSelectedLogo(logo)}
              >
                <Image source={{ uri: logo }} style={styles.logoImage} />
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.label}>Choose Profile Picture</Text>
          <View style={styles.imageGrid}>
            {PROFILE_PICTURES.map((pic) => (
              <TouchableOpacity
                key={pic}
                style={[
                  styles.imageOption,
                  selectedProfile === pic && styles.selectedImage,
                ]}
                onPress={() => setSelectedProfile(pic)}
              >
                <Image source={{ uri: pic }} style={styles.profileImage} />
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.label}>Choose Formation</Text>
          <View style={styles.formationGrid}>
            {FORMATIONS.map((formation) => (
              <TouchableOpacity
                key={formation.id}
                style={[
                  styles.formationOption,
                  selectedFormation === formation.id && styles.selectedFormation,
                ]}
                onPress={() => setSelectedFormation(formation.id)}
              >
                <Text style={styles.formationName}>{formation.name}</Text>
                <Text style={styles.formationDesc}>{formation.description}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <TouchableOpacity
          style={[styles.button, loading && styles.buttonDisabled]}
          onPress={createTeam}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.buttonText}>Create Team</Text>
          )}
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  content: {
    padding: 20,
  },
  title: {
    fontFamily: 'Inter_700Bold',
    fontSize: 24,
    marginBottom: 20,
    textAlign: 'center',
  },
  errorContainer: {
    backgroundColor: 'rgba(255, 0, 0, 0.1)',
    padding: 10,
    borderRadius: 8,
    marginBottom: 15,
  },
  errorText: {
    color: '#ff0000',
    textAlign: 'center',
    fontFamily: 'Inter_400Regular',
  },
  inputContainer: {
    marginBottom: 20,
  },
  label: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 16,
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 12,
    fontFamily: 'Inter_400Regular',
    fontSize: 16,
  },
  section: {
    marginBottom: 20,
  },
  imageGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginTop: 10,
  },
  imageOption: {
    width: '48%',
    marginBottom: 10,
    padding: 5,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  selectedImage: {
    borderColor: '#4CAF50',
  },
  logoImage: {
    width: '100%',
    aspectRatio: 1,
    borderRadius: 8,
  },
  profileImage: {
    width: '100%',
    aspectRatio: 1,
    borderRadius: 8,
  },
  formationGrid: {
    marginTop: 10,
  },
  formationOption: {
    backgroundColor: '#fff',
    padding: 15,
    borderRadius: 8,
    marginBottom: 10,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  selectedFormation: {
    borderColor: '#4CAF50',
  },
  formationName: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 16,
  },
  formationDesc: {
    fontFamily: 'Inter_400Regular',
    color: '#666',
    marginTop: 4,
  },
  button: {
    backgroundColor: '#4CAF50',
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 20,
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontFamily: 'Inter_600SemiBold',
  },
});