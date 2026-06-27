import {
    db,
    collection,
    getDocs,
    query,
    where,
    doc,
    getDoc
} from "./firebase.js";

// --- DOM Element Selection ---
const searchForm = document.getElementById("search-form");
const examSelector = document.getElementById("search-exam");
const resultsListSection = document.getElementById("results-list-section");
const resultsTableContainer = document.getElementById("results-table-container");
const marksheetOuterContainer = document.getElementById("marksheet-outer-container");
const downloadBtn = document.getElementById("download-btn");
const closeReportBtn = document.getElementById("close-report-btn");

// --- Data Cleaning and Transformation Functions ---

/**
 * Corrects gender values.
 * @param {string} rawGender - The raw gender string from the database.
 * @returns {string} The cleaned gender value ('Male', 'Female', 'Other', or 'N/A').
 */
function cleanGender(rawGender) {
    if (typeof rawGender !== 'string') return "N/A";
    const gender = rawGender.trim().toUpperCase();
    if (gender === 'M' || gender === 'MALE') return 'Male';
    if (gender === 'F' || gender === 'FEMALE') return 'Female';
    if (gender) return rawGender; // Return original if not empty but unrecognized
    return "N/A";
}

/**
 * Ensures category fields are displayed correctly.
 * @param {string} category - The category string from the database.
 * @returns {string} The cleaned category or 'N/A'.
 */
function cleanCategory(category) {
    return category ? category.trim().toUpperCase() : "N/A";
}

/**
 * Parses and formats NET marks.
 * @param {any} netMarks - The raw NET marks value.
 * @returns {number|string} The numeric value of NET marks or 'N/A'.
 */
function cleanNetMarks(netMarks) {
    if (netMarks === null || netMarks === undefined) return "N/A";
    const num = parseFloat(netMarks);
    return isNaN(num) ? "N/A" : num;
}


// --- Core Application Logic ---

/**
 * Loads all exams from the 'results' collection into the exam dropdown.
 */
async function loadExams() {
    try {
        const examsSnapshot = await getDocs(collection(db, "results"));
        examSelector.innerHTML = `<option value="">-- Select an Examination --</option>`;
        examsSnapshot.forEach(docSnapshot => {
            const data = docSnapshot.data();
            const option = document.createElement("option");
            option.value = docSnapshot.id;
            option.textContent = data.examName;
            examSelector.appendChild(option);
        });
    } catch (error) {
        console.error("Error loading exams:", error);
        alert("A critical error occurred while loading examinations. Please refresh the page.");
    }
}

/**
 * Handles the search form submission.
 * @param {Event} event - The form submission event.
 */
async function handleSearch(event) {
    event.preventDefault();
    const selectedExamId = examSelector.value;

    // --- Input Validation ---
    if (!selectedExamId) {
        alert("Please select an examination before searching.");
        return;
    }

    const searchCriteria = {
        rollNo: document.getElementById("search-roll").value.trim(),
        name: document.getElementById("search-name").value.trim().toLowerCase(),
        fatherName: document.getElementById("search-father").value.trim().toLowerCase(),
        motherName: document.getElementById("search-mother").value.trim().toLowerCase()
    };

    if (Object.values(searchCriteria).every(val => !val)) {
        alert("Please provide at least one search criterion (e.g., Roll Number, Name, etc.).");
        return;
    }

    // --- Query Construction ---
    const queries = [];
    const baseQuery = collection(db, "resultStudents");

    // Create a query for each filled input field
    if (searchCriteria.rollNo) {
        queries.push(query(baseQuery, where("examId", "==", selectedExamId), where("rollNo", "==", searchCriteria.rollNo)));
    }
    if (searchCriteria.name) {
        queries.push(query(baseQuery, where("examId", "==", selectedExamId), where("searchName", "==", searchCriteria.name)));
    }
    if (searchCriteria.fatherName) {
        queries.push(query(baseQuery, where("examId", "==", selectedExamId), where("searchFather", "==", searchCriteria.fatherName)));
    }
    if (searchCriteria.motherName) {
        queries.push(query(baseQuery, where("examId", "==", selectedExamId), where("searchMother", "==", searchCriteria.motherName)));
    }

    // --- Query Execution and Result Merging ---
    try {
        const querySnapshots = await Promise.all(queries.map(q => getDocs(q)));
        const uniqueResults = new Map();

        querySnapshots.forEach(snapshot => {
            snapshot.forEach(docSnapshot => {
                if (!uniqueResults.has(docSnapshot.id)) {
                    uniqueResults.set(docSnapshot.id, docSnapshot.data());
                }
            });
        });

        renderResultsTable(Array.from(uniqueResults.values()));
    } catch (error) {
        console.error("Search query failed:", error);
        alert("An error occurred during the search. Please check the console for more details.");
    }
}


/**
 * Renders the search results in a table.
 * @param {Array<Object>} results - An array of student data objects.
 */
function renderResultsTable(results) {
    resultsListSection.style.display = "block";
    resultsTableContainer.innerHTML = "";

    if (results.length === 0) {
        resultsTableContainer.innerHTML = `<p style="color: var(--text-muted); padding: 1rem;">No matching student records found.</p>`;
        return;
    }

    const table = document.createElement("table");
    table.innerHTML = `
        <thead>
            <tr>
                <th>Roll No</th>
                <th>Candidate Name</th>
                <th>Father's Name</th>
                <th>Category</th>
                <th>NET Marks</th>
                <th style="text-align: center;">Action</th>
            </tr>
        </thead>
        <tbody id="results-tbody"></tbody>
    `;
    resultsTableContainer.appendChild(table);

    const tableBody = document.getElementById("results-tbody");
    results.forEach(studentData => {
        const row = document.createElement("tr");
        const netMarks = cleanNetMarks(studentData.net);

        row.innerHTML = `
            <td><strong>${studentData.rollNo}</strong></td>
            <td>${studentData.name}</td>
            <td>${studentData.fatherName}</td>
            <td>${cleanCategory(studentData.category)}</td>
            <td><strong>${netMarks}</strong></td>
            <td style="text-align: center;">
                <button class="secondary-btn" style="padding: 0.35rem 0.7rem; font-size: 0.85rem;">View Result</button>
            </td>
        `;

        row.querySelector("button").addEventListener("click", () => {
            displayMarksheet(studentData);
        });

        tableBody.appendChild(row);
    });
}

/**
 * Displays the detailed marksheet for a selected student.
 * @param {Object} studentData - The data object for the student.
 */
async function displayMarksheet(studentData) {
    let examTitle = studentData.examName || "Examination Report";

    try {
        const examDoc = await getDoc(doc(db, "results", studentData.examId));
        if (examDoc.exists()) {
            examTitle = examDoc.data().examName;
        }
    } catch (error) {
        console.error("Error fetching exam name:", error);
        // Non-critical error, proceed with the default title
    }

    const marksheetElement = document.getElementById("marksheet-capture-target");
    const currentDate = new Date().toLocaleDateString('en-GB', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });

    // Apply data cleaning functions
    const cleanedData = {
        rollNo: studentData.rollNo || "N/A",
        name: studentData.name || "N/A",
        fatherName: studentData.fatherName || "N/A",
        motherName: studentData.motherName || "N/A",
        dob: studentData.dob || "N/A",
        gender: cleanGender(studentData.gender),
        category: cleanCategory(studentData.category),
        selectionCategory: cleanCategory(studentData.selectionCategory),
        net: cleanNetMarks(studentData.net)
    };

    marksheetElement.innerHTML = `
        <div class="marksheet-header" style="text-align: center; margin-bottom: 20px; border-bottom: 2px solid #333; padding-bottom: 10px;">
            <h2 style="margin: 0; font-size: 1.5rem; color: #1a237e;">RAJASTHAN STAFF SELECTION BOARD</h2>
            <p style="margin: 5px 0 0; font-weight: bold; color: #555; text-transform: uppercase;">${examTitle}</p>
            <p style="margin: 5px 0 0; font-size: 0.85rem; letter-spacing: 1px; color: #777;">OFFICIAL RESULT SHEET</p>
        </div>
        <table style="width: 100%; border-collapse: collapse; margin-top: 15px;">
            <tbody>
                <tr style="border-bottom: 1px solid #ddd;"><td style="padding: 10px; font-weight: bold; width: 40%;">Roll Number</td><td style="padding: 10px;">${cleanedData.rollNo}</td></tr>
                <tr style="border-bottom: 1px solid #ddd;"><td style="padding: 10px; font-weight: bold;">Candidate Name</td><td style="padding: 10px; text-transform: uppercase;">${cleanedData.name}</td></tr>
                <tr style="border-bottom: 1px solid #ddd;"><td style="padding: 10px; font-weight: bold;">Father's Name</td><td style="padding: 10px; text-transform: uppercase;">${cleanedData.fatherName}</td></tr>
                <tr style="border-bottom: 1px solid #ddd;"><td style="padding: 10px; font-weight: bold;">Mother's Name</td><td style="padding: 10px; text-transform: uppercase;">${cleanedData.motherName}</td></tr>
                <tr style="border-bottom: 1px solid #ddd;"><td style="padding: 10px; font-weight: bold;">Date of Birth</td><td style="padding: 10px;">${cleanedData.dob}</td></tr>
                <tr style="border-bottom: 1px solid #ddd;"><td style="padding: 10px; font-weight: bold;">Gender</td><td style="padding: 10px;">${cleanedData.gender}</td></tr>
                <tr style="border-bottom: 1px solid #ddd;"><td style="padding: 10px; font-weight: bold;">Category</td><td style="padding: 10px;">${cleanedData.category}</td></tr>
                <tr style="border-bottom: 1px solid #ddd;"><td style="padding: 10px; font-weight: bold;">Selection Category</td><td style="padding: 10px;">${cleanedData.selectionCategory}</td></tr>
                <tr style="border-bottom: 2px solid #333; background-color: #f9f9f9;"><td style="padding: 12px; font-weight: bold; color: #1a237e; font-size: 1.1rem;">NET Marks</td><td style="padding: 12px; font-weight: bold; color: #1a237e; font-size: 1.1rem;">${cleanedData.net}</td></tr>
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
    marksheetOuterContainer.scrollIntoView({
        behavior: 'smooth'
    });
}

/**
 * Downloads the marksheet element as a PNG image.
 */
function downloadMarksheet() {
    const target = document.getElementById("marksheet-capture-target");
    html2canvas(target, {
        scale: 2.5, // Increase scale for better resolution
        useCORS: true,
        logging: false,
        backgroundColor: "#ffffff"
    }).then(canvas => {
        const link = document.createElement("a");
        link.href = canvas.toDataURL("image/png");
        link.download = `Result-Marksheet.png`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }).catch(error => {
        console.error("Failed to download marksheet:", error);
        alert("Sorry, the marksheet download failed. Please try again.");
    });
}


// --- Event Listeners ---
document.addEventListener("DOMContentLoaded", loadExams);
searchForm.addEventListener("submit", handleSearch);
closeReportBtn.addEventListener("click", () => marksheetOuterContainer.style.display = "none");
downloadBtn.addEventListener("click", downloadMarksheet);
