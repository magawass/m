const SUBJECT_ORDER=['Agriculture','Bible Knowledge','Biology','Chemistry','Chichewa','English','Geography','History','Mathematics','Physics','Social/Life'];

function loadResults(){
  const form=document.getElementById('selectedForm').value;
  const studentNumber=document.getElementById('studentNumberInput').value.trim();
  const dob=document.getElementById('dobInput').value.trim();
  if(!form||!studentNumber||!dob){alert('Please fill in all fields.');return;}
  fetch(`https://raw.githubusercontent.com/magawass/m/main/${form}.csv`)
    .then(r=>r.text())
    .then(csv=>{
      const parsed=Papa.parse(csv,{header:true});
      const data=parsed.data;
      const dobInput=new Date(dob);
      const formattedDob=`${dobInput.getFullYear()}-${(dobInput.getMonth()+1).toString().padStart(2,'0')}-${dobInput.getDate().toString().padStart(2,'0')}`;
      const student=data.find(s=>s['Exam Number']===studentNumber&&s['Date of Birth']===formattedDob);
      if(!student){alert('No results found.');return;}
            document.getElementById('studentName').textContent=student["STUDENT'S NAME"];
      document.getElementById('studentID').textContent=student["Exam Number"];
      document.getElementById('studentForm').textContent=form.toUpperCase();

      const subjects=SUBJECT_ORDER.filter(sub=>sub in student);

      let tableHTML='<table><tr><th>Subject</th><th>Score</th><th>Grade</th><th>Position</th><th>Remark</th></tr>';
      let total=0;let grades=[];
      subjects.forEach(sub=>{
        const raw=student[sub];const score=parseInt(raw)||0;total+=score;
        const grade=getGrade(score,form);grades.push(grade);
        const subjectPosition=computeSubjectPosition(data,sub,score);
        tableHTML+=`<tr><td>${sub}</td><td>${score}</td><td>${grade}</td><td>${subjectPosition}</td><td>${getSubjectRemark(score,form)}</td></tr>`;
      });
      tableHTML+='</table>';
      document.getElementById('resultsContainer').innerHTML=tableHTML;

      const position=computeOverallPosition(data,form,subjects);

      let summaryHTML='';
      if(form==='form1'||form==='form2'){
        const avg=Math.round(total/subjects.length);
        summaryHTML=`<table>
          <tr><th>Total</th><th>Average</th><th>Overall Position in Class</th></tr>
          <tr><td>${total}</td><td>${avg}</td><td>${position}</td></tr>
        </table>`;
      }else{
        const numericGrades=grades.map(g=>parseInt(g)).sort((a,b)=>a-b);
        const aggregate=numericGrades.slice(0,6).reduce((sum,g)=>sum+g,0);
        summaryHTML=`<table>
          <tr><th>Aggregate</th><th>Overall Position in Class</th></tr>
          <tr><td>${aggregate}</td><td>${position}</td></tr>
        </table>`;
      }
      document.getElementById('summarySection').innerHTML=summaryHTML;
      document.getElementById('finalRemark').textContent=getFinalRemark(subjects,student,form);

      document.querySelectorAll('.page').forEach(p=>p.style.display='none');
      document.getElementById('resultPage').style.display='block';
    })
    .catch(()=>alert('Failed to load results.'));
}

function computeSubjectPosition(classData,subject,myScore){
  const scores=classData.filter(s=>s&&s[subject]).map(s=>parseInt(s[subject])||0);
  scores.sort((a,b)=>b-a);
  const index=scores.indexOf(myScore);
  return index>=0?(index+1):'-';
}

function computeOverallPosition(classData,form,subjects){
  const metrics=[];
  classData.forEach(s=>{
    if(!s||!s["Exam Number"])return;
    let total=0;let grades=[];
    subjects.forEach(sub=>{
      const score=parseInt(s[sub])||0;
      total+=score;
      grades.push(getGrade(score,form));
    });
    if(form==='form1'||form==='form2'){
      metrics.push({id:s["Exam Number"],value:total,better:(a,b)=>a>b});
    }else{
      const numeric=grades.map(g=>parseInt(g)).sort((a,b)=>a-b);
      const aggregate=numeric.slice(0,6).reduce((sum,g)=>sum+g,0);
      metrics.push({id:s["Exam Number"],value:aggregate,better:(a,b)=>a<b});
    }
  });
  const me=metrics.find(m=>m.id===document.getElementById('studentID').textContent);
  if(!me)return'-';
  const betterCount=metrics.reduce((acc,m)=>acc+(m.better(m.value,me.value)?1:0),0);
  return betterCount+1;
}

function getGrade(score,form){
  if(form==='form1'||form==='form2'){
    if(score>=80)return'A';
    if(score>=65)return'B';
    if(score>=55)return'C';
    if(score>=40)return'D';
    return'F';
  }else{
    if(score>=80)return'1';
    if(score>=75)return'2';
    if(score>=70)return'3';
    if(score>=65)return'4';
    if(score>=60)return'5';
    if(score>=55)return'6';
    if(score>=45)return'7';
    if(score>=35)return'8';
    return'9';
  }
}

function getSubjectRemark(score,form){
  if(form==='form1'||form==='form2'){
    if(score>=80)return'Excellent';
    if(score>=65)return'Very good';
    if(score>=55)return'Good';
    if(score>=40)return'Average';
    return'Fail';
  }else{
    if(score>=75)return'Distinction';
    if(score>=70)return'Strong credit';
    if(score>=65)return'Strong credit';
    if(score>=60)return'Credit';
    if(score>=55)return'Credit';
    if(score>=45)return'Pass';
    if(score>=35)return'Pass';
    return'Fail';
  }
}

function getFinalRemark(subjects,student,form){
  let passedSubjects=0;let englishPassed=false;
  subjects.forEach(sub=>{
    const score=parseInt(student[sub]);
    if(form==='form1'||form==='form2'){
      if(score>=40){passedSubjects++;if(sub==='English')englishPassed=true;}
    }else{
      if(score>=35){passedSubjects++;if(sub==='English')englishPassed=true;}
    }
  });
  return(passedSubjects>=6&&englishPassed)?'Pass':'Fail';
}

function openPrintView(){window.print();}
function openFullPdf(){
  html2canvas(document.getElementById('resultPage')).then(canvas=>{
    const imgData=canvas.toDataURL('image/png');
    const pdf=new jspdf.jsPDF();
    const imgProps=pdf.getImageProperties(imgData);
    const pdfWidth=pdf.internal.pageSize.getWidth();
    const pdfHeight=(imgProps.height*pdfWidth)/imgProps.width;
    pdf.addImage(imgData,'PNG',0,0,pdfWidth,pdfHeight);
    pdf.save('Magawa_Results.pdf');
  });
}

const GITHUB_USER='magawass';
const GITHUB_REPO='m';

function openAdmin(){
  document.querySelectorAll('.page').forEach(p=>p.style.display='none');
  document.getElementById('adminPage').style.display='block';
}

function backToInitialPage(){
  document.querySelectorAll('.page').forEach(p=>p.style.display='none');
  document.getElementById('initialPage').style.display='block';
  document.getElementById('selectedForm').value='';
  document.getElementById('studentNumberInput').value='';
  document.getElementById('dobInput').value='';
  document.getElementById('adminPassword').value='';
  document.getElementById('githubToken').value='';
  document.getElementById('adminPanel').style.display='none';
  document.getElementById('adminLabel').style.display='block';
  document.getElementById('adminPassword').style.display='inline-block';
  document.getElementById('adminLoginBtn').style.display='inline-block';
}

function verifyAdmin(){
  const pass=document.getElementById('adminPassword').value;
  if(pass==='magawa123'){
    document.getElementById('adminPanel').style.display='block';
    document.getElementById('adminLabel').style.display='none';
    document.getElementById('adminPassword').style.display='none';
    document.getElementById('adminLoginBtn').style.display='none';
    refreshFileList();
  }else{alert('Incorrect password');}
}

function uploadCSV(){
  const className=document.getElementById('classDropdown').value;
  const fileInput=document.getElementById('csvUpload');
  const file=fileInput.files[0];
  const token=document.getElementById('githubToken').value.trim();
  if(!className||!file||!token){alert('Please select a class, choose a file, and enter your GitHub token.');return;}
  const reader=new FileReader();
  reader.onload=function(){
    const content=reader.result;
    const encodedContent=btoa(unescape(encodeURIComponent(content)));
    fetch(`https://api.github.com/repos/${GITHUB_USER}/${GITHUB_REPO}/contents/${className}.csv`,{
      method:'PUT',
      headers:{'Authorization':`Bearer ${token}`,'Content-Type':'application/json'},
      body:JSON.stringify({message:`Upload ${className}.csv`,content:encodedContent})
    })
    .then(res=>res.json())
    .then(()=>{alert('Upload successful.');refreshFileList();})
    .catch(()=>alert('Upload failed. Check token and repo permissions.'));
  };
  reader.readAsText(file);
}

function deleteCSV(){
  const fileName=document.getElementById('deleteDropdown').value;
  const token=document.getElementById('githubToken').value.trim();
  if(!fileName||!token){alert('Please select a file and enter your GitHub token.');return;}
  fetch(`https://api.github.com/repos/${GITHUB_USER}/${GITHUB_REPO}/contents/${fileName}`, {
    headers:{'Authorization':`Bearer ${token}`}
  })
  .then(res=>res.json())
  .then(fileData=>{
    const sha=fileData.sha;
    fetch(`https://api.github.com/repos/${GITHUB_USER}/${GITHUB_REPO}/contents/${fileName}`,{
      method:'DELETE',
      headers:{'Authorization':`Bearer ${token}`,'Content-Type':'application/json'},
      body:JSON.stringify({message:`Delete ${fileName}`,sha:sha})
    })
    .then(()=>{alert('File deleted.');refreshFileList();})
    .catch(()=>alert('Delete failed. Check token and file name.'));
  });
}

function refreshFileList(){
  fetch(`https://api.github.com/repos/${GITHUB_USER}/${GITHUB_REPO}/contents`)
    .then(res=>res.json())
    .then(files=>{
      const dropdown=document.getElementById('deleteDropdown');
      dropdown.innerHTML='<option value="">-- Select CSV File --</option>';
      files.forEach(file=>{
        if(file.name.endsWith('.csv')){
          const opt=document.createElement('option');
          opt.value=file.name;
          opt.textContent=file.name;
          dropdown.appendChild(opt);
        }
      });
    })
    .catch(()=>alert('Failed to load file list.'));
}
