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
    const roll = document.getElementById("search-roll").value.trim().toLowerCase();
    const name = document.getElementById("search-name").value.trim().toLowerCase();
    const father = document.getElementById("search-father").value.trim().toLowerCase();
    const mother = document.getElementById("search-mother").value.trim().toLowerCase();

    if (!examId) {
        alert("Please select an Examination to perform the search query.");
        return;
    }

    try {
       let q = query(
    collection(db, "resultStudents"),
    where("examId","==",examId)
);

        // Apply filters dynamically using standard indexes
        if (roll) {
            q = query(q, where("rollNo", "==", roll));
        }
        if (name) {
            // Firestore prefix matching implementation
            q = query(q, where("searchName", ">=", name), where("name_search", "<=", name + "\uf8ff"));
        }
        if (father) {
            q = query(q, where("searchFather", ">=", father), where("fatherName_search", "<=", father + "\uf8ff"));
        }
        if (mother) {
            q = query(q, where("searchMother", ">=", mother), where("motherName_search", "<=", mother + "\uf8ff"));
        }

        const querySnapshot = await getDocs(q);
        renderMatchesList(querySnapshot);

    } catch (error) {
        console.error("Query Execution Fault: ", error);
        alert("The search query could not be completed. Make sure you have created the composite indexes required by Firestore in your project console if combining multiple search fields.");
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
                <th>Result Status</th>
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
            <td><span style="font-weight: 500; color: ${(student.resultStatus || "Selected").toLowerCase() === 'pass' ? 'var(--success-color)' : 'var(--error-color)'}">${student.resultStatus || "Selected"}</span></td>
            <td style="text-align: center;">
                <button class="secondary-btn" style="padding: 0.35rem 0.7rem; font-size: 0.85rem;" id="btn-${doc.id}">View Certificate</button>
            </td>
        `;
        tbody.appendChild(tr);

        // Bind dynamic listener
        document.getElementById(`btn-${doc.id}`).addEventListener("click", () => showMarksheet(student));
    });
}

// Populate marksheet UI layout structure exactly like official certificate templates
async function showMarksheet(student) {
    // Look up parent exam collection name parameter mapping
    let examName = "Semester Exam Evaluation Report";
    try {
   const examDoc = await getDoc(doc(db, "results", student.examId));
        if (examDoc.exists()) {
        examName = examDoc.data().examName;
    } catch (err) {
        console.error("Could not fetch corresponding examination attributes.", err);
    }

    // Set textual details
    document.getElementById("ms-exam-title").textContent = examName;
    document.getElementById("ms-roll").textContent = student.rollNo;
    document.getElementById("ms-name").textContent = student.name;
    document.getElementById("ms-father").textContent = student.fatherName;
    document.getElementById("ms-mother").textContent = student.motherName;
    document.getElementById("ms-total").textContent = student.totalMarks;
    
    const statusEl = document.getElementById("ms-status");
    statusEl.textContent = student.resultStatus;
    statusEl.style.color = student.resultStatus.toLowerCase() === "pass" ? "#1b5e20" : "#b71c1c";

    const dateToday = new Date().toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' });
    document.getElementById("ms-date").textContent = dateToday;

    // Populating sub grades
    const tbody = document.getElementById("ms-grades-tbody");
    tbody.innerHTML = "";
    
    if (student.subjects && student.subjects.length > 0) {
        student.subjects.forEach(sub => {
            const tr = document.createElement("tr");
            tr.innerHTML = `
                <td>${sub.subjectName}</td>
                <td style="text-align: center; font-weight: bold;">${sub.marks}</td>
            `;
            tbody.appendChild(tr);
        });
    } else {
        tbody.innerHTML = `<tr><td colspan="2" style="text-align: center; color: var(--text-muted);">No individual course metrics listed</td></tr>`;
    }

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
    const rollNoStr = document.getElementById("ms-roll").textContent || "result";

    // Set pixel density properties to ensure crisp typography rendering
    html2canvas(target, {
        scale: 2, 
        useCORS: true,
        logging: false,
        backgroundColor: "#ffffff"
    }).then(canvas => {
        const imageURI = canvas.toDataURL("image/png");
        const triggerDownloadLink = document.createElement("a");
        triggerDownloadLink.download = `Result_${rollNoStr}.png`;
        triggerDownloadLink.href = imageURI;
        document.body.appendChild(triggerDownloadLink);
        triggerDownloadLink.click();
        document.body.removeChild(triggerDownloadLink);
    }).catch(error => {
        console.error("Canvas transformation interrupted: ", error);
        alert("Unable to convert the document structure into an image.");
    });
});
