import { Redirect, Tabs } from 'expo-router';
import { Home, Users, Gamepad2, User } from 'lucide-react-native';
import { useAuth } from '@/lib/auth';

export default function TabLayout() {
  const { user } = useAuth();
  if (!user) return <Redirect href="/login" />;

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: '#4CAF50',
        tabBarInactiveTintColor: '#666',
        tabBarStyle: { backgroundColor: '#fff', borderTopColor: '#eee' },
        headerStyle: { backgroundColor: '#fff' },
        headerTitleStyle: { fontFamily: 'Inter_600SemiBold' },
      }}>
      <Tabs.Screen
        name="index"
        options={{ title: 'Home', tabBarIcon: ({ color, size }) => <Home size={size} color={color} /> }}
      />
      <Tabs.Screen
        name="squad"
        options={{ title: 'Squad', tabBarIcon: ({ color, size }) => <Users size={size} color={color} /> }}
      />
      <Tabs.Screen
        name="match"
        options={{ title: 'Match', tabBarIcon: ({ color, size }) => <Gamepad2 size={size} color={color} /> }}
      />
      <Tabs.Screen
        name="profile"
        options={{ title: 'Profile', tabBarIcon: ({ color, size }) => <User size={size} color={color} /> }}
      />
    </Tabs>
  );
}
