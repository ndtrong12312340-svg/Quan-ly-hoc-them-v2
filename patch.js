const fs = require('fs');
let code = fs.readFileSync('src/pages/TeacherDashboard.tsx', 'utf8');

const replacement = `                (() => {
                  const groupedEssays = essays.reduce((acc, essay) => {
                    let block = 'Khác';
                    if (essay.assignedClasses && essay.assignedClasses.length > 0) {
                       const classObj = teacherClasses.find(c => essay.assignedClasses.includes(c.name));
                       if (classObj && classObj.block) {
                         block = classObj.block;
                       }
                    }
                    if (block === 'Khác') {
                      const match = (essay.title || '').match(/(lớp|khối|toán|toan)\\s*(\\d{1,2})/i);
                      if (match) {
                        block = match[2];
                      }
                    }
                    if (!acc[block]) acc[block] = [];
                    acc[block].push(essay);
                    return acc;
                  }, {} as Record<string, any[]>);

                  const sortedBlocks = Object.keys(groupedEssays).sort((a, b) => {
                    if (a === 'Khác') return 1;
                    if (b === 'Khác') return -1;
                    return parseInt(a) - parseInt(b);
                  });

                  return (
                    <div className="space-y-8">
                      {sortedBlocks.map(block => (
                        <div key={block} className="bg-white shadow-sm overflow-hidden sm:rounded-[2rem] border border-slate-200/60 p-2">
                          <div className="px-6 py-4 bg-indigo-50/50 border-b border-indigo-100 rounded-t-[1.5rem]">
                            <h3 className="text-lg font-bold text-indigo-900">
                              {block === 'Khác' ? 'Khối khác / Không xác định' : \`Khối \${block}\`}
                            </h3>
                          </div>
                          <ul className="divide-y divide-gray-100">
                            {groupedEssays[block].map((essay, index) => (
                              <li key={essay.id} className="hover:bg-indigo-50/50 transition-colors duration-150">
                                <div className="px-6 py-5 flex justify-between items-center">
                                  <div className="flex items-start">
                                    <span className="text-xl font-black text-indigo-200 w-8 flex-shrink-0 mt-0.5">{index + 1}.</span>
                                    <div>
                                      <h3 className="text-lg font-bold text-gray-900 truncate mb-1">{essay.title}</h3>
                                      <p className="mt-2 text-sm text-gray-600 flex items-center">
                                        <span className="font-medium mr-1">Lớp được giao:</span> {essay.assignedClasses?.join(', ') || 'Chưa giao'}
                                      </p>
                                      {(essay.startTime || essay.endTime) && (
                                        <p className="mt-1 text-sm text-gray-500">
                                          Thời gian mở: {essay.startTime ? new Date(essay.startTime).toLocaleString('vi-VN') : 'Không giới hạn'} - {essay.endTime ? new Date(essay.endTime).toLocaleString('vi-VN') : 'Không giới hạn'}
                                        </p>
                                      )}
                                    </div>
                                  </div>
                                  <div className="flex items-center space-x-3">
                                    <Link to={\`/teacher/essay/\${essay.id}/results\`} className="px-3 py-1.5 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 rounded-lg font-medium text-sm transition-colors">
                                      Xem kết quả
                                    </Link>
                                    <Link to={\`/teacher/essay/\${essay.id}/edit\`} className="p-2 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors" title="Chỉnh sửa">
                                      <Edit2 className="w-5 h-5" />
                                    </Link>
                                    <button
                                      onClick={() => setEssayToDelete(essay.id)}
                                      className="p-2 text-gray-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                                      title="Xóa"
                                    >
                                      <Trash2 className="w-5 h-5" />
                                    </button>
                                  </div>
                                </div>
                              </li>
                            ))}
                          </ul>
                        </div>
                      ))}
                    </div>
                  );
                })()`;

const target = `<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {essays.map((essay) => (
                    <div key={essay.id} className="bg-white rounded-[2rem] border border-slate-200/60 p-6 shadow-sm hover:shadow-md transition-all">
                      <div className="flex justify-between items-start mb-4">
                        <h3 className="font-bold text-lg text-slate-800 line-clamp-2">{essay.title}</h3>
                        <div className="flex gap-2">
                          <Link to={\`/teacher/essay/\${essay.id}/edit\`} className="p-2 text-indigo-600 hover:bg-indigo-50 rounded-full transition-colors">
                            <Edit2 className="w-4 h-4" />
                          </Link>
                          <button onClick={() => setEssayToDelete(essay.id)} className="p-2 text-rose-500 hover:bg-rose-50 rounded-full transition-colors">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                      
                      <div className="space-y-3 mb-6">
                        <div className="flex items-center text-sm text-slate-600">
                          <BookOpen className="w-4 h-4 mr-2 text-indigo-400" />
                          <span>Giao cho: <span className="font-semibold text-slate-800">{essay.assignedClasses?.join(', ') || 'Chưa chọn'}</span></span>
                        </div>
                        <div className="flex items-center text-sm text-slate-600">
                          <Clock className="w-4 h-4 mr-2 text-emerald-400" />
                          <span>Thời gian: <span className="font-semibold text-slate-800">
                            {essay.startTime ? new Date(essay.startTime).toLocaleString('vi-VN') : '...'} - {essay.endTime ? new Date(essay.endTime).toLocaleString('vi-VN') : '...'}
                          </span></span>
                        </div>
                      </div>

                      <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
                        <button className="px-4 py-2 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 rounded-xl font-semibold text-sm transition-colors">
                          Xem bài làm
                        </button>
                      </div>
                    </div>
                  ))}
                </div>`;

const newCode = code.replace(target, replacement);
fs.writeFileSync('src/pages/TeacherDashboard.tsx', newCode);
console.log("Replaced!");
