// firebaseClient.ts
import { initializeApp, getApps, getApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyBNnVNTbe8c8wWNRT5GapP_KZ5cA_aLAn8",
  authDomain: "ops-task-portal.firebaseapp.com",
  projectId: "ops-task-portal",
  storageBucket: "ops-task-portal.appspot.com",
  messagingSenderId: "457640717486",
  appId: "1:457640717486:web:f69ffe9e4193e84da6913f"
};

const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
export const db = getFirestore(app);
