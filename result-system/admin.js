/**
 * Marudhara Exam - Admin Controller Operations
 * Handles dynamic Excel parsing, batch chunking, progress updates,
 * and database operations (cascade edit and delete).
 */

import {
    db,
    collection,
    doc,
    getDocs,
    updateDoc,
    deleteDoc,
    query,
    where,
    orderBy,
    limit,
    writeBatch,
    serverTimestamp
} from "./firebase-config.js";

// DOM Elements Selection
const uploadForm = document.getElementById("uploadForm");
const newExamNameInput = document.getElementById("newExamName");
const excelFileInput = document.getElementById("excelFile");
const fileSelectedDisplay = document.getElementById("fileSelectedDisplay");

const uploadProgressContainer = document.getElementById("uploadProgressContainer");
const progressBar = document.getElementById("progressBar");
const progressPercent = document.getElementById("progressPercent");
const progressStatusText = document.getElementById("progressStatusText");
const processedCountText = document.getElementById("processedCountText");

const examsTableBody = document.getElementById("examsTableBody");

// Modals: Edit Exam Title
const editNameModal = document.getElementById("editNameModal");
const editExamIdInput = document.getElementById("editExamId");
const editExamNameInput = document.getElementById("editExamNameInput");
const editNameForm = document.getElementById("editNameForm");
const cancelEditBtn = document.getElementById("cancelEditBtn");
const closeEditModalBtn = document.getElementById("closeEditModalBtn");

// Modals: Replace Excel
const replaceExcelModal = document.getElementById("replaceExcelModal");
const replaceExamIdInput = document.getElementById("replaceExamId");
const replaceExamNameValInput = document.getElementById("replaceExamNameVal");
const replaceExcelInput = document.getElementById("replaceExcelInput");
const replaceExcelForm = document.getElementById("replaceExcelForm");
const cancelReplaceBtn = document.getElementById("cancelReplaceBtn");
const closeReplaceModalBtn = document.getElementById("closeReplaceModalBtn");

// Expected headers configuration
const EXPECTED_HEADERS = [
    'SLNO', 'RANK', 'APPLICATION', 'ROLL_NO', 'CAND_NAME', 
    'FATHER_NAME', 'MOTHER_NAME', 'DOB', 'GENDER', 'CAT', 
    'HCAT', 'FCAT', 'TSP', 'NET', 'Sel_Cat'
];

// Initialize and Fetch Existing Collections
document.addEventListener("DOMContentLoaded", fetchActiveExams);

// Display picked file name
excelFileInput.addEventListener("change", (e) => {
    const file = e.target.files[0];
    if (file) {
        fileSelectedDisplay.textContent = `Selected File: ${file.name}`;
        fileSelectedDisplay.classList.remove("hidden");
    } else {
        fileSelectedDisplay.classList.add("hidden");
    }
});

/**
 * Parses the Excel file and extracts student records.
 * Uses Sheet 1 row 0 to discover header mapping dynamically.
 * Treats Sheet 2 onwards as purely student data rows.
 */
async function parseExcelData(file, targetExamName) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = function(e) {
            try {
                const data = new Uint8Array(e.target.result);
                const workbook = XLSX.read(data, { type: 'array', cellDates: true, raw: false });
                
                if (workbook.SheetNames.length === 0) {
                    throw new Error("The selected workbook contains no sheets.");
                }

                // Parse Sheet 1 first to extract row index mapping dynamically
                const sheet1Name = workbook.SheetNames[0];
                const sheet1 = workbook.Sheets[sheet1Name];
                const sheet1Rows = XLSX.utils.sheet_to_json(sheet1, { header: 1, defval: "" });

                if (sheet1Rows.length === 0) {
                    throw new Error("First sheet is empty. Header row cannot be identified.");
                }

                // Locate structural positions dynamically (No hardcoding)
                const firstRow = sheet1Rows[0].map(h => String(h).trim().toUpperCase());
                const colMap = {};
                
                EXPECTED_HEADERS.forEach(header => {
                    colMap[header] = firstRow.indexOf(header);
                });

                // Validation check for mandatory identifiers
                if (colMap['ROLL_NO'] === -1 || colMap['CAND_NAME'] === -1) {
                    throw new Error("Critical headers ('ROLL_NO' or 'CAND_NAME') are missing from Sheet 1.");
                }

                const studentsList = [];

                // Helper to normalize cell value
                const getVal = (row, header) => {
                    const idx = colMap[header];
                    if (idx === undefined || idx === -1 || idx >= row.length) return "";
                    const val = row[idx];
                    return (val === undefined || val === null) ? "" : String(val).trim();
                };

                // Process Sheet 1 Data rows starting from Row index 1
                for (let r = 1; r < sheet1Rows.length; r++) {
                    const row = sheet1Rows[r];
                    if (row.length === 0 || !getVal(row, 'ROLL_NO')) continue; // Skip blank rows
                    studentsList.push(buildStudentRecord(row, getVal, targetExamName));
                }

                // Process Sheet 2 onwards (All rows are treated directly as student data without headers)
                for (let s = 1; s < workbook.SheetNames.length; s++) {
                    const sheetName = workbook.SheetNames[s];
                    const sheet = workbook.Sheets[sheetName];
                    const sheetRows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" });
                    
                    for (let r = 0; r < sheetRows.length; r++) {
                        const row = sheetRows[r];
                        if (row.length === 0 || !getVal(row, 'ROLL_NO')) continue; // Skip blank rows
                        studentsList.push(buildStudentRecord(row, getVal, targetExamName));
                    }
                }

                resolve(studentsList);
            } catch (err) {
                reject(err);
            }
        };
        reader.onerror = (err) => reject(err);
        reader.readAsArrayBuffer(file);
    });
}

/**
 * Builds the student record schema.
 */
function buildStudentRecord(row, getVal, examName) {
    const rollNo = getVal(row, 'ROLL_NO');
    const name = getVal(row, 'CAND_NAME');
    const fatherName = getVal(row, 'FATHER_NAME');
    const motherName = getVal(row, 'MOTHER_NAME');

    return {
        examName: examName,
        rank: getVal(row, 'RANK'),
        applicationNo: getVal(row, 'APPLICATION'),
        rollNo: rollNo,
        name: name,
        fatherName: fatherName,
        motherName: motherName,
        dob: getVal(row, 'DOB'),
        gender: getVal(row, 'GENDER'),
        category: getVal(row, 'CAT'),
        horizontalCategory: getVal(row, 'HCAT'),
        femaleCategory: getVal(row, 'FCAT'),
        tsp: getVal(row, 'TSP'),
        netMarks: getVal(row, 'NET'),
        selectionCategory: getVal(row, 'Sel_Cat'),
        // Generated lowercase fields for fast index searches
        searchRoll: rollNo.toLowerCase(),
        searchName: name.toLowerCase(),
        searchFather: fatherName.toLowerCase(),
        searchMother: motherName.toLowerCase(),
        createdAt: serverTimestamp()
    };
}

/**
 * Batched uploader to safe write to Firestore.
 */
async function uploadStudentRecords(examId, studentsList) {
    const total = studentsList.length;
    let committedCount = 0;

    for (let i = 0; i < total; i += 500) {
        const chunk = studentsList.slice(i, i + 500);
        const batch = writeBatch(db);

        chunk.forEach(student => {
            const studentDocRef = doc(collection(db, "resultStudents"));
            // Append parent examId reference
            batch.set(studentDocRef, { ...student, examId });
        });

        await batch.commit();
        committedCount += chunk.length;
        updateUploadProgress(committedCount, total, `Writing records to Firestore...`);
    }
}

/**
 * Deletes all associated student records in batches of 500.
 */
async function deleteStudentRecords(examId, onProgress) {
    const studentRef = collection(db, "resultStudents");
    const q = query(studentRef, where("examId", "==", examId));
    let totalDeleted = 0;

    while (true) {
        const snapshot = await getDocs(query(q, limit(500)));
        if (snapshot.empty) break;

        const batch = writeBatch(db);
        snapshot.docs.forEach(doc => {
            batch.delete(doc.ref);
        });

        await batch.commit();
        totalDeleted += snapshot.size;
        if (onProgress) onProgress(totalDeleted);
    }
}

/**
 * Cascades update of examName across matching student documents.
 */
async function cascadeUpdateExamName(examId, newName, onProgress) {
    const studentRef = collection(db, "resultStudents");
    // Dynamic query avoids infinite loop cycles
    const q = query(studentRef, where("examId", "==", examId), where("examName", "!=", newName), limit(500));
    let totalUpdated = 0;

    while (true) {
        const snapshot = await getDocs(q);
        if (snapshot.empty) break;

        const batch = writeBatch(db);
        snapshot.docs.forEach(doc => {
            batch.update(doc.ref, { examName: newName });
        });

        await batch.commit();
        totalUpdated += snapshot.size;
        if (onProgress) onProgress(totalUpdated);
    }
}

/**
 * Handle new dataset creation and import workflow.
 */
uploadForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const examName = newExamNameInput.value.trim();
    const file = excelFileInput.files[0];

    if (!examName || !file) {
        alert("Please provide both the Exam Name and the Excel file.");
        return;
    }

    try {
        setUIProcessingState(true);
        updateUploadProgress(0, 100, "Reading Excel workbook...");

        // Parse worksheets
        const studentsList = await parseExcelData(file, examName);
        
        updateUploadProgress(0, studentsList.length, `Parsed ${studentsList.length} records. Creating parent exam metadata...`);

        // Create metadata document in 'results'
        const examDocRef = doc(collection(db, "results"));
        const examId = examDocRef.id;

        await writeBatch(db).set(examDocRef, {
            examName: examName,
            fileName: file.name,
            studentsCount: studentsList.length,
            createdAt: serverTimestamp()
        }).commit();

        // Write students in chunks of 500
        await uploadStudentRecords(examId, studentsList);

        alert("Database successfully populated with student records.");
        uploadForm.reset();
        fileSelectedDisplay.classList.add("hidden");
        fetchActiveExams();
    } catch (err) {
        console.error("Upload error:", err);
        alert(`Process Failed: ${err.message}`);
    } finally {
        setUIProcessingState(false);
    }
});

/**
 * Handle Replacement process.
 */
replaceExcelForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const examId = replaceExamIdInput.value;
    const examName = replaceExamNameValInput.value;
    const file = replaceExcelInput.files[0];

    if (!examId || !file) {
        alert("Selection error. Re-try replacing the files.");
        return;
    }

    try {
        closeModal(replaceExcelModal);
        setUIProcessingState(true);
        updateUploadProgress(0, 100, "Initializing replacements... Cleaning up existing entries...");

        // 1. Delete associated student records
        await deleteStudentRecords(examId, (deleted) => {
            updateUploadProgress(deleted, deleted + 100, `Removed ${deleted} old records...`);
        });

        updateUploadProgress(0, 100, "Parsing new Excel worksheet...");

        // 2. Parse new worksheet
        const studentsList = await parseExcelData(file, examName);

        // 3. Update parent metadata
        const examDocRef = doc(db, "results", examId);
        await updateDoc(examDocRef, {
            fileName: file.name,
            studentsCount: studentsList.length,
            createdAt: serverTimestamp()
        });

        // 4. Batch write new student records
        await uploadStudentRecords(examId, studentsList);

        alert("Replacement process completed successfully.");
        replaceExcelForm.reset();
        fetchActiveExams();
    } catch (err) {
        console.error("Replacement error:", err);
        alert(`Replacement process failed: ${err.message}`);
    } finally {
        setUIProcessingState(false);
    }
});

/**
 * Handle Title modification.
 */
editNameForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const examId = editExamIdInput.value;
    const newName = editExamNameInput.value.trim();

    if (!examId || !newName) {
        alert("Please enter a valid exam title.");
        return;
    }

    try {
        closeModal(editNameModal);
        setUIProcessingState(true);
        updateUploadProgress(0, 100, "Updating parent Exam Metadata...");

        // 1. Update metadata title
        const examDocRef = doc(db, "results", examId);
        await updateDoc(examDocRef, { examName: newName });

        updateUploadProgress(0, 100, "Cascading title modifications across student records...");

        // 2. Cascade changes through records
        await cascadeUpdateExamName(examId, newName, (updated) => {
            updateUploadProgress(updated, updated + 100, `Synchronized ${updated} records...`);
        });

        alert("Title updated across all records.");
        editNameForm.reset();
        fetchActiveExams();
    } catch (err) {
        console.error("Modification error:", err);
        alert(`Modification process failed: ${err.message}`);
    } finally {
        setUIProcessingState(false);
    }
});

/**
 * Deletes Exam completely.
 */
async function handleDeleteExam(examId, examName) {
    if (!confirm(`Are you absolutely sure you want to delete "${examName}"?\nThis deletes the exam and all its student records. This action cannot be undone.`)) {
        return;
    }

    try {
        setUIProcessingState(true);
        updateUploadProgress(0, 100, "Clearing student records...");

        // 1. Delete associated student records
        await deleteStudentRecords(examId, (deleted) => {
            updateUploadProgress(deleted, deleted + 100, `Cleared ${deleted} records...`);
        });

        updateUploadProgress(99, 100, "Clearing parent exam metadata...");

        // 2. Delete parent metadata
        const examDocRef = doc(db, "results", examId);
        await deleteDoc(examDocRef);

        alert("Exam and associated records deleted.");
        fetchActiveExams();
    } catch (err) {
        console.error("Deletion error:", err);
        alert(`Deletion process failed: ${err.message}`);
    } finally {
        setUIProcessingState(false);
    }
}

/**
 * Renders the dashboard elements.
 */
async function fetchActiveExams() {
    try {
        const resultsRef = collection(db, "results");
        const q = query(resultsRef, orderBy("createdAt", "desc"));
        const snapshot = await getDocs(q);

        examsTableBody.innerHTML = "";

        if (snapshot.empty) {
            examsTableBody.innerHTML = `<tr><td colspan="5" class="table-placeholder-row">No active result sets found. Start by importing a dataset.</td></tr>`;
            return;
        }

        snapshot.docs.forEach(docSnap => {
            const data = docSnap.data();
            const id = docSnap.id;
            const dateStr = data.createdAt ? new Date(data.createdAt.seconds * 1000).toLocaleDateString("en-IN", {
                day: '2-digit', month: 'short', year: 'numeric'
            }) : "N/A";

            const tr = document.createElement("tr");
            tr.innerHTML = `
                <td><strong>${data.examName}</strong></td>
                <td><code style="font-size:0.8rem; color:#475569;">${data.fileName}</code></td>
                <td>${data.studentsCount.toLocaleString("en-IN")}</td>
                <td>${dateStr}</td>
                <td class="text-center" style="white-space: nowrap;">
                    <button class="btn-mini-action btn-mini-accent" data-action="edit" data-id="${id}" data-name="${data.examName}">Edit Title</button>
                    <button class="btn-mini-action" data-action="replace" data-id="${id}" data-name="${data.examName}">Replace Excel</button>
                    <button class="btn-mini-action btn-mini-danger" data-action="delete" data-id="${id}" data-name="${data.examName}">Delete</button>
                </td>
            `;

            // Operational event attachments
            tr.querySelectorAll("button").forEach(btn => {
                btn.addEventListener("click", (e) => {
                    const action = btn.getAttribute("data-action");
                    const examId = btn.getAttribute("data-id");
                    const name = btn.getAttribute("data-name");

                    if (action === "edit") {
                        openEditModal(examId, name);
                    } else if (action === "replace") {
                        openReplaceModal(examId, name);
                    } else if (action === "delete") {
                        handleDeleteExam(examId, name);
                    }
                });
            });

            examsTableBody.appendChild(tr);
        });
    } catch (err) {
        console.error("Fetch collections failed:", err);
        examsTableBody.innerHTML = `<tr><td colspan="5" class="table-placeholder-row text-danger-alert">Failed to retrieve exam datasets. View logs for more information.</td></tr>`;
    }
}

// UI State Management Controls
function setUIProcessingState(isProcessing) {
    if (isProcessing) {
        uploadProgressContainer.classList.remove("hidden");
        document.querySelectorAll("button, input, select").forEach(el => el.disabled = true);
    } else {
        uploadProgressContainer.classList.add("hidden");
        document.querySelectorAll("button, input, select").forEach(el => el.disabled = false);
    }
}

function updateUploadProgress(current, total, statusText) {
    const percent = total > 0 ? Math.min(100, Math.round((current / total) * 100)) : 0;
    progressBar.style.width = `${percent}%`;
    progressPercent.textContent = `${percent}%`;
    progressStatusText.textContent = statusText;
    processedCountText.textContent = `${current.toLocaleString("en-IN")} / ${total.toLocaleString("en-IN")}`;
}

// Modal Toggle helpers
function openEditModal(id, currentName) {
    editExamIdInput.value = id;
    editExamNameInput.value = currentName;
    editNameModal.classList.remove("hidden");
}

function openReplaceModal(id, examName) {
    replaceExamIdInput.value = id;
    replaceExamNameValInput.value = examName;
    replaceExcelModal.classList.remove("hidden");
}

function closeModal(modalElement) {
    modalElement.classList.add("hidden");
}

cancelEditBtn.addEventListener("click", () => closeModal(editNameModal));
closeEditModalBtn.addEventListener("click", () => closeModal(editNameModal));
cancelReplaceBtn.addEventListener("click", () => closeModal(replaceExcelModal));
closeReplaceModalBtn.addEventListener("click", () => closeModal(replaceExcelModal));
