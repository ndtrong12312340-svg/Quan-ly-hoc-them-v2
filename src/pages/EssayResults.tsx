import React, { useState, useEffect, useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { collection, query, where, getDocs, getDoc, doc, updateDoc, deleteDoc } from 'firebase/firestore';
import { 
  ArrowLeft, 
  Loader2, 
  Image as ImageIcon, 
  FileText, 
  CheckCircle, 
  AlertCircle, 
  RefreshCw, 
  X, 
  FileEdit, 
  Calculator, 
  Users, 
  Trash2, 
  Send, 
  Search, 
  Filter, 
  BarChart3, 
  XCircle
} from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LabelList } from 'recharts';
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
  const [students, setStudents] = useState<any[]>([]);
  const [classes, setClasses] = useState<any[]>([]);
  
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedSubmission, setSelectedSubmission] = useState<any>(null);
  
  // Interactive Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedClass, setSelectedClass] = useState('');
  
  // Grading state
  const [isGrading, setIsGrading] = useState(false);
  const [gradingId, setGradingId] = useState<string | null>(null);
  const [gradingError, setGradingError] = useState('');
  
  // Modals state
  const [submissionToDelete, setSubmissionToDelete] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showNotifyModal, setShowNotifyModal] = useState(false);
  const [selectedNotifyClass, setSelectedNotifyClass] = useState('');

  useEffect(() => {
    if (!essayId) return;
    fetchData();
  }, [essayId]);

  const fetchData = async () => {
    if (submissions.length > 0) {
      setIsRefreshing(true);
    } else {
      setLoading(true);
    }
    try {
      // Fetch essay
      const essayDoc = await getDoc(doc(db, 'essays', essayId!));
      if (!essayDoc.exists()) throw new Error('Bài tập không tồn tại');
      const essayData: any = { id: essayDoc.id, ...essayDoc.data() };
      setEssay(essayData);

      // Fetch submissions
      const subQ = query(collection(db, 'essay_submissions'), where('essayId', '==', essayId));
      const subSnap = await getDocs(subQ);
      const subs = subSnap.docs.map(d => ({ id: d.id, ...d.data() }));
      setSubmissions(subs);

      // Fetch class info
      const qClasses = query(collection(db, 'classes'));
      const classesSnap = await getDocs(qClasses);
      const classesList = classesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setClasses(classesList);

      // Fetch student users info for active classes
      let studs: any[] = [];
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
      }
      setStudents(studs);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  };

  // AI Grading Trigger
  const handleGradeAI = async (submission: any) => {
    setGradingId(submission.id);
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
        const data = await res.json().catch(() => ({}));
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
      
      const updatedSubmissions = submissions.map(s => s.id === submission.id ? { ...s, ...newSubData } : s);
      setSubmissions(updatedSubmissions);
      
      if (selectedSubmission?.id === submission.id) {
        setSelectedSubmission({ ...selectedSubmission, ...newSubData });
      }

    } catch (err: any) {
      setGradingError('Lỗi chấm điểm: ' + err.message);
    } finally {
      setIsGrading(false);
      setGradingId(null);
    }
  };

  // Delete submission
  const handleDeleteSubmission = async () => {
    if (!submissionToDelete) return;
    setIsDeleting(true);
    try {
      const subToDelete = submissions.find(s => s.id === submissionToDelete);
      if (subToDelete) {
        // Delete submission from firestore
        await deleteDoc(doc(db, 'essay_submissions', submissionToDelete));
        
        // Remove entry from user's completed essays
        if (subToDelete.studentId) {
          const studentDocRef = doc(db, 'users', subToDelete.studentId);
          const studentDocSnap = await getDoc(studentDocRef);
          if (studentDocSnap.exists()) {
            const studentData = studentDocSnap.data();
            const completedEssays = studentData.completedEssays || [];
            const updatedCompletedEssays = completedEssays.filter(
              (e: any) => e.submissionId !== submissionToDelete && e.essayId !== essayId
            );
            await updateDoc(studentDocRef, {
              completedEssays: updatedCompletedEssays
            });
          }
        }
      }
      
      const updatedSubmissions = submissions.filter(s => s.id !== submissionToDelete);
      setSubmissions(updatedSubmissions);
      
      if (selectedSubmission?.id === submissionToDelete) {
        setSelectedSubmission(null);
      }
      
      setSubmissionToDelete(null);
    } catch (error) {
      console.error("Error deleting submission:", error);
      alert("Lỗi khi xóa kết quả bài làm");
    } finally {
      setIsDeleting(false);
    }
  };

  // Group Notification via Zalo
  const executeSendSummaryZalo = () => {
    if (!selectedNotifyClass) return;

    const filteredStudents = students.filter(s => s.className === selectedNotifyClass);

    const doneStudents = filteredStudents.filter(student => 
      submissions.some(sub => sub.studentId === student.uid)
    ).map(student => {
      const sub = submissions.find(s => s.studentId === student.uid);
      return { name: student.name, score: sub?.score || 0, status: sub?.status };
    }).sort((a, b) => b.score - a.score);

    const notDoneStudents = filteredStudents.filter(student => 
      !submissions.some(sub => sub.studentId === student.uid)
    );

    let message = `📊 KẾT QUẢ TỰ LUẬN: ${essay.title || 'Bài tập'} (LỚP ${selectedNotifyClass}) 📊\n\n`;

    if (doneStudents.length > 0) {
      message += `✅ ĐÃ NỘP BÀI (${doneStudents.length}):\n`;
      doneStudents.forEach((st, idx) => {
        const scoreStr = st.status === 'graded' ? `${st.score.toFixed(1)} điểm` : 'Chờ chấm';
        message += `${idx + 1}. ${st.name}: ${scoreStr}\n`;
      });
      message += `\n`;
    }

    if (notDoneStudents.length > 0) {
      message += `❌ CHƯA NỘP BÀI (${notDoneStudents.length}):\n`;
      notDoneStudents.forEach((st, idx) => {
        message += `${idx + 1}. ${st.name}\n`;
      });
      message += `\n`;
    }

    message += `👉 Link đăng nhập học sinh: ${window.location.origin}`;

    navigator.clipboard.writeText(message).catch(err => console.error("Failed to copy", err));
    
    // Open class Zalo link
    const classInfo = classes.find(c => c.name === selectedNotifyClass);
    if (classInfo && classInfo.zaloLink) {
      let webLink = classInfo.zaloLink;
      if (webLink.includes('zalo.me/g/')) {
        webLink = webLink.replace('zalo.me/g/', 'chat.zalo.me/?g=');
      }
      window.open(webLink, '_blank', 'noopener,noreferrer');
    } else {
      window.open('https://chat.zalo.me/', '_blank', 'noopener,noreferrer');
    }
    
    setShowNotifyModal(false);
  };

  // Individual Student Notification via Zalo/Facebook
  const handleNotifyStudent = (sub: any) => {
    const student = students.find(s => s.uid === sub.studentId) || { name: sub.studentName };
    const scoreStr = sub.status === 'graded' ? `${sub.score.toFixed(1)} / 10 điểm` : 'đang chờ chấm điểm';
    const message = `🎉 THÔNG BÁO KẾT QUẢ TỰ LUẬN 🎉\n\nChào ${sub.studentName}, thầy đã chấm bài tự luận của em!\nBài tập: "${essay.title || 'Bài tự luận'}"\n\n🎯 Kết quả: ${scoreStr}.\n👉 Em hãy đăng nhập để xem nhận xét chi tiết của AI và sửa lỗi nhé!\n🔗 Xem chi tiết tại: ${window.location.origin}`;
    
    navigator.clipboard.writeText(message).catch(err => console.error("Failed to copy", err));
    
    if (student.zalo) {
      window.open(`https://chat.zalo.me/?phone=${student.zalo}`, '_blank', 'noopener,noreferrer');
    } else if (student.facebook) {
      window.open(student.facebook, '_blank', 'noopener,noreferrer');
    } else {
      window.open(`https://chat.zalo.me/`, '_blank', 'noopener,noreferrer');
    }
  };

  // Score Distribution bins for Recharts (grouped in integers 0 to 10)
  const getScoreDistribution = () => {
    const bins: { name: string, count: number }[] = [];
    for (let i = 0; i <= 10; i++) {
      bins.push({ name: String(i), count: 0 });
    }
    
    submissions.forEach(sub => {
      if (sub.status === 'graded' && typeof sub.score === 'number') {
        const roundedScore = Math.round(sub.score);
        const binIndex = Math.max(0, Math.min(10, roundedScore));
        bins[binIndex].count++;
      }
    });
    return bins;
  };

  // Client-side search and class filter
  const filteredSubmissions = useMemo(() => {
    return submissions.filter(sub => {
      const matchSearch = sub.studentName?.toLowerCase().includes(searchTerm.toLowerCase());
      const matchClass = !selectedClass || sub.studentClass === selectedClass;
      return matchSearch && matchClass;
    });
  }, [submissions, searchTerm, selectedClass]);

  // Statistics calculation
  const stats = useMemo(() => {
    const graded = submissions.filter(s => s.status === 'graded');
    const total = submissions.length;
    const avg = graded.length > 0 ? (graded.reduce((sum, s) => sum + s.score, 0) / graded.length).toFixed(1) : '0.0';
    const highest = graded.length > 0 ? Math.max(...graded.map(s => s.score)).toFixed(1) : '0.0';
    return { gradedCount: graded.length, totalCount: total, avg, highest };
  }, [submissions]);

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
      {/* Dynamic Header with Group Notification and Refresh Actions */}
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
                <p className="text-sm text-slate-500 hidden md:block mt-0.5">
                  Giao cho: {essay.assignedClasses?.join(', ')} | {submissions.length} bài nộp
                </p>
              </div>
            </div>

            <div className="flex space-x-2 md:space-x-3">
              <button
                onClick={() => {
                  if (essay.assignedClasses && essay.assignedClasses.length > 0) {
                    setSelectedNotifyClass(essay.assignedClasses[0]);
                  }
                  setShowNotifyModal(true);
                }}
                className="flex items-center px-3.5 py-2 bg-emerald-50 text-emerald-600 border border-emerald-100 rounded-xl font-bold hover:bg-emerald-100 transition-colors shadow-sm text-sm"
                title="Gửi tổng hợp điểm cả lớp qua Zalo (Copy kết quả & mở nhóm Zalo)"
              >
                <Send className="w-4 h-4 mr-1.5" />
                <span className="hidden sm:inline">Thông báo nhóm</span>
              </button>
              
              <button
                onClick={fetchData}
                disabled={isRefreshing}
                className="flex items-center px-3.5 py-2 bg-indigo-50 text-indigo-600 border border-indigo-100 rounded-xl font-bold hover:bg-indigo-100 transition-colors shadow-sm text-sm"
              >
                <RefreshCw className={`w-4 h-4 mr-1.5 ${isRefreshing ? 'animate-spin' : ''}`} />
                Làm mới
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* LEFT SIDE PANEL: Submissions stats, chart, search, and list */}
          <div className="lg:col-span-1 space-y-5">
            <h2 className="text-lg font-extrabold text-slate-800 flex items-center">
              <Users className="w-5 h-5 mr-2 text-indigo-500" /> Danh sách bài nộp
            </h2>

            {/* Interactive Filters (Search Student name and Class Select Filter) */}
            <div className="bg-white rounded-2xl border border-slate-200/60 p-4 shadow-sm space-y-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  placeholder="Tìm học sinh..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                />
              </div>
              {essay.assignedClasses && essay.assignedClasses.length > 0 && (
                <div className="flex items-center space-x-2">
                  <Filter className="w-4 h-4 text-slate-400 flex-shrink-0" />
                  <select
                    value={selectedClass}
                    onChange={(e) => setSelectedClass(e.target.value)}
                    className="w-full text-sm bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                  >
                    <option value="">Tất cả lớp được giao</option>
                    {essay.assignedClasses.map((cls: string) => (
                      <option key={cls} value={cls}>{cls}</option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            {/* Compact Phổ điểm Score Distribution & Stats Card */}
            {stats.gradedCount > 0 && (
              <div className="bg-white rounded-2xl border border-slate-200/60 p-4 shadow-sm space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center">
                    <BarChart3 className="w-4 h-4 mr-1.5 text-indigo-500" />
                    Phổ điểm & Thống kê
                  </h3>
                </div>
                
                {/* Stats row */}
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div className="bg-slate-50/50 p-2 rounded-xl border border-slate-100">
                    <p className="text-[10px] font-bold text-slate-400">Đã chấm</p>
                    <p className="text-sm md:text-base font-black text-indigo-600">{stats.gradedCount}/{stats.totalCount}</p>
                  </div>
                  <div className="bg-slate-50/50 p-2 rounded-xl border border-slate-100">
                    <p className="text-[10px] font-bold text-slate-400">Điểm TB</p>
                    <p className="text-sm md:text-base font-black text-emerald-600">{stats.avg}</p>
                  </div>
                  <div className="bg-slate-50/50 p-2 rounded-xl border border-slate-100">
                    <p className="text-[10px] font-bold text-slate-400">Cao nhất</p>
                    <p className="text-sm md:text-base font-black text-purple-600">{stats.highest}</p>
                  </div>
                </div>
                
                {/* Score Chart */}
                <div className="h-44 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart
                      data={getScoreDistribution()}
                      margin={{ top: 15, right: 10, left: -25, bottom: 5 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F1F5F9" />
                      <XAxis 
                        dataKey="name" 
                        axisLine={false}
                        tickLine={false}
                        tick={{ fill: '#94A3B8', fontSize: 10 }}
                      />
                      <YAxis 
                        allowDecimals={false}
                        axisLine={false}
                        tickLine={false}
                        tick={{ fill: '#94A3B8', fontSize: 10 }}
                      />
                      <Tooltip 
                        contentStyle={{ borderRadius: '0.75rem', border: 'none', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)' }}
                        formatter={(value: number) => [`${value} bài`, 'Số lượng']}
                        labelFormatter={(label) => `Điểm số: ${label}`}
                      />
                      <Line 
                        type="monotone" 
                        dataKey="count" 
                        stroke="#6366F1" 
                        strokeWidth={2}
                        dot={{ r: 3, fill: '#6366F1', strokeWidth: 1, stroke: '#fff' }}
                        activeDot={{ r: 5, fill: '#4F46E5', strokeWidth: 0 }}
                      >
                        <LabelList dataKey="count" position="top" fill="#4F46E5" fontSize={9} fontWeight={600} formatter={(val: number) => val > 0 ? val : ''} offset={5} />
                      </Line>
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}

            {/* List of submissions */}
            {filteredSubmissions.length === 0 ? (
              <div className="bg-white rounded-2xl border border-slate-200/60 p-8 text-center shadow-sm">
                <FileText className="w-10 h-10 text-slate-300 mx-auto mb-2" />
                <p className="text-slate-500 text-sm font-medium">Chưa có kết quả nộp bài phù hợp.</p>
              </div>
            ) : (
              <div className="space-y-3 max-h-[70vh] overflow-y-auto pr-1">
                {filteredSubmissions.map((sub) => (
                  <div 
                    key={sub.id} 
                    onClick={() => setSelectedSubmission(sub)}
                    className={`p-4 rounded-2xl border transition-all cursor-pointer relative flex flex-col ${selectedSubmission?.id === sub.id ? 'bg-indigo-50/70 border-indigo-200 ring-1 ring-indigo-200 shadow-sm' : 'bg-white border-slate-200 hover:border-indigo-100 hover:bg-slate-50/30 shadow-xs'}`}
                  >
                    {/* Student Info and Score Badge Row */}
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-center">
                        <div className="flex-shrink-0 w-9 h-9 bg-indigo-50 border border-indigo-100 rounded-xl flex items-center justify-center">
                          <Users className="h-4.5 w-4.5 text-indigo-600" />
                        </div>
                        <div className="ml-2.5">
                          <h4 className="font-bold text-slate-800 text-sm leading-tight">{sub.studentName}</h4>
                          <p className="text-[10px] font-bold text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded-md inline-block mt-0.5">
                            Lớp: {sub.studentClass || 'N/A'}
                          </p>
                        </div>
                      </div>
                      
                      {/* Score Badge */}
                      <div>
                        {sub.status === 'graded' ? (
                          <div className="bg-gradient-to-r from-indigo-50 to-purple-50 px-2.5 py-1 rounded-xl border border-indigo-100/50 text-right">
                            <span className="text-base font-black text-indigo-600">{sub.score}</span>
                            <span className="text-[10px] font-bold text-indigo-300 ml-0.5">/10</span>
                          </div>
                        ) : (
                          <span className="px-2.5 py-1 bg-amber-50 text-amber-700 border border-amber-100 rounded-xl text-[10px] font-bold">Chưa chấm</span>
                        )}
                      </div>
                    </div>

                    {/* Time details */}
                    <p className="text-[11px] text-slate-400 font-medium mb-3">
                      Nộp lúc: {new Date(sub.submittedAt).toLocaleString('vi-VN')}
                    </p>

                    {/* Quick Inline Actions & Feedback Row */}
                    <div className="flex items-center justify-between pt-2.5 border-t border-slate-100">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedSubmission(sub);
                        }}
                        className="text-xs font-bold text-indigo-600 hover:text-indigo-800 transition-colors flex items-center"
                      >
                        <FileText className="w-3.5 h-3.5 mr-1" />
                        Xem bài làm
                      </button>

                      <div className="flex items-center space-x-1" onClick={(e) => e.stopPropagation()}>
                        {/* Notify individual Zalo/FB */}
                        <button
                          onClick={() => handleNotifyStudent(sub)}
                          className="text-blue-500 hover:text-blue-700 p-1.5 rounded-lg hover:bg-blue-50 transition-colors"
                          title="Báo kết quả qua Zalo/Facebook"
                        >
                          <Send className="w-4 h-4" />
                        </button>
                        
                        {/* Re-grade with AI */}
                        <button
                          onClick={() => handleGradeAI(sub)}
                          disabled={isGrading && gradingId === sub.id}
                          className="text-indigo-400 hover:text-indigo-600 p-1.5 rounded-lg hover:bg-indigo-50 transition-colors disabled:opacity-50"
                          title="Chấm lại bằng AI"
                        >
                          {isGrading && gradingId === sub.id ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <RefreshCw className="w-4 h-4" />
                          )}
                        </button>
                        
                        {/* Delete submission */}
                        <button
                          onClick={() => setSubmissionToDelete(sub.id)}
                          className="text-red-400 hover:text-red-600 p-1.5 rounded-lg hover:bg-red-50 transition-colors"
                          title="Xóa bài làm để học sinh làm lại"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* RIGHT SIDE PANEL: Submission details, texts, images, and AI evaluation report */}
          <div className="lg:col-span-2">
            {selectedSubmission ? (
              <div className="bg-white rounded-[2rem] border border-slate-200/60 shadow-sm overflow-hidden flex flex-col h-full min-h-[600px]">
                <div className="p-6 md:p-8 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center">
                  <div>
                    <h2 className="text-xl font-bold text-slate-800 mb-1">Bài làm của: {selectedSubmission.studentName}</h2>
                    <p className="text-sm font-medium text-slate-500">Lớp: {selectedSubmission.studentClass || 'N/A'}</p>
                  </div>
                  {selectedSubmission.status === 'graded' && (
                     <div className="text-center">
                       <div className="text-3xl font-black text-indigo-600">{selectedSubmission.score}</div>
                       <div className="text-xs font-bold text-slate-400 uppercase tracking-wider">Điểm số</div>
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
                          {isGrading && gradingId === selectedSubmission.id ? (
                             <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Đang chấm điểm...</>
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

      {/* Confirmation Modal for Deleting Submission */}
      {submissionToDelete && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-[60] animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl">
            <div className="flex items-center justify-center w-12 h-12 mx-auto bg-red-100 rounded-full mb-4">
              <AlertCircle className="w-6 h-6 text-red-600" />
            </div>
            <h3 className="text-xl font-bold text-center text-gray-900 mb-2">Xác nhận xóa kết quả</h3>
            <p className="text-center text-gray-600 mb-6">
              Bạn có chắc chắn muốn xóa kết quả bài tự luận này? Sau khi xóa, học sinh sẽ có thể nộp lại bài làm. Hành động này không thể hoàn tác.
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
                className="px-5 py-2.5 border border-transparent rounded-xl text-sm font-medium text-white bg-red-600 hover:bg-red-700 transition-colors shadow-sm animate-pulse-once"
                disabled={isDeleting}
              >
                {isDeleting ? 'Đang xóa...' : 'Đồng ý xóa'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Class Group Notification Modal */}
      {showNotifyModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-md p-6 shadow-2xl">
            <h3 className="text-xl font-bold text-gray-900 mb-6 flex items-center">
              <Send className="w-5 h-5 mr-2 text-indigo-500" />
              Thông báo nhóm lớp
            </h3>
            <div className="mb-6">
              <label className="block text-sm font-semibold text-gray-700 mb-2">Chọn lớp cần thông báo</label>
              <select
                value={selectedNotifyClass}
                onChange={(e) => setSelectedNotifyClass(e.target.value)}
                className="w-full border border-gray-300 rounded-xl px-4 py-2.5 focus:ring-2 focus:ring-indigo-500 outline-none text-sm"
              >
                <option value="">-- Chọn lớp --</option>
                {essay.assignedClasses && essay.assignedClasses.map((cls: string) => (
                  <option key={cls} value={cls}>{cls}</option>
                ))}
              </select>
            </div>
            <div className="flex justify-end space-x-3">
              <button
                onClick={() => setShowNotifyModal(false)}
                className="px-4 py-2 bg-gray-100 text-gray-700 font-medium rounded-xl hover:bg-gray-200 transition-colors text-sm"
              >
                Hủy
              </button>
              <button
                onClick={executeSendSummaryZalo}
                disabled={!selectedNotifyClass}
                className="px-4 py-2 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 transition-colors disabled:opacity-50 text-sm"
              >
                Gửi Zalo
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
