import { Redirect, Tabs } from 'expo-router';
import { Trophy, Users, Gamepad2, ShoppingBag, User, UserPlus, UsersRound, GitPullRequest } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';
import { useAuth } from '@/lib/auth';
import TopMenu from '@/components/TopMenu';

export default function TabLayout() {
  const { user } = useAuth();

  // If no user is signed in, redirect to the login screen
  if (!user) {
    return <Redirect href="/login" />;
  }

  return (
    <View style={styles.container}>
      <TopMenu />
      <Tabs
        screenOptions={{
          tabBarStyle: styles.tabBar,
          tabBarActiveTintColor: '#4CAF50',
          tabBarInactiveTintColor: '#666',
          headerStyle: styles.header,
          headerTitleStyle: styles.headerTitle,
          headerShown: true,
        }}>
        <Tabs.Screen
          name="squad"
          options={{
            title: 'Formation',
            tabBarIcon: ({ color, size }) => <Users size={size} color={color} />,
          }}
        />
        <Tabs.Screen
          name="players"
          options={{
            title: 'Squad',
            tabBarIcon: ({ color, size }) => <UserPlus size={size} color={color} />,
          }}
        />
        <Tabs.Screen
          name="transfer"
          options={{
            title: 'Transfer',
            tabBarIcon: ({ color, size }) => <ShoppingBag size={size} color={color} />,
          }}
        />
        <Tabs.Screen
          name="trade-offers"
          options={{
            title: 'Trades',
            tabBarIcon: ({ color, size }) => <GitPullRequest size={size} color={color} />,
          }}
        />
        <Tabs.Screen
          name="match"
          options={{
            title: 'Match',
            tabBarIcon: ({ color, size }) => <Gamepad2 size={size} color={color} />,
          }}
        />
        <Tabs.Screen
          name="friends"
          options={{
            title: 'Friends',
            tabBarIcon: ({ color, size }) => <UsersRound size={size} color={color} />,
          }}
        />
        <Tabs.Screen
          name="index"
          options={{
            title: 'League',
            tabBarIcon: ({ color, size }) => <Trophy size={size} color={color} />,
          }}
        />
        <Tabs.Screen
          name="profile"
          options={{
            title: 'Profile',
            tabBarIcon: ({ color, size }) => <User size={size} color={color} />,
          }}
        />
      </Tabs>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  tabBar: {
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#eee',
  },
  header: {
    backgroundColor: '#fff',
    elevation: 0,
    shadowOpacity: 0,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  headerTitle: {
    fontFamily: 'Inter_600SemiBold',
    color: '#000',
  },
});
