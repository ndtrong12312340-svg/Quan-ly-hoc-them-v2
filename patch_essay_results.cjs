const fs = require('fs');
let code = fs.readFileSync('src/pages/EssayResults.tsx', 'utf8');

const oldUpdate = `      if (sub && sub.studentId) {
        const userRef = doc(db, 'users', sub.studentId);
        const userDoc = await getDoc(userRef);
        if (userDoc.exists()) {
          const userData = userDoc.data();
          if (userData.completedEssays) {
            const newCompletedEssays = userData.completedEssays.filter((c: any) => c.submissionId !== submissionToDelete);
            await updateDoc(userRef, { completedEssays: newCompletedEssays });
          }
        }
      }`;

const newUpdate = `      if (sub && sub.studentId) {
        const userRef = doc(db, 'users', sub.studentId);
        const userDoc = await getDoc(userRef);
        if (userDoc.exists()) {
          const userData = userDoc.data();
          if (userData.completedEssays) {
            try {
              const newCompletedEssays = userData.completedEssays.filter((c: any) => c.submissionId !== submissionToDelete);
              await updateDoc(userRef, { completedEssays: newCompletedEssays });
            } catch (err) {
              console.error("Lỗi cập nhật user doc:", err);
            }
          }
        }
      }`;
code = code.replace(oldUpdate, newUpdate);

fs.writeFileSync('src/pages/EssayResults.tsx', code);
console.log("Patched EssayResults.tsx");
