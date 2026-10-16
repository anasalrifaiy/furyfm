import { createClient } from '@supabase/supabase-js';
import 'react-native-url-polyfill/auto';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables');
}

// Get the site URL based on the platform and environment
const getSiteUrl = () => {
  if (Platform.OS === 'web') {
    // Use window.location.origin for all web environments to ensure correct origin
    return window.location.origin;
  }
  // For mobile, use the production URL
  return 'https://anaszrock.com';
};

// Create custom storage implementation using AsyncStorage
const ExpoSecureStorage = {
  getItem: async (key: string) => {
    try {
      return await AsyncStorage.getItem(key);
    } catch (error) {
      console.error('Error reading from AsyncStorage:', error);
      return null;
    }
  },
  setItem: async (key: string, value: string) => {
    try {
      await AsyncStorage.setItem(key, value);
    } catch (error) {
      console.error('Error writing to AsyncStorage:', error);
    }
  },
  removeItem: async (key: string) => {
    try {
      await AsyncStorage.removeItem(key);
    } catch (error) {
      console.error('Error removing from AsyncStorage:', error);
    }
  },
};

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    flowType: 'pkce',
    detectSessionInUrl: Platform.OS === 'web',
    autoRefreshToken: true,
    persistSession: true,
    storage: Platform.OS === 'web' ? {
      getItem: (key) => {
        try {
          return Promise.resolve(localStorage.getItem(key));
        } catch {
          return Promise.resolve(null);
        }
      },
      setItem: (key, value) => {
        try {
          localStorage.setItem(key, value);
          return Promise.resolve();
        } catch {
          return Promise.resolve();
        }
      },
      removeItem: (key) => {
        try {
          localStorage.removeItem(key);
          return Promise.resolve();
        } catch {
          return Promise.resolve();
        }
      },
    } : ExpoSecureStorage,
  },
});