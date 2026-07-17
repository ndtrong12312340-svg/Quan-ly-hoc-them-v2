import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { db } from '../lib/firebase';
import { doc, getDoc, collection, addDoc, query, where, getDocs, updateDoc, arrayUnion } from 'firebase/firestore';
import { useAuth } from '../lib/AuthContext';
import { 
  ArrowLeft, 
  Loader2, 
  Upload, 
  FileText, 
  Image as ImageIcon, 
  Send, 
  X, 
  AlertCircle, 
  CheckCircle, 
  Sparkles, 
  Award, 
  BookOpen, 
  ChevronRight, 
  Layers, 
  Eye,
  Calendar,
  Clock
} from 'lucide-react';
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

export default function TakeEssay() {
  const { essayId } = useParams<{ essayId: string }>();
  const { appUser } = useAuth();
  const navigate = useNavigate();
  
  const [essay, setEssay] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null); // For page load errors
  const [submitError, setSubmitError] = useState<string | null>(null); // For local submit/grading errors
  
  const [text, setText] = useState('');
  const [images, setImages] = useState<string[]>([]);
  const [studentApiKey, setStudentApiKey] = useState(() => {
    return localStorage.getItem('student_gemini_api_key') || '';
  });
  const [submission, setSubmission] = useState<any>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [activeTab, setActiveTab] = useState<'ai' | 'submission' | 'solution'>('ai');
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleApiKeyChange = (val: string) => {
    setStudentApiKey(val);
    localStorage.setItem('student_gemini_api_key', val);
  };

  useEffect(() => {
    const fetchEssayAndSubmission = async () => {
      if (!essayId || !appUser) return;
      try {
        const docRef = doc(db, 'essays', essayId);
        const docSnap = await getDoc(docRef);
        if (!docSnap.exists()) {
          throw new Error('Không tìm thấy bài tập tự luận');
        }
        const data = docSnap.data();
        
        // Validate if user can take it
        if (data.startTime && new Date(data.startTime) > new Date()) {
          throw new Error('Bài tập tự luận này chưa đến giờ mở');
        }
        if (!data.assignedClasses?.includes(appUser.className)) {
          throw new Error('Bạn không thuộc lớp được giao bài tập này');
        }

        setEssay({ id: docSnap.id, ...data });

        // Auto OCR solution images if they exist but solutionText is empty
        if (data.solutionImages && data.solutionImages.length > 0 && (!data.solutionText || data.solutionText.trim() === '')) {
          console.log('[TakeEssay] Auto OCR solution images...');
          fetch('/api/ocr-images', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ images: data.solutionImages, type: 'teacher_solution' })
          })
          .then(res => res.json())
          .then(async (ocrRes) => {
            if (ocrRes.success && ocrRes.text) {
              const essayRef = doc(db, 'essays', docSnap.id);
              await updateDoc(essayRef, { solutionText: ocrRes.text });
              setEssay(prev => prev ? { ...prev, solutionText: ocrRes.text } : null);
              console.log('[TakeEssay] Auto OCR and saved to Firestore!');
            }
          })
          .catch(err => console.error('[TakeEssay] Auto OCR failed:', err));
        }

        // Check for existing submission
        const submissionsQuery = query(
          collection(db, 'essay_submissions'),
          where('essayId', '==', essayId),
          where('studentId', '==', appUser.uid)
        );
        const subSnap = await getDocs(submissionsQuery);
        if (!subSnap.empty) {
          setSubmission({ id: subSnap.docs[0].id, ...subSnap.docs[0].data() });
        }
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    fetchEssayAndSubmission();
  }, [essayId, appUser]);

  const processImage = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = (event) => {
        const img = new Image();
        img.src = event.target?.result as string;
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const MAX_WIDTH = 1000; // Optimize dimensions for faster uploading and AI processing
          const MAX_HEIGHT = 1000;
          let width = img.width;
          let height = img.height;

          if (width > height) {
            if (width > MAX_WIDTH) {
              height *= MAX_WIDTH / width;
              width = MAX_WIDTH;
            }
          } else {
            if (height > MAX_HEIGHT) {
              width *= MAX_HEIGHT / height;
              height = MAX_HEIGHT;
            }
          }

          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.fillStyle = '#FFFFFF';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            ctx.drawImage(img, 0, 0, width, height);
            const dataUrl = canvas.toDataURL('image/jpeg', 0.75); // Compress lightly to stay under API limits
            resolve(dataUrl);
          } else {
            reject(new Error('Failed to create 2D canvas context'));
          }
        };
        img.onerror = (err) => reject(err);
      };
      reader.onerror = (err) => reject(err);
    });
  };

  const handleImageUpload = async (filesList: FileList | null) => {
    if (!filesList || filesList.length === 0) return;
    
    setSubmitError(null);
    const validFiles = Array.from(filesList).filter(file => file.type.startsWith('image/'));
    if (validFiles.length === 0) {
      setSubmitError('Vui lòng chỉ tải lên định dạng hình ảnh (PNG, JPG, JPEG).');
      return;
    }

    try {
      const base64Images = await Promise.all(validFiles.map(file => processImage(file)));
      setImages(prev => [...prev, ...base64Images]);
    } catch (err: any) {
      console.error("Lỗi xử lý ảnh:", err);
      setSubmitError('Lỗi đọc ảnh: ' + err.message);
    }
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      await handleImageUpload(e.dataTransfer.files);
    }
  };

  const removeImage = (index: number) => {
    setImages(prev => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async () => {
    if (!essay || !appUser) return;
    if (!text.trim() && images.length === 0) {
      setSubmitError('Vui lòng nhập văn bản lời giải hoặc tải lên ít nhất một hình ảnh bài viết.');
      return;
    }
    if (!studentApiKey.trim()) {
      setSubmitError('Học sinh vui lòng nhập API key để chấm điểm.');
      return;
    }
    
    setIsSubmitting(true);
    setSubmitError(null);
    try {
      // Call AI Grading API
      const res = await fetch('/api/grade-essay', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ 
          submission: { text, images }, 
          essay,
          studentApiKey
        })
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || 'Server không thể chấm bài tự luận tại thời điểm này.');
      }

      const { aiFeedback, score } = await res.json();

      const submissionData = {
        essayId: essay.id,
        essayTitle: essay.title,
        studentId: appUser.uid,
        studentName: appUser.name,
        studentClass: appUser.className,
        text,
        images,
        submittedAt: new Date().toISOString(),
        status: 'graded',
        score,
        aiFeedback
      };

      const docRef = await addDoc(collection(db, 'essay_submissions'), submissionData);
      
      const userRef = doc(db, 'users', appUser.uid);
      await updateDoc(userRef, {
        completedEssays: arrayUnion({
          essayId: essay.id,
          submissionId: docRef.id,
          score,
          submittedAt: submissionData.submittedAt
        })
      });
      
      setSubmission({ id: docRef.id, ...submissionData });
      setIsSubmitting(false);
    } catch (err: any) {
      console.error("Lỗi nộp bài tự luận:", err);
      // We set local submitError so student does not lose their typed answer and loaded images!
      setSubmitError(err.message || 'Lỗi từ server khi kết nối chấm bài AI. Vui lòng nhấn nút Nộp bài để thử lại.');
      setIsSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center">
        <Loader2 className="w-14 h-14 text-indigo-600 animate-spin mb-4" />
        <p className="text-slate-500 font-medium animate-pulse">Đang chuẩn bị đề bài tự luận...</p>
      </div>
    );
  }

  // Page load / Access authorization errors
  if (error || !essay) {
    return (
      <div className="min-h-screen bg-slate-50 p-4 flex flex-col items-center justify-center">
        <div className="bg-white rounded-3xl p-8 max-w-md w-full text-center shadow-xl border border-slate-100 animate-in fade-in zoom-in duration-300">
          <div className="w-16 h-16 bg-rose-100 text-rose-600 rounded-full flex items-center justify-center mx-auto mb-6">
            <AlertCircle className="w-10 h-10" />
          </div>
          <h3 className="text-2xl font-bold text-slate-800 mb-2">Không thể tải bài tập</h3>
          <p className="text-slate-500 mb-6 leading-relaxed">{error || 'Đã có lỗi xảy ra khi truy xuất bài tập.'}</p>
          <button 
            onClick={() => navigate('/student')} 
            className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3.5 px-6 rounded-2xl transition-all shadow-lg shadow-indigo-100 hover:shadow-indigo-200"
          >
            Quay lại Dashboard
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 pb-20">
      {/* HEADER BAR */}
      <div className="bg-white border-b border-slate-200 sticky top-0 z-40 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16 md:h-20">
            <div className="flex items-center space-x-3 overflow-hidden">
              <button 
                onClick={() => navigate('/student')} 
                className="p-2 -ml-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-full transition-colors shrink-0"
                title="Quay lại danh sách"
              >
                <ArrowLeft className="w-6 h-6" />
              </button>
              <div className="border-l border-slate-200 h-6 mx-1 shrink-0 hidden sm:block"></div>
              <div className="truncate">
                <span className="text-xs font-bold text-indigo-600 uppercase tracking-widest block font-mono">BÀI TẬP TỰ LUẬN</span>
                <h1 className="text-lg md:text-xl font-bold text-slate-900 leading-tight truncate">
                  {essay.title}
                </h1>
              </div>
            </div>
            
            <div className="shrink-0 flex items-center space-x-2">
              <span className="text-xs bg-slate-100 text-slate-600 px-3 py-1.5 rounded-full font-bold font-mono">
                Lớp {appUser?.className}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* COMPLETED SUCCESS RESULT SCREEN */}
      {submission ? (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 animate-in fade-in zoom-in duration-500">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-xl overflow-hidden mb-8">
            <div className="bg-gradient-to-r from-indigo-900 via-indigo-850 to-indigo-800 p-8 text-white text-center relative overflow-hidden">
              <div className="absolute top-0 right-0 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl -mr-20 -mt-20 pointer-events-none"></div>
              <div className="absolute bottom-0 left-0 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl -ml-20 -mb-20 pointer-events-none"></div>
              
              <div className="relative z-10 space-y-4">
                <div className="w-20 h-20 bg-emerald-500 text-white rounded-full flex items-center justify-center mx-auto shadow-lg shadow-emerald-500/30 transform hover:scale-105 transition-transform duration-300">
                  <CheckCircle className="w-10 h-10" />
                </div>
                <h2 className="text-3xl font-black tracking-tight">Nộp & Chấm điểm thành công!</h2>
                <p className="text-indigo-200 max-w-lg mx-auto font-medium">
                  Bài làm của bạn đã được lưu trữ an toàn trong hệ thống và chấm điểm tự động bằng Giáo viên AI.
                </p>
                
                {/* Score Section */}
                <div className="inline-block bg-white/10 backdrop-blur-md border border-white/20 rounded-2xl py-6 px-10 shadow-xl mt-4">
                  <div className="text-xs font-bold text-indigo-200 uppercase tracking-widest mb-1 font-mono">Điểm số đạt được</div>
                  <div className="text-5xl font-black text-emerald-400 drop-shadow-sm font-mono flex items-baseline justify-center">
                    {submission.score?.toFixed(1) || '0.0'}
                    <span className="text-2xl text-white/50 font-bold ml-1">/10</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Content & Tab Panel */}
            <div className="p-6 md:p-8">
              <div className="flex border-b border-slate-200 mb-6 overflow-x-auto space-x-6 pb-px scrollbar-thin">
                <button
                  onClick={() => setActiveTab('ai')}
                  className={`pb-4 text-sm font-bold flex items-center shrink-0 space-x-2 transition-all relative ${
                    activeTab === 'ai' ? 'text-indigo-600' : 'text-slate-400 hover:text-slate-600'
                  }`}
                >
                  <Sparkles className="w-4 h-4" />
                  <span>Đánh giá chi tiết từ AI</span>
                  {activeTab === 'ai' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-indigo-600 rounded-full"></div>}
                </button>
                
                <button
                  onClick={() => setActiveTab('submission')}
                  className={`pb-4 text-sm font-bold flex items-center shrink-0 space-x-2 transition-all relative ${
                    activeTab === 'submission' ? 'text-indigo-600' : 'text-slate-400 hover:text-slate-600'
                  }`}
                >
                  <FileText className="w-4 h-4" />
                  <span>Bài làm của bạn</span>
                  {activeTab === 'submission' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-indigo-600 rounded-full"></div>}
                </button>
                
                {((essay.solutionImages && essay.solutionImages.length > 0) || (essay.solutionText && essay.solutionText.trim() !== '')) && (
                  <button
                    onClick={() => setActiveTab('solution')}
                    className={`pb-4 text-sm font-bold flex items-center shrink-0 space-x-2 transition-all relative ${
                      activeTab === 'solution' ? 'text-indigo-600' : 'text-slate-400 hover:text-slate-600'
                    }`}
                  >
                    <BookOpen className="w-4 h-4" />
                    <span>Đáp án tham khảo</span>
                    {activeTab === 'solution' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-indigo-600 rounded-full"></div>}
                  </button>
                )}
              </div>

              {/* Tab: AI Review */}
              {activeTab === 'ai' && (
                <div className="space-y-6">
                  <div className="flex items-center space-x-2">
                    <div className="p-2 bg-indigo-50 rounded-lg text-indigo-600 shrink-0">
                      <Award className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="font-bold text-slate-800 text-lg">Chi tiết nhận xét từ Giáo viên AI</h3>
                      <p className="text-slate-400 text-xs">Hệ thống phân tích từng chi tiết lỗi sai và gợi ý sửa đổi cho bạn</p>
                    </div>
                  </div>
                  
                  <div className="bg-slate-50 rounded-2xl border border-slate-200 p-6 md:p-8 shadow-inner overflow-hidden">
                    <div className="prose prose-slate max-w-none text-slate-700 leading-relaxed">
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
                        {submission.aiFeedback}
                      </ReactMarkdown>
                    </div>
                  </div>
                </div>
              )}

              {/* Tab: Student Submission */}
              {activeTab === 'submission' && (
                <div className="space-y-6">
                  {submission.text && (
                    <div className="space-y-2">
                      <h4 className="font-bold text-slate-800 flex items-center text-sm">
                        <FileText className="w-4 h-4 mr-2 text-slate-400" /> Nội dung văn bản đã nộp:
                      </h4>
                      <div className="p-5 bg-slate-50 rounded-2xl text-slate-700 whitespace-pre-wrap text-sm md:text-base border border-slate-200 font-sans leading-relaxed shadow-inner">
                        {submission.text}
                      </div>
                    </div>
                  )}

                  {submission.images && submission.images.length > 0 && (
                    <div className="space-y-3">
                      <h4 className="font-bold text-slate-800 flex items-center text-sm">
                        <ImageIcon className="w-4 h-4 mr-2 text-slate-400" /> Hình ảnh lời giải đã nộp ({submission.images.length} ảnh):
                      </h4>
                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
                        {submission.images.map((img: string, idx: number) => (
                          <div key={idx} className="bg-slate-50 rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col group hover:border-indigo-200 transition-all">
                            <div className="relative aspect-[3/4] bg-white border-b border-slate-100 overflow-hidden">
                              <img src={img} className="w-full h-full object-contain hover:scale-105 transition-transform duration-300" alt={`Bài làm ${idx + 1}`} />
                            </div>
                            <div className="p-3 text-center text-xs font-bold text-slate-500 bg-slate-50/50">
                              Ảnh chụp lời giải {idx + 1}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Tab: Reference Solution */}
              {activeTab === 'solution' && (
                <div className="space-y-6 animate-in fade-in duration-300">
                  <div className="flex items-center space-x-2">
                    <div className="p-2 bg-emerald-50 rounded-lg text-emerald-600 shrink-0">
                      <BookOpen className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="font-bold text-slate-800 text-lg">Đáp án mẫu từ Giáo viên</h3>
                      <p className="text-slate-400 text-xs">Đối chiếu bài giải của bạn với đáp án chính thức</p>
                    </div>
                  </div>

                  {essay.solutionText && essay.solutionText.trim() !== '' && (
                    <div className="bg-emerald-50/30 rounded-2xl border border-emerald-100 p-6 md:p-8 overflow-hidden">
                      <div className="prose prose-slate max-w-none text-slate-700 leading-relaxed font-sans">
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
                          {essay.solutionText}
                        </ReactMarkdown>
                      </div>
                    </div>
                  )}

                  {essay.solutionImages && essay.solutionImages.length > 0 && (!essay.solutionText || essay.solutionText.trim() === '') && (
                    <div className="space-y-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        {essay.solutionImages.map((img: string, idx: number) => (
                          <div key={idx} className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm flex flex-col">
                            <div className="relative aspect-[4/5] md:aspect-[3/4] bg-slate-50 flex items-center justify-center p-2 border-b border-slate-100">
                              <img src={img} className="max-w-full max-h-full object-contain" alt={`Đáp án mẫu ${idx + 1}`} />
                            </div>
                            <div className="p-3 text-center text-xs font-bold text-slate-600 bg-slate-50">
                              Hình ảnh đáp án mẫu {idx + 1}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          <div className="flex flex-col sm:flex-row justify-center gap-4">
            <Link
              to="/student"
              className="px-8 py-3.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl font-bold transition-all shadow-lg shadow-indigo-100 hover:shadow-indigo-200 text-center flex items-center justify-center"
            >
              Quay lại Student Dashboard
            </Link>
          </div>
        </div>
      ) : (
        /* WORKSPACE / ESSAY TAKING ZONE */
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            
            {/* COLUMN 1: EXAM TOPIC (STICKY ON DESKTOP) */}
            <div className="lg:col-span-5 space-y-6 lg:sticky lg:top-24">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-bold text-slate-800 flex items-center">
                  <FileText className="w-5 h-5 mr-2 text-indigo-500" /> Đề bài tự luận
                </h2>
                
                {essay.endTime && (
                  <span className="text-xs font-bold flex items-center text-rose-600 bg-rose-50 px-3 py-1.5 rounded-full border border-rose-100 shrink-0">
                    <Clock className="w-3.5 h-3.5 mr-1" />
                    Hạn: {new Date(essay.endTime).toLocaleDateString('vi-VN')}
                  </span>
                )}
              </div>
              
              <div className="bg-white rounded-[2rem] border border-slate-200 shadow-sm overflow-hidden p-6 md:p-8 flex flex-col space-y-6">
                {essay.assignmentImages && essay.assignmentImages.length > 0 ? (
                  <div className="space-y-6">
                    {essay.assignmentImages.map((img: string, idx: number) => (
                      <div key={idx} className="border border-slate-200 rounded-2xl overflow-hidden shadow-sm bg-slate-50/50">
                        <div className="bg-slate-100/50 border-b border-slate-100 px-4 py-2 flex items-center justify-between text-xs font-bold text-slate-500">
                          <span>Hình ảnh đề bài {idx + 1}</span>
                          <span className="bg-white px-2 py-0.5 rounded-full border border-slate-200 text-slate-400">Trang {idx + 1}</span>
                        </div>
                        <div className="p-2 bg-white flex items-center justify-center">
                          <img src={img} alt={`Đề bài ${idx + 1}`} className="max-w-full h-auto rounded-xl" />
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-16 bg-slate-50 rounded-2xl border border-dashed border-slate-300">
                    <ImageIcon className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                    <p className="text-slate-500 font-medium">Đề bài không có hình ảnh đi kèm.</p>
                  </div>
                )}
              </div>
            </div>

            {/* COLUMN 2: WORKSPACE */}
            <div className="lg:col-span-7 space-y-6">
              <h2 className="text-lg font-bold text-slate-800 flex items-center">
                <Send className="w-5 h-5 mr-2 text-emerald-500" /> Không gian làm bài của bạn
              </h2>
              
              <div className="bg-white rounded-[2rem] border border-slate-200 shadow-md p-6 md:p-8 space-y-6">
                
                {/* Textarea Section */}
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <label className="block text-sm font-bold text-slate-700 flex items-center">
                      <FileText className="w-4 h-4 mr-1.5 text-indigo-500" /> Nhập lời giải của bạn bằng văn bản:
                    </label>
                    <span className="text-xs text-slate-400 font-medium font-mono">{text.length} ký tự</span>
                  </div>
                  <textarea
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    placeholder="Nhập câu trả lời hoặc trình bày lời giải chi tiết cho bài tập tự luận tại đây..."
                    rows={9}
                    className="w-full border-slate-200 rounded-2xl shadow-sm focus:border-indigo-500 focus:ring-indigo-500 text-slate-700 placeholder-slate-400 p-4 leading-relaxed text-sm md:text-base border-2"
                  ></textarea>
                </div>

                {/* Upload Image Section */}
                <div className="space-y-3">
                  <label className="block text-sm font-bold text-slate-700 flex items-center">
                    <ImageIcon className="w-4 h-4 mr-1.5 text-indigo-500" /> Tải ảnh bài viết tay, vở nháp:
                  </label>
                  
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-4">
                    {images.map((img, idx) => (
                      <div key={idx} className="relative aspect-[3/4] rounded-2xl overflow-hidden border border-slate-200 shadow-sm group bg-slate-50 flex items-center justify-center p-1.5 hover:border-rose-400 transition-all">
                        <img src={img} className="max-w-full max-h-full object-contain rounded-xl" alt={`Bài làm ${idx + 1}`} />
                        <div className="absolute top-1.5 left-1.5 bg-slate-900/60 backdrop-blur-md text-white font-mono text-[10px] font-bold px-2 py-0.5 rounded-full border border-white/10 z-10">
                          Ảnh {idx + 1}
                        </div>
                        <button 
                          onClick={() => removeImage(idx)}
                          className="absolute top-1.5 right-1.5 p-1.5 bg-rose-500 text-white rounded-lg opacity-0 group-hover:opacity-100 hover:bg-rose-600 transition-all shadow-md z-10"
                          title="Xóa hình ảnh"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                    
                    <button 
                      onClick={() => fileInputRef.current?.click()}
                      onDragEnter={handleDrag}
                      onDragOver={handleDrag}
                      onDragLeave={handleDrag}
                      onDrop={handleDrop}
                      className={`aspect-[3/4] flex flex-col items-center justify-center rounded-2xl border-2 border-dashed transition-all p-4 ${
                        dragActive 
                          ? 'border-indigo-600 bg-indigo-50/50 text-indigo-600 scale-[0.98]' 
                          : 'border-slate-300 bg-slate-50 hover:border-indigo-500 hover:bg-indigo-50 text-slate-500 hover:text-indigo-600'
                      }`}
                    >
                      <Upload className="w-8 h-8 text-indigo-400 mb-2 animate-bounce" />
                      <span className="text-xs md:text-sm font-bold block text-center">Thêm ảnh</span>
                      <span className="text-[10px] text-slate-400 block text-center mt-1">Kéo thả hoặc nhấp chọn</span>
                    </button>
                    
                    <input 
                      type="file" 
                      ref={fileInputRef} 
                      className="hidden" 
                      accept="image/*" 
                      multiple 
                      onChange={(e) => handleImageUpload(e.target.files)} 
                    />
                  </div>
                </div>

                {/* Gemini API Key Section */}
                <div className="bg-blue-50/40 rounded-3xl p-5 border border-blue-100 space-y-3 animate-in fade-in slide-in-from-bottom-2 duration-300">
                  <div className="flex items-center space-x-2 text-blue-900 font-bold text-sm">
                    <Sparkles className="w-4 h-4 text-blue-500 shrink-0" />
                    <span>Cung cấp Gemini API Key để chấm điểm</span>
                  </div>
                  <p className="text-xs text-blue-800 font-medium leading-relaxed">
                    Học sinh vui lòng nhập API key để chấm điểm. Key này chỉ được lưu trữ an toàn trong trình duyệt của bạn và dùng để chấm bài tự luận trực tiếp.
                  </p>
                  <div className="relative">
                    <input
                      type="password"
                      value={studentApiKey}
                      onChange={(e) => handleApiKeyChange(e.target.value)}
                      placeholder="Nhập Gemini API Key của bạn (bắt đầu bằng AIzaSy...)"
                      className="w-full border-blue-200 focus:border-indigo-500 focus:ring-indigo-500 text-slate-800 placeholder-slate-400 p-3.5 pr-10 rounded-2xl text-sm border-2 bg-white font-mono transition-all"
                    />
                    <Sparkles className="w-4 h-4 text-blue-400 absolute right-3.5 top-4" />
                  </div>
                  <div className="pt-1 bg-gradient-to-r from-blue-50 to-indigo-50/30 rounded-xl p-2.5 border border-blue-100/50">
                    <a 
                      href="https://aistudio.google.com/app/apikey" 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="inline-flex items-center text-xs text-indigo-600 hover:text-indigo-800 font-extrabold hover:underline transition-all"
                    >
                      💡 Nhấp vào đây để lấy Gemini API Key miễn phí từ Google AI Studio
                      <ChevronRight className="w-3.5 h-3.5 ml-0.5" />
                    </a>
                  </div>
                </div>

                {/* Submit Error banner, perfectly inline so students never lose progress! */}
                {submitError && (
                  <div className="bg-rose-50 border-2 border-rose-100 rounded-2xl p-4 flex items-start space-x-3 text-rose-800 animate-in fade-in slide-in-from-top-4 duration-300">
                    <AlertCircle className="w-5 h-5 text-rose-500 shrink-0 mt-0.5" />
                    <div className="space-y-1">
                      <p className="font-extrabold text-sm flex items-center">Gặp sự cố khi kết nối chấm điểm</p>
                      <p className="text-xs text-rose-600 leading-relaxed font-medium">{submitError}</p>
                      <p className="text-xs text-slate-500 font-medium pt-1">
                        👉 Đừng lo lắng! Lời giải của bạn vẫn được lưu giữ an toàn trên màn hình này. Hãy kiểm tra kết nối mạng và nhấn nút <span className="font-bold text-indigo-600">"Nộp bài & Chấm Điểm"</span> một lần nữa để thử lại.
                      </p>
                    </div>
                  </div>
                )}

                {/* Submitting Status / Submit Button */}
                <div className="pt-4 border-t border-slate-100">
                  <button
                    onClick={handleSubmit}
                    disabled={isSubmitting || (!text.trim() && images.length === 0)}
                    className="w-full flex justify-center items-center px-6 py-4 bg-gradient-to-r from-indigo-600 to-violet-600 text-white rounded-2xl font-bold shadow-lg shadow-indigo-100 hover:shadow-indigo-200 hover:shadow-xl hover:-translate-y-0.5 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none disabled:shadow-none"
                  >
                    {isSubmitting ? (
                      <div className="flex items-center space-x-2">
                        <Loader2 className="w-5 h-5 animate-spin" />
                        <span>Đang chấm bài bằng Giáo viên AI (Khoảng 10-15 giây)...</span>
                      </div>
                    ) : (
                      <div className="flex items-center space-x-2">
                        <Send className="w-5 h-5" />
                        <span>Nộp bài & Chấm Điểm AI</span>
                      </div>
                    )}
                  </button>
                </div>

              </div>
            </div>

          </div>
        </div>
      )}
    </div>
  );
}
