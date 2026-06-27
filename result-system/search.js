// search.js — Marudhara Exam Result Search System
// ES6 Module — imports from existing firebase.js

import {
  db,
  collection,
  getDocs,
  query,
  where,
  orderBy,
  limit
} from './firebase.js';

// ── Constants ────────────────────────────────────────────────
const RESULTS_COL  = 'results';
const STUDENTS_COL = 'resultStudents';
const MAX_RESULTS  = 100;

// ── DOM References ───────────────────────────────────────────
const examSelect      = document.getElementById('exam-select');
const searchField     = document.getElementById('search-field');
const searchInput     = document.getElementById('search-input');
const searchBtn       = document.getElementById('search-btn');
const searchAlert     = document.getElementById('search-alert');
const examLoadAlert   = document.getElementById('exam-load-alert');
const resultsSection  = document.getElementById('results-section');
const resultsTbody    = document.getElementById('results-tbody');
const resultsCount    = document.getElementById('results-count');

// Result card modal
const resultModal         = document.getElementById('result-modal');
const resultModalClose    = document.getElementById('result-modal-close');
const resultModalCloseBtn = document.getElementById('result-modal-close-btn');
const downloadPngBtn      = document.getElementById('download-png-btn');

// Result card fields
const rcExamName  = document.getElementById('rc-exam-name');
const rcRank      = document.getElementById('rc-rank');
const rcRoll      = document.getElementById('rc-roll');
const rcApp       = document.getElementById('rc-app');
const rcName      = document.getElementById('rc-name');
const rcFather    = document.getElementById('rc-father');
const rcMother    = document.getElementById('rc-mother');
const rcDob       = document.getElementById('rc-dob');
const rcGender    = document.getElementById('rc-gender');
const rcCategory  = document.getElementById('rc-category');
const rcHcat      = document.getElementById('rc-hcat');
const rcFcat      = document.getElementById('rc-fcat');
const rcTsp       = document.getElementById('rc-tsp');
const rcNet       = document.getElementById('rc-net');
const rcSelcat    = document.getElementById('rc-selcat');

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

// ── Utility: Search Alert ────────────────────────────────────
function showSearchAlert(message, type = 'info') {
  searchAlert.className = `alert alert-${type}`;
  searchAlert.textContent = message;
  searchAlert.classList.remove('hidden');
}

function hideSearchAlert() {
  searchAlert.classList.add('hidden');
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

resultModalClose.addEventListener('click', () => closeModal(resultModal));
resultModalCloseBtn.addEventListener('click', () => closeModal(resultModal));
resultModal.addEventListener('click', e => {
  if (e.target === resultModal) closeModal(resultModal);
});

// ── Utility: Safe value display ──────────────────────────────
function disp(val) {
  if (val === null || val === undefined || String(val).trim() === '') return '—';
  return String(val).trim();
}

// ── Utility: Escape HTML ─────────────────────────────────────
function escHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ── Load Exams into Dropdown ─────────────────────────────────
async function loadExams() {
  examLoadAlert.classList.remove('hidden');
  examSelect.disabled = true;

  try {
    const q    = query(collection(db, RESULTS_COL), orderBy('createdAt', 'desc'));
    const snap = await getDocs(q);

    // Clear existing options except placeholder
    examSelect.innerHTML = '<option value="">— Select Exam —</option>';

    snap.forEach(docSnap => {
      const d      = docSnap.data();
      const option = document.createElement('option');
      option.value       = docSnap.id;
      option.textContent = d.examName;
      option.setAttribute('data-name', d.examName);
      examSelect.appendChild(option);
    });

    if (snap.empty) {
      examLoadAlert.className = 'alert alert-warning';
      examLoadAlert.textContent = 'No exams available. Please ask the admin to upload results.';
      examLoadAlert.classList.remove('hidden');
    } else {
      examLoadAlert.classList.add('hidden');
    }

  } catch (err) {
    examLoadAlert.className = 'alert alert-danger';
    examLoadAlert.textContent = 'Failed to load exams: ' + err.message;
    examLoadAlert.classList.remove('hidden');
  } finally {
    examSelect.disabled = false;
  }
}

// ── Search ───────────────────────────────────────────────────
async function doSearch() {
  hideSearchAlert();
  resultsSection.classList.remove('visible');

  const examId    = examSelect.value.trim();
  const field     = searchField.value;
  const rawValue  = searchInput.value.trim();

  // Validation
  if (!examId) {
    showSearchAlert('Please select an exam first.', 'danger');
    examSelect.focus();
    return;
  }
  if (!rawValue) {
    showSearchAlert('Please enter a search value.', 'danger');
    searchInput.focus();
    return;
  }

  // Search value is always lowercased (matches stored search fields)
  const searchValue = rawValue.toLowerCase();

  searchBtn.disabled = true;
  searchBtn.textContent = 'Searching…';

  try {
    let snap;

    if (field === 'searchRoll') {
      // Exact match on roll number
      const q = query(
        collection(db, STUDENTS_COL),
        where('examId',    '==', examId),
        where('searchRoll','==', searchValue),
        limit(MAX_RESULTS)
      );
      snap = await getDocs(q);
    } else {
      // Prefix search using >= and <= range on lowercase name fields
      const q = query(
        collection(db, STUDENTS_COL),
        where('examId', '==', examId),
        where(field,    '>=', searchValue),
        where(field,    '<=', searchValue + '\uf8ff'),
        orderBy(field),
        limit(MAX_RESULTS)
      );
      snap = await getDocs(q);
    }

    if (snap.empty) {
      showSearchAlert('No results found. Please check your search value and try again.', 'warning');
      return;
    }

    // Render results
    renderResults(snap);

  } catch (err) {
    // Firestore composite index error — friendly message
    if (err.code === 'failed-precondition' || (err.message && err.message.includes('index'))) {
      showSearchAlert(
        'A Firestore index is required for this search. Please check the browser console for the index creation link, click it, wait a minute, then try again.',
        'danger'
      );
      console.error('Firestore index error:', err);
    } else {
      showSearchAlert('Search failed: ' + err.message, 'danger');
    }
  } finally {
    searchBtn.disabled = false;
    searchBtn.textContent = 'Search';
  }
}

// ── Render Results Table ─────────────────────────────────────
function renderResults(snap) {
  const count = snap.size;
  resultsCount.innerHTML = `Showing <strong>${count}</strong> result${count !== 1 ? 's' : ''}`;

  let html = '';
  let idx  = 1;

  snap.forEach(docSnap => {
    const d = docSnap.data();
    html += `
      <tr>
        <td>${idx++}</td>
        <td>${escHtml(disp(d.examName))}</td>
        <td><span class="rank-badge">${escHtml(disp(d.rank))}</span></td>
        <td>${escHtml(disp(d.rollNo))}</td>
        <td><strong>${escHtml(disp(d.name))}</strong></td>
        <td>${escHtml(disp(d.fatherName))}</td>
        <td>${escHtml(disp(d.category))}</td>
        <td>${escHtml(disp(d.netMarks))}</td>
        <td>
          <button
            class="btn btn-sm btn-primary"
            onclick='viewResult(${JSON.stringify(JSON.stringify(d))})'
          >View Result</button>
        </td>
      </tr>`;
  });

  resultsTbody.innerHTML = html;
  resultsSection.classList.add('visible');
  resultsSection.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

// ── View Result Card ─────────────────────────────────────────
window.viewResult = function(jsonStr) {
  const d = JSON.parse(jsonStr);

  rcExamName.textContent = disp(d.examName);
  rcRank.textContent     = disp(d.rank);
  rcRoll.textContent     = disp(d.rollNo);
  rcApp.textContent      = disp(d.applicationNo);
  rcName.textContent     = disp(d.name);
  rcFather.textContent   = disp(d.fatherName);
  rcMother.textContent   = disp(d.motherName);
  rcDob.textContent      = disp(d.dob);
  rcGender.textContent   = disp(d.gender);
  rcCategory.textContent = disp(d.category);
  rcHcat.textContent     = disp(d.horizontalCategory);
  rcFcat.textContent     = disp(d.femaleCategory);
  rcTsp.textContent      = disp(d.tsp);
  rcNet.textContent      = disp(d.netMarks);
  rcSelcat.textContent   = disp(d.selectionCategory);

  openModal(resultModal);
};

// ── Download PNG ─────────────────────────────────────────────
downloadPngBtn.addEventListener('click', async () => {
  const card = document.getElementById('result-card');

  downloadPngBtn.disabled = true;
  downloadPngBtn.textContent = 'Generating…';

  try {
    const canvas = await html2canvas(card, {
      scale:           2,          // high resolution
      useCORS:         true,
      backgroundColor: '#ffffff',
      logging:         false,
      windowWidth:     card.scrollWidth  + 40,
      windowHeight:    card.scrollHeight + 40
    });

    // Build filename from candidate name + roll number
    const name = rcName.textContent.replace(/[^a-zA-Z0-9]/g, '_').substring(0, 30);
    const roll = rcRoll.textContent.replace(/[^a-zA-Z0-9]/g, '_').substring(0, 20);
    const filename = `Result_${name}_${roll}.png`;

    // Trigger download
    const link = document.createElement('a');
    link.download = filename;
    link.href = canvas.toDataURL('image/png');
    link.click();

    showToast('Result card downloaded!', 'success');
  } catch (err) {
    showToast('PNG generation failed: ' + err.message, 'danger');
  } finally {
    downloadPngBtn.disabled = false;
    downloadPngBtn.textContent = 'Download as PNG';
  }
});

// ── Search button & Enter key ────────────────────────────────
searchBtn.addEventListener('click', doSearch);

searchInput.addEventListener('keydown', e => {
  if (e.key === 'Enter') doSearch();
});

// Reset results when exam changes
examSelect.addEventListener('change', () => {
  resultsSection.classList.remove('visible');
  resultsTbody.innerHTML = '';
  hideSearchAlert();
  searchInput.value = '';
});

// Reset results when search field changes
searchField.addEventListener('change', () => {
  resultsSection.classList.remove('visible');
  resultsTbody.innerHTML = '';
  hideSearchAlert();
  searchInput.value = '';
  // Update placeholder
  const placeholders = {
    searchRoll:   'Enter roll number…',
    searchName:   'Enter candidate name…',
    searchFather: 'Enter father name…',
    searchMother: 'Enter mother name…'
  };
  searchInput.placeholder = placeholders[searchField.value] || 'Enter value to search…';
});

// ── Init ─────────────────────────────────────────────────────
loadExams();
