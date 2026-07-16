const fs = require('fs');
let code = fs.readFileSync('src/pages/StudentDashboard.tsx', 'utf8');

const importReplacement = `import { collection, query, where, getDocs, getDoc, doc, updateDoc } from 'firebase/firestore';`;
const newImport = `import { collection, query, where, getDocs, getDoc, doc, updateDoc } from 'firebase/firestore';\nimport { PenTool } from 'lucide-react';`;
if (!code.includes('PenTool')) {
    code = code.replace(importReplacement, newImport);
}

const stateTarget = `  const [exams, setExams] = useState<any[]>([]);`;
const stateReplacement = `  const [exams, setExams] = useState<any[]>([]);\n  const [essays, setEssays] = useState<any[]>([]);`;
if (!code.includes('const [essays, setEssays]')) {
    code = code.replace(stateTarget, stateReplacement);
}

const fetchTarget = `      let data: any = { exams: [], knowledges: [] };`;
const fetchReplacement = `      let data: any = { exams: [], knowledges: [], essays: [] };`;
code = code.replace(fetchTarget, fetchReplacement);

const sortTarget = `        }
        return titleA.localeCompare(titleB);
      });
      setExams(examsList);`;
const sortReplacement = `        }
        return titleA.localeCompare(titleB);
      });
      setExams(examsList);
      
      const essaysList = data.essays || [];
      setEssays(essaysList);`;
if (!code.includes('setEssays(essaysList)')) {
    code = code.replace(sortTarget, sortReplacement);
}

const renderTarget = `          {activeTab === 'essays' && (
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div className="bg-white shadow-sm overflow-hidden sm:rounded-[2rem] border border-slate-200/60 p-6 md:p-8">
                <div className="text-center">
                  <FileText className="w-16 h-16 mx-auto text-indigo-200 mb-4" />
                  <h3 className="text-2xl font-bold text-slate-800 mb-2">Bài tập tự luận</h3>
                  <p className="text-slate-500 max-w-lg mx-auto mb-8">
                    Hệ thống chấm bài tự luận bằng AI với tính năng đọc chữ viết tay, tự động nhận diện lỗi sai và cho điểm đang được xây dựng...
                  </p>
                </div>
              </div>
            </div>
          )}`;
const renderReplacement = `          {activeTab === 'essays' && (
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
              {essays.length === 0 ? (
                <div className="bg-white shadow-sm overflow-hidden sm:rounded-[2rem] border border-slate-200/60 p-6 md:p-8">
                  <div className="text-center">
                    <FileText className="w-16 h-16 mx-auto text-indigo-200 mb-4" />
                    <h3 className="text-2xl font-bold text-slate-800 mb-2">Chưa có bài tập tự luận nào</h3>
                    <p className="text-slate-500 max-w-lg mx-auto">
                      Giáo viên chưa giao bài tập tự luận nào cho lớp bạn.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {essays.map((essay) => {
                    const isAvailable = !essay.startTime || new Date(essay.startTime) <= new Date();
                    const isEnded = essay.endTime && new Date(essay.endTime) < new Date();
                    
                    return (
                      <div key={essay.id} className="bg-white rounded-[2rem] border border-slate-200/60 p-6 shadow-sm hover:shadow-md transition-all">
                        <div className="flex justify-between items-start mb-4">
                          <h3 className="font-bold text-lg text-slate-800 line-clamp-2">{essay.title}</h3>
                          <div className={\`px-2 py-1 rounded text-xs font-bold \${isEnded ? 'bg-rose-100 text-rose-700' : isAvailable ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-700'}\`}>
                            {isEnded ? 'Đã kết thúc' : isAvailable ? 'Đang mở' : 'Sắp mở'}
                          </div>
                        </div>
                        
                        <div className="space-y-3 mb-6">
                          <div className="flex items-center text-sm text-slate-600">
                            <Calendar className="w-4 h-4 mr-2 text-indigo-400" />
                            <span>Bắt đầu: <span className="font-semibold text-slate-800">{essay.startTime ? new Date(essay.startTime).toLocaleString('vi-VN') : 'Không giới hạn'}</span></span>
                          </div>
                          <div className="flex items-center text-sm text-slate-600">
                            <Calendar className="w-4 h-4 mr-2 text-rose-400" />
                            <span>Kết thúc: <span className="font-semibold text-slate-800">{essay.endTime ? new Date(essay.endTime).toLocaleString('vi-VN') : 'Không giới hạn'}</span></span>
                          </div>
                        </div>

                        <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
                          <Link 
                            to={\`/student/essay/\${essay.id}\`}
                            className={\`px-4 py-2 rounded-xl font-semibold text-sm transition-colors \${isAvailable ? 'bg-indigo-600 text-white hover:bg-indigo-700' : 'bg-slate-100 text-slate-400 cursor-not-allowed'}\`}
                            onClick={(e) => !isAvailable && e.preventDefault()}
                          >
                            Làm bài
                          </Link>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}`;
code = code.replace(renderTarget, renderReplacement);

fs.writeFileSync('src/pages/StudentDashboard.tsx', code);
console.log("Patched successfully!");
