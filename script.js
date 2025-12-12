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
const DEFAULT_TEACHER = 'TBA';

// --- UTILITY FUNCTIONS ---
function goToPage(pageId) {
    document.querySelectorAll('.page').forEach(page => {
        page.style.display = 'none';
    });
    const targetPage = document.getElementById(pageId);
    if (targetPage) {
        targetPage.style.display = 'block';
    }
}

function backToInitialPage() {
    goToPage('initialPage');
}

function handleProgressBack() {
    goToPage(lastCallingPage);
}

function getSubjectShortName(fullName) {
    return SUBJECT_MAP[fullName] || fullName;
}

function standardizeDateForComparison(dateString) {
    if (!dateString) return '';
    try {
        const date = new Date(dateString);
        // Ensure the date is valid and format as YYYY-MM-DD
        if (!isNaN(date.getTime())) {
            return date.toISOString().split('T')[0];
        }
    } catch (e) {
        console.error("Error standardizing date:", e);
    }
    return '';
}


// --- GRADE LOGIC ---
function getGradeAndRemark(form, score) {
    // F1 & F2: 1-8 (Pass=1-4) | F3 & F4: 1-9 (Pass=1-6)
    const isUpperForm = form.includes('form3') || form.includes('form4');
    
    if (score < 0 || score > 100) return { grade: '-', remark: 'Invalid Score' };
    
    // Lower Forms (F1/F2)
    if (!isUpperForm) {
        if (score >= 80) return { grade: 1, remark: 'Excellent' };
        if (score >= 70) return { grade: 2, remark: 'Very Good' };
        if (score >= 60) return { grade: 3, remark: 'Good' };
        if (score >= 50) return { grade: 4, remark: 'Satisfactory' };
        if (score >= 40) return { grade: 5, remark: 'Fair' };
        if (score >= 30) return { grade: 6, remark: 'Weak' };
        if (score >= 20) return { grade: 7, remark: 'Poor' };
        return { grade: 8, remark: 'Very Poor' };
    }
    
    // Upper Forms (F3/F4)
    if (score >= 80) return { grade: 1, remark: 'Excellent' };
    if (score >= 75) return { grade: 2, remark: 'Very Good' };
    if (score >= 70) return { grade: 3, remark: 'Good' };
    if (score >= 60) return { grade: 4, remark: 'Credit' };
    if (score >= 50) return { grade: 5, remark: 'Credit' };
    if (score >= 40) return { grade: 6, remark: 'Credit' };
    if (score >= 30) return { grade: 7, remark: 'Pass' };
    if (score >= 20) return { grade: 8, remark: 'Pass' };
    return { grade: 9, remark: 'Fail' };
}

function isPassingGrade(form, grade) {
    const isUpperForm = form.includes('form3') || form.includes('form4');
    const numericGrade = parseInt(grade);
    
    if (isNaN(numericGrade)) return false;
    
    // F1/F2 pass is grade 1 to 4
    if (!isUpperForm) {
        return numericGrade >= 1 && numericGrade <= 4;
    }
    
    // F3/F4 pass is grade 1 to 6
    return numericGrade >= 1 && numericGrade <= 6;
}

// --- METRIC CALCULATION (Crucial for Ranking) ---
async function calculateStudentMetrics(student, form) {
    // This function returns an object containing all necessary metrics and ranking info for one student.
    const isUpperForm = form.includes('form3') || form.includes('form4');
    let totalScore = 0;
    let passingSubjects = 0;
    let englishPassed = false;
    let subjectsCounted = 0;
    let gradesList = []; // Array of { grade, subject, numericGrade } for aggregate calculation

    // Determine available subjects based on the student's data structure
    const availableSubjects = ALL_SUBJECTS.filter(s => student[s] !== undefined);

    availableSubjects.forEach(subject => {
        const rawScore = student[subject];
        let score = null;
        let grade = '-';
        let numericGrade = 99; // Default worst grade for numeric comparison

        const isNumeric = !isNaN(parseFloat(rawScore)) && isFinite(rawScore);

        if (isNumeric) {
            score = parseInt(rawScore);
            const gr = getGradeAndRemark(form, score);
            grade = gr.grade;
            numericGrade = parseInt(gr.grade);
        }

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
    });

    let overallMetric = null;
    let metricDisplay = '-';
    let overallRemark = 'Fail';
    let rankable = false;

    if (subjectsCounted >= MIN_SUBJECTS) {
        rankable = true;

        if (!isUpperForm) {
            // Lower Form: Total Score (Invert metric so that higher score = lower/better metric value)
            overallMetric = -totalScore; // <-- MODIFIED FOR RANKING BY TOTAL SCORE
            metricDisplay = (totalScore / subjectsCounted).toFixed(1); // Display Average

            if (passingSubjects >= 4 && englishPassed) {
                overallRemark = 'Pass';
            } else {
                overallRemark = 'Fail';
            }
        } else {
            // Upper Form: Aggregate (Best 6 compulsory subjects with English Pass)
            // 1. Sort by numeric grade (Ascending: lower number = better grade)
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
            }
        }
    }

    return {
        overallMetric, // Used for sorting (lower is better)
        metricDisplay, // Average or Aggregate for display
        overallRemark, // Pass/Fail
        rankable, // True if minimum subjects written
        totalScore, // For F1/F2 (data entry internal use)
        subjectsCounted,
        englishPassed
    };
}


// --- GRADE KEY GENERATION ---
function generateGradeKeyTable(form) {
    const isUpperForm = form.includes('form3') || form.includes('form4');
    let html = '';
    
    if (!isUpperForm) {
        // F1/F2 Key
        html = `
        <table id="gradeKeyTableNew">
            <thead>
                <tr>
                    <th colspan="2">FORM 1 & 2 GRADING KEY</th>
                </tr>
            </thead>
            <tbody>
                <tr><td>80 - 100</td><td>1 (Excellent)</td></tr>
                <tr><td>70 - 79</td><td>2 (Very Good)</td></tr>
                <tr><td>60 - 69</td><td>3 (Good)</td></tr>
                <tr><td>50 - 59</td><td>4 (Satisfactory)</td></tr>
                <tr><td>40 - 49</td><td>5 (Fair)</td></tr>
                <tr><td>30 - 39</td><td>6 (Weak)</td></tr>
                <tr><td>20 - 29</td><td>7 (Poor)</td></tr>
                <tr><td>0 - 19</td><td>8 (Very Poor)</td></tr>
            </tbody>
        </table>
        `;
    } else {
        // F3/F4 Key
        html = `
        <table id="gradeKeyTableNew">
            <thead>
                <tr>
                    <th colspan="2">FORM 3 & 4 GRADING KEY</th>
                </tr>
            </thead>
            <tbody>
                <tr><td>80 - 100</td><td>1 (Excellent)</td></tr>
                <tr><td>75 - 79</td><td>2 (Very Good)</td></tr>
                <tr><td>70 - 74</td><td>3 (Good)</td></tr>
                <tr><td>60 - 69</td><td>4 (Credit)</td></tr>
                <tr><td>50 - 59</td><td>5 (Credit)</td></tr>
                <tr><td>40 - 49</td><td>6 (Credit)</td></tr>
                <tr><td>30 - 39</td><td>7 (Pass)</td></tr>
                <tr><td>20 - 29</td><td>8 (Pass)</td></tr>
                <tr><td>0 - 19</td><td>9 (Fail)</td></tr>
            </tbody>
        </table>
        `;
    }
    return html;
}

// --- LOADING INDICATOR ---
function showLoading() {
    const overlay = document.getElementById('loadingOverlay');
    const percent = document.getElementById('loadingPercent');
    if (overlay && percent) {
        overlay.style.visibility = 'visible';
        overlay.style.opacity = '1';
        percent.textContent = '0%';
    }
}

function updateLoadingPercent(value) {
    const percent = document.getElementById('loadingPercent');
    if (percent) {
        percent.textContent = `${value}%`;
    }
}

function hideLoading() {
    const overlay = document.getElementById('loadingOverlay');
    if (overlay) {
        // Use a timeout to allow the transition to complete
        setTimeout(() => {
            overlay.style.opacity = '0';
            overlay.style.visibility = 'hidden';
            // Wait for fade-out transition
        }, 200); 
    }
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

async function fetchConfig(token) {
    // Note: This function remains outside the main loading/hiding logic as it's used by other auth functions
    // and is complex. The callers (verifyAdmin, initializeConfig) handle the loading/hiding.
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
        throw error;
    } finally {
        // hideLoading() must be called by the caller function (e.g., initializeConfig)
    }
}


async function initializeConfig() {
    showLoading(); // Ensure loading is visible
    try {
        // Fetch config without a token first, as it's public
        const { config, sha } = await fetchConfig(null);
        currentConfig = config;
        configSha = sha;
        // Pre-populate settings on the admin page
        if (currentConfig) {
            document.getElementById('reportTermSelect').value = currentConfig.term || 1;
            document.getElementById('generalCommentInput').value = currentConfig.generalComment || getDefaultConfig().generalComment;
            populateTeacherInputs(); // Populate the first class (Form 1)
        }
    } catch (error) {
        console.error("Failed to initialize config:", error);
        alert(`Failed to load configuration: ${error.message}. Using default settings.`);
        currentConfig = getDefaultConfig();
        configSha = null;
    } finally {
        hideLoading();
    }
}


// --- ADMIN & LOGIN ---
function openAdminLogin() {
    goToPage('adminLoginPage');
}

function openAdminHome() {
    goToPage('adminHomePage');
}

function getDefaultConfig() {
    return {
        term: 1,
        generalComment: 'Continue to work hard and maintain discipline.',
        teachers: {
            form1: Object.fromEntries(ALL_SUBJECTS.map(s => [s, DEFAULT_TEACHER])),
            form2: Object.fromEntries(ALL_SUBJECTS.map(s => [s, DEFAULT_TEACHER])),
            form3: Object.fromEntries(ALL_SUBJECTS.map(s => [s, DEFAULT_TEACHER])),
            form4: Object.fromEntries(ALL_SUBJECTS.map(s => [s, DEFAULT_TEACHER])),
        }
    };
}

async function verifyAdmin() {
    const password = document.getElementById('adminPassword').value;
    // Simple password check (should be stored securely in a real app)
    if (password === 'magawa2024') {
        document.getElementById('adminPassword').value = ''; // Clear password
        await initializeConfig(); // Load config before entering dashboard
        openAdminHome();
    } else {
        alert('Incorrect Password.');
    }
}

async function openDataEntryAuth() {
    const token = document.getElementById('githubToken').value.trim();
    const pass = prompt('Enter DATA access password:');
    if (pass === 'data123' && token) {
        await initializeConfig(); // Ensure config is loaded
        openDataEntryPage();
    } else if (!token) {
        alert('Please enter your Authorization Code on the Admin Dashboard.');
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
        alert('Please enter your Authorization Code on the Admin Dashboard.');
    } else if (pass !== null) {
        alert('Incorrect password for UPLOADS access.');
    }
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
    document.getElementById('gradesClassSelect').value = '';
    document.getElementById('gradesTableWrapper').innerHTML = '<p>Please select a class.</p>';
}

function openAnalysisSelector() {
    goToPage('analysisSelectorPage');
}

async function openAnalysisPage() {
    const form = document.getElementById('analysisClassSelect').value;
    if (!form) {
        alert('Please select a class.');
        return;
    }
    
    goToPage('analysisPage');
    document.getElementById('analysisTitle').textContent = `Class Analysis Report - ${form.toUpperCase()}`;
    await displayAnalysisSheet(form);
}

// --- DATA ENTRY FUNCTIONS (ADMIN) ---
async function loadStudentsForDataEntry() {
    const form = document.getElementById('dataClassSelect').value;
    const studentSelect = document.getElementById('dataStudentSelect');
    studentSelect.innerHTML = '<option value="">-- Select Student --</option>'; // Clear previous options
    
    if (!form) return;
    
    const data = await fetchClassData(form);
    
    if (data.length > 0) {
        data.forEach(student => {
            const option = document.createElement('option');
            option.value = student["Exam Number"];
            option.textContent = `${student["Exam Number"]} - ${student["STUDENT'S NAME"]}`;
            studentSelect.appendChild(option);
        });
    }
}

async function submitScore() {
    const form = document.getElementById('dataClassSelect').value;
    const studentNumber = document.getElementById('dataStudentSelect').value;
    const subject = document.getElementById('dataSubjectSelect').value;
    const score = document.getElementById('dataScoreInput').value.trim();
    
    if (!form || !studentNumber || !subject || score === '') {
        alert('Please fill all fields.');
        return;
    }
    
    if (!currentClassData[form]) {
        await fetchClassData(form);
    }
    
    const studentIndex = currentClassData[form].findIndex(s => s["Exam Number"] === studentNumber);
    
    if (studentIndex !== -1) {
        // Validate score: must be 0-100, 'X', or 'N'
        if (score.toUpperCase() !== 'X' && score.toUpperCase() !== 'N' && (isNaN(parseFloat(score)) || parseFloat(score) < 0 || parseFloat(score) > 100)) {
            alert('Score must be a number between 0 and 100, "X" (Not Enrolled), or "N" (Did Not Write).');
            return;
        }

        currentClassData[form][studentIndex][subject] = score.toUpperCase(); // Update in memory
        alert(`Score for ${studentNumber} in ${subject} updated to ${score.toUpperCase()} (in memory). Click 'Save All Data' to commit.`);
        
        // Clear score input for next entry
        document.getElementById('dataScoreInput').value = '';
    } else {
        alert('Student not found. Please ensure data is loaded/uploaded.');
    }
}

async function deleteScore() {
    const form = document.getElementById('dataClassSelect').value;
    const studentNumber = document.getElementById('dataStudentSelect').value;
    const subject = document.getElementById('dataSubjectSelect').value;
    
    if (!form || !studentNumber || !subject) {
        alert('Please select a class, student, and subject.');
        return;
    }

    if (!confirm(`Are you sure you want to delete the score for ${studentNumber} in ${subject}?`)) {
        return;
    }
    
    if (!currentClassData[form]) {
        await fetchClassData(form);
    }
    
    const studentIndex = currentClassData[form].findIndex(s => s["Exam Number"] === studentNumber);
    
    if (studentIndex !== -1) {
        if (currentClassData[form][studentIndex].hasOwnProperty(subject)) {
            // Remove the property to indicate no score exists
            delete currentClassData[form][studentIndex][subject];
            alert(`Score for ${studentNumber} in ${subject} deleted (in memory). Click 'Save All Data' to commit.`);
            
            // Clear score input as the data is gone
            document.getElementById('dataScoreInput').value = '';
        } else {
            alert(`No score found for ${subject} for student ${studentNumber}.`);
        }
    } else {
        alert('Student not found.');
    }
}


async function saveAllScoresToRepo() {
    const token = document.getElementById('githubToken').value.trim();
    if (!token) {
        alert('Please enter your Authorization Code on the Admin Dashboard.');
        return;
    }
    
    const classesToSave = Object.keys(currentClassData);
    if (classesToSave.length === 0) {
        alert('No data has been loaded or entered to save.');
        return;
    }

    let allSucceeded = true;
    showLoading(); // <<< CALL

    for (const form of classesToSave) {
        const data = currentClassData[form];
        if (data.length === 0) continue;

        // 1. Convert data array to CSV string
        const csv = Papa.unparse(data);

        // 2. Encode to base64
        const encodedContent = btoa(unescape(encodeURIComponent(csv)));

        try {
            // 3. Get the SHA of the existing file to update/delete it
            const shaResponse = await fetch(`https://api.github.com/repos/${GITHUB_USER}/${GITHUB_REPO}/contents/${form}.csv`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });

            let sha = null;
            if (shaResponse.ok) {
                const shaData = await shaResponse.json();
                sha = shaData.sha;
            } else if (shaResponse.status !== 404) {
                // If it's not a 404 (file not found), throw an error for fetch SHA
                throw new Error(`Failed to fetch SHA for ${form}.csv: ${shaResponse.statusText}`);
            }

            // 4. PUT the new content
            const apiUrl = `https://api.github.com/repos/${GITHUB_USER}/${GITHUB_REPO}/contents/${form}.csv`;
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
            allSucceeded = false;
            alert(`Failed to save ${form} data: ${error.message}`);
            console.error(`Error saving data for ${form}:`, error);
        }
    }
    
    hideLoading(); // <<< CALL
    if (allSucceeded) {
        alert('All available class data saved successfully to the repository!');
    } else {
        alert('Completed saving, but one or more class files failed to save. Check console for details.');
    }
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
        
        // Add scores for each available subject
        bodyHTML += availableSubjects.map(subject => {
            const score = student[subject] || '-';
            return `<td>${score}</td>`;
        }).join('');
        
        bodyHTML += `</tr>`;
    });
    bodyHTML += `</tbody>`;
    
    const tableHTML = `<table id="scoresTable">${headerHTML}${bodyHTML}</table>`;
    tableWrapper.innerHTML = tableHTML;
}

// --- DISPLAY GRADES SHEET ---
async function displayGradesSheet() {
    const form = document.getElementById('gradesClassSelect').value;
    const tableWrapper = document.getElementById('gradesTableWrapper');
    tableWrapper.innerHTML = ''; // Clear previous content

    if (!form) {
        tableWrapper.innerHTML = '<p>Please select a class.</p>';
        return;
    }

    const data = await fetchClassData(form);

    if (data.length === 0) {
        tableWrapper.innerHTML = `<p>No data found for ${form}.</p>`;
        return;
    }
    
    // Determine available subjects based on the first student's data structure
    const availableSubjects = ALL_SUBJECTS.filter(s => data[0][s] !== undefined);

    // Create table headers
    let headerHTML = `<thead><tr><th>Rank</th><th>Exam Number</th><th>STUDENT'S NAME</th>`;
    headerHTML += availableSubjects.map(s => `<th>${getSubjectShortName(s)}</th>`).join('');
    headerHTML += `<th>${(form === 'form3' || form === 'form4') ? 'Aggregate' : 'Average'}</th>`;
    headerHTML += `</tr></thead>`;

    // Calculate metrics and rank all students
    const studentsWithMetrics = [];
    for (const student of data) {
        const studentMetrics = await calculateStudentMetrics(student, form);
        studentsWithMetrics.push({ student, metrics: studentMetrics });
    }
    
    // Sort by overallMetric (lower is better, 999 is worst/unrankable).
    // F1/F2: negative total score (lower negative value = higher total score = better rank)
    // F3/F4: aggregate (lower aggregate = better rank)
    studentsWithMetrics.sort((a, b) => a.metrics.overallMetric - b.metrics.overallMetric);

    let currentRank = 1;
    let totalRankableStudents = studentsWithMetrics.filter(s => s.metrics.rankable).length;

    let tableHTML = `<table id="gradesTable">${headerHTML}<tbody>`;
    for (let i = 0; i < studentsWithMetrics.length; i++) {
        const { student, metrics: studentMetrics } = studentsWithMetrics[i];

        // Handle rank tie logic
        let displayRank = '-';
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
                const score = parseInt(rawScore);
                grade = getGradeAndRemark(form, score).grade;
            } else if (rawScore === 'X' || rawScore === 'N') {
                grade = rawScore; // Display X or N for not enrolled/did not write
            }
            return `<td>${grade}</td>`;
        }).join('');
        
        tableHTML += `<td>${studentMetrics.metricDisplay}</td>`;
        tableHTML += `</tr>`;
    }
    tableHTML += `</tbody></table>`;
    
    tableWrapper.innerHTML = tableHTML;
}

// --- CLASS ANALYSIS SHEET ---
async function displayAnalysisSheet(form) {
    const tableWrapper = document.getElementById('analysisTableWrapper');
    tableWrapper.innerHTML = ''; // Clear previous content

    const data = await fetchClassData(form);

    if (data.length === 0) {
        tableWrapper.innerHTML = `<p>No data found for ${form}.</p>`;
        return;
    }
    
    // Determine available subjects based on the first student's data structure
    const availableSubjects = ALL_SUBJECTS.filter(s => data[0][s] !== undefined);
    const isUpperForm = form.includes('form3') || form.includes('form4');

    // 1. Initialize analysis structure for each subject
    const grades = isUpperForm ? ['1', '2', '3', '4', '5', '6', '7', '8', '9'] : ['1', '2', '3', '4', '5', '6', '7', '8'];
    const subjectAnalysis = Object.fromEntries(availableSubjects.map(subject => [subject, {
        grades: Object.fromEntries(grades.map(g => [g, 0])),
        absent: 0,
        sat: 0,
        passed: 0,
        failed: 0,
    }]));

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
            }
        });
    });

    // 3. Generate table HTML
    let headerHTML = `<thead><tr><th>Metric</th>`;
    headerHTML += availableSubjects.map(s => `<th>${getSubjectShortName(s)}</th>`).join('');
    headerHTML += `</tr></thead>`;

    let bodyHTML = `<tbody>`;

    // Row 1: Number of Students Who Sat
    bodyHTML += `<tr><td>SAT</td>`;
    bodyHTML += availableSubjects.map(subject => `<td>${subjectAnalysis[subject].sat}</td>`).join('');
    bodyHTML += `</tr>`;

    // Row 2: Number of Students Absent/Did Not Write/Not Enrolled (N/X)
    bodyHTML += `<tr><td>ABS/N/X</td>`;
    bodyHTML += availableSubjects.map(subject => `<td>${subjectAnalysis[subject].absent}</td>`).join('');
    bodyHTML += `</tr>`;

    // Grade Rows
    grades.forEach(grade => {
        bodyHTML += `<tr><td>GRADE ${grade}</td>`;
        bodyHTML += availableSubjects.map(subject => `<td>${subjectAnalysis[subject].grades[grade]}</td>`).join('');
        bodyHTML += `</tr>`;
    });

    // Row 3: Passed Count
    bodyHTML += `<tr><td>PASSED</td>`;
    bodyHTML += availableSubjects.map(subject => `<td>${subjectAnalysis[subject].passed}</td>`).join('');
    bodyHTML += `</tr>`;

    // Row 4: Failed Count
    bodyHTML += `<tr><td>FAILED</td>`;
    bodyHTML += availableSubjects.map(subject => `<td>${subjectAnalysis[subject].failed}</td>`).join('');
    bodyHTML += `</tr>`;

    // Row 5: Pass Rate (%)
    bodyHTML += `<tr><td>PASS RATE (%)</td>`;
    bodyHTML += availableSubjects.map(subject => {
        const analysis = subjectAnalysis[subject];
        const rate = analysis.sat > 0 ? ((analysis.passed / analysis.sat) * 100).toFixed(1) : '0.0';
        return `<td>${rate}%</td>`;
    }).join('');
    bodyHTML += `</tr>`;

    bodyHTML += `</tbody>`;

    const tableHTML = `<table id="analysisTable">${headerHTML}${bodyHTML}</table>`;
    tableWrapper.innerHTML = tableHTML;
}


// --- CONFIGURATION MANAGEMENT (ADMIN) ---
function populateTeacherInputs() {
    const selectedClass = document.getElementById('classTeacherDropdown').value;
    const panel = document.getElementById('teacherAssignmentPanel');
    panel.innerHTML = '';
    
    if (!currentConfig || !currentConfig.teachers || !currentConfig.teachers[selectedClass]) {
        // Use default teachers if config is not fully loaded or missing the class
        currentConfig = currentConfig || getDefaultConfig();
        currentConfig.teachers = currentConfig.teachers || getDefaultConfig().teachers;
        currentConfig.teachers[selectedClass] = currentConfig.teachers[selectedClass] || getDefaultConfig().teachers[selectedClass];
    }
    
    const teachersForClass = currentConfig.teachers[selectedClass];

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
        // to conform to the side-by-side layout defined in the new CSS.
        // This is handled by the new CSS selector: .teacher-input-group input[type="text"]
        group.appendChild(input);
        
        panel.appendChild(group);
    });
}

async function handleSaveConfig() {
    const token = document.getElementById('githubToken').value.trim();
    if (!token) {
        alert('Please enter your Authorization Code on the Admin Dashboard.');
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

        // Update local state
        currentConfig = newConfig;
        configSha = latestSha; // This should be updated by the response, but for simplicity, we use the one we fetched.

        alert('Configuration saved successfully!');

    } catch (error) {
        console.error("Error saving config:", error);
        alert(`Failed to save configuration: ${error.message}`);
    } finally {
        hideLoading(); // <<< CALL
    }
}


// --- FILE MANAGEMENT (ADMIN) ---

function populateDeleteDropdown(files) {
    const deleteDropdown = document.getElementById('deleteDropdown');
    deleteDropdown.innerHTML = '<option value="">-- Select CSV File --</option>';
    
    files.forEach(file => {
        if (file.name.endsWith('.csv') && ALL_CLASSES.includes(file.name.replace('.csv', ''))) {
            const option = document.createElement('option');
            option.value = file.name;
            option.textContent = file.name;
            deleteDropdown.appendChild(option);
        }
    });
}

function uploadCSV() {
    const fileInput = document.getElementById('csvUpload');
    const classDropdown = document.getElementById('classDropdown');
    const token = document.getElementById('githubToken').value.trim();

    if (!fileInput.files.length || !classDropdown.value || !token) {
        alert('Please select a CSV file, a class, and enter your GitHub token.');
        return;
    }

    const file = fileInput.files[0];
    const className = classDropdown.value; // e.g., 'form1'
    const fileName = `${className}.csv`;

    if (file.type !== 'text/csv' && file.type !== 'application/vnd.ms-excel') {
        alert('Please upload a valid CSV file.');
        return;
    }

    showLoading(); // <<< CALL
    
    // Check if the uploaded file has the necessary columns (headers)
    const reader = new FileReader();
    reader.onload = function(event) {
        const csvContent = event.target.result;
        Papa.parse(csvContent, {
            header: true,
            skipEmptyLines: true,
            complete: function(results) {
                const data = results.data;
                if (data.length === 0) {
                    hideLoading();
                    alert('The uploaded CSV file is empty or invalid.');
                    return;
                }
                
                const firstRow = data[0];
                const requiredColumns = ["Exam Number", "STUDENT'S NAME", "Date of Birth"];
                const missingColumns = requiredColumns.filter(col => firstRow[col] === undefined);
                
                if (missingColumns.length > 0) {
                    hideLoading();
                    alert(`CSV is missing required columns: ${missingColumns.join(', ')}. Please check your file headers.`);
                    return;
                }
                
                // OPTIONAL: Check if any subject columns are present
                const hasSubjectColumns = ALL_SUBJECTS.some(subject => firstRow[subject] !== undefined);
                if (!hasSubjectColumns) {
                    // Only warn, don't block. An admin might upload a manifest of students only.
                    console.warn("CSV does not contain any subject score columns.");
                }

                // Convert the parsed data back to CSV string (ensures data consistency)
                const finalCsv = Papa.unparse(data);
                const encodedContent = btoa(unescape(encodeURIComponent(finalCsv)));
                
                // 1. Get SHA (if file exists)
                fetch(`https://api.github.com/repos/${GITHUB_USER}/${GITHUB_REPO}/contents/${fileName}`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                })
                .then(response => {
                    if (response.status === 404) {
                        return { sha: null }; // File does not exist, safe to create
                    }
                    if (!response.ok) {
                        throw new Error(`Failed to check existing file: ${response.statusText}`);
                    }
                    return response.json();
                })
                // 2. Perform the PUT operation
                .then(data => {
                    const apiUrl = `https://api.github.com/repos/${GITHUB_USER}/${GITHUB_REPO}/contents/${fileName}`;
                    return fetch(apiUrl, {
                        method: 'PUT',
                        headers: {
                            'Authorization': `Bearer ${token}`,
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({
                            message: `Upload ${fileName}`,
                            content: encodedContent,
                            sha: data.sha // Use existing SHA if found, otherwise null
                        })
                    });
                })
                // 3. Handle response
                .then(response => {
                    if (!response.ok) {
                        return response.json().then(err => {
                            throw new Error(err.message || response.statusText);
                        });
                    }
                    // Clear the in-memory cache for this class to force re-fetch
                    delete currentClassData[className];
                    alert(`CSV for ${className} uploaded successfully!`);
                    fileInput.value = ''; // Clear file input
                    refreshFileList();
                })
                .catch(error => {
                    alert(`Upload failed: ${error.message}`);
                    console.error(error);
                })
                .finally(() => hideLoading()); // <<< CALL
            } // End complete function
        }); // End Papa.parse
    }; // End reader.onload
    // END MODIFIED LOGIC
    reader.readAsText(file);
}

function deleteCSV(){
    const fileName=document.getElementById('deleteDropdown').value;
    const token=document.getElementById('githubToken').value.trim();
    if(!fileName||!token){alert('Please select a file and enter your GitHub token.');return;}
    if(!confirm(`Are you sure you want to delete ${fileName}? This action is irreversible.`)){return;}

    showLoading(); // <<< CALL
    
    // 1. Fetch the SHA first
    fetch(`https://api.github.com/repos/${GITHUB_USER}/${GITHUB_REPO}/contents/${fileName}`,{
        headers:{'Authorization':`Bearer ${token}`}
    })
    .then(response => {
        if (response.status === 404) {
            throw new Error("File not found on GitHub.");
        }
        if (!response.ok) {
            throw new Error(`Failed to fetch file SHA: ${response.statusText}`);
        }
        return response.json();
    })
    // 2. Perform the DELETE operation using the SHA
    .then(data => {
        return fetch(`https://api.github.com/repos/${GITHUB_USER}/${GITHUB_REPO}/contents/${fileName}`,{
            method:'DELETE',
            headers:{'Authorization':`Bearer ${token}`,'Content-Type':'application/json'},
            body:JSON.stringify({
                message:`Delete ${fileName}`,
                sha: data.sha
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
    .then(response => {
        if (!response.ok) {
            throw new Error(`Failed to fetch file list: ${response.statusText}`);
        }
        return response.json();
    })
    .then(data => {
        populateDeleteDropdown(data);
    })
    .catch(error => {
        console.error("Error fetching file list:", error);
    })
    .finally(() => hideLoading()); // <<< CALL
}

// --- MAIN RESULT DISPLAY LOGIC (STUDENT & ADMIN) ---
async function loadResults(callingPage = 'initialPage') {
    lastCallingPage = callingPage;

    // Determine input source
    let form, studentNumber, dob;
    let isStudentPortal = false;

    if (callingPage === 'initialPage') {
        form = document.getElementById('selectedForm').value.toLowerCase();
        studentNumber = document.getElementById('studentNumberInput').value.trim().toUpperCase();
        dob = document.getElementById('dobInput').value.trim();
        isStudentPortal = true;
    } else if (callingPage === 'progressSelectorPage') {
        form = document.getElementById('progressFormSelect').value.toLowerCase();
        studentNumber = document.getElementById('progressStudentNumberInput').value.trim().toUpperCase();
        dob = 'admin_override'; // Bypass DOB check for admin access
    }

    if (!form || !studentNumber || (isStudentPortal && !dob)) {
        alert('Please fill all required fields (Class, Exam Number, and Date of Birth).');
        return;
    }
    
    // FIX: Ensure config is loaded first. This logic is correct and handles the user's request
    // to load results if fields are filled. It pauses until config is ready.
    if (!currentConfig) { 
        // Will show loading indicator internally
        await initializeConfig();
    }
    updateLoadingPercent(10); // Start loading indicator

    // Fetch the data and calculate metrics for all students
    const data = await fetchClassData(form);
    updateLoadingPercent(50);

    if (data.length === 0) {
        alert(`No data found for ${form}. Please inform the admin.`);
        return;
    }

    // 1. Find the student
    const student = data.find(s => s["Exam Number"] === studentNumber);

    if (!student) {
        alert('Student not found in the records.');
        return;
    }

    // 2. Validate DOB (only for student portal entry)
    if (isStudentPortal) {
        // DOB check is based on a field named 'Date of Birth' in the internal data structure
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
    const availableSubjects = ALL_SUBJECTS.filter(s => student[s] !== undefined);

    // 5. Populate Report Header
    document.getElementById('reportStudentName').textContent = student["STUDENT'S NAME"] || '-';
    document.getElementById('reportForm').textContent = form.toUpperCase().replace('FORM', 'Form ') || '-';
    document.getElementById('reportExamNo').textContent = studentNumber || '-';
    document.getElementById('reportTerm').textContent = currentConfig.term ? `Term ${currentConfig.term}` : '-';

    // 6. Populate Results Table
    const tableBody = document.getElementById('reportBody');
    tableBody.innerHTML = '';
    
    // Get teachers configuration
    const teachersForStudentClass = (currentConfig.teachers && currentConfig.teachers[form]) || getDefaultConfig().teachers[form];

    availableSubjects.forEach(subject => {
        const row = tableBody.insertRow();
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
        if (score !== null) { // Include 0 as a score for ranking
            const scoresInClass = data
                .map(s => parseInt(s[subject]))
                .filter(s => !isNaN(s) && isFinite(s)); // Only consider actual numeric scores
            
            scoresInClass.sort((a, b) => b - a);
            
            // Find all instances of the score
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

    // 7. Overall Ranking
    let overallRank = 'N/A';
    let overallRemark = studentMetrics.overallRemark;
    let metricDisplay = studentMetrics.metricDisplay;

    if (studentMetrics.rankable) {
        if (totalRankableStudents > 0) {
            // Find the student's index in the sorted, rankable list
            let studentRankIndex = rankableStudents.findIndex(s => s.examNo === studentNumber);
            
            // Use tie-breaking logic for the rank position
            let rankPosition = studentRankIndex + 1;
            for(let i = 0; i < studentRankIndex; i++) {
                if (rankableStudents[i].metric === rankableStudents[studentRankIndex].metric) {
                    rankPosition = i + 1;
                    break;
                }
            }
            overallRank = `${rankPosition}/${totalRankableStudents}`;
        }
    }


    // 8. Populate Summary/Aggregate/Average
    const isUpperForm = form.includes('form3') || form.includes('form4');
    
    // Show/Hide Average/Aggregate lines
    document.getElementById('averageLine').classList.toggle('hidden', isUpperForm);
    document.getElementById('aggregateLine').classList.toggle('hidden', !isUpperForm);
    
    if (isUpperForm) {
        document.getElementById('reportAggregate').textContent = metricDisplay;
    } else {
        document.getElementById('reportAverage').textContent = metricDisplay;
    }
    
    document.getElementById('reportPosition').textContent = overallRank;
    document.getElementById('reportOverallRemark').textContent = overallRemark;
    document.getElementById('reportComment').textContent = currentConfig.generalComment || 'No comment provided.';


    // 9. Populate Grade Key
    document.getElementById('gradeKeyPlaceholder').innerHTML = generateGradeKeyTable(form);
    
    updateLoadingPercent(100);
    // 10. Go to the report page
    goToPage('progressReport');
    hideLoading(); // Final hide call
}

// --- PDF CREATION ---
// This function remains unchanged as per user constraints.
function openFullPdf(){
    // Standard PDF creation logic
    const studentName = document.getElementById('reportStudentName').textContent;
    const examNo = document.getElementById('reportExamNo').textContent;
    
    // Sanitize file name for OS logic
    const safeName = studentName.replace(/[^a-zA-Z0-9\s]/g, '').replace(/\s+/g, '_');
    const safeExamNo = examNo.replace(/[^a-zA-Z0-9\s/]/g, '-');
    const fileName = `${safeName}_${safeExamNo}_Report.pdf`;

    // Ensure we are operating on the print view of the report
    const contentToCapture = document.getElementById('progressReport');

    // Temporarily hide buttons to prevent them from appearing in the PDF
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

        // Add image starting at (0, 0) and filling the width, cropping the bottom if necessary
        pdf.addImage(imgData,'PNG',0,0,pdfWidth,pdfHeight);

        pdf.save(fileName);
    });
}

// --- INITIALIZATION ---
// Initialize config on window load if necessary, but this is deferred to auth functions for security
window.onload = function() {
    // Only attempt to initialize if on the main page,
    // otherwise rely on admin functions to call it.
    // The current design defers it to loadResults/verifyAdmin.
};
