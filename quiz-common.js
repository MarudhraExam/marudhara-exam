/**
 * Quiz Section — shared helpers (Subject -> Topic -> Quiz feature)
 * ---------------------------------------------------------------------
 * Reuses the existing project Firebase app/db (firebase.js). Does NOT
 * create a new Firebase initialization.
 *
 * Firestore collections used (see firestore.rules):
 *   quizSubjects  { name, order, createdAt }
 *   quizTopics    { subjectId, name, order, published, createdAt }
 *   quizQuestions { subjectId, topicId, order, srNo,
 *                   qHi, qEn, aHi, aEn, bHi, bEn, cHi, cEn, dHi, dEn,
 *                   correct, explHi, explEn, createdAt }
 */

import { db } from "./firebase.js";
import {
  collection, query, where, orderBy, getDocs, getCountFromServer
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js";

export function getParam(name) {
  return new URLSearchParams(window.location.search).get(name) || "";
}

export function escapeHtml(str) {
  return String(str ?? "").replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  }[c]));
}

export async function fetchSubjects() {
  const snap = await getDocs(
    query(collection(db, "quizSubjects"), orderBy("order", "asc"))
  );
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function fetchTopicCountForSubject(subjectId) {
  const q = query(collection(db, "quizTopics"), where("subjectId", "==", subjectId));
  const snap = await getCountFromServer(q);
  return snap.data().count;
}

export async function fetchTopics(subjectId) {
  const snap = await getDocs(
    query(
      collection(db, "quizTopics"),
      where("subjectId", "==", subjectId),
      orderBy("order", "asc")
    )
  );
  return snap.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .filter((t) => t.published !== false);
}

export async function fetchQuestionCountForTopic(topicId) {
  const q = query(collection(db, "quizQuestions"), where("topicId", "==", topicId));
  const snap = await getCountFromServer(q);
  return snap.data().count;
}

export async function fetchQuestions(topicId) {
  const snap = await getDocs(
    query(
      collection(db, "quizQuestions"),
      where("topicId", "==", topicId),
      orderBy("order", "asc")
    )
  );
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export const OPTION_KEYS = ["A", "B", "C", "D"];

export function optionText(question, key, lang) {
  const map = {
    A: { hi: "aHi", en: "aEn" },
    B: { hi: "bHi", en: "bEn" },
    C: { hi: "cHi", en: "cEn" },
    D: { hi: "dHi", en: "dEn" }
  };
  return question[map[key][lang]] || "";
}
