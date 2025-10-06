import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
import { getAuth } from "firebase/auth";
import { getDatabase } from "firebase/database";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyAefdSczobIyVbMXCaTnfYcKSrbb50x1tY",
  authDomain: "fury-fm.firebaseapp.com",
  databaseURL: "https://fury-fm-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: "fury-fm",
  storageBucket: "fury-fm.firebasestorage.app",
  messagingSenderId: "140944928919",
  appId: "1:140944928919:web:4409ddc0f411f6aa9b39d2",
  measurementId: "G-3MHL5JJTVF"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = typeof window !== 'undefined' ? getAnalytics(app) : null;
const auth = getAuth(app);
const database = getDatabase(app);
const firestore = getFirestore(app);

export { app, analytics, auth, database, firestore };
