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

// @ts-ignore
import step1Img from '../assets/images/step1_create_key_1784208451015.jpg';
// @ts-ignore
import step2Img from '../assets/images/step2_confirm_project_1784208466690.jpg';
// @ts-ignore
import step3Img from '../assets/images/step3_copy_key_1784208478558.jpg';

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

const translateGeminiError = (errorMsg: string): string => {
  if (!errorMsg) return "Lỗi không xác định khi kết nối với Google Gemini API.";
  
  const msg = errorMsg.toLowerCase();
  
  if (msg.includes("is not found for api version") || msg.includes("not_found") || msg.includes("model_not_found")) {
    return "API Key của bạn chưa được kích hoạt 'Generative Language API' hoặc không hỗ trợ mô hình này.\n\n" +
           "👉 CÁCH KHẮC PHỤC CHI TIẾT:\n" +
           "1. Nếu tự tạo khóa trên Google Cloud Console thông thường: Bạn BẮT BUỘC phải vào trang Google Cloud Console -> Thư viện API (API Library) -> Tìm kiếm và chọn 'Generative Language API' -> Bấm nút 'KÍCH HOẠT' (Enable) cho dự án của mình.\n" +
           "2. Cách đơn giản hơn: Hãy truy cập vào https://aistudio.google.com (Google AI Studio) và tạo một API Key mới MIỄN PHÍ. Khóa này đã được kích hoạt sẵn toàn bộ quyền dịch vụ và mô hình Gemini.\n" +
           "3. Đảm bảo API Key của bạn không bị giới hạn địa chỉ IP hoặc miền gọi (HTTP Referrer) sai cách.";
  }
  
  if (msg.includes("key not valid") || msg.includes("api_key_invalid") || (msg.includes("api key") && msg.includes("invalid"))) {
    return "Khóa API Key bạn nhập không chính xác hoặc không hợp lệ. Vui lòng kiểm tra lại mã API Key bạn đã sao chép.";
  }
  
  if (msg.includes("quota exceeded") || msg.includes("limit") || msg.includes("resource_exhausted") || msg.includes("429")) {
    return "Đã hết hạn mức sử dụng (Quota Exceeded) của API Key này. Vui lòng thử lại sau vài phút hoặc đổi một API Key khác.";
  }
  
  if (msg.includes("permission_denied") || msg.includes("403")) {
    return "API Key bị từ chối truy cập (Permission Denied / 403). Google có thể đã vô hiệu hóa khóa này vì bị lộ hoặc không đủ quyền dịch vụ.";
  }

  return errorMsg;
};

// ==========================================
// CLIENT-SIDE OCR & GRADING FALLBACK FOR VERCEL
// ==========================================
const callGeminiAPI = async (apiKey: string, model: string, payload: any): Promise<any> => {
  const versions = ['v1', 'v1beta'];
  let lastError: any = null;

  for (const ver of versions) {
    const url = `https://generativelanguage.googleapis.com/${ver}/models/${model}:generateContent?key=${apiKey}`;
    try {
      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      if (response.ok) {
        return await response.json();
      }

      const errObj = await response.json().catch(() => ({}));
      lastError = new Error(errObj.error?.message || `HTTP ${response.status} (${ver})`);
    } catch (err: any) {
      lastError = err;
    }
  }

  throw lastError || new Error("Không thể kết nối đến Google Gemini API");
};

const runClientSideOCR = async (apiKey: string, base64Image: string, imageType: 'teacher_solution' | 'student_work' | 'general'): Promise<string> => {
  const match = base64Image.match(/^data:(image\/[a-z]+);base64,([\s\S]+)$/);
  if (!match) return "";
  const mimeType = match[1];
  const base64Data = match[2].trim();

  let prompt = "";
  if (imageType === "teacher_solution") {
    prompt = `Bạn là chuyên gia OCR toán học. Hãy đọc và gõ lại CHÍNH XÁC nội dung đáp án trong hình ảnh.
Nhiệm vụ: Chuyển đổi hình ảnh đáp án của giáo viên thành văn bản.

YÊU CẦU CỰC KỲ QUAN TRỌNG VỀ ĐIỂM SỐ:
- Quan sát kỹ bên lề hoặc cạnh các bước giải xem có số điểm không (ví dụ: 0.25, 0.5đ, 1.0, 0,25).
- Nếu thấy điểm số, hãy ghi rõ ngay tại dòng đó theo định dạng: [Điểm: 0.25].
- Ví dụ: "Ta có: x = 2 [Điểm: 0.25]"

YÊU CẦU QUAN TRỌNG:
- Đọc từng dòng, từng ký tự một cách chính xác tuyệt đối
- Giữ nguyên format, layout, thứ tự các bước giải
- Ghi rõ từng bước giải và điểm số tương ứng nếu có
- Sử dụng LaTeX cho công thức toán: $x^2 + 1 = 0$
- Nếu có biểu đồ, hình vẽ: mô tả chi tiết
- Chú ý quan sát kỹ lề và chú thích dưới các bài giải hoặc cạnh bước giải để tìm điểm số.

ĐẦU RA:
[BƯỚC 1] Nội dung bước 1. [Điểm: ...]
[BƯỚC 2] Nội dung bước 2. [Điểm: ...]
...
[KẾT QUẢ] Đáp án cuối cùng. [Điểm: ...]

Chỉ trả về nội dung OCR, không giải thích thêm.`;
  } else if (imageType === "student_work") {
    prompt = `Bạn là chuyên gia OCR toán học. Hãy đọc và gõ lại CHÍNH XÁC bài làm học sinh trong hình ảnh.

YÊU CẦU QUAN TRỌNG:
- Đọc từng dòng, từng bước làm chính xác tuyệt đối
- Giữ nguyên thứ tự các bước làm của học sinh
- Ghi lại cả những chỗ làm sai, làm thiếu
- Sử dụng LaTeX cho công thức: $x^2 - 5x + 6 = 0$
- Nếu có tẩy xóa, sửa chữa: ghi chú [SỬA: ...]
- Nếu có vẽ hình, biểu đồ: mô tả chi tiết

ĐẦU RA:
Bước 1: Nội dung bước 1
Bước 2: Nội dung bước 2
...
Kết luận: Đáp án của học sinh

Chỉ trả về nội dung OCR, không nhận xét.`;
  } else {
    prompt = `Hãy đọc và gõ lại chính xác nội dung văn bản/toán học trong hình ảnh.
- Sử dụng LaTeX cho công thức toán, bọc trong dấu $
- Giữ nguyên format và cấu trúc
- Nếu có ký hiệu đặc biệt, gõ chính xác
Chỉ trả về nội dung đã OCR.`;
  }

  const payload = {
    contents: [{
      parts: [
        { text: prompt },
        {
          inlineData: {
            mimeType: mimeType,
            data: base64Data
          }
        }
      ]
    }]
  };

  const result = await callGeminiAPI(apiKey, "gemini-1.5-flash", payload);
  return result.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || "";
};

const gradeEssayClientSide = async (submission: { text: string; images: string[] }, essay: any, apiKey: string) => {
  // 1. OCR Problem Images
  let problemText = `Tiêu đề: ${essay.title}\nMô tả: ${essay.description || "Không có mô tả"}\n`;
  if (essay.assignmentImages && essay.assignmentImages.length > 0) {
    try {
      const ocrResults = await Promise.all(
        essay.assignmentImages.map((img: string) => runClientSideOCR(apiKey, img, 'general'))
      );
      problemText += "\nNội dung đề bài từ ảnh:\n" + ocrResults.filter(Boolean).join("\n---\n");
    } catch (err) {
      console.error("[Client Grading] Lỗi OCR đề bài:", err);
    }
  }

  // 2. OCR Teacher Solution
  let teacherSolutions = essay.solutionText || "";
  if (essay.solutionImages && essay.solutionImages.length > 0) {
    try {
      const ocrResults = await Promise.all(
        essay.solutionImages.map((img: string) => runClientSideOCR(apiKey, img, 'teacher_solution'))
      );
      const solutionOcrText = ocrResults.filter(Boolean).join("\n---\n");
      if (teacherSolutions) {
        teacherSolutions += "\n\nNội dung đáp án bổ sung từ ảnh:\n" + solutionOcrText;
      } else {
        teacherSolutions = solutionOcrText;
      }
    } catch (err) {
      console.error("[Client Grading] Lỗi OCR đáp án:", err);
    }
  }

  // 3. OCR Student Work
  let studentAnswer = submission.text || "";
  if (submission.images && submission.images.length > 0) {
    try {
      const ocrResults = await Promise.all(
        submission.images.map((img: string) => runClientSideOCR(apiKey, img, 'student_work'))
      );
      const studentOcrText = ocrResults.filter(Boolean).join("\n---\n");
      if (studentAnswer) {
        studentAnswer += "\n\nNội dung bài làm bổ sung từ ảnh:\n" + studentOcrText;
      } else {
        studentAnswer = studentOcrText;
      }
    } catch (err) {
      console.error("[Client Grading] Lỗi OCR bài làm:", err);
    }
  }

  // 4. Detailed grading prompt
  const gradingPrompt = `Bạn là GIÁO VIÊN TOÁN HỌC CHUYÊN NGHIỆP với 20 năm kinh nghiệm chấm bài.
Nhiệm vụ: CHẤM BÀI TOÁN bằng cách so sánh chi tiết bài làm học sinh với đáp án chuẩn.

[ĐỀ BÀI]
${problemText}

[ĐÁP ÁN CHUẨN CỦA GIÁO VIÊN]
${teacherSolutions || "Chưa cung cấp. Hãy tự giải chi tiết theo đề bài."}

[BÀI LÀM CỦA HỌC SINH]
${studentAnswer || "Trống."}

TIÊU CHÍ CHẤM BÀI:
1. PHƯƠNG PHÁP GIẢI: Chọn đúng phương pháp/chủ đề (ví dụ: đặt ẩn phụ, đạo hàm, BĐT Cauchy, quy nạp, đổi biến, tách phân thức, v.v.).
2. CÁC BƯỚC THỰC HIỆN: Lập luận chặt chẽ, biến đổi hợp lệ, không nhảy bước quan trọng; chỉ ra và định danh lỗi (khái niệm, đại số, biến đổi, điều kiện xác định, đơn vị).
3. KẾT QUẢ CUỐI CÙNG: Đáp án đúng/đủ điều kiện, dạng rút gọn/chuẩn (nếu yêu cầu), kèm đơn vị (nếu có).

QUY TẮC CHẤM:
- Nếu sai phương pháp: không tính điểm
- Nếu phương pháp đúng nhưng có lỗi tính toán nhỏ làm sai đáp án trong bước đó: không tính điểm phần đó và các bước sau dựa trên kết quả sai
- Nếu làm đúng phương pháp và kết quả đúng, có thể gộp/bỏ qua vài bước mà không ảnh hưởng: cho điểm tối đa
- Nếu thiếu bước quan trọng: trừ điểm ngay cả khi kết quả cuối cùng đúng
- Nếu làm đúng một phần: cho điểm tương ứng theo biểu điểm
- Nếu có cách làm sáng tạo và đúng: cho điểm tối đa
- Thang điểm: 0–10 (cho phép dùng 0.25, 0.5, 0.75). Làm tròn điểm cuối cùng đến bội số 0.25

HÃY TRẢ VỀ ĐÚNG ĐỊNH DẠNG SAU (không thay đổi tiêu đề, giữ nguyên thứ tự):

CHI TIẾT CHẤM:
- Câu 1: [Điểm đạt được] / [Điểm tối đa câu]. (phân tách điểm: phương pháp: a điểm, các bước: b điểm, tính toán: c điểm, kết quả: d điểm). Lý do trừ điểm: ...
  Chỉ ghi lỗi sai
  -> Lỗi: [Chỉ ghi ngắn gọn lỗi sai nếu có. Ví dụ: "Sai dấu dòng 3", "Thiếu điều kiện x>0". Nếu đúng ghi "Làm tốt"].
  -> Thiếu (bước quan trọng): ghi "THIẾU: mô tả bước" và ảnh hưởng của việc thiếu đó đến kết quả.
  ....
- Câu 2: [Điểm đạt được] / [Điểm tối đa câu].
  Chỉ ghi lỗi sai
  -> Lỗi: [Chỉ ghi ngắn gọn lỗi sai nếu có. Ví dụ: "Sai dấu dòng 3", "Thiếu điều kiện x>0". Nếu đúng ghi "Làm tốt"]. 
  -> Thiếu (bước quan trọng): ghi "THIẾU: mô tả bước" và ảnh hưởng của việc thiếu đó đến kết quả.
  ....

TỔNG ĐIỂM: [Số điểm] / 10. (Không làm tròn)

NHẬN XÉT & GÓP Ý:
- [Nhận xét chung ngắn gọn trong 1 câu].
- [Gợi ý sửa lỗi quan trọng nhất nếu có].

QUY TẮC TRÌNH BÀY CÔNG THỨC TOÁN HỌC:
- KHÔNG sử dụng các đoạn mã LaTeX thô hoặc phức tạp (như \frac, \sqrt, \alpha, \beta, \Rightarrow, v.v.).
- Thay vào đó, hãy viết công thức toán học một cách trực quan, đẹp mắt và dễ hiểu bằng các ký tự unicode toán học thông thường (ví dụ: dùng x², y³, √x, π, ±, ≥, ≤, ≠, dấu chia / hoặc phân số dạng a/b, v.v.). Học sinh và giáo viên cần đọc được ngay trực tiếp mà không cần hệ thống biên dịch mã LaTeX.

LƯU Ý CUỐI:
- KHÔNG liệt kê lại các bước làm đúng.
- KHÔNG cần cung cấp đáp án chuẩn hay giải chi tiết của đề bài trong phần đánh giá này.
- Tập trung vào việc chỉ ra lỗi sai để học sinh sửa.`;

  const payload = {
    contents: [{
      parts: [{ text: gradingPrompt }]
    }]
  };

  const result = await callGeminiAPI(apiKey, "gemini-1.5-flash", payload);
  const aiFeedback = result.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || "";

  if (!aiFeedback) {
    throw new Error("AI không trả về kết quả chấm điểm.");
  }

  const extractScoreFromText = (feedbackText: string): number => {
    if (!feedbackText) return 0;
    const patterns = [
      /ĐIỂM\s*TỔNG\s*[:\-]?\s*(\d+(?:[.,]\d+)?)\s*[\/\s]*10/i,
      /ĐIỂM\s*SỐ\s*[:\-]?\s*(\d+(?:[.,]\d+)?)/i,
      /TỔNG\s*ĐIỂM\s*[:\-]?\s*(\d+(?:[.,]\d+)?)/i,
      /Điểm\s*[:\-]?\s*(\d+(?:[.,]\d+)?)/i,
      /Score\s*[:\-]?\s*(\d+(?:[.,]\d+)?)/i,
      /(\d+(?:[.,]\d+)?)\s*\/\s*10/i,
      /(\d+(?:[.,]\d+)?)\s*điểm/i
    ];

    let score = 0;
    for (const pattern of patterns) {
      const match = feedbackText.match(pattern);
      if (match) {
        score = parseFloat((match[1] || match[0]).replace(',', '.'));
        break;
      }
    }

    if (!score) {
      const jsonMatch = feedbackText.match(/"score"\s*:\s*(\d+(?:[.,]\d+)?)/i);
      if (jsonMatch) score = parseFloat(jsonMatch[1].replace(',', '.'));
    }

    if (isNaN(score)) score = 0;
    if (score < 0) score = 0;
    if (score > 10) score = 10;

    return Math.round(score * 4) / 4; // Round to nearest 0.25
  };

  const score = extractScoreFromText(aiFeedback);
  return { aiFeedback, score };
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
      let aiFeedback = "";
      let score = 0;

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

        const contentType = res.headers.get('content-type');
        if (!res.ok || (contentType && contentType.includes('text/html'))) {
          throw new Error('Server backend không hỗ trợ trực tiếp trên môi trường Vercel.');
        }

        const data = await res.json();
        aiFeedback = data.aiFeedback;
        score = data.score;
      } catch (apiErr) {
        console.warn("[TakeEssay] Lỗi kết nối server backend, chuyển sang chấm bài trực tiếp trên trình duyệt (client-side fallback)...", apiErr);
        // Fallback to client-side grading directly from the student's browser using their API key
        const clientRes = await gradeEssayClientSide({ text, images }, essay, studentApiKey);
        aiFeedback = clientRes.aiFeedback;
        score = clientRes.score;
      }

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
      const friendlyMsg = translateGeminiError(err.message || String(err));
      setSubmitError(friendlyMsg);
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
      <div className="bg-white/95 backdrop-blur-md border-b border-slate-200/80 sticky top-0 z-40 shadow-sm transition-all duration-300">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="relative flex justify-between items-center h-20">
            
            {/* Cột 1: Nút quay lại bên trái */}
            <div className="flex items-center z-10 w-1/5 justify-start">
              <button 
                onClick={() => navigate('/student')} 
                className="group flex items-center space-x-2 px-3.5 py-2 bg-slate-50 hover:bg-emerald-50 text-slate-500 hover:text-emerald-700 rounded-2xl transition-all duration-300 border border-slate-100 hover:border-emerald-200/80 shadow-sm hover:shadow active:scale-95"
                title="Quay lại danh sách"
              >
                <ArrowLeft className="w-5 h-5 transition-transform group-hover:-translate-x-1 duration-300" />
                <span className="hidden md:inline text-xs font-bold tracking-wide uppercase">Quay lại</span>
              </button>
            </div>
            
            {/* Cột 2: Tiêu đề căn giữa tuyệt đối */}
            <div className="absolute left-1/2 -translate-x-1/2 text-center max-w-[55%] sm:max-w-[65%] md:max-w-[70%] lg:max-w-[75%] px-2">
              <div className="inline-flex items-center space-x-1.5 bg-emerald-50 text-emerald-700 px-3 py-1 rounded-full text-[10px] sm:text-xs font-extrabold tracking-widest uppercase border border-emerald-100/80 shadow-sm mb-1.5 transform hover:scale-105 transition-transform">
                <Sparkles className="w-3 h-3 text-amber-500 animate-pulse" />
                <span>BÀI TẬP TỰ LUẬN</span>
              </div>
              <h1 className="text-base sm:text-lg md:text-xl font-black text-slate-800 tracking-tight leading-tight uppercase line-clamp-1 hover:text-emerald-800 transition-colors">
                {essay.title}
              </h1>
            </div>
            
            {/* Cột 3: Lớp học bên phải */}
            <div className="flex items-center z-10 w-1/5 justify-end">
              <span className="inline-flex items-center px-4 py-2 bg-emerald-50/50 hover:bg-emerald-50 border border-emerald-100 text-emerald-800 text-xs md:text-sm font-extrabold rounded-2xl shadow-sm transition-colors cursor-default">
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
        </div>
      ) : (
        /* WORKSPACE / ESSAY TAKING ZONE - BEAUTIFULLY STYLED PROCESS LAYOUT */
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-700">
          
          {/* TOP EXAM SUMMARY HEADER */}
          <div className="bg-gradient-to-br from-emerald-600 via-teal-700 to-cyan-700 rounded-[2rem] p-6 md:p-8 text-white shadow-xl relative overflow-hidden border border-emerald-500/20">
            <div className="absolute right-0 top-0 -mt-6 -mr-6 w-32 h-32 bg-emerald-400 rounded-full opacity-20 blur-2xl"></div>
            <div className="absolute left-1/3 bottom-0 -mb-10 w-48 h-48 bg-teal-500 rounded-full opacity-20 blur-3xl"></div>
            
            <div className="relative flex flex-col md:flex-row md:items-center justify-between gap-6">
              <div className="space-y-2">
                <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight text-white leading-tight">
                  {essay.title || "Bài tập Tự luận"}
                </h1>
                <p className="text-emerald-50 text-sm md:text-base max-w-xl font-medium opacity-90">
                  Hãy đọc kỹ đề bài, trình bày lời giải của bạn bằng cách nhập văn bản trực tiếp hoặc tải lên ảnh chụp bài làm của mình nhé!
                </p>
              </div>
              
              {essay.endTime && (
                <div className="shrink-0 flex items-center bg-white/15 backdrop-blur-md px-5 py-3 rounded-2xl border border-white/20 shadow-md">
                  <Clock className="w-5 h-5 text-amber-300 mr-2.5 animate-pulse" />
                  <div>
                    <p className="text-[10px] text-emerald-100 font-bold uppercase tracking-wider">Hạn nộp bài</p>
                    <p className="text-sm font-extrabold text-white">
                      {new Date(essay.endTime).toLocaleDateString('vi-VN')}
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* HÀNG 1: ĐỀ BÀI TỰ LUẬN */}
          <div className="space-y-4 group">
            <div className="flex items-center justify-between border-b border-emerald-100 pb-3">
              <div className="flex items-center space-x-3">
                <span className="bg-gradient-to-br from-emerald-500 to-teal-600 text-white w-9 h-9 rounded-2xl flex items-center justify-center text-sm font-black shadow-md shadow-emerald-100 transition-transform group-hover:scale-105">
                  1
                </span>
                <h2 className="text-xl md:text-2xl font-extrabold text-slate-800 tracking-tight flex items-center">
                  📖 Đề bài tự luận
                </h2>
              </div>
            </div>
            
            <div className="bg-white rounded-[2rem] border border-slate-200/80 shadow-sm hover:shadow-md transition-all duration-300 overflow-hidden p-6 md:p-8 space-y-6">
              {essay.assignmentImages && essay.assignmentImages.length > 0 ? (
                <div className="grid grid-cols-1 gap-6">
                  {essay.assignmentImages.map((img: string, idx: number) => (
                    <div key={idx} className="border border-emerald-100/70 rounded-3xl overflow-hidden shadow-sm bg-emerald-50/5 hover:border-emerald-300 transition-colors p-2">
                      <div className="p-2 bg-white flex items-center justify-center min-h-[250px]">
                        <img 
                          src={img} 
                          alt={`Đề bài ${idx + 1}`} 
                          className="max-w-full h-auto rounded-2xl shadow-sm hover:scale-[1.01] transition-transform duration-300" 
                        />
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-20 bg-slate-50 rounded-2xl border-2 border-dashed border-slate-300">
                  <ImageIcon className="w-16 h-16 text-slate-300 mx-auto mb-4" />
                  <p className="text-slate-700 font-extrabold text-lg">Đề bài không có hình ảnh kèm theo</p>
                  <p className="text-slate-500 text-sm max-w-sm mx-auto mt-1">Nội dung đề bài tự luận này đã được hiển thị chi tiết hoặc giáo viên giao trực tiếp qua vở viết.</p>
                </div>
              )}
            </div>
          </div>

          {/* HÀNG 2: NHẬP ĐÁP ÁN BẰNG VĂN BẢN */}
          <div className="space-y-4 group">
            <div className="flex items-center justify-between border-b border-emerald-100 pb-3">
              <div className="flex items-center space-x-3">
                <span className="bg-gradient-to-br from-teal-500 to-cyan-600 text-white w-9 h-9 rounded-2xl flex items-center justify-center text-sm font-black shadow-md shadow-teal-100 transition-transform group-hover:scale-105">
                  2
                </span>
                <h2 className="text-xl md:text-2xl font-extrabold text-slate-800 tracking-tight flex items-center">
                  ✏️ Trình bày lời giải
                </h2>
              </div>
              <span className="text-xs text-teal-700 font-extrabold font-mono bg-teal-50 px-3.5 py-1.5 rounded-full border border-teal-100 shadow-sm">
                {text.length} ký tự đã viết
              </span>
            </div>
            
            <div className="bg-white rounded-[2rem] border border-slate-200/80 shadow-sm p-6 md:p-8 space-y-4">
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="Nhập câu trả lời chi tiết, công thức, cách giải hoặc văn bản phân tích bài làm của bạn tại đây..."
                rows={9}
                className="w-full border-slate-200 rounded-2xl shadow-inner focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100 text-slate-800 placeholder-slate-400 p-5 leading-relaxed text-sm md:text-base border-2 transition-all"
              ></textarea>
              <div className="flex items-center justify-between text-xs text-slate-400 font-medium">
                <span className="flex items-center text-emerald-600">
                  <Sparkles className="w-3.5 h-3.5 mr-1 text-amber-500" />
                  Hệ thống hỗ trợ tự động lưu nháp để tránh mất dữ liệu
                </span>
                <span>Lời giải dài từ 100 ký tự trở lên sẽ giúp AI chấm điểm chính xác nhất.</span>
              </div>
            </div>
          </div>

          {/* HÀNG 3: TẢI ẢNH BÀI VIẾT TAY, VỞ NHÁP */}
          <div className="space-y-4 group">
            <div className="flex items-center border-b border-emerald-100 pb-3">
              <div className="flex items-center space-x-3">
                <span className="bg-gradient-to-br from-cyan-500 to-emerald-600 text-white w-9 h-9 rounded-2xl flex items-center justify-center text-sm font-black shadow-md shadow-cyan-100 transition-transform group-hover:scale-105">
                  3
                </span>
                <h2 className="text-xl md:text-2xl font-extrabold text-slate-800 tracking-tight flex items-center">
                  📸 Tải ảnh bài làm
                </h2>
              </div>
            </div>
            
            <div className="bg-white rounded-[2rem] border border-slate-200/80 shadow-sm p-6 md:p-8 space-y-6">
              <div className="bg-emerald-50/40 rounded-2xl p-4 border border-emerald-100/60 flex items-start space-x-3">
                <Sparkles className="w-5 h-5 text-emerald-500 shrink-0 mt-0.5" />
                <p className="text-xs text-emerald-950 font-medium leading-relaxed">
                  Nếu bạn làm bài ra giấy kiểm tra, vở viết tay hoặc vẽ biểu đồ nháp, hãy sử dụng điện thoại chụp lại thật rõ nét và tải ảnh lên tại đây. Giáo viên AI sẽ <b>tự động quét hình ảnh (OCR)</b> để phân tích và chấm điểm chính xác từng bước một!
                </p>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                {images.map((img, idx) => (
                  <div key={idx} className="relative aspect-[3/4] rounded-2xl overflow-hidden border-2 border-slate-200 shadow-sm group bg-slate-50 flex items-center justify-center p-1.5 hover:border-emerald-400 transition-all">
                    <img src={img} className="max-w-full max-h-full object-contain rounded-xl" alt={`Bài làm ${idx + 1}`} />
                    <div className="absolute top-2 left-2 bg-emerald-900/80 backdrop-blur-md text-white font-mono text-[10px] font-bold px-2.5 py-1 rounded-full border border-white/10 z-10 shadow-sm">
                      Ảnh số {idx + 1}
                    </div>
                    <button 
                      onClick={() => removeImage(idx)}
                      className="absolute top-2 right-2 p-2 bg-rose-500 hover:bg-rose-600 text-white rounded-xl opacity-0 group-hover:opacity-100 transition-all shadow-md z-10"
                      title="Xóa hình ảnh này"
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
                  className={`aspect-[3/4] flex flex-col items-center justify-center rounded-2xl border-2 border-dashed transition-all p-5 ${
                    dragActive 
                      ? 'border-emerald-600 bg-emerald-50/50 text-emerald-600 scale-[0.98]' 
                      : 'border-slate-300 bg-slate-50 hover:border-emerald-500 hover:bg-emerald-50 text-slate-500 hover:text-emerald-600'
                  }`}
                >
                  <div className="bg-white p-3 rounded-2xl shadow-sm border border-slate-100 group-hover:scale-110 transition-transform mb-3">
                    <Upload className="w-6 h-6 text-emerald-500 animate-bounce" />
                  </div>
                  <span className="text-sm font-extrabold text-slate-700 block text-center">Thêm ảnh bài làm</span>
                  <span className="text-[10px] text-slate-400 block text-center mt-1.5 font-medium">Kéo thả ảnh hoặc click để chọn</span>
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
          </div>

          {/* HÀNG 4: CUNG CẤP API KEY & HƯỚNG DẪN TỪNG BƯỚC */}
          <div className="space-y-4 group">
            <div className="flex items-center border-b border-emerald-100 pb-3">
              <div className="flex items-center space-x-3">
                <span className="bg-gradient-to-br from-emerald-600 to-teal-600 text-white w-9 h-9 rounded-2xl flex items-center justify-center text-sm font-black shadow-md shadow-emerald-100 transition-transform group-hover:scale-105">
                  4
                </span>
                <h2 className="text-xl md:text-2xl font-extrabold text-slate-800 tracking-tight flex items-center">
                  🔑 Cấu hình Giáo viên AI
                </h2>
              </div>
            </div>

            <div className="bg-white rounded-[2rem] border border-slate-200/80 shadow-sm p-6 md:p-8 space-y-8">
              
              {/* API Key Input Section with Glow Accent */}
              <div className="bg-gradient-to-br from-emerald-50/80 via-white to-teal-50/40 rounded-2xl p-6 border border-emerald-100 space-y-4 shadow-sm">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center space-x-2.5 text-emerald-950 font-extrabold text-base">
                    <Sparkles className="w-5 h-5 text-emerald-500 shrink-0" />
                    <span>Cung cấp Gemini API Key để tự do chấm điểm</span>
                  </div>
                  <span className="text-[10px] bg-emerald-100/85 text-emerald-800 px-3 py-1 rounded-full font-extrabold tracking-wider border border-emerald-200/50 uppercase">
                    An toàn & Bảo mật tuyệt đối
                  </span>
                </div>
                <p className="text-xs text-slate-600 font-medium leading-relaxed">
                  Học sinh vui lòng nhập mã API Key của riêng mình để tiến hành gọi mô hình chấm điểm tự luận. Mã khóa của bạn được lưu trữ bảo mật cục bộ ngay trong trình duyệt của bạn (LocalStorage) và gửi trực tiếp tới máy chủ Google AI Studio để thực hiện chấm điểm. Chúng tôi cam kết không lưu trữ hoặc thu thập thông tin này.
                </p>
                <div className="relative">
                  <input
                    type="password"
                    value={studentApiKey}
                    onChange={(e) => handleApiKeyChange(e.target.value)}
                    placeholder="Dán mã Gemini API Key của bạn vào đây (bắt đầu bằng AIzaSy...)"
                    className="w-full border-slate-200 focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100 text-slate-800 placeholder-slate-400 p-4 pr-12 rounded-2xl text-sm border-2 bg-white font-mono transition-all shadow-sm"
                  />
                  <div className="absolute right-4 top-4.5 text-emerald-500">
                    <Sparkles className="w-5 h-5" />
                  </div>
                </div>
              </div>

              {/* Hướng dẫn chi tiết từng bước tự tạo API Key miễn phí */}
              <div className="bg-slate-50/50 rounded-2xl p-6 border border-slate-200/60 space-y-6">
                <div className="border-b border-slate-200 pb-4 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                  <div>
                    <h3 className="text-base font-extrabold text-slate-800">
                      🎯 Hướng dẫn tự tạo API Key miễn phí:
                    </h3>
                    <p className="text-xs text-slate-500 font-medium mt-0.5">Chỉ mất chưa đầy 30 giây để có mã khóa trọn đời hoàn toàn miễn phí từ Google</p>
                  </div>
                  <a 
                    href="https://aistudio.google.com/app/apikey" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="inline-flex items-center justify-center text-xs text-emerald-600 hover:text-white hover:bg-emerald-600 font-extrabold hover:underline transition-all cursor-pointer shrink-0 bg-white hover:border-emerald-600 border border-emerald-100 px-4 py-2.5 rounded-xl shadow-sm hover:shadow"
                  >
                    💡 Bước đầu tiên: Nhấp vào đây để mở trang tạo Key miễn phí
                    <ChevronRight className="w-4 h-4 ml-1" />
                  </a>
                </div>

                {/* Vertical Step-by-Step Cards */}
                <div className="space-y-12 pt-4">
                  
                  {/* BƯỚC 1 */}
                  <div className="space-y-4 bg-white/50 p-5 rounded-3xl border border-slate-100 hover:border-emerald-100 hover:bg-emerald-50/5 transition-all duration-300 shadow-sm">
                    <div className="flex items-start space-x-3.5">
                      <span className="bg-gradient-to-br from-emerald-500 to-teal-600 text-white font-black text-sm w-7 h-7 rounded-xl flex items-center justify-center shrink-0 shadow-md">
                        1
                      </span>
                      <div className="space-y-1">
                        <h4 className="font-extrabold text-slate-800 text-sm md:text-base">Bước 1: Bấm nút "Create an API key" màu xanh da trời</h4>
                        <p className="text-xs md:text-sm text-slate-500 leading-relaxed">
                          Tại giao diện Google AI Studio vừa mở, nhấp chọn nút <b className="text-emerald-700">"Create API key"</b> màu xanh da trời nổi bật ở cột bên trái hoặc giữa trang.
                        </p>
                      </div>
                    </div>
                    <div className="max-w-xl mx-auto relative group overflow-hidden rounded-2xl border border-slate-200 bg-white p-2 shadow-sm hover:shadow-md hover:border-emerald-300 transition-all">
                      <img 
                        src={step1Img} 
                        alt="Bước 1: Nhấn Create an API key" 
                        className="w-full h-auto object-contain rounded-xl group-hover:scale-[1.01] transition-all duration-500 cursor-zoom-in"
                        onClick={() => window.open(step1Img, '_blank')}
                        referrerPolicy="no-referrer"
                      />
                      <div className="absolute inset-0 bg-emerald-950/20 opacity-0 group-hover:opacity-100 transition-all flex items-center justify-center pointer-events-none rounded-xl">
                        <span className="bg-white/95 text-slate-800 px-3 py-1.5 rounded-xl text-xs font-bold shadow-lg border border-slate-200">Bấm để xem ảnh phóng to ↗</span>
                      </div>
                    </div>
                  </div>

                  {/* BƯỚC 2 */}
                  <div className="space-y-4 bg-white/50 p-5 rounded-3xl border border-slate-100 hover:border-emerald-100 hover:bg-emerald-50/5 transition-all duration-300 shadow-sm">
                    <div className="flex items-start space-x-3.5">
                      <span className="bg-gradient-to-br from-emerald-500 to-teal-600 text-white font-black text-sm w-7 h-7 rounded-xl flex items-center justify-center shrink-0 shadow-md">
                        2
                      </span>
                      <div className="space-y-1">
                        <h4 className="font-extrabold text-slate-800 text-sm md:text-base">Bước 2: Chọn tạo khoá trong một dự án (Project) mới</h4>
                        <p className="text-xs md:text-sm text-slate-500 leading-relaxed">
                          Một bảng thiết lập sẽ hiện lên. Hãy nhấp chọn mục <b className="text-emerald-700">"Create API key in new project"</b> màu xám để hệ thống tự tạo một dự án liên kết mới an toàn cho bạn.
                        </p>
                      </div>
                    </div>
                    <div className="max-w-xl mx-auto relative group overflow-hidden rounded-2xl border border-slate-200 bg-white p-2 shadow-sm hover:shadow-md hover:border-emerald-300 transition-all">
                      <img 
                        src={step2Img} 
                        alt="Bước 2: Chọn Create API key trong dự án" 
                        className="w-full h-auto object-contain rounded-xl group-hover:scale-[1.01] transition-all duration-500 cursor-zoom-in"
                        onClick={() => window.open(step2Img, '_blank')}
                        referrerPolicy="no-referrer"
                      />
                      <div className="absolute inset-0 bg-emerald-950/20 opacity-0 group-hover:opacity-100 transition-all flex items-center justify-center pointer-events-none rounded-xl">
                        <span className="bg-white/95 text-slate-800 px-3 py-1.5 rounded-xl text-xs font-bold shadow-lg border border-slate-200">Bấm để xem ảnh phóng to ↗</span>
                      </div>
                    </div>
                  </div>

                  {/* BƯỚC 3 */}
                  <div className="space-y-4 bg-white/50 p-5 rounded-3xl border border-slate-100 hover:border-emerald-100 hover:bg-emerald-50/5 transition-all duration-300 shadow-sm">
                    <div className="flex items-start space-x-3.5">
                      <span className="bg-gradient-to-br from-emerald-500 to-teal-600 text-white font-black text-sm w-7 h-7 rounded-xl flex items-center justify-center shrink-0 shadow-md">
                        3
                      </span>
                      <div className="space-y-1">
                        <h4 className="font-extrabold text-slate-800 text-sm md:text-base">Bước 3: Sao chép mã API Key vừa tạo và dán vào ô nhập trên</h4>
                        <p className="text-xs md:text-sm text-slate-500 leading-relaxed">
                          Khi khoá được tạo thành công, bấm vào nút <b className="text-emerald-700">"Copy"</b> (hình hai trang giấy) bên cạnh dải ký tự khóa để sao chép, sau đó quay lại trang này và dán vào ô nhập ở phía trên.
                        </p>
                      </div>
                    </div>
                    <div className="max-w-xl mx-auto relative group overflow-hidden rounded-2xl border border-slate-200 bg-white p-2 shadow-sm hover:shadow-md hover:border-emerald-300 transition-all">
                      <img 
                        src={step3Img} 
                        alt="Bước 3: Sao chép mã API Key" 
                        className="w-full h-auto object-contain rounded-xl group-hover:scale-[1.01] transition-all duration-500 cursor-zoom-in"
                        onClick={() => window.open(step3Img, '_blank')}
                        referrerPolicy="no-referrer"
                      />
                      <div className="absolute inset-0 bg-emerald-950/20 opacity-0 group-hover:opacity-100 transition-all flex items-center justify-center pointer-events-none rounded-xl">
                        <span className="bg-white/95 text-slate-800 px-3 py-1.5 rounded-xl text-xs font-bold shadow-lg border border-slate-200">Bấm để xem ảnh phóng to ↗</span>
                      </div>
                    </div>
                  </div>

                </div>
              </div>

            </div>
          </div>

          {/* Submit Error banner, perfectly inline so students never lose progress! */}
          {submitError && (
            <div className="bg-rose-50 border-2 border-rose-200 rounded-3xl p-6 flex items-start space-x-4 text-rose-950 shadow-md animate-in fade-in slide-in-from-top-4 duration-300">
              <div className="bg-rose-100 p-2.5 rounded-2xl text-rose-600 shrink-0">
                <AlertCircle className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <p className="font-extrabold text-base flex items-center text-rose-900">Gặp sự cố khi kết nối chấm điểm</p>
                <p className="text-xs md:text-sm text-rose-700 leading-relaxed font-semibold">{submitError}</p>
                <p className="text-xs text-slate-500 font-medium pt-1.5">
                  👉 Đừng lo lắng! Toàn bộ lời giải và hình ảnh đính kèm của bạn vẫn đang được lưu giữ an toàn trên màn hình này. Hãy kiểm tra lại API Key bạn vừa nhập hoặc thử lại bằng cách nhấn nút <span className="font-extrabold text-emerald-600">"Nộp bài & Chấm Điểm AI"</span> phía bên dưới.
                </p>
              </div>
            </div>
          )}

          {/* Submitting Status / Submit Button */}
          <div className="pt-6 border-t border-slate-200 flex flex-col items-center">
            <button
              onClick={handleSubmit}
              disabled={isSubmitting || (!text.trim() && images.length === 0)}
              className="w-full max-w-2xl flex justify-center items-center px-8 py-5 bg-gradient-to-r from-emerald-500 via-teal-600 to-cyan-600 text-white rounded-[1.75rem] text-base md:text-lg font-bold shadow-xl shadow-emerald-100 hover:shadow-emerald-200 hover:shadow-2xl hover:-translate-y-1 active:translate-y-0 transition-all duration-300 disabled:opacity-40 disabled:cursor-not-allowed disabled:transform-none disabled:shadow-none"
            >
              {isSubmitting ? (
                <div className="flex items-center space-x-3">
                  <Loader2 className="w-6 h-6 animate-spin text-white" />
                  <span>Đang phân tích lời giải bằng AI (Khoảng 10-15 giây)...</span>
                </div>
              ) : (
                <div className="flex items-center space-x-3">
                  <Send className="w-5 h-5 text-emerald-100 group-hover:translate-x-1 transition-transform" />
                  <span>Nộp bài & Chấm Điểm AI ngay</span>
                </div>
              )}
            </button>
            <p className="text-[11px] text-slate-400 font-medium mt-3 text-center">
              Bằng cách nhấn nộp bài, bạn đồng ý gửi nội dung lời giải để Giáo viên AI tiến hành chấm điểm tự động.
            </p>
          </div>

        </div>
      )}
    </div>
  );
}
