import { create } from 'zustand';
import { supabase } from './supabase';
import type { User } from '@supabase/supabase-js';
import { Platform } from 'react-native';

interface AuthState {
  user: User | null;
  loading: boolean;
  initialized: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string) => Promise<string>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  initialize: () => Promise<void>;
}

// Keep track of the last signup attempt
let lastSignUpAttempt = 0;
const SIGNUP_COOLDOWN = 30000; // 30 seconds cooldown

// Get the site URL based on the platform and environment
const getSiteUrl = () => {
  if (Platform.OS === 'web') {
    // Use window.location.origin for all web environments
    return window.location.origin;
  }
  return 'https://anaszrock.com';
};

function getAuthErrorMessage(error: any): string {
  // Check for existing user error
  if (error?.message?.includes('User already registered')) {
    return 'An account with this email already exists. Please sign in instead.';
  }
  if (error?.message?.includes('Email not confirmed')) {
    return 'Please check your email (including spam folder) and click the confirmation link to verify your account.';
  }
  if (error?.message?.includes('Invalid login credentials')) {
    return 'Invalid email or password. Please try again.';
  }
  if (error?.message?.includes('security purposes')) {
    return 'Please wait a moment before trying again.';
  }
  // Add specific handling for network errors
  if (error?.message?.includes('Failed to fetch')) {
    return 'Unable to connect to the server. Please check your internet connection and try again.';
  }
  return error?.message || 'An error occurred. Please try again.';
}

export const useAuth = create<AuthState>((set) => ({
  user: null,
  loading: true,
  initialized: false,

  initialize: async () => {
    try {
      set({ loading: true, initialized: false });
      
      // Get initial session
      const { data: { session } } = await supabase.auth.getSession();
      
      // Set up auth state change listener
      supabase.auth.onAuthStateChange((_event, session) => {
        set({ user: session?.user ?? null });
      });

      // Set initial state
      set({ 
        user: session?.user ?? null, 
        initialized: true, 
        loading: false 
      });
    } catch (error) {
      console.error('Error initializing auth:', error);
      set({ initialized: true, loading: false });
    }
  },

  signIn: async (email: string, password: string) => {
    set({ loading: true });
    try {
      const { error, data: { user } } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (error) throw error;
      set({ user });
    } catch (error) {
      console.error('Error signing in:', error);
      throw new Error(getAuthErrorMessage(error));
    } finally {
      set({ loading: false });
    }
  },

  signUp: async (email: string, password: string) => {
    set({ loading: true });
    try {
      const now = Date.now();
      if (now - lastSignUpAttempt < SIGNUP_COOLDOWN) {
        const remainingTime = Math.ceil((SIGNUP_COOLDOWN - (now - lastSignUpAttempt)) / 1000);
        throw new Error(`Please wait ${remainingTime} seconds before trying again`);
      }

      lastSignUpAttempt = now;

      const { error: checkError } = await supabase.auth.signInWithPassword({
        email,
        password: 'check-user-exists',
      });

      if (!checkError?.message?.includes('Invalid login credentials')) {
        throw new Error('An account with this email already exists. Please sign in instead.');
      }

      const { error: signUpError, data } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${getSiteUrl()}/login`,
        }
      });
      
      if (signUpError) throw signUpError;
      if (!data.user) throw new Error('No user returned after signup');

      return 'Please check your email (including spam folder) for a confirmation link. You will be able to sign in after confirming your email.';
    } catch (error) {
      console.error('Error signing up:', error);
      throw new Error(getAuthErrorMessage(error));
    } finally {
      set({ loading: false });
    }
  },

  signOut: async () => {
    try {
      set({ loading: true });
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      set({ user: null });
    } catch (error) {
      console.error('Error signing out:', error);
      throw new Error(getAuthErrorMessage(error));
    } finally {
      set({ loading: false });
    }
  },

  resetPassword: async (email: string) => {
    try {
      set({ loading: true });
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${getSiteUrl()}/login`,
      });
      if (error) throw error;
    } catch (error) {
      console.error('Error resetting password:', error);
      throw new Error(getAuthErrorMessage(error));
    } finally {
      set({ loading: false });
    }
  },
}));