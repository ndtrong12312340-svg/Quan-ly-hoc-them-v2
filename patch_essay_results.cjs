const fs = require('fs');
let code = fs.readFileSync('src/pages/EssayResults.tsx', 'utf8');

const target = `    if (!process.env.GEMINI_API_KEY) {
      setGradingError('Tính năng chấm điểm AI yêu cầu cấu hình GEMINI_API_KEY');
      return;
    }
    setIsGrading(true);
    setGradingError('');
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      
      let contents = [];
      contents.push({
        text: \`Bạn là một giáo viên chuyên môn cao. Hãy chấm điểm bài làm tự luận của học sinh.
        Đề bài gồm các hình ảnh đề và đáp án mẫu được giao.
        Bài làm của học sinh gồm các hình ảnh (ảnh chụp chữ viết tay hoặc bài làm).
        Hãy phân tích từng ảnh bài làm, nhận diện lỗi sai (nếu có), giải thích chi tiết, và cho điểm tổng quát trên thang điểm 10.
        Trả về kết quả dưới dạng Markdown gồm 2 phần:
        1. Nhận xét chi tiết (chỉ ra lỗi sai, ưu điểm)
        2. Điểm số (ví dụ: 8.5/10)\`
      });

      // Thêm hình ảnh đề bài
      if (essay.assignmentImages) {
        essay.assignmentImages.forEach((imgBase64: string, idx: number) => {
          const match = imgBase64.match(/^data:(image\\/[a-z]+);base64,(.+)$/);
          if (match) {
             contents.push({ text: \`Hình ảnh đề bài \${idx+1}:\` });
             contents.push({
                inlineData: {
                  mimeType: match[1],
                  data: match[2]
                }
             });
          }
        });
      }
      
      // Thêm hình ảnh đáp án
      if (essay.solutionImages) {
        essay.solutionImages.forEach((imgBase64: string, idx: number) => {
          const match = imgBase64.match(/^data:(image\\/[a-z]+);base64,(.+)$/);
          if (match) {
             contents.push({ text: \`Hình ảnh đáp án mẫu \${idx+1}:\` });
             contents.push({
                inlineData: {
                  mimeType: match[1],
                  data: match[2]
                }
             });
          }
        });
      }

      // Thêm bài làm
      if (submission.images) {
        submission.images.forEach((imgBase64: string, idx: number) => {
          const match = imgBase64.match(/^data:(image\\/[a-z]+);base64,(.+)$/);
          if (match) {
             contents.push({ text: \`Hình ảnh bài làm của học sinh \${idx+1}:\` });
             contents.push({
                inlineData: {
                  mimeType: match[1],
                  data: match[2]
                }
             });
          }
        });
      }

      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: contents
      });

      if (!response.text) throw new Error("AI không trả về kết quả.");

      const aiFeedback = response.text;
      
      // Try to parse a score out of the feedback if possible, or just default to 0
      let scoreMatch = aiFeedback.match(/(\\d+(\\.\\d+)?)\\/10/);
      let score = scoreMatch ? parseFloat(scoreMatch[1]) : 0;`;

const replacement = `    setIsGrading(true);
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

      const { aiFeedback, score } = await res.json();`;

if (code.includes('if (!process.env.GEMINI_API_KEY)')) {
    code = code.replace(target, replacement);
}

fs.writeFileSync('src/pages/EssayResults.tsx', code);
console.log("Patched EssayResults.tsx");
