// search.js — Marudhara Exam Result Search System
// ES6 Module — imports from existing firebase.js

import {
  db,
  collection,
  getDocs,
  query,
  orderBy
} from './firebase.js';

// ── Search Engine (inlined — no external search module required) ─────────────

// Deterministic 2-digit bucket (mirrors generator.js)
function getRollBucket(roll) {
  let hash = 0;
  const clean = String(roll || '').trim().toLowerCase();
  for (let i = 0; i < clean.length; i++) {
    hash = (hash * 31 + clean.charCodeAt(i)) % 100;
  }
  return String(Math.abs(hash)).padStart(2, '0');
}

// 2-letter prefix extraction (mirrors generator.js)
function getNamePrefixes(nameStr) {
  const clean = String(nameStr || '').trim().toLowerCase().replace(/[^a-z0-9\s]/g, '');
  const words = clean.split(/\s+/).filter(w => w.length > 0);
  const prefixes = new Set();
  for (const w of words) {
    prefixes.add(w.length === 1 ? w + '_' : w.slice(0, 2));
  }
  if (prefixes.size === 0) prefixes.add('__');
  return Array.from(prefixes);
}

/**
 * loadShardJson — loads a single shard JSON file.
 * Checks the in-memory preview cache first, then fetches from the static server.
 * @param  {string}       path - e.g. "results/roll/05.json"
 * @returns {Promise<any>}       Parsed JSON or null if shard does not exist
 */
async function loadShardJson(path) {
  // 1. In-memory preview (immediately after admin generates, before GitHub deploy)
  if (typeof window !== 'undefined' && window.__VIRTUAL_SHARDS__) {
    const cached = window.__VIRTUAL_SHARDS__[path];
    if (cached !== undefined) {
      try {
        return typeof cached === 'string' ? JSON.parse(cached) : cached;
      } catch (e) {
        console.warn('[search.js] Virtual cache parse error:', e);
      }
    }
  }

  // 2. Static file fetch from GitHub-hosted /results/ directory
  try {
   const currentResultFolder =
  examSelect?.options[examSelect.selectedIndex]?.dataset?.folder || "";

const response = await fetch(`./Results/${currentResultFolder}/results/${path}`);
    if (!response.ok) {
      if (response.status === 404) return null; // Shard absent — no records in this bucket
      throw new Error(`HTTP ${response.status}: Failed to load ${path}`);
    }
    return await response.json();
  } catch (err) {
    console.error(`[search.js] Error loading shard [${path}]:`, err);
    return null;
  }
}

/**
 * searchByRoll — Exact Roll Number lookup — O(1) shard access.
 * @param  {string|number} rollNo
 * @returns {Promise<Object|null>} Full student result object or null
 */
async function searchByRoll(rollNo) {
  const cleanRoll = String(rollNo || '').trim();
  if (!cleanRoll) return null;

  const bucket     = getRollBucket(cleanRoll);
  const bucketData = await loadShardJson(`roll/${bucket}.json`);
  if (!bucketData) return null;

  // Exact key match first (fast path)
  if (bucketData[cleanRoll]) return bucketData[cleanRoll];

  // Case-insensitive fallback (handles ROLL-001 vs roll-001 etc.)
  const target = cleanRoll.toLowerCase();
  for (const [key, student] of Object.entries(bucketData)) {
    if (key.toLowerCase() === target) return student;
  }

  return null;
}

/**
 * searchByName — Candidate Name prefix search.
 * Returns lightweight index records; fetchFull() resolves the full result card.
 * @param  {string}        candidateName
 * @returns {Promise<Array>} Array of { r, n, f, c, res } index records
 */
async function searchByName(candidateName) {
  const cleanQuery = String(candidateName || '').trim().toLowerCase();
  if (!cleanQuery) return [];

  const primaryPrefix = getNamePrefixes(cleanQuery)[0] || '__';
  const indexList     = await loadShardJson(`results/name/${primaryPrefix}.json`);
  if (!indexList || !Array.isArray(indexList)) return [];

  // Substring filter so partial-name queries work ("Aara" matches "Aarav Sharma")
  return indexList.filter(item =>
    String(item.n || '').toLowerCase().includes(cleanQuery)
  );
}

/**
 * searchByFather — Father Name prefix search — same algorithm as searchByName.
 * @param  {string}        fatherName
 * @returns {Promise<Array>} Array of { r, n, f, c, res } index records
 */
async function searchByFather(fatherName) {
  const cleanQuery = String(fatherName || '').trim().toLowerCase();
  if (!cleanQuery) return [];

  const primaryPrefix = getNamePrefixes(cleanQuery)[0] || '__';
  const indexList     = await loadShardJson(`results/father/${primaryPrefix}.json`);
  if (!indexList || !Array.isArray(indexList)) return [];

  return indexList.filter(item =>
    String(item.f || '').toLowerCase().includes(cleanQuery)
  );
}

// ── Constants ────────────────────────────────────────────────
const RESULTS_COL = 'results';
const MAX_RESULTS = 100;

// ── DOM References ───────────────────────────────────────────
const examSelect      = document.getElementById('exam-select');
const rollInput       = document.getElementById('roll-input');
const nameInput       = document.getElementById('name-input');
const fatherInput     = document.getElementById('father-input');
const motherInput     = document.getElementById('mother-input');
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
// Exam list is still managed via Firestore (admin creates/renames/deletes exams there).
// Only student record lookups have moved to static JSON shards.
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
      option.dataset.folder = d.examName;
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
    console.error(err);
    examLoadAlert.classList.remove('hidden');
  } finally {
    examSelect.disabled = false;
  }
}

// ── Internal: build a snap-compatible object from a plain array ──────────────
// renderResults() expects { size, empty, forEach(docSnap => docSnap.data()) }.
// This adapter wraps a plain array of student objects into that shape.
function makeSnap(studentArray) {
  return {
    size:    studentArray.length,
    empty:   studentArray.length === 0,
    forEach: (cb) => studentArray.forEach(student => cb({ data: () => student }))
  };
}

// ── Internal: resolve full student record from roll shard and attach examName ─
// searchByRoll returns the raw stored object. We attach examName so the
// existing renderResults / viewResult code finds d.examName unchanged.
async function fetchFull(rollNo, examName) {
  const student = await searchByRoll(rollNo);
  if (!student) return null;
  // Attach examName so existing renderResults / viewResult display it correctly
  return { ...student, examName };
}

// ── Search ───────────────────────────────────────────────────
async function doSearch() {
  hideSearchAlert();
  resultsSection.classList.remove('visible');

  const examId      = examSelect.value.trim();
  const rollValue   = rollInput.value.trim().toLowerCase();
  const nameValue   = nameInput.value.trim().toLowerCase();
  const fatherValue = fatherInput.value.trim().toLowerCase();
  const motherValue = motherInput.value.trim().toLowerCase();

  // Validation
  if (!examId) {
    showSearchAlert('Please select an exam first.', 'danger');
    examSelect.focus();
    return;
  }
  // Roll Number OR Candidate Name required
  if (!rollValue && !nameValue) {
    showSearchAlert(
      'Please enter Roll Number OR Candidate Name.',
      'danger'
    );
    rollInput.focus();
    return;
  }

  // Read the human-readable exam name from the selected <option data-name="…">
  const selectedOption = examSelect.options[examSelect.selectedIndex];
  const examName = selectedOption ? (selectedOption.getAttribute('data-name') || selectedOption.textContent || '') : '';

  searchBtn.disabled = true;
  searchBtn.textContent = 'Searching…';

  try {
    let students = [];

    if (rollValue) {
      // ── Roll Number search: O(1) exact shard lookup ──────────────────────
      const found = await fetchFull(rollValue, examName);
      if (found) {
        students = [found];
      }

    } else {
      // ── Candidate Name search: prefix shard → index records ──────────────
      let indexRecords = await searchByName(nameValue);

      // If father name is also supplied, narrow index results before fetching
      // full records (index records carry the 'f' field for this purpose)
      if (fatherValue) {
        indexRecords = indexRecords.filter(item =>
          String(item.f || '').toLowerCase().startsWith(fatherValue)
        );
      }

      // Respect MAX_RESULTS cap before issuing per-record shard fetches
      const capped = indexRecords.slice(0, MAX_RESULTS);

      // Fetch full student records in parallel (each hits one roll shard)
      const settled = await Promise.all(
        capped.map(item => fetchFull(item.r, examName))
      );

      // Drop any nulls (shard miss — should not happen in a healthy database)
      students = settled.filter(Boolean);

      // Mother name filter: mother is not in the index, but IS in the full record
      if (motherValue) {
        students = students.filter(s =>
          String(s.searchMother || s.motherName || '').toLowerCase().startsWith(motherValue)
        );
      }
    }

    if (students.length === 0) {
      showSearchAlert('No results found. Please check your search value and try again.', 'warning');
      return;
    }

    renderResults(makeSnap(students));

  } catch (err) {
    showSearchAlert('Search failed: ' + err.message, 'danger');
    console.error('Search error:', err);
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

rollInput.addEventListener('keydown', e => {
  if (e.key === 'Enter') doSearch();
});

nameInput.addEventListener('keydown', e => {
  if (e.key === 'Enter') doSearch();
});

fatherInput.addEventListener('keydown', e => {
  if (e.key === 'Enter') doSearch();
});

motherInput.addEventListener('keydown', e => {
  if (e.key === 'Enter') doSearch();
});

// Reset results when exam changes
examSelect.addEventListener('change', () => {
  resultsSection.classList.remove('visible');
  resultsTbody.innerHTML = '';
  hideSearchAlert();
  rollInput.value   = '';
  nameInput.value   = '';
  fatherInput.value = '';
  motherInput.value = '';
});

// Reset results when search field changes
rollInput.addEventListener('input', () => {
  if (rollInput.value.trim()) {
    nameInput.disabled   = true;
    fatherInput.disabled = true;
    motherInput.disabled = true;
  } else {
    nameInput.disabled   = false;
    fatherInput.disabled = false;
    motherInput.disabled = false;
  }
});

nameInput.addEventListener('input', () => {
  if (nameInput.value.trim()) {
    rollInput.disabled = true;
  } else {
    rollInput.disabled = false;
  }
});

// ── Init ─────────────────────────────────────────────────────
loadExams();
