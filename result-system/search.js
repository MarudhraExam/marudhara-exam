/**
 * Marudhara Exam - Student Search Portal Controller
 * Facilitates fast query execution, dynamic rendering, and PNG generation.
 */

import {
    db,
    collection,
    getDocs,
    query,
    where,
    orderBy
} from "./firebase-config.js";

// DOM Elements
const examSelect = document.getElementById("examSelect");
const searchForm = document.getElementById("searchForm");
const searchInput = document.getElementById("searchInput");
const loadingSpinner = document.getElementById("loadingSpinner");

const resultsSection = document.getElementById("resultsSection");
const resultsTableBody = document.getElementById("resultsTableBody");
const noResultsMessage = document.getElementById("noResultsMessage");

// Modals elements
const resultModal = document.getElementById("resultModal");
const closeModalBtn = document.getElementById("closeModalBtn");
const downloadPngBtn = document.getElementById("downloadPngBtn");
const markSheetCapture = document.getElementById("markSheetCapture");
const resetBtn = document.getElementById("resetBtn");

// Modals Specific Data Elements
const modalExamName = document.getElementById("modalExamName");
const modalRank = document.getElementById("modalRank");
const modalRollNo = document.getElementById("modalRollNo");
const modalCandName = document.getElementById("modalCandName");
const modalFatherName = document.getElementById("modalFatherName");
const modalMotherName = document.getElementById("modalMotherName");
const modalAppNo = document.getElementById("modalAppNo");
const modalDob = document.getElementById("modalDob");
const modalGender = document.getElementById("modalGender");
const modalCategory = document.getElementById("modalCategory");
const modalHCategory = document.getElementById("modalHCategory");
const modalFCategory = document.getElementById("modalFCategory");
const modalTsp = document.getElementById("modalTsp");
const modalSelCategory = document.getElementById("modalSelCategory");
const modalNetMarks = document.getElementById("modalNetMarks");
const modalGenerationTime = document.getElementById("modalGenerationTime");

// Local cache for retrieved query records
let currentActiveStudent = null;

// Initial Setup
document.addEventListener("DOMContentLoaded", populateExamsDropdown);

/**
 * Retrieves the available active datasets to populate selection dropdown.
 */
async function populateExamsDropdown() {
    try {
        const resultsRef = collection(db, "results");
        const q = query(resultsRef, orderBy("createdAt", "desc"));
        const snapshot = await getDocs(q);

        examSelect.innerHTML = '<option value="" disabled selected>-- Choose an Exam --</option>';

        snapshot.docs.forEach(docSnap => {
            const data = docSnap.data();
            const option = document.createElement("option");
            option.value = docSnap.id;
            option.textContent = data.examName;
            examSelect.appendChild(option);
        });
    } catch (err) {
        console.error("Failed to populate dropdown list:", err);
        alert("Unable to fetch examination list. Please reload the page.");
    }
}

/**
 * Handle Search Form Submissions.
 */
searchForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    
    const selectedExamId = examSelect.value;
    const searchTypeElement = document.querySelector('input[name="searchType"]:checked');
    const queryTextRaw = searchInput.value;

    if (!selectedExamId) {
        alert("Please select an Examination from the dropdown.");
        return;
    }
    if (!searchTypeElement) {
        alert("Please select a search criteria category.");
        return;
    }
    if (!queryTextRaw || !queryTextRaw.trim()) {
        alert("Please enter a valid search value.");
        return;
    }

    const queryType = searchTypeElement.value;
    const queryText = queryTextRaw.trim().toLowerCase();

    // Map internal key references based on user selection
    const searchFieldsMap = {
        rollNo: "searchRoll",
        name: "searchName",
        fatherName: "searchFather",
        motherName: "searchMother"
    };

    const targetField = searchFieldsMap[queryType];

    try {
        setLoadingState(true);
        clearResultsArea();

        // Target individual student records using compound indexing range parameters
        const studentRef = collection(db, "resultStudents");
        const studentQuery = query(
            studentRef,
            where("examId", "==", selectedExamId),
            where(targetField, ">=", queryText),
            where(targetField, "<=", queryText + "\uf8ff")
        );

        const querySnapshot = await getDocs(studentQuery);

        if (querySnapshot.empty) {
            noResultsMessage.classList.remove("hidden");
            resultsSection.classList.add("hidden");
            return;
        }

        // Render matching candidate records
        renderResultsTable(querySnapshot.docs);

    } catch (err) {
        console.error("Search execution failed:", err);
        alert("A system query index restriction occurred. If this is a new setup, ensure composite indexes match the target schema query criteria.");
    } finally {
        setLoadingState(false);
    }
});

/**
 * Render matched candidates to table.
 */
function renderResultsTable(documentsList) {
    resultsTableBody.innerHTML = "";

    documentsList.forEach(docSnap => {
        const data = docSnap.data();
        const tr = document.createElement("tr");

        tr.innerHTML = `
            <td>${data.examName}</td>
            <td><strong>${data.rank || "N/A"}</strong></td>
            <td>${data.rollNo}</td>
            <td class="uppercase-val">${data.name}</td>
            <td class="uppercase-val">${data.fatherName}</td>
            <td>${data.category}</td>
            <td><strong>${data.netMarks}</strong></td>
            <td>
                <button type="button" class="btn-view-result" data-id="${docSnap.id}">View Result</button>
            </td>
        `;

        // Action trigger activation
        tr.querySelector(".btn-view-result").addEventListener("click", () => {
            displayResultModal(data);
        });

        resultsTableBody.appendChild(tr);
    });

    resultsSection.classList.remove("hidden");
    noResultsMessage.classList.add("hidden");
}

/**
 * Prepares the structural elements and fires modal activations.
 */
function displayResultModal(studentData) {
    currentActiveStudent = studentData;

    // Populate element data targets
    modalExamName.textContent = studentData.examName;
    modalRank.textContent = studentData.rank || "N/A";
    modalRollNo.textContent = studentData.rollNo || "N/A";
    modalCandName.textContent = studentData.name || "N/A";
    modalFatherName.textContent = studentData.fatherName || "N/A";
    modalMotherName.textContent = studentData.motherName || "N/A";
    modalAppNo.textContent = studentData.applicationNo || "N/A";
    modalDob.textContent = studentData.dob || "N/A";
    modalGender.textContent = studentData.gender || "N/A";
    modalCategory.textContent = studentData.category || "N/A";
    modalHCategory.textContent = studentData.horizontalCategory || "N/A";
    modalFCategory.textContent = studentData.femaleCategory || "N/A";
    modalTsp.textContent = studentData.tsp || "N/A";
    modalSelCategory.textContent = studentData.selectionCategory || "N/A";
    modalNetMarks.textContent = studentData.netMarks || "N/A";

    // Format stamp parameters
    const dateNow = new Date();
    const stampFormatted = dateNow.toLocaleString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: false
    });
    modalGenerationTime.textContent = `Generated: ${stampFormatted}`;

    // Reveal container
    resultModal.classList.remove("hidden");
}

/**
 * Renders the modal capture targeting sharp high scale outputs.
 */
downloadPngBtn.addEventListener("click", () => {
    if (!currentActiveStudent) return;

    const originalButtonText = downloadPngBtn.innerHTML;
    downloadPngBtn.disabled = true;
    downloadPngBtn.innerHTML = "Generating Canvas...";

    // Configure options parameters for html2canvas
    const captureOptions = {
        scale: 2, // High resolution output density
        useCORS: true,
        backgroundColor: "#ffffff",
        scrollX: 0,
        scrollY: -window.scrollY // Compensates visual shifts
    };

    html2canvas(markSheetCapture, captureOptions).then(canvas => {
        try {
            const fileStream = canvas.toDataURL("image/png");
            const downloadAnchor = document.createElement("a");
            const slugFileName = `Result_${currentActiveStudent.rollNo}.png`;

            downloadAnchor.href = fileStream;
            downloadAnchor.download = slugFileName;
            document.body.appendChild(downloadAnchor);
            downloadAnchor.click();
            document.body.removeChild(downloadAnchor);
        } catch (err) {
            console.error("Canvas export breakdown:", err);
            alert("Local rendering system failed to construct image stream.");
        } finally {
            downloadPngBtn.disabled = false;
            downloadPngBtn.innerHTML = originalButtonText;
        }
    }).catch(err => {
        console.error("Capture aborted:", err);
        alert("Image compilation timed out.");
        downloadPngBtn.disabled = false;
        downloadPngBtn.innerHTML = originalButtonText;
    });
});

/**
 * Handle form and display clears.
 */
resetBtn.addEventListener("click", () => {
    searchForm.reset();
    clearResultsArea();
});

function clearResultsArea() {
    resultsTableBody.innerHTML = "";
    resultsSection.classList.add("hidden");
    noResultsMessage.classList.add("hidden");
    currentActiveStudent = null;
}

function setLoadingState(isLoading) {
    if (isLoading) {
        loadingSpinner.classList.remove("hidden");
        searchForm.querySelectorAll("button, input, select").forEach(el => el.disabled = true);
    } else {
        loadingSpinner.classList.add("hidden");
        searchForm.querySelectorAll("button, input, select").forEach(el => el.disabled = false);
    }
}

// Modal Toggle helpers
function closeModal() {
    resultModal.classList.add("hidden");
    currentActiveStudent = null;
}

closeModalBtn.addEventListener("click", closeModal);

// Close overlay when clicking outer area frame
resultModal.addEventListener("click", (e) => {
    if (e.target === resultModal) {
        closeModal();
    }
});
