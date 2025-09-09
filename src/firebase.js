import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyDZlOU8lMyhd7a-4qI9vKGB_Ib6kjopBCs",
  authDomain: "auth-flutter-814b8.firebaseapp.com",
  projectId: "auth-flutter-814b8",
  storageBucket: "auth-flutter-814b8.firebasestorage.app",
  messagingSenderId: "532372392693",
  appId: "1:532372392693:web:85bce9326de0a61bc053bc"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);