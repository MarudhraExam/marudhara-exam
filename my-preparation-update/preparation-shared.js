// ===========================================================================
// preparation-shared.js
// Shared helpers for the "My Preparation" pages (my-preparation.html,
// preparation-exam.html, preparation-syllabus.html, preparation-resources.html,
// preparation-planner.html).
//
// Nothing here creates a new identity/auth mechanism - it only re-exports the
// SAME rules already used by mock-tests/index.html and account.html:
//   - a "student" is a Firebase Auth user whose email ends with
//     @mockstudent.marudharaexam.in
//   - the student's mobile/name are cached in the SAME mockExamSession
//     localStorage/sessionStorage key the Mock Test system already uses
// ===========================================================================

export const STUDENT_EMAIL_DOMAIN = 'mockstudent.marudharaexam.in';

export function isStudentUser(user) {
  return !!(user && user.email && user.email.toLowerCase().endsWith(`@${STUDENT_EMAIL_DOMAIN}`));
}

export function getStoredStudent() {
  try {
    const raw = localStorage.getItem('mockExamSession') || sessionStorage.getItem('mockExamSession');
    const session = raw ? JSON.parse(raw) : null;
    return {
      studentName: session && session.studentName ? String(session.studentName).trim() : '',
      studentMobile: session && session.studentMobile ? String(session.studentMobile).trim() : ''
    };
  } catch { return { studentName: '', studentMobile: '' }; }
}

export function saveStoredStudent(details) {
  const existingRaw = localStorage.getItem('mockExamSession') || sessionStorage.getItem('mockExamSession');
  let merged = {};
  try { merged = existingRaw ? JSON.parse(existingRaw) : {}; } catch { merged = {}; }
  merged = { ...merged, ...details };
  const payload = JSON.stringify(merged);
  sessionStorage.setItem('mockExamSession', payload);
  try { localStorage.setItem('mockExamSession', payload); } catch {}
}

export function clearStoredStudent() {
  try { sessionStorage.removeItem('mockExamSession'); } catch {}
  try { localStorage.removeItem('mockExamSession'); } catch {}
}

// Watches auth state the same way every My Preparation page needs to:
// logged-in student -> onLogin(user); anyone else -> onLoggedOut() (the
// caller is expected to redirect to mock-tests/index.html, the ONE existing
// login/register screen - this file never renders any login UI itself).
//
// Safety rules (so a student is never bounced to login while Firebase Auth is
// still restoring the saved session, and never initialised twice):
//   1. Nothing is decided until Firebase Auth has resolved its INITIAL state
//      (auth.authStateReady()), so "not resolved yet" is never treated as
//      "logged out".
//   2. onLogin runs ONCE per uid. Repeated emissions for the same signed-in
//      student (cross-tab sync, token refresh, etc.) do not re-initialise the
//      page.
//   3. A signed-out / non-student emission only triggers onLoggedOut() after a
//      short grace period during which auth.currentUser is re-checked, and
//      onLoggedOut() fires at most once per page load - no redirect loops.
const LOGGED_OUT_GRACE_MS = 800;

export function watchStudentAuth(auth, onAuthStateChanged, { onLogin, onLoggedOut }) {
  let activeUid = null;
  let loggedOutTimer = null;
  let loggedOutHandled = false;

  function handleUser(user) {
    if (user && isStudentUser(user)) {
      if (loggedOutTimer) { clearTimeout(loggedOutTimer); loggedOutTimer = null; }
      if (activeUid === user.uid) return; // same session re-emitted - already initialised
      activeUid = user.uid;
      loggedOutHandled = false;
      onLogin(user);
      return;
    }
    if (loggedOutHandled || loggedOutTimer) return;
    loggedOutTimer = setTimeout(() => {
      loggedOutTimer = null;
      const current = auth.currentUser;
      if (current && isStudentUser(current)) { handleUser(current); return; }
      if (loggedOutHandled) return;
      loggedOutHandled = true;
      activeUid = null;
      onLoggedOut();
    }, LOGGED_OUT_GRACE_MS);
  }

  const subscribe = () => onAuthStateChanged(auth, handleUser);
  if (auth && typeof auth.authStateReady === 'function') {
    auth.authStateReady().then(subscribe, subscribe);
  } else {
    subscribe();
  }
}

export function escapeHtml(value) {
  return String(value == null ? '' : value)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#039;');
}

export function formatExamDate(value) {
  if (!value) return 'Not announced yet';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

// Returns a short human label for the countdown strip on a prep card.
export function daysRemainingLabel(examDateValue) {
  if (!examDateValue) return 'Exam Date Not Announced';
  const examDate = new Date(examDateValue);
  if (Number.isNaN(examDate.getTime())) return 'Exam Date Not Announced';
  const today = new Date();
  const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const startOfExam = new Date(examDate.getFullYear(), examDate.getMonth(), examDate.getDate());
  const diffDays = Math.round((startOfExam - startOfToday) / 86400000);
  if (diffDays > 1) return `${diffDays} Days Remaining`;
  if (diffDays === 1) return 'Tomorrow';
  if (diffDays === 0) return 'Today';
  return 'Exam Date Passed';
}

export function renderIconHtml(icon, fallback) {
  const safeFallback = fallback || '🎯';
  if (!icon) return `<span class="prep-icon">${safeFallback}</span>`;
  if (/^https?:\/\//i.test(icon)) return `<span class="prep-icon"><img src="${escapeHtml(icon)}" alt="" /></span>`;
  return `<span class="prep-icon">${escapeHtml(icon)}</span>`;
}

// ---------------------------------------------------------------------------
// Centralized, configurable progress weighting (Part 5 of the brief).
// Change PROGRESS_WEIGHTS in one place to change how overall % is computed
// everywhere. Any component the caller passes as null/undefined is treated
// as "not applicable yet" (e.g. admin hasn't mapped any MCQ topics to this
// exam) and its weight is redistributed proportionally across the
// components that DO have real data, instead of being silently counted as
// 0% forever.
// ---------------------------------------------------------------------------
export const PROGRESS_WEIGHTS = {
  syllabus: 20,
  mcq: 20,
  pyq: 15,
  mock: 20,
  notes: 10,
  revision: 15
};

export function computeOverallProgress(components) {
  let totalWeight = 0;
  let weightedSum = 0;
  for (const key in PROGRESS_WEIGHTS) {
    const val = components ? components[key] : null;
    if (val === null || val === undefined || Number.isNaN(val)) continue;
    const clamped = Math.max(0, Math.min(100, val));
    totalWeight += PROGRESS_WEIGHTS[key];
    weightedSum += PROGRESS_WEIGHTS[key] * clamped;
  }
  if (totalWeight === 0) return 0;
  return Math.round(weightedSum / totalWeight);
}

// Syllabus % from an array of {status} topic-progress rows for one exam.
// "completed" counts fully, "in_progress" counts as half credit.
export function computeSyllabusPercent(topics, progressByTopicId) {
  if (!topics || !topics.length) return null; // no syllabus defined yet
  let score = 0;
  topics.forEach((t) => {
    const status = (progressByTopicId && progressByTopicId[t.id] && progressByTopicId[t.id].status) || 'not_started';
    if (status === 'completed') score += 1;
    else if (status === 'in_progress') score += 0.5;
  });
  return Math.round((score / topics.length) * 100);
}
