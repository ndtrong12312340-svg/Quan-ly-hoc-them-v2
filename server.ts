import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";

dotenv.config({ override: true });

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const GEMINI_API_KEYS_POOL: string[] = process.env.GEMINI_API_KEYS
  ? process.env.GEMINI_API_KEYS.split(/[,;\s]+/).map(k => k.trim()).filter(Boolean)
  : [];

console.log(`[System Pool] Khởi tạo pool với ${GEMINI_API_KEYS_POOL.length} API Keys từ biến môi trường GEMINI_API_KEYS.`);

let currentKeyIndex = 0;

function getNextApiKey(studentApiKey?: string): string {
  if (studentApiKey?.trim()) {
    return studentApiKey.trim();
  }
  if (GEMINI_API_KEYS_POOL.length === 0) {
    return process.env.GEMINI_API_KEY?.trim() || "";
  }
  // Round robin
  const key = GEMINI_API_KEYS_POOL[currentKeyIndex];
  currentKeyIndex = (currentKeyIndex + 1) % GEMINI_API_KEYS_POOL.length;
  console.log(`[API Key Rotator] Chuyển sang API Key tại index ${currentKeyIndex - 1 < 0 ? GEMINI_API_KEYS_POOL.length - 1 : currentKeyIndex - 1}`);
  return key;
}

function getGoogleGenAI(studentApiKey?: string): GoogleGenAI {
  const apiKey = getNextApiKey(studentApiKey);
  if (!apiKey) {
    throw new Error("Chưa cấu hình GEMINI_API_KEY trên hệ thống.");
  }
  return new GoogleGenAI({ apiKey });
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Increase payload limit for large images
  app.use(express.json({ limit: '50mb' }));

  // OCR Helper Function
  async function runOCR(studentApiKey: string | undefined, base64Image: string, imageType: 'teacher_solution' | 'student_work' | 'general'): Promise<string> {
    const match = base64Image.match(/^data:(image\/[a-z]+);base64,([\s\S]+)$/);
    if (!match) return "";
    const mimeType = match[1];
    const base64Data = match[2].trim();

    let prompt = "";
    // ... (prompt definition remains the same)
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
- Nếu có chú thích, ghi chú: ghi lại chính xác
- Nếu chữ viết tay khó đọc: [KHÔNG RÕ: ...]

YÊU CỰC KỲ QUAN TRỌNG VỀ ĐIỂM SỐ:
- Quan sát kỹ bên lề hoặc cột điểm hoặc chú thích dưới các bài giải hoặc cạnh các bước giải xem có số điểm không (ví dụ: 0.25, 0.5đ, 1.0, 0,25).
- Nếu thấy điểm số, hãy ghi rõ ngay tại dòng đó theo định dạng: [Điểm: 0.25]. Nếu chỉ có 1 điểm tổng cho nhiều dòng thì tự chia điểm cho từng dòng.
- Ví dụ: "Ta có: x = 2 [Điểm: 0.25]"

ĐỊNH DẠNG ĐẦU RA:
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
- Nếu chữ viết tay khó đọc: [KHÔNG ĐỌC ĐƯỢC: khu vực này]

ĐỊNH DẠNG ĐẦU RA:
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

    let attempt = 0;
    let currentApiKeyToUse = studentApiKey?.trim();
    const poolSize = GEMINI_API_KEYS_POOL.length;
    const maxAttempts = (currentApiKeyToUse ? 3 : 0) + (poolSize > 0 ? poolSize : 3); // 3 for student key, plus poolSize or 3 fallback attempts
    
    while (attempt < maxAttempts) {
      try {
        const ai = getGoogleGenAI(currentApiKeyToUse);
        const response = await ai.models.generateContent({
          model: "gemini-flash-latest",
          contents: [
            { text: prompt },
            {
              inlineData: {
                mimeType: mimeType,
                data: base64Data
              }
            }
          ]
        });
        return response.text?.trim() || "";
      } catch (e: any) {
        attempt++;
        console.error(`[OCR] Lỗi lần thử ${attempt}/${maxAttempts} (Key: ${currentApiKeyToUse ? "Custom" : "System Pool"}):`, e.message || e);
        if (attempt >= maxAttempts) throw e;
        
        const hasSystemFallback = GEMINI_API_KEYS_POOL.length > 0 || !!process.env.GEMINI_API_KEY;
        const isPermanentAuthError = 
          e.status === 'PERMISSION_DENIED' || 
          e.status === 403 || 
          (e.message && (
            e.message.includes('API key not valid') || 
            e.message.includes('API_KEY_INVALID') || 
            e.message.includes('invalid key') ||
            e.message.includes('PERMISSION_DENIED')
          ));
        
        const isQuotaError = 
          e.status === 'RESOURCE_EXHAUSTED' || 
          e.status === 429 || 
          (e.message && (
            e.message.includes('exhausted') || 
            e.message.includes('quota') || 
            e.message.includes('limit') || 
            e.message.includes('RESOURCE_EXHAUSTED') ||
            e.message.includes('429')
          ));

        if (currentApiKeyToUse && hasSystemFallback && (isPermanentAuthError || isQuotaError)) {
          console.warn(`[OCR Fallback] API Key học sinh gặp sự cố (${e.message || "Quota/Auth Error"}). Tự động chuyển hướng dự phòng sang Pool API Key hệ thống! Chuyển ngay lập tức không thử lại.`);
          currentApiKeyToUse = undefined; // Trigger system pool on subsequent attempts
          continue; // Immediately try next key from pool
        }
        
        if (!currentApiKeyToUse && (isPermanentAuthError || isQuotaError)) {
          // Immediately try next key from pool (if we are rotating inside the system pool)
          if (GEMINI_API_KEYS_POOL.length > 1) {
            continue;
          }
        }
        
        const backoffTime = Math.pow(2, attempt) * 200; // Reduced from 1000 to 200
        await new Promise(r => setTimeout(r, backoffTime));
      }
    }
    return "";
  }

  function extractScoreFromText(text: string): number {
    if (!text) return 0;

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
      const match = text.match(pattern);
      if (match) {
        score = parseFloat((match[1] || match[0]).replace(',', '.'));
        break;
      }
    }

    if (!score) {
      const jsonMatch = text.match(/"score"\s*:\s*(\d+(?:[.,]\d+)?)/i);
      if (jsonMatch) score = parseFloat(jsonMatch[1].replace(',', '.'));
    }

    if (isNaN(score)) score = 0;
    if (score < 0) score = 0;
    if (score > 10) score = 10;
    
    return Math.round(score * 4) / 4; // Round to nearest 0.25
  }

  // API route for converting images to math text/formulas using OCR
  app.post("/api/ocr-images", async (req, res) => {
    try {
      const { images, type, studentApiKey } = req.body;
      if (!images || !Array.isArray(images) || images.length === 0) {
        return res.status(400).json({ error: "Không tìm thấy hình ảnh để nhận diện." });
      }

      console.log(`[API OCR] Nhận diện ${images.length} ảnh dạng ${type || 'general'}...`);
      
      const ocrResults: string[] = [];
      for (let i = 0; i < images.length; i++) {
        if (i > 0) {
          console.log(`[API OCR] Đang nghỉ 1.2s trước ảnh thứ ${i + 1}...`);
          await sleep(1200);
        }
        const text = await runOCR(studentApiKey, images[i], type || 'general');
        ocrResults.push(text);
      }

      const combinedText = ocrResults.filter(Boolean).join("\n\n---\n\n");
      res.json({ success: true, text: combinedText });
    } catch (err: any) {
      console.error("[API OCR ERROR]:", err);
      res.status(500).json({ error: err.message || "Lỗi khi nhận diện hình ảnh toán học" });
    }
  });

  // API route for AI grading
  app.post("/api/grade-essay", async (req, res) => {
    try {
      const { submission, essay, studentApiKey } = req.body;
      if (!submission || !essay) {
        return res.status(400).json({ error: "Thiếu dữ liệu bài làm hoặc đề bài." });
      }

      console.log(`[AI Grading Pipeline] Bắt đầu chấm bài "${essay.title}"...`);

      // 1. OCR Đề bài
      let problemText = `Tiêu đề: ${essay.title}\nMô tả: ${essay.description || "Không có mô tả"}\n`;
      if (essay.assignmentImages && essay.assignmentImages.length > 0) {
        console.log(`[AI Grading Pipeline] OCR ${essay.assignmentImages.length} ảnh đề bài...`);
        try {
          const ocrResults: string[] = [];
          for (let i = 0; i < essay.assignmentImages.length; i++) {
            if (i > 0) {
              console.log(`[AI Grading Pipeline] Nghỉ 300ms trước ảnh đề bài thứ ${i + 1}...`);
              await sleep(300);
            }
            const text = await runOCR(studentApiKey, essay.assignmentImages[i], 'general');
            ocrResults.push(text);
          }
          problemText += "\nNội dung đề bài từ ảnh:\n" + ocrResults.filter(Boolean).join("\n---\n");
        } catch (err) {
          console.error("[AI Grading Pipeline] Lỗi OCR đề bài:", err);
        }
      }

      // 2. OCR Đáp án giáo viên
      let teacherSolutions = essay.solutionText || "";
      if (essay.solutionImages && essay.solutionImages.length > 0) {
        console.log(`[AI Grading Pipeline] OCR ${essay.solutionImages.length} ảnh đáp án giáo viên...`);
        try {
          const ocrResults: string[] = [];
          for (let i = 0; i < essay.solutionImages.length; i++) {
            if (i > 0) {
              console.log(`[AI Grading Pipeline] Nghỉ 300ms trước ảnh đáp án thứ ${i + 1}...`);
              await sleep(300);
            }
            const text = await runOCR(studentApiKey, essay.solutionImages[i], 'teacher_solution');
            ocrResults.push(text);
          }
          const solutionOcrText = ocrResults.filter(Boolean).join("\n---\n");
          if (teacherSolutions) {
            teacherSolutions += "\n\nNội dung đáp án bổ sung từ ảnh:\n" + solutionOcrText;
          } else {
            teacherSolutions = solutionOcrText;
          }
        } catch (err) {
          console.error("[AI Grading Pipeline] Lỗi OCR đáp án:", err);
        }
      }

      // 3. OCR Bài làm học sinh
      let studentAnswer = submission.text || "";
      if (!studentAnswer && submission.images && submission.images.length > 0) {
        console.log(`[AI Grading Pipeline] OCR ${submission.images.length} ảnh bài làm học sinh...`);
        try {
          const ocrResults: string[] = [];
          for (let i = 0; i < submission.images.length; i++) {
            if (i > 0) {
              console.log(`[AI Grading Pipeline] Nghỉ 300ms trước ảnh bài làm thứ ${i + 1}...`);
              await sleep(300);
            }
            const text = await runOCR(studentApiKey, submission.images[i], 'student_work');
            ocrResults.push(text);
          }
          const studentOcrText = ocrResults.filter(Boolean).join("\n---\n");
          studentAnswer = studentOcrText;
        } catch (err) {
          console.error("[AI Grading Pipeline] Lỗi OCR bài làm:", err);
        }
      } else if (studentAnswer) {
        console.log("[AI Grading Pipeline] Sử dụng nội dung bài làm đã nhận diện (OCR) từ phía máy khách, bỏ qua cuộc gọi OCR trùng lặp.");
      }

      // 4. Tiến hành chấm điểm chi tiết bằng prompt giáo viên toán học chuyên nghiệp
      console.log("[AI Grading Pipeline] Đang chờ 500ms để làm mát API key trước khi chấm điểm...");
      await sleep(500);
      console.log("[AI Grading Pipeline] Tiến hành chấm điểm so sánh...");
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

HÃY TRẢ VỀ ĐÚNG ĐỊNH DẠNG SAU (sử dụng Markdown cho đẹp mắt):

### CHI TIẾT CHẤM:
- **Câu 1**: [Điểm đạt được] / [Điểm tối đa câu]. 
  - *Lỗi (nếu có)*: [Chỉ ghi ngắn gọn lỗi sai. Ví dụ: "Sai dấu dòng 3", "Thiếu điều kiện x>0". Nếu đúng ghi "Làm tốt"].
  - *Thiếu (nếu có)*: [Mô tả bước quan trọng bị thiếu].
- **Câu 2**: [Điểm đạt được] / [Điểm tối đa câu].
  - ... (tương tự)

### TỔNG ĐIỂM: [Số điểm] / 10. (Không làm tròn)

### NHẬN XÉT & GÓP Ý:
- **Ưu điểm**: [Nhận xét điểm tốt, khen ngợi những chỗ học sinh làm đúng và sáng tạo]
- **Nhược điểm**: [Phân tích chi tiết những lỗi sai, lỗ hổng kiến thức học sinh mắc phải]
- **Khắc phục**: [Đưa ra hướng dẫn cụ thể cách sửa lỗi và gợi ý ôn tập]

QUY TẮC TRÌNH BÀY CÔNG THỨC TOÁN HỌC:
- KHÔNG sử dụng các đoạn mã LaTeX thô hoặc phức tạp (như \frac, \sqrt, \alpha, \beta, \Rightarrow, v.v.).
- Thay vào đó, hãy viết công thức toán học một cách trực quan, đẹp mắt và dễ hiểu bằng các ký tự unicode toán học thông thường (ví dụ: dùng x², y³, √x, π, ±, ≥, ≤, ≠, dấu chia / hoặc phân số dạng a/b, v.v.). Học sinh và giáo viên cần đọc được ngay trực tiếp mà không cần hệ thống biên dịch mã LaTeX.

LƯU Ý CUỐI:
- KHÔNG liệt kê lại các bước làm đúng.
- KHÔNG cần cung cấp đáp án chuẩn hay giải chi tiết của đề bài trong phần đánh giá này.
- Tập trung vào việc chỉ ra lỗi sai để học sinh sửa.`;

      let response: any = null;
      let attempt = 0;
      let currentApiKeyToUse = studentApiKey?.trim();
      const poolSize = GEMINI_API_KEYS_POOL.length;
      const maxRetries = (currentApiKeyToUse ? 1 : 0) + (poolSize > 0 ? 1 : 2); // Reduced retries for faster failure/success on serverless
      
      while (attempt < maxRetries) {
        try {
          const ai = getGoogleGenAI(currentApiKeyToUse);
          response = await ai.models.generateContent({
            model: 'gemini-flash-latest',
            contents: [{ text: gradingPrompt }]
          });
          break;
        } catch (apiErr: any) {
          attempt++;
          console.error(`[AI Grading] Chấm điểm lần ${attempt}/${maxRetries} thất bại (Key: ${currentApiKeyToUse ? "Custom" : "System Pool"}):`, apiErr.message || apiErr);
          if (attempt >= maxRetries) throw apiErr;
          
          const hasSystemFallback = GEMINI_API_KEYS_POOL.length > 0 || !!process.env.GEMINI_API_KEY;
          const isPermanentAuthError = 
            apiErr.status === 'PERMISSION_DENIED' || 
            apiErr.status === 403 || 
            (apiErr.message && (
              apiErr.message.includes('API key not valid') || 
              apiErr.message.includes('API_KEY_INVALID') || 
              apiErr.message.includes('invalid key') ||
              apiErr.message.includes('PERMISSION_DENIED')
            ));
          
          const isQuotaError = 
            apiErr.status === 'RESOURCE_EXHAUSTED' || 
            apiErr.status === 429 || 
            (apiErr.message && (
              apiErr.message.includes('exhausted') || 
              apiErr.message.includes('quota') || 
              apiErr.message.includes('limit') || 
              apiErr.message.includes('RESOURCE_EXHAUSTED') ||
              apiErr.message.includes('429')
            ));
          
          if (currentApiKeyToUse && hasSystemFallback && (isPermanentAuthError || isQuotaError)) {
            console.warn(`[AI Grading Fallback] API Key học sinh gặp sự cố (${apiErr.message || "Quota/Auth Error"}). Tự động chuyển hướng dự phòng sang Pool API Key hệ thống! Chuyển ngay lập tức không thử lại.`);
            currentApiKeyToUse = undefined; // Trigger system pool on subsequent attempts
            continue; // Immediately try next key from pool
          }
          
          if (!currentApiKeyToUse && (isPermanentAuthError || isQuotaError)) {
            if (GEMINI_API_KEYS_POOL.length > 1) {
              continue; // immediately try the next key from the pool
            }
          }
          
          const backoffTime = Math.pow(2, attempt) * 500; // Faster backoff
          await new Promise(r => setTimeout(r, backoffTime));
        }
      }

      if (!response || !response.text) {
        throw new Error("AI không trả về kết quả chấm điểm.");
      }

      const aiFeedback = response.text;
      const score = extractScoreFromText(aiFeedback);

      console.log(`[AI Grading Pipeline] Chấm điểm thành công. Điểm số: ${score}/10`);
      res.json({ aiFeedback, score });
    } catch (err: any) {
      console.error("[AI Grading Pipeline ERROR]:", err);
      res.status(500).json({ error: err.message || "Lỗi khi chấm điểm AI tự luận" });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
