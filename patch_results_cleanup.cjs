const fs = require('fs');

let examCode = fs.readFileSync('src/pages/ExamResults.tsx', 'utf8');
let newExamCode = examCode.replace(
  /const newCompletedExams = userData\.completedExams\.filter\(\(c: any\) => c\.submissionId !== submissionToDelete\);/g,
  "const newCompletedExams = userData.completedExams.filter((c: any) => c.examId !== exam.id);"
);
fs.writeFileSync('src/pages/ExamResults.tsx', newExamCode);

let essayCode = fs.readFileSync('src/pages/EssayResults.tsx', 'utf8');
let newEssayCode = essayCode.replace(
  /const newCompletedEssays = userData\.completedEssays\.filter\(\(c: any\) => c\.submissionId !== submissionToDelete\);/g,
  "const newCompletedEssays = userData.completedEssays.filter((c: any) => c.essayId !== essayId);"
);
fs.writeFileSync('src/pages/EssayResults.tsx', newEssayCode);

console.log("Patched EssayResults & ExamResults to filter by examId/essayId");
