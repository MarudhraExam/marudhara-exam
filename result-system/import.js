import { 
    db, 
    collection, 
    addDoc, 
    setDoc, 
    getDocs, 
    doc, 
    deleteDoc, 
    writeBatch, 
    query, 
    where 
} from "./firebase.js";

// Set path to PDFJS workers
pdfjsLib.GlobalWorkerOptions.workerSrc = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";

const uploadForm = document.getElementById("upload-form");
const examNameInput = document.getElementById("exam-name");
const fileInput = document.getElementById("pdf-file");
const progressContainer = document.getElementById("progress-container");
const progressFill = document.getElementById("progress-fill");
const progressStatus = document.getElementById("progress-status");
const examsListContainer = document.getElementById("exams-list");
const submitBtn = document.getElementById("submit-btn");
const cancelBtn = document.getElementById("cancel-btn");
const editExamIdInput = document.getElementById("edit-exam-id");
const formTitle = document.getElementById("form-title");

let editingExamId = null;

document.addEventListener("DOMContentLoaded", fetchExams);

// Fetch examinations listing
async function fetchExams() {
    try {
        const querySnapshot = await getDocs(collection(db, "exams"));
        examsListContainer.innerHTML = "";
        
        if (querySnapshot.empty) {
            examsListContainer.innerHTML = `<p style="color: var(--text-muted);">No published exams found.</p>`;
            return;
        }

        querySnapshot.forEach((doc) => {
            const exam = doc.data();
            const div = document.createElement("div");
            div.className = "exam-item";
            div.innerHTML = `
                <div>
                    <strong>${exam.name}</strong><br>
                    <small style="color: var(--text-muted);">PDF Source: ${exam.pdfName || 'Manually entered'}</small>
                </div>
                <div>
                    <button class="secondary-btn" style="padding: 0.4rem 0.8rem; font-size: 0.85rem;" onclick="window.editExam('${doc.id}', '${exam.name}')">Edit Name</button>
                    <button class="danger" style="padding: 0.4rem 0.8rem; font-size: 0.85rem;" onclick="window.deleteExam('${doc.id}')">Delete</button>
                </div>
            `;
            examsListContainer.appendChild(div);
        });
    } catch (error) {
        console.error("Error reading exam documents: ", error);
        alert("Unable to read exams list. Please verify Firestore security configurations.");
    }
}

// Edit exam title initialization
window.editExam = function(id, name) {
    editingExamId = id;
    editExamIdInput.value = id;
    examNameInput.value = name;
    formTitle.textContent = "Modify Exam Settings";
    submitBtn.textContent = "Update Details";
    cancelBtn.style.display = "inline-block";
    document.getElementById("file-group").style.display = "none";
};

// Reset Form State
function resetForm() {
    editingExamId = null;
    editExamIdInput.value = "";
    examNameInput.value = "";
    fileInput.value = "";
    formTitle.textContent = "Upload & Import New Exam";
    submitBtn.textContent = "Parse & Import Records";
    cancelBtn.style.display = "none";
    document.getElementById("file-group").style.display = "block";
    progressContainer.style.display = "none";
}

cancelBtn.addEventListener("click", resetForm);

// Form submit event
uploadForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const examName = examNameInput.value.trim();

    if (editingExamId) {
        // Simple update workflow
        try {
            const examRef = doc(db, "exams", editingExamId);
            await setDoc(examRef, { name: examName }, { merge: true });
            alert("Exam name modified successfully.");
            resetForm();
            fetchExams();
        } catch (error) {
            alert("Update operation encountered an issue.");
        }
        return;
    }

    // New configuration upload workflow
    const file = fileInput.files[0];
    if (!file) {
        alert("Please load a results document file in PDF format to proceed.");
        return;
    }

    try {
        progressContainer.style.display = "block";
        updateProgress(5, "Reading PDF layout parameters...");

        const arrayBuffer = await file.arrayBuffer();
        const extractedText = await extractTextFromPDF(arrayBuffer);
        
        updateProgress(25, "Analysing structure patterns...");
        const students = parseExtractedText(extractedText);
        
        if (students.length === 0) {
            throw new Error("Could not parse student entries. Check the PDF text pattern layout matching instructions.");
        }

        updateProgress(45, `Found ${students.length} matching candidate cards. Saving credentials to Database...`);
        
        // Save overall Exam header details
        const examRef = doc(collection(db, "exams"));
        const examId = examRef.id;
        
        await setDoc(examRef, {
            id: examId,
            name: examName,
            pdfName: file.name,
            createdAt: new Date()
        });

        // Insert extracted students using parallel execution of batches
        await batchSaveStudents(examId, students);

        updateProgress(100, `Successfully complete. Saved ${students.length} student documents.`);
        alert("Imports added successfully.");
        resetForm();
        fetchExams();

    } catch (error) {
        console.error(error);
        alert("Encountered compilation errors: " + error.message);
        progressContainer.style.display = "none";
    }
});

// Parse text lines with Y coordinate mapping to preserve text flow
async function extractTextFromPDF(pdfData) {
    const loadingTask = pdfjsLib.getDocument({ data: pdfData });
    const pdf = await loadingTask.promise;
    let fullText = "";

    for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const textContent = await page.getTextContent();
        const items = textContent.items;
        
        // Arrange items matching line spacing thresholds
        const lineMap = {};
        items.forEach(item => {
            const y = Math.round(item.transform[5]);
            let lineMatched = false;
            for (let targetY in lineMap) {
                if (Math.abs(targetY - y) < 4) {
                    lineMap[targetY].push(item);
                    lineMatched = true;
                    break;
                }
            }
            if (!lineMatched) {
                lineMap[y] = [item];
            }
        });

        const sortedY = Object.keys(lineMap).sort((a, b) => b - a);
        let pageText = "";
        sortedY.forEach(y => {
            const lineItems = lineMap[y].sort((a, b) => a.transform[4] - b.transform[4]);
            const lineString = lineItems.map(item => item.str).join(" ");
            pageText += lineString + "\n";
        });
        fullText += pageText + "\n";
    }
    return fullText;
}

// Map parsed structured lines into separate student documents
function parseExtractedText(text) {
    const lines = text.split("\n").map(l => l.trim()).filter(l => l.length > 0);
    const students = [];

    // Temporary storage containers
    let tempStudent = null;

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];

        // Format Option B check: Single comma-delimited structure line
        if (line.includes("|")) {
            const parts = line.split("|").map(p => p.trim());
            if (parts.length >= 7) {
                const subjects = parseSubjectLine(parts[4]);
                students.push({
                    rollNo: parts[0],
                    name: parts[1],
                    fatherName: parts[2],
                    motherName: parts[3],
                    subjects: subjects,
                    totalMarks: parts[5],
                    resultStatus: parts[6]
                });
            }
            continue;
        }

        // Format Option A Check: Multi-line structural block parsing
        if (line.toLowerCase().startsWith("roll no:") || line.toLowerCase().startsWith("roll:")) {
            if (tempStudent) {
                students.push(tempStudent);
            }
            tempStudent = {
                rollNo: line.split(":")[1].trim(),
                name: "",
                fatherName: "",
                motherName: "",
                subjects: [],
                totalMarks: "",
                resultStatus: ""
            };
        } else if (tempStudent) {
            if (line.toLowerCase().startsWith("name:")) {
                tempStudent.name = line.split(":")[1].trim();
            } else if (line.toLowerCase().startsWith("father's name:") || line.toLowerCase().startsWith("father name:")) {
                tempStudent.fatherName = line.split(":")[1].trim();
            } else if (line.toLowerCase().startsWith("mother's name:") || line.toLowerCase().startsWith("mother name:")) {
                tempStudent.motherName = line.split(":")[1].trim();
            } else if (line.toLowerCase().startsWith("subjects:")) {
                tempStudent.subjects = parseSubjectLine(line.split(":")[1].trim());
            } else if (line.toLowerCase().startsWith("total:")) {
                tempStudent.totalMarks = line.split(":")[1].trim();
            } else if (line.toLowerCase().startsWith("status:") || line.toLowerCase().startsWith("result:")) {
                tempStudent.resultStatus = line.split(":")[1].trim();
                // Push and clear temp
                students.push(tempStudent);
                tempStudent = null;
            }
        }
    }
    
    // Catch residual entries
    if (tempStudent && tempStudent.rollNo) {
        students.push(tempStudent);
    }

    return students;
}

// Convert Subject list into detailed structure arrays
function parseSubjectLine(subStr) {
    // Expected format structure: "Math:85, English:78" or "Math-85 English-78"
    const parsed = [];
    const subjects = subStr.split(/[,;]+/);
    subjects.forEach(sub => {
        const clean = sub.trim();
        if (clean) {
            const separator = clean.includes(":") ? ":" : "-";
            const parts = clean.split(separator).map(p => p.trim());
            if (parts.length >= 2) {
                parsed.push({
                    subjectName: parts[0],
                    marks: parts[1]
                });
            }
        }
    });
    return parsed;
}

// Batch write process for safe handling of large datasets
async function batchSaveStudents(examId, students) {
    const batchSize = 400; // Under the Firestore 500-write limit
    let totalSaved = 0;

    for (let i = 0; i < students.length; i += batchSize) {
        const batch = writeBatch(db);
        const chunk = students.slice(i, i + batchSize);

        chunk.forEach(student => {
            const studentRef = doc(collection(db, "results"));
            batch.set(studentRef, {
                ...student,
                examId: examId,
                // Normalizing values to support reliable client-side searches
                rollNo_search: student.rollNo.toString().toLowerCase().trim(),
                name_search: student.name.toLowerCase().trim(),
                fatherName_search: student.fatherName.toLowerCase().trim(),
                motherName_search: student.motherName.toLowerCase().trim()
            });
        });

        await batch.commit();
        totalSaved += chunk.length;
        
        const percentageProgress = Math.min(45 + Math.round((totalSaved / students.length) * 50), 95);
        updateProgress(percentageProgress, `Storing document packets (${totalSaved}/${students.length})...`);
    }
}

// Progress Bar Status Function
function updateProgress(percentage, text) {
    progressFill.style.width = `${percentage}%`;
    progressStatus.textContent = text;
}

// Delete exam and all matching student documents
window.deleteExam = async function(examId) {
    if (!confirm("Caution: Removing this exam permanently deletes all associated student records. Proceed?")) {
        return;
    }

    try {
        // Query matching student collections
        const q = query(collection(db, "results"), where("examId", "==", examId));
        const recordsSnapshot = await getDocs(q);

        const batch = writeBatch(db);
        recordsSnapshot.forEach(documentDoc => {
            batch.delete(doc(db, "results", documentDoc.id));
        });

        // Delete parent exam document
        batch.delete(doc(db, "exams", examId));
        
        await batch.commit();
        alert("Exam and related student data cleared successfully.");
        fetchExams();
    } catch (error) {
        console.error("Delete sequence failed: ", error);
        alert("Operation encountered issues deleting stored contents.");
    }
};
