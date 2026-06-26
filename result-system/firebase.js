import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { 
    getFirestore, 
    collection, 
    addDoc, 
    setDoc,
    getDocs, 
    getDoc,
    doc, 
    query, 
    where, 
    deleteDoc, 
    writeBatch,
    orderBy,
    limit,
    startAt,
    endAt
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// REPLACE WITH YOUR FIREBASE PROJECT CONFIGURATION
const firebaseConfig = {
    apiKey: "YOUR_API_KEY",
    authDomain: "YOUR_AUTH_DOMAIN",
    projectId: "YOUR_PROJECT_ID",
    storageBucket: "YOUR_STORAGE_BUCKET",
    messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
    appId: "YOUR_APP_ID"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

export {
    db,
    collection,
    addDoc,
    setDoc,
    getDocs,
    getDoc,
    doc,
    query,
    where,
    deleteDoc,
    writeBatch,
    orderBy,
    limit,
    startAt,
    endAt
};
