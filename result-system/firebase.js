import { initializeApp } from "https://www.gstatic.com/firebasejs/9.6.10/firebase-app.js";

import { initializeApp } from "https://www.gstatic.com/firebasejs/9.6.10/firebase-app.js";

import {
  getFirestore,
  collection,
  addDoc,
  getDocs,
  getDoc,
  updateDoc,
  deleteDoc,
  doc,
  query,
  where,
  orderBy,
  limit,
  startAt,
  endAt,
  writeBatch,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/9.6.10/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyDHe87UG-QGyZKxh7RI8t51q0GgppVd_YA",
  authDomain: "marudhara-exam.firebaseapp.com",
  projectId: "marudhara-exam",
  storageBucket: "marudhara-exam.appspot.com",
  messagingSenderId: "680152404373",
  appId: "1:680152404373:web:23515d1d06c44dbd33669c"
};

const app = initializeApp(firebaseConfig);

const db = getFirestore(app);

export {
  db,
  collection,
  addDoc,
  getDocs,
  getDoc,
  updateDoc,
  deleteDoc,
  doc,
  query,
  where,
  orderBy,
  limit,
  startAt,
  endAt,
  writeBatch,
  serverTimestamp
};