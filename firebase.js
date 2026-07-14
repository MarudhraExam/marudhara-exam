import { initializeApp } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-app.js";

import {
getFirestore
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js";

const firebaseConfig = {
apiKey: "AIzaSyDHe87UG-QGy2Kxh7RI8t51qOGgppVd_YA",
authDomain: "marudhara-exam.firebaseapp.com",
projectId: "marudhara-exam",
storageBucket: "marudhara-exam.firebasestorage.app",
messagingSenderId: "680152404373",
appId: "1:680152404373:web:32f4dcb9e16c525d33669c",
measurementId: "G-8PVKGVQ74F"
};

const app = initializeApp(firebaseConfig);

export { app };
export const db = getFirestore(app);
