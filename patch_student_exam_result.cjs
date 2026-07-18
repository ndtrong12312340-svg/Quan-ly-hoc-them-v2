const fs = require('fs');
let code = fs.readFileSync('src/pages/StudentExamResult.tsx', 'utf8');

const oldCheck = `        if (!subSnap.empty) {
          setSubmission({ id: subSnap.docs[0].id, ...subSnap.docs[0].data() });
        }
      } catch (error) {`;

const newCheck = `        if (!subSnap.empty) {
          setSubmission({ id: subSnap.docs[0].id, ...subSnap.docs[0].data() });
        } else {
          // Cleanup dangling reference
          const hasDangling = (appUser as any).completedExams?.some((c: any) => c.examId === examId);
          if (hasDangling && appUser) {
            const userRef = doc(db, 'users', appUser.uid);
            const newCompleted = ((appUser as any).completedExams || []).filter((c: any) => c.examId !== examId);
            try {
               await updateDoc(userRef, { completedExams: newCompleted });
            } catch (err) { console.error("Cleanup error", err); }
          }
        }
      } catch (error) {`;

code = code.replace(oldCheck, newCheck);
fs.writeFileSync('src/pages/StudentExamResult.tsx', code);
console.log("Patched StudentExamResult.tsx");
