import { create } from 'zustand';
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut as fbSignOut,
  sendPasswordResetEmail,
  onAuthStateChanged,
  type User,
} from 'firebase/auth';
import { ref, get, set, update, push, onValue, type Unsubscribe } from 'firebase/database';
import { auth, database } from './firebase';
import type { Manager } from './manager';

interface AuthState {
  user: User | null;
  manager: Manager | null;
  loading: boolean;
  initialized: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, managerName: string) => Promise<string>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  initialize: () => Promise<void>;
  updateManager: (updates: Partial<Manager>) => Promise<void>;
  recordMatch: (opponent: string, homeScore: number, awayScore: number) => Promise<void>;
}

const newManager = (user: User, managerName: string): Manager => ({
  uid: user.uid,
  email: user.email || '',
  managerName,
  budget: 900000000,
  squad: [],
  wins: 0,
  draws: 0,
  losses: 0,
  points: 0,
});

const friendlyError = (e: any): Error => {
  const code = e?.code as string | undefined;
  const map: Record<string, string> = {
    'auth/invalid-credential': 'Wrong email or password',
    'auth/invalid-email': 'Invalid email address',
    'auth/user-not-found': 'No account found for this email',
    'auth/wrong-password': 'Wrong email or password',
    'auth/email-already-in-use': 'This email is already registered',
    'auth/weak-password': 'Password must be at least 6 characters',
    'auth/network-request-failed': 'Network error, check your connection',
    'auth/too-many-requests': 'Too many attempts, try again later',
  };
  return new Error((code && map[code]) || e?.message || 'Something went wrong');
};

let started = false;
let profileUnsub: Unsubscribe | null = null;

export const useAuth = create<AuthState>((set_, get_) => ({
  user: null,
  manager: null,
  loading: false,
  initialized: false,

  initialize: async () => {
    if (started) return;
    started = true;
    onAuthStateChanged(auth, async (user) => {
      profileUnsub?.();
      profileUnsub = null;
      if (!user) {
        set_({ user: null, manager: null, initialized: true });
        return;
      }
      try {
        const managerRef = ref(database, `managers/${user.uid}`);
        const snap = await get(managerRef);
        if (!snap.exists()) {
          await set(managerRef, { ...newManager(user, (user.email || 'manager').split('@')[0]), createdAt: Date.now() });
        }
        profileUnsub = onValue(managerRef, (s) => {
          if (s.exists()) set_({ manager: s.val() as Manager });
        });
      } catch (e) {
        console.error('Failed to load manager profile', e);
      }
      set_({ user, initialized: true });
    });
    // Never hang on the splash screen if Firebase is unreachable
    setTimeout(() => {
      if (!get_().initialized) set_({ initialized: true });
    }, 8000);
  },

  signIn: async (email, password) => {
    set_({ loading: true });
    try {
      await signInWithEmailAndPassword(auth, email.trim(), password);
    } catch (e) {
      throw friendlyError(e);
    } finally {
      set_({ loading: false });
    }
  },

  signUp: async (email, password, managerName) => {
    set_({ loading: true });
    try {
      const cred = await createUserWithEmailAndPassword(auth, email.trim(), password);
      await set(ref(database, `managers/${cred.user.uid}`), {
        ...newManager(cred.user, managerName.trim()),
        createdAt: Date.now(),
      });
      return 'Account created! You start with $900M to build your squad.';
    } catch (e) {
      throw friendlyError(e);
    } finally {
      set_({ loading: false });
    }
  },

  signOut: async () => {
    await fbSignOut(auth);
  },

  resetPassword: async (email) => {
    try {
      await sendPasswordResetEmail(auth, email.trim());
    } catch (e) {
      throw friendlyError(e);
    }
  },

  updateManager: async (updates) => {
    const user = get_().user;
    if (!user) return;
    await update(ref(database, `managers/${user.uid}`), updates);
  },

  // Practice match result: same record fields the web app uses
  recordMatch: async (opponent, homeScore, awayScore) => {
    const { user, manager } = get_();
    if (!user || !manager) return;
    const won = homeScore > awayScore;
    const draw = homeScore === awayScore;
    await push(ref(database, `managers/${user.uid}/matchHistory`), {
      opponent,
      homeScore,
      awayScore,
      playedAt: Date.now(),
    });
    await update(ref(database, `managers/${user.uid}`), {
      wins: (manager.wins || 0) + (won ? 1 : 0),
      draws: (manager.draws || 0) + (draw ? 1 : 0),
      losses: (manager.losses || 0) + (!won && !draw ? 1 : 0),
      points: (manager.points || 0) + (won ? 3 : draw ? 1 : 0),
    });
  },
}));
