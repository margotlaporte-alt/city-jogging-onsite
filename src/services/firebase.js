import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyDVhVv7tkuSl-OEiKeI9ij539wCTX8bKhQ",
  authDomain: "city-jogging.firebaseapp.com",
  projectId: "city-jogging",
  storageBucket: "city-jogging.firebasestorage.app",
  messagingSenderId: "646817047471",
  appId: "1:646817047471:web:44755f424724ad4e2a855a"
};

const app = initializeApp(firebaseConfig);

export const db = getFirestore(app);
export const auth = getAuth(app);
