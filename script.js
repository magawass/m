// --- GITHUB CONSTANTS ---
const GITHUB_USER = 'magawass';
const GITHUB_REPO = 'm';
const CONFIG_FILE = 'config.json';

// --- CONFIGURATION STATE ---
let currentConfig = null;
let configSha = null;
let currentClassData = {}; 

// Preserved: Global variable to track the page that called loadResults()
let lastCallingPage = 'initialPage'; 

// --- STATIC CONSTANTS (MODIFIED) ---
const SUBJECT_MAP = {
    "Agriculture": "Agric",
    "Bible Knowledge": "BK",
    "Biology": "Bio",
    "Chemistry": "Chem",
    "Chichewa": "Chich",
    "English": "Eng",
    "Geography": "Geo",
    "History": "Hist",
    "Mathematics": "Maths",
    "Physics": "Phys",
    "Social/Life": "S/Life"
};
const ALL_SUBJECTS = Object.keys(SUBJECT_MAP); // Full names used for internal logic
const ALL_CLASSES = ['form1', 'form2', 'form3', 'form4'];
const MIN_SUBJECTS = 4;
const DEFAULT_TEACHER = '-';

const GRADE_KEY_F1_F2 = [
    { range: '80 - 100', grade: 'A', remark: 'Excellent' },
    { range: '65 - 79', grade: 'B', remark: 'Very Good' },
    { range: '55 - 64', grade: 'C', remark: 'Good' },
    { range: '40 - 54', grade: 'D', remark: 'Average' },
    { range: '0 - 39', grade: 'F', remark: 'Fail' },
];

const GRADE_KEY_F3_F4 = [
    { range: '1 - 2', grade: '1', remark: 'Distinction' },
    { range: '3 - 4', grade: '2', remark: 'Distinction' },
    { range: '5 - 6', grade: '3', remark: 'Strong Credit' },
    { range: '7 - 8', grade: '4', remark: 'Credit' },
    { range: '9 - 10', grade: '5', remark: 'Credit' },
    { range: '11 - 12', grade: '6', remark: 'Credit' },
    { range: '13 - 14', grade: '7', remark: 'Pass' },
    { range: '15 - 16', grade: '8', remark: 'Pass' },
    { range: '17 - 19', grade: '9', remark: 'Fail' },
];

// --- UTILITY FUNCTIONS ---
function getSubjectShortName(fullName) {
    return SUBJECT_MAP[fullName] || fullName.substring(0, 5);
}

function getGradeAndRemark(form, score) {
    const key = (form === 'form1' || form === 'form2') ? GRADE_KEY_F1_F2 : GRADE_KEY_F3_F4;
    
    // Lower Forms (F1/F2) use Score Ranges
    if (form === 'form1' || form === 'form2') {
        const gradeEntry = key.find(entry => {
            const [min, max] = entry.range.split(' - ').map(s => parseInt(s.trim()));
            return score >= min && score <= max;
        });
        return gradeEntry || { grade: 'N/A', remark: 'N/A' };
    } 
    // Upper Forms (F3/F4) use Grade Points based on raw score
    else if (form === 'form3' || form === 'form4') {
        let points;
        if (score >= 80) points = 1;
        else if (score >= 75) points = 2;
        else if (score >= 70) points = 3;
        else if (score >= 65) points = 4;
        else if (score >= 60) points = 5;
        else if (score >= 50) points = 6;
        else if (score >= 40) points = 7;
        else if (score >= 30) points = 8;
        else points = 9;

        const gradeEntry = key.find(entry => entry.grade === points.toString());
        
        // Return the grade (point) and remark
        return { grade: points.toString(), remark: gradeEntry ? gradeEntry.remark : 'Fail', numericGrade: points };
    }

    return { grade: 'N/A', remark: 'N/A', numericGrade: 99 };
}

function calculateStudentMetrics(student, form) {
    let overallMetric = 999; // Default to worst rank number
    let metricDisplay = 'N/A';
    let overallRemark = 'Fail (Not Ranked)';
    let rankable = false;

    // 1. Filter out subjects with no score, X, or N
    const countedSubjects = ALL_SUBJECTS.filter(s => {
        const rawScore = student[s];
        return rawScore !== undefined && rawScore !== null && rawScore !== '' && rawScore !== 'X' && rawScore !== 'N';
    });

    const subjectsCounted = countedSubjects.length;
    const isUpperForm = form === 'form3' || form === 'form4';

    if (subjectsCounted >= MIN_SUBJECTS) {
        // --- LOWER FORMS (F1/F2): Use Average Score ---
        if (!isUpperForm) {
            let totalScore = 0;
            countedSubjects.forEach(s => {
                const score = parseFloat(student[s]);
                if (!isNaN(score)) {
                    totalScore += score;
                }
            });

            const average = totalScore / subjectsCounted;
            overallMetric = 100 - average; // Invert for ranking (higher average = lower metric = better rank)
            metricDisplay = average.toFixed(2) + '%';
            overallRemark = (average >= 50) ? 'Pass' : 'Fail';
            rankable = true;
        }
        // --- UPPER FORMS (F3/F4): Use Aggregate (Sum of best 6 points) ---
        else {
            let gradesList = [];
            let englishPassed = false; // Important pass criteria

            countedSubjects.forEach(subject => {
                const score = parseFloat(student[subject]);
                if (!isNaN(score)) {
                    const { numericGrade: point } = getGradeAndRemark(form, score);
                    gradesList.push({ subject: subject, numericGrade: point });
                    
                    if (subject === 'English' && point <= 8) { // English must be a Pass (8 or better)
                        englishPassed = true;
                    }
                }
            });
            
            // Need at least 6 grades to be considered for aggregate ranking
            if (gradesList.length >= 6) {
                rankable = true;
                // 1. Sort by numeric grade (ascending, lower point is better)
                gradesList.sort((a, b) => a.numericGrade - b.numericGrade);

                // 2. Select the best 6 grades
                let bestSixGrades = gradesList.slice(0, 6);

                // 3. Calculate aggregate
                let aggregate = bestSixGrades.reduce((sum, item) => sum + item.numericGrade, 0);

                // 4. Check for Pass Criteria (English passed and best 6 grades < 48)
                const passedAggregate = aggregate <= 48; // Aggregate of 8*6 = 48 (Pass grade is 8, so 48 is the threshold)

                if (passedAggregate && englishPassed) {
                    overallMetric = aggregate;
                    metricDisplay = aggregate;
                    overallRemark = 'Pass';
                } else {
                    overallMetric = 999; // Highest possible rank number (worst)
                    metricDisplay = 'N/A';
                    overallRemark = 'Fail';
                    rankable = false; // Do not rank students who fail mandatory requirements
                }
            }
        }
    } else {
        overallMetric = 999;
        metricDisplay = 'N/A';
        overallRemark = 'Fail (Not Ranked)';
    }

    // NOTE: passingSubjects and englishPassed are not fully calculated/used in the returned object in the existing code, 
    // but the overall logic is self-contained.
    return { overallMetric, metricDisplay, gradesList: gradesList || [], subjectsCounted, passingSubjects: 0, englishPassed: englishPassed || false, overallRemark, rankable };
}

function showLoading() {
    const overlay = document.getElementById('loadingOverlay');
    document.getElementById('loadingPercent').textContent = '0%';
    overlay.style.display = 'flex';
    overlay.style.visibility = 'visible';
    setTimeout(() => {
        overlay.style.opacity = '1';
    }, 10);
}

function updateLoadingPercent(percent) {
    document.getElementById('loadingPercent').textContent = percent + '%';
}

function hideLoading() {
    const overlay = document.getElementById('loadingOverlay');
    // Brief delay to show 100% before hiding
    setTimeout(() => {
        overlay.style.opacity = '0';
        setTimeout(() => {
            overlay.style.display = 'none';
            overlay.style.visibility = 'hidden';
        }, 300); // Wait for fade-out transition
    }, 200);
}

// --- DATA FETCHING & CACHING (UPDATED TO USE LOADING INDICATOR) ---
async function fetchClassData(form) {
    showLoading(); // <<< CALL
    // Check if data is already in memory cache
    if (currentClassData[form] && currentClassData[form].length > 0) {
        hideLoading();
        return currentClassData[form];
    }

    // Fetch from GitHub
    try {
        updateLoadingPercent(10);
        const apiUrl = `https://api.github.com/repos/${GITHUB_USER}/${GITHUB_REPO}/contents/${form}.csv`;
        const response = await fetch(apiUrl);
        
        if (!response.ok) {
            if (response.status === 404) {
                alert(`Data file for ${form} not found on GitHub.`);
                return [];
            }
            throw new Error(`Failed to fetch CSV file: ${response.statusText}`);
        }

        updateLoadingPercent(50);
        const data = await response.json();
        const csvContent = atob(data.content);
        
        updateLoadingPercent(80);
        // Parse CSV content using PapaParse
        return new Promise((resolve) => {
            Papa.parse(csvContent, {
                header: true,
                dynamicTyping: true, // Auto-convert numbers/booleans
                skipEmptyLines: true,
                complete: (results) => {
                    // Cache the data in memory
                    currentClassData[form] = results.data;
                    updateLoadingPercent(100);
                    resolve(results.data);
                },
                error: (error) => {
                    alert(`Error parsing CSV for ${form}: ${error.message}`);
                    resolve([]);
                }
            });
        });

    } catch (error) {
        console.error(`Error fetching class data for ${form}:`, error);
        alert(`Failed to load data for ${form}. Error: ${error.message}`);
        return [];
    } finally {
        // hideLoading is called inside the promise resolution/rejection or immediately after in case of fetch error
        // The check below attempts to ensure hideLoading is only called once if successful
        if (currentClassData[form] || !document.getElementById('loadingOverlay').style.display === 'none') {
             hideLoading();
        }
    }
}

// --- CONFIGURATION FUNCTIONS ---
function getDefaultConfig() {
    const defaultTeachers = {};
    ALL_CLASSES.forEach(c => {
        const classTeachers = {};
        ALL_SUBJECTS.forEach(s => {
            classTeachers[s] = DEFAULT_TEACHER;
        });
        defaultTeachers[c] = classTeachers;
    });
    return {
        term: 1,
        generalComment: 'The student has performed satisfactorily.',
        teachers: defaultTeachers
    };
}

async function fetchConfig(token) {
    // Note: The calling functions (verifyAdmin, initializeConfig) handle the loading/hiding.
    showLoading(); // <<< CALL 
    try {
        const headers = token ? { 'Authorization': `Bearer ${token}` } : {};
        const response = await fetch(`https://api.github.com/repos/${GITHUB_USER}/${GITHUB_REPO}/contents/${CONFIG_FILE}`, { headers });
        
        if (!response.ok) {
            if (response.status === 404) {
                // Config file missing, return default and null SHA
                return { config: getDefaultConfig(), sha: null };
            }
            if (response.status === 401 || response.status === 403) {
                throw new Error("Authentication failed for config file.");
            }
            // For other errors, re-throw with status text
            throw new Error(`Failed to fetch config file: ${response.statusText}`);
        }

        const data = await response.json();
        const content = JSON.parse(atob(data.content));
        return { config: content, sha: data.sha };
    } catch (error) {
        console.error("Error fetching config:", error);
        if (token) {
            alert(`Failed to fetch configuration with token. Error: ${error.message}`);
        }
        return { config: getDefaultConfig(), sha: null };
    } finally {
        hideLoading(); // <<< CALL
    }
}

async function initializeConfig() {
    const { config, sha } = await fetchConfig(null);
    currentConfig = config;
    configSha = sha;
    document.getElementById('reportTermSelect').value = config.term || 1;
    document.getElementById('generalCommentInput').value = config.generalComment || '';
    populateTeacherInputs();
}

// MODIFIED: Teacher assignment layout change
function populateTeacherInputs() {
    if (!currentConfig) return;
    const selectedClass = document.getElementById('classTeacherDropdown').value;
    const teachersForClass = currentConfig.teachers[selectedClass] || {};
    const panel = document.getElementById('teacherAssignmentPanel');
    panel.innerHTML = '';

    ALL_SUBJECTS.forEach(subject => {
        const group = document.createElement('div');
        group.className = 'teacher-input-group';
        
        const label = document.createElement('label');
        label.textContent = subject + ':'; 
        // Removed inline style: label.style.textAlign = 'center';
        group.appendChild(label);
        
        const input = document.createElement('input');
        input.type = 'text';
        input.placeholder = DEFAULT_TEACHER;
        input.id = `teacher-${selectedClass}-${subject.replace(/\s/g, '_')}`;
        input.value = teachersForClass[subject] || DEFAULT_TEACHER;
        // This input element needs to override the global input styles
        // to conform to the side-by-side layout in the panel. The CSS takes care of this via group/input/label selectors.
        group.appendChild(input);
        
        panel.appendChild(group);
    });
}

async function handleSaveConfig() {
    const token = document.getElementById('githubToken').value.trim();
    if (!token) {
        alert('Please enter your Authorization Code (GitHub Token) on the Admin Dashboard.');
        return;
    }
    
    // 1. Collect new config data
    const newConfig = {
        term: document.getElementById('reportTermSelect').value,
        generalComment: document.getElementById('generalCommentInput').value.trim(),
        teachers: currentConfig.teachers // Start with existing teachers
    };

    // 2. Collect updated teacher assignments for the currently selected class
    const selectedClass = document.getElementById('classTeacherDropdown').value;
    const updatedTeachers = {};
    ALL_SUBJECTS.forEach(subject => {
        const inputId = `teacher-${selectedClass}-${subject.replace(/\s/g, '_')}`;
        updatedTeachers[subject] = document.getElementById(inputId).value.trim() || DEFAULT_TEACHER;
    });

    // Update the teachers object in the new config
    newConfig.teachers[selectedClass] = updatedTeachers;
    
    // 3. Prepare for GitHub commit
    const content = JSON.stringify(newConfig, null, 2);
    const encodedContent = btoa(unescape(encodeURIComponent(content)));

    showLoading(); // <<< CALL

    try {
        // Re-fetch SHA just before update to avoid conflicts
        const { sha: latestSha } = await fetchConfig(token);
        
        const apiUrl = `https://api.github.com/repos/${GITHUB_USER}/${GITHUB_REPO}/contents/${CONFIG_FILE}`;
        const response = await fetch(apiUrl, {
            method: 'PUT',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                message: 'Update config.json',
                content: encodedContent,
                sha: latestSha // Use the latest SHA if available
            })
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.message || response.statusText);
        }

        const data = await response.json();
        currentConfig = newConfig; // Update in-memory config
        configSha = data.content.sha; // Update SHA for next save
        alert('Configuration saved successfully to GitHub!');
    } catch (error) {
        alert(`Failed to save configuration: ${error.message}`);
        console.error(error);
    } finally {
        hideLoading(); // <<< CALL
    }
}

// --- NAVIGATION & AUTHENTICATION ---
function goToPage(pageId) {
    document.querySelectorAll('.page').forEach(page => {
        page.style.display = 'none';
    });
    document.getElementById(pageId).style.display = 'block';
}

function backToInitialPage() {
    document.getElementById('adminPassword').value = '';
    document.getElementById('githubToken').value = '';
    goToPage('initialPage');
}

function openAdminLogin() {
    goToPage('adminLoginPage');
}

async function verifyAdmin() {
    const password = document.getElementById('adminPassword').value;
    if (password === 'Magawa123') { // Fixed Password
        await initializeConfig();
        goToPage('adminHomePage');
    } else {
        alert('Incorrect Password.');
    }
}

async function openDataEntryAuth() {
    const token = document.getElementById('githubToken').value.trim();
    const pass = prompt('Enter DATA access password:');
    if (pass === 'data123' && token) {
        await initializeConfig(); // Ensure config is loaded before data entry
        openDataEntryPage();
    } else if (!token) {
        alert('Please enter your Authorization Code (GitHub Token) on the Admin Dashboard.');
    } else if (pass !== null) {
        alert('Incorrect password for DATA access.');
    }
}

async function openUploadsAuth() {
    const token = document.getElementById('githubToken').value.trim();
    const pass = prompt('Enter UPLOADS access password:');
    if (pass === 'upload123' && token) {
        await initializeConfig(); // Ensure config is loaded before uploads
        openUploadsPage();
        refreshFileList(); // Load existing files
    } else if (!token) {
        alert('Please enter your Authorization Code (GitHub Token) on the Admin Dashboard.');
    } else if (pass !== null) {
        alert('Incorrect password for UPLOADS access.');
    }
}

function openDataEntryPage() {
    document.getElementById('dataClassSelect').value = ''; // Reset class selector
    document.getElementById('dataStudentSelect').innerHTML = '<option value="">-- Select Student --</option>'; // Reset student selector
    document.getElementById('dataSubjectSelect').innerHTML = '<option value="">-- Select Subject --</option>';
    document.getElementById('dataScoreInput').value = '';
    ALL_SUBJECTS.forEach(subject => {
        const option = document.createElement('option');
        option.value = subject;
        option.textContent = subject;
        document.getElementById('dataSubjectSelect').appendChild(option);
    });
    goToPage('dataEntryPage');
}

function openAdminHome() {
    goToPage('adminHomePage');
}

function openUploadsPage() {
    goToPage('uploadsPage');
    // Ensure the teacher inputs are populated for the default selected class
    populateTeacherInputs();
}

function openSheetsPage() {
    goToPage('sheetsPage');
}

function openScoreSheetView() {
    goToPage('scoreSheetView');
    // Reset selection and sheet
    document.getElementById('sheetClassSelect').value = '';
    document.getElementById('scoreSheetTableWrapper').innerHTML = '';
}

function openProgressSheetSelector() {
    goToPage('progressSelectorPage');
    // Reset student number input for convenience
    document.getElementById('progressStudentNumberInput').value = document.getElementById('studentNumberInput').value;
}

function openGradesPage() {
    goToPage('gradesPage');
    // Automatically display the sheet for the currently selected class
    displayGradesSheet();
}

function openAnalysisSelector() {
    goToPage('analysisSelectorPage');
}

function openAnalysisPage() {
    const selectedForm = document.getElementById('analysisClassSelect').value;
    if (!selectedForm) {
        alert('Please select a class for analysis.');
        return;
    }
    displayAnalysisSheet(selectedForm);
    goToPage('analysisPage');
}

function backToSheetsPage() {
    goToPage('sheetsPage');
}

// Preserved: Handle back button logic for Progress Report
function handleProgressBack() {
    if (lastCallingPage === 'initialPage') {
        goToPage('initialPage');
    } else if (lastCallingPage === 'progressSelectorPage') {
        goToPage('progressSelectorPage');
    } else {
        goToPage('initialPage'); // Default fallback
    }
}

// --- DATA ENTRY FUNCTIONS (IN-MEMORY CACHE) ---
async function loadStudentsForDataEntry() {
    const form = document.getElementById('dataClassSelect').value;
    const studentSelect = document.getElementById('dataStudentSelect');
    studentSelect.innerHTML = '<option value="">-- Select Student --</option>'; // Clear previous
    if (!form) return;

    const data = await fetchClassData(form); // Uses in-memory cache

    data.forEach(student => {
        // Ensure Exam Number and Name are present for the dropdown
        if (student["Exam Number"] && student["STUDENT'S NAME"]) {
            const option = document.createElement('option');
            option.value = student["Exam Number"];
            option.textContent = `${student["Exam Number"]} - ${student["STUDENT'S NAME"]}`;
            studentSelect.appendChild(option);
        }
    });
}

function submitScore() {
    const form = document.getElementById('dataClassSelect').value;
    const examNumber = document.getElementById('dataStudentSelect').value;
    const subject = document.getElementById('dataSubjectSelect').value;
    const score = document.getElementById('dataScoreInput').value.trim();

    if (!form || !examNumber || !subject) {
        alert('Please select class, student, and subject.');
        return;
    }
    if (!score) {
        alert('Please enter a score.');
        return;
    }

    if (!currentClassData[form] || currentClassData[form].length === 0) {
        alert('Class data not loaded. Please ensure you have loaded the data first.');
        return;
    }
    
    const studentIndex = currentClassData[form].findIndex(s => s["Exam Number"] === examNumber);

    if (studentIndex === -1) {
        alert('Student not found in the current data set.');
        return;
    }

    // Update the in-memory cache
    currentClassData[form][studentIndex][subject] = score;

    alert(`Score for ${examNumber} in ${subject} saved in memory. Remember to click 'Save All Data to Repo' to commit changes to GitHub.`);
    
    // Clear score input for next entry
    document.getElementById('dataScoreInput').value = '';
}

function deleteScore() {
    const form = document.getElementById('dataClassSelect').value;
    const examNumber = document.getElementById('dataStudentSelect').value;
    const subject = document.getElementById('dataSubjectSelect').value;

    if (!form || !examNumber || !subject) {
        alert('Please select class, student, and subject.');
        return;
    }

    if (!currentClassData[form] || currentClassData[form].length === 0) {
        alert('Class data not loaded.');
        return;
    }
    
    const studentIndex = currentClassData[form].findIndex(s => s["Exam Number"] === examNumber);

    if (studentIndex === -1) {
        alert('Student not found in the current data set.');
        return;
    }
    
    if (!confirm(`Are you sure you want to DELETE the score for ${examNumber} in ${subject}? The existing value is: "${currentClassData[form][studentIndex][subject] || 'BLANK'}".`)) {
        return;
    }

    // Update the in-memory cache: set score to empty string, which PapaParse handles as an empty cell (deleted score)
    currentClassData[form][studentIndex][subject] = "";

    alert(`Score for ${examNumber} in ${subject} has been DELETED (set to blank). Remember to click 'Save All Data to Repo' to confirm changes on GitHub.`);
    
    // Clear score input for next entry
    document.getElementById('dataScoreInput').value = '';
}

async function saveAllScoresToRepo() {
    const token = document.getElementById('githubToken').value.trim();
    if (!token) {
        alert('Please enter your Authorization Code (GitHub Token) on the Admin Dashboard.');
        return;
    }

    let allSucceeded = true;
    showLoading(); // <<< CALL

    for (const form of ALL_CLASSES) {
        if (currentClassData[form] && currentClassData[form].length > 0) {
            const data = currentClassData[form];
            
            // Re-generate CSV content from the in-memory data
            const csv = Papa.unparse(data);
            const encodedContent = btoa(unescape(encodeURIComponent(csv)));
            const apiUrl = `https://api.github.com/repos/${GITHUB_USER}/${GITHUB_REPO}/contents/${form}.csv`;

            try {
                // Fetch current SHA
                const response = await fetch(apiUrl, { headers: { 'Authorization': `Bearer ${token}` } });
                let sha = null;

                if (response.status !== 404) {
                    if (!response.ok) throw new Error(`Failed to fetch current file SHA for ${form}: ${response.statusText}`);
                    const fileData = await response.json();
                    sha = fileData.sha;
                }

                // PUT request to update file
                const putResponse = await fetch(apiUrl, {
                    method: 'PUT',
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        message: `Update ${form}.csv via data entry`,
                        content: encodedContent,
                        sha: sha
                    })
                });

                if (!putResponse.ok) {
                    const errorData = await putResponse.json();
                    throw new Error(errorData.message || putResponse.statusText);
                }

            } catch (error) {
                console.error(`Failed to save ${form}.csv:`, error);
                alert(`Error saving ${form}.csv: ${error.message}`);
                allSucceeded = false;
            }
        }
    }
    
    if (allSucceeded) {
        alert('All available class data saved successfully to GitHub!');
    } else {
        alert('One or more files failed to save. Check the console for details.');
    }
    
    hideLoading(); // <<< CALL
}

// --- CSV UPLOAD/DELETE FUNCTIONS ---
async function uploadCSV() {
    const token = document.getElementById('githubToken').value.trim();
    const classSelect = document.getElementById('classDropdown');
    const classValue = classSelect.value;
    const fileInput = document.getElementById('csvUpload');
    const file = fileInput.files[0];

    if (!token) {
        alert('Please enter your Authorization Code (GitHub Token) on the Admin Dashboard.');
        return;
    }
    if (!classValue) {
        alert('Please select a Class.');
        return;
    }
    if (!file) {
        alert('Please select a CSV file.');
        return;
    }

    // 1. Read the file content
    const reader = new FileReader();
    reader.onload = async (e) => {
        const csvContent = e.target.result;
        const fileName = `${classValue}.csv`;

        // 2. Prepare for GitHub commit
        const encodedContent = btoa(unescape(encodeURIComponent(csvContent)));
        const apiUrl = `https://api.github.com/repos/${GITHUB_USER}/${GITHUB_REPO}/contents/${fileName}`;

        showLoading(); // <<< CALL

        try {
            // Check if the file exists to get its SHA
            const getResponse = await fetch(apiUrl, {
                headers: { 'Authorization': `Bearer ${token}` }
            });

            let sha = null;
            if (getResponse.ok) {
                const fileData = await getResponse.json();
                sha = fileData.sha;
            } else if (getResponse.status !== 404) {
                 // For errors other than 404, throw
                throw new Error(`Failed to check file existence: ${getResponse.statusText}`);
            }

            // PUT request to create or update file
            const putResponse = await fetch(apiUrl, {
                method: 'PUT',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    message: `Upload ${fileName}`,
                    content: encodedContent,
                    sha: sha // Include SHA if updating an existing file
                })
            });

            if (!putResponse.ok) {
                const errorData = await putResponse.json();
                throw new Error(errorData.message || putResponse.statusText);
            }

            // Clear the in-memory cache for the uploaded class
            delete currentClassData[classValue]; 
            
            alert(`${fileName} uploaded and saved successfully!`);
            fileInput.value = ''; // Clear file input
            refreshFileList(); // Update the delete dropdown
        } catch (error) {
            alert(`Upload failed: ${error.message}`);
            console.error(error);
        } finally {
            hideLoading(); // <<< CALL
        }
    };
    reader.readAsText(file);
}

function deleteCSV() {
    const token = document.getElementById('githubToken').value.trim();
    const fileName = document.getElementById('deleteDropdown').value;

    if (!token) {
        alert('Please enter your Authorization Code (GitHub Token) on the Admin Dashboard.');
        return;
    }
    if (!fileName) {
        alert('Please select a CSV file to delete.');
        return;
    }

    if (!confirm(`Are you sure you want to delete the file: ${fileName}? This action is irreversible.`)) {
        return;
    }

    const apiUrl = `https://api.github.com/repos/${GITHUB_USER}/${GITHUB_REPO}/contents/${fileName}`;

    showLoading(); // <<< CALL

    // 1. Get the current SHA of the file to be deleted
    fetch(apiUrl, { headers: { 'Authorization': `Bearer ${token}` } })
        .then(response => {
            if (response.status === 404) {
                throw new Error(`File ${fileName} not found on GitHub.`);
            }
            if (!response.ok) {
                throw new Error(`Failed to fetch file SHA for deletion: ${response.statusText}`);
            }
            return response.json();
        })
        // 2. Perform the DELETE request
        .then(fileData => {
            return fetch(apiUrl, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    message: `Delete ${fileName}`,
                    sha: fileData.sha // Required for deletion
                })
            });
        })
        // 3. Handle response
        .then(response => {
            if(!response.ok){
                return response.json().then(err => {
                    throw new Error(err.message || response.statusText);
                });
            }
            alert(`${fileName} deleted successfully!`);
            const className = fileName.replace('.csv', '');
            delete currentClassData[className]; // Clear in-memory cache
            refreshFileList();
        })
        .catch(error => {
            alert(`Delete failed: ${error.message}`);
            console.error(error);
        })
        .finally(() => hideLoading()); // <<< CALL
}

function refreshFileList(){
    const token=document.getElementById('githubToken').value.trim();
    if(!token){return;} // Don't show loading if no token
    
    showLoading(); // <<< CALL

    fetch(`https://api.github.com/repos/${GITHUB_USER}/${GITHUB_REPO}/contents/`,{
        headers:{'Authorization':`Bearer ${token}`}
    })
    .then(response=>{
        if(!response.ok){
            throw new Error(`Failed to fetch file list: ${response.statusText}`);
        }
        return response.json();
    })
    .then(files=>{
        const deleteDropdown=document.getElementById('deleteDropdown');
        deleteDropdown.innerHTML='<option value="">-- Select CSV File --</option>';
        
        if (Array.isArray(files)) {
            files.filter(f=>f.name.endsWith('.csv')).forEach(file=>{
                const option=document.createElement('option');
                option.value=file.name;
                option.textContent=file.name;
                deleteDropdown.appendChild(option);
            });
        } else {
            console.error("Failed to list files or repo is empty:", files);
        }
    })
    .catch(()=>alert('Failed to load file list.'))
    .finally(() => hideLoading()); // <<< CALL
}

// --- MAIN REPORT GENERATION FUNCTION (MODIFIED) ---
async function loadResults(callingPage = 'initialPage') {
    // Preserved: Set the global variable
    lastCallingPage = callingPage;

    const isStudentPortal = callingPage === 'initialPage'; // Re-read for clarity inside function

    // Get input values based on the calling page
    const form = isStudentPortal ? document.getElementById('selectedForm').value : document.getElementById('progressFormSelect').value;
    const studentNumber = isStudentPortal ? document.getElementById('studentNumberInput').value.trim() : document.getElementById('progressStudentNumberInput').value.trim();
    const dob = isStudentPortal ? document.getElementById('dobInput').value.trim() : null; // DOB is only required for student portal

    if (!form || !studentNumber) {
        alert('Please select a class and enter the Exam Number.');
        return;
    }
    if (isStudentPortal && !dob) {
        alert('Please enter the Date of Birth.');
        return;
    }

    // 1. Fetch class data and initialize config (if not done)
    if (!currentConfig) {
        await initializeConfig();
    }
    const data = await fetchClassData(form);

    if (data.length === 0) {
        alert(`No data found for ${form}.`);
        return;
    }

    // 2. Find the student
    const student = data.find(s => s["Exam Number"] === studentNumber);

    if (!student) {
        alert('Student not found with this Exam Number.');
        return;
    }

    // 2a. Student Portal Authentication: Verify DOB
    if (isStudentPortal) {
        const storedDob = student["Date of Birth"] || '';
        // *** FIX APPLIED: Standardize both dates to YYYY-MM-DD before comparison ***
        const storedDateStandardized = standardizeDateForComparison(storedDob);
        const inputDateStandardized = standardizeDateForComparison(dob);

        if (!storedDateStandardized || storedDateStandardized !== inputDateStandardized) {
            alert('Date of Birth does not match the record for this Exam Number.');
            return;
        }
        // *** END FIX ***
    }
    
    // 3. Prepare ranking data for the entire class
    const studentsWithMetrics = [];
    for (const s of data) {
        const metrics = await calculateStudentMetrics(s, form);
        studentsWithMetrics.push({
            examNo: s["Exam Number"],
            metric: metrics.overallMetric,
            rankable: metrics.rankable
        });
    }

    // Filter to only rankable students and sort (ascending: lower metric value = better rank)
    let rankableStudents = studentsWithMetrics.filter(s => s.rankable);
    rankableStudents.sort((a, b) => a.metric - b.metric);
    const totalRankableStudents = rankableStudents.length;

    // 4. Get the target student's full metrics
    const studentMetrics = await calculateStudentMetrics(student, form);

    // Determine available subjects in the student's data
    const ALL_SUBJECTS_IN_DATA = ALL_SUBJECTS.filter(s => student[s] !== undefined);
    
    // Get teacher assignments
    const teachersForStudentClass = currentConfig.teachers[form] || {};
    const currentForm = form.toUpperCase().replace('FORM', 'Form ');

    // 5. Populate Report Details
    document.getElementById('reportStudentName').textContent = student["STUDENT'S NAME"] || '-';
    document.getElementById('reportExamNo').textContent = student["Exam Number"] || '-';
    document.getElementById('reportForm').textContent = currentForm;
    document.getElementById('reportTerm').textContent = currentConfig.term;
    
    // 6. Populate Results Table
    const tbody = document.getElementById('reportBody');
    tbody.innerHTML = '';
    
    ALL_SUBJECTS_IN_DATA.forEach(subject => {
        const row = tbody.insertRow();
        const rawScore = student[subject];
        let displayScore = '-';
        let grade = '-';
        let remark = 'N/A';
        let score = null;
        
        const isNumeric = !isNaN(parseFloat(rawScore)) && isFinite(rawScore);

        if (rawScore === 'X') {
            displayScore = 'X';
            remark = 'Not Enrolled';
        } else if (rawScore === 'N') {
            displayScore = 'N';
            remark = 'Absent';
        } else if (isNumeric) {
            score = parseInt(rawScore);
            const gradeInfo = getGradeAndRemark(form, score);
            displayScore = score.toString();
            grade = gradeInfo.grade;
            remark = gradeInfo.remark;
        }

        // Find subject position/rank (this part is complex and often requires pre-calculating ranks for all subjects)
        // Since we don't have per-subject ranking logic pre-calculated in this single file, 
        // we will leave this as a simple placeholder for now or calculate on the fly for the student.
        // A placeholder logic: assume only the top scoring subjects are ranked (if F3/F4), otherwise position N/A
        let subjectPosition = '-';
        
        // Find teacher
        const teacher = teachersForStudentClass[subject] || DEFAULT_TEACHER;

        row.insertCell().textContent = subject;
        row.insertCell().textContent = displayScore;
        row.insertCell().textContent = grade;
        row.insertCell().textContent = subjectPosition;
        row.insertCell().textContent = remark;
        row.insertCell().textContent = teacher;
    });

    // 7. Overall Ranking
    let overallRank = 'N/A';
    let overallRemark = studentMetrics.overallRemark;
    let metricDisplay = studentMetrics.metricDisplay;

    if (studentMetrics.rankable) {
        if (totalRankableStudents > 0) {
            // Find the student's rank in the sorted list (handle ties)
            let currentRank = 1;
            for (let i = 0; i < rankableStudents.length; i++) {
                if (i > 0 && rankableStudents[i].metric !== rankableStudents[i-1].metric) {
                    currentRank = i + 1;
                }
                if (rankableStudents[i].examNo === studentNumber) {
                    overallRank = currentRank;
                    break;
                }
            }
        } else {
            overallRank = 'N/A';
            overallRemark = 'Fail (Not Ranked)';
        }
    } else {
        overallRemark = 'Fail (Not Ranked)';
    }

    // 8. Populate Summary and Key
    const isUpperForm = form === 'form3' || form === 'form4';
    document.getElementById('averageLine').classList.toggle('hidden', isUpperForm);
    document.getElementById('aggregateLine').classList.toggle('hidden', !isUpperForm);
    
    if (!isUpperForm) {
        document.getElementById('reportAverage').textContent = metricDisplay;
        document.getElementById('reportAggregate').textContent = '-';
        document.getElementById('gradeKeyPlaceholder').innerHTML = createGradeKeyTable(GRADE_KEY_F1_F2);
    } else {
        document.getElementById('reportAverage').textContent = '-';
        document.getElementById('reportAggregate').textContent = metricDisplay;
        document.getElementById('gradeKeyPlaceholder').innerHTML = createGradeKeyTable(GRADE_KEY_F3_F4);
    }

    document.getElementById('reportPosition').textContent = `${overallRank}/${totalRankableStudents}`;
    document.getElementById('reportOverallRemark').textContent = overallRemark;
    document.getElementById('reportComment').textContent = currentConfig.generalComment;

    // 9. Display the report
    goToPage('progressReport');
}

// --- SCORE SHEET VIEW FUNCTION ---
async function displayScoreSheet() {
    const form = document.getElementById('sheetClassSelect').value;
    const tableWrapper = document.getElementById('scoreSheetTableWrapper');
    tableWrapper.innerHTML = ''; // Clear previous content

    if (!form) {
        tableWrapper.innerHTML = '<p>Please select a class.</p>';
        return;
    }

    // Fetch data and populate currentClassData cache if not present
    const data = await fetchClassData(form);
    
    if (data.length === 0) {
        tableWrapper.innerHTML = `<p>No data found for ${form}.</p>`;
        return;
    }

    // Determine available subjects based on the first student's data structure
    const availableSubjects = ALL_SUBJECTS.filter(s => data[0][s] !== undefined);

    // Create table headers
    let headerHTML = `<thead><tr><th>Exam Number</th><th>STUDENT'S NAME</th>`;
    headerHTML += availableSubjects.map(s => `<th>${getSubjectShortName(s)}</th>`).join('');
    headerHTML += `</tr></thead>`;

    // Create table body rows
    let bodyHTML = `<tbody>`;
    data.forEach(student => {
        bodyHTML += `<tr>`;
        bodyHTML += `<td>${student["Exam Number"] || '-'}</td>`;
        bodyHTML += `<td style="text-align: left !important;">${student["STUDENT'S NAME"] || '-'}</td>`;
        availableSubjects.forEach(subject => {
            const rawScore = student[subject] || '-';
            bodyHTML += `<td>${rawScore}</td>`;
        });
        bodyHTML += `</tr>`;
    });
    bodyHTML += `</tbody>`;

    // Assemble the full table
    let tableHTML = `<table id="scoresTable">${headerHTML}${bodyHTML}</table>`;
    tableWrapper.innerHTML = tableHTML;
}

// --- GRADES SHEET FUNCTIONS (MODIFIED) ---
async function displayGradesSheet() {
    const form = document.getElementById('gradesClassSelect').value;
    const tableWrapper = document.getElementById('gradesTableWrapper');
    tableWrapper.innerHTML = '';

    if (!form) {
        tableWrapper.innerHTML = '<p>Please select a class.</p>';
        return;
    }

    const data = await fetchClassData(form);
    
    if (data.length === 0) {
        tableWrapper.innerHTML = `<p>No data found for ${form}.</p>`;
        return;
    }

    // 1. Calculate metrics and filter for rankable students
    const studentsWithMetrics = [];
    for (const student of data) {
        const metrics = await calculateStudentMetrics(student, form);
        studentsWithMetrics.push({
            student: student,
            metrics: metrics
        });
    }

    // 2. Sort students for ranking (ascending metric is better)
    studentsWithMetrics.sort((a, b) => a.metrics.overallMetric - b.metrics.overallMetric);

    const rankableStudents = studentsWithMetrics.filter(s => s.metrics.rankable);
    const totalRankableStudents = rankableStudents.length;

    // Determine available subjects based on the first student's data structure
    const availableSubjects = ALL_SUBJECTS.filter(s => data[0][s] !== undefined);

    // 3. Create table headers
    let headerHTML = `<thead><tr><th>Rank</th><th>Exam Number</th><th>STUDENT'S NAME</th>`;
    headerHTML += availableSubjects.map(s => `<th>${getSubjectShortName(s)}</th>`).join('');
    headerHTML += `<th>${(form === 'form3' || form === 'form4') ? 'Aggregate' : 'Average'}</th>`;
    headerHTML += `</tr></thead>`;

    // 4. Create table body rows
    let tableHTML = `<table id="gradesTable">${headerHTML}<tbody>`;
    let currentRank = 1;

    for (let i = 0; i < studentsWithMetrics.length; i++) {
        const { student, metrics: studentMetrics } = studentsWithMetrics[i];
        let displayRank = 'N/A';

        // Only assign ranks to students who are "rankable"
        if (studentMetrics.rankable) {
            if (i > 0 && studentsWithMetrics[i].metrics.overallMetric !== studentsWithMetrics[i-1].metrics.overallMetric) {
                currentRank = i + 1;
            }
            displayRank = `${currentRank}/${totalRankableStudents}`;
        }
        
        tableHTML += `<tr>`;
        tableHTML += `<td>${displayRank}</td>`;
        tableHTML += `<td>${student["Exam Number"] || '-'}</td>`;
        tableHTML += `<td style="text-align: left !important;">${student["STUDENT'S NAME"] || '-'}</td>`;

        // Add grades for each available subject
        tableHTML += availableSubjects.map(subject => {
            const rawScore = student[subject];
            let grade = '-';
            
            if (!isNaN(parseFloat(rawScore)) && isFinite(rawScore)) {
                grade = getGradeAndRemark(form, parseInt(rawScore)).grade;
            } else if (rawScore === 'X') {
                grade = 'X';
            } else if (rawScore === 'N') {
                grade = 'N';
            }
            return `<td>${grade}</td>`;
        }).join('')

        tableHTML += `<td>${studentMetrics.metricDisplay}</td>`;
        tableHTML += `</tr>`;
    }
    
    tableHTML += `</tbody></table>`;
    tableWrapper.innerHTML = tableHTML;
}

// --- ANALYSIS SHEET FUNCTION ---
async function displayAnalysisSheet(form) {
    const tableWrapper = document.getElementById('analysisTableWrapper');
    tableWrapper.innerHTML = '';
    document.getElementById('analysisTitle').textContent = `Class Analysis Report - ${form.toUpperCase().replace('FORM', 'Form ')}`;
    
    const data = await fetchClassData(form);
    if (data.length === 0) {
        tableWrapper.innerHTML = `<p>No data found for ${form}.</p>`;
        return;
    }

    // Determine available subjects based on the first student's data structure
    const availableSubjects = ALL_SUBJECTS.filter(s => data[0][s] !== undefined);
    
    // Total students in the class (excluding rows with no exam number)
    const totalStudents = data.filter(s => s["Exam Number"]).length; 
    
    // Grade definitions based on form
    const isUpperForm = form === 'form3' || form === 'form4';
    const gradeKey = isUpperForm ? GRADE_KEY_F3_F4 : GRADE_KEY_F1_F2;
    const gradeLevels = gradeKey.map(g => g.grade);
    
    // Initialize analysis structure
    const analysis = availableSubjects.reduce((acc, subject) => {
        acc[subject] = {
            count: 0, // Total scores recorded
            totalScore: 0,
            passCount: 0,
            failCount: 0,
            gradeCounts: gradeLevels.reduce((g_acc, grade) => { g_acc[grade] = 0; return g_acc; }, {})
        };
        return acc;
    }, {});
    
    // Process student data
    data.forEach(student => {
        availableSubjects.forEach(subject => {
            const rawScore = student[subject];
            const isNumeric = !isNaN(parseFloat(rawScore)) && isFinite(rawScore);

            if (isNumeric) {
                const score = parseInt(rawScore);
                const gradeInfo = getGradeAndRemark(form, score);
                const grade = gradeInfo.grade;
                
                // 1. Update overall counts
                analysis[subject].count++;
                analysis[subject].totalScore += score;
                
                // 2. Update Pass/Fail counts
                // For lower forms, D/F is fail (score < 55)
                // For upper forms, 9 is fail (point 9)
                if ((!isUpperForm && score < 55) || (isUpperForm && parseInt(grade) >= 9)) {
                    analysis[subject].failCount++;
                } else {
                    analysis[subject].passCount++;
                }

                // 3. Update grade distribution
                if (analysis[subject].gradeCounts[grade] !== undefined) {
                    analysis[subject].gradeCounts[grade]++;
                }
            }
        });
    });

    // Generate table HTML
    let headerHTML = `<thead><tr><th>Subject</th><th>Total Students</th><th>Average Score</th><th>Pass Rate (%)</th>`;
    headerHTML += gradeLevels.map(g => `<th>${g}</th>`).join('');
    headerHTML += `</tr></thead>`;

    let bodyHTML = `<tbody>`;
    availableSubjects.forEach(subject => {
        const stats = analysis[subject];
        const average = stats.count > 0 ? (stats.totalScore / stats.count).toFixed(2) : '-';
        const passRate = stats.count > 0 ? ((stats.passCount / stats.count) * 100).toFixed(1) : '-';
        
        bodyHTML += `<tr>`;
        bodyHTML += `<td style="text-align: left !important;">${subject}</td>`;
        bodyHTML += `<td>${stats.count} / ${totalStudents}</td>`;
        bodyHTML += `<td>${average}</td>`;
        bodyHTML += `<td>${passRate}%</td>`;
        
        gradeLevels.forEach(grade => {
            bodyHTML += `<td>${stats.gradeCounts[grade] || 0}</td>`;
        });
        
        bodyHTML += `</tr>`;
    });
    bodyHTML += `</tbody>`;

    let tableHTML = `<table id="analysisTable">${headerHTML}${bodyHTML}</table>`;
    tableWrapper.innerHTML = tableHTML;
}


// --- PDF GENERATION UTILITY ---
// Uses jspdf and html2canvas, linked in <head>
function openFullPdf() {
    const contentToCapture = document.getElementById('progressReport');
    const fileName = document.getElementById('reportStudentName').textContent.trim() + "_Report.pdf";
    
    if (!contentToCapture) {
        alert("Report content not found.");
        return;
    }

    // Hide controls that shouldn't be in the PDF
    const buttons = contentToCapture.querySelectorAll('.back-btn, .view-btn');
    buttons.forEach(btn => btn.style.visibility = 'hidden');
    
    // FIX: Added useCORS: true to handle cross-origin image loading for the logo
    html2canvas(contentToCapture, {
        scrollY: 0,
        scale: 2, 
        useCORS: true 
    }).then(canvas=>{
        buttons.forEach(btn => btn.style.visibility = 'visible');

        const imgData = canvas.toDataURL('image/png');
        // Using standard A4 size (210mm x 297mm)
        const pdf = new jspdf.jsPDF('p', 'mm', 'a4'); 
        
        const pdfWidth = pdf.internal.pageSize.getWidth();
        const imgProps = pdf.getImageProperties(imgData);
        
        // Calculate the height required in PDF size (mm) while maintaining aspect ratio
        const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;

        // Add image starting at (0, 0) and filling the width, cropping the bottom if necessary
        pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);

        pdf.save(fileName);
    });
}

// --- GRADE KEY TABLE UTILITY (for report generation) ---
function createGradeKeyTable(key) {
    let html = '<strong>GRADE KEY</strong><br>';
    html += '<table id="gradeKeyTableNew">';
    html += '<thead><tr><th>Range / Point</th><th>Grade</th><th>Remark</th></tr></thead>';
    html += '<tbody>';
    key.forEach(item => {
        html += `<tr><td>${item.range}</td><td>${item.grade}</td><td>${item.remark}</td></tr>`;
    });
    html += '</tbody></table>';
    return html;
}

// --- DATE STANDARDIZATION UTILITY (FIX FOR DOB COMPARISON) ---
function standardizeDateForComparison(dateString) {
    if (!dateString) return null;
    try {
        const date = new Date(dateString);
        // Date.prototype.toISOString() returns YYYY-MM-DDTHH:mm:ss.sssZ, 
        // using slice(0, 10) to get YYYY-MM-DD
        return date.toISOString().slice(0, 10);
    } catch (e) {
        console.error("Error standardizing date:", e);
        return null;
    }
}


// --- INITIALIZATION ---
// Initialize config on window load if necessary, but this is deferred to auth functions for security
window.onload = function() {
    // Only attempt to initialize if on the main page,
    // which should be true if not navigated away.
    if (document.getElementById('initialPage').style.display !== 'none') {
        // initializeConfig(); // Removed for security: configuration only loads after admin auth
    }
}
