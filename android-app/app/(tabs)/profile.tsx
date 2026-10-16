import { useState } from 'react';
import { StyleSheet, View, Text, TextInput, TouchableOpacity, Image, ScrollView, ActivityIndicator, Alert, Platform, Modal } from 'react-native';
import { Settings, Trophy, Star, TrendingUp, Upload, LogOut } from 'lucide-react-native';
import { useAuth } from '@/lib/auth';
import { useMyTeam, useUpdateTeam } from '@/lib/api';
import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';

export default function ProfileScreen() {
  const { user, signOut } = useAuth();
  const { data: team, isLoading } = useMyTeam();
  const updateTeam = useUpdateTeam();

  const [showEditModal, setShowEditModal] = useState(false);
  const [editName, setEditName] = useState('');
  const [editNickname, setEditNickname] = useState('');
  const [selectedLogo, setSelectedLogo] = useState('');
  const [selectedProfile, setSelectedProfile] = useState('');

  const handleLogout = async () => {
    try {
      await signOut();
      // The navigation will be handled by the root layout's useEffect
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to log out');
    }
  };

  const pickImage = async (type: 'logo' | 'profile') => {
    try {
      // Request permissions
      if (Platform.OS !== 'web') {
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== 'granted') {
          Alert.alert('Permission needed', 'Please grant camera roll permissions to upload images.');
          return;
        }
      }

      // Launch image picker
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const imageUrl = result.assets[0].uri;
        if (type === 'logo') {
          setSelectedLogo(imageUrl);
        } else {
          setSelectedProfile(imageUrl);
        }
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to pick image. Please try again.');
    }
  };

  const handleSave = async () => {
    if (!team) return;

    try {
      await updateTeam.mutateAsync({
        teamId: team.id,
        updates: {
          name: editName || team.name,
          nickname: editNickname || team.nickname,
          logo_url: selectedLogo || team.logo_url,
          profile_picture_url: selectedProfile || team.profile_picture_url,
        },
      });

      setShowEditModal(false);
      Alert.alert('Success', 'Profile updated successfully!');
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to update profile');
    }
  };

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#4CAF50" />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Image
          source={{ uri: team?.profile_picture_url }}
          style={styles.profileImage}
        />
        <Text style={styles.name}>{team?.nickname || user?.email}</Text>
        <Text style={styles.title}>Manager of {team?.name}</Text>
        <View style={styles.buttonRow}>
          <TouchableOpacity style={styles.button} onPress={() => setShowEditModal(true)}>
            <Settings size={20} color="#666" />
            <Text style={styles.buttonText}>Edit Profile</Text>
          </TouchableOpacity>
        </View>
        <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
          <LogOut size={20} color="#fff" />
          <Text style={styles.logoutButtonText}>Logout</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.statsContainer}>
        <View style={styles.statBox}>
          <Trophy size={24} color="#4CAF50" />
          <Text style={styles.statNumber}>0</Text>
          <Text style={styles.statLabel}>Trophies</Text>
        </View>
        <View style={styles.statBox}>
          <Star size={24} color="#4CAF50" />
          <Text style={styles.statNumber}>{team?.rating || 0}</Text>
          <Text style={styles.statLabel}>Team Rating</Text>
        </View>
        <View style={styles.statBox}>
          <TrendingUp size={24} color="#4CAF50" />
          <Text style={styles.statNumber}>0%</Text>
          <Text style={styles.statLabel}>Win Rate</Text>
        </View>
      </View>

      {/* Edit Profile Modal */}
      <Modal
        visible={showEditModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowEditModal(false)}
      >
        <View style={styles.modalOverlay}>
          <ScrollView contentContainerStyle={styles.modalScrollContent}>
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>Edit Profile</Text>

              <Text style={styles.label}>Team Name</Text>
              <TextInput
                style={styles.input}
                value={editName}
                onChangeText={setEditName}
                placeholder={team?.name}
                placeholderTextColor="#666"
              />

              <Text style={styles.label}>Nickname</Text>
              <TextInput
                style={styles.input}
                value={editNickname}
                onChangeText={setEditNickname}
                placeholder={team?.nickname || 'Enter nickname'}
                placeholderTextColor="#666"
              />

              <Text style={styles.label}>Team Logo</Text>
              <View style={styles.imageUploadContainer}>
                <Image 
                  source={{ uri: selectedLogo || team?.logo_url }} 
                  style={styles.uploadPreview}
                />
                <TouchableOpacity 
                  style={styles.uploadButton}
                  onPress={() => pickImage('logo')}
                >
                  <Upload size={24} color="#4CAF50" />
                  <Text style={styles.uploadText}>Upload Logo</Text>
                </TouchableOpacity>
              </View>

              <Text style={styles.label}>Profile Picture</Text>
              <View style={styles.imageUploadContainer}>
                <Image 
                  source={{ uri: selectedProfile || team?.profile_picture_url }} 
                  style={styles.uploadPreview}
                />
                <TouchableOpacity 
                  style={styles.uploadButton}
                  onPress={() => pickImage('profile')}
                >
                  <Upload size={24} color="#4CAF50" />
                  <Text style={styles.uploadText}>Upload Picture</Text>
                </TouchableOpacity>
              </View>

              <View style={styles.modalButtons}>
                <TouchableOpacity
                  style={[styles.modalButton, styles.cancelButton]}
                  onPress={() => setShowEditModal(false)}
                >
                  <Text style={styles.modalButtonText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.modalButton, styles.saveButton]}
                  onPress={handleSave}
                >
                  <Text style={styles.modalButtonText}>Save</Text>
                </TouchableOpacity>
              </View>
            </View>
          </ScrollView>
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    backgroundColor: '#fff',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  profileImage: {
    width: 100,
    height: 100,
    borderRadius: 50,
    marginBottom: 15,
  },
  name: {
    fontFamily: 'Inter_700Bold',
    fontSize: 24,
    marginBottom: 5,
  },
  title: {
    fontFamily: 'Inter_400Regular',
    fontSize: 16,
    color: '#666',
    marginBottom: 15,
  },
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 10,
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
    padding: 10,
    borderRadius: 20,
  },
  buttonText: {
    fontFamily: 'Inter_600SemiBold',
    marginLeft: 5,
    color: '#666',
  },
  statsContainer: {
    flexDirection: 'row',
    padding: 15,
    backgroundColor: '#fff',
    marginTop: 15,
  },
  statBox: {
    flex: 1,
    alignItems: 'center',
    padding: 15,
  },
  statNumber: {
    fontFamily: 'Inter_700Bold',
    fontSize: 24,
    marginTop: 5,
  },
  statLabel: {
    fontFamily: 'Inter_400Regular',
    color: '#666',
    marginTop: 5,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  modalScrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
    width: '100%',
    maxWidth: 400,
    alignSelf: 'center',
  },
  modalTitle: {
    fontFamily: 'Inter_700Bold',
    fontSize: 24,
    marginBottom: 20,
  },
  label: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 16,
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
    padding: 12,
    marginBottom: 15,
    fontFamily: 'Inter_400Regular',
  },
  imageUploadContainer: {
    marginBottom: 15,
    alignItems: 'center',
  },
  uploadPreview: {
    width: 100,
    height: 100,
    borderRadius: 50,
    marginBottom: 10,
    backgroundColor: '#f5f5f5',
  },
  uploadButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
    padding: 10,
    borderRadius: 8,
  },
  uploadText: {
    marginLeft: 8,
    fontFamily: 'Inter_600SemiBold',
    color: '#4CAF50',
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 10,
    marginTop: 20,
  },
  modalButton: {
    flex: 1,
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
  },
  cancelButton: {
    backgroundColor: '#666',
  },
  saveButton: {
    backgroundColor: '#4CAF50',
  },
  modalButtonText: {
    color: '#fff',
    fontFamily: 'Inter_600SemiBold',
    fontSize: 16,
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f44336',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
    marginTop: 20,
  },
  logoutButtonText: {
    color: '#fff',
    fontFamily: 'Inter_600SemiBold',
    fontSize: 16,
    marginLeft: 8,
  },
});