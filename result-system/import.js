import {
  db,
  collection,
  doc,
  setDoc,
  getDocs,
  updateDoc,
  deleteDoc,
  query,
  where,
  writeBatch,
  getDoc,
  serverTimestamp
} from "./firebase.js";

// --- DOM Element Selectors ---
const examForm = document.getElementById("exam-form");
const examIdInput = document.getElementById("exam-id");
const examNameInput = document.getElementById("exam-name");
const excelFileInput = document.getElementById("excel-file");
const submitBtn = document.getElementById("submit-btn");
const cancelBtn = document.getElementById("cancel-btn");
const formActionTitle = document.getElementById("form-action-title");

const progressWrapper = document.getElementById("progress-wrapper");
const progressLabel = document.getElementById("progress-label");
const progressPercent = document.getElementById("progress-percent");
const progressFill = document.getElementById("progress-fill");
const progressLog = document.getElementById("progress-log");

const examsList = document.getElementById("exams-list");

const replaceModal = document.getElementById("replace-modal");
const replaceForm = document.getElementById("replace-form");
const replaceExamIdInput = document.getElementById("replace-exam-id");
const replaceExcelFileInput = document.getElementById("replace-excel-file");
const closeReplaceModalBtn = document.getElementById("close-replace-modal");
const replaceProgressWrapper = document.getElementById("replace-progress-wrapper");
const replaceProgressLabel = document.getElementById("replace-progress-label");
const replaceProgressPercent = document.getElementById("replace-progress-percent");
const replaceProgressFill = document.getElementById("replace-progress-fill");
const replaceProgressLog = document.getElementById("replace-progress-log");

// --- Event Listeners ---
document.addEventListener("DOMContentLoaded", fetchExams);
cancelBtn.addEventListener("click", exitEditMode);
examForm.addEventListener("submit", handleFormSubmit);
closeReplaceModalBtn.addEventListener("click", () => replaceModal.style.display = "none");
replaceForm.addEventListener("submit", handleFileReplacement);

// --- Core Functions ---

/**
 * Fetches and displays the list of existing exams from Firestore.
 */
async function fetchExams() {
  try {
    const q = query(collection(db, "results"), orderBy("createdAt", "desc"));
    const snapshot = await getDocs(q);
    examsList.innerHTML = "";

    if (snapshot.empty) {
      examsList.innerHTML = `<tr><td colspan="4" class="text-center text-muted">No examinations imported yet.</td></tr>`;
      return;
    }

    snapshot.forEach((docSnapshot) => {
      const exam = docSnapshot.data();
      const tr = document.createElement("tr");
      const createdDate = exam.createdAt && exam.createdAt.toDate ?
        exam.createdAt.toDate().toLocaleDateString() :
        "N/A";

      tr.innerHTML = `
        <td class="font-bold">${escapeHTML(exam.examName)}</td>
        <td>${escapeHTML(exam.fileName || "N/A")}</td>
        <td>${createdDate}</td>
        <td class="text-center actions-cell">
          <button class="btn btn-secondary btn-sm edit-btn" data-id="${docSnapshot.id}" data-name="${escapeHTML(exam.examName)}">Edit</button>
          <button class="btn btn-secondary btn-sm replace-btn" data-id="${docSnapshot.id}">Replace File</button>
          <button class="btn btn-danger btn-sm delete-btn" data-id="${docSnapshot.id}" data-name="${escapeHTML(exam.examName)}">Delete</button>
        </td>
      `;
      examsList.appendChild(tr);
    });

    attachTableEventListeners();
  } catch (error) {
    console.error("Error fetching examinations:", error);
    alert("Could not load examinations list.");
  }
}

/**
 * Attaches event listeners to the action buttons in the exams table.
 */
function attachTableEventListeners() {
  document.querySelectorAll(".edit-btn").forEach(button => {
    button.addEventListener("click", (e) => startEditMode(e.target.dataset.id, e.target.dataset.name));
  });
  document.querySelectorAll(".replace-btn").forEach(button => {
    button.addEventListener("click", (e) => openReplaceModal(e.target.dataset.id));
  });
  document.querySelectorAll(".delete-btn").forEach(button => {
    button.addEventListener("click", (e) => deleteExamWithStudents(e.target.dataset.id, e.target.dataset.name));
  });
}

/**
 * Handles the main form submission for creating or editing an exam.
 * @param {Event} e The submission event.
 */
async function handleFormSubmit(e) {
  e.preventDefault();
  const examId = examIdInput.value.trim();
  const examName = examNameInput.value.trim();

  if (!examName) {
    alert("Exam Name is a required field.");
    return;
  }

  if (examId) {
    await updateExamName(examId, examName);
  } else {
    const excelFile = excelFileInput.files[0];
    if (!excelFile) {
      alert("Please choose an Excel file to import.");
      return;
    }
    await processAndImportFile(examName, excelFile);
  }
}

/**
 * Orchestrates the import process for a new file.
 * @param {string} examName The name for the new exam.
 * @param {File} file The Excel file to process.
 */
async function processAndImportFile(examName, file, existingExamId = null) {
  const isReplacement = !!existingExamId;
  const pWrapper = isReplacement ? replaceProgressWrapper : progressWrapper;
  const pFill = isReplacement ? replaceProgressFill : progressFill;
  const pLabel = isReplacement ? replaceProgressLabel : progressLabel;
  const pPercent = isReplacement ? replaceProgressPercent : progressPercent;
  const pLog = isReplacement ? replaceProgressLog : progressLog;

  try {
    lockFormControls(true);
    showProgress(pWrapper, true);
    setProgressBar(pFill, pLabel, pPercent, pLog, 5, "Reading file...");

    const arrayBuffer = await file.arrayBuffer();
    setProgressBar(pFill, pLabel, pPercent, pLog, 15, "Parsing Excel data...");

    const parsedStudents = await parseExcelFile(arrayBuffer);

    if (parsedStudents.length === 0) {
      throw new Error("No valid student records found in the Excel file. Check format and column headers.");
    }

    const counterMessage = `${parsedStudents.length} students found.`;
    setProgressBar(pFill, pLabel, pPercent, pLog, 25, counterMessage);

    const examId = existingExamId || doc(collection(db, "results")).id;

    if (!isReplacement) {
      await setDoc(doc(db, "results", examId), {
        examName: examName,
        fileName: file.name,
        createdAt: serverTimestamp()
      });
    } else {
       await updateDoc(doc(db, "results", examId), {
        fileName: file.name,
        createdAt: serverTimestamp()
      });
    }

    await batchWriteStudents(examId, examName, parsedStudents, (progress, message) => {
      setProgressBar(pFill, pLabel, pPercent, pLog, 25 + progress * 0.75, message);
    });

    setProgressBar(pFill, pLabel, pPercent, pLog, 100, `Successfully imported ${parsedStudents.length} students.`);
    alert(`Import Complete: Successfully processed ${parsedStudents.length} student records.`);
    
    if (isReplacement) {
        replaceModal.style.display = 'none';
    }
    exitEditMode();
    await fetchExams();
  } catch (error) {
    console.error("Import operation failed:", error);
    alert("Import failed: " + error.message);
    setProgressBar(pFill, pLabel, pPercent, pLog, 100, `Import failed.`);
  } finally {
    lockFormControls(false);
    if (!isReplacement) {
        showProgress(pWrapper, false);
    }
  }
}

/**
 * Parses an Excel file buffer into an array of student objects.
 * @param {ArrayBuffer} arrayBuffer The binary content of the Excel file.
 * @returns {Promise<Array<Object>>} A promise resolving to an array of student objects.
 */
async function parseExcelFile(arrayBuffer) {
    const workbook = XLSX.read(arrayBuffer, { type: 'buffer' });
    const worksheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(worksheet, { header: 1, range: 1 });

    const students = [];
    const seenRolls = new Set();

    for (const row of rows) {
        if (!row || row.length === 0) continue;
        
        const rollNo = row[3] ? String(row[3]).trim() : null;

        if (!rollNo) continue;
        if (seenRolls.has(rollNo)) continue;

        students.push({
            rank: row[1] || 'N/A',
            applicationNo: row[2] || 'N/A',
            rollNo: rollNo,
            name: row[4] || 'N/A',
            fatherName: row[5] || 'N/A',
            motherName: row[6] || 'N/A',
            dob: row[7] || 'N/A',
            gender: row[8] || 'N/A',
            category: row[9] || 'N/A',
            hcat: row[10] || 'N/A',
            fcat: row[11] || 'N/A',
            tsp: row[12] || 'N/A',
            net: row[13] || 0,
            selectionCategory: row[14] || 'N/A',
        });
        seenRolls.add(rollNo);
    }
    return students;
}

/**
 * Writes an array of student objects to Firestore in batches of 400.
 * @param {string} examId The ID of the parent exam.
 * @param {string} examName The name of the parent exam.
 * @param {Array<Object>} students The array of student data to write.
 * @param {Function} onProgress A callback to report progress.
 */
async function batchWriteStudents(examId, examName, students, onProgress) {
  const BATCH_SIZE = 400;
  const total = students.length;
  let cursor = 0;

  for (let i = 0; i < total; i += BATCH_SIZE) {
    const batch = writeBatch(db);
    const end = Math.min(i + BATCH_SIZE, total);
    const slice = students.slice(i, end);

    slice.forEach(student => {
      const docRef = doc(collection(db, "resultStudents"));
      const name = String(student.name || '').trim();
      const fatherName = String(student.fatherName || '').trim();
      const motherName = String(student.motherName || '').trim();
      
      batch.set(docRef, {
        examId,
        examName,
        rank: student.rank,
        applicationNo: student.applicationNo,
        rollNo: student.rollNo,
        name: name,
        fatherName: fatherName,
        motherName: motherName,
        dob: student.dob,
        gender: student.gender,
        category: student.category,
        hcat: student.hcat,
        fcat: student.fcat,
        tsp: student.tsp,
        net: student.net,
        selectionCategory: student.selectionCategory,
        searchName: name.toLowerCase(),
        searchFather: fatherName.toLowerCase(),
        searchMother: motherName.toLowerCase(),
        createdAt: serverTimestamp()
      });
    });

    await batch.commit();
    cursor = end;
    const progress = Math.round((cursor / total) * 100);
    onProgress(progress, `Importing students... (${cursor}/${total})`);
  }
}

/**
 * Handles replacing an existing exam's file.
 * @param {Event} e The submission event.
 */
async function handleFileReplacement(e) {
    e.preventDefault();
    const examId = replaceExamIdInput.value;
    const file = replaceExcelFileInput.files[0];

    if (!examId || !file) {
        alert("Please select a replacement file.");
        return;
    }

    const examDocRef = doc(db, "results", examId);
    const examSnapshot = await getDoc(examDocRef);
    if (!examSnapshot.exists()) {
        alert("Error: The exam you are trying to replace no longer exists.");
        return;
    }
    const examName = examSnapshot.data().examName;

    const pWrapper = replaceProgressWrapper;
    showProgress(pWrapper, true);
    const pFill = replaceProgressFill;
    const pLabel = replaceProgressLabel;
    const pPercent = replaceProgressPercent;
    const pLog = replaceProgressLog;

    setProgressBar(pFill, pLabel, pPercent, pLog, 5, "Deleting existing student records...");
    
    try {
        await deleteAllStudentsForExam(examId);
        setProgressBar(pFill, pLabel, pPercent, pLog, 20, "Old records deleted. Starting new import...");
        await processAndImportFile(examName, file, examId);
    } catch (error) {
        console.error("Replacement failed:", error);
        alert(`Replacement failed: ${error.message}`);
        setProgressBar(pFill, pLabel, pPercent, pLog, 100, "Replacement failed.");
    }
}

/**
 * Deletes all student records associated with a given examId.
 * @param {string} examId The ID of the exam whose students should be deleted.
 */
async function deleteAllStudentsForExam(examId) {
    const studentsRef = collection(db, "resultStudents");
    const q = query(studentsRef, where("examId", "==", examId));
    const snapshot = await getDocs(q);

    if (snapshot.empty) return;

    const BATCH_SIZE = 400;
    const batches = [];
    let currentBatch = writeBatch(db);
    let counter = 0;

    snapshot.forEach((docSnapshot) => {
        currentBatch.delete(docSnapshot.ref);
        counter++;
        if (counter >= BATCH_SIZE) {
            batches.push(currentBatch.commit());
            currentBatch = writeBatch(db);
            counter = 0;
        }
    });

    if (counter > 0) {
        batches.push(currentBatch.commit());
    }
    await Promise.all(batches);
}

/**
 * Deletes an entire exam record and all its associated students.
 * @param {string} examId The ID of the exam to delete.
 * @param {string} examName The name for the confirmation dialog.
 */
async function deleteExamWithStudents(examId, examName) {
  if (!confirm(`Are you sure you want to delete "${examName}"? This will permanently remove the exam and all student results.`)) {
    return;
  }

  try {
    lockFormControls(true);
    await deleteAllStudentsForExam(examId);
    await deleteDoc(doc(db, "results", examId));

    alert(`Successfully deleted exam "${examName}" and all associated records.`);
    await fetchExams();
  } catch (error) {
    console.error("Delete operation failed:", error);
    alert("Delete failed. See console for details.");
  } finally {
    lockFormControls(false);
  }
}

/**
 * Updates an existing exam's name.
 * @param {string} examId The exam's document ID.
 * @param {string} newExamName The new name for the exam.
 */
async function updateExamName(examId, newExamName) {
  try {
    submitBtn.disabled = true;
    const examRef = doc(db, "results", examId);
    await updateDoc(examRef, { examName: newExamName });
    await updateStudentsExamName(examId, newExamName);

    alert("Exam name updated successfully.");
    exitEditMode();
    await fetchExams();
  } catch (error) {
    console.error("Error updating exam name:", error);
    alert("Failed to update exam name.");
  } finally {
    submitBtn.disabled = false;
  }
}

/**
 * Propagates a name change from an exam to all its student records.
 * @param {string} examId The exam's document ID.
 * @param {string} newExamName The new name.
 */
async function updateStudentsExamName(examId, newExamName) {
  const studentsRef = collection(db, "resultStudents");
  const q = query(studentsRef, where("examId", "==", examId));
  const snapshot = await getDocs(q);
  if (snapshot.empty) return;

  const BATCH_SIZE = 400;
  const batches = [];
  let currentBatch = writeBatch(db);
  let counter = 0;

  snapshot.forEach((docSnapshot) => {
    currentBatch.update(docSnapshot.ref, { examName: newExamName });
    counter++;
    if (counter >= BATCH_SIZE) {
      batches.push(currentBatch.commit());
      currentBatch = writeBatch(db);
      counter = 0;
    }
  });

  if (counter > 0) {
    batches.push(currentBatch.commit());
  }
  await Promise.all(batches);
}

// --- UI Utility Functions ---

function startEditMode(id, name) {
  examIdInput.value = id;
  examNameInput.value = name;
  formActionTitle.textContent = "Modify Exam Name";
  submitBtn.textContent = "Update Name";
  cancelBtn.style.display = "inline-block";
  document.getElementById("excel-file-group").style.display = "none";
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function exitEditMode() {
  examForm.reset();
  examIdInput.value = "";
  formActionTitle.textContent = "Create & Import Exam";
  submitBtn.textContent = "Import Excel Result";
  cancelBtn.style.display = "none";
  document.getElementById("excel-file-group").style.display = "block";
}

function openReplaceModal(examId) {
  replaceExamIdInput.value = examId;
  replaceForm.reset();
  replaceModal.style.display = "flex";
  showProgress(replaceProgressWrapper, false);
}

function setProgressBar(fill, label, percent, log, val, msg) {
  const saneVal = Math.min(100, Math.max(0, val));
  fill.style.width = `${saneVal}%`;
  percent.textContent = `${Math.round(saneVal)}%`;
  log.textContent = msg;
}

function showProgress(wrapper, flag) {
  wrapper.style.display = flag ? "block" : "none";
}

function lockFormControls(flag) {
  submitBtn.disabled = flag;
  cancelBtn.disabled = flag;
  examNameInput.disabled = flag;
  excelFileInput.disabled = flag;
  document.querySelectorAll('.actions-cell button').forEach(b => b.disabled = flag);
}

function escapeHTML(str) {
  if (!str) return "";
  return String(str).replace(/[&<>'"]/g,
    tag => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      "'": '&#39;',
      '"': '&quot;'
    } [tag] || tag)
  );
}
