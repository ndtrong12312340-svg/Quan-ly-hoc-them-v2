const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf8');

if (!code.includes('import TakeEssay')) {
    code = code.replace("import EssayResults from './pages/EssayResults';", "import EssayResults from './pages/EssayResults';\nimport TakeEssay from './pages/TakeEssay';");
}

if (!code.includes('path="/student/essay/:essayId"')) {
    code = code.replace(
        `      {/* Student Routes */}
      <Route path="/student" element={`,
        `      {/* Student Routes */}
      <Route path="/student/essay/:essayId" element={
        <ProtectedRoute allowedRoles={['student']}>
          <TakeEssay />
        </ProtectedRoute>
      } />
      <Route path="/student" element={`
    );
}

fs.writeFileSync('src/App.tsx', code);
console.log("Patched App.tsx");
