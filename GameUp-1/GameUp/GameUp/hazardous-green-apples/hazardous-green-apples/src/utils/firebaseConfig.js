// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { initializeAuth, getReactNativePersistence, getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Your web app's Firebase configuration
// Contains API keys and project information for Firebase services
const firebaseConfig = {
  apiKey: "AIzaSyAD9VAc6rmJgE3E5fxNWzrto3DhIkK5WXA",
  authDomain: "iat359firebasetest-609b1.firebaseapp.com",
  projectId: "iat359firebasetest-609b1",
  storageBucket: "iat359firebasetest-609b1.firebasestorage.app",
  messagingSenderId: "142662425951",
  appId: "1:142662425951:web:7a8184cf486ae34d74aaea"
};

// Initialize Firebase app with configuration
export const firebase_app = initializeApp(firebaseConfig);

// Initialize Auth with AsyncStorage persistence for React Native
// This allows user authentication to persist across app restarts
// Use getAuth as fallback if auth is already initialized (prevents errors on hot reload)
let firebase_auth;
try {
  // Initialize auth with AsyncStorage persistence (saves auth state to device storage)
  firebase_auth = initializeAuth(firebase_app, {
    persistence: getReactNativePersistence(AsyncStorage)
  });
} catch (error) {
  // If auth is already initialized (e.g., during development hot reload), use getAuth instead
  if (error.code === 'auth/already-initialized') {
    firebase_auth = getAuth(firebase_app);
  } else {
    throw error;
  }
}

// Export auth instance for use throughout the app
export { firebase_auth };
// Export Firestore database instance for storing user data
export const db = getFirestore(firebase_app);