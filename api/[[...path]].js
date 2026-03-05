import { createClient } from "@vercel/kv";

// ============================================
// KV Client
// ============================================
const getKV = () => createClient({
  url: process.env.KV_REST_API_URL,
  token: process.env.KV_REST_API_TOKEN,
});

// ============================================
// Helper — جيب بيانات البوت من KV
// ============================================
async function getBot(botId) {
  try {
    const kv = getKV();
    const bot = await kv.get(`bot:${botId}`);
    return bot;
  } catch {
    return null;
  }
}

// ============================================
// Helper — تحقق من الـ Admin Token
// ============================================
function isAuthorized(req) {
  const auth = req.headers["x-admin-token"];
  return auth === process.env.ADMIN_PASSWORD;
}

export default async function handler(req, res) {
  const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;
  const url = new URL(req.url, `https://${req.headers.host}`);
  const path = url.pathname;

  // ============================================
  // 🔐 ADMIN — تسجيل الدخول
  // POST /api/auth
  // ============================================
  if (path === "/api/auth") {
    if (req.method !== "POST") return res.status(405).end();
    const { password } = req.body;
    if (password === ADMIN_PASSWORD) {
      return res.status(200).json({ ok: true, token: ADMIN_PASSWORD });
    }
    return res.status(401).json({ ok: false, error: "❌ باسورد غلط" });
  }

  // ============================================
  // 🤖 ADMIN — جيب كل البوتات
  // GET /api/bots
  // ============================================
  if (path === "/api/bots" && req.method === "GET") {
    if (!isAuthorized(req)) return res.status(401).json({ error: "Unauthorized" });
    try {
      const kv = getKV();
      const keys = await kv.keys("bot:*");
      const bots = await Promise.all(keys.map(async (key) => {
        const bot = await kv.get(key);
        return { id: key.replace("bot:", ""), ...bot };
      }));
      return res.status(200).json({ ok: true, bots });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }

  // ============================================
  // 🤖 ADMIN — ضيف أو عدل بوت
  // POST /api/bots
  // ============================================
  if (path === "/api/bots" && req.method === "POST") {
    if (!isAuthorized(req)) return res.status(401).json({ error: "Unauthorized" });
    const { id, name, token, webhookUrl } = req.body;
    if (!id || !token || !webhookUrl) {
      return res.status(400).json({ error: "❌ id و token و webhookUrl مطلوبين" });
    }
    try {
      const kv = getKV();
      await kv.set(`bot:${id}`, { name: name || id, token, webhookUrl, createdAt: Date.now() });

      // اعمل setWebhook تلقائي
      const proxyUrl = `https://${req.headers.host}/api/webhook/${id}`;
      const tgRes = await fetch(`https://api.telegram.org/bot${token}/setWebhook?url=${proxyUrl}`);
      const tgData = await tgRes.json();

      return res.status(200).json({ ok: true, webhookSet: tgData });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }

  // ============================================
  // 🤖 ADMIN — احذف بوت
  // DELETE /api/bots?id=xxx
  // ============================================
  if (path === "/api/bots" && req.method === "DELETE") {
    if (!isAuthorized(req)) return res.status(401).json({ error: "Unauthorized" });
    const id = url.searchParams.get("id");
    if (!id) return res.status(400).json({ error: "❌ id مطلوب" });
    try {
      const kv = getKV();
      const bot = await getBot(id);
      if (bot) {
        // شيل الـ Webhook من Telegram
        await fetch(`https://api.telegram.org/bot${bot.token}/deleteWebhook`);
      }
      await kv.del(`bot:${id}`);
      return res.status(200).json({ ok: true });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }

  // ============================================
  // 1️⃣ استقبال من Telegram وتوجيهه لـ n8n
  // POST /api/webhook/:botId
  // ============================================
  if (path.startsWith("/api/webhook/")) {
    if (req.method !== "POST") {
      return res.status(200).json({ status: "🟢 Webhook ready" });
    }

    const botId = path.replace("/api/webhook/", "");
    const bot = await getBot(botId);

    if (!bot) {
      console.error(`❌ Bot not found: ${botId}`);
      return res.status(200).json({ ok: true }); // 200 دايماً لـ Telegram
    }

    const body = req.body;
    console.log(`📨 [${botId}] Telegram → n8n:`, JSON.stringify(body));

    try {
      const n8nResponse = await fetch(bot.webhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(55000),
      });
      const n8nData = await n8nResponse.text();
      console.log(`✅ [${botId}] n8n Response [${n8nResponse.status}]:`, n8nData);
    } catch (err) {
      console.error(`❌ [${botId}] Forward to n8n failed:`, err.message);
    }

    return res.status(200).json({ ok: true });
  }

  // ============================================
  // 2️⃣ إرسال من n8n → Telegram API
  // POST /api/telegram/:botId?method=sendMessage
  // ============================================
  if (path.startsWith("/api/telegram/")) {
    if (req.method !== "POST") {
      return res.status(200).json({ status: "🟢 Telegram endpoint ready" });
    }

    const botId = path.replace("/api/telegram/", "");
    const bot = await getBot(botId);

    if (!bot) return res.status(404).json({ error: `❌ Bot '${botId}' not found` });

    const method = url.searchParams.get("method") || "sendMessage";
    const body = req.body;

    try {
      console.log(`📤 [${botId}] n8n → Telegram [${method}]`);
      const tgResponse = await fetch(`https://api.telegram.org/bot${bot.token}/${method}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const tgData = await tgResponse.json();
      console.log(`✅ [${botId}] Telegram Response:`, JSON.stringify(tgData));
      return res.status(200).json(tgData);
    } catch (err) {
      console.error(`❌ [${botId}] Telegram error:`, err.message);
      return res.status(500).json({ ok: false, error: err.message });
    }
  }

  // ============================================
  // 3️⃣ تحميل ملف من Telegram
  // GET /api/file/:botId?file_id=xxx
  // ============================================
  if (path.startsWith("/api/file/")) {
    if (req.method !== "GET") return res.status(405).end();

    const botId = path.replace("/api/file/", "");
    const bot = await getBot(botId);
    if (!bot) return res.status(404).json({ error: `❌ Bot '${botId}' not found` });

    const file_id = url.searchParams.get("file_id");
    if (!file_id) return res.status(400).json({ error: "❌ file_id مطلوب" });

    try {
      const TELEGRAM_API = `https://api.telegram.org/bot${bot.token}`;
      const getFileRes = await fetch(`${TELEGRAM_API}/getFile`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ file_id }),
      });
      const getFileData = await getFileRes.json();
      if (!getFileData.ok) return res.status(400).json({ error: "❌ getFile failed", details: getFileData });

      const file_path = getFileData.result.file_path;
      const fileRes = await fetch(`https://api.telegram.org/file/bot${bot.token}/${file_path}`);
      if (!fileRes.ok) return res.status(500).json({ error: "❌ Download failed" });

      const ext = file_path.split(".").pop().toLowerCase();
      const mimeTypes = {
        mp4: "video/mp4", mov: "video/quicktime",
        mp3: "audio/mpeg", ogg: "audio/ogg", m4a: "audio/mp4", wav: "audio/wav",
        jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", gif: "image/gif", webp: "image/webp",
        pdf: "application/pdf", zip: "application/zip", json: "application/json",
      };
      const contentType = mimeTypes[ext] || "application/octet-stream";
      const fileName = file_path.split("/").pop();
      const fileBuffer = await fileRes.arrayBuffer();

      res.setHeader("Content-Type", contentType);
      res.setHeader("Content-Disposition", `attachment; filename="${fileName}"`);
      res.setHeader("X-File-Name", fileName);
      return res.send(Buffer.from(fileBuffer));
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }

  // ============================================
  // 4️⃣ رفع ملف Binary لـ Telegram
  // POST /api/upload/:botId?method=sendDocument&chat_id=xxx
  // ============================================
  if (path.startsWith("/api/upload/")) {
    if (req.method !== "POST") return res.status(405).end();

    const botId = path.replace("/api/upload/", "");
    const bot = await getBot(botId);
    if (!bot) return res.status(404).json({ error: `❌ Bot '${botId}' not found` });

    const method   = url.searchParams.get("method")   || "sendDocument";
    const chat_id  = url.searchParams.get("chat_id");
    const caption  = url.searchParams.get("caption")  || "";
    const filename = url.searchParams.get("filename") || "file";
    const mimetype = url.searchParams.get("mimetype") || "application/octet-stream";

    if (!chat_id) return res.status(400).json({ error: "❌ chat_id مطلوب" });

    try {
      const chunks = [];
      for await (const chunk of req) chunks.push(chunk);
      const fileBuffer = Buffer.concat(chunks);

      const fieldNames = {
        sendDocument: "document", sendPhoto: "photo", sendVideo: "video",
        sendAudio: "audio", sendVoice: "voice", sendAnimation: "animation",
      };
      const fieldName = fieldNames[method] || "document";

      const formData = new FormData();
      formData.append("chat_id", chat_id);
      if (caption) formData.append("caption", caption);
      formData.append(fieldName, new Blob([fileBuffer], { type: mimetype }), filename);

      const tgResponse = await fetch(`https://api.telegram.org/bot${bot.token}/${method}`, {
        method: "POST",
        body: formData,
      });
      const tgData = await tgResponse.json();
      return res.status(200).json(tgData);
    } catch (err) {
      return res.status(500).json({ ok: false, error: err.message });
    }
  }

  // ============================================
  // Health Check
  // ============================================
  if (path === "/" || path === "") {
    return res.status(200).json({
      status: "🟢 Proxy is running",
      version: "2.0.0",
      admin: "/admin",
      kv: process.env.KV_REST_API_URL ? "✅ Connected" : "❌ Missing",
    });
  }

  return res.status(404).json({ error: "Not found" });
}
