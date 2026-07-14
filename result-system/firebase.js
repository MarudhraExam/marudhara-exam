/**
 * Marudhara Exam - Firebase Modular Configuration Interface
 * This file configures and initializes the official production database.
 * No mock/placeholder credentials are used.
 */

import { initializeApp } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-app.js";
import {
    getFirestore,
    collection,
    doc,
    addDoc,
    getDoc,
    getDocs,
    setDoc,
    updateDoc,
    deleteDoc,
    query,
    where,
    orderBy,
    limit,
    startAfter,
    writeBatch,
    serverTimestamp,
    increment
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js";
// Production Firebase Configuration Credentials
const firebaseConfig = {
    apiKey: "AIzaSyDHe87UG-QGyZKxh7RI8t51q0GgppVd_YA",
    authDomain: "marudhara-exam.firebaseapp.com",
    projectId: "marudhara-exam",
    storageBucket: "marudhara-exam.firebasestorage.app",
    messagingSenderId: "680152404373",
    appId: "1:680152404373:web:23515d1d06c44dbd33669c"
};

// Initialize Core Application Instance
const app = initializeApp(firebaseConfig);

// Initialize Firestore Database Services
const db = getFirestore(app);

// Export instances and modular query handlers to structural scripts
window.db = db;
export {
    app,
    db,
    collection,
    doc,
    addDoc,
    getDoc,
    getDocs,
    setDoc,
    updateDoc,
    deleteDoc,
    query,
    where,
    orderBy,
    limit,
    startAfter,
    writeBatch,
    serverTimestamp,
    increment
};
