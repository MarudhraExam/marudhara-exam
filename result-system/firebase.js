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
    apiKey: "AIzaSyDHe87UG-QGy2Kxh7RI8t51qOGgppVd_YA",
    authDomain: "marudhara-exam.firebaseapp.com",
    projectId: "marudhara-exam",
    storageBucket: "marudhara-exam.firebasestorage.app",
    messagingSenderId: "680152404373",
    appId: "1:680152404373:web:32f4dcb9e16c525d33669c",
    measurementId: "G-8PVKGVQ74F"
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
