const fs = require('fs');
let code = fs.readFileSync('src/pages/EssayResults.tsx', 'utf8');

// 1. Add imports
code = code.replace(
  "import { ArrowLeft, Loader2, Image as ImageIcon, FileText, CheckCircle, AlertCircle, RefreshCw, X, FileEdit, Calculator, Users } from 'lucide-react';",
  "import { ArrowLeft, Loader2, Image as ImageIcon, FileText, CheckCircle, AlertCircle, RefreshCw, X, FileEdit, Calculator, Users, BarChart3, Send, Trash2 } from 'lucide-react';\nimport { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LabelList } from 'recharts';"
);

// 2. Add states for students and delete handling
code = code.replace(
  "const [gradingError, setGradingError] = useState('');",
  "const [gradingError, setGradingError] = useState('');\n  const [students, setStudents] = useState<any[]>([]);\n  const [submissionToDelete, setSubmissionToDelete] = useState<string | null>(null);\n  const [isDeleting, setIsDeleting] = useState(false);\n  const { appUser } = useAuth(); // oops need useAuth if used? Actually no need for useAuth here unless it's missing."
);

if (!code.includes("useAuth")) {
    code = code.replace(
        "import { useParams, Link } from 'react-router-dom';",
        "import { useParams, Link } from 'react-router-dom';\nimport { useAuth } from '../lib/AuthContext';"
    );
}

// 3. Add useMemo for scoreData
code = code.replace(
  "useEffect(() => {",
  `const scoreData = React.useMemo(() => {
    const counts: Record<string, number> = {
      '0.0': 0, '0.5': 0, '1.0': 0, '1.5': 0, '2.0': 0, '2.5': 0, '3.0': 0, '3.5': 0, '4.0': 0, '4.5': 0,
      '5.0': 0, '5.5': 0, '6.0': 0, '6.5': 0, '7.0': 0, '7.5': 0, '8.0': 0, '8.5': 0, '9.0': 0, '9.5': 0, '10.0': 0
    };
    
    submissions.forEach(sub => {
      if (sub.status === 'graded') {
        const score = parseFloat(sub.score);
        if (!isNaN(score)) {
          const roundedScore = (Math.round(score * 2) / 2).toFixed(1);
          if (counts[roundedScore] !== undefined) {
            counts[roundedScore]++;
          }
        }
      }
    });

    return Object.keys(counts).map(score => ({
      name: score,
      count: counts[score]
    }));
  }, [submissions]);

  const handleDeleteSubmission = async () => {
    if (!submissionToDelete) return;
    setIsDeleting(true);
    try {
      const { deleteDoc } = require('firebase/firestore');
      await deleteDoc(doc(db, 'essay_submissions', submissionToDelete));
      setSubmissions(submissions.filter(s => s.id !== submissionToDelete));
      if (selectedSubmission?.id === submissionToDelete) {
        setSelectedSubmission(null);
      }
      setSubmissionToDelete(null);
    } catch (error) {
      console.error("Lỗi khi xóa bài làm:", error);
    } finally {
      setIsDeleting(false);
    }
  };

  useEffect(() => {`
);

// 4. Update fetchData
code = code.replace(
  "setSubmissions(subs);\n    } catch (err: any) {",
  `setSubmissions(subs);
      let studs: any[] = [];
      const essayData = essayDoc.data();
      if (essayData && essayData.assignedClasses && essayData.assignedClasses.length > 0) {
        const chunks = [];
        for (let i = 0; i < essayData.assignedClasses.length; i += 10) {
          chunks.push(essayData.assignedClasses.slice(i, i + 10));
        }
        for (const chunk of chunks) {
          const qStudents = query(collection(db, 'users'), where('role', '==', 'student'), where('className', 'in', chunk));
          const studentSnap = await getDocs(qStudents);
          studs = studs.concat(studentSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        }
      } else {
          const qStudents = query(collection(db, 'users'), where('role', '==', 'student'));
          const studentSnap = await getDocs(qStudents);
          studs = studentSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      }
      setStudents(studs);
    } catch (err: any) {`
);

// 5. Replace left column UI
const oldListTarget = `{submissions.length === 0 ? (
              <div className="bg-white rounded-[2rem] border border-slate-200/60 p-8 text-center shadow-sm">
                <FileText className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                <p className="text-slate-500 font-medium">Chưa có học sinh nào nộp bài.</p>
              </div>
            ) : (
              <div className="bg-white shadow-lg rounded-2xl border border-gray-100 overflow-hidden">
                <ul className="divide-y divide-gray-100">
                  {submissions.map((sub, idx) => (
                    <li key={sub.id}>
                      <button 
                        onClick={() => setSelectedSubmission(sub)}
                        className={\`w-full text-left px-5 py-5 hover:bg-gray-50/50 transition-colors \${selectedSubmission?.id === sub.id ? 'bg-indigo-50/50 border-l-4 border-indigo-600' : 'border-l-4 border-transparent'}\`}
                      >
                        <div className="flex flex-col xl:flex-row xl:items-center xl:justify-between">
                          <div className="flex items-center mb-3 xl:mb-0">
                            <div className="flex-shrink-0 w-10 h-10 bg-gradient-to-br from-indigo-100 to-purple-100 rounded-full flex items-center justify-center border border-indigo-200 shadow-sm">
                              <Users className="h-5 w-5 text-indigo-600" />
                            </div>
                            <div className="ml-3">
                              <h3 className="text-sm font-bold text-gray-900">{sub.studentName}</h3>
                              <p className="text-xs font-medium text-gray-500 mt-0.5">
                                Nộp lúc: {new Date(sub.submittedAt).toLocaleString('vi-VN')}
                              </p>
                            </div>
                          </div>
                          <div className="text-left xl:text-right flex items-center xl:justify-end ml-13 xl:ml-0">
                            {sub.status === 'graded' ? (
                              <div className="bg-indigo-50 px-3 py-1.5 rounded-xl border border-indigo-100">
                                <p className="text-lg font-black text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 to-purple-600">{sub.score} <span className="text-xs text-indigo-300 font-bold">/ 10</span></p>
                              </div>
                            ) : (
                              <div className="bg-amber-50 px-3 py-1.5 rounded-xl border border-amber-100">
                                <p className="text-xs font-bold text-amber-600">Chưa chấm</p>
                              </div>
                            )}
                          </div>
                        </div>
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}`;

const newListTarget = `
            {/* Phổ điểm */}
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 mb-6">
              <h2 className="text-lg font-bold text-gray-800 mb-6 flex items-center">
                <span className="bg-indigo-100 text-indigo-600 p-2 rounded-lg mr-3">
                  <BarChart3 className="w-5 h-5" />
                </span>
                Phổ điểm
              </h2>
              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={scoreData} margin={{ top: 20, right: 20, left: -20, bottom: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#6B7280', fontSize: 10 }} dy={10} />
                    <YAxis allowDecimals={false} axisLine={false} tickLine={false} tick={{ fill: '#6B7280', fontSize: 10 }} />
                    <Tooltip cursor={{ stroke: '#F3F4F6', strokeWidth: 2 }} contentStyle={{ borderRadius: '0.75rem', border: 'none', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)' }} formatter={(value: number) => [\`\${value} học sinh\`, 'Số lượng']} labelFormatter={(label) => \`Điểm: \${label}\`} />
                    <Line type="monotone" dataKey="count" stroke="#6366F1" strokeWidth={3} dot={{ r: 4, fill: '#6366F1', strokeWidth: 2, stroke: '#fff' }} activeDot={{ r: 6, fill: '#4F46E5', strokeWidth: 0 }}>
                      <LabelList dataKey="count" position="top" fill="#4F46E5" fontSize={10} fontWeight={600} formatter={(val: number) => val > 0 ? val : ''} offset={8} />
                    </Line>
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            {submissions.length === 0 ? (
              <div className="bg-white rounded-[2rem] border border-slate-200/60 p-8 text-center shadow-sm">
                <FileText className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                <p className="text-slate-500 font-medium">Chưa có học sinh nào nộp bài.</p>
              </div>
            ) : (
              <div className="bg-white shadow-lg rounded-2xl border border-gray-100 overflow-hidden">
                <ul className="divide-y divide-gray-100">
                  {submissions.map((sub, idx) => {
                    const student = students.find(s => s.uid === sub.studentId) || { name: sub.studentName };
                    
                    const handleNotify = (e: React.MouseEvent) => {
                      e.stopPropagation();
                      const message = \`🎉 KẾT QUẢ BÀI TỰ LUẬN 🎉\\n\\nChào \${student.name}, em đã hoàn thành bài tự luận: "\${essay?.title || 'Bài tập'}"\\n\\n🎯 Điểm số: \${sub.score} / 10 điểm.\\n👉 Hãy tiếp tục cố gắng nhé!\\n🔗 Xem lại bài làm: \${window.location.origin}\`;
                      navigator.clipboard.writeText(message).catch(err => console.error("Failed to copy", err));
                      if (student.zalo) {
                        window.open(\`https://chat.zalo.me/?phone=\${student.zalo}\`, '_blank', 'noopener,noreferrer');
                      } else if (student.facebook) {
                        window.open(student.facebook, '_blank', 'noopener,noreferrer');
                      } else {
                        window.open(\`https://chat.zalo.me/\`, '_blank', 'noopener,noreferrer');
                      }
                    };
                    
                    const handleRegrade = (e: React.MouseEvent) => {
                      e.stopPropagation();
                      handleGradeAI(sub);
                    };

                    const handleDelete = (e: React.MouseEvent) => {
                      e.stopPropagation();
                      setSubmissionToDelete(sub.id);
                    };

                    return (
                    <li key={sub.id}>
                      <div 
                        onClick={() => setSelectedSubmission(sub)}
                        className={\`w-full cursor-pointer text-left px-5 py-5 hover:bg-gray-50/50 transition-colors \${selectedSubmission?.id === sub.id ? 'bg-indigo-50/50 border-l-4 border-indigo-600' : 'border-l-4 border-transparent'}\`}
                      >
                        <div className="flex flex-col xl:flex-row xl:items-center xl:justify-between">
                          <div className="flex items-center mb-4 xl:mb-0">
                            <div className="flex-shrink-0 w-10 h-10 bg-gradient-to-br from-indigo-100 to-purple-100 rounded-full flex items-center justify-center border border-indigo-200 shadow-sm">
                              <Users className="h-5 w-5 text-indigo-600" />
                            </div>
                            <div className="ml-3">
                              <h3 className="text-sm font-bold text-gray-900">{sub.studentName}</h3>
                              <p className="text-xs font-medium text-gray-500 mt-0.5">
                                Nộp lúc: {new Date(sub.submittedAt).toLocaleString('vi-VN')}
                              </p>
                            </div>
                          </div>
                          
                          <div className="flex flex-col items-start xl:items-end w-full xl:w-auto">
                            <div className="flex flex-wrap items-center gap-2 mb-2">
                              {sub.status === 'graded' ? (
                                <div className="bg-indigo-50 px-3 py-1.5 rounded-xl border border-indigo-100">
                                  <p className="text-lg font-black text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 to-purple-600">{sub.score} <span className="text-xs text-indigo-300 font-bold">/ 10</span></p>
                                </div>
                              ) : (
                                <div className="bg-amber-50 px-3 py-1.5 rounded-xl border border-amber-100">
                                  <p className="text-xs font-bold text-amber-600">Chưa chấm</p>
                                </div>
                              )}
                              
                              <button onClick={handleNotify} className="p-2 text-blue-500 hover:text-blue-700 hover:bg-blue-50 rounded-xl transition-colors border border-transparent hover:border-blue-100" title="Gửi thông báo">
                                <Send className="w-4 h-4" />
                              </button>
                              <button onClick={handleRegrade} className="p-2 text-indigo-500 hover:text-indigo-700 hover:bg-indigo-50 rounded-xl transition-colors border border-transparent hover:border-indigo-100" title="Chấm lại">
                                <RefreshCw className={\`w-4 h-4 \${isGrading && selectedSubmission?.id === sub.id ? 'animate-spin' : ''}\`} />
                              </button>
                              <button onClick={handleDelete} className="p-2 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-xl transition-colors border border-transparent hover:border-rose-100" title="Xóa bài làm">
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    </li>
                  )})}
                </ul>
              </div>
            )}`;

code = code.replace(oldListTarget, newListTarget);

// Add Delete Modal at the bottom
const deleteModal = `
      {/* Delete Submission Confirmation Modal */}
      {submissionToDelete && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-[60] animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl">
            <div className="flex items-center justify-center w-12 h-12 mx-auto bg-red-100 rounded-full mb-4">
              <AlertCircle className="w-6 h-6 text-red-600" />
            </div>
            <h3 className="text-xl font-bold text-center text-gray-900 mb-2">Xác nhận xóa kết quả</h3>
            <p className="text-center text-gray-600 mb-6">
              Bạn có chắc chắn muốn xóa kết quả bài làm này? Sau khi xóa, học sinh sẽ có thể làm lại bài thi. Hành động này không thể hoàn tác.
            </p>
            <div className="flex justify-center space-x-3">
              <button 
                onClick={() => setSubmissionToDelete(null)} 
                className="px-5 py-2.5 border border-gray-300 rounded-xl text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 transition-colors"
                disabled={isDeleting}
              >
                Hủy
              </button>
              <button 
                onClick={handleDeleteSubmission} 
                className="px-5 py-2.5 border border-transparent rounded-xl text-sm font-medium text-white bg-red-600 hover:bg-red-700 transition-colors shadow-sm"
                disabled={isDeleting}
              >
                {isDeleting ? 'Đang xóa...' : 'Đồng ý xóa'}
              </button>
            </div>
          </div>
        </div>
      )}
`;

code = code.replace("    </div>\n  );\n}", deleteModal + "\n    </div>\n  );\n}");

fs.writeFileSync('src/pages/EssayResults.tsx', code);
console.log("Patched EssayResults.tsx with new layout");
