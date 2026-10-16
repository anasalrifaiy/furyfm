import { useEffect, useState } from 'react';
import { Slot, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useFrameworkReady } from '@/hooks/useFrameworkReady';
import { useFonts, Inter_400Regular, Inter_600SemiBold, Inter_700Bold } from '@expo-google-fonts/inter';
import { useAuth } from '@/lib/auth';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { supabase } from '@/lib/supabase';
import * as SplashScreen from 'expo-splash-screen';

// Prevent the splash screen from auto-hiding
SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient();

export default function RootLayout() {
  useFrameworkReady();
  const { initialize, initialized, user, loading } = useAuth();
  const segments = useSegments();
  const router = useRouter();
  const [navigationReady, setNavigationReady] = useState(false);

  const [fontsLoaded] = useFonts({
    Inter_400Regular,
    Inter_600SemiBold,
    Inter_700Bold,
  });

  // Initialize auth first
  useEffect(() => {
    initialize();
  }, [initialize]);

  // Handle navigation after everything is ready
  useEffect(() => {
    if (!fontsLoaded || !initialized) return;

    const inAuthGroup = segments[0] === '(auth)';
    const inTabsGroup = segments[0] === '(tabs)';

    // Set navigation ready first
    setNavigationReady(true);

    // Then check auth and navigate
    const checkAuthAndNavigate = async () => {
      try {
        // If not authenticated, redirect to login
        if (!user) {
          if (!inAuthGroup) {
            await router.replace('/login');
          }
          return;
        }

        // Check if user has a team
        const { data: team } = await supabase
          .from('teams')
          .select()
          .eq('user_id', user.id)
          .single();

        if (team) {
          // If user has a team and is not in tabs, go to squad
          if (!inTabsGroup) {
            await router.replace('/(tabs)/squad');
          }
        } else {
          // If user doesn't have a team and is not on create-team, go there
          if (!inAuthGroup || segments[1] !== 'create-team') {
            await router.replace('/(auth)/create-team');
          }
        }
      } catch (error) {
        console.error('Error during navigation:', error);
      }
    };

    // Only run navigation check after a short delay to ensure Slot is mounted
    const timer = setTimeout(() => {
      checkAuthAndNavigate();
    }, 50);

    return () => clearTimeout(timer);
  }, [fontsLoaded, initialized, user, segments, router]);

  // Hide splash screen once everything is ready
  useEffect(() => {
    if (fontsLoaded && initialized && navigationReady) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded, initialized, navigationReady]);

  // Show loading screen while initializing
  if (!fontsLoaded || !initialized || loading || !navigationReady) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color="#4CAF50" />
      </View>
    );
  }

  return (
    <QueryClientProvider client={queryClient}>
      <Slot />
      <StatusBar style="auto" />
    </QueryClientProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
  },
});
