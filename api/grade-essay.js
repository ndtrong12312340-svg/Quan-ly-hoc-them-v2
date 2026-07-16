const GEMINI_API_KEYS_POOL = [
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
const badApiKeys = new Set();

function getNextApiKey(studentApiKey) {
  if (studentApiKey && studentApiKey.trim()) {
    return { key: studentApiKey.trim(), isFromPool: false };
  }
  
  const availableKeys = GEMINI_API_KEYS_POOL.filter(k => !badApiKeys.has(k));
  if (availableKeys.length === 0) {
    const envKey = process.env.GEMINI_API_KEY || "";
    return { key: envKey.trim(), isFromPool: false };
  }
  
  const index = currentKeyIndex % availableKeys.length;
  const key = availableKeys[index];
  currentKeyIndex = (currentKeyIndex + 1) % availableKeys.length;
  return { key, isFromPool: true };
}

async function runOCR(apiKey, base64Image, imageType) {
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

  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`OCR API failed: ${response.status} - ${errText}`);
  }

  const result = await response.json();
  return result.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || "";
}

export default async function handler(req, res) {
  // CORS setup for Vercel
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { submission, essay, studentApiKey } = req.body;
    if (!submission || !essay) {
      return res.status(400).json({ error: "Thiếu dữ liệu bài làm hoặc đề bài." });
    }

    console.log(`[Vercel Serverless AI] Bắt đầu chấm bài "${essay.title}"...`);

    // 1. OCR Đề bài
    let problemText = `Tiêu đề: ${essay.title}\nMô tả: ${essay.description || "Không có mô tả"}\n`;
    if (essay.assignmentImages && essay.assignmentImages.length > 0) {
      try {
        const { key } = getNextApiKey(studentApiKey);
        const ocrResults = await Promise.all(
          essay.assignmentImages.map((img) => runOCR(key, img, 'general'))
        );
        problemText += "\nNội dung đề bài từ ảnh:\n" + ocrResults.filter(Boolean).join("\n---\n");
      } catch (err) {
        console.error("[Vercel Serverless AI] Lỗi OCR đề bài:", err);
      }
    }

    // 2. OCR Đáp án giáo viên
    let teacherSolutions = essay.solutionText || "";
    if (essay.solutionImages && essay.solutionImages.length > 0) {
      try {
        const { key } = getNextApiKey(studentApiKey);
        const ocrResults = await Promise.all(
          essay.solutionImages.map((img) => runOCR(key, img, 'teacher_solution'))
        );
        const solutionOcrText = ocrResults.filter(Boolean).join("\n---\n");
        if (teacherSolutions) {
          teacherSolutions += "\n\nNội dung đáp án bổ sung từ ảnh:\n" + solutionOcrText;
        } else {
          teacherSolutions = solutionOcrText;
        }
      } catch (err) {
        console.error("[Vercel Serverless AI] Lỗi OCR đáp án:", err);
      }
    }

    // 3. OCR Bài làm học sinh
    let studentAnswer = submission.text || "";
    if (submission.images && submission.images.length > 0) {
      try {
        const { key } = getNextApiKey(studentApiKey);
        const ocrResults = await Promise.all(
          submission.images.map((img) => runOCR(key, img, 'student_work'))
        );
        const studentOcrText = ocrResults.filter(Boolean).join("\n---\n");
        if (studentAnswer) {
          studentAnswer += "\n\nNội dung bài làm bổ sung từ ảnh:\n" + studentOcrText;
        } else {
          studentAnswer = studentOcrText;
        }
      } catch (err) {
        console.error("[Vercel Serverless AI] Lỗi OCR bài làm:", err);
      }
    }

    // 4. Tiến hành chấm điểm chi tiết
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
- KHÔNG sử dụng các đoạn mã LaTeX thô hoặc phức tạp (như \\frac, \\sqrt, \\alpha, \\beta, \\Rightarrow, v.v.).
- Thay vào đó, hãy viết công thức toán học một cách trực quan, đẹp mắt và dễ hiểu bằng các ký tự unicode toán học thông thường (ví dụ: dùng x², y³, √x, π, ±, ≥, ≤, ≠, dấu chia / hoặc phân số dạng a/b, v.v.). Học sinh và giáo viên cần đọc được ngay trực tiếp mà không cần hệ thống biên dịch mã LaTeX.

LƯU Ý CUỐI:
- KHÔNG liệt kê lại các bước làm đúng.
- KHÔNG cần cung cấp đáp án chuẩn hay giải chi tiết của đề bài trong phần đánh giá này.
- Tập trung vào việc chỉ ra lỗi sai để học sinh sửa.`;

    let responseJson = null;
    let attempt = 0;
    const maxRetries = 10;
    while (attempt < maxRetries) {
      let apiKeyUsed = "";
      let isPoolKey = false;
      try {
        const { key, isFromPool } = getNextApiKey(studentApiKey);
        apiKeyUsed = key;
        isPoolKey = isFromPool;

        if (!apiKeyUsed) {
          throw new Error("Chưa cấu hình API Key.");
        }

        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKeyUsed}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{ parts: [{ text: gradingPrompt }] }]
          })
        });

        if (!response.ok) {
          const errText = await response.text();
          throw new Error(`Grading API failed: ${response.status} - ${errText}`);
        }

        responseJson = await response.json();
        break;
      } catch (apiErr) {
        attempt++;
        const errorMsg = apiErr.message || String(apiErr);
        console.error(`[Vercel Serverless AI] Chấm điểm lần ${attempt}/${maxRetries} thất bại:`, errorMsg);
        
        const isLeakedOrInvalid = errorMsg.includes("leaked") || 
                                  errorMsg.includes("PERMISSION_DENIED") || 
                                  errorMsg.includes("API key not valid") || 
                                  errorMsg.includes("403") ||
                                  errorMsg.includes("INVALID_ARGUMENT");
                                  
        if (!isPoolKey || !isLeakedOrInvalid) {
          throw apiErr;
        }
        
        if (isPoolKey && isLeakedOrInvalid) {
          badApiKeys.add(apiKeyUsed);
        }
      }
    }

    const aiFeedback = responseJson?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || "";
    if (!aiFeedback) {
      throw new Error("Không nhận được phản hồi chấm điểm từ AI.");
    }

    // Parse score y hệt như server.ts
    let score = 0;
    const scoreMatch = aiFeedback.match(/(?:TỔNG ĐIỂM|Tổng điểm|Score|SCORE):\s*([\d.,]+)\s*\/\s*10/i);
    if (scoreMatch) {
      score = parseFloat(scoreMatch[1].replace(',', '.'));
    } else {
      const altScoreMatch = aiFeedback.match(/(?:Điểm|Điểm số|Score):\s*([\d.,]+)/i);
      if (altScoreMatch) {
        score = parseFloat(altScoreMatch[1].replace(',', '.'));
      }
    }

    if (isNaN(score) || score < 0 || score > 10) {
      score = 0;
    }

    return res.status(200).json({ aiFeedback, score });
  } catch (err) {
    console.error("[Vercel Serverless AI] Lỗi nghiêm trọng:", err);
    return res.status(500).json({ error: err.message || "Lỗi xử lý chấm điểm AI phía máy chủ Vercel." });
  }
}
