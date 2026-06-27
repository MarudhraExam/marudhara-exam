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
  getDoc
} from "./firebase.js";

pdfjsLib.GlobalWorkerOptions.workerSrc = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";

// --- DOM Element Selectors ---
const examForm = document.getElementById("exam-form");
const examIdInput = document.getElementById("exam-id");
const examNameInput = document.getElementById("exam-name");
const pdfFileInput = document.getElementById("pdf-file");
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
const replacePdfFileInput = document.getElementById("replace-pdf-file");
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
replaceForm.addEventListener("submit", handlePdfReplacement);

// --- Core Functions ---

/**
 * Fetches and displays the list of existing exams from Firestore.
 */
async function fetchExams() {
  try {
    const q = query(collection(db, "results"));
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
        <td>${escapeHTML(exam.pdfName || "N/A")}</td>
        <td>${createdDate}</td>
        <td class="text-center actions-cell">
          <button class="btn btn-secondary btn-sm edit-btn" data-id="${docSnapshot.id}" data-name="${escapeHTML(exam.examName)}">Edit Name</button>
          <button class="btn btn-secondary btn-sm replace-btn" data-id="${docSnapshot.id}">Replace PDF</button>
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

  if (examId) { // Editing an existing exam name
    await updateExamName(examId, examName);
  } else { // Creating a new exam
    const pdfFile = pdfFileInput.files[0];
    if (!pdfFile) {
      alert("Please choose a results PDF to import.");
      return;
    }
    await processAndImportNewExam(examName, pdfFile);
  }
}

/**
 * Initiates the UI for editing an exam's name.
 * @param {string} id The Firestore document ID of the exam.
 * @param {string} name The current name of the exam.
 */
function startEditMode(id, name) {
  examIdInput.value = id;
  examNameInput.value = name;
  formActionTitle.textContent = "Modify Exam Name";
  submitBtn.textContent = "Update Name";
  cancelBtn.style.display = "inline-block";
  document.getElementById("pdf-file-group").style.display = "none";
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

/**
 * Resets the form to its default state for creating new exams.
 */
function exitEditMode() {
  examIdInput.value = "";
  examForm.reset();
  formActionTitle.textContent = "Create & Import Exam";
  submitBtn.textContent = "Process and Import";
  cancelBtn.style.display = "none";
  document.getElementById("pdf-file-group").style.display = "block";
}

/**
 * Updates an exam's name in Firestore and propagates the change to all related students.
 * @param {string} examId The ID of the exam to update.
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
 * Updates the examName field for all students linked to a specific examId.
 * @param {string} examId The ID of the exam.
 * @param {string} newExamName The new name to set.
 */
async function updateStudentsExamName(examId, newExamName) {
  const studentsRef = collection(db, "resultStudents");
  const q = query(studentsRef, where("examId", "==", examId));
  const snapshot = await getDocs(q);
  if (snapshot.empty) return;

  const batches = [];
  let currentBatch = writeBatch(db);
  let counter = 0;

  snapshot.forEach((docSnapshot) => {
    currentBatch.update(docSnapshot.ref, { examName: newExamName });
    counter++;
    if (counter >= 499) { // Firestore batch limit is 500 writes
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
 * Main orchestration function for processing a new PDF and importing the data.
 * @param {string} examName The name of the new exam.
 * @param {File} file The PDF file to process.
 */
async function processAndImportNewExam(examName, file) {
  try {
    lockFormControls(true);
    showProgress(progressWrapper, true);
    setProgressBar(progressFill, progressLabel, progressPercent, progressLog, 5, "Reading PDF file...");

    const arrayBuffer = await file.arrayBuffer();
    setProgressBar(progressFill, progressLabel, progressPercent, progressLog, 15, "Parsing PDF structure...");

    const parsedStudents = await parseResultPDF(arrayBuffer, (progress, message) => {
      setProgressBar(progressFill, progressLabel, progressPercent, progressLog, progress, message);
    });

    if (parsedStudents.length === 0) {
      throw new Error("No candidate records could be detected in the uploaded PDF. Please verify the file format.");
    }

    setProgressBar(progressFill, progressLabel, progressPercent, progressLog, 75, `Creating exam and preparing to save ${parsedStudents.length} records...`);

    const examDocRef = doc(collection(db, "results"));
    const examId = examDocRef.id;

    await setDoc(examDocRef, {
      examName: examName,
      pdfName: file.name,
      createdAt: new Date()
    });

    await batchWriteStudents(examId, examName, parsedStudents, (progress, message) => {
      setProgressBar(progressFill, progressLabel, progressPercent, progressLog, progress, message);
    });

    setProgressBar(progressFill, progressLabel, progressPercent, progressLog, 100, `Import complete! Saved ${parsedStudents.length} candidates.`);
    alert(`Successfully imported ${parsedStudents.length} candidate records.`);
    exitEditMode();
    await fetchExams();
  } catch (error) {
    console.error("Import operation failed:", error);
    alert("Import failed: " + error.message);
    setProgressBar(progressFill, progressLabel, progressPercent, progressLog, 100, `Import failed: ${error.message}`);
  } finally {
    lockFormControls(false);
    showProgress(progressWrapper, false);
  }
}


// --- NEW PDF PARSER ---

/**
 * A robust, pattern-based parser for RSSB Final Result PDFs.
 * This function is completely rewritten to avoid coordinate-based parsing.
 * @param {ArrayBuffer} arrayBuffer The binary content of the PDF file.
 * @param {Function} onProgress A callback function to report progress.
 * @returns {Promise<Array<Object>>} A promise that resolves to an array of student objects.
 */
async function parseResultPDF(arrayBuffer, onProgress) {
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  const totalPages = pdf.numPages;
  const allRecords = [];
  const seenRolls = new Set();

  const IGNORE_PATTERNS = [
    /direct recruitment/i, /list of finally selected/i, /NON SCHEDULED AREA/i,
    /DATE:/i, /signature not verified/i, /digitally signed by/i,
    /designation :/i, /rajkaj ref/i, /m e-sign/i, /chairman/i, /member/i,
    /secretary/i, /page\s*\d+/i, /SLNO\s*RANK/i, /ROLL_NO/i, /ROLL NO/i,
    /^[^a-z0-9]+$/i // Ignore lines with only symbols
  ];

  for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
    const progress = 15 + Math.floor((pageNum / totalPages) * 50);
    onProgress(progress, `Processing Page ${pageNum} of ${totalPages}...`);

    const page = await pdf.getPage(pageNum);
    const content = await page.getTextContent();
    const items = content.items.map(item => item.str);

    // Reconstruct the full text of the page.
    // PDF text extraction can be messy, so we join and then split by potential record separators.
    const pageText = items.join(' ');

    // The roll number is a reliable separator between records.
    // We split the page text by sequences of 6 to 8 digits (the roll numbers).
    const potentialRecords = pageText.split(/(\b\d{6,8}\b)/g);

    for (let i = 1; i < potentialRecords.length; i += 2) {
      const rollNo = potentialRecords[i];
      const textChunk = potentialRecords[i + 1] || '';
      const fullChunk = rollNo + ' ' + textChunk;

      // Filter out junk based on ignore patterns
      if (IGNORE_PATTERNS.some(pattern => pattern.test(fullChunk))) continue;

      // --- Data Extraction using Regular Expressions ---
      const record = {};
      let remainingText = fullChunk;

      record.rollNo = rollNo;

      // 1. DOB (dd-mm-yyyy)
      const dobMatch = remainingText.match(/(\d{2}-\d{2}-\d{4})/);
      if (dobMatch) {
        record.dob = dobMatch[0];
        remainingText = remainingText.replace(dobMatch[0], '');
      }

      // 2. NET Marks (ddd.dddd format)
      const netMatch = remainingText.match(/(\d+\.\d+)/);
      if (netMatch) {
        record.net = parseFloat(netMatch[0]);
        remainingText = remainingText.replace(netMatch[0], '');
      }

      // 3. Gender
      const genderMatch = remainingText.match(/\b(MALE|FEMALE|M|F)\b/i);
      if (genderMatch) {
        // Standardize gender to 'M' or 'F' before full cleaning later
        record.gender = genderMatch[0].charAt(0).toUpperCase();
        remainingText = remainingText.replace(genderMatch[0], '');
      }

      // 4. Categories (usually uppercase words, sometimes with slashes)
      // This is heuristic: find all short, uppercase words.
      const catMatches = remainingText.match(/\b([A-Z/]{2,8})\b/g) || [];
      const categories = catMatches.filter(c => c !== record.gender && !/^[IVXLCDM]+$/.test(c)); // filter out gender and roman numerals
      
      if (categories.length > 0) {
          // A common pattern is Category followed by Selection Category
          record.category = categories[0];
          remainingText = remainingText.replace(categories[0], '');
          if (categories.length > 1) {
              record.selectionCategory = categories[1];
              remainingText = remainingText.replace(categories[1], '');
          }
      }

      // 5. Names (Candidate, Father, Mother)
      // What's left should mostly be names. We split by multiple spaces.
      // The text is often: RollNo CandName FatherName MotherName ...
      // But names can have spaces. We assume the three longest text segments are the names.
      const nameParts = remainingText.trim().split(/\s{2,}/).filter(p => p.length > 2 && /[a-zA-Z]/.test(p));
      nameParts.sort((a,b) => b.length - a.length); // Heuristic: sort by length to find names

      if (nameParts.length > 0) record.name = nameParts[0].trim();
      if (nameParts.length > 1) record.fatherName = nameParts[1].trim();
      if (nameParts.length > 2) record.motherName = nameParts[2].trim();


      // --- Final Validation and Cleanup ---
      // A record is valid if it has a roll number and at least a name.
      if (record.rollNo && record.name && !seenRolls.has(record.rollNo)) {
        allRecords.push({
          rollNo: record.rollNo,
          name: record.name || 'N/A',
          fatherName: record.fatherName || 'N/A',
          motherName: record.motherName || 'N/A',
          dob: record.dob || 'N/A',
          gender: record.gender || 'N/A',
          category: record.category || 'N/A',
          selectionCategory: record.selectionCategory || 'N/A',
          net: record.net || 'N/A',
        });
        seenRolls.add(record.rollNo);
      }
    }
  }

  return allRecords;
}

/**
 * Writes an array of student objects to Firestore in batches.
 * @param {string} examId The ID of the parent exam.
 * @param {string} examName The name of the parent exam.
 * @param {Array<Object>} students The array of student data to write.
 * @param {Function} onProgress A callback to report progress.
 */
async function batchWriteStudents(examId, examName, students, onProgress) {
  const batchLimit = 499; // Firestore limit is 500 writes per batch
  const total = students.length;
  let cursor = 0;

  while (cursor < total) {
    const batch = writeBatch(db);
    const slice = students.slice(cursor, cursor + batchLimit);

    slice.forEach(student => {
      const docRef = doc(collection(db, "resultStudents"));
      batch.set(docRef, {
        examId: examId,
        examName: examName,
        rollNo: student.rollNo,
        name: student.name,
        fatherName: student.fatherName,
        motherName: student.motherName,
        dob: student.dob,
        gender: student.gender,
        category: student.category,
        selectionCategory: student.selectionCategory,
        net: student.net,
        searchName: student.name.toLowerCase().trim(),
        searchFather: student.fatherName.toLowerCase().trim(),
        searchMother: student.motherName.toLowerCase().trim(),
        createdAt: new Date()
      });
    });

    await batch.commit();
    cursor += slice.length;
    const saveProgress = 75 + Math.round((cursor / total) * 25);
    onProgress(saveProgress, `Saving records to database (${cursor}/${total})...`);
  }
}

/**
 * Deletes an exam and all its associated student records.
 * @param {string} examId The ID of the exam to delete.
 * @param {string} examName The name of the exam, for the confirmation dialog.
 */
async function deleteExamWithStudents(examId, examName) {
  if (!confirm(`Are you sure you want to delete "${examName}"? This will permanently remove the exam and all ${examName} student results.`)) {
    return;
  }

  try {
    lockFormControls(true);
    const studentsRef = collection(db, "resultStudents");
    const q = query(studentsRef, where("examId", "==", examId));
    const snapshot = await getDocs(q);

    if (!snapshot.empty) {
      const batches = [];
      let currentBatch = writeBatch(db);
      let counter = 0;
      snapshot.forEach((docSnapshot) => {
        currentBatch.delete(docSnapshot.ref);
        counter++;
        if (counter >= 499) {
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

    await deleteDoc(doc(db, "results", examId));
    alert("Examination and all associated student records have been purged.");
    await fetchExams();
  } catch (error) {
    console.error("Purge failure:", error);
    alert("Purge operation failed. Check console for details.");
  } finally {
    lockFormControls(false);
  }
}

/**
 * Handles the process of replacing a PDF for an existing exam.
 * @param {Event} e The submission event.
 */
async function handlePdfReplacement(e) {
  e.preventDefault();
  const examId = replaceExamIdInput.value;
  const file = replacePdfFileInput.files[0];

  if (!examId || !file) {
    alert("Please select a replacement PDF to proceed.");
    return;
  }

  try {
    replaceForm.querySelector('button[type="submit"]').disabled = true;
    closeReplaceModalBtn.disabled = true;
    showProgress(replaceProgressWrapper, true);
    setProgressBar(replaceProgressFill, replaceProgressLabel, replaceProgressPercent, replaceProgressLog, 5, "Fetching exam details...");

    const examDocRef = doc(db, "results", examId);
    const examSnapshot = await getDoc(examDocRef);
    if (!examSnapshot.exists()) throw new Error("Target exam no longer exists.");
    const examName = examSnapshot.data().examName;

    setProgressBar(replaceProgressFill, replaceProgressLabel, replaceProgressPercent, replaceProgressLog, 15, "Deleting old student records...");
    await deleteExamWithStudents(examId, examName); // Re-use delete logic but without confirm prompt

    setProgressBar(replaceProgressFill, replaceProgressLabel, replaceProgressPercent, replaceProgressLog, 35, "Parsing new PDF...");
    const arrayBuffer = await file.arrayBuffer();
    const parsedStudents = await parseResultPDF(arrayBuffer, (progress, message) => {
      setProgressBar(replaceProgressFill, replaceProgressLabel, replaceProgressPercent, replaceProgressLog, 35 + (progress / 4), message);
    });

    if (parsedStudents.length === 0) {
      throw new Error("No candidate records found in the new PDF.");
    }

    setProgressBar(replaceProgressFill, replaceProgressLabel, replaceProgressPercent, replaceProgressLog, 75, "Updating exam record...");
    await updateDoc(examDocRef, {
      pdfName: file.name,
      createdAt: new Date()
    });

    await batchWriteStudents(examId, examName, parsedStudents, (progress, message) => {
      setProgressBar(replaceProgressFill, replaceProgressLabel, replaceProgressPercent, replaceProgressLog, progress, message);
    });

    setProgressBar(replaceProgressFill, replaceProgressLabel, replaceProgressPercent, replaceProgressLog, 100, "Replacement process completed!");
    alert(`Successfully replaced and imported ${parsedStudents.length} candidates.`);
    replaceModal.style.display = "none";
    await fetchExams();
  } catch (error) {
    console.error("Replacement operation failed:", error);
    alert("Replacement failed: " + error.message);
  } finally {
    replaceForm.querySelector('button[type="submit"]').disabled = false;
    closeReplaceModalBtn.disabled = false;
    showProgress(replaceProgressWrapper, false);
  }
}


// --- UI Utility Functions ---

function openReplaceModal(examId) {
  replaceExamIdInput.value = examId;
  replaceForm.reset();
  replaceModal.style.display = "flex";
  showProgress(replaceProgressWrapper, false);
}

function setProgressBar(fill, label, percent, log, val, msg) {
  fill.style.width = `${val}%`;
  percent.textContent = `${Math.round(val)}%`;
  log.textContent = msg;
}

function showProgress(wrapper, flag) {
  wrapper.style.display = flag ? "block" : "none";
}

function lockFormControls(flag) {
  submitBtn.disabled = flag;
  cancelBtn.disabled = flag;
  examNameInput.disabled = flag;
  pdfFileInput.disabled = flag;
  document.querySelectorAll('.actions-cell button').forEach(b => b.disabled = flag);
}

function escapeHTML(str) {
  if (!str) return "";
  return str.replace(/[&<>'"]/g,
    tag => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      "'": '&#39;',
      '"': '&quot;'
    } [tag] || tag)
  );
}
