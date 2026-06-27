console.log("SEARCH JS VERSION 999");
import {
    db,
    collection,
    getDocs,
    getDoc,
    doc,
    query,
    where,
    orderBy,
    limit,
    startAt,
    endAt
} from "./firebase.js";
// This assumes html2canvas is loaded globally, e.g., via a script tag in index.html, as per instructions.
// If it were a module, it would be: import html2canvas from 'html2canvas';

// --- DOM Element References ---
const searchForm = document.getElementById('search-form');
const examSelect = document.getElementById('search-exam');
const rollInput = document.getElementById('search-roll');
const nameInput = document.getElementById('search-name');
const fatherNameInput = document.getElementById('search-father');
const motherNameInput = document.getElementById('search-mother');

const resultsSection = document.getElementById('results-list-section');
const resultsTableBody = document.querySelector('#results-table-container tbody');
const noResultsMessage = document.getElementById('no-results-message');

const modalContainer = document.getElementById('marksheet-outer-container');
const marksheetContent = document.getElementById('marksheet-capture-target');
const downloadButton = document.getElementById('download-btn');
const closeButton = document.getElementById('close-report-btn');


// --- Firestore Initialization ---

const resultsCollection = collection(db, 'results');
const studentsCollection = collection(db, 'resultStudents');
const SEARCH_LIMIT = 50; // Limit the number of search results
const examNameCache = new Map();


// --- Core Functions ---

/**
 * Loads all available exams from the 'results' collection and populates the select dropdown.
 * Sorts exams by creation date, newest first.
 */
const loadExams = async () => {
    try {
        const q = query(resultsCollection, orderBy("createdAt", "desc"));
        const querySnapshot = await getDocs(q);
        if (querySnapshot.empty) {
            examSelect.disabled = true;
            examSelect.innerHTML = '<option>No exams available</option>';
            return;
        }
        querySnapshot.forEach((doc) => {
            const exam = doc.data();
            const option = document.createElement('option');
            option.value = doc.id;
            option.textContent = exam.examName;
            examSelect.appendChild(option);
        });
    } catch (error) {
        console.error("Error loading exams:", error);
        alert("An error occurred while loading the list of exams. Please try refreshing the page.");
    }
};

/**
 * Handles the search form submission, validates input, and constructs the Firestore query.
 * @param {Event} e - The form submission event.
 */
const handleSearch = async (e) => {
    e.preventDefault();
    resetSearch();

    const examId = examSelect.value;
    const rollNo = rollInput.value.trim();
    const name = nameInput.value.trim();
    const fatherName = fatherNameInput.value.trim();
    const motherName = motherNameInput.value.trim();

    // --- Validation ---
    if (!examId) {
        alert("Please select an examination.");
        return;
    }
    if (!rollNo && !name && !fatherName && !motherName) {
        alert("Please enter a Roll Number or at least one other search detail (Candidate, Father, or Mother's Name).");
        return;
    }

    // --- Query Construction ---
    let finalQuery;
    const baseQuery = query(studentsCollection, where("examId", "==", examId));

    if (rollNo) {
        // Priority 1: Exact match on Roll Number
        finalQuery = query(baseQuery, where("searchRoll", "==", rollNo.toLowerCase()));
    } else {
        // Priority 2-4: Prefix search on the first available text field
        const nameLower = name.toLowerCase();
        const fatherNameLower = fatherName.toLowerCase();
        const motherNameLower = motherName.toLowerCase();
        
        let searchField, searchValue;
        
        if (name) {
            searchField = "searchName";
            searchValue = nameLower;
        } else if (fatherName) {
            searchField = "searchFather";
            searchValue = fatherNameLower;
        } else if (motherName) {
            searchField = "searchMother";
            searchValue = motherNameLower;
        }

        finalQuery = query(baseQuery,
            orderBy(searchField),
            startAt(searchValue),
            endAt(searchValue + '\uf8ff'),
            limit(SEARCH_LIMIT)
        );
    }

    await searchStudents(finalQuery);
};

/**
 * Executes the Firestore query and passes the results to be rendered.
 * @param {Query} q - The Firestore query to execute.
 */
const searchStudents = async (q) => {
    try {
        // You can add a loading spinner here
        const querySnapshot = await getDocs(q);
        await renderResults(querySnapshot);
    } catch (error) {
        console.error("Error searching students:", error);
        alert("An error occurred during the search. Please check your details and try again.");
    } finally {
        // You can hide the loading spinner here
        resultsSection.classList.remove('hidden');
    }
};

const getExamNameById = async (examId) => {
    if (!examId) return '';
    if (examNameCache.has(examId)) return examNameCache.get(examId);

    const examDoc = await getDoc(doc(db, 'results', examId));
    const examName = examDoc.exists() ? (examDoc.data().examName || '') : '';
    examNameCache.set(examId, examName);
    return examName;
};

const getStudentExamName = async (student) => {
    return student.examName || await getExamNameById(student.examId) || 'EXAMINATION RESULT';
};


/**
 * Renders the search results in the HTML table.
 * @param {QuerySnapshot} snapshot - The snapshot returned from the Firestore query.
 */
const renderResults = async (snapshot) => {
    if (snapshot.empty) {
        noResultsMessage.classList.remove('hidden');
        return;
    }

    for (const studentDoc of snapshot.docs) {
        const student = studentDoc.data();
        const examName = await getStudentExamName(student);
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${examName}</td>
            <td>${student.rank || 'N/A'}</td>
            <td>${student.rollNo}</td>
            <td>${student.name}</td>
            <td>${student.fatherName}</td>
            <td>${student.category || 'N/A'}</td>
            <td>${student.netMarks || 'N/A'}</td>
            <td>
                <button class="btn view-result-btn" data-id="${studentDoc.id}">View Result</button>
            </td>
        `;
        resultsTableBody.appendChild(row);
    }
};

/**
 * Fetches the full details for a single student and displays them in the modal.
 * @param {string} studentId - The Firestore document ID for the student.
 */
const showResult = async (studentId) => {
    try {
        const studentDocRef = doc(db, 'resultStudents', studentId);
        const studentDoc = await getDoc(studentDocRef);

        if (!studentDoc.exists()) {
            alert("Could not find the detailed result for this student.");
            return;
        }

        const student = studentDoc.data();
        const examName = await getStudentExamName(student);
        
        // Populate all fields in the marksheet
        Object.keys(student).forEach(key => {
            const element = document.getElementById(`marksheet-${key}`);
            if (element) {
                element.textContent = student[key] || 'N/A';
            }
        });
        
        // Populate exam name and date
        document.getElementById('marksheet-exam-name').textContent = examName;
        document.getElementById('marksheet-date').textContent = new Date().toLocaleDateString();

        modalContainer.classList.remove('hidden');

    } catch (error) {
        console.error("Error showing result:", error);
        alert("An error occurred while fetching the detailed result.");
    }
};

/**
 * Downloads the content of the result modal as a high-quality PNG image.
 */
const downloadPNG = () => {
    if (typeof html2canvas === 'undefined') {
        alert('Could not generate PNG. The html2canvas library is missing.');
        console.error('html2canvas is not loaded.');
        return;
    }
    const rollNo = document.getElementById('marksheet-rollNo').textContent || 'unknown';
    const filename = `Result_${rollNo}.png`;

    html2canvas(marksheetContent, {
        scale: 2, // for higher quality
        backgroundColor: '#ffffff' // ensure a white background
    }).then(canvas => {
        const link = document.createElement('a');
        link.href = canvas.toDataURL('image/png');
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }).catch(error => {
        console.error('Error during PNG download:', error);
        alert('Could not download the result card. Please try again.');
    });
};

/**
 * Resets the search form and clears previous results.
 */
const resetSearch = () => {
    resultsTableBody.innerHTML = '';
    resultsSection.classList.add('hidden');
    noResultsMessage.classList.add('hidden');
};

/**
 * Closes the result detail modal.
 */
const closeModal = () => {
    modalContainer.classList.add('hidden');
};

// --- Event Listeners Initialization ---

document.addEventListener('DOMContentLoaded', () => {
    // Load exams into the dropdown when the page is ready
    loadExams();

    // Handle form submission
    searchForm.addEventListener('submit', handleSearch);

    // Handle form reset
    searchForm.addEventListener('reset', resetSearch);

    // Handle 'View Result' button clicks using event delegation
    resultsTableBody.addEventListener('click', (e) => {
        if (e.target && e.target.classList.contains('view-result-btn')) {
            const studentId = e.target.dataset.id;
            showResult(studentId);
        }
    });

    // Handle modal buttons
    downloadButton.addEventListener('click', downloadPNG);
    closeButton.addEventListener('click', closeModal);

    // Allow closing the modal by clicking outside of it
    modalContainer.addEventListener('click', (e) => {
        if (e.target === modalContainer) {
            closeModal();
        }
    });
});
