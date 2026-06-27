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

// Populate examinations selector dropdown list
async function loadExams() {
    try {
        const querySnapshot = await getDocs(collection(db, "results"));
        examSelector.innerHTML = `<option value="">-- Choose Target Exam --</option>`;
        querySnapshot.forEach(doc => {
            const data = doc.data();
            const option = document.createElement("option");
            option.value = doc.id;
            option.textContent = data.examName;
            examSelector.appendChild(option);
        });
    } catch (e) {
        console.error("Unable to access exams collection metadata: ", e);
    }
}

document.addEventListener("DOMContentLoaded", loadExams);

// Query Processing Event Listener
searchForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    
    const examId = examSelector.value;
    const roll = document.getElementById("search-roll").value.trim();
    const name = document.getElementById("search-name").value.trim().toLowerCase();
    const father = document.getElementById("search-father").value.trim().toLowerCase();
    const mother = document.getElementById("search-mother").value.trim().toLowerCase();

    if (!examId) {
        alert("Please select an Examination to perform the search query.");
        return;
    }

    try {
       let q;

if (roll) {
    q = query(
        collection(db, "resultStudents"),
        where("examId", "==", examId),
        where("rollNo", "==", roll)
    );
} else if (name) {
    q = query(
        collection(db, "resultStudents"),
        where("examId", "==", examId),
        where("searchName", ">=", name),
        where("searchName", "<=", name + "\uf8ff")
    );
} else if (father) {
    q = query(
        collection(db, "resultStudents"),
        where("examId", "==", examId),
        where("searchFather", ">=", father),
        where("searchFather", "<=", father + "\uf8ff")
    );
} else if (mother) {
    q = query(
        collection(db, "resultStudents"),
        where("examId", "==", examId),
        where("searchMother", ">=", mother),
        where("searchMother", "<=", mother + "\uf8ff")
    );
} else {
    alert("Please enter Roll Number, Name, Father Name or Mother Name.");
    return;
}

const querySnapshot = await getDocs(q);
        if (name) {
            q = query(q, where("searchName", ">=", name), where("searchName", "<=", name + "\uf8ff"));
        }
        if (father) {
            q = query(q, where("searchFather", ">=", father), where("searchFather", "<=", father + "\uf8ff"));
        }
        if (mother) {
            q = query(q, where("searchMother", ">=", mother), where("searchMother", "<=", mother + "\uf8ff"));
        }

        const querySnapshot = await getDocs(q);
        renderMatchesList(querySnapshot);

    } catch (error) {
        console.error("Query Execution Fault: ", error);
        alert("The search query could not be completed. Make sure you have created the required composite indexes in Firestore if combining multiple search fields.");
    }
});

// Render the list of matching student documents
function renderMatchesList(snapshot) {
    resultsListSection.style.display = "block";
    resultsTableContainer.innerHTML = "";

    if (snapshot.empty) {
        resultsTableContainer.innerHTML = `<p style="color: var(--text-muted); padding: 1rem;">No matching candidate records found.</p>`;
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
        <tbody id="matching-results-tbody"></tbody>
    `;
    resultsTableContainer.appendChild(table);

    const tbody = document.getElementById("matching-results-tbody");
    snapshot.forEach(doc => {
        const student = doc.data();
        const tr = document.createElement("tr");
        tr.innerHTML = `
            <td><strong>${student.rollNo}</strong></td>
            <td>${student.name}</td>
            <td>${student.fatherName}</td>
            <td>${student.category || "N/A"}</td>
            <td><strong>${student.net || "N/A"}</strong></td>
            <td style="text-align: center;">
                <button class="secondary-btn" style="padding: 0.35rem 0.7rem; font-size: 0.85rem;" id="btn-${doc.id}">View Result</button>
            </td>
        `;
        tbody.appendChild(tr);

        document.getElementById(`btn-${doc.id}`).addEventListener("click", () => showMarksheet(student));
    });
}

// Populate marksheet UI layout structure with RSSB specific details
async function showMarksheet(student) {
    let examName = "Examination Board Report";
    try {
        const examDoc = await getDoc(doc(db, "results", student.examId));
        if (examDoc.exists()) {
            examName = examDoc.data().examName;
        }
    } catch (err) {
        console.error("Could not fetch corresponding examination attributes.", err);
    }

    const captureTarget = document.getElementById("marksheet-capture-target");
    const dateToday = new Date().toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' });

    captureTarget.innerHTML = `
        <div class="marksheet-header" style="text-align: center; margin-bottom: 20px; border-bottom: 2px solid #333; padding-bottom: 10px;">
            <h2 style="margin: 0; font-size: 1.5rem; color: #1a237e;">RAJASTHAN STAFF SELECTION BOARD, JAIPUR</h2>
            <p style="margin: 5px 0 0; font-weight: bold; color: #555; text-transform: uppercase;">${examName}</p>
            <p style="margin: 5px 0 0; font-size: 0.85rem; letter-spacing: 1px; color: #777;">OFFICIAL RESULT SHEET</p>
        </div>
        <table style="width: 100%; border-collapse: collapse; margin-top: 15px;">
            <tbody>
                <tr style="border-bottom: 1px solid #ddd;"><td style="padding: 10px; font-weight: bold; width: 40%;">Roll Number</td><td style="padding: 10px;">${student.rollNo}</td></tr>
                <tr style="border-bottom: 1px solid #ddd;"><td style="padding: 10px; font-weight: bold;">Candidate Name</td><td style="padding: 10px; text-transform: uppercase;">${student.name}</td></tr>
                <tr style="border-bottom: 1px solid #ddd;"><td style="padding: 10px; font-weight: bold;">Father's Name</td><td style="padding: 10px; text-transform: uppercase;">${student.fatherName}</td></tr>
                <tr style="border-bottom: 1px solid #ddd;"><td style="padding: 10px; font-weight: bold;">Mother's Name</td><td style="padding: 10px; text-transform: uppercase;">${student.motherName}</td></tr>
                <tr style="border-bottom: 1px solid #ddd;"><td style="padding: 10px; font-weight: bold;">Date of Birth</td><td style="padding: 10px;">${student.dob || "N/A"}</td></tr>
                <tr style="border-bottom: 1px solid #ddd;"><td style="padding: 10px; font-weight: bold;">Gender</td><td style="padding: 10px;">${student.gender || "N/A"}</td></tr>
                <tr style="border-bottom: 1px solid #ddd;"><td style="padding: 10px; font-weight: bold;">Category</td><td style="padding: 10px;">${student.category || "N/A"}</td></tr>
                <tr style="border-bottom: 1px solid #ddd;"><td style="padding: 10px; font-weight: bold;">Selection Category</td><td style="padding: 10px;">${student.selectionCategory || "N/A"}</td></tr>
                <tr style="border-bottom: 2px solid #333; background-color: #f9f9f9;"><td style="padding: 12px; font-weight: bold; color: #1a237e; font-size: 1.1rem;">NET Marks</td><td style="padding: 12px; font-weight: bold; color: #1a237e; font-size: 1.1rem;">${student.net || "N/A"}</td></tr>
            </tbody>
        </table>
        <div class="marksheet-footer" style="margin-top: 30px; display: flex; justify-content: space-between; align-items: flex-end;">
            <div style="font-size: 0.85rem; color: #666;">
                Date of Issue: <br>
                <span id="ms-date" style="font-weight: bold; color: #333;">${dateToday}</span>
            </div>
            <div style="text-align: right; font-size: 0.9rem;">
                <strong>Secretary</strong><br>
                <span style="font-size: 0.8rem; color: #555;">Rajasthan Staff Selection Board</span>
            </div>
        </div>
    `;

    // Un-collapse UI component
    marksheetOuterContainer.style.display = "block";
    marksheetOuterContainer.scrollIntoView({ behavior: 'smooth' });
}

// Hide report callback handler
closeReportBtn.addEventListener("click", () => {
    marksheetOuterContainer.style.display = "none";
});

// Render element as Canvas using html2canvas and export PNG file format
downloadBtn.addEventListener("click", () => {
    const target = document.getElementById("marksheet-capture-target");
    
    html2canvas(target, {
        scale: 2, 
        useCORS: true,
        logging: false,
        backgroundColor: "#ffffff"
    }).then(canvas => {
        const imageURI = canvas.toDataURL("image/png");
        const triggerDownloadLink = document.createElement("a");
        triggerDownloadLink.download = `Result_Details.png`;
        triggerDownloadLink.href = imageURI;
        document.body.appendChild(triggerDownloadLink);
        triggerDownloadLink.click();
        document.body.removeChild(triggerDownloadLink);
    }).catch(error => {
        console.error("Canvas transformation interrupted: ", error);
        alert("Unable to convert the document structure into an image.");
    });
});
