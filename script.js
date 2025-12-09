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
    return { grade: '-', remark: 'Unknown Form' }; // Should not happen
}

function isPassingGrade(form, grade) {
    if (form.includes('form1') || form.includes('form2')) {
        return ['A', 'B', 'C', 'D'].includes(grade);
    }
    if (form.includes('form3') || form.includes('form4')) {
        const numericGrade = parseInt(grade);
        return numericGrade >= 1 && numericGrade <= 8;
    }
    return false;
}

function getCommentForAggregate(aggregate) {
    if (aggregate === 6) return 'Excellent performance, top achievement.';
    if (aggregate >= 7 && aggregate <= 12) return 'Very strong performance, excellent academic potential.';
    if (aggregate >= 13 && aggregate <= 18) return 'Commendable performance, solid academic standing.';
    if (aggregate >= 19 && aggregate <= 24) return 'Good effort, showing satisfactory progress.';
    if (aggregate >= 25 && aggregate <= 32) return 'Fair performance, needs more dedication in certain areas.';
    if (aggregate >= 33 && aggregate <= 40) return 'Needs serious improvement. Academic output is below expectation.';
    return 'Unsatisfactory performance. Immediate attention required across all subjects.';
}

function generateGradeKeyTable(form) {
    const key = form.includes('form1') || form.includes('form2') ? GRADE_KEY_F1_F2 : GRADE_KEY_F3_F4;
    let html = `<h4>Grade Key:</h4><table id="gradeKeyTableNew"><thead><tr><th>Range</th><th>Grade</th><th>Remark</th></tr></thead><tbody>`;
    key.forEach(item => {
        html += `<tr><td>${item.range}</td><td>${item.grade}</td><td>${item.remark}</td></tr>`;
    });
    html += `</tbody></table>`;
    return html;
}

// Function to calculate all student metrics (Total Score/Average/Aggregate, Position, Remarks)
// Modifies students array in place by adding 'overallMetric'
async function calculateAllStudentMetrics(form, data) {
    const isUpperForm = form === 'form3' || form === 'form4';
    const studentsWithMetrics = data.map(student => {
        const studentMetrics = calculateStudentMetricsSingle(student, form);
        return {
            ...student,
            overallMetric: studentMetrics.overallMetric,
            metricDisplay: studentMetrics.metricDisplay,
            gradesList: studentMetrics.gradesList,
            subjectsCounted: studentMetrics.subjectsCounted,
            passingSubjects: studentMetrics.passingSubjects,
            englishPassed: studentMetrics.englishPassed,
            overallRemark: studentMetrics.overallRemark,
            rankable: studentMetrics.rankable,
        };
    });

    // 1. Filter out students who shouldn't be ranked (Less than MIN_SUBJECTS, or failed English in upper form)
    let rankableStudents = studentsWithMetrics.filter(s => s.rankable);

    // 2. Sort rankable students by overallMetric
    // Lower forms (non-aggregate) sort by metric descending (higher is better)
    // Upper forms (aggregate) sort by metric ascending (lower aggregate is better)
    if (!isUpperForm) {
        rankableStudents.sort((a, b) => b.overallMetric - a.overallMetric);
    } else {
        rankableStudents.sort((a, b) => a.overallMetric - b.overallMetric);
    }

    // 3. Assign ranks to rankable students
    let currentRank = 1;
    for (let i = 0; i < rankableStudents.length; i++) {
        if (i > 0 && rankableStudents[i].overallMetric !== rankableStudents[i - 1].overallMetric) {
            currentRank = i + 1;
        }
        rankableStudents[i].overallRank = currentRank;
    }

    // 4. Merge ranks back into the full list
    return studentsWithMetrics.map(student => {
        const rankedStudent = rankableStudents.find(r => r["Exam Number"] === student["Exam Number"]);
        if (rankedStudent) {
            student.overallRank = rankedStudent.overallRank;
            student.totalRankableStudents = rankableStudents.length;
        } else {
            student.overallRank = 'N/A';
            student.totalRankableStudents = rankableStudents.length; // Still show total for context
        }
        return student;
    });
}

function calculateStudentMetricsSingle(student, form) {
    const isUpperForm = form === 'form3' || form === 'form4';

    // Determine available subjects based on data presence for the first student
    // This assumes all students in the file have the same subject columns
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

            // Only count grades that are not 'No score' for metric calculation
            if (grade !== '-') {
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
        }
    });

    let overallMetric = null; 
    let metricDisplay = '-';
    let overallRemark = 'Fail';
    let rankable = false;

    if (subjectsCounted >= MIN_SUBJECTS) {
        rankable = true;
        
        if (!isUpperForm) {
            // Lower Form: Total Score
            overallMetric = totalScore;
            metricDisplay = (totalScore / subjectsCounted).toFixed(1); // Display Average

            if (passingSubjects >= 4 && englishPassed) {
                overallRemark = 'Pass';
            } else {
                overallRemark = 'Fail';
            }
        } else {
            // Upper Form: Aggregate (Best 6 compulsory subjects with English Pass)
            
            // 1. Sort by numeric grade ascending (1 is best, 9 is worst)
            gradesList.sort((a, b) => a.numericGrade - b.numericGrade);
            
            // 2. Select best six grades
            let bestSixGrades = gradesList.slice(0, 6);
            let aggregate = bestSixGrades.reduce((sum, g) => sum + g.numericGrade, 0);

            if (subjectsCounted >= 6 && aggregate <= 40 && englishPassed) {
                overallMetric = aggregate;
                metricDisplay = aggregate;
                overallRemark = getCommentForAggregate(aggregate); 
            } else {
                overallMetric = 999; // Highest possible rank number (worst)
                metricDisplay = 'N/A';
                overallRemark = 'Fail';
                rankable = false; // Do not rank students who fail mandatory requirements
            }
        }
    } else {
        overallMetric = 999;
        metricDisplay = 'N/A';
        overallRemark = 'Fail (Not Ranked)';
    }

    return { overallMetric, metricDisplay, gradesList, subjectsCounted, passingSubjects, englishPassed, overallRemark, rankable };
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
    ALL_CLASSES.forEach(c => {
        defaultTeachers[c] = Object.fromEntries(ALL_SUBJECTS.map(s => [s, DEFAULT_TEACHER]));
    });

    return {
        term: 1,
        generalComment: 'No general comment provided.',
        teachers: defaultTeachers,
    };
}

async function fetchConfig(token) {
    showLoading(); // <<< CALL
    const apiUrl = `https://api.github.com/repos/${GITHUB_USER}/${GITHUB_REPO}/contents/${CONFIG_FILE}`;
    
    try {
        const headers = token ? { 'Authorization': `Bearer ${token}` } : {};
        const response = await fetch(apiUrl, { headers });

        if (response.status === 404) {
            // Config file not found, return default
            console.warn('Config file not found on GitHub. Using default configuration.');
            // Do not hide loading here, let the calling function handle it
            return { config: getDefaultConfig(), sha: null };
        }

        if (!response.ok) {
            // This is a failure we need to alert about, but still return default config if no token was used
            if (!token) {
                return { config: getDefaultConfig(), sha: null };
            }
            throw new Error(`Failed to fetch config with status: ${response.status} and error: ${response.statusText}`);
        } else {
            // This logic block should only run if the file EXISTS (response.ok)
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
    const content = JSON.stringify(newConfig, null, 2);
    const encodedContent = btoa(unescape(encodeURIComponent(content)));

    try {
        const response = await fetch(apiUrl, {
            method: 'PUT',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                message: 'Update config.json (term, comment, teachers)',
                content: encodedContent,
                sha: latestSha || configSha // Use the latest SHA if available, fallback to cached
            })
        });

        if (!response.ok) {
            return response.json().then(err => {
                throw new Error(err.message || response.statusText);
            });
        }
        const result = await response.json();
        configSha = result.content.sha; // Update SHA
        currentConfig = newConfig; // Update in-memory config
        alert('Configuration saved successfully to GitHub!');
    } catch (error) {
        alert(`Failed to save configuration: ${error.message}`);
        console.error(error);
    } finally {
        hideLoading(); // <<< CALL
    }
}

// --- NAVIGATION & ADMIN AUTH FUNCTIONS ---

function backToInitialPage() {
    goToPage('initialPage');
}

function openAdminLogin() {
    goToPage('adminLoginPage');
    document.getElementById('adminPassword').value = '';
}

async function verifyAdmin() {
    const password = document.getElementById('adminPassword').value;
    const token = document.getElementById('githubToken').value.trim(); // Get token from the hidden field
    if (password === 'MagawaPass123') {
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
    } else if (!token) {
        alert('Please enter your Authorization Code (GitHub Token) on the Admin Dashboard.');
    } else if (pass !== null) {
        alert('Incorrect password for UPLOADS access.');
    }
}

function openAdminHome() {
    goToPage('adminHomePage');
}

function openUploadsPage() {
    goToPage('uploadsPage');
    refreshFileList();
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

// Preserved: Handle back button logic for Progress Report
function handleProgressBack() {
    if (lastCallingPage === 'initialPage') {
        backToInitialPage();
    } else if (lastCallingPage === 'progressSelectorPage') {
        goToPage('progressSelectorPage');
    }
}

// --- DATA ENTRY & SAVE FUNCTIONS ---

async function loadStudentsForDataEntry() {
    const form = document.getElementById('dataClassSelect').value;
    const studentSelect = document.getElementById('dataStudentSelect');
    studentSelect.innerHTML = '<option value="">-- Select Student --</option>'; // Clear previous

    if (!form) return;

    // Fetch and cache data
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

    const studentIndex = currentClassData[form].findIndex(s => s['Exam Number'] === examNumber);
    if (studentIndex === -1) {
        alert('Student not found in the current data set.');
        return;
    }

    // Update the in-memory cache
    currentClassData[form][studentIndex][subject] = score;
    alert(`Score for ${examNumber} in ${subject} updated to: ${score}. Remember to click 'Save All Data to Repo'.`);
    
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
                // Fetch the current SHA to prevent data loss (required for PUT update)
                const shaResponse = await fetch(apiUrl, {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                
                let sha = null;
                if (shaResponse.ok) {
                    const shaData = await shaResponse.json();
                    sha = shaData.sha;
                } else if (shaResponse.status !== 404) {
                     // Only throw error if it's not a 404 (file doesn't exist yet)
                    throw new Error(`Failed to fetch current SHA for ${form}.csv: ${shaResponse.statusText}`);
                }

                // PUT request to update/create file
                const updateResponse = await fetch(apiUrl, {
                    method: 'PUT',
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        message: `Update ${form}.csv with new scores`,
                        content: encodedContent,
                        sha: sha // Include SHA for update, or null/undefined for new file
                    })
                });

                if (!updateResponse.ok) {
                    allSucceeded = false;
                    const errorDetails = await updateResponse.json();
                    throw new Error(errorDetails.message || updateResponse.statusText);
                }

            } catch (error) {
                alert(`Failed to save ${form}.csv: ${error.message}`);
                console.error(`Error saving ${form}.csv:`, error);
                allSucceeded = false;
            }
        }
    }

    if (allSucceeded) {
        alert('All class data saved successfully to GitHub!');
    } else {
        alert('Some data failed to save. Check the console for details.');
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
    
    // Calculate all metrics including ranks
    const studentsWithMetrics = await calculateAllStudentMetrics(form, data);

    const isUpperForm = form === 'form3' || form === 'form4';
    const finalMetricHeader = isUpperForm ? 'Aggregate' : 'Average';

    // Determine available subjects based on the first student's data structure
    const availableSubjects = ALL_SUBJECTS.filter(s => data[0][s] !== undefined);

    // Create table headers
    let headerHTML = `<thead><tr><th>Rank</th><th>Exam Number</th><th>STUDENT'S NAME</th>`;
    headerHTML += availableSubjects.map(s => `<th>${getSubjectShortName(s)}</th>`).join('');
    headerHTML += `<th>${finalMetricHeader}</th>`;
    headerHTML += `<th>Remark</th></tr></thead>`;

    // Create table body rows
    let tableHTML = `<table id="gradesTable">${headerHTML}<tbody>`;
    
    // Sort by rank for display
    studentsWithMetrics.sort((a, b) => {
        const rankA = a.overallRank === 'N/A' ? studentsWithMetrics.length + 1 : a.overallRank;
        const rankB = b.overallRank === 'N/A' ? studentsWithMetrics.length + 1 : b.overallRank;
        return rankA - rankB;
    });


    for (const student of studentsWithMetrics) {
        tableHTML += `<tr>
            <td>${student.overallRank}</td>
            <td>${student["Exam Number"] || '-'}</td>
            <td style="text-align: left !important;">${student["STUDENT'S NAME"] || '-'}</td>
            ${availableSubjects.map(subject => {
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
            }).join('')}
            <td>${student.metricDisplay}</td>
            <td>${student.overallRemark}</td>
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
            let grade = null;
            
            if (rawScore === 'N' || rawScore === 'X') {
                subjectAnalysis[subject].absent++;
            } else if (!isNaN(parseFloat(rawScore)) && isFinite(rawScore)) {
                subjectAnalysis[subject].sat++;
                const score = parseInt(rawScore);
                grade = getGradeAndRemark(form, score).grade;

                if (grade !== '-') { // Should not happen with numeric scores, but safe guard
                    subjectAnalysis[subject].grades[grade]++;

                    if (isPassingGrade(form, grade)) {
                        subjectAnalysis[subject].passed++;
                    } else {
                        subjectAnalysis[subject].failed++;
                    }
                }
            } else {
                 // Non-numeric, non-X/N entry is treated as an absence for calculation purposes (e.g. empty string)
                 subjectAnalysis[subject].absent++;
            }
        });
    });

    // 3. Generate table headers
    let headerHTML = `<thead><tr><th>Metric</th>`;
    headerHTML += availableSubjects.map(s => `<th>${getSubjectShortName(s)}</th>`).join('');
    headerHTML += `</tr></thead>`;

    // 4. Define rows for the analysis table
    const analysisRows = [
        { label: 'Total Students', key: 'total_students', value: totalStudents },
        { label: 'Sat Exam', key: 'sat' },
        { label: 'Absent/Not Enrolled', key: 'absent' },
        { label: 'Total Passed', key: 'passed' },
        { label: 'Total Failed', key: 'failed' },
        { label: 'Pass % (of sat)', key: 'pass_percent' },
        { label: 'Fail % (of sat)', key: 'fail_percent' },
    ];
    // Add grade counts dynamically
    grades.forEach(g => {
        analysisRows.push({ label: `Grade ${g} Count`, key: `grades.${g}` });
    });


    // 5. Generate table body
    let tableHTML = `<table id="analysisTable">${headerHTML}<tbody>`;
    analysisRows.forEach(row => {
        tableHTML += `<tr><td style="text-align: left; font-weight: bold; background-color: #f0f0f0;">${row.label}</td>`;
        
        if (row.key === 'total_students') {
            // Special case for total students (spans all subject columns)
            tableHTML += `<td colspan="${availableSubjects.length}">${totalStudents}</td></tr>`;
            return;
        }


        tableHTML += availableSubjects.map(subject => {
            let value;
            if (row.key === 'pass_percent') {
                const sat = subjectAnalysis[subject].sat;
                const passed = subjectAnalysis[subject].passed;
                value = sat > 0 ? ((passed / sat) * 100).toFixed(1) + '%' : '0.0%';
            } else if (row.key === 'fail_percent') {
                const sat = subjectAnalysis[subject].sat;
                const failed = subjectAnalysis[subject].failed;
                value = sat > 0 ? ((failed / sat) * 100).toFixed(1) + '%' : '0.0%';
            } else if (row.key.startsWith('grades.')) {
                const gradeKey = row.key.split('.')[1];
                value = subjectAnalysis[subject].grades[gradeKey];
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

    if(!className||!file||!token){
        alert('Please select a class, choose a file, and enter your GitHub token.');
        return;
    }

    showLoading(); // <<< CALL

    const reader=new FileReader();
    reader.onload=function(){
        const content=reader.result;
        const encodedContent=btoa(unescape(encodeURIComponent(content)));

        // Get current SHA for update
        fetch(`https://api.github.com/repos/${GITHUB_USER}/${GITHUB_REPO}/contents/${className}.csv`,{
            headers:{'Authorization':`Bearer ${token}`}
        })
        .then(response => {
            if (response.status === 404) { // File not found, proceed without SHA
                return { sha: null };
            }
            if (!response.ok) {
                throw new Error(`Failed to fetch current file SHA: ${response.statusText}`);
            }
            return response.json();
        })
        .then(data => {
            const sha = data.sha;

            // PUT request to create/update file
            return fetch(`https://api.github.com/repos/${GITHUB_USER}/${GITHUB_REPO}/contents/${className}.csv`,{
                method:'PUT',
                headers:{
                    'Authorization':`Bearer ${token}`,
                    'Content-Type':'application/json'
                },
                body:JSON.stringify({
                    message:`Upload ${className}.csv`,
                    content:encodedContent,
                    sha: sha // Include SHA for update, or null/undefined for new file
                })
            });
        })
        .then(response=>{
            if(!response.ok){
                return response.json().then(err => {
                    throw new Error(err.message || response.statusText);
                });
            }
            alert(`File ${className}.csv uploaded successfully!`);
            currentClassData[className] = []; // Clear old cache
            refreshFileList(); // Refresh the delete dropdown list
        })
        .catch(error => {
            alert(`Upload failed: ${error.message}`);
            console.error(error);
        })
        .finally(() => hideLoading()); // <<< CALL
    };
    reader.readAsText(file);
}

function deleteCSV(){
    const fileName=document.getElementById('deleteDropdown').value;
    const token=document.getElementById('githubToken').value.trim();

    if(!fileName||!token){
        alert('Please select a file to delete and enter your GitHub token.');
        return;
    }

    if(!confirm(`Are you sure you want to delete ${fileName}? This action cannot be undone.`)){
        return;
    }

    showLoading(); // <<< CALL

    // First, get the SHA of the file to delete
    fetch(`https://api.github.com/repos/${GITHUB_USER}/${GITHUB_REPO}/contents/${fileName}`,{
        headers:{'Authorization':`Bearer ${token}`}
    })
    .then(response=>{
        if(!response.ok){
            throw new Error(`Failed to fetch file SHA for deletion: ${response.statusText}`);
        }
        return response.json();
    })
    .then(data=>{
        const sha=data.sha;

        // DELETE request
        return fetch(`https://api.github.com/repos/${GITHUB_USER}/${GITHUB_REPO}/contents/${fileName}`,{
            method:'DELETE',
            headers:{
                'Authorization':`Bearer ${token}`,
                'Content-Type':'application/json'
            },
            body:JSON.stringify({
                message:`Delete ${fileName}`,
                sha:sha
            })
        });
    })
    .then(response=>{
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
    if(!token){
        return;
    } // Don't show loading if no token

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
    const dob = isStudentPortal ? document.getElementById('dobInput').value.trim() : ''; // DOB is only read for Student Portal

    if (!form || !studentNumber || (isStudentPortal && !dob)) {
        alert('Please fill in all required fields.');
        return;
    }

    // 1. Fetch data and config
    const [data, { config }] = await Promise.all([
        fetchClassData(form),
        fetchConfig(null) // Fetch config without token for student view
    ]);

    if (data.length === 0) {
        alert(`No score data available for ${form}.`);
        return;
    }

    if (!config) {
        alert('Failed to load report configuration. Cannot generate report.');
        return;
    }

    const student = data.find(s => s["Exam Number"] === studentNumber);

    if (!student) {
        alert('Student with that Exam Number not found in the selected class.');
        return;
    }

    // Student Portal DOB check (only for initialPage)
    if (isStudentPortal) {
        const studentDOB = student.DOB; // Assuming DOB column exists in CSV
        if (studentDOB !== dob) {
            alert('Date of Birth does not match the records.');
            return;
        }
    }

    // 2. Data Preparation
    const currentForm = form.toUpperCase().replace('FORM', 'Form ');
    const isUpperForm = form === 'form3' || form === 'form4';

    // Get the configured teachers for this class
    const teachersForStudentClass = config.teachers[form] || getDefaultConfig().teachers[form];
    
    // Determine available subjects based on data presence for the first student
    const ALL_SUBJECTS_IN_DATA = ALL_SUBJECTS.filter(s => data[0][s] !== undefined);
    
    // Calculate all student metrics and ranks in the class
    const studentsWithMetrics = await calculateAllStudentMetrics(form, data);
    const studentMetrics = studentsWithMetrics.find(s => s["Exam Number"] === studentNumber);

    // 3. Display Report
    goToPage('progressReport');
    
    // Generate Grade Key Table HTML
    document.getElementById('gradeKeyPlaceholder').innerHTML = generateGradeKeyTable(form);

    // Calculate metrics for the student
    // const studentMetrics = await calculateStudentMetrics(student, form);

    // 1. Populate Report Details
    document.getElementById('reportStudentName').textContent = student["STUDENT'S NAME"] || '-';
    document.getElementById('reportExamNo').textContent = student["Exam Number"] || '-';
    document.getElementById('reportForm').textContent = currentForm;
    document.getElementById('reportTerm').textContent = config.term;

    // 2. Populate Results Table
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
            const scoresInClass = data
                .map(s => parseInt(s[subject]) || 0)
                .filter(s => s >= 0);
            scoresInClass.sort((a, b) => b - a);
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
    let overallRank = studentMetrics.overallRank;
    let totalRankableStudents = studentMetrics.totalRankableStudents;
    let metricDisplay = studentMetrics.metricDisplay;
    let overallRemark = studentMetrics.overallRemark;
    
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
    document.getElementById('reportComment').textContent = config.generalComment; // Use loaded comment

    // 5. PDF Generation Function (Inline for encapsulation)
    window.openFullPdf = function() {
        showLoading();
        updateLoadingPercent(10);
        
        const studentName = student["STUDENT'S NAME"] || 'Student';
        const examNo = student["Exam Number"] || '000';

        // Sanitizing logic
        const safeName = studentName.replace(/[^a-zA-Z0-9\s]/g, '').replace(/\s+/g, '_');
        const safeExamNo = examNo.replace(/[^a-zA-Z0-9\s/]/g, '-');
        const fileName = `${safeName}_${safeExamNo}_Report.pdf`;

        const contentToCapture = document.getElementById('progressReport');
        
        const buttons = contentToCapture.querySelectorAll('.back-btn, .view-btn');
        buttons.forEach(btn => btn.style.visibility = 'hidden');
        
        // FIX: Added useCORS: true to handle cross-origin image loading for the logo
        html2canvas(contentToCapture, {
            scrollY: 0,
            scale: 2, 
            useCORS: true 
        }).then(canvas=>{
            buttons.forEach(btn => btn.style.visibility = 'visible');

            const imgData=canvas.toDataURL('image/png');
            // Using standard A4 size (210mm x 297mm)
            const pdf=new jspdf.jsPDF('p', 'mm', 'a4'); 
            
            const pdfWidth=pdf.internal.pageSize.getWidth();
            const imgProps=pdf.getImageProperties(imgData);
            
            // Calculate the height required in PDF size (mm) while maintaining aspect ratio
            const pdfHeight=(imgProps.height*pdfWidth)/imgProps.width;

            // Add image starting from top left (0, 0)
            pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
            updateLoadingPercent(90);

            pdf.save(fileName);
            updateLoadingPercent(100);
            hideLoading();
        }).catch(error => {
            console.error('Error generating PDF:', error);
            alert('Failed to generate PDF. Check console for details.');
            buttons.forEach(btn => btn.style.visibility = 'visible');
            hideLoading();
        });
    };
}
