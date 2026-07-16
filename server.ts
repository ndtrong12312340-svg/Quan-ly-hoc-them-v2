import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";

dotenv.config({ override: true });

const GEMINI_API_KEYS_POOL = [
  'AIzaSyB_Qny4wx2jxZZY5fguRxa8uQtwkYy2C30',
  'AIzaSyBhNy-gvfhROFowD0nh3-sDU9-PTlXPaFU',
  'AIzaSyAg2Mosmu1giU5QDreB1kOUFpb1Qvl0zsU',
  'AIzaSyA9SDo7PL3Vr6I32GS_tW5DLtGIE2KkRUA',
  'AIzaSyDPmSHKNgj56COQDr1lmvWFVqBCniY-5tw',
  'AIzaSyB5X1OUUMuM7cmhf5AtxzboJ4NUfFgiaoQ',
  'AIzaSyBad0nvsBQPhaYlRmEO_VQ8P40_enwDA_I',
  'AIzaSyBPhPqe_HnjzhER_qbKMnw0PqMVExr7cy4',
  'AIzaSyAsJ6SmiSwCI_M4huh1qu2SCRH_zRWDEAI',
  'AIzaSyD5gmujSVPFjzLgsQ6Q_Gpm6Qx_YetAUq0',
  'AIzaSyDdXmJ7BvwPTPHi8KZoaNMVUhhoSWMriLc',
  'AIzaSyAh4ObHnCbJa4mbbSrUn7i1iiIM3cLEVxU',
  'AIzaSyBqLkDWDv2nkEV9aZjVYX0G3qqlay5tAwA',
  'AIzaSyBuR2Hp96zawcHtBaS-KqPLieW3yQqFyXU',
  'AIzaSyAY8FsyCezqPWKyBYRe2mOXyFxEnOk8q58',
  'AIzaSyDE9iqJMGJB_S9-ByMvh0M9k9k_9UhKuVA',
  'AIzaSyCKBMsN_wEwmN7sbBDgfA15mPe02azPSj8',
  'AIzaSyAuGu_mx51hgwJurBX8uvGv09eUAigt_fc',
  'AIzaSyDlRPS_8gTEK3jrx_H7O0-LDlMtoYwf_UQ',
  'AIzaSyDlWxgvEC3YC6a5VIMhQvx1Y9O3VJV7HoY',
  'AIzaSyDfUOOJQTidjluK3oRdcmP3xSK5KGmj4Iw',
  'AIzaSyBFBmJwU69W-bVmq9D31Ntf_rCR7VIXa_8',
  'AIzaSyCAOBjPRLn2LpsmLj7cf4PTOmqV7IHm8UQ',
  'AIzaSyDHIY3cOrMQn4wraxrFwybdtczl2QgALWI',
  'AIzaSyCuRUDCJLawCBU_t39bx0s0KA1JZrIm-qc',
  'AIzaSyCQrPxuEn3bbt_Ah8reUtIhdS45RxDDQ0k',
  'AIzaSyAXfh7TzP6Y6WKGwBDkjWcBLMc-JcKX4bo',
  'AIzaSyDNAMA5mi60HS-60m5Hu1tk34l6SmDQnCo',
  'AIzaSyBTmfLsP6XjRfoiNZrNW1dpFQnUJ59URik',
  'AIzaSyA13hqiARHHz7kmqj_cKoY-hOog8jFaf-8',
  'AIzaSyC5EvGM_R76w_WuQ87T5hW4nLgglHWwHM0',
  'AIzaSyDzJhcZNCzm2gJ6eYqJjFmIfDvD0zc19vY',
  'AIzaSyAom7lkHsK_Sf-vwIdVRuEoE2oinqPOHms',
  'AIzaSyA1ktsQtaZgif_AtBL9BtDS--P7F4q59p0',
  'AIzaSyCSs2U-xX_HOEguusrzY1bYU-4nJV69dH8',
  'AIzaSyAxCnz46AZhb9u0_v97mYJIDLd97zJT8Lc',
  'AIzaSyAXuKYMhGw4y_V7s-IMPgUz1nZbt9p3wFA',
  'AIzaSyBj53XcyAu_E3CoMKekkUMw54RZ9RAUaqI',
  'AIzaSyCJQgIj374585ut-2EtQMzHuc2wL49C69I',
  'AIzaSyB_X1ajcltZqFc-_7Nu_arVcDZhTAfpa9k',
  'AIzaSyBe4tZ-bAolNQVcf7___1etRrNXX1eTXas',
  'AIzaSyDFbNEMGHwfrjZyU0dR4_aZoYlnmOUu-O4',
  'AIzaSyDu07SmALKhuZb_F1rjBVh46MfXfdsiZzw',
  'AIzaSyA8QnF4tHOP4RsmJha2LGQJlsw_YJVtrMQ',
  'AIzaSyCvaUwicMgOmMp2r3IMihmbga1Mcy7h3oc',
  'AIzaSyChtXrvdl3LfR9STm3ZdLdvcip_HX7Qn2Q',
  'AIzaSyCKZ3MX0HfJzhldx5dFEof_YN5ZEiJqXk0',
  'AIzaSyBXrb9EcEY2bsmWu-jT_qrWmUQSH6AByp0',
  'AIzaSyCu8vEeZfoS1j5mtUrStUgww4gR54OPeC8',
  'AIzaSyDHf40xhpP4yFquzW_24WB05xb1ua0WAE8',
  'AIzaSyAq3xGQiQiZ8jfN1w8X3y7W57Mc5eo2QmY',
  'AIzaSyCAUcufTMIgmBn0aowY8yF2N04TsiDAfqc',
  'AIzaSyAfPbolwaiRvqKqBteVmTb1ubJ-SwA8Quc',
  'AIzaSyDnR32e4U6mwrMUm4ERrY30BfPUqR-eVgg',
  'AIzaSyCozHxGjhuVqZbBA-rH3mv4OWzW6g5Ii-U',
  'AIzaSyDY1gRdRFd_nADr2UmlOEw_-1VgJ_D3d2w',
  'AIzaSyA5Hm6nyRcLUk4Q_cfJ51JLYrXJHAAnjfc',
  'AIzaSyAbtLVxl-owwdQTLMR1F6YMZeQxzeVr5NA',
  'AIzaSyBDR9OxmWHFIhq0Li7hgq3KnHnAw99HCPI',
  'AIzaSyA7AScOaM2iRCPFFoGRW1PyqjHk4N3AgRc',
  'AIzaSyAfs5fu3mkvvNftJ6G3geW7ga9loetkE88',
  'AIzaSyDFKkGkjCQjjHUu0mkReJL3b-UBqFbnyUM',
  'AIzaSyDbFZFixJBMv81j1JF3ADkqtAz7MZRaWRM',
  'AIzaSyAqu9J4PGQHKLWKOn66QCyanpPRVbUZ0aU',
  'AIzaSyBlsZZbOdMKMd3CITfMl2HuV1Uz1sZ4wqg',
  'AIzaSyBaG8aj5AYMncoBPiOPJoTAM6hcei2-ma4'
];

let currentKeyIndex = 0;
const badApiKeys = new Set<string>();

function markApiKeyAsBad(key: string) {
  if (!key) return;
  if (GEMINI_API_KEYS_POOL.includes(key)) {
    badApiKeys.add(key);
    console.warn(`[API Key Rotator] Đã loại bỏ API Key bị rò rỉ/lỗi: ${key.substring(0, 8)}... (Tổng số key lỗi: ${badApiKeys.size})`);
  }
}

function getNextApiKey(studentApiKey?: string): { key: string; isFromPool: boolean } {
  if (studentApiKey?.trim()) {
    return { key: studentApiKey.trim(), isFromPool: false };
  }
  
  const availableKeys = GEMINI_API_KEYS_POOL.filter(k => !badApiKeys.has(k));
  if (availableKeys.length === 0) {
    const envKey = process.env.GEMINI_API_KEY?.trim() || "";
    return { key: envKey, isFromPool: false };
  }
  
  const index = currentKeyIndex % availableKeys.length;
  const key = availableKeys[index];
  currentKeyIndex = (currentKeyIndex + 1) % availableKeys.length;
  console.log(`[API Key Rotator] Sử dụng API Key tại index ${index} (còn ${availableKeys.length}/${GEMINI_API_KEYS_POOL.length} keys hoạt động)`);
  return { key, isFromPool: true };
}

function getGoogleGenAI(studentApiKey?: string): { ai: GoogleGenAI; apiKey: string; isFromPool: boolean } {
  const { key, isFromPool } = getNextApiKey(studentApiKey);
  if (!key) {
    throw new Error("Chưa cấu hình GEMINI_API_KEY trên hệ thống.");
  }
  return {
    ai: new GoogleGenAI({ apiKey: key }),
    apiKey: key,
    isFromPool
  };
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
    const maxRetries = 100; // Large retry count to cycle through bad keys
    while (attempt < maxRetries) {
      let apiKeyUsed = "";
      let isPoolKey = false;
      try {
        const { ai, apiKey, isFromPool } = getGoogleGenAI(studentApiKey);
        apiKeyUsed = apiKey;
        isPoolKey = isFromPool;
        
        const response = await ai.models.generateContent({
          model: "gemini-3.5-flash",
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
        const errorMsg = e.message || String(e);
        const errorStr = JSON.stringify(e);
        console.error(`[OCR] Lỗi lần thử ${attempt}:`, errorMsg);
        
        // Handle leaked key or invalid key error
        const isLeaked = errorMsg.includes("leaked") || 
                         errorMsg.includes("PERMISSION_DENIED") || 
                         errorMsg.includes("API key not valid") || 
                         errorMsg.includes("403") ||
                         errorStr.includes("leaked") ||
                         errorStr.includes("PERMISSION_DENIED") ||
                         errorStr.includes("API_KEY_INVALID");
                         
        if (!isPoolKey) {
          // If the student provided their own API Key, fail immediately without waiting or retrying
          throw e;
        }

        if (isPoolKey && isLeaked) {
          markApiKeyAsBad(apiKeyUsed);
          // If we hit a bad key, retry immediately without wait
          continue;
        }
        
        if (attempt >= maxRetries) throw e;
        await new Promise(r => setTimeout(r, 1000));
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
      const { images, type } = req.body;
      if (!images || !Array.isArray(images) || images.length === 0) {
        return res.status(400).json({ error: "Không tìm thấy hình ảnh để nhận diện." });
      }

      console.log(`[API OCR] Nhận diện ${images.length} ảnh dạng ${type || 'general'}...`);
      
      const ocrResults = await Promise.all(
        images.map((img: string) => runOCR(undefined, img, type || 'general'))
      );

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
          const ocrResults = await Promise.all(
            essay.assignmentImages.map((img: string) => runOCR(studentApiKey, img, 'general'))
          );
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
          const ocrResults = await Promise.all(
            essay.solutionImages.map((img: string) => runOCR(studentApiKey, img, 'teacher_solution'))
          );
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
      if (submission.images && submission.images.length > 0) {
        console.log(`[AI Grading Pipeline] OCR ${submission.images.length} ảnh bài làm học sinh...`);
        try {
          const ocrResults = await Promise.all(
            submission.images.map((img: string) => runOCR(studentApiKey, img, 'student_work'))
          );
          const studentOcrText = ocrResults.filter(Boolean).join("\n---\n");
          if (studentAnswer) {
            studentAnswer += "\n\nNội dung bài làm bổ sung từ ảnh:\n" + studentOcrText;
          } else {
            studentAnswer = studentOcrText;
          }
        } catch (err) {
          console.error("[AI Grading Pipeline] Lỗi OCR bài làm:", err);
        }
      }

      // 4. Tiến hành chấm điểm chi tiết bằng prompt giáo viên toán học chuyên nghiệp
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

      let response: any = null;
      let attempt = 0;
      const maxRetries = 100; // Large retry count to cycle through bad keys
      while (attempt < maxRetries) {
        let apiKeyUsed = "";
        let isPoolKey = false;
        try {
          const { ai, apiKey, isFromPool } = getGoogleGenAI(studentApiKey);
          apiKeyUsed = apiKey;
          isPoolKey = isFromPool;
          
          response = await ai.models.generateContent({
            model: 'gemini-3.5-flash',
            contents: [{ text: gradingPrompt }]
          });
          break;
        } catch (apiErr: any) {
          attempt++;
          const errorMsg = apiErr.message || String(apiErr);
          const errorStr = JSON.stringify(apiErr);
          console.error(`[AI Grading] Chấm điểm lần ${attempt}/${maxRetries} thất bại:`, errorMsg);
          
          // Handle leaked key or invalid key error
          const isLeaked = errorMsg.includes("leaked") || 
                           errorMsg.includes("PERMISSION_DENIED") || 
                           errorMsg.includes("API key not valid") || 
                           errorMsg.includes("403") ||
                           errorStr.includes("leaked") ||
                           errorStr.includes("PERMISSION_DENIED") ||
                           errorStr.includes("API_KEY_INVALID");
                           
          if (!isPoolKey) {
            // If the student provided their own API Key, fail immediately without waiting or retrying
            throw apiErr;
          }

          if (isPoolKey && isLeaked) {
            markApiKeyAsBad(apiKeyUsed);
            // If we hit a bad key, retry immediately without wait
            continue;
          }
          
          if (attempt >= maxRetries) throw apiErr;
          const backoffTime = Math.pow(2, Math.min(attempt, 4)) * 1000;
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
