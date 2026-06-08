import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import firebaseConfig from "../firebase-applet-config.json";

// Initialize Firebase App
const app = initializeApp(firebaseConfig);

// Initialize Firestore with specific database ID requested
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);

// Initialize Google Authentication provider
export const auth = getAuth();
