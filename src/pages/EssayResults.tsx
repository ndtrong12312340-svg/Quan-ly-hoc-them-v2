import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { collection, query, where, getDocs, getDoc, doc, updateDoc, deleteDoc } from 'firebase/firestore';
import { ArrowLeft, Loader2, Image as ImageIcon, FileText, CheckCircle, AlertCircle, RefreshCw, X, FileEdit, Calculator, Users, BarChart3, Send, Trash2 } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LabelList } from 'recharts';
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
  const [students, setStudents] = useState<any[]>([]);
  const [submissionToDelete, setSubmissionToDelete] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
   // oops need useAuth if used? Actually no need for useAuth here unless it's missing.
  
  const scoreData = React.useMemo(() => {
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
      const sub = submissions.find(s => s.id === submissionToDelete);
      
      await deleteDoc(doc(db, 'essay_submissions', submissionToDelete));
      
      if (sub && sub.studentId) {
        const userRef = doc(db, 'users', sub.studentId);
        const userDoc = await getDoc(userRef);
        if (userDoc.exists()) {
          const userData = userDoc.data();
          if (userData.completedEssays) {
            try {
              const newCompletedEssays = userData.completedEssays.filter((c: any) => c.essayId !== essayId);
              await updateDoc(userRef, { completedEssays: newCompletedEssays });
            } catch (err) {
              console.error("Lỗi cập nhật user doc:", err);
            }
          }
        }
      }

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
          <div className="flex justify-between items-center h-20 md:h-24">
            <div className="flex items-center">
              <Link to="/teacher" className="p-2.5 -ml-2.5 mr-3 md:mr-5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-full transition-colors">
                <ArrowLeft className="w-6 h-6" />
              </Link>
              <div>
                <h1 className="text-xl md:text-2xl font-black text-slate-900 tracking-tight leading-tight">
                  Kết quả Tự luận: {essay.title}
                </h1>
                <p className="text-sm font-medium text-slate-500 mt-1">
                  Đã nhận <span className="text-indigo-600 font-bold">{submissions.length}</span> bài nộp
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          
          {/* List of submissions */}
          <div className="lg:col-span-4 space-y-6">
            <h2 className="text-lg font-bold text-slate-800 flex items-center">
              <Users className="w-5 h-5 mr-2 text-indigo-500" /> Danh sách bài nộp
            </h2>
            
            {submissions.length === 0 ? (
              <div className="bg-white rounded-3xl border border-dashed border-slate-200 p-8 text-center">
                <p className="text-slate-500">Chưa có bài nộp.</p>
              </div>
            ) : (
              <div className="bg-white shadow-sm rounded-3xl border border-slate-100 overflow-hidden">
                <ul className="divide-y divide-slate-100">
                  {submissions.map((sub, idx) => {
                    const student = students.find(s => s.uid === sub.studentId) || { name: sub.studentName };
                    
                    return (
                    <li key={sub.id}>
                      <div 
                        onClick={() => setSelectedSubmission(sub)}
                        className={`w-full cursor-pointer text-left px-5 py-5 hover:bg-slate-50 transition-all ${selectedSubmission?.id === sub.id ? 'bg-indigo-50/50 border-l-4 border-indigo-600' : 'border-l-4 border-transparent'}`}
                      >
                        <div className="flex justify-between items-center">
                          <div>
                            <h3 className="text-sm font-bold text-slate-900">{sub.studentName}</h3>
                            <p className="text-xs text-slate-500 mt-0.5">
                              {new Date(sub.submittedAt).toLocaleDateString()}
                            </p>
                          </div>
                          {sub.status === 'graded' ? (
                            <div className="text-lg font-black text-indigo-600">{sub.score}</div>
                          ) : (
                            <div className="text-xs font-bold text-amber-500 bg-amber-50 px-2 py-1 rounded-lg">Chưa chấm</div>
                          )}
                        </div>
                      </div>
                    </li>
                  )})}
                </ul>
              </div>
            )}
          </div>

          {/* Submission details & Grading */}
          <div className="lg:col-span-8">
            {selectedSubmission ? (
              <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-8">
                <div className="flex justify-between items-start mb-8">
                   <div>
                     <h2 className="text-3xl font-black text-slate-900 tracking-tight">{selectedSubmission.studentName}</h2>
                     <p className="text-slate-500 mt-1">Lớp: {selectedSubmission.studentClass || 'N/A'}</p>
                   </div>
                   {selectedSubmission.status === 'graded' && (
                     <div className="bg-indigo-600 text-white rounded-2xl px-6 py-4 text-center">
                       <div className="text-4xl font-black">{selectedSubmission.score}</div>
                       <div className="text-xs font-bold uppercase tracking-widest text-indigo-200">Điểm số</div>
                     </div>
                   )}
                </div>
                
                {/* Images */}
                {selectedSubmission.images && selectedSubmission.images.length > 0 && (
                  <div className="grid grid-cols-2 gap-4 mb-8">
                    {selectedSubmission.images.map((img: string, idx: number) => (
                       <img key={idx} src={img} className="w-full rounded-2xl border border-slate-200" />
                    ))}
                  </div>
                )}

                {/* AI Feedback */}
                <div className="border-t border-slate-100 pt-8 mt-4">
                  <div className="flex justify-between items-center mb-6">
                    <h3 className="text-xl font-bold text-slate-900 flex items-center">
                      <Calculator className="w-6 h-6 mr-3 text-emerald-500" /> Nhận xét AI
                    </h3>
                    <button 
                      onClick={() => handleGradeAI(selectedSubmission)}
                      disabled={isGrading}
                      className="px-6 py-3 bg-slate-900 text-white rounded-2xl font-bold hover:bg-slate-800 transition-all"
                    >
                      {isGrading ? 'Đang chấm...' : 'Chấm lại bài'}
                    </button>
                  </div>
                  
                  {selectedSubmission.aiFeedback ? (
                    <div className="bg-slate-50 rounded-2xl p-6 text-slate-700 leading-relaxed">
                      <ReactMarkdown>{selectedSubmission.aiFeedback}</ReactMarkdown>
                    </div>
                  ) : (
                    <div className="p-10 border-2 border-dashed border-slate-200 rounded-2xl text-center text-slate-500">
                      Chưa có nhận xét AI
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="bg-slate-100 rounded-3xl h-full flex items-center justify-center text-slate-500">
                Chọn một bài làm để xem
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
