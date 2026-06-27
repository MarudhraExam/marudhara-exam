import {
    db,
    collection,
    addDoc,
    getDocs,
    doc,
    deleteDoc,
    updateDoc,
    writeBatch,
    query,
    where,
    serverTimestamp,
    orderBy,
    limit,
    getDoc
} from './firebase.js';
const examForm = document.getElementById('exam-form');
const examIdInput = document.getElementById('exam-id');
const examNameInput = document.getElementById('exam-name');
const excelFileInput = document.getElementById('excel-file');
const submitBtn = document.getElementById('submit-btn');
const cancelBtn = document.getElementById('cancel-btn');
const formActionTitle = document.getElementById('form-action-title');

const progressWrapper = document.getElementById('progress-wrapper');
const progressLabel = document.getElementById('progress-label');
const progressPercent = document.getElementById('progress-percent');
const progressFill = document.getElementById('progress-fill');
const progressLog = document.getElementById('progress-log');

const examsList = document.getElementById('exams-list');

const replaceModal = document.getElementById('replace-modal');
const replaceForm = document.getElementById('replace-form');
const replaceExamIdInput = document.getElementById('replace-exam-id');
const replaceExcelFileInput = document.getElementById('replace-excel-file');
const closeReplaceModalBtn = document.getElementById('close-replace-modal');

const replaceProgressWrapper = document.getElementById('replace-progress-wrapper');
const replaceProgressLabel = document.getElementById('replace-progress-label');
const replaceProgressPercent = document.getElementById('replace-progress-percent');
const replaceProgressFill = document.getElementById('replace-progress-fill');
const replaceProgressLog = document.getElementById('replace-progress-log');

// --- Firestore Initialization ---
const resultsCollection = collection(db, 'results');
const studentsCollection = collection(db, 'resultStudents');
const BATCH_SIZE = 400;

const handleFormSubmit = async (e) => {
    e.preventDefault();
    const examId = examIdInput.value;
    const examName = examNameInput.value.trim();
    const file = excelFileInput.files[0];

    if (!examName) {
        showError("Exam Name is required.");
        return;
    }

    submitBtn.disabled = true;

    if (examId) {
        // Update existing exam name
        await updateExam(examId, examName);
    } else {
        // Create new exam
        if (!file) {
            showError("An Excel file is required to create a new exam.");
            submitBtn.disabled = false;
            return;
        }
        await createExam(examName, file);
    }

    resetForm();
    await fetchExams();
};

const handleExamsListClick = async (e) => {
    const target = e.target.closest('button');
    if (!target) return;

    const examId = target.dataset.id;
    const examName = target.dataset.name;

    if (target.classList.contains('edit-btn')) {
        setupEditForm(examId, examName);
    } else if (target.classList.contains('delete-btn')) {
        if (confirm(`Are you sure you want to delete the exam "${examName}" and all its student records? This action cannot be undone.`)) {
            await deleteExam(examId, examName);
            await fetchExams();
        }
    } else if (target.classList.contains('replace-btn')) {
        setupReplaceModal(examId, examName);
    }
};

const handleReplaceFormSubmit = async (e) => {
    e.preventDefault();
    const examId = replaceExamIdInput.value;
    const file = replaceExcelFileInput.files[0];

    if (!file) {
        showError("Please select a new Excel file to replace the old one.", true);
        return;
    }

    document.querySelector('#replace-form button[type="submit"]').disabled = true;
    await replaceExam(examId, file);
    closeReplaceModal();
    await fetchExams();
};

const fetchExams = async () => {
    try {
        const q = query(resultsCollection, orderBy("createdAt", "desc"));
        const snapshot = await getDocs(q);
        examsList.innerHTML = ''; // Clear existing list
        if (snapshot.empty) {
            examsList.innerHTML = '<tr><td colspan="5">No exams found.</td></tr>';
            return;
        }
        snapshot.forEach(doc => {
            const exam = doc.data();
            const examId = doc.id;
            const createdAt = exam.createdAt?.toDate().toLocaleDateString() || 'N/A';
            const row = `
                <tr>
                    <td>${exam.examName}</td>
                    <td>${exam.fileName}</td>
                    <td>${createdAt}</td>
                    <td>${exam.studentsCount}</td>
                    <td>
                        <button class="btn replace-btn" data-id="${examId}" data-name="${exam.examName}">Replace Excel</button>
                        <button class="btn edit-btn" data-id="${examId}" data-name="${exam.examName}">Edit Name</button>
                        <button class="btn btn-danger delete-btn" data-id="${examId}" data-name="${exam.examName}">Delete</button>
                    </td>
                </tr>
            `;
            examsList.innerHTML += row;
        });
    } catch (error) {
        showError("Error fetching exams: " + error.message);
        console.error("Error fetching exams: ", error);
    }
};

const createExam = async (examName, file) => {
    resetProgress({ wrapper: progressWrapper, fill: progressFill, percent: progressPercent, log: progressLog });
    progressLabel.textContent = "Reading Excel file...";
    progressWrapper.style.display = 'block';

    try {
        const students = await readExcel(file);
        if (students.length === 0) {
            showError("No valid student data found in the Excel file. Check for blank rows or incorrect format.");
            resetForm();
            return;
        }

        progressLog.textContent = `Found ${students.length} student records. Creating exam document...`;
        
        // 1. Create Exam Document
        const examDocRef = await addDoc(resultsCollection, {
            examName: examName,
            fileName: file.name,
            studentsCount: students.length,
            createdAt: serverTimestamp()
        });

        const examId = examDocRef.id;
        progressLog.textContent = "Exam document created. Starting student import...";
        
        // 2. Batch Import Students
        await batchImportStudents(students, examId, examName, {
            wrapper: progressWrapper,
            fill: progressFill,
            percent: progressPercent,
            log: progressLog
        });
        
        showSuccess(`Successfully imported exam "${examName}" with ${students.length} students.`);

    } catch (error) {
        showError(`Error during exam creation: ${error.message}`);
        console.error(error);
        // Cleanup if exam doc was created but import failed
        const q = query(resultsCollection, where("examName", "==", examName), where("fileName", "==", file.name));
        const snapshot = await getDocs(q);
        if(!snapshot.empty) {
            snapshot.forEach(doc => deleteDoc(doc.ref));
            progressLog.textContent += "\nRolled back exam creation due to an error.";
        }
    } finally {
        setTimeout(() => resetProgress({ wrapper: progressWrapper, fill: progressFill, percent: progressPercent, log: progressLog }), 5000);
        resetForm();
    }
};

const replaceExam = async (examId, newFile) => {
    const progressUI = {
        wrapper: replaceProgressWrapper,
        fill: replaceProgressFill,
        percent: replaceProgressPercent,
        log: replaceProgressLog
    };
    resetProgress(progressUI);
    replaceProgressLabel.textContent = "Starting replacement process...";
    progressUI.wrapper.style.display = 'block';

    try {
        const examDocRef = doc(db, "results", examId);
        const examDoc = await getDoc(examDocRef);
        if (!examDoc.exists()) {
            throw new Error("Exam to replace not found.");
        }
        
        // 1. Delete previous student records
        progressUI.log.textContent = "Deleting old student records...";
        await deleteStudentsByExamId(examId, progressUI);

        // 2. Read new Excel file
        progressUI.log.textContent = "Reading new Excel file...";
        const students = await readExcel(newFile);
        if (students.length === 0) {
            throw new Error("No valid student data found in the new Excel file.");
        }
        progressUI.log.textContent = `Found ${students.length} new records. Starting import...`;

        // 3. Batch import new students
        const examName = examDoc.data().examName;
        await batchImportStudents(students, examId, examName, progressUI);
        
        // 4. Update the main exam document
        await updateDoc(examDocRef, {
            studentsCount: students.length,
            fileName: newFile.name,
            createdAt: serverTimestamp() // Update timestamp to reflect the change
        });

        showSuccess(`Successfully replaced Excel for exam "${examName}".`);

    } catch(error) {
        showError(`Error replacing exam: ${error.message}`, true);
        console.error(error);
    } finally {
        setTimeout(() => {
             resetProgress(progressUI);
             document.querySelector('#replace-form button[type="submit"]').disabled = false;
        }, 5000);
    }
};

const deleteExam = async (examId, examName) => {
    try {
        // 1. Delete all student documents for this exam
        await deleteStudentsByExamId(examId);

        // 2. Delete the main exam document
        await deleteDoc(doc(db, "results", examId));

        showSuccess(`Successfully deleted exam "${examName}".`);
    } catch (error) {
        showError(`Error deleting exam: ${error.message}`);
        console.error(error);
    }
};

const updateExam = async (examId, newExamName) => {
    progressLabel.textContent = "Updating exam name...";
    progressWrapper.style.display = 'block';
    
    try {
        // 1. Update the main exam document
        const examDocRef = doc(db, "results", examId);
        await updateDoc(examDocRef, { examName: newExamName });
        progressLog.textContent = "Main exam document updated.";

        // 2. Update all associated student documents
        progressLog.innerHTML += "<br>Updating student records...";
        const q = query(studentsCollection, where("examId", "==", examId));
        const snapshot = await getDocs(q);

        if (snapshot.empty) {
            progressLog.innerHTML += "<br>No student records to update.";
            showSuccess("Exam name updated successfully (no students were associated).");
            return;
        }

        let processedCount = 0;
        const total = snapshot.docs.length;
        let batch = writeBatch(db);
        let batchCount = 0;

        for (const studentDoc of snapshot.docs) {
            batch.update(studentDoc.ref, { examName: newExamName });
            batchCount++;
            processedCount++;

            if (batchCount === BATCH_SIZE || processedCount === total) {
                await batch.commit();
                updateProgress(processedCount, total, {
                    fill: progressFill,
                    percent: progressPercent,
                    log: progressLog
                }, "Updating student records...");
                batch = writeBatch(db);
                batchCount = 0;
            }
        }

        showSuccess(`Successfully updated exam name to "${newExamName}".`);
    } catch (error) {
        showError(`Error updating exam name: ${error.message}`);
        console.error(error);
    } finally {
        setTimeout(() => resetProgress({ wrapper: progressWrapper, fill: progressFill, percent: progressPercent, log: progressLog }), 5000);
        resetForm();
    }
};

const readExcel = (file) => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();

        reader.onload = (e) => {
            try {
                const data = new Uint8Array(e.target.result);
                const workbook = XLSX.read(data, { type: "array" });

                const students = [];

                // ===== FIRST SHEET HEADER =====
                const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
                const firstData = XLSX.utils.sheet_to_json(firstSheet, {
                    header: 1,
                    defval: ""
                });

const headers = firstData[0].map(h =>
    String(h)
        .trim()
        .toUpperCase()
        .replace(/\r/g, "")
        .replace(/\n/g, "")
        .replace(/\s+/g, "")
        .replace(/_/g, "")
);
                const col = {};

                headers.forEach((h, i) => {
                    col[h] = i;
                });
console.log(headers);
console.log(col);
                // ===== ALL SHEETS =====
                workbook.SheetNames.forEach((sheetName, sheetIndex) => {

                    const ws = workbook.Sheets[sheetName];

                    const rows = XLSX.utils.sheet_to_json(ws, {
                        header: 1,
                        defval: ""
                    });

                    // First sheet -> header skip
                    // Other sheets -> data starts from row 0
                    const startRow = sheetIndex === 0 ? 1 : 0;

                    for (let i = startRow; i < rows.length; i++) {

                        const row = rows[i];

                        if (!row || row.every(c => String(c).trim() === "")) continue;

                        const rollNo = String(row[col["ROLL_NO"]] || "").trim();
                        const name = String(row[col["CAND_NAME"]] || "").trim();
                        const fatherName = String(row[col["FATHER_NAME"]] || "").trim();
                        const motherName = String(row[col["MOTHER_NAME"]] || "").trim();

                        students.push({

                            rank: String(row[col["RANK"]] || "").trim(),

                            applicationNo: String(row[col["APPLICATION"]] || "").trim(),

                            rollNo,

                            name,

                            fatherName,

                            motherName,

                            dob: String(row[col["DOB"]] || "").trim(),

                            gender: String(row[col["GENDER"]] || "").trim(),

                            category: String(row[col["CAT"]] || "").trim(),

                            horizontalCategory: String(row[col["HCAT"]] || "").trim(),

                            femaleCategory: String(row[col["FCAT"]] || "").trim(),

                            tsp: String(row[col["TSP"]] || "").trim(),

                            netMarks: String(row[col["NET"]] || "").trim(),

                            selectionCategory: String(row[col["SEL_CAT"]] || row[col["SEL_CAT."]] || "").trim(),

                            searchRoll: rollNo.toLowerCase(),

                            searchName: name.toLowerCase(),

                            searchFather: fatherName.toLowerCase(),

                            searchMother: motherName.toLowerCase()
                        });
                    }

                });

                resolve(students);

            } catch (err) {
                reject(err);
            }
        };

        reader.readAsArrayBuffer(file);
    });
};
const batchImportStudents = async (students, examId, examName, progressUI) => {
    let batch = writeBatch(db);
    let batchCount = 0;
    const totalStudents = students.length;
    const normalizedExamId = String(examId || '').trim();
    const normalizedExamName = String(examName || '').trim();

    for (let i = 0; i < totalStudents; i++) {
        const student = students[i];
        const studentRef = doc(collection(db, 'resultStudents'));
        batch.set(studentRef, {
            ...student,
            examId: normalizedExamId,
            examName: normalizedExamName,
            createdAt: serverTimestamp()
        });
        batchCount++;

        if (batchCount === BATCH_SIZE || i === totalStudents - 1) {
            await batch.commit();
            updateProgress(i + 1, totalStudents, progressUI, "Uploading student data...");
            // Reset for the next batch
            batch = writeBatch(db);
            batchCount = 0;
        }
    }
};

const deleteStudentsByExamId = async (examId, progressUI) => {
    let shouldContinue = true;
    let deletedCount = 0;
    
    while(shouldContinue) {
        const q = query(studentsCollection, where("examId", "==", examId), limit(BATCH_SIZE));
        const snapshot = await getDocs(q);

        if (snapshot.empty) {
            shouldContinue = false;
            break;
        }
        
        const batch = writeBatch(db);
        snapshot.docs.forEach(doc => batch.delete(doc.ref));
        await batch.commit();
        
        deletedCount += snapshot.size;
        if(progressUI) {
             progressUI.log.textContent = `Deleted ${deletedCount} old student records...`;
        }
    }
};

const resetForm = () => {
    examForm.reset();
    examIdInput.value = '';
    formActionTitle.textContent = 'Import New Exam Result';
    submitBtn.textContent = 'Import Excel Result';
    submitBtn.disabled = false;
    cancelBtn.style.display = 'none';
    excelFileInput.disabled = false;
    excelFileInput.required = true;
};

const setupEditForm = (examId, examName) => {
    examIdInput.value = examId;
    examNameInput.value = examName;
    formActionTitle.textContent = 'Edit Exam Name';
    submitBtn.textContent = 'Update Name';
    excelFileInput.disabled = true;
    excelFileInput.required = false;
    cancelBtn.style.display = 'inline-block';
    window.scrollTo(0, 0);
};

const setupReplaceModal = (examId, examName) => {
    replaceExamIdInput.value = examId;
    document.querySelector('#replace-modal h2').textContent = `Replace Excel for "${examName}"`;
    replaceModal.style.display = 'block';
};

const closeReplaceModal = () => {
    replaceModal.style.display = 'none';
    replaceForm.reset();
    resetProgress({
        wrapper: replaceProgressWrapper,
        fill: replaceProgressFill,
        percent: replaceProgressPercent,
        log: replaceProgressLog
    });
     document.querySelector('#replace-form button[type="submit"]').disabled = false;
};


const updateProgress = (current, total, ui, message) => {
    const percentage = Math.round((current / total) * 100);
    ui.fill.style.width = percentage + '%';
    ui.percent.textContent = percentage + '%';
    ui.log.textContent = `${message} ${current} of ${total}`;
};

const resetProgress = (ui) => {
    ui.wrapper.style.display = 'none';
    ui.fill.style.width = '0%';
    ui.percent.textContent = '0%';
    ui.log.textContent = '';
};

const showSuccess = (message) => {
    // A more robust solution would be a dedicated notification element.
    alert(message);
};

const showError = (message, isModal = false) => {
    if (isModal) {
        replaceProgressLog.textContent = `ERROR: ${message}`;
        replaceProgressLog.style.color = "red";
    } else {
        progressLog.textContent = `ERROR: ${message}`;
        progressLog.style.color = "red";
        progressWrapper.style.display = 'block';
    }
    alert(`ERROR: ${message}`);
};

// --- Initializer ---
document.addEventListener('DOMContentLoaded', () => {
    examForm.addEventListener('submit', handleFormSubmit);
    examsList.addEventListener('click', handleExamsListClick);
    cancelBtn.addEventListener('click', resetForm);
    
    replaceForm.addEventListener('submit', handleReplaceFormSubmit);
    closeReplaceModalBtn.addEventListener('click', closeReplaceModal);
    window.addEventListener('click', (e) => {
        if (e.target === replaceModal) {
            closeReplaceModal();
        }
    });

    fetchExams();
});
