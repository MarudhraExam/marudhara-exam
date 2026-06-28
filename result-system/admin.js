// admin.js — Marudhara Exam Result Search System
// ES6 Module — imports from existing firebase.js

import {
  db,
  collection,
  addDoc,
  getDocs,
  getDoc,
  doc,
  updateDoc,
  deleteDoc,
  query,
  where,
  writeBatch,
  serverTimestamp,
  orderBy,
  limit,
  startAfter
} from "./firebase.js";

// ── Constants ────────────────────────────────────────────────
const RESULTS_COL  = 'results';
const STUDENTS_COL = 'resultStudents';
const BATCH_SIZE   = 500;

// ── Smart Field Map ──────────────────────────────────────────
// Every key maps to an array of normalized aliases.
// Normalization strips all punctuation/whitespace and uppercases.
// Add more aliases here without touching any other code.
const FIELD_MAP = {
  rollNo: [
    "ROLLNO", "ROLLNUMBER", "ROLL", "REGNNO", "REGDNO",
    "REGISTRATIONNO", "REGISTRATIONNUMBER", "REGNUMBER",
    "REGNO", "REGDNUMBER",
    "APPLICATIONNO", "APPLICATION", "APPLICATIONNUMBER",
    "APPLICATIONID", "APPNO", "APPID",
    "CANDIDATEID", "CANDIDATENO"
  ],
  name: [
    "NAME", "CANDNAME", "CANDIDATENAME", "CANDIDATEFULLNAME",
    "STUDENTNAME", "APPLICANTNAME", "FULLNAME"
  ],
  fatherName: [
    "FATHERNAME", "FATHER", "FNAME", "FATHERSNAME"
  ],
  motherName: [
    "MOTHERNAME", "MOTHER", "MNAME", "MOTHERSNAME"
  ],
  applicationNo: [
    "APPLICATIONNO", "APPLICATION", "APPLICATIONNUMBER",
    "APPLICATIONID", "APPNO", "APPID"
  ],
  dob: [
    "DOB", "DATEOFBIRTH", "BIRTHDATE", "DATEOFBIRTH", "BDATE"
  ],
  gender: [
    "GENDER", "SEX"
  ],
  category: [
    "CATEGORY", "CAT", "CASTE", "CASTECATEGORY"
  ],
  horizontalCategory: [
    "HCAT", "HORIZONTALCATEGORY", "HCATEGORY", "HORIZCAT"
  ],
  femaleCategory: [
    "FCAT", "FEMALECATEGORY", "FCATEGORY"
  ],
  tsp: [
    "TSP", "NONTSP", "AREA", "TSPAREA"
  ],
  netMarks: [
    "NET", "NETMARKS", "MARKS", "NETSCORE",
    "SCORE", "TOTALMARKS", "OBTAINEDMARKS", "TOTAL"
  ],
  rank: [
    "RANK", "MERIT", "MERITRANK", "OVERALLRANK",
    "MERITNO", "MERITPOSITION", "POSITION"
  ],
  selectionCategory: [
    "SELCAT", "SELECTIONCATEGORY", "SELCATEGORY", "SELECTEDCAT"
  ]
};

// ── All normalized aliases in one flat set (for header-row detection) ─
const ALL_ALIASES = new Set(
  Object.values(FIELD_MAP).flat()
);

// ── DOM References ───────────────────────────────────────────
const examNameInput       = document.getElementById('exam-name-input');
const excelFileInput      = document.getElementById('excel-file-input');
const fileDisplay         = document.getElementById('file-display');
const fileDisplayText     = document.getElementById('file-display-text');
const importBtn           = document.getElementById('import-btn');
const importProgressWrap  = document.getElementById('import-progress-wrap');
const importProgressBar   = document.getElementById('import-progress-bar');
const importProgressLabel = document.getElementById('import-progress-label');
const globalAlert         = document.getElementById('global-alert');
const globalAlertText     = document.getElementById('global-alert-text');
const uploadSummary       = document.getElementById('upload-summary');
const sumExamName         = document.getElementById('sum-exam-name');
const sumFileName         = document.getElementById('sum-file-name');
const sumCount            = document.getElementById('sum-count');
const sumDate             = document.getElementById('sum-date');
const examsLoading        = document.getElementById('exams-loading');
const examsTableWrap      = document.getElementById('exams-table-wrap');
const examsTbody          = document.getElementById('exams-tbody');

// Delete modal
const deleteModal       = document.getElementById('delete-modal');
const deleteConfirmText = document.getElementById('delete-confirm-text');
const deleteConfirmBtn  = document.getElementById('delete-confirm-btn');

// Rename modal
const renameModal      = document.getElementById('rename-modal');
const renameInput      = document.getElementById('rename-input');
const renameConfirmBtn = document.getElementById('rename-confirm-btn');

// Replace modal
const replaceModal           = document.getElementById('replace-modal');
const replaceExamNameDisplay = document.getElementById('replace-exam-name-display');
const replaceFileInput       = document.getElementById('replace-file-input');
const replaceFileDisplay     = document.getElementById('replace-file-display');
const replaceFileDisplayText = document.getElementById('replace-file-display-text');
const replaceConfirmBtn      = document.getElementById('replace-confirm-btn');
const replaceProgressWrap    = document.getElementById('replace-progress-wrap');
const replaceProgressBar     = document.getElementById('replace-progress-bar');
const replaceProgressLabel   = document.getElementById('replace-progress-label');

// ── State ────────────────────────────────────────────────────
let pendingDeleteId    = null;
let pendingRenameId    = null;
let pendingReplaceId   = null;
let pendingReplaceName = null;

// ── Utility: Toast ───────────────────────────────────────────
function showToast(message, type = 'info') {
  const container = document.getElementById('toast-container');
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.textContent = message;
  container.appendChild(toast);
  setTimeout(() => {
    toast.classList.add('removing');
    setTimeout(() => toast.remove(), 250);
  }, 3500);
}

// ── Utility: Global Alert ────────────────────────────────────
function showAlert(message, type = 'info') {
  globalAlert.className = `alert alert-${type}`;
  globalAlertText.textContent = message;
  globalAlert.classList.remove('hidden');
  globalAlert.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function hideAlert() {
  globalAlert.classList.add('hidden');
}

// ── Utility: Modal ───────────────────────────────────────────
function openModal(modalEl) {
  modalEl.classList.add('open');
  document.body.style.overflow = 'hidden';
}

function closeModal(modalEl) {
  modalEl.classList.remove('open');
  document.body.style.overflow = '';
}

// Close buttons via data-close attribute
document.querySelectorAll('[data-close]').forEach(btn => {
  btn.addEventListener('click', () => {
    const id = btn.getAttribute('data-close');
    closeModal(document.getElementById(id));
  });
});

// Close on backdrop click
[deleteModal, renameModal, replaceModal].forEach(modal => {
  modal.addEventListener('click', e => {
    if (e.target === modal) closeModal(modal);
  });
});

// ── Utility: Format Date ─────────────────────────────────────
function formatDate(timestamp) {
  if (!timestamp) return '—';
  const d = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
  return d.toLocaleDateString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric'
  });
}

// ── Utility: Safe string ─────────────────────────────────────
function safe(val) {
  if (val === null || val === undefined) return '';
  return String(val).trim();
}

// ── Escape helpers ───────────────────────────────────────────
function escHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function escAttr(str) {
  return String(str).replace(/'/g, "\\'").replace(/"/g, '&quot;');
}

// ════════════════════════════════════════════════════════════
// EXCEL PARSER — production-grade, fully dynamic
// ════════════════════════════════════════════════════════════

/**
 * Normalize a raw header cell value into a canonical lookup key.
 * Strips ALL punctuation, whitespace, and special characters, then uppercases.
 */
function normalizeHeader(raw) {
  return String(raw)
    .toUpperCase()
    .replace(/[\s\t\r\n_\-\.:;,\/\\()\[\]{}'\"#*]+/g, '');
}

/**
 * Score a candidate header row by counting how many of its cells
 * match at least one known alias in FIELD_MAP.
 * Returns the match count (higher = better header candidate).
 */
function scoreHeaderRow(row) {
  let score = 0;
  for (const cell of row) {
    if (ALL_ALIASES.has(normalizeHeader(cell))) score++;
  }
  return score;
}

/**
 * Scan the first `scanLimit` rows of a sheet's data array and return
 * the index of the row that best matches known field aliases.
 * Falls back to row 0 if nothing scores > 0.
 */
function detectHeaderRowIndex(rows, scanLimit = 10) {
  let bestIdx   = 0;
  let bestScore = 0;
  const limit = Math.min(scanLimit, rows.length);
  for (let i = 0; i < limit; i++) {
    const score = scoreHeaderRow(rows[i]);
    if (score > bestScore) {
      bestScore = score;
      bestIdx   = i;
    }
  }
  return bestIdx;
}

/**
 * Build a column-index map for one sheet.
 * Returns { colMap, headerRowIndex } where colMap is:
 *   { NORMALIZED_ALIAS: columnIndex, … }
 */
function buildColMap(rows) {
  const headerRowIndex = detectHeaderRowIndex(rows);
  const headerRow      = rows[headerRowIndex] || [];
  const colMap         = {};
  headerRow.forEach((cell, i) => {
    const key = normalizeHeader(cell);
    if (key && colMap[key] === undefined) {
      colMap[key] = i;
    }
  });
  return { colMap, headerRowIndex };
}

/**
 * Given a colMap and a list of field aliases, return the first matching
 * column index, or -1 if none found.
 */
function findCol(colMap, aliases) {
  for (const alias of aliases) {
    const key = normalizeHeader(alias);
    if (colMap[key] !== undefined) return colMap[key];
  }
  return -1;
}

/**
 * Extract a string value from a data row using field aliases.
 * Returns "" when the column is absent or the cell is empty.
 */
function getVal(row, colMap, aliases) {
  const idx = findCol(colMap, aliases);
  if (idx === -1) return '';
  return safe(row[idx]);
}

/**
 * Return true when every mapped field in the row is blank.
 * Used to skip genuinely empty rows while preserving rows with
 * partial data (e.g. roll number missing but name present).
 */
function isRowAllEmpty(row, colMap) {
  return Object.values(FIELD_MAP).every(aliases => {
    return getVal(row, colMap, aliases) === '';
  });
}

/**
 * Build a single student object from one data row.
 * Returns null only if ALL mapped fields are empty.
 */
function buildStudent(row, colMap) {
  if (!row) return null;
  if (isRowAllEmpty(row, colMap)) return null;

  const rollNo      = getVal(row, colMap, FIELD_MAP.rollNo);
  const name        = getVal(row, colMap, FIELD_MAP.name);
  const fatherName  = getVal(row, colMap, FIELD_MAP.fatherName);
  const motherName  = getVal(row, colMap, FIELD_MAP.motherName);
  const applicationNo = getVal(row, colMap, FIELD_MAP.applicationNo);

  return {
    rollNo,
    applicationNo,
    rank:               getVal(row, colMap, FIELD_MAP.rank),
    name,
    fatherName,
    motherName,
    dob:                getVal(row, colMap, FIELD_MAP.dob),
    gender:             getVal(row, colMap, FIELD_MAP.gender),
    category:           getVal(row, colMap, FIELD_MAP.category),
    horizontalCategory: getVal(row, colMap, FIELD_MAP.horizontalCategory),
    femaleCategory:     getVal(row, colMap, FIELD_MAP.femaleCategory),
    tsp:                getVal(row, colMap, FIELD_MAP.tsp),
    netMarks:           getVal(row, colMap, FIELD_MAP.netMarks),
    selectionCategory:  getVal(row, colMap, FIELD_MAP.selectionCategory),
    searchRoll:         rollNo.toLowerCase(),
    searchName:         name.toLowerCase(),
    searchFather:       fatherName.toLowerCase(),
    searchMother:       motherName.toLowerCase()
  };
}

/**
 * Parse one worksheet's raw 2-D array into student objects.
 * Header row is auto-detected; data rows follow immediately after it.
 */
function parseSheet(rows) {
  if (!rows.length) return [];

  const { colMap, headerRowIndex } = buildColMap(rows);
  const students = [];

  for (let r = headerRowIndex + 1; r < rows.length; r++) {
    const student = buildStudent(rows[r], colMap);
    if (student) students.push(student);
  }

  return students;
}

/**
 * Main entry point: read an Excel File object and resolve with an array
 * of student objects deduplicated by rollNo+applicationNo+name.
 *
 * - Works with any number of sheets.
 * - Each sheet gets its own independent header detection.
 * - Column order never matters.
 * - Missing columns return "".
 * - Completely blank rows are skipped; rows with partial data are kept.
 */
function parseExcel(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onerror = () => reject(new Error('Failed to read file.'));

    reader.onload = e => {
      try {
        const data     = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, { type: 'array', cellDates: true });
        const sheets   = workbook.SheetNames;

        if (!sheets.length) {
          return reject(new Error('Excel file has no sheets.'));
        }

        const allStudents = [];
        // Deduplicate across sheets using rollNo + applicationNo + name
        const seen = new Set();

        for (const sheetName of sheets) {
          const ws   = workbook.Sheets[sheetName];
          const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
          const sheetStudents = parseSheet(rows);

          for (const student of sheetStudents) {
            const key = `${student.rollNo}|${student.applicationNo}|${student.name}`.toLowerCase();
            if (!seen.has(key)) {
              seen.add(key);
              allStudents.push(student);
            }
          }
        }

        if (!allStudents.length) {
          return reject(new Error('No student records found in the Excel file.'));
        }

        resolve(allStudents);

      } catch (err) {
        reject(err);
      }
    };

    reader.readAsArrayBuffer(file);
  });
}

// ════════════════════════════════════════════════════════════
// FIRESTORE OPERATIONS
// ════════════════════════════════════════════════════════════

// ── Helper: Sleep ───────────────────────────────────────────
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// ── Helper: Commit with Retry & Exponential Backoff ─────────
async function commitWithRetry(batch, retry = 0) {
  try {
    await batch.commit();
  } catch (err) {
    const code = String(err.code || "").toLowerCase();
    const message = String(err.message || "").toLowerCase();

    const isQuotaOrTransient =
      code.includes("resource-exhausted") ||
      code.includes("deadline-exceeded") ||
      code.includes("unavailable") ||
      message.includes("resource-exhausted") ||
      message.includes("quota exceeded") ||
      message.includes("deadline exceeded") ||
      message.includes("unavailable") ||
      message.includes("overloaded");

    if (isQuotaOrTransient) {
      if (retry >= 8) throw err;

      // Exponential backoff: 2s -> 4s -> 8s -> 16s... up to 30s max
      const delay = Math.min(2000 * Math.pow(2, retry), 30000);
      console.warn(`Firestore quota/transient limit reached. Retrying attempt ${retry + 1} after ${delay}ms...`);
      await sleep(delay);
      return commitWithRetry(batch, retry + 1);
    }
    throw err;
  }
}

// ── Optimized Smart Batch Upload with Dynamic Sizing ────────
async function batchWriteStudents(students, examId, examName, onProgress) {
  let batchSize = 500;
  let uploaded = 0;
  const total = students.length;
  const startTime = Date.now();
  let consecutiveSuccesses = 0;

  for (let i = 0; i < total; ) {
    const chunk = students.slice(i, i + batchSize);
    const batch = writeBatch(db);

    chunk.forEach(student => {
      const ref = doc(collection(db, STUDENTS_COL));
      batch.set(ref, {
        ...student,
        examId,
        examName,
        createdAt: serverTimestamp()
      });
    });

    try {
      await commitWithRetry(batch);
      uploaded += chunk.length;
      i += chunk.length;
      consecutiveSuccesses++;

      // Slowly scale back up if we remain stable for multiple consecutive batches
      if (consecutiveSuccesses >= 3 && batchSize < 500) {
        batchSize = Math.min(500, batchSize + 50);
        consecutiveSuccesses = 0; // reset stable count
        console.info(`Upload stable. Increasing batch size to: ${batchSize}`);
      }

      // Progress metrics
      const percent = Math.round((uploaded * 100) / total);
      const elapsed = (Date.now() - startTime) / 1000;
      const speed = uploaded / Math.max(elapsed, 1);
      const remaining = total - uploaded;
      const eta = Math.round(remaining / Math.max(speed, 1));

      if (onProgress) {
        onProgress(percent, uploaded, total, eta);
      }

      // Batch Delay (200-300ms cooldown) to prevent aggressive throttling
      await sleep(250);

    } catch (err) {
      console.error("Batch write failed, reducing batch size:", err);
      consecutiveSuccesses = 0; // reset stable count

      // Throttle down batch sizes immediately on failure
      if (batchSize > 250) {
        batchSize = 250;
      } else if (batchSize > 100) {
        batchSize = 100;
      } else {
        // Already at lowest batchSize limit (100) and still failing, propagate error to trigger rollback
        throw err;
      }

      console.warn(`Dynamic batch scale down triggered. New batch size: ${batchSize}`);
      // Note: `i` is NOT incremented, so the next iteration will re-attempt this slice with the smaller batch size
    }
  }
}

// ── Smart Deletion in Batches of 500 ────────────────────────
async function deleteAllStudents(examId, onProgress) {
  let deleted = 0;
  let hasMore = true;

  // Attempt to fetch the total records estimate from RESULTS_COL to compute accurate deletion progress
  let total = 0;
  try {
    const examDoc = await getDoc(doc(db, RESULTS_COL, examId));
    if (examDoc.exists()) {
      total = Number(examDoc.data().studentsCount) || 0;
    }
  } catch (err) {
    console.warn("Could not fetch total student count for deletion progress bar:", err);
  }

  while (hasMore) {
    const q = query(
      collection(db, STUDENTS_COL),
      where('examId', '==', examId),
      limit(500)
    );

    const snap = await getDocs(q);
    if (snap.empty) {
      hasMore = false;
      break;
    }

    const batch = writeBatch(db);
    snap.docs.forEach(d => batch.delete(d.ref));

    await commitWithRetry(batch);
    deleted += snap.docs.length;

    if (onProgress) {
      const progressTotal = Math.max(total, deleted);
      const pct = progressTotal > 0 ? Math.round((deleted / progressTotal) * 100) : 100;
      onProgress(pct, deleted, progressTotal);
    }

    if (snap.docs.length < 500) {
      hasMore = false;
    } else {
      // Cooldown between batches
      await sleep(250);
    }
  }
}

// ── Smart Rename (Batch update examName in all student docs) ─
async function updateStudentsExamName(examId, newName) {
  let lastVisible = null;
  let hasMore = true;

  while (hasMore) {
    let q;
    if (lastVisible) {
      q = query(
        collection(db, STUDENTS_COL),
        where('examId', '==', examId),
        orderBy('__name__'),
        startAfter(lastVisible),
        limit(500)
      );
    } else {
      q = query(
        collection(db, STUDENTS_COL),
        where('examId', '==', examId),
        orderBy('__name__'),
        limit(500)
      );
    }

    const snap = await getDocs(q);
    if (snap.empty) {
      hasMore = false;
      break;
    }

    const batch = writeBatch(db);
    snap.docs.forEach(d => {
      batch.update(d.ref, { examName: newName });
    });

    await commitWithRetry(batch);
    lastVisible = snap.docs[snap.docs.length - 1];

    if (snap.docs.length < 500) {
      hasMore = false;
    } else {
      await sleep(250); // cooldown between batches
    }
  }
}

// ── Load Exams Table ─────────────────────────────────────────
async function loadExams() {
  examsLoading.classList.remove('hidden');
  examsTableWrap.classList.add('hidden');

  try {
    const q    = query(collection(db, RESULTS_COL), orderBy('createdAt', 'desc'));
    const snap = await getDocs(q);

    examsLoading.classList.add('hidden');
    examsTableWrap.classList.remove('hidden');

    if (snap.empty) {
      examsTbody.innerHTML = '<tr class="empty-row"><td colspan="5">No exams uploaded yet.</td></tr>';
      return;
    }

    let html = '';
    let idx  = 1;
    snap.forEach(docSnap => {
      const d  = docSnap.data();
      const id = docSnap.id;
      const dt = formatDate(d.createdAt);
      html += `
        <tr data-id="${id}">
          <td>${idx++}</td>
          <td><strong>${escHtml(d.examName)}</strong></td>
          <td>${Number(d.studentsCount).toLocaleString('en-IN')}</td>
          <td>${dt}</td>
          <td>
            <div class="table-actions">
              <button class="btn btn-sm btn-outline" onclick="handleReplace('${id}','${escAttr(d.examName)}')">Replace</button>
              <button class="btn btn-sm btn-primary" onclick="handleRename('${id}','${escAttr(d.examName)}')">Rename</button>
              <button class="btn btn-sm btn-danger"  onclick="handleDelete('${id}','${escAttr(d.examName)}')">Delete</button>
            </div>
          </td>
        </tr>`;
    });
    examsTbody.innerHTML = html;

  } catch (err) {
    examsLoading.classList.add('hidden');
    examsTableWrap.classList.remove('hidden');
    showAlert('Failed to load exams: ' + err.message, 'danger');
  }
}

// ════════════════════════════════════════════════════════════
// FILE INPUT DISPLAY
// ════════════════════════════════════════════════════════════

excelFileInput.addEventListener('change', () => {
  const file = excelFileInput.files[0];
  if (file) {
    fileDisplayText.textContent = file.name;
    fileDisplay.classList.add('has-file');
  } else {
    fileDisplayText.textContent = 'Click to choose Excel file';
    fileDisplay.classList.remove('has-file');
  }
});

replaceFileInput.addEventListener('change', () => {
  const file = replaceFileInput.files[0];
  if (file) {
    replaceFileDisplayText.textContent = file.name;
    replaceFileDisplay.classList.add('has-file');
  } else {
    replaceFileDisplayText.textContent = 'Click to choose Excel file';
    replaceFileDisplay.classList.remove('has-file');
  }
});

// ════════════════════════════════════════════════════════════
// IMPORT
// ════════════════════════════════════════════════════════════

importBtn.addEventListener('click', async () => {
  hideAlert();

  const examName = examNameInput.value.trim();
  const file     = excelFileInput.files[0];

  if (!examName) {
    showAlert('Please enter an exam name.', 'danger');
    examNameInput.focus();
    return;
  }
  if (!file) {
    showAlert('Please choose an Excel file.', 'danger');
    return;
  }

  importBtn.disabled = true;
  importBtn.textContent = 'Importing…';
  importProgressWrap.classList.remove('hidden');
  importProgressBar.style.width = '0%';
  importProgressLabel.textContent = 'Reading Excel file…';
  uploadSummary.classList.remove('visible');

  let examId = null;

  try {
    const students = await parseExcel(file);
    importProgressLabel.textContent = `Parsed ${students.length.toLocaleString('en-IN')} students. Writing to database…`;
    importProgressBar.style.width = '5%';

    const examRef = await addDoc(collection(db, RESULTS_COL), {
      examName,
      fileName:      file.name,
      studentsCount: students.length,
      createdAt:     serverTimestamp()
    });

    examId = examRef.id;

    await batchWriteStudents(students, examId, examName, (pct, written, total, eta) => {
      const displayPct = 5 + Math.round(pct * 0.95);
      importProgressBar.style.width = displayPct + '%';

      let etaStr = '';
      if (eta !== undefined && eta !== null && !isNaN(eta) && isFinite(eta)) {
        if (eta < 60) {
          etaStr = ` | ETA: ${eta}s`;
        } else {
          const mins = Math.floor(eta / 60);
          const secs = eta % 60;
          etaStr = ` | ETA: ${mins}m ${secs}s`;
        }
      }

      importProgressLabel.textContent =
        `Uploading… ${written.toLocaleString('en-IN')} / ${total.toLocaleString('en-IN')} (${pct}%)${etaStr}`;
    });

    importProgressBar.style.width = '100%';
    importProgressLabel.textContent = 'Done!';

    const now = new Date();
    sumExamName.textContent = examName;
    sumFileName.textContent = file.name;
    sumCount.textContent    = students.length.toLocaleString('en-IN');
    sumDate.textContent     = now.toLocaleDateString('en-IN', {
      day: '2-digit', month: 'short', year: 'numeric'
    });
    uploadSummary.classList.add('visible');
    uploadSummary.scrollIntoView({ behavior: 'smooth', block: 'nearest' });

    showToast('Import successful!', 'success');

    examNameInput.value = '';
    excelFileInput.value = '';
    fileDisplayText.textContent = 'Click to choose Excel file';
    fileDisplay.classList.remove('has-file');

    await loadExams();

  } catch (err) {
    showAlert('Import failed: ' + err.message, 'danger');
    importProgressLabel.textContent = 'Failed.';

    // Rollback incomplete exam metadata and student records if write fails
    if (examId) {
      console.warn(`Cleaning up incomplete exam metadata for ID: ${examId}`);
      try {
        await deleteDoc(doc(db, RESULTS_COL, examId));
        await deleteAllStudents(examId);
      } catch (cleanupErr) {
        console.error('Error during metadata rollback:', cleanupErr);
      }
    }
  } finally {
    importBtn.disabled = false;
    importBtn.textContent = 'Import Results';
    setTimeout(() => {
      importProgressWrap.classList.add('hidden');
      importProgressBar.style.width = '0%';
    }, 2000);
  }
});

// ════════════════════════════════════════════════════════════
// DELETE
// ════════════════════════════════════════════════════════════

window.handleDelete = function(examId, examName) {
  pendingDeleteId = examId;
  deleteConfirmText.textContent =
    `This will permanently delete "${examName}" and all associated student records. This action cannot be undone.`;
  openModal(deleteModal);
};

deleteConfirmBtn.addEventListener('click', async () => {
  if (!pendingDeleteId) return;

  deleteConfirmBtn.disabled = true;
  deleteConfirmBtn.textContent = 'Deleting…';

  try {
    await deleteAllStudents(pendingDeleteId);
    await deleteDoc(doc(db, RESULTS_COL, pendingDeleteId));

    closeModal(deleteModal);
    showToast('Exam deleted successfully.', 'success');
    await loadExams();
  } catch (err) {
    showToast('Delete failed: ' + err.message, 'danger');
  } finally {
    deleteConfirmBtn.disabled = false;
    deleteConfirmBtn.textContent = 'Delete';
    pendingDeleteId = null;
  }
});

// ════════════════════════════════════════════════════════════
// RENAME
// ════════════════════════════════════════════════════════════

window.handleRename = function(examId, examName) {
  pendingRenameId = examId;
  renameInput.value = examName;
  openModal(renameModal);
  setTimeout(() => renameInput.focus(), 100);
};

renameConfirmBtn.addEventListener('click', async () => {
  const newName = renameInput.value.trim();
  if (!newName) {
    renameInput.focus();
    return;
  }
  if (!pendingRenameId) return;

  renameConfirmBtn.disabled = true;
  renameConfirmBtn.textContent = 'Renaming…';

  try {
    await updateDoc(doc(db, RESULTS_COL, pendingRenameId), { examName: newName });
    await updateStudentsExamName(pendingRenameId, newName);

    closeModal(renameModal);
    showToast('Exam renamed successfully.', 'success');
    await loadExams();
  } catch (err) {
    showToast('Rename failed: ' + err.message, 'danger');
  } finally {
    renameConfirmBtn.disabled = false;
    renameConfirmBtn.textContent = 'Rename';
    pendingRenameId = null;
  }
});

renameInput.addEventListener('keydown', e => {
  if (e.key === 'Enter') renameConfirmBtn.click();
});

// ════════════════════════════════════════════════════════════
// REPLACE
// ════════════════════════════════════════════════════════════

window.handleReplace = function(examId, examName) {
  pendingReplaceId   = examId;
  pendingReplaceName = examName;
  replaceExamNameDisplay.textContent = examName;
  replaceFileInput.value = '';
  replaceFileDisplayText.textContent = 'Click to choose Excel file';
  replaceFileDisplay.classList.remove('has-file');
  replaceProgressWrap.classList.add('hidden');
  replaceProgressBar.style.width = '0%';
  openModal(replaceModal);
};

replaceConfirmBtn.addEventListener('click', async () => {
  const file = replaceFileInput.files[0];
  if (!file) {
    showToast('Please choose an Excel file.', 'danger');
    return;
  }
  if (!pendingReplaceId) return;

  replaceConfirmBtn.disabled = true;
  replaceConfirmBtn.textContent = 'Replacing…';
  replaceProgressWrap.classList.remove('hidden');
  replaceProgressBar.style.width = '0%';
  replaceProgressLabel.textContent = 'Reading Excel file…';

  try {
    const students = await parseExcel(file);
    replaceProgressLabel.textContent =
      `Parsed ${students.length.toLocaleString('en-IN')} students. Deleting old records…`;
    replaceProgressBar.style.width = '5%';

    await deleteAllStudents(pendingReplaceId, (pct) => {
      const displayPct = 5 + Math.round(pct * 0.3);
      replaceProgressBar.style.width = displayPct + '%';
      replaceProgressLabel.textContent = `Deleting old records… ${displayPct}%`;
    });

    replaceProgressBar.style.width = '35%';
    replaceProgressLabel.textContent = 'Writing new records…';

    await batchWriteStudents(students, pendingReplaceId, pendingReplaceName, (pct, written, total, eta) => {
      const displayPct = 35 + Math.round(pct * 0.6);
      replaceProgressBar.style.width = displayPct + '%';

      let etaStr = '';
      if (eta !== undefined && eta !== null && !isNaN(eta) && isFinite(eta)) {
        if (eta < 60) {
          etaStr = ` | ETA: ${eta}s`;
        } else {
          const mins = Math.floor(eta / 60);
          const secs = eta % 60;
          etaStr = ` | ETA: ${mins}m ${secs}s`;
        }
      }

      replaceProgressLabel.textContent =
        `Writing… ${written.toLocaleString('en-IN')} / ${total.toLocaleString('en-IN')} (${pct}%)${etaStr}`;
    });

    await updateDoc(doc(db, RESULTS_COL, pendingReplaceId), {
      fileName:      file.name,
      studentsCount: students.length,
      createdAt:     serverTimestamp()
    });

    replaceProgressBar.style.width = '100%';
    replaceProgressLabel.textContent = 'Done!';

    closeModal(replaceModal);
    showToast('Excel replaced successfully.', 'success');
    await loadExams();

  } catch (err) {
    showToast('Replace failed: ' + err.message, 'danger');
    replaceProgressLabel.textContent = 'Failed.';
  } finally {
    replaceConfirmBtn.disabled = false;
    replaceConfirmBtn.textContent = 'Replace';
    pendingReplaceId   = null;
    pendingReplaceName = null;
    setTimeout(() => {
      replaceProgressWrap.classList.add('hidden');
      replaceProgressBar.style.width = '0%';
    }, 2000);
  }
});

// ── Init ─────────────────────────────────────────────────────
loadExams();
