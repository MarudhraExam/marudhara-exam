// ===========================================================================
// preparation-progress.js
// ONE place that turns real student activity into My Preparation progress.
//
// Identity rule: the authenticated Firebase Auth UID is the master student id.
//   - All per-student My Preparation data lives under studentPreparations/{uid}/...
//   - Existing Mock Test results (mockResults) never stored a UID (only the
//     mobile number), so they are bridged:
//       * NEW results carry `studentUid` (added in mock-tests/exam.html)
//       * OLD results are matched through the mobile stored on users/{uid}
//         (the verified profile of THIS uid - never localStorage).
//
// Firestore functions are injected (`fs`) so the exact same logic runs in the
// browser (real SDK) and in the Node test harness (in-memory fake).
// ===========================================================================

import { computeOverallProgress, computeSyllabusPercent } from './preparation-shared.js';

// Activity docs are ALWAYS scoped by exam so the same PDF/paper mapped to two
// exams can never share (or overwrite) one completion record.
export function activityDocId(type, examId, refId) {
  return `${type}_${examId}_${refId}`;
}

function chunk(arr, size) {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

function pct(done, total) {
  if (!total) return null;
  return Math.min(100, Math.round((done / total) * 100));
}

// ------------------------- identity bridge ---------------------------------
const mobileMemo = {};
export async function getStudentMobile(fs, db, uid) {
  if (mobileMemo[uid] !== undefined) return mobileMemo[uid];
  let mobile = '';
  try {
    const snap = await fs.getDoc(fs.doc(db, 'users', uid));
    if (snap.exists()) mobile = String(snap.data().mobile || '').trim();
  } catch (e) { console.error('Unable to read student profile:', e); }
  mobileMemo[uid] = mobile;
  return mobile;
}

// ------------------------------ MOCK ----------------------------------------
// Which mock tests count for this exam: every mockTests doc inside a mapped
// mock CATEGORY (type 'mock') plus every individually mapped mock (type
// 'mockTest'). Results from any other mock are ignored.
export async function loadMockStats(fs, db, uid, mappings) {
  const catIds = [...new Set(mappings.filter(m => m.type === 'mock').map(m => m.refId))];
  const directIds = mappings.filter(m => m.type === 'mockTest').map(m => m.refId);
  if (!catIds.length && !directIds.length) return null;

  const mockIds = new Set(directIds);
  await Promise.all(chunk(catIds, 30).map(async (ids) => {
    const snap = await fs.getDocs(fs.query(fs.collection(db, 'mockTests'), fs.where('categoryId', 'in', ids)));
    snap.forEach(d => mockIds.add(d.id));
  }));

  const mobile = await getStudentMobile(fs, db, uid);
  const queries = [fs.getDocs(fs.query(fs.collection(db, 'mockResults'), fs.where('studentUid', '==', uid)))];
  if (mobile) queries.push(fs.getDocs(fs.query(fs.collection(db, 'mockResults'), fs.where('mobile', '==', mobile))));
  const snaps = await Promise.all(queries);

  const results = new Map(); // de-dupe: a new result matches BOTH queries
  snaps.forEach(s => s.forEach(d => results.set(d.id, d.data())));

  const bestByMock = {};
  let attemptCount = 0, pctSum = 0;
  results.forEach((r) => {
    if (!mockIds.has(r.mockId)) return;               // not part of this exam
    if (r.studentUid && r.studentUid !== uid) return; // never count someone else's
    const p = Number(r.percentage);
    const score = Number.isFinite(p) ? p : 0;
    attemptCount += 1; pctSum += score;
    if (bestByMock[r.mockId] === undefined || score > bestByMock[r.mockId]) bestByMock[r.mockId] = score;
  });

  const available = mockIds.size;
  const attempted = Object.keys(bestByMock).length;
  const best = attempted ? Math.max(...Object.values(bestByMock)) : null;
  const average = attemptCount ? Math.round((pctSum / attemptCount) * 100) / 100 : null;
  // A mockResults doc is only written when the student SUBMITS, so every
  // distinct attempted mock is also a completed mock.
  return { available, attempted, completed: attempted, best, average, mockIds: [...mockIds],
           percent: pct(attempted, available) };
}

// ------------------------------ MCQ -----------------------------------------
async function countQuestionsForTopics(fs, db, topicIds, examId) {
  const cacheKey = `prepQCount:${examId}:${[...topicIds].sort().join(',')}`;
  try {
    const raw = typeof sessionStorage !== 'undefined' && sessionStorage.getItem(cacheKey);
    if (raw) { const c = JSON.parse(raw); if (Date.now() - c.t < 30 * 60 * 1000) return c.n; }
  } catch {}
  let total = 0;
  await Promise.all(chunk(topicIds, 30).map(async (ids) => {
    const snap = await fs.getCountFromServer(fs.query(fs.collection(db, 'quizQuestions'), fs.where('topicId', 'in', ids)));
    total += snap.data().count;
  }));
  try { if (typeof sessionStorage !== 'undefined') sessionStorage.setItem(cacheKey, JSON.stringify({ t: Date.now(), n: total })); } catch {}
  return total;
}

export async function computeMcqStats(fs, db, examId, mappings, activityDocs) {
  const topicIds = [...new Set(mappings.filter(m => m.type === 'mcq').map(m => m.refId))];
  if (!topicIds.length) return null;
  const mapped = new Set(topicIds);
  const byTopic = {};
  let attempted = 0, correct = 0, wrong = 0;
  activityDocs.forEach((a) => {
    if (a.type !== 'mcq') return;
    const topicId = a.topicId || a.refId;
    if (!mapped.has(topicId)) return;
    const att = Number.isFinite(a.attempted) ? a.attempted : (Number(a.correct || 0) + Number(a.wrong || 0));
    if (!att) return; // opening a quiz without answering anything is not activity
    const t = byTopic[topicId] || (byTopic[topicId] = { attempted: 0, correct: 0, wrong: 0, quizzes: 0 });
    t.attempted += att; t.correct += Number(a.correct || 0); t.wrong += Number(a.wrong || 0); t.quizzes += 1;
    attempted += att; correct += Number(a.correct || 0); wrong += Number(a.wrong || 0);
  });
  const totalQuestions = await countQuestionsForTopics(fs, db, topicIds, examId);
  attempted = Math.min(attempted, totalQuestions || attempted);
  return {
    totalQuestions, attempted, correct, wrong,
    accuracy: attempted ? Math.round((correct / attempted) * 100) : null,
    byTopic, topicsPracticed: Object.keys(byTopic).length, topicsMapped: topicIds.length,
    percent: totalQuestions ? pct(attempted, totalQuestions) : null
  };
}

// ------------------------------ PYQ / NOTES ---------------------------------
const isDone = (a) => a && (a.completed === true || (a.completed === undefined && !!a.completedAt)); // legacy PYQ docs

export function computePyqStats(mappings, activityDocs) {
  const mapped = [...new Set(mappings.filter(m => m.type === 'pyq').map(m => m.refId))];
  if (!mapped.length) return null;
  const set = new Set(mapped);
  const done = new Map();
  activityDocs.forEach(a => { if (a.type === 'pyq' && set.has(a.refId) && isDone(a)) done.set(a.refId, a); });
  const scores = [...done.values()].map(a => a.score).filter(s => s !== null && s !== undefined && !Number.isNaN(Number(s))).map(Number);
  return {
    total: mapped.length, completed: done.size,
    attempted: done.size,
    averageScore: scores.length ? Math.round(scores.reduce((x, y) => x + y, 0) / scores.length) : null,
    accuracy: scores.length ? Math.round(scores.reduce((x, y) => x + y, 0) / scores.length) : null,
    percent: pct(done.size, mapped.length)
  };
}

export function computeNotesStats(mappings, activityDocs) {
  const mapped = [...new Set(mappings.filter(m => m.type === 'notes').map(m => m.refId))];
  if (!mapped.length) return null;
  const set = new Set(mapped);
  const done = new Set();
  activityDocs.forEach(a => { if (a.type === 'notes' && set.has(a.refId) && a.completed === true) done.add(a.refId); });
  return { total: mapped.length, completed: done.size, percent: pct(done.size, mapped.length) };
}

export function computeRevisionStats(revisionDocs) {
  const pending = revisionDocs.filter(r => r.status === 'pending').length;
  const done = revisionDocs.filter(r => r.status === 'done').length;
  return { pending, done, total: pending + done, percent: pct(done, pending + done) };
}

// ------------------------------ MAIN ----------------------------------------
// Everything for ONE exam in 5 scoped queries (+ 1-2 only when mocks are
// mapped, + cached count queries for MCQ). No per-question / per-mapping reads.
export async function loadExamProgress(fs, db, uid, examId) {
  const sp = (sub) => fs.query(fs.collection(db, 'studentPreparations', uid, sub), fs.where('preparationExamId', '==', examId));
  const [topicSnap, progressSnap, mapSnap, activitySnap, revisionSnap] = await Promise.all([
    fs.getDocs(fs.query(fs.collection(db, 'preparationTopics'), fs.where('examId', '==', examId))),
    fs.getDocs(sp('topicProgress')),
    fs.getDocs(fs.query(fs.collection(db, 'preparationMappings'), fs.where('examId', '==', examId))),
    fs.getDocs(sp('studyActivity')),
    fs.getDocs(sp('revision'))
  ]);
  const topics = topicSnap.docs.map(d => ({ id: d.id, ...d.data() }));
  const progressByTopicId = {}; progressSnap.forEach(d => { progressByTopicId[d.id] = d.data(); });
  const mappings = mapSnap.docs.map(d => ({ id: d.id, ...d.data() }));
  const activity = activitySnap.docs.map(d => ({ id: d.id, ...d.data() }));
  const revisionDocs = revisionSnap.docs.map(d => ({ id: d.id, ...d.data() }));

  const [mcq, mock] = await Promise.all([
    computeMcqStats(fs, db, examId, mappings, activity),
    loadMockStats(fs, db, uid, mappings).catch((e) => { console.error(e); return null; })
  ]);
  const pyq = computePyqStats(mappings, activity);
  const notes = computeNotesStats(mappings, activity);
  const revision = computeRevisionStats(revisionDocs);

  const components = {
    syllabus: computeSyllabusPercent(topics, progressByTopicId),
    mcq: mcq ? mcq.percent : null,
    pyq: pyq ? pyq.percent : null,
    mock: mock ? mock.percent : null,
    notes: notes ? notes.percent : null,
    revision: revision.total ? revision.percent : null
  };
  return { components, overall: computeOverallProgress(components),
           topics, progressByTopicId, mappings, activity, revisionDocs, mcq, pyq, notes, mock, revision };
}
