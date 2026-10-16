import { StyleSheet, View, Text, TouchableOpacity } from 'react-native';
import { useAuth } from '@/lib/auth';

export default function ProfileScreen() {
  const { manager, user, signOut } = useAuth();

  return (
    <View style={styles.container}>
      <Text style={styles.name}>{manager?.managerName || 'Manager'}</Text>
      <Text style={styles.email}>{user?.email}</Text>
      <TouchableOpacity style={styles.button} onPress={() => signOut()}>
        <Text style={styles.buttonText}>Sign out</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5', padding: 24, alignItems: 'center', justifyContent: 'center' },
  name: { fontFamily: 'Inter_700Bold', fontSize: 24 },
  email: { fontFamily: 'Inter_400Regular', color: '#666', marginTop: 4, marginBottom: 28 },
  button: { backgroundColor: '#d32f2f', paddingVertical: 14, paddingHorizontal: 40, borderRadius: 10 },
  buttonText: { color: '#fff', fontFamily: 'Inter_600SemiBold', fontSize: 16 },
});
