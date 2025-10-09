import React, { createContext, useState, useContext, useEffect } from 'react';
import { auth, database } from '../firebase';
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged
} from 'firebase/auth';
import { ref, set, get, update } from 'firebase/database';

const AuthContext = createContext();

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [currentUser, setCurrentUser] = useState(null);
  const [managerProfile, setManagerProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  const signup = async (email, password, managerName) => {
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;

    // Create manager profile in database
    const managerData = {
      uid: user.uid,
      email: user.email,
      managerName: managerName,
      budget: 900000000, // $900M starting budget
      squad: [],
      friends: [],
      notifications: [],
      createdAt: Date.now(),
      wins: 0,
      draws: 0,
      losses: 0,
      points: 0
    };

    await set(ref(database, `managers/${user.uid}`), managerData);
    return user;
  };

  const login = async (email, password) => {
    return signInWithEmailAndPassword(auth, email, password);
  };

  const logout = () => {
    return signOut(auth);
  };

  const updateManagerProfile = async (updates) => {
    if (!currentUser) return;
    await update(ref(database, `managers/${currentUser.uid}`), updates);
    setManagerProfile(prev => ({ ...prev, ...updates }));
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      console.log('Auth state changed:', user?.uid);
      setCurrentUser(user);

      if (user) {
        try {
          // Fetch manager profile
          const managerRef = ref(database, `managers/${user.uid}`);
          const snapshot = await get(managerRef);
          console.log('Profile snapshot exists:', snapshot.exists());

          if (snapshot.exists()) {
            const profileData = snapshot.val();
            console.log('Loaded profile:', profileData);
            setManagerProfile(profileData);
          } else {
            console.error('No manager profile found for user:', user.uid);
            // Create profile if it doesn't exist
            const managerData = {
              uid: user.uid,
              email: user.email,
              managerName: user.email.split('@')[0],
              budget: 900000000,
              squad: [],
              friends: [],
              notifications: [],
              createdAt: Date.now(),
              wins: 0,
              draws: 0,
              losses: 0,
              points: 0
            };
            await set(ref(database, `managers/${user.uid}`), managerData);
            setManagerProfile(managerData);
          }
        } catch (error) {
          console.error('Error loading profile:', error);
        }
      } else {
        setManagerProfile(null);
      }

      setLoading(false);
    });

    return unsubscribe;
  }, []);

  const value = {
    currentUser,
    managerProfile,
    signup,
    login,
    logout,
    updateManagerProfile,
    loading
  };

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
};
