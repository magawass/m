// --- GITHUB CONSTANTS ---
const GITHUB_USER = 'magawass';
const GITHUB_REPO = 'm';
const CONFIG_FILE = 'config.json';

// --- CONFIGURATION STATE ---
let currentConfig = null;
let configSha = null;
// This holds the score data in memory after fetching from the repo.
// Changes made via 'Submit Score' update this cache. 'Save All Data to Repo' pushes this cache back to GitHub.
let currentClassData = {}; 

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
    { range: '80 - 100', grade: '1', remark: 'Distinction' },
    { range: '75 - 79', grade: '2', remark: 'Distinction' },
    { range: '70 - 74', grade: '3', remark: 'Strong Credit' },
    { range: '65 - 69', grade: '4', remark: 'Strong Credit' },
    { range: '60 - 64', grade: '5', remark: 'Credit' },
    { range: '55 - 59', grade: '6', remark: 'Credit' },
    { range: '45 - 54', grade: '7', remark: 'Pass' },
    { range: '35 - 44', grade: '8', remark: 'Pass' },
    { range: '0 - 34', grade: '9', remark: 'Fail' },
];

// --- UTILITY FUNCTIONS ---

function goToPage(pageId) {
    document.querySelectorAll('.page').forEach(p => p.style.display = 'none');
    document.getElementById(pageId).style.display = 'block';
}

function getSubjectShortName(subject) {
    return SUBJECT_MAP[subject] || subject;
}

function getNumericGradeForSorting(form, grade) {
    if (grade === '-' || grade === 'X' || grade === 'N') return 100;

    if (form.includes('form1') || form.includes('form2')) {
        if (grade === 'A') return 1;
        if (grade === 'B') return 4;
        if (grade === 'C') return 6;
        if (grade === 'D') return 8;
        if (grade === 'F') return 9;
    }
    const numeric = parseInt(grade);
    if (!isNaN(numeric) && numeric >= 1 && numeric <= 9) {
        return numeric;
    }
    return 100;
}

function getGradeAndRemark(form, score) {
    if (score === null || score === undefined || score === '' || isNaN(parseInt(score))) return { grade: '-', remark: 'No score' };
    score = parseInt(score);

    if (form.includes('form1') || form.includes('form2')) {
        if (score >= 80) return { grade: 'A', remark: 'Excellent' };
        if (score >= 65) return { grade: 'B', remark: 'Very Good' };
        if (score >= 55) return { grade: 'C', remark: 'Good' };
        if (score >= 40) return { grade: 'D', remark: 'Average' };
        return { grade: 'F', remark: 'Fail' };
    }

    if (form.includes('form3') || form.includes('form4')) {
        if (score >= 80) return { grade: '1', remark: 'Distinction' };
        if (score >= 75) return { grade: '2', remark: 'Distinction' };
        if (score >= 70) return { grade: '3', remark: 'Strong Credit' };
        if (score >= 65) return { grade: '4', remark: 'Strong Credit' };
        if (score >= 60) return { grade: '5', remark: 'Credit' };
        if (score >= 55) return { grade: '6', remark: 'Credit' };
        if (score >= 45) return { grade: '7', remark: 'Pass' };
        if (score >= 35) return { grade: '8', remark: 'Pass' };
        return { grade: '9', remark: 'Fail' };
    }
    return { grade: '-', remark: 'N/A' };
}

function isPassingGrade(form, grade) {
    if (form.includes('form1') || form.includes('form2')) {
        return grade !== 'F' && grade !== '-' && grade !== 'X' && grade !== 'N';
    } else if (form.includes('form3') || form.includes('form4')) {
        return ['1', '2', '3', '4', '5', '6', '7', '8'].includes(grade);
    }
    return false;
}

// --- LOADING INDICATOR FUNCTIONS ---
function showLoading(percent = 0) {
    const overlay = document.getElementById('loadingOverlay');
    const text = document.getElementById('loadingText');
    const percentSpan = document.getElementById('loadingPercent');

    if (overlay.style.display === 'none' || overlay.style.display === '') {
        overlay.style.display = 'flex';
        // Force reflow to ensure transition works
        void overlay.offsetWidth; 
    }
    overlay.style.visibility = 'visible';
    overlay.style.opacity = '1';

    percentSpan.textContent = `${percent}%`;
    text.textContent = 'Loading Results...'; // Default text, can be customized later
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
        const response = await fetch(`https://raw.githubusercontent.com/${GITHUB_USER}/${GITHUB_REPO}/main/${form}.csv`);
        if (!response.ok) {
            console.warn(`CSV file for ${form} not found.`);
            return [];
        }
        const csv = await response.text();
        const parsed = Papa.parse(csv, { header: true });
        // Filter out empty rows which PapaParse sometimes generates
        const data = parsed.data.filter(s => s && s["Exam Number"]);
        currentClassData[form] = data; // Cache the data
        return data;
    } catch (error) {
        console.error(`Error fetching data for ${form}:`, error);
        return [];
    } finally {
        hideLoading(); // <<< CALL
    }
}

// --- CONFIGURATION MANAGEMENT FUNCTIONS ---
function getDefaultConfig() {
    const defaultTeachers = {};
    ALL_CLASSES.forEach(cls => {
        defaultTeachers[cls] = {};
        ALL_SUBJECTS.forEach(sub => defaultTeachers[cls][sub] = DEFAULT_TEACHER);
    });
    return { term: 1, generalComment: 'No general comment was provided for this class/term.', teachers: defaultTeachers };
}

async function fetchConfig(token) {
    showLoading(); // <<< CALL
    const apiUrl = `https://api.github.com/repos/${GITHUB_USER}/${GITHUB_REPO}/contents/${CONFIG_FILE}`;
    const headers = token ? { 'Authorization': `Bearer ${token}` } : {};
    try {
        const response = await fetch(apiUrl, { headers });
        if (response.status === 404) {
            return { config: getDefaultConfig(), sha: null };
        }
        if (!response.ok) {
            if (token) {
                throw new Error(`GitHub API error: ${response.statusText}`);
            } else {
                return { config: getDefaultConfig(), sha: null };
            }
        }
        const data = await response.json();
        const content = JSON.parse(atob(data.content));
        return { config: content, sha: data.sha };
    } catch (error) {
        console.error('Error fetching configuration:', error);
        alert(`Failed to fetch configuration. ${error.message}`);
        return { config: getDefaultConfig(), sha: null };
    } finally {
        hideLoading(); // <<< CALL
    }
}

async function initializeAdminConfig() {
    const { config, sha } = await fetchConfig(null);
    currentConfig = config;
    configSha = sha;
    document.getElementById('reportTermSelect').value = config.term || 1;
    document.getElementById('generalCommentInput').value = config.generalComment || '';
    populateTeacherInputs();
}

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
        label.style.textAlign = 'center';
        group.appendChild(label);

        const input = document.createElement('input');
        input.type = 'text';
        input.placeholder = DEFAULT_TEACHER;
        input.id = `teacher-${selectedClass}-${subject.replace(/\s/g, '_')}`;
        input.value = teachersForClass[subject] || DEFAULT_TEACHER;
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

    const newTerm = parseInt(document.getElementById('reportTermSelect').value);
    const newComment = document.getElementById('generalCommentInput').value.trim();
    const selectedClass = document.getElementById('classTeacherDropdown').value;
    
    const newTeachersForClass = {};
    ALL_SUBJECTS.forEach(subject => {
        const inputId = `teacher-${selectedClass}-${subject.replace(/\s/g, '_')}`;
        newTeachersForClass[subject] = document.getElementById(inputId).value.trim() || DEFAULT_TEACHER;
    });

    const currentTeachers = currentConfig.teachers || getDefaultConfig().teachers;
    currentTeachers[selectedClass] = newTeachersForClass;

    const newConfig = {
        term: newTerm,
        generalComment: newComment,
        teachers: currentTeachers
    };
    
    showLoading(); // <<< CALL

    const { sha: latestSha } = await fetchConfig(token);
    
    const apiUrl = `https://api.github.com/repos/${GITHUB_USER}/${GITHUB_REPO}/contents/${CONFIG_FILE}`;
    const encodedContent = btoa(unescape(encodeURIComponent(JSON.stringify(newConfig, null, 2))));
    
    try {
        const response = await fetch(apiUrl, {
            method: 'PUT',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                message: 'Update report configuration',
                content: encodedContent,
                sha: latestSha
            })
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(`GitHub API error: ${errorData.message || response.statusText}`);
        }

        const data = await response.json();
        currentConfig = newConfig;
        configSha = data.content.sha;
        alert('Configuration saved successfully to GitHub!');
        populateTeacherInputs(); // Refresh inputs with newly saved data
    } catch (error) {
        console.error('Error saving configuration:', error);
        alert(`Failed to save configuration. Please check your GitHub token. Error: ${error.message}`);
    } finally {
        hideLoading(); // <<< CALL
    }
}

// --- NAVIGATION FUNCTIONS ---
function openAdminHome() {
    goToPage('adminHomePage');
    initializeAdminConfig();
}

async function openDataEntryAuth() {
    const token = document.getElementById('githubToken').value.trim();
    if (!token) {
        alert('Please enter your Authorization Code (GitHub Token).');
        return;
    }
    const pass = await checkPass(token);
    if (pass) {
        openDataEntryPage();
    } else if (pass !== null) {
        alert('Incorrect password for DATA access.');
    }
}

async function openUploadsAuth() {
    const token = document.getElementById('githubToken').value.trim();
    if (!token) {
        alert('Please enter your Authorization Code (GitHub Token).');
        return;
    }
    const pass = await checkPass(token);
    if (pass) {
        openUploadsPage();
    } else if (pass !== null) {
        alert('Incorrect password for UPLOADS access.');
    }
}

function openDataEntryPage() {
    goToPage('dataEntryPage');
    // Populate subjects once
    const subjectSelect = document.getElementById('dataSubjectSelect');
    if (subjectSelect.options.length <= 1) { // Only populate if empty
        ALL_SUBJECTS.forEach(subject => {
            const option = document.createElement('option');
            option.value = subject;
            option.textContent = subject;
            subjectSelect.appendChild(option);
        });
    }
}

function openSheetsPage() {
    goToPage('sheetsPage');
}

function openProgressSheetSelector() {
    goToPage('progressSelectorPage');
    // Populate fields from student portal for convenience (DOB is intentionally excluded here for admin access)
    document.getElementById('progressFormSelect').value = document.getElementById('selectedForm').value;
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

function verifyAdmin(){
    const pass=document.getElementById('adminPassword').value;
    if(pass==='magawa123'){
        openAdminHome();
    }else{alert('Incorrect password');}
}

async function backToInitialPage(){
    goToPage('initialPage');
    // Clear all form data and state
    document.getElementById('selectedForm').value='';
    document.getElementById('studentNumberInput').value='';
    document.getElementById('dobInput').value='';
    document.getElementById('adminPassword').value='';
    document.getElementById('githubToken').value='';
    currentConfig = null;
    configSha = null;
    currentClassData = {};
}

// --- DATA ENTRY/EDIT FUNCTIONS ---
async function loadStudentsForDataEntry() {
    const form = document.getElementById('dataClassSelect').value;
    const studentSelect = document.getElementById('dataStudentSelect');
    studentSelect.innerHTML = '<option value="">-- Select Student --</option>';
    if (!form) return;

    const data = await fetchClassData(form);
    
    data.forEach(student => {
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
    const studentNumber = document.getElementById('dataStudentSelect').value;
    const subject = document.getElementById('dataSubjectSelect').value;
    let score = document.getElementById('dataScoreInput').value.trim();

    if (!form || !studentNumber || !subject || score === '') {
        alert('Please select class, student, subject, and enter a score.');
        return;
    }

    // Validation for score input
    const validScoreRegex = /^\d+$|^[XxNn]$/;
    if (!validScoreRegex.test(score)) {
        alert("Invalid score. Please enter a number (0-100), 'X' (Not Enrolled), or 'N' (Did Not Write).");
        return;
    }
    // Normalize to upper case for special scores
    if (score.toUpperCase() === 'X' || score.toUpperCase() === 'N') {
        score = score.toUpperCase();
    } else {
        const numericScore = parseInt(score);
        if (isNaN(numericScore) || numericScore < 0 || numericScore > 100) {
            alert("Score must be between 0 and 100.");
            return;
        }
        score = numericScore.toString(); // Store as string for CSV consistency
    }

    if (!currentClassData[form]) {
        alert('Class data is not loaded. Try refreshing the page or selecting the class again.');
        return;
    }

    const student = currentClassData[form].find(s => s["Exam Number"] === studentNumber);

    if (student) {
        student[subject] = score;
        alert(`Score for ${student["STUDENT'S NAME"]} in ${subject} updated to ${score} (in memory). Click 'Save All Data to Repo' to finalize.`);
    } else {
        alert('Student not found in the loaded class data.');
    }
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
                // Fetch the current SHA to prevent data loss (required for PUT update)
                const shaResponse = await fetch(apiUrl, { headers: { 'Authorization': `Bearer ${token}` } });
                let latestSha = null;
                if (shaResponse.ok) {
                    const shaData = await shaResponse.json();
                    latestSha = shaData.sha;
                }
                
                // PUT request to update the file on GitHub
                const updateResponse = await fetch(apiUrl, {
                    method: 'PUT',
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        message: `Update scores for ${form}.csv via Data Entry`,
                        content: encodedContent,
                        sha: latestSha
                    })
                });

                if (!updateResponse.ok) {
                    const errorData = await updateResponse.json();
                    throw new Error(`GitHub API error for ${form}: ${errorData.message || updateResponse.statusText}`);
                }
            } catch (error) {
                console.error(`Save failed for ${form}:`, error);
                alert(`Save failed for ${form}.csv. Error: ${error.message}`);
                allSucceeded = false;
                break; // Stop on first error
            }
        }
    }

    if (allSucceeded) {
        alert('All class data saved successfully to GitHub repository.');
    }
    hideLoading(); // <<< CALL
}

async function openScoreSheetView() {
    goToPage('scoreSheetView');
    // Automatically display the sheet for the currently selected class in data entry
    document.getElementById('sheetClassSelect').value = document.getElementById('dataClassSelect').value;
    displayScoreSheet();
}

// --- DISPLAY SCORE SHEET (MODIFIED FOR SHORT HEADERS) ---
async function displayScoreSheet() {
    const form = document.getElementById('sheetClassSelect').value;
    const tableWrapper = document.getElementById('scoreSheetTableWrapper');
    tableWrapper.innerHTML = '';
    
    if (!form) {
        tableWrapper.innerHTML = '<p>Please select a class.</p>';
        return;
    }

    const data = await fetchClassData(form);
    if (data.length === 0) {
        tableWrapper.innerHTML = `<p>No student data found for ${form}.</p>`;
        return;
    }

    // Use the keys from the first student to determine available subjects
    const availableSubjects = ALL_SUBJECTS.filter(s => data[0][s] !== undefined);

    let tableHTML = `<table id="scoresTable">
        <thead>
            <tr>
                <th>Exam Number</th>
                <th>STUDENT'S NAME</th>
                ${availableSubjects.map(s => `<th>${getSubjectShortName(s)}</th>`).join('')}
            </tr>
        </thead>
        <tbody>`;

    for (const student of data) {
        tableHTML += `<tr>
            <td>${student["Exam Number"] || '-'}</td>
            <td style="text-align: left !important;">${student["STUDENT'S NAME"] || '-'}</td>
            ${availableSubjects.map(s => `<td>${student[s] || '-'}</td>`).join('')}
        </tr>`;
    }

    tableHTML += `</tbody></table>`;
    tableWrapper.innerHTML = tableHTML;
}

// --- STUDENT METRICS CALCULATION (SHARED) ---
async function calculateStudentMetrics(student, form) {
    const isUpperForm = form === 'form3' || form === 'form4';
    // Ensure we are working with the subjects present in the data's first row structure
    const ALL_SUBJECTS_IN_DATA = ALL_SUBJECTS.filter(s => currentClassData[form] && currentClassData[form][0] && currentClassData[form][0][s] !== undefined);
    
    let gradesList = [];
    let totalScore = 0;
    let subjectsCounted = 0;
    let passingSubjects = 0;
    let englishPassed = false;
    
    ALL_SUBJECTS_IN_DATA.forEach(subject => {
        const rawScore = student[subject];
        const isNumeric = !isNaN(parseFloat(rawScore)) && isFinite(rawScore);
        
        if (isNumeric) {
            const score = parseInt(rawScore);
            const { grade } = getGradeAndRemark(form, score);
            const numericGrade = getNumericGradeForSorting(form, grade);
            
            gradesList.push({ grade, subject, numericGrade });
            subjectsCounted++;
            
            if (!isUpperForm) {
                totalScore += score;
            }

            if (isPassingGrade(form, grade)) {
                passingSubjects++;
            }
            if (subject === 'English' && isPassingGrade(form, grade)) {
                englishPassed = true;
            }
        }
    });

    let overallMetric = null;
    let metricDisplay = '-';
    let isRankable = false;

    if (subjectsCounted >= MIN_SUBJECTS) {
        isRankable = true;
        if (!isUpperForm) {
            // Lower Form: Total
            overallMetric = totalScore;
            metricDisplay = (totalScore / subjectsCounted).toFixed(1) + '% (Avg)';
        } else {
            // Upper Form: Aggregate
            // Sort by grade (lower is better)
            gradesList.sort((a, b) => a.numericGrade - b.numericGrade);

            // Check for English pass
            const englishGradeEntry = gradesList.find(g => g.subject === 'English');

            let bestSixGrades = gradesList.slice(0, 6); // Take the best 6 by numeric grade

            // Ensure English is included if it's a pass grade but wasn't in the top 6.
            // This is a common rule: include English if passed, even if it pushes out the 6th best.
            if (englishGradeEntry && isPassingGrade(form, englishGradeEntry.grade)) {
                if (!bestSixGrades.some(g => g.subject === 'English')) {
                    // English is mandatory for aggregate, so if it's not in the best 6,
                    // we check if it is a passing grade, and if so, we include it by dropping the
                    // lowest scoring subject among the current best six.
                    
                    // Find the worst grade in the current best six (this will be at index 5 due to sorting)
                    const worstOfBestSix = bestSixGrades[bestSixGrades.length - 1]; 
                    
                    // Only swap if English grade is strictly *better* than the worst of the six, 
                    // or if the worst of the six is not English and English is a pass.
                    // Simplified logic: If English is a pass and not in top 6, swap it for the worst subject in top 6.
                    if (worstOfBestSix) {
                        bestSixGrades[bestSixGrades.length - 1] = englishGradeEntry;
                        // Re-sort the new 6, just in case the new English grade is better than the rest of the 5.
                        bestSixGrades.sort((a, b) => a.numericGrade - b.numericGrade);
                    }
                }
            }

            // After adjusting, recalculate the aggregate
            const aggregateGrades = bestSixGrades.map(g => g.numericGrade);
            const aggregate = aggregateGrades.reduce((sum, grade) => sum + grade, 0);
            
            overallMetric = aggregate;
            metricDisplay = aggregate;
        }
    }

    return {
        overallMetric,
        metricDisplay,
        gradesList,
        subjectsCounted,
        passingSubjects,
        englishPassed,
        isRankable
    };
}


// --- DISPLAY GRADES SHEET FUNCTIONS (MODIFIED FOR METRIC) ---
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
        tableWrapper.innerHTML = `<p>No student data found for ${form}.</p>`;
        return;
    }
    
    const isUpperForm = form === 'form3' || form === 'form4';
    // Use the keys from the first student to determine available subjects
    const availableSubjects = ALL_SUBJECTS.filter(s => data.length > 0 && data[0][s] !== undefined);
    
    const metricHeader = isUpperForm ? 'Aggregate' : 'Total Score (Avg)';

    let tableHTML = `<table id="gradesTable">
        <thead>
            <tr>
                <th>Exam Number</th>
                <th>STUDENT'S NAME</th>
                ${availableSubjects.map(s => `<th>${getSubjectShortName(s)} Grade</th>`).join('')}
                <th>${metricHeader}</th>
            </tr>
        </thead>
        <tbody>`;

    for (const student of data) {
        // Recalculate metrics based on current data state (in memory)
        const studentMetrics = await calculateStudentMetrics(student, form);

        tableHTML += `<tr>
            <td>${student["Exam Number"] || '-'}</td>
            <td style="text-align: left !important;">${student["STUDENT'S NAME"] || '-'}</td>
            ${availableSubjects.map(s => {
                const rawScore = student[s];
                let grade = '-';
                if (!isNaN(parseFloat(rawScore)) && isFinite(rawScore)) {
                    grade = getGradeAndRemark(form, parseInt(rawScore)).grade;
                } else if (rawScore === 'X') {
                    grade = 'X';
                } else if (rawScore === 'N') {
                    grade = 'N';
                }
                return `<td>${grade}</td>`;
            }).join('')}
            <td>${studentMetrics.metricDisplay}</td>
        </tr>`;
    }

    tableHTML += `</tbody></table>`;
    tableWrapper.innerHTML = tableHTML;
}

// --- ANALYSIS SHEET FUNCTIONS ---
async function displayAnalysisSheet(form) {
    const tableWrapper = document.getElementById('analysisTableWrapper');
    const title = document.getElementById('analysisTitle');
    tableWrapper.innerHTML = '';

    title.textContent = `Analysis Report for ${form.toUpperCase().replace('FORM', 'Form ')}`;
    
    const data = await fetchClassData(form);
    if (data.length === 0) {
        tableWrapper.innerHTML = `<p>No data found for ${form}.</p>`;
        return;
    }

    const isUpperForm = form === 'form3' || form === 'form4';
    const grades = isUpperForm ? ['1', '2', '3', '4', '5', '6', '7', '8', '9'] : ['A', 'B', 'C', 'D', 'F'];
    // Use the keys from the first student to determine available subjects
    const availableSubjects = ALL_SUBJECTS.filter(s => data[0][s] !== undefined);
    const totalStudents = data.length;

    // 1. Initialize grade counters and pass/fail/absent/sat counters per subject
    const subjectAnalysis = {};
    availableSubjects.forEach(subject => {
        subjectAnalysis[subject] = {
            grades: Object.fromEntries(grades.map(g => [g, 0])),
            absent: 0,
            sat: 0,
            passed: 0,
            failed: 0,
        };
    });

    // 2. Populate counters by iterating through all students and subjects
    data.forEach(student => {
        availableSubjects.forEach(subject => {
            const rawScore = student[subject];
            const isNumeric = !isNaN(parseFloat(rawScore)) && isFinite(rawScore);

            if (rawScore === 'N') {
                subjectAnalysis[subject].absent++;
            } else if (rawScore === 'X') {
                // Not Enrolled: Counted as students who did not sit, not failed
            } else if (isNumeric) {
                const score = parseInt(rawScore);
                const { grade } = getGradeAndRemark(form, score);
                
                subjectAnalysis[subject].grades[grade]++;
                subjectAnalysis[subject].sat++;

                if (isPassingGrade(form, grade)) {
                    subjectAnalysis[subject].passed++;
                } else {
                    subjectAnalysis[subject].failed++;
                }
            } else {
                // This handles any other non-standard entries (shouldn't happen with proper data entry)
            }
        });
    });

    // 3. Generate table HTML
    let tableHTML = `<table id="analysisTable">
        <thead>
            <tr>
                <th style="width: 15%;">GRADES</th>
                ${availableSubjects.map(s => `<th>${getSubjectShortName(s)}</th>`).join('')}
            </tr>
        </thead>
        <tbody>`;

    // Add Grade Distribution Rows (A-F or 1-9)
    grades.forEach(grade => {
        tableHTML += `<tr>
            <td style="font-weight: bold;">${grade}</td>
            ${availableSubjects.map(subject => 
                `<td>${subjectAnalysis[subject].grades[grade] || 0}</td>`
            ).join('')}
        </tr>`;
    });

    // Add Summary Rows
    const summaryRows = [
        { label: 'Absent', key: 'absent' },
        { label: 'Sat for Exam', key: 'sat' },
        { label: 'Passed Exam', key: 'passed' },
        { label: 'Failed Exam', key: 'failed' },
        { label: 'Pass Percentage', key: 'pass_percent' },
        { label: 'Fail Percentage', key: 'fail_percent' },
    ];

    summaryRows.forEach(row => {
        tableHTML += `<tr>
            <td style="font-weight: bold; background-color: #f0f0f0;">${row.label}</td>
            ${availableSubjects.map(subject => {
                let value;
                if (row.key === 'pass_percent') {
                    const sat = subjectAnalysis[subject].sat;
                    const passed = subjectAnalysis[subject].passed;
                    value = sat > 0 ? ((passed / sat) * 100).toFixed(1) + '%' : '0.0%';
                } else if (row.key === 'fail_percent') {
                    const sat = subjectAnalysis[subject].sat;
                    const failed = subjectAnalysis[subject].failed;
                    value = sat > 0 ? ((failed / sat) * 100).toFixed(1) + '%' : '0.0%';
                } else {
                    value = subjectAnalysis[subject][row.key];
                }
                return `<td>${value}</td>`;
            }).join('')}
        </tr>`;
    });
    
    tableHTML += `</tbody></table>`;
    tableWrapper.innerHTML = tableHTML;
}

// --- GITHUB FILE FUNCTIONS ---
function uploadCSV(){
    const className=document.getElementById('classDropdown').value;
    const fileInput=document.getElementById('csvUpload');
    const file=fileInput.files[0];
    const token=document.getElementById('githubToken').value.trim();

    if(!className||!file||!token){alert('Please select a class, choose a file, and enter your GitHub token.');return;}
    
    showLoading(); // <<< CALL

    const reader=new FileReader();
    reader.onload=function(){
        const content=reader.result;
        const encodedContent=btoa(unescape(encodeURIComponent(content)));

        fetch(`https://api.github.com/repos/${GITHUB_USER}/${GITHUB_REPO}/contents/${className}.csv`,{
            method:'PUT',
            headers:{'Authorization':`Bearer ${token}`,'Content-Type':'application/json'},
            body:JSON.stringify({
                message:`Upload ${className}.csv`,
                content:encodedContent
            })
        }).then(response=>{
            if(response.ok){
                alert('CSV file uploaded successfully!');
                refreshFileList();
                currentClassData[className] = null; // Invalidate cache
            }else{
                return response.json().then(errorData=>{
                    throw new Error(errorData.message || response.statusText);
                });
            }
        }).catch(error=>{
            console.error('Upload error:',error);
            alert(`Upload failed. Please check your GitHub token. Error: ${error.message}`);
        }).finally(() => hideLoading()); // <<< CALL
    };
    reader.readAsText(file);
}

function deleteCSV(){
    const fileName=document.getElementById('deleteDropdown').value;
    const token=document.getElementById('githubToken').value.trim();

    if(!fileName||!token){alert('Please select a file to delete and enter your GitHub token.');return;}
    
    if(!confirm(`Are you sure you want to delete ${fileName}? This action is permanent.`)){return;}

    showLoading(); // <<< CALL

    // First, get the SHA of the file
    fetch(`https://api.github.com/repos/${GITHUB_USER}/${GITHUB_REPO}/contents/${fileName}`,{
        headers:{'Authorization':`Bearer ${token}`}
    }).then(response=>{
        if(!response.ok){
            throw new Error('File not found or access denied.');
        }
        return response.json();
    }).then(data=>{
        const sha=data.sha;
        // Second, delete the file using the SHA
        return fetch(`https://api.github.com/repos/${GITHUB_USER}/${GITHUB_REPO}/contents/${fileName}`,{
            method:'DELETE',
            headers:{'Authorization':`Bearer ${token}`,'Content-Type':'application/json'},
            body:JSON.stringify({
                message:`Delete ${fileName}`,
                sha:sha
            })
        });
    }).then(response=>{
        if(response.ok){
            alert('File deleted successfully!');
            refreshFileList();
            const className = fileName.replace('.csv', '');
            currentClassData[className] = null; // Invalidate cache
        }else{
            return response.json().then(errorData=>{
                throw new Error(errorData.message || response.statusText);
            });
        }
    }).catch(error=>{
        console.error('Delete error:',error);
        alert(`Deletion failed. Please check your GitHub token. Error: ${error.message}`);
    }).finally(() => hideLoading()); // <<< CALL
}


function refreshFileList() {
    const deleteDropdown = document.getElementById('deleteDropdown');
    deleteDropdown.innerHTML = '<option value="">-- Select CSV File --</option>';

    showLoading(); // <<< CALL

    fetch(`https://api.github.com/repos/${GITHUB_USER}/${GITHUB_REPO}/contents/`)
        .then(response => response.json())
        .then(files => {
            if (Array.isArray(files)) {
                files.filter(f => f.name.endsWith('.csv') && f.name !== CONFIG_FILE)
                     .forEach(file => {
                         const option = document.createElement('option');
                         option.value = file.name;
                         option.textContent = file.name;
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
    const isStudentPortal = callingPage === 'initialPage';

    // Get input values based on the calling page
    const form = isStudentPortal ? document.getElementById('selectedForm').value : document.getElementById('progressFormSelect').value;
    const studentNumber = isStudentPortal ? document.getElementById('studentNumberInput').value.trim() : document.getElementById('progressStudentNumberInput').value.trim();
    const dob = isStudentPortal ? document.getElementById('dobInput').value.trim() : ''; // DOB is only read for Student Portal

    if (!form || !studentNumber || (isStudentPortal && !dob)) {
        alert('Please fill in all required fields.');
        return;
    }

    if (!currentConfig) {
        const { config } = await fetchConfig(null);
        currentConfig = config;
    }

    const data = await fetchClassData(form);

    if (data.length === 0) {
        alert(`No data found for ${form}.csv.`);
        return;
    }

    let student;
    if (isStudentPortal) {
        // Student Portal: MUST match both Exam Number and DOB for security
        const dobInput = new Date(dob);
        const formattedDob = `${dobInput.getFullYear()}-${(dobInput.getMonth() + 1).toString().padStart(2, '0')}-${dobInput.getDate().toString().padStart(2, '0')}`;
        student = data.find(s => s['Exam Number'] === studentNumber && s['Date of Birth'] === formattedDob);
    } else {
        // Admin Portal (Sheets): Match only Exam Number
        student = data.find(s => s['Exam Number'] === studentNumber);
    }


    if (!student) {
        alert('No results found for this student/details.');
        return;
    }
    
    // --- DISPLAY PAGE SETUP ---
    goToPage('progressReport');
    
    const currentForm = form.charAt(0).toUpperCase() + form.slice(1);
    const isUpperForm = form === 'form3' || form === 'form4';
    
    // Use the keys from the first student to determine available subjects
    const ALL_SUBJECTS_IN_DATA = ALL_SUBJECTS.filter(s => data.length > 0 && data[0][s] !== undefined);
    
    // Get teacher assignments for the student's form
    const teachersForStudentClass = currentConfig.teachers[form] || {};

    // 1. Populate Header Details
    document.getElementById('reportStudentName').textContent = student["STUDENT'S NAME"] || '-';
    document.getElementById('reportExamNo').textContent = student["Exam Number"] || '-';
    document.getElementById('reportForm').textContent = currentForm;
    document.getElementById('reportTerm').textContent = `Term ${currentConfig.term}`;

    // 2. Populate Results Table
    const tbody = document.getElementById('reportBody');
    tbody.innerHTML = '';
    
    // Calculate metrics once (includes sorting grades for aggregate calculation)
    const studentMetrics = await calculateStudentMetrics(student, form);

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
            remark = 'Did Not Write';
        } else if (isNumeric) {
            score = parseInt(rawScore);
            displayScore = score;
            const gr = getGradeAndRemark(form, score);
            grade = gr.grade;
            remark = gr.remark;
        }

        // Calculate Subject Position
        let subjectPosition = '-';
        if (score !== null) {
            // Get all valid numeric scores for the subject in the class
            const scoresInClass = data
                .map(s => parseInt(s[subject]) || 0)
                .filter(s => s >= 0 && s !== 0); // Exclude 0/unwritten scores

            // Sort descending
            scoresInClass.sort((a, b) => b - a);

            // Find the rank (1-based index)
            const firstIndex = scoresInClass.indexOf(score);
            subjectPosition = firstIndex >= 0 ? (firstIndex + 1) : '-';
        }

        const teacher = teachersForStudentClass[subject] || DEFAULT_TEACHER;

        row.insertCell().textContent = subject;
        row.insertCell().textContent = displayScore;
        row.insertCell().textContent = grade;
        row.insertCell().textContent = subjectPosition;
        row.insertCell().textContent = remark;
        row.insertCell().textContent = teacher;
    });

    // 3. Overall Ranking/Metrics Calculation
    let overallMetric = studentMetrics.overallMetric;
    let metricDisplay = studentMetrics.metricDisplay;
    let subjectsCounted = studentMetrics.gradesList.length;
    let overallRemark = 'Fail';
    let overallRank = '-';
    let totalRankableStudents = 0;

    // Calculate Overall Rank for *all students* in the class (Recalculating for accurate ranking)
    const classMetrics = await Promise.all(data.map(s => calculateStudentMetrics(s, form).then(m => ({
        examNo: s["Exam Number"], 
        metric: m.overallMetric,
        isUpper: isUpperForm, 
        isRankable: m.isRankable
    }))));

    // Filter to only include rankable students
    const rankableStudents = classMetrics.filter(m => m.isRankable);
    totalRankableStudents = rankableStudents.length;

    if (totalRankableStudents > 0) {
        if (!isUpperForm) {
            // Lower Forms: Rank by Total Score (Highest is Rank 1)
            rankableStudents.sort((a, b) => b.metric - a.metric);
        } else {
            // Upper Forms: Rank by Aggregate (Lowest is Rank 1)
            rankableStudents.sort((a, b) => a.metric - b.metric);
        }

        const studentRankEntry = rankableStudents.findIndex(m => m.examNo === studentNumber);
        overallRank = studentRankEntry >= 0 ? (studentRankEntry + 1) : '-';
    }


    // Determine Overall Remark
    if (studentMetrics.isRankable) {
        const passingSubjects = studentMetrics.passingSubjects;
        const englishPassed = studentMetrics.englishPassed;
        
        if (isUpperForm) {
            // Upper Forms (3&4): Minimum of 6 subjects, 6 aggregates or less, and English pass
            if (subjectsCounted >= 6 && overallMetric <= 36 && overallMetric >= 6) { 
                overallRemark = 'Pass';
            } else {
                overallRemark = 'Fail';
            }
        } else if (passingSubjects >= 4 && englishPassed && !isUpperForm) {
            overallRemark = 'Pass';
        } else {
            overallRemark = 'Fail';
        }
    } else {
        overallRemark = 'Fail (Not Ranked)';
    }

    // 4. Populate Summary and Key
    document.getElementById('averageLine').classList.toggle('hidden', isUpperForm);
    document.getElementById('aggregateLine').classList.toggle('hidden', !isUpperForm);

    if (!isUpperForm) {
        document.getElementById('reportAverage').textContent = metricDisplay;
    } else {
        document.getElementById('reportAggregate').textContent = metricDisplay;
    }

    document.getElementById('reportOverallRemark').textContent = overallRemark;
    document.getElementById('reportPosition').textContent = `${overallRank}/${totalRankableStudents}`;
    document.getElementById('reportComment').textContent = currentConfig.generalComment; // Use loaded comment

    // --- GRADE KEY LOGIC ---
    const gradeKeyData = isUpperForm ? GRADE_KEY_F3_F4 : GRADE_KEY_F1_F2;
    let keyHtml = `<table id="gradeKeyTableNew">
        <thead>
            <tr>
                <th>Range</th>
                <th>Grade</th>
                <th>Remark</th>
            </tr>
        </thead>
        <tbody>`;
        
    gradeKeyData.forEach(item => {
        keyHtml += `<tr>
            <td>${item.range}</td>
            <td>${item.grade}</td>
            <td>${item.remark}</td>
        </tr>`;
    });
    keyHtml += `</tbody></table>`;
    document.getElementById('gradeKeyPlaceholder').innerHTML = keyHtml;
}

// Function to handle the custom password for /Data and /Uploads access (Simple example, actual implementation needs robust security)
async function checkPass(token) {
    const pass = document.getElementById('adminPassword').value;
    if (pass === 'magawa123') {
        return true;
    } else {
        return false;
    }
}

function openAdminLogin() {
    goToPage('adminLoginPage');
}

function openUploadsPage() {
    goToPage('uploadsPage');
    refreshFileList();
}

function openProgressSheetSelector() {
    goToPage('progressSelectorPage');
    // Populate fields from student portal for convenience (DOB is intentionally excluded here for admin access)
    document.getElementById('progressFormSelect').value = document.getElementById('selectedForm').value;
    document.getElementById('progressStudentNumberInput').value = document.getElementById('studentNumberInput').value;
}

function openAnalysisSelector() {
    goToPage('analysisSelectorPage');
}

// Function to generate the PDF report
function openFullPdf(){
  const studentName = document.getElementById('reportStudentName').textContent.trim();
  const examNo = document.getElementById('reportExamNo').textContent.trim();
  
  const safeName = studentName.replace(/[^a-zA-Z0-9\s]/g, '').replace(/\s+/g, '_');
  const safeExamNo = examNo.replace(/[^a-zA-Z0-9\s/]/g, '-');
  const fileName = `${safeName}_${safeExamNo}_Report.pdf`;

  const contentToCapture = document.getElementById('progressReport');
  
  const buttons = contentToCapture.querySelectorAll('.back-btn, .view-btn');
  buttons.forEach(btn => btn.style.visibility = 'hidden');
  
  html2canvas(contentToCapture, {
      scrollY: 0,
      scale: 2 
  }).then(canvas=>{
    buttons.forEach(btn => btn.style.visibility = 'visible');

    const imgData=canvas.toDataURL('image/png');
    const pdf=new jspdf.jsPDF('p', 'mm', 'a4'); 
    
    const pdfWidth=pdf.internal.pageSize.getWidth();
    const imgProps=pdf.getImageProperties(imgData);
    
    const pdfHeight=(imgProps.height*pdfWidth)/imgProps.width;

    pdf.addImage(imgData,'PNG',0,0,pdfWidth,pdfHeight);
    pdf.save(fileName);
  }).catch(e => { console.error('PDF generation error:', e); alert('Could not save PDF.'); });
}
