import {
  db,
  collection,
  doc,
  addDoc,
  setDoc,
  getDocs,
  updateDoc,
  deleteDoc,
  query,
  where,
  writeBatch
} from "./firebase.js";

pdfjsLib.GlobalWorkerOptions.workerSrc = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";

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

document.addEventListener("DOMContentLoaded", fetchExams);

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

      const createdDate = exam.createdAt && exam.createdAt.toDate 
        ? exam.createdAt.toDate().toLocaleDateString() 
        : "N/A";

      tr.innerHTML = `
        <td class="font-bold">${escapeHTML(exam.examName)}</td>
        <td>${escapeHTML(exam.pdfName || "Manual Entry")}</td>
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
    console.error("Error reading examinations:", error);
    alert("Could not load examinations list.");
  }
}

function attachTableEventListeners() {
  document.querySelectorAll(".edit-btn").forEach(button => {
    button.addEventListener("click", () => {
      const id = button.getAttribute("data-id");
      const name = button.getAttribute("data-name");
      startEditMode(id, name);
    });
  });

  document.querySelectorAll(".replace-btn").forEach(button => {
    button.addEventListener("click", () => {
      const id = button.getAttribute("data-id");
      openReplaceModal(id);
    });
  });

  document.querySelectorAll(".delete-btn").forEach(button => {
    button.addEventListener("click", () => {
      const id = button.getAttribute("data-id");
      const name = button.getAttribute("data-name");
      deleteExamWithStudents(id, name);
    });
  });
}

function startEditMode(id, name) {
  examIdInput.value = id;
  examNameInput.value = name;
  formActionTitle.textContent = "Modify Exam Name";
  submitBtn.textContent = "Update Name";
  cancelBtn.style.display = "inline-block";
  document.getElementById("pdf-file-group").style.display = "none";
}

function exitEditMode() {
  examIdInput.value = "";
  examNameInput.value = "";
  formActionTitle.textContent = "Create & Import Exam";
  submitBtn.textContent = "Process and Import";
  cancelBtn.style.display = "none";
  document.getElementById("pdf-file-group").style.display = "block";
  pdfFileInput.value = "";
}

cancelBtn.addEventListener("click", exitEditMode);

examForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const examId = examIdInput.value.trim();
  const examName = examNameInput.value.trim();

  if (examId) {
    // Edit Exam Name Action
    try {
      submitBtn.disabled = true;
      const examRef = doc(db, "results", examId);
      await updateDoc(examRef, { examName: examName });

      // Update examName field inside student records
      await updateStudentsExamName(examId, examName);

      alert("Exam name updated successfully.");
      exitEditMode();
      await fetchExams();
    } catch (error) {
      console.error("Error updating exam name:", error);
      alert("Failed to update exam name.");
    } finally {
      submitBtn.disabled = false;
    }
  } else {
    // Create and Import New Action
    const pdfFile = pdfFileInput.files[0];
    if (!pdfFile) {
      alert("Please choose a results PDF to import.");
      return;
    }
    await processAndImportNewExam(examName, pdfFile);
  }
});

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
    if (counter === 500) {
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

async function processAndImportNewExam(examName, file) {
  try {
    lockFormControls(true);
    showProgress(progressWrapper, true);
    setProgressBar(progressFill, progressLabel, progressPercent, progressLog, 5, "Loading PDF file binary...");

    const arrayBuffer = await file.arrayBuffer();
    setProgressBar(progressFill, progressLabel, progressPercent, progressLog, 15, "Opening PDF structure...");
    
    const parsedStudents = await parseResultPDF(arrayBuffer, progressFill, progressLabel, progressPercent, progressLog);
    
    if (parsedStudents.length === 0) {
      throw new Error("No structured candidate records could be detected in the uploaded PDF document. Please verify the file contents.");
    }

    setProgressBar(progressFill, progressLabel, progressPercent, progressLog, 75, "Creating examination record...");
    
    const examDocRef = doc(collection(db, "results"));
    const examId = examDocRef.id;

    await setDoc(examDocRef, {
      examName: examName,
      pdfName: file.name,
      createdAt: new Date()
    });

    await batchWriteStudents(examId, examName, parsedStudents, progressFill, progressLabel, progressPercent, progressLog);

    setProgressBar(progressFill, progressLabel, progressPercent, progressLog, 100, `Completed! Saved ${parsedStudents.length} candidates.`);
    alert(`Successfully processed and imported ${parsedStudents.length} candidate records.`);
    
    exitEditMode();
    await fetchExams();
  } catch (error) {
    console.error("Import operation failed:", error);
    alert("Import failed: " + error.message);
  } finally {
    lockFormControls(false);
    showProgress(progressWrapper, false);
  }
}
async function parseResultPDF(arrayBuffer, fill, label, percent, log) {

  const pdf = await pdfjsLib.getDocument({
    data: arrayBuffer
  }).promise;

  const parsedRecords = [];

  const totalPages = pdf.numPages;

  for (let pageNo = 1; pageNo <= totalPages; pageNo++) {

    const progress =
      15 + Math.floor((pageNo / totalPages) * 50);

    setProgressBar(
      fill,
      label,
      percent,
      log,
      progress,
      `Reading Page ${pageNo} of ${totalPages}`
    );

    const page = await pdf.getPage(pageNo);

    const text = await page.getTextContent();

    const items = text.items;

    const rows = {};

    items.forEach(item => {

      const y = Math.round(item.transform[5]);

      let found = false;

      Object.keys(rows).forEach(key => {

        if (Math.abs(key - y) <= 3) {

          rows[key].push(item);

          found = true;

        }

      });

      if (!found) {

        rows[y] = [item];

      }

    });

    const sortedRows =
      Object.keys(rows)
      .sort((a,b)=>b-a);

    for(const y of sortedRows){

      const rowItems =
      rows[y]
      .sort((a,b)=>a.transform[4]-b.transform[4]);

      const line =
      rowItems
      .map(i=>i.str)
      .join(" ")
      .replace(/\s+/g," ")
      .trim();

      if(line=="") continue;

      if(
        line.includes("ROLL_NO") ||
        line.includes("ROLL NO")
      ){

        continue;

      }

      const firstWord =
      line.split(" ")[0];

      if(!/^\d+$/.test(firstWord)){

        continue;

      }

      const student =
      extractCandidateRecord(line);

      if(student){

        parsedRecords.push(student);

      }

    }

  }

  return parsedRecords;

}
function detectHeaderMap() {
  return {
    roll: /^\d{5,12}$/,

    gender: /^(MALE|FEMALE|M|F)$/i,

    category: /^(GEN|GENERAL|OBC|OBC-NCL|SC|ST|EWS|MBC|SBC|PWD|EXS)$/i
  };
}
function extractCandidateRecord(line) {

  const parts = line.trim().replace(/\s+/g," ").split(" ");

  if(parts.length < 8) return null;

  if(!/^\d+$/.test(parts[0])) return null;

  const rollNo = parts[0];

  const net = parts[parts.length-2];

  const selectionCategory = parts[parts.length-1];

  let genderIndex = -1;

  for(let i=1;i<parts.length;i++){

    if(
      parts[i]=="MALE" ||
      parts[i]=="FEMALE" ||
      parts[i]=="M" ||
      parts[i]=="F"
    ){

      genderIndex=i;

      break;

    }

  }

  if(genderIndex==-1) return null;

  const gender = parts[genderIndex];

  const dob = parts[genderIndex-1];

  const category = parts[genderIndex+1];

  const beforeDob =
  parts.slice(1,genderIndex-1);

  const oneThird =
  Math.floor(beforeDob.length/3);

  const name =
  beforeDob.slice(0,oneThird).join(" ");

  const fatherName =
  beforeDob.slice(oneThird,oneThird*2).join(" ");

  const motherName =
  beforeDob.slice(oneThird*2).join(" ");

  return{

    rollNo,

    name,

    fatherName,

    motherName,

    dob,

    gender,

    category,

    net,

    selectionCategory

  };

}
     if (!matched) {
        lineMap[yCoord] = [item];
      }
    });

    const sortedY = Object.keys(lineMap).sort((a, b) => Number(b) - Number(a));
    const pageLines = [];

    sortedY.forEach(y => {
      const itemsInLine = lineMap[y].sort((a, b) => a.transform[4] - b.transform[4]);
      const lineString = itemsInLine.map(item => item.str).join(" ");
      pageLines.push(lineString);
    });

    for (let index = 0; index < pageLines.length; index++) {
      const line = pageLines[index].trim();
      if (!line) continue;

      // Auto detect columns header signature sequence
      if (!columnsDetected && line.includes("ROLL_NO") && (line.includes("CAND_NAME") || line.includes("FATHER_NAM"))) {
        columnsDetected = detectHeaderMap(line);
        continue;
      }

      if (columnsDetected) {
        // Evaluate if this line represents a structural candidate record starting with a Roll Number (numerical sequence)
        const possibleRoll = line.split(/\s+/)[0];
        if (/^\d+$/.test(possibleRoll)) {
          const parsedCandidate = extractCandidateRecord(line, columnsDetected);
          if (parsedCandidate) {
            parsedRecords.push(parsedCandidate);
          }
        }
      }
    }
  }

  return parsedRecords;
}
function detectHeaderMap() {

  return {

    rollRegex: /^\d{5,12}$/,

    dobRegex: /^\d{2}[\/\-]\d{2}[\/\-]\d{4}$/,

    genderRegex: /^(MALE|FEMALE|M|F)$/i,

    categoryRegex: /^(GEN|GENERAL|OBC|OBC-NCL|SC|ST|EWS|MBC|SBC|PWD|EXS)$/i

  };

}

function extractCandidateRecord(line){

  const cfg = detectHeaderMap();

  const parts = line
    .replace(/\s+/g," ")
    .trim()
    .split(" ");

  if(parts.length < 8) return null;

  if(!cfg.rollRegex.test(parts[0])) return null;

  const rollNo = parts.shift();

  let dobIndex = -1;

  for(let i=0;i<parts.length;i++){

    if(cfg.dobRegex.test(parts[i])){

      dobIndex = i;

      break;

    }

  }

  if(dobIndex==-1) return null;
    const dob = parts[dobIndex];

  const gender = parts[dobIndex + 1] || "";

  const category = parts[dobIndex + 2] || "";

  const remaining = parts.slice(0, dobIndex);

  const tail = parts.slice(dobIndex + 3);

  let net = "";

  let selectionCategory = "";

  if (tail.length >= 2) {

    net = tail[tail.length - 2];

    selectionCategory = tail[tail.length - 1];

  }

  const third = Math.floor(remaining.length / 3);

  const name = remaining.slice(0, third).join(" ");

  const fatherName = remaining.slice(third, third * 2).join(" ");

  const motherName = remaining.slice(third * 2).join(" ");

  return {

    rollNo,

    name,

    fatherName,

    motherName,

    dob,

    gender,

    category,

    net,

    selectionCategory

  };
  }
async function batchWriteStudents(examId, examName, students, fill, label, percent, log) {
  const batchLimit = 500;
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
        net: student.net,
        selectionCategory: student.selectionCategory,
        searchName: student.name.toLowerCase().trim(),
        searchFather: student.fatherName.toLowerCase().trim(),
        searchMother: student.motherName.toLowerCase().trim(),
        createdAt: new Date()
      });
    });

    cursor += slice.length;
    const saveProgress = 75 + Math.round((cursor / total) * 23);
    setProgressBar(fill, label, percent, log, saveProgress, `Writing candidate chunks to database (${cursor}/${total})...`);

    await batch.commit();
  }
}

async function deleteExamWithStudents(examId, examName) {
  const confirmed = confirm(`Are you sure you want to delete "${examName}"? This action will permanently remove the exam and all imported student results associated with it.`);
  if (!confirmed) return;

  try {
    lockFormControls(true);
    
    // Query and delete matched student records
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
        if (counter === 500) {
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

    // Delete Exam document
    await deleteDoc(doc(db, "results", examId));

    alert("Examination and student documents purged successfully.");
    exitEditMode();
    await fetchExams();
  } catch (error) {
    console.error("Purge failure:", error);
    alert("Purge operation failed.");
  } finally {
    lockFormControls(false);
  }
}

// Replace PDF Modal functions
function openReplaceModal(examId) {
  replaceExamIdInput.value = examId;
  replacePdfFileInput.value = "";
  replaceModal.style.display = "flex";
  showProgress(replaceProgressWrapper, false);
}

closeReplaceModalBtn.addEventListener("click", () => {
  replaceModal.style.display = "none";
});

replaceForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const examId = replaceExamIdInput.value;
  const file = replacePdfFileInput.files[0];

  if (!examId || !file) {
    alert("Please load a replacement PDF to proceed.");
    return;
  }

  try {
    replaceForm.querySelector('button[type="submit"]').disabled = true;
    closeReplaceModalBtn.disabled = true;
    showProgress(replaceProgressWrapper, true);
    setProgressBar(replaceProgressFill, replaceProgressLabel, replaceProgressPercent, replaceProgressLog, 5, "Accessing examination meta attributes...");

    // Retrieve Exam metadata
    const examDocRef = doc(db, "results", examId);
    const examSnapshot = await getDoc(examDocRef);
    if (!examSnapshot.exists()) {
      throw new Error("Target exam document no longer exists in database.");
    }
    const examName = examSnapshot.data().examName;

    setProgressBar(replaceProgressFill, replaceProgressLabel, replaceProgressPercent, replaceProgressLog, 15, "Deleting existing student records...");

    // Query and delete previous records
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
        if (counter === 500) {
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

    setProgressBar(replaceProgressFill, replaceProgressLabel, replaceProgressPercent, replaceProgressLog, 35, "Parsing incoming PDF records...");
    const arrayBuffer = await file.arrayBuffer();
    const parsedStudents = await parseResultPDF(arrayBuffer, replaceProgressFill, replaceProgressLabel, replaceProgressPercent, replaceProgressLog);

    if (parsedStudents.length === 0) {
      throw new Error("No structured candidate records could be detected in the replacement PDF file.");
    }

    setProgressBar(replaceProgressFill, replaceProgressLabel, replaceProgressPercent, replaceProgressLog, 75, "Updating configuration...");
    await updateDoc(examDocRef, {
      pdfName: file.name,
      createdAt: new Date()
    });

    await batchWriteStudents(examId, examName, parsedStudents, replaceProgressFill, replaceProgressLabel, replaceProgressPercent, replaceProgressLog);

    setProgressBar(replaceProgressFill, replaceProgressLabel, replaceProgressPercent, replaceProgressLog, 100, "Replacement process completed!");
    alert(`Successfully processed replacement dataset. Registered ${parsedStudents.length} candidates.`);
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
});

function setProgressBar(fill, label, percent, log, val, msg) {
  fill.style.width = `${val}%`;
  percent.textContent = `${val}%`;
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
    }[tag] || tag)
  );
}
