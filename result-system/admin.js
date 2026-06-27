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
} from './firebase.js';

// ── Constants ────────────────────────────────────────────────
const RESULTS_COL       = 'results';
const STUDENTS_COL      = 'resultStudents';
const BATCH_SIZE        = 500;

// Header name → Firestore field mapping
const HEADER_MAP = {
  SLNO:        'slno',
  RANK:        'rank',
  APPLICATION: 'applicationNo',
  ROLL_NO:     'rollNo',
  CAND_NAME:   'name',
  FATHER_NAME: 'fatherName',
  MOTHER_NAME: 'motherName',
  DOB:         'dob',
  GENDER:      'gender',
  CAT:         'category',
  HCAT:        'horizontalCategory',
  FCAT:        'femaleCategory',
  TSP:         'tsp',
  NET:         'netMarks',
  Sel_Cat:     'selectionCategory'
};

// ── DOM References ───────────────────────────────────────────
const examNameInput      = document.getElementById('exam-name-input');
const excelFileInput     = document.getElementById('excel-file-input');
const fileDisplay        = document.getElementById('file-display');
const fileDisplayText    = document.getElementById('file-display-text');
const importBtn          = document.getElementById('import-btn');
const importProgressWrap = document.getElementById('import-progress-wrap');
const importProgressBar  = document.getElementById('import-progress-bar');
const importProgressLabel= document.getElementById('import-progress-label');
const globalAlert        = document.getElementById('global-alert');
const globalAlertText    = document.getElementById('global-alert-text');
const uploadSummary      = document.getElementById('upload-summary');
const sumExamName        = document.getElementById('sum-exam-name');
const sumFileName        = document.getElementById('sum-file-name');
const sumCount           = document.getElementById('sum-count');
const sumDate            = document.getElementById('sum-date');
const examsLoading       = document.getElementById('exams-loading');
const examsTableWrap     = document.getElementById('exams-table-wrap');
const examsTbody         = document.getElementById('exams-tbody');

// Delete modal
const deleteModal        = document.getElementById('delete-modal');
const deleteConfirmText  = document.getElementById('delete-confirm-text');
const deleteConfirmBtn   = document.getElementById('delete-confirm-btn');

// Rename modal
const renameModal        = document.getElementById('rename-modal');
const renameInput        = document.getElementById('rename-input');
const renameConfirmBtn   = document.getElementById('rename-confirm-btn');

// Replace modal
const replaceModal            = document.getElementById('replace-modal');
const replaceExamNameDisplay  = document.getElementById('replace-exam-name-display');
const replaceFileInput        = document.getElementById('replace-file-input');
const replaceFileDisplay      = document.getElementById('replace-file-display');
const replaceFileDisplayText  = document.getElementById('replace-file-display-text');
const replaceConfirmBtn       = document.getElementById('replace-confirm-btn');
const replaceProgressWrap     = document.getElementById('replace-progress-wrap');
const replaceProgressBar      = document.getElementById('replace-progress-bar');
const replaceProgressLabel    = document.getElementById('replace-progress-label');

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

// ── Excel Parsing ────────────────────────────────────────────
// Returns array of student objects using dynamic header mapping from Sheet-1
function parseExcel(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = e => {
      try {
        const data   = new Uint8Array(e.target.result);
        const wb     = XLSX.read(data, { type: 'array', cellDates: true });
        const sheets = wb.SheetNames;

        if (!sheets.length) {
          return reject(new Error('Excel file has no sheets.'));
        }

        // ── Read header from Sheet-1 ─────────────────────────
        const sheet1    = wb.Sheets[sheets[0]];
        const sheet1Rows = XLSX.utils.sheet_to_json(sheet1, { header: 1, defval: '' });

        if (!sheet1Rows.length) {
          return reject(new Error('Sheet 1 is empty. Cannot read headers.'));
        }

        // First row of Sheet-1 = headers
        const headerRow = sheet1Rows[0].map(h => safe(h));

        // Build column index map: { HEADER_NAME: colIndex }
        const colIndex = {};
        headerRow.forEach((h, i) => {
          if (h && HEADER_MAP[h] !== undefined) {
            colIndex[h] = i;
          }
        });

        // Validate required headers
        const required = ['ROLL_NO', 'CAND_NAME', 'RANK'];
        const missing  = required.filter(h => colIndex[h] === undefined);
        if (missing.length) {
          return reject(new Error(`Missing required headers in Sheet 1: ${missing.join(', ')}`));
        }

        // ── Collect all student rows ─────────────────────────
        const students = [];

        // Sheet-1: data starts from row index 1 (skip header row 0)
        for (let r = 1; r < sheet1Rows.length; r++) {
          const row = sheet1Rows[r];
          const student = buildStudentFromRow(row, colIndex);
          if (student) students.push(student);
        }

        // Remaining sheets: all rows are data (no header)
        for (let s = 1; s < sheets.length; s++) {
          const sheet   = wb.Sheets[sheets[s]];
          const rows    = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });
          for (let r = 0; r < rows.length; r++) {
            const row = rows[r];
            const student = buildStudentFromRow(row, colIndex);
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
    reader.onerror = () => reject(new Error('Failed to read file.'));
    reader.readAsArrayBuffer(file);
  });
}

// Build a student object from a data row using the colIndex map
function buildStudentFromRow(row, colIndex) {
  // Skip completely empty rows
  if (!row || row.every(cell => safe(cell) === '')) return null;

  const get = headerName => {
    const idx = colIndex[headerName];
    return idx !== undefined ? safe(row[idx]) : '';
  };

  const rollNo     = get('ROLL_NO');
  const name       = get('CAND_NAME');

  // Skip rows with no roll number and no name
  if (!rollNo && !name) return null;

  return {
    rank:               get('RANK'),
    applicationNo:      get('APPLICATION'),
    rollNo:             rollNo,
    name:               name,
    fatherName:         get('FATHER_NAME'),
    motherName:         get('MOTHER_NAME'),
    dob:                get('DOB'),
    gender:             get('GENDER'),
    category:           get('CAT'),
    horizontalCategory: get('HCAT'),
    femaleCategory:     get('FCAT'),
    tsp:                get('TSP'),
    netMarks:           get('NET'),
    selectionCategory:  get('Sel_Cat'),
    // Search fields (lowercase)
    searchRoll:         rollNo.toLowerCase(),
    searchName:         name.toLowerCase(),
    searchFather:       get('FATHER_NAME').toLowerCase(),
    searchMother:       get('MOTHER_NAME').toLowerCase()
  };
}

// ── Firestore: Batch write students ─────────────────────────
async function batchWriteStudents(students, examId, examName, onProgress) {
  const total   = students.length;
  let written   = 0;

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
  const q       = query(collection(db, STUDENTS_COL), where('examId', '==', examId));
  const snap    = await getDocs(q);
  const docs    = snap.docs;
  const total   = docs.length;
  let deleted   = 0;

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
      const d   = docSnap.data();
      const id  = docSnap.id;
      const dt  = formatDate(d.createdAt);
      html += `
        <tr data-id="${id}">
          <td>${idx++}</td>
          <td><strong>${escHtml(d.examName)}</strong></td>
          <td>${Number(d.studentsCount).toLocaleString('en-IN')}</td>
          <td>${dt}</td>
          <td>
            <div class="table-actions">
              <button class="btn btn-sm btn-outline"   onclick="handleReplace('${id}','${escAttr(d.examName)}')">Replace</button>
              <button class="btn btn-sm btn-primary"   onclick="handleRename('${id}','${escAttr(d.examName)}')">Rename</button>
              <button class="btn btn-sm btn-danger"    onclick="handleDelete('${id}','${escAttr(d.examName)}')">Delete</button>
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

// ── Escape helpers ───────────────────────────────────────────
function escHtml(str) {
  return String(str)
    .replace(/&/g,'&amp;')
    .replace(/</g,'&lt;')
    .replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;');
}
function escAttr(str) {
  return String(str).replace(/'/g, "\\'").replace(/"/g, '&quot;');
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

  // Disable UI
  importBtn.disabled = true;
  importBtn.textContent = 'Importing…';
  importProgressWrap.classList.remove('hidden');
  importProgressBar.style.width = '0%';
  importProgressLabel.textContent = 'Reading Excel file…';
  uploadSummary.classList.remove('visible');

  try {
    // Parse Excel
    const students = await parseExcel(file);
    importProgressLabel.textContent = `Parsed ${students.length.toLocaleString('en-IN')} students. Writing to database…`;
    importProgressBar.style.width = '5%';

    // Write exam doc
    const examRef = await addDoc(collection(db, RESULTS_COL), {
      examName,
      fileName:      file.name,
      studentsCount: students.length,
      createdAt:     serverTimestamp()
    });

    const examId = examRef.id;

    // Batch write students
    await batchWriteStudents(students, examId, examName, (pct, written, total) => {
      // Reserve first 5% for parsing, remaining 95% for upload
      const displayPct = 5 + Math.round(pct * 0.95);
      importProgressBar.style.width = displayPct + '%';
      importProgressLabel.textContent = `Writing… ${written.toLocaleString('en-IN')} / ${total.toLocaleString('en-IN')} students`;
    });

    importProgressBar.style.width = '100%';
    importProgressLabel.textContent = 'Done!';

    // Show summary
    const now = new Date();
    sumExamName.textContent = examName;
    sumFileName.textContent = file.name;
    sumCount.textContent    = students.length.toLocaleString('en-IN');
    sumDate.textContent     = now.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
    uploadSummary.classList.add('visible');
    uploadSummary.scrollIntoView({ behavior: 'smooth', block: 'nearest' });

    showToast('Import successful!', 'success');

    // Reset form
    examNameInput.value = '';
    excelFileInput.value = '';
    fileDisplayText.textContent = 'Click to choose Excel file';
    fileDisplay.classList.remove('has-file');

    // Reload exams list
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
    // Delete all students
    await deleteAllStudents(pendingDeleteId);
    // Delete exam doc
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
    // Update exam doc
    await updateDoc(doc(db, RESULTS_COL, pendingRenameId), { examName: newName });
    // Update all student docs
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

// Enter key in rename input
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
    // Parse new Excel
    const students = await parseExcel(file);
    replaceProgressLabel.textContent = `Parsed ${students.length.toLocaleString('en-IN')} students. Deleting old records…`;
    replaceProgressBar.style.width = '5%';

    // Delete old students
    await deleteAllStudents(pendingReplaceId, (pct) => {
      const displayPct = 5 + Math.round(pct * 0.3);
      replaceProgressBar.style.width = displayPct + '%';
      replaceProgressLabel.textContent = `Deleting old records… ${displayPct}%`;
    });

    replaceProgressBar.style.width = '35%';
    replaceProgressLabel.textContent = 'Writing new records…';

    // Write new students
    await batchWriteStudents(students, pendingReplaceId, pendingReplaceName, (pct, written, total) => {
      const displayPct = 35 + Math.round(pct * 0.6);
      replaceProgressBar.style.width = displayPct + '%';
      replaceProgressLabel.textContent = `Writing… ${written.toLocaleString('en-IN')} / ${total.toLocaleString('en-IN')}`;
    });

    // Update exam doc
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
