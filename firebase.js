import { initializeApp } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-app.js";

import {
getFirestore
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js";

const firebaseConfig = {
apiKey: "AIzaSyDHe87UG-QGyZKxh7RI8t51q0GgppVd_YA",
authDomain: "marudhara-exam.firebaseapp.com",
projectId: "marudhara-exam",
storageBucket: "marudhara-exam.firebasestorage.app",
messagingSenderId: "680152404373",
appId: "1:680152404373:web:23515d1d06c44dbd33669c"
};

const app = initializeApp(firebaseConfig);

export { app };
export const db = getFirestore(app);
