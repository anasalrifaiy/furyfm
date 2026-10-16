import { initializeApp, getApps, getApp } from 'firebase/app';
import { initializeAuth, getAuth } from 'firebase/auth';
// @ts-expect-error exported by Firebase's React Native bundle but missing from its typings
import { getReactNativePersistence } from 'firebase/auth';
import { getDatabase } from 'firebase/database';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Public client configuration (same Firebase project as the FuryFM web app)
const firebaseConfig = {
  apiKey: 'AIzaSyAefdSczobIyVbMXCaTnfYcKSrbb50x1tY',
  authDomain: 'fury-fm.firebaseapp.com',
  databaseURL: 'https://fury-fm-default-rtdb.europe-west1.firebasedatabase.app',
  projectId: 'fury-fm',
  storageBucket: 'fury-fm.firebasestorage.app',
  messagingSenderId: '140944928919',
  appId: '1:140944928919:web:4409ddc0f411f6aa9b39d2',
};

const isNew = getApps().length === 0;
export const app = isNew ? initializeApp(firebaseConfig) : getApp();

export const auth = isNew
  ? initializeAuth(app, { persistence: getReactNativePersistence(AsyncStorage) })
  : getAuth(app);

export const database = getDatabase(app);
