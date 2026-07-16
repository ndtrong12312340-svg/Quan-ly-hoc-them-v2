import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { collection, query, where, getDocs, getDoc, doc, updateDoc } from 'firebase/firestore';
import { ArrowLeft, Loader2, Image as ImageIcon, FileText, CheckCircle, AlertCircle, RefreshCw, X, FileEdit, Calculator, Users } from 'lucide-react';
import { GoogleGenAI } from '@google/genai';
import ReactMarkdown from 'react-markdown';
import Latex from 'react-latex-next';
import 'katex/dist/katex.min.css';

const renderMathChildren = (children: React.ReactNode): React.ReactNode => {
  if (typeof children === 'string') {
    const processedText = children
      .replace(/\\\(/g, () => '$')
      .replace(/\\\)/g, () => '$')
      .replace(/\\\[/g, () => '$$')
      .replace(/\\\]/g, () => '$$');
    return <Latex>{processedText}</Latex>;
  }
  if (Array.isArray(children)) {
    return children.map((child, idx) => (
      <React.Fragment key={idx}>{renderMathChildren(child)}</React.Fragment>
    ));
  }
  return children;
};

export default function EssayResults() {
  const { essayId } = useParams<{ essayId: string }>();
  const [essay, setEssay] = useState<any>(null);
  const [submissions, setSubmissions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedSubmission, setSelectedSubmission] = useState<any>(null);
  const [isGrading, setIsGrading] = useState(false);
  const [gradingError, setGradingError] = useState('');
  
  useEffect(() => {
    if (!essayId) return;
    fetchData();
  }, [essayId]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const essayDoc = await getDoc(doc(db, 'essays', essayId!));
      if (!essayDoc.exists()) throw new Error('Bài tập không tồn tại');
      setEssay({ id: essayDoc.id, ...essayDoc.data() });

      const subQ = query(collection(db, 'essay_submissions'), where('essayId', '==', essayId));
      const subSnap = await getDocs(subQ);
      const subs = subSnap.docs.map(d => ({ id: d.id, ...d.data() }));
      setSubmissions(subs);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleGradeAI = async (submission: any) => {
    setIsGrading(true);
    setGradingError('');
    try {
      const res = await fetch('/api/grade-essay', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ submission, essay })
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Lỗi từ server');
      }

      const { aiFeedback, score } = await res.json();

      const newSubData = {
        aiFeedback: aiFeedback,
        score: score,
        status: 'graded',
        gradedAt: new Date().getTime()
      };

      await updateDoc(doc(db, 'essay_submissions', submission.id), newSubData);
      
      setSubmissions(submissions.map(s => s.id === submission.id ? { ...s, ...newSubData } : s));
      setSelectedSubmission({ ...submission, ...newSubData });

    } catch (err: any) {
      setGradingError('Lỗi chấm điểm: ' + err.message);
    } finally {
      setIsGrading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <Loader2 className="w-12 h-12 text-indigo-600 animate-spin" />
      </div>
    );
  }

  if (error || !essay) {
    return (
      <div className="min-h-screen bg-slate-50 p-8 flex flex-col items-center justify-center">
        <AlertCircle className="w-16 h-16 text-rose-500 mb-4" />
        <h2 className="text-xl font-bold text-slate-800 mb-2">Đã có lỗi xảy ra</h2>
        <p className="text-slate-600 mb-6">{error || 'Không tìm thấy bài tập'}</p>
        <Link to="/teacher" className="px-6 py-2 bg-indigo-600 text-white rounded-xl font-semibold">
          Quay lại Dashboard
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 pb-20">
      <div className="bg-white border-b border-slate-200 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16 md:h-20">
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
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* List of submissions */}
          <div className="lg:col-span-1 space-y-4">
            <h2 className="text-lg font-bold text-slate-800 mb-4 flex items-center">
              <Users className="w-5 h-5 mr-2 text-indigo-500" /> Danh sách bài nộp
            </h2>
            {submissions.length === 0 ? (
              <div className="bg-white rounded-[2rem] border border-slate-200/60 p-8 text-center shadow-sm">
                <FileText className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                <p className="text-slate-500 font-medium">Chưa có học sinh nào nộp bài.</p>
              </div>
            ) : (
              <div className="bg-white rounded-[2rem] border border-slate-200/60 overflow-hidden shadow-sm">
                <ul className="divide-y divide-slate-100">
                  {submissions.map((sub, idx) => (
                    <li key={sub.id}>
                      <button 
                        onClick={() => setSelectedSubmission(sub)}
                        className={`w-full text-left px-6 py-4 hover:bg-indigo-50/50 transition-colors ${selectedSubmission?.id === sub.id ? 'bg-indigo-50 border-l-4 border-indigo-600' : 'border-l-4 border-transparent'}`}
                      >
                        <div className="flex justify-between items-center mb-1">
                          <span className="font-bold text-slate-800">{sub.studentName}</span>
                          {sub.status === 'graded' ? (
                            <span className="px-2 py-1 bg-emerald-100 text-emerald-700 rounded-md text-xs font-bold">{sub.score}/10</span>
                          ) : (
                            <span className="px-2 py-1 bg-amber-100 text-amber-700 rounded-md text-xs font-bold">Chưa chấm</span>
                          )}
                        </div>
                        <div className="text-xs text-slate-500">
                          {new Date(sub.submittedAt).toLocaleString('vi-VN')}
                        </div>
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          {/* Submission details & Grading */}
          <div className="lg:col-span-2">
            {selectedSubmission ? (
              <div className="bg-white rounded-[2rem] border border-slate-200/60 shadow-sm overflow-hidden flex flex-col h-full min-h-[600px]">
                <div className="p-6 md:p-8 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center">
                  <div>
                    <h2 className="text-xl font-bold text-slate-800 mb-1">Bài làm của: {selectedSubmission.studentName}</h2>
                    <p className="text-sm text-slate-500">Lớp: {selectedSubmission.studentClass || 'N/A'}</p>
                  </div>
                  {selectedSubmission.status === 'graded' && (
                     <div className="text-center">
                       <div className="text-3xl font-black text-indigo-600">{selectedSubmission.score}</div>
                       <div className="text-xs font-medium text-slate-400">Điểm số</div>
                     </div>
                  )}
                </div>
                
                <div className="p-6 md:p-8 flex-1 overflow-y-auto">
                   <h3 className="font-bold text-slate-800 mb-4 flex items-center">
                     <ImageIcon className="w-5 h-5 mr-2 text-indigo-500" /> Hình ảnh bài nộp
                   </h3>
                   {selectedSubmission.images && selectedSubmission.images.length > 0 ? (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
                        {selectedSubmission.images.map((img: string, idx: number) => (
                           <img key={idx} src={img} alt={`Bài làm ${idx + 1}`} className="w-full h-auto rounded-xl border border-slate-200 shadow-sm" />
                        ))}
                      </div>
                   ) : (
                      <p className="text-slate-500 mb-8 italic">Không có hình ảnh đính kèm.</p>
                   )}

                   {selectedSubmission.text && (
                      <div className="mb-8">
                        <h3 className="font-bold text-slate-800 mb-4 flex items-center">
                          <FileText className="w-5 h-5 mr-2 text-indigo-500" /> Nội dung văn bản
                        </h3>
                        <div className="bg-slate-50 rounded-xl p-4 border border-slate-200 text-slate-700 whitespace-pre-wrap">
                          {selectedSubmission.text}
                        </div>
                      </div>
                   )}

                   <div className="border-t border-slate-200 pt-8">
                     <div className="flex justify-between items-center mb-6">
                        <h3 className="font-bold text-xl text-slate-800 flex items-center">
                          <Calculator className="w-6 h-6 mr-2 text-emerald-500" /> Nhận xét & Chấm điểm AI
                        </h3>
                        <button 
                          onClick={() => handleGradeAI(selectedSubmission)}
                          disabled={isGrading}
                          className="px-5 py-2.5 bg-gradient-to-r from-emerald-500 to-teal-500 text-white rounded-xl font-bold shadow-sm hover:from-emerald-600 hover:to-teal-600 transition-all flex items-center disabled:opacity-50"
                        >
                          {isGrading ? (
                             <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Đang phân tích...</>
                          ) : (
                             <><RefreshCw className="w-4 h-4 mr-2" /> Chấm điểm AI</>
                          )}
                        </button>
                     </div>

                     {gradingError && (
                        <div className="mb-6 p-4 bg-rose-50 border border-rose-200 rounded-xl flex items-start">
                          <AlertCircle className="w-5 h-5 text-rose-600 mr-3 mt-0.5 flex-shrink-0" />
                          <div className="text-rose-700 font-medium">{gradingError}</div>
                        </div>
                     )}

                     {selectedSubmission.aiFeedback ? (
                        <div className="bg-indigo-50/50 rounded-xl p-6 border border-indigo-100">
                           <div className="prose prose-indigo max-w-none text-slate-700 leading-relaxed">
                             <ReactMarkdown
                               components={{
                                 h1: ({node, children, ...props}) => <h1 className="text-xl font-bold text-slate-900 border-b border-slate-200 pb-2 mt-6 mb-3 flex items-center" {...props}>{renderMathChildren(children)}</h1>,
                                 h2: ({node, children, ...props}) => <h2 className="text-lg font-bold text-indigo-900 mt-5 mb-2 flex items-center" {...props}>{renderMathChildren(children)}</h2>,
                                 h3: ({node, children, ...props}) => <h3 className="text-md font-semibold text-slate-800 mt-4 mb-2" {...props}>{renderMathChildren(children)}</h3>,
                                 p: ({node, children, ...props}) => <p className="text-slate-600 mb-4 text-sm md:text-base leading-relaxed" {...props}>{renderMathChildren(children)}</p>,
                                 ul: ({node, ...props}) => <ul className="list-disc pl-5 mb-4 space-y-2 text-slate-600 text-sm" {...props} />,
                                 ol: ({node, ...props}) => <ol className="list-decimal pl-5 mb-4 space-y-2 text-slate-600 text-sm" {...props} />,
                                 li: ({node, children, ...props}) => <li className="pl-1 mb-1 text-slate-600 leading-relaxed" {...props}>{renderMathChildren(children)}</li>,
                                 blockquote: ({node, children, ...props}) => (
                                   <blockquote className="border-l-4 border-indigo-500 pl-4 italic text-slate-500 my-4 bg-indigo-50/50 py-2 rounded-r-xl" {...props}>{renderMathChildren(children)}</blockquote>
                                 ),
                                 code: ({node, ...props}) => <code className="bg-indigo-50 text-indigo-600 px-1.5 py-0.5 rounded font-mono text-sm" {...props} />,
                                 pre: ({node, ...props}) => <pre className="bg-slate-900 text-slate-100 p-4 rounded-xl overflow-x-auto my-4 text-xs font-mono" {...props} />,
                               }}
                             >
                               {selectedSubmission.aiFeedback}
                             </ReactMarkdown>
                           </div>
                        </div>
                     ) : (
                        <div className="text-center py-12 bg-slate-50 rounded-xl border border-dashed border-slate-300">
                          <Calculator className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                          <p className="text-slate-500 font-medium">Bấm "Chấm điểm AI" để hệ thống tự động phân tích và nhận xét bài làm.</p>
                        </div>
                     )}
                   </div>
                </div>
              </div>
            ) : (
              <div className="bg-white rounded-[2rem] border border-slate-200/60 shadow-sm flex flex-col items-center justify-center h-full min-h-[600px] text-center p-8">
                 <FileEdit className="w-16 h-16 text-slate-200 mb-4" />
                 <h2 className="text-xl font-bold text-slate-400 mb-2">Chọn một bài làm để xem chi tiết</h2>
                 <p className="text-slate-400 max-w-sm">Danh sách bài nộp hiển thị ở cột bên trái.</p>
              </div>
            )}
          </div>

        </div>
      </div>
    </div>
  );
}
