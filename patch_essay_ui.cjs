const fs = require('fs');
let code = fs.readFileSync('src/pages/EssayResults.tsx', 'utf8');

// 1. Update header layout
const oldHeader = `<div className="flex justify-between items-center h-16 md:h-20">
            <div className="flex items-center">
              <Link to="/teacher" className="p-2 -ml-2 mr-2 md:mr-4 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-full transition-colors">
                <ArrowLeft className="w-6 h-6" />
              </Link>
              <div>
                <h1 className="text-xl md:text-2xl font-bold text-slate-900 leading-tight">
                  Kết quả Tự luận: {essay.title}
                </h1>
                <p className="text-sm text-slate-500 hidden md:block">
                  Giao cho: {essay.assignedClasses?.join(', ')} | {submissions.length} bài nộp
                </p>
              </div>
            </div>
          </div>`;

const newHeader = `<div className="flex justify-between items-center h-20 md:h-24">
            <div className="flex items-center">
              <Link to="/teacher" className="p-2.5 -ml-2.5 mr-3 md:mr-5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-full transition-colors">
                <ArrowLeft className="w-6 h-6" />
              </Link>
              <div>
                <h1 className="text-xl md:text-2xl font-bold text-slate-800 leading-tight">
                  Kết quả Tự luận: {essay.title}
                </h1>
                <p className="text-sm font-medium text-slate-500 mt-1 hidden md:block">
                  Giao cho: {essay.assignedClasses?.join(', ')} <span className="mx-2 text-slate-300">|</span> <span className="text-indigo-600 font-semibold">{submissions.length}</span> bài nộp
                </p>
              </div>
            </div>
          </div>`;

code = code.replace(oldHeader, newHeader);

// 2. Update Column title
const oldColTitle = `<h2 className="text-lg font-bold text-slate-800 mb-4 flex items-center">
              <Users className="w-5 h-5 mr-2 text-indigo-500" /> Danh sách bài nộp
            </h2>`;
const newColTitle = `<h2 className="text-xl font-bold text-slate-800 mb-6 flex items-center">
              <Users className="w-6 h-6 mr-3 text-indigo-500" /> Danh sách bài nộp
            </h2>`;
code = code.replace(oldColTitle, newColTitle);

// 3. Update Chart Card
const oldChart = `<div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 mb-6">
              <h2 className="text-lg font-bold text-gray-800 mb-6 flex items-center">
                <span className="bg-indigo-100 text-indigo-600 p-2 rounded-lg mr-3">
                  <BarChart3 className="w-5 h-5" />
                </span>`;
const newChart = `<div className="bg-white p-6 rounded-3xl shadow-sm border border-indigo-50/60 mb-8">
              <h2 className="text-lg font-bold text-slate-800 mb-6 flex items-center">
                <span className="bg-indigo-50 text-indigo-500 p-2.5 rounded-xl mr-3">
                  <BarChart3 className="w-5 h-5" />
                </span>`;
code = code.replace(oldChart, newChart);

// 4. Update Empty Submissions Message
const oldEmptyList = `<div className="bg-white rounded-[2rem] border border-slate-200/60 p-8 text-center shadow-sm">
                <FileText className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                <p className="text-slate-500 font-medium">Chưa có học sinh nào nộp bài.</p>
              </div>`;
const newEmptyList = `<div className="bg-white rounded-3xl border border-indigo-50/60 p-10 text-center shadow-sm">
                <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4">
                  <FileText className="w-10 h-10 text-slate-300" strokeWidth={1.5} />
                </div>
                <p className="text-slate-500 font-medium">Chưa có học sinh nào nộp bài.</p>
              </div>`;
code = code.replace(oldEmptyList, newEmptyList);

// 5. Update submission container
code = code.replace(
    `<div className="bg-white shadow-lg rounded-2xl border border-gray-100 overflow-hidden">`,
    `<div className="bg-white shadow-sm rounded-3xl border border-indigo-50/60 overflow-hidden">`
);

// 6. Update Empty State on right column
const oldEmptyState = `<div className="bg-white rounded-[2rem] border border-slate-200/60 shadow-sm flex flex-col items-center justify-center h-full min-h-[600px] text-center p-8">
                 <FileEdit className="w-16 h-16 text-slate-200 mb-4" />
                 <h2 className="text-xl font-bold text-slate-400 mb-2">Chọn một bài làm để xem chi tiết</h2>
                 <p className="text-slate-400 max-w-sm">Danh sách bài nộp hiển thị ở cột bên trái.</p>
              </div>`;
const newEmptyState = `<div className="bg-white rounded-[2rem] border border-indigo-50/60 shadow-sm flex flex-col items-center justify-center h-full min-h-[600px] text-center p-8">
                 <div className="w-32 h-32 bg-indigo-50/30 rounded-full flex items-center justify-center mb-6">
                    <FileEdit className="w-16 h-16 text-indigo-200" strokeWidth={1.5} />
                 </div>
                 <h2 className="text-2xl font-bold text-slate-500 mb-3">Chọn một bài làm để xem chi tiết</h2>
                 <p className="text-slate-400 text-lg max-w-sm">Danh sách bài nộp hiển thị ở cột bên trái.</p>
              </div>`;
code = code.replace(oldEmptyState, newEmptyState);

fs.writeFileSync('src/pages/EssayResults.tsx', code);
console.log("Patched UI");
