import { 
    db, 
    collection, 
    getDocs, 
    query, 
    where, 
    doc, 
    getDoc 
} from "./firebase.js";

const searchForm = document.getElementById("search-form");
const examSelector = document.getElementById("search-exam");
const resultsListSection = document.getElementById("results-list-section");
const resultsTableContainer = document.getElementById("results-table-container");
const marksheetOuterContainer = document.getElementById("marksheet-outer-container");
const downloadBtn = document.getElementById("download-btn");
const closeReportBtn = document.getElementById("close-report-btn");

// Load all exams from results collection into dropdown
async function loadExams() {
    try {
        const examsSnapshot = await getDocs(collection(db, "results"));
        examSelector.innerHTML = `<option value="">-- Load examinations --</option>`;
        examsSnapshot.forEach(docSnapshot => {
            const data = docSnapshot.data();
            const option = document.createElement("option");
            option.value = docSnapshot.id;
            option.textContent = data.examName;
            examSelector.appendChild(option);
        });
    } catch (error) {
        console.error("Error loading exams: ", error);
        alert("Failed to load examinations.");
    }
}

// Initialize on page load
document.addEventListener("DOMContentLoaded", loadExams);

// Handle search form submission
searchForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    
    const selectedExamId = examSelector.value;
    const rollInput = document.getElementById("search-roll").value.trim();
    const nameInput = document.getElementById("search-name").value.trim().toLowerCase();
    const fatherInput = document.getElementById("search-father").value.trim().toLowerCase();
    const motherInput = document.getElementById("search-mother").value.trim().toLowerCase();

    if (!selectedExamId) {
        alert("Please select an examination.");
        return;
    }

    // Check if at least one search field is filled
    if (!rollInput && !nameInput && !fatherInput && !motherInput) {
        alert("Enter Roll Number, Name, Father Name or Mother Name.");
        return;
    }

    try {
        let searchQuery;

        // Build query based on which field is filled
        if (rollInput) {
            searchQuery = query(
                collection(db, "resultStudents"),
                where("examId", "==", selectedExamId),
                where("rollNo", "==", rollInput)
            );
        } else if (nameInput) {
            searchQuery = query(
                collection(db, "resultStudents"),
                where("examId", "==", selectedExamId),
                where("searchName", ">=", nameInput),
                where("searchName", "<=", nameInput + "\uf8ff")
            );
        } else if (fatherInput) {
            searchQuery = query(
                collection(db, "resultStudents"),
                where("examId", "==", selectedExamId),
                where("searchFather", ">=", fatherInput),
                where("searchFather", "<=", fatherInput + "\uf8ff")
            );
        } else if (motherInput) {
            searchQuery = query(
                collection(db, "resultStudents"),
                where("examId", "==", selectedExamId),
                where("searchMother", ">=", motherInput),
                where("searchMother", "<=", motherInput + "\uf8ff")
            );
        }

        // Execute query and render results
        const resultsSnapshot = await getDocs(searchQuery);
        renderResultsTable(resultsSnapshot);

    } catch (error) {
        console.error("Search query error: ", error);
        alert("Search failed. Please ensure composite indexes are created in Firestore if needed.");
    }
});

// Render results in a table
function renderResultsTable(resultsSnapshot) {
    resultsListSection.style.display = "block";
    resultsTableContainer.innerHTML = "";

    if (resultsSnapshot.empty) {
        resultsTableContainer.innerHTML = `<p style="color: var(--text-muted); padding: 1rem;">No matching candidate records found.</p>`;
        return;
    }

    const resultsTable = document.createElement("table");
    resultsTable.innerHTML = `
        <thead>
            <tr>
                <th>Roll No</th>
                <th>Candidate Name</th>
                <th>Father's Name</th>
                <th>Category</th>
                <th>NET</th>
                <th style="text-align: center;">Action</th>
            </tr>
        </thead>
        <tbody id="results-tbody"></tbody>
    `;
    resultsTableContainer.appendChild(resultsTable);

    const resultsBody = document.getElementById("results-tbody");
    
    resultsSnapshot.forEach(docSnapshot => {
        const studentData = docSnapshot.data();
        const row = document.createElement("tr");
        row.innerHTML = `
            <td><strong>${studentData.rollNo}</strong></td>
            <td>${studentData.name}</td>
            <td>${studentData.fatherName}</td>
            <td>${studentData.category || "N/A"}</td>
            <td><strong>${studentData.net || "N/A"}</strong></td>
            <td style="text-align: center;">
                <button class="secondary-btn" style="padding: 0.35rem 0.7rem; font-size: 0.85rem;" data-student-id="${docSnapshot.id}">View Result</button>
            </td>
        `;
        resultsBody.appendChild(row);

        row.querySelector("button").addEventListener("click", () => {
            displayMarksheet(studentData);
        });
    });
}

// Display marksheet for selected student
async function displayMarksheet(studentData) {
    let examTitle = studentData.examName || "Examination Report";
    
    try {
        const examDoc = await getDoc(doc(db, "results", studentData.examId));
        if (examDoc.exists()) {
            examTitle = examDoc.data().examName;
        }
    } catch (error) {
        console.error("Error fetching exam name: ", error);
    }

    const marksheetElement = document.getElementById("marksheet-capture-target");
    const currentDate = new Date().toLocaleDateString(undefined, { 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
    });

    marksheetElement.innerHTML = `
        <div class="marksheet-header" style="text-align: center; margin-bottom: 20px; border-bottom: 2px solid #333; padding-bottom: 10px;">
            <h2 style="margin: 0; font-size: 1.5rem; color: #1a237e;">RAJASTHAN STAFF SELECTION BOARD</h2>
            <p style="margin: 5px 0 0; font-weight: bold; color: #555; text-transform: uppercase;">${examTitle}</p>
            <p style="margin: 5px 0 0; font-size: 0.85rem; letter-spacing: 1px; color: #777;">OFFICIAL RESULT SHEET</p>
        </div>
        <table style="width: 100%; border-collapse: collapse; margin-top: 15px;">
            <tbody>
                <tr style="border-bottom: 1px solid #ddd;"><td style="padding: 10px; font-weight: bold; width: 40%;">Roll Number</td><td style="padding: 10px;">${studentData.rollNo}</td></tr>
                <tr style="border-bottom: 1px solid #ddd;"><td style="padding: 10px; font-weight: bold;">Candidate Name</td><td style="padding: 10px; text-transform: uppercase;">${studentData.name}</td></tr>
                <tr style="border-bottom: 1px solid #ddd;"><td style="padding: 10px; font-weight: bold;">Father's Name</td><td style="padding: 10px; text-transform: uppercase;">${studentData.fatherName}</td></tr>
                <tr style="border-bottom: 1px solid #ddd;"><td style="padding: 10px; font-weight: bold;">Mother's Name</td><td style="padding: 10px; text-transform: uppercase;">${studentData.motherName || "N/A"}</td></tr>
                <tr style="border-bottom: 1px solid #ddd;"><td style="padding: 10px; font-weight: bold;">Date of Birth</td><td style="padding: 10px;">${studentData.dob || "N/A"}</td></tr>
                <tr style="border-bottom: 1px solid #ddd;"><td style="padding: 10px; font-weight: bold;">Gender</td><td style="padding: 10px;">${studentData.gender || "N/A"}</td></tr>
                <tr style="border-bottom: 1px solid #ddd;"><td style="padding: 10px; font-weight: bold;">Category</td><td style="padding: 10px;">${studentData.category || "N/A"}</td></tr>
                <tr style="border-bottom: 1px solid #ddd;"><td style="padding: 10px; font-weight: bold;">Selection Category</td><td style="padding: 10px;">${studentData.selectionCategory || "N/A"}</td></tr>
                <tr style="border-bottom: 2px solid #333; background-color: #f9f9f9;"><td style="padding: 12px; font-weight: bold; color: #1a237e; font-size: 1.1rem;">NET Marks</td><td style="padding: 12px; font-weight: bold; color: #1a237e; font-size: 1.1rem;">${studentData.net || "N/A"}</td></tr>
            </tbody>
        </table>
        <div class="marksheet-footer" style="margin-top: 30px; display: flex; justify-content: space-between; align-items: flex-end;">
            <div style="font-size: 0.85rem; color: #666;">
                Issue Date: <br>
                <span style="font-weight: bold; color: #333;">${currentDate}</span>
            </div>
            <div style="text-align: right; font-size: 0.9rem;">
                <strong>Secretary</strong><br>
                <span style="font-size: 0.8rem; color: #555;">Rajasthan Staff Selection Board</span>
            </div>
        </div>
    `;

    marksheetOuterContainer.style.display = "block";
    marksheetOuterContainer.scrollIntoView({ behavior: 'smooth' });
}

// Close marksheet
closeReportBtn.addEventListener("click", () => {
    marksheetOuterContainer.style.display = "none";
});

// Download marksheet as PNG
downloadBtn.addEventListener("click", () => {
    const targetElement = document.getElementById("marksheet-capture-target");
    
    html2canvas(targetElement, {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: "#ffffff"
    }).then(canvas => {
        const imageData = canvas.toDataURL("image/png");
        const downloadLink = document.createElement("a");
        downloadLink.href = imageData;
        downloadLink.download = "Result_Details.png";
        document.body.appendChild(downloadLink);
        downloadLink.click();
        document.body.removeChild(downloadLink);
    }).catch(error => {
        console.error("PNG export failed: ", error);
        alert("Failed to download marksheet as image.");
    });
});
