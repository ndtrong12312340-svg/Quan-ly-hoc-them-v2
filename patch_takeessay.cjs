const fs = require('fs');
let code = fs.readFileSync('src/pages/TakeEssay.tsx', 'utf8');

// Remove studentApiKey state
code = code.replace(/const \[studentApiKey, setStudentApiKey\] = useState\(''\);/, '');
code = code.replace(/const \[studentApiKey, setStudentApiKey\] = useState<string>\(''\);/, '');

// Rewrite handleSubmit
const oldSubmitStart = `  const handleSubmit = async () => {`;
const oldSubmitEnd = `  };`;
const submitRegex = new RegExp(oldSubmitStart + "[\\s\\S]*?" + oldSubmitEnd);

const newSubmit = `  const handleSubmit = async () => {
    if (!essay || !appUser) return;
    if (images.length === 0) {
      setSubmitError('Vui lòng tải lên ít nhất một hình ảnh bài viết.');
      return;
    }
    
    setIsSubmitting(true);
    setSubmitError(null);
    try {
      const submissionData = {
        essayId: essay.id,
        essayTitle: essay.title,
        studentId: appUser.uid,
        studentName: appUser.name,
        studentClass: appUser.className,
        images,
        submittedAt: new Date().toISOString(),
        status: 'pending',
        score: null,
        aiFeedback: null
      };

      const docRef = await addDoc(collection(db, 'essay_submissions'), submissionData);
      
      const userRef = doc(db, 'users', appUser.uid);
      await updateDoc(userRef, {
        completedEssays: arrayUnion({
          essayId: essay.id,
          submissionId: docRef.id,
          score: null,
          status: 'pending',
          submittedAt: submissionData.submittedAt
        })
      });
      
      setSubmission({ id: docRef.id, ...submissionData });
      setIsSubmitting(false);
    } catch (err: any) {
      console.error("Lỗi nộp bài tự luận:", err);
      setSubmitError(err.message || 'Lỗi hệ thống. Vui lòng thử lại.');
      setIsSubmitting(false);
    }
  };`;
code = code.replace(submitRegex, newSubmit);

// Clean up dangling reference
const oldCheck = `        const subSnap = await getDocs(submissionsQuery);
        if (!subSnap.empty) {
          setSubmission({ id: subSnap.docs[0].id, ...subSnap.docs[0].data() });
        }`;
const newCheck = `        const subSnap = await getDocs(submissionsQuery);
        if (!subSnap.empty) {
          setSubmission({ id: subSnap.docs[0].id, ...subSnap.docs[0].data() });
        } else {
          // Cleanup dangling reference
          const hasDangling = (appUser as any).completedEssays?.some((c: any) => c.essayId === essayId);
          if (hasDangling) {
            const userRef = doc(db, 'users', appUser.uid);
            const newCompleted = ((appUser as any).completedEssays || []).filter((c: any) => c.essayId !== essayId);
            await updateDoc(userRef, { completedEssays: newCompleted });
          }
        }`;
code = code.replace(oldCheck, newCheck);

// Update UI to hide AI key and update score UI
const aiKeyUI = `            {/* API Key section */}`;
// We can just remove the API key UI using regex or string replace
const apiBlockStart = `            <div className="bg-white p-6 rounded-3xl shadow-sm border border-indigo-50/60 mb-6">`;
// Wait, regex might be easier for the UI part. Let's just use string replacement for the specific block if we can find it.
fs.writeFileSync('src/pages/TakeEssay.tsx', code);
console.log("Patched TakeEssay.tsx (Logic)");
