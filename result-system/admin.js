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
  orderBy
} from "./firebase.js";

// ── Constants ────────────────────────────────────────────────
const RESULTS_COL  = 'results';
const STUDENTS_COL = 'resultStudents';
const BATCH_SIZE   = 500;

// ── Smart Field Map ──────────────────────────────────────────
// Each key maps to an array of normalized header aliases.
// Header normalization: UPPERCASE, strip spaces/underscores/dashes/dots/parens.
const FIELD_MAP = {
  rollNo: [
    "ROLLNO","ROLLNUMBER","ROLL","ROLLNO",
    "APPLICATIONNO","APPLICATION","APPLICATIONNUMBER",
    "REGISTRATIONNO","REGISTRATIONNUMBER"
  ],
  name: [
    "CANDNAME","CANDIDATENAME","NAME",
    "STUDENTNAME","APPLICANTNAME"
  ],
  fatherName: [
    "FATHERNAME","FATHER","FNAME"
  ],
  motherName: [
    "MOTHERNAME","MOTHER","MNAME"
  ],
  applicationNo: [
    "APPLICATION","APPLICATIONNO","APPLICATIONNUMBER"
  ],
  dob: [
    "DOB","DATEOFBIRTH","BIRTHDATE"
  ],
  gender: [
    "GENDER","SEX"
  ],
  category: [
    "CATEGORY","CAT","CASTE"
  ],
  horizontalCategory: [
    "HCAT","HORIZONTALCATEGORY"
  ],
  femaleCategory: [
    "FCAT","FEMALECATEGORY"
  ],
  tsp: [
    "TSP","NONTSP","AREA"
  ],
  netMarks: [
    "NET","NETMARKS","MARKS",
    "SCORE","TOTALMARKS","OBTAINEDMARKS"
  ],
  rank: [
    "RANK","OVERALLRANK","MERITRANK"
  ],
  selectionCategory: [
    "SELCAT","SELECTIONCATEGORY"
  ]
};

// ── Header Normalizer ────────────────────────────────────────
function normalizeHeader(h) {
  return String(h)
    .trim()
    .toUpperCase()
    .replace(/\r/g, "")
    .replace(/\n/g, "")
    .replace(/\s+/g, "")
    .replace(/_/g, "")
    .replace(/-/g, "")
    .replace(/\./g, "")
    .replace(/\(/g, "")
    .replace(/\)/g, "");
}

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
let pendingDeleteId   = null;
let pendingRenameId   = null;
let pendingReplaceId  = null;
let pendingReplaceName= null;

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

// ── Excel Parsing ────────────────────────────────────────────
// Dynamically detects columns using FIELD_MAP aliases.
// Header order, header names, and sheet names do not matter.
// Extra columns are ignored. Missing columns return "".
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

        // Read header row from Sheet 1 to build column index map
        const firstSheet = workbook.Sheets[sheets[0]];
        const firstRows  = XLSX.utils.sheet_to_json(firstSheet, {
          header: 1,
          defval: ''
        });

        if (!firstRows.length) {
          return reject(new Error('Sheet 1 is empty. Cannot read headers.'));
        }

        // Normalize every header and map to its column index
        const col = {};
        firstRows[0].forEach((h, i) => {
          const key = normalizeHeader(h);
          if (key) col[key] = i;
        });

        // Find a column index by trying each alias in order
        function findColumn(aliases) {
          for (const alias of aliases) {
            const key = normalizeHeader(alias);
            if (col[key] !== undefined) return col[key];
          }
          return -1;
        }

        // Get the string value for a field from a data row
        function getValue(row, aliases) {
          const index = findColumn(aliases);
          if (index === -1) return '';
          return String(row[index] ?? '').trim();
        }

        // Build one student object from a data row
        function buildStudent(row) {
          // Skip completely blank rows
          if (!row || row.every(c => String(c).trim() === '')) return null;

          const rollNo      = getValue(row, FIELD_MAP.rollNo);
          const name        = getValue(row, FIELD_MAP.name);
          const fatherName  = getValue(row, FIELD_MAP.fatherName);
          const motherName  = getValue(row, FIELD_MAP.motherName);

          // Skip rows with no roll number and no name
          if (!rollNo && !name) return null;

          return {
            rank:               getValue(row, FIELD_MAP.rank),
            applicationNo:      getValue(row, FIELD_MAP.applicationNo),
            rollNo,
            name,
            fatherName,
            motherName,
            dob:                getValue(row, FIELD_MAP.dob),
            gender:             getValue(row, FIELD_MAP.gender),
            category:           getValue(row, FIELD_MAP.category),
            horizontalCategory: getValue(row, FIELD_MAP.horizontalCategory),
            femaleCategory:     getValue(row, FIELD_MAP.femaleCategory),
            tsp:                getValue(row, FIELD_MAP.tsp),
            netMarks:           getValue(row, FIELD_MAP.netMarks),
            selectionCategory:  getValue(row, FIELD_MAP.selectionCategory),
            // Lowercase search fields
            searchRoll:   rollNo.toLowerCase(),
            searchName:   name.toLowerCase(),
            searchFather: fatherName.toLowerCase(),
            searchMother: motherName.toLowerCase()
          };
        }

        const students = [];

        // Sheet 1: skip row 0 (header), parse from row 1 onwards
        for (let r = 1; r < firstRows.length; r++) {
          const student = buildStudent(firstRows[r]);
          if (student) students.push(student);
        }

        // Remaining sheets: all rows are data (header was only in Sheet 1)
        for (let s = 1; s < sheets.length; s++) {
          const ws   = workbook.Sheets[sheets[s]];
          const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
          for (let r = 0; r < rows.length; r++) {
            const student = buildStudent(rows[r]);
            if (student) students.push(student);
          }
        }

        if (!students.length) {
          return reject(new Error('No student records found in the Excel file.'));
        }

        resolve(students);

      } catch (err) {
        reject(err);
      }
    };

    reader.readAsArrayBuffer(file);
  });
}

// ── Firestore: Batch write students ─────────────────────────
async function batchWriteStudents(students, examId, examName, onProgress) {
  const total  = students.length;
  let written  = 0;

  for (let i = 0; i < total; i += BATCH_SIZE) {
    const chunk = students.slice(i, i + BATCH_SIZE);
    const batch = writeBatch(db);

    chunk.forEach(student => {
      const ref = doc(collection(db, STUDENTS_COL));
      batch.set(ref, {
        examId,
        examName,
        ...student,
        createdAt: serverTimestamp()
      });
    });

    await batch.commit();
    written += chunk.length;

    const pct = Math.round((written / total) * 100);
    onProgress(pct, written, total);
  }
}

// ── Firestore: Delete all students of an exam ────────────────
async function deleteAllStudents(examId, onProgress) {
  const q      = query(collection(db, STUDENTS_COL), where('examId', '==', examId));
  const snap   = await getDocs(q);
  const docs   = snap.docs;
  const total  = docs.length;
  let deleted  = 0;

  for (let i = 0; i < total; i += BATCH_SIZE) {
    const chunk = docs.slice(i, i + BATCH_SIZE);
    const batch = writeBatch(db);
    chunk.forEach(d => batch.delete(d.ref));
    await batch.commit();
    deleted += chunk.length;
    if (onProgress) {
      const pct = Math.round((deleted / total) * 100);
      onProgress(pct, deleted, total);
    }
  }
}

// ── Firestore: Batch update examName in students ─────────────
async function updateStudentsExamName(examId, newName) {
  const q    = query(collection(db, STUDENTS_COL), where('examId', '==', examId));
  const snap = await getDocs(q);
  const docs = snap.docs;

  for (let i = 0; i < docs.length; i += BATCH_SIZE) {
    const chunk = docs.slice(i, i + BATCH_SIZE);
    const batch = writeBatch(db);
    chunk.forEach(d => batch.update(d.ref, { examName: newName }));
    await batch.commit();
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

// ── File input display update ────────────────────────────────
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

// ── IMPORT ───────────────────────────────────────────────────
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

    const examId = examRef.id;

    await batchWriteStudents(students, examId, examName, (pct, written, total) => {
      const displayPct = 5 + Math.round(pct * 0.95);
      importProgressBar.style.width = displayPct + '%';
      importProgressLabel.textContent = `Writing… ${written.toLocaleString('en-IN')} / ${total.toLocaleString('en-IN')} students`;
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
  } finally {
    importBtn.disabled = false;
    importBtn.textContent = 'Import Results';
    setTimeout(() => {
      importProgressWrap.classList.add('hidden');
      importProgressBar.style.width = '0%';
    }, 2000);
  }
});

// ── DELETE ───────────────────────────────────────────────────
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

// ── RENAME ───────────────────────────────────────────────────
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

// ── REPLACE ──────────────────────────────────────────────────
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
    replaceProgressLabel.textContent = `Parsed ${students.length.toLocaleString('en-IN')} students. Deleting old records…`;
    replaceProgressBar.style.width = '5%';

    await deleteAllStudents(pendingReplaceId, (pct) => {
      const displayPct = 5 + Math.round(pct * 0.3);
      replaceProgressBar.style.width = displayPct + '%';
      replaceProgressLabel.textContent = `Deleting old records… ${displayPct}%`;
    });

    replaceProgressBar.style.width = '35%';
    replaceProgressLabel.textContent = 'Writing new records…';

    await batchWriteStudents(students, pendingReplaceId, pendingReplaceName, (pct, written, total) => {
      const displayPct = 35 + Math.round(pct * 0.6);
      replaceProgressBar.style.width = displayPct + '%';
      replaceProgressLabel.textContent = `Writing… ${written.toLocaleString('en-IN')} / ${total.toLocaleString('en-IN')}`;
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
