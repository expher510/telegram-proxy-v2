import { createClient } from "@vercel/kv";

const getKV = () => createClient({
  url: process.env.KV_REST_API_URL,
  token: process.env.KV_REST_API_TOKEN,
});

async function getBot(botId) {
  try {
    const kv = getKV();
    return await kv.get(`bot:${botId}`);
  } catch { return null; }
}

function isAuthorized(req) {
  return req.headers["x-admin-token"] === process.env.ADMIN_PASSWORD;
}

// ============================================
// Admin Panel HTML
// ============================================
const ADMIN_HTML = `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Telegram Proxy — Admin</title>
<link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;900&family=IBM+Plex+Mono:wght@400;600&display=swap" rel="stylesheet">
<style>
  :root { --bg:#030712;--surface:#0d1117;--border:#1e2a3a;--accent:#00ff87;--blue:#4da6ff;--red:#ff4d4d;--text:#e2e8f0;--muted:#4a5568; }
  *{margin:0;padding:0;box-sizing:border-box}
  body{background:var(--bg);color:var(--text);font-family:'Cairo',sans-serif;min-height:100vh}
  #login-screen{min-height:100vh;display:flex;align-items:center;justify-content:center;background:radial-gradient(ellipse at center,rgba(0,255,135,0.05) 0%,transparent 70%)}
  .login-box{background:var(--surface);border:1px solid var(--border);border-radius:20px;padding:2.5rem;width:100%;max-width:420px;text-align:center}
  .login-box h1{font-size:1.8rem;font-weight:900;background:linear-gradient(135deg,var(--accent),var(--blue));-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text;margin-bottom:.5rem}
  .login-box p{color:var(--muted);font-size:.85rem;margin-bottom:2rem}
  input{width:100%;background:var(--bg);border:1px solid var(--border);border-radius:10px;padding:.8rem 1rem;color:var(--text);font-family:'Cairo',sans-serif;font-size:.9rem;margin-bottom:1rem;outline:none;transition:border-color .2s;text-align:right}
  input:focus{border-color:var(--accent)}
  input::placeholder{color:var(--muted)}
  button{width:100%;padding:.9rem;border:none;border-radius:10px;font-family:'Cairo',sans-serif;font-size:1rem;font-weight:700;cursor:pointer;transition:all .2s}
  .btn-primary{background:linear-gradient(135deg,var(--accent),#00cc6a);color:#000}
  .btn-primary:hover{opacity:.9;transform:translateY(-1px)}
  .btn-danger{background:rgba(255,77,77,.1);border:1px solid rgba(255,77,77,.3);color:var(--red);width:auto;padding:.5rem 1rem;font-size:.85rem}
  .btn-secondary{background:rgba(77,166,255,.1);border:1px solid rgba(77,166,255,.3);color:var(--blue);width:auto;padding:.5rem 1rem;font-size:.85rem}
  .error-msg{color:var(--red);font-size:.82rem;margin-top:.5rem;display:none}
  #dashboard{display:none}
  .navbar{background:var(--surface);border-bottom:1px solid var(--border);padding:1rem 2rem;display:flex;align-items:center;justify-content:space-between;position:sticky;top:0;z-index:100}
  .navbar-brand{font-weight:900;font-size:1.2rem;background:linear-gradient(135deg,var(--accent),var(--blue));-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text}
  .navbar-status{display:flex;align-items:center;gap:.5rem;font-family:'IBM Plex Mono',monospace;font-size:.75rem;color:var(--accent)}
  .status-dot{width:8px;height:8px;border-radius:50%;background:var(--accent);animation:pulse 1.5s infinite}
  @keyframes pulse{0%,100%{opacity:1}50%{opacity:.4}}
  .btn-logout{background:transparent;border:1px solid var(--border);color:var(--muted);width:auto;padding:.4rem 1rem;font-size:.8rem;border-radius:8px}
  .btn-logout:hover{border-color:var(--red);color:var(--red)}
  .main{max-width:900px;margin:0 auto;padding:2rem}
  .add-form{background:var(--surface);border:1px solid var(--border);border-radius:16px;padding:1.5rem;margin-bottom:2rem;position:relative}
  .add-form::before{content:'';position:absolute;top:0;left:0;right:0;height:2px;background:linear-gradient(90deg,var(--accent),transparent);border-radius:16px 16px 0 0}
  .form-title{font-weight:700;font-size:1rem;margin-bottom:1.2rem}
  .form-grid{display:grid;grid-template-columns:1fr 1fr;gap:.8rem;margin-bottom:.8rem}
  .form-grid input{margin-bottom:0}
  .form-full{grid-column:1/-1}
  .section-title{font-family:'IBM Plex Mono',monospace;font-size:.7rem;letter-spacing:3px;text-transform:uppercase;color:var(--muted);margin-bottom:1rem}
  .bot-card{background:var(--surface);border:1px solid var(--border);border-radius:14px;padding:1.2rem 1.5rem;margin-bottom:.8rem;transition:all .2s;animation:fadeIn .3s ease}
  @keyframes fadeIn{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)}}
  .bot-card:hover{border-color:rgba(0,255,135,.2)}
  .bot-header{display:flex;align-items:center;justify-content:space-between;margin-bottom:.8rem}
  .bot-name{font-weight:700;font-size:1rem;display:flex;align-items:center;gap:.5rem}
  .bot-id{font-family:'IBM Plex Mono',monospace;font-size:.7rem;background:rgba(0,255,135,.1);color:var(--accent);padding:2px 8px;border-radius:4px}
  .bot-actions{display:flex;gap:.5rem}
  .bot-urls{display:flex;flex-direction:column;gap:.4rem}
  .bot-url{display:flex;align-items:center;gap:.5rem;font-family:'IBM Plex Mono',monospace;font-size:.72rem;background:var(--bg);border:1px solid var(--border);border-radius:8px;padding:.5rem .8rem}
  .url-label{color:var(--muted);white-space:nowrap;min-width:80px}
  .url-value{color:var(--accent);word-break:break-all;flex:1}
  .copy-btn{background:transparent;border:none;color:var(--muted);cursor:pointer;padding:2px 6px;border-radius:4px;font-size:.75rem;width:auto;transition:color .2s}
  .copy-btn:hover,.copy-btn.copied{color:var(--accent)}
  .empty-state{text-align:center;padding:3rem;color:var(--muted);font-size:.9rem}
  .toast{position:fixed;bottom:2rem;left:50%;transform:translateX(-50%) translateY(100px);background:var(--surface);border:1px solid var(--accent);color:var(--accent);padding:.8rem 1.5rem;border-radius:10px;font-size:.85rem;font-family:'IBM Plex Mono',monospace;transition:transform .3s;z-index:999}
  .toast.show{transform:translateX(-50%) translateY(0)}
</style>
</head>
<body>
<div id="login-screen">
  <div class="login-box">
    <h1>📡 Telegram Proxy</h1>
    <p>Admin Panel — ادخل الباسورد عشان تكمل</p>
    <input type="password" id="password-input" placeholder="الباسورد" />
    <button class="btn-primary" onclick="login()">دخول</button>
    <div class="error-msg" id="login-error">❌ باسورد غلط</div>
  </div>
</div>
<div id="dashboard">
  <nav class="navbar">
    <div class="navbar-brand">📡 Telegram Proxy</div>
    <div class="navbar-status"><div class="status-dot"></div>ONLINE</div>
    <button class="btn-logout" onclick="logout()">خروج</button>
  </nav>
  <div class="main">
    <div class="add-form">
      <div class="form-title">➕ ضيف بوت جديد</div>
      <div class="form-grid">
        <input type="text" id="bot-id" placeholder="Bot ID (بدون مسافات مثلاً: mybot)" />
        <input type="text" id="bot-name" placeholder="اسم البوت (اختياري)" />
        <input type="text" id="bot-token" placeholder="Telegram Token من BotFather" class="form-full" />
        <input type="text" id="bot-webhook" placeholder="n8n Webhook URL" class="form-full" />
      </div>
      <button class="btn-primary" onclick="addBot()">حفظ وتفعيل الـ Webhook ✅</button>
    </div>
    <div class="section-title">// البوتات المضافة</div>
    <div id="bots-list"><div class="empty-state">جاري التحميل...</div></div>
  </div>
</div>
<div class="toast" id="toast"></div>
<script>
  let TOKEN = "";
  const HOST = window.location.origin;
  async function login() {
    const password = document.getElementById("password-input").value;
    try {
      const res = await fetch("/api/auth", { method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({password}) });
      const data = await res.json();
      if (data.ok) {
        TOKEN = data.token;
        document.getElementById("login-screen").style.display = "none";
        document.getElementById("dashboard").style.display = "block";
        loadBots();
      } else { document.getElementById("login-error").style.display = "block"; }
    } catch { document.getElementById("login-error").style.display = "block"; }
  }
  document.getElementById("password-input").addEventListener("keydown", e => { if(e.key==="Enter") login(); });
  function logout() {
    TOKEN = "";
    document.getElementById("login-screen").style.display = "flex";
    document.getElementById("dashboard").style.display = "none";
    document.getElementById("password-input").value = "";
  }
  async function loadBots() {
    try {
      const res = await fetch("/api/bots", { headers:{"x-admin-token":TOKEN} });
      const data = await res.json();
      renderBots(data.bots || []);
    } catch { renderBots([]); }
  }
  function renderBots(bots) {
    const c = document.getElementById("bots-list");
    if (!bots.length) { c.innerHTML = '<div class="empty-state">🤖 مفيش بوتات لسه — ضيف أول بوت!</div>'; return; }
    c.innerHTML = bots.map(bot => \`
      <div class="bot-card">
        <div class="bot-header">
          <div class="bot-name">🤖 \${bot.name||bot.id} <span class="bot-id">\${bot.id}</span></div>
          <div class="bot-actions">
            <button class="btn-secondary" onclick="copyAll('\${bot.id}')">نسخ الـ URLs</button>
            <button class="btn-danger" onclick="deleteBot('\${bot.id}')">حذف</button>
          </div>
        </div>
        <div class="bot-urls">
          <div class="bot-url"><span class="url-label">Webhook</span><span class="url-value" id="w-\${bot.id}">\${HOST}/api/webhook/\${bot.id}</span><button class="copy-btn" onclick="copyUrl('w-\${bot.id}',this)">📋</button></div>
          <div class="bot-url"><span class="url-label">Send MSG</span><span class="url-value" id="s-\${bot.id}">\${HOST}/api/telegram/\${bot.id}?method=sendMessage</span><button class="copy-btn" onclick="copyUrl('s-\${bot.id}',this)">📋</button></div>
          <div class="bot-url"><span class="url-label">File DL</span><span class="url-value" id="f-\${bot.id}">\${HOST}/api/file/\${bot.id}?file_id=FILE_ID</span><button class="copy-btn" onclick="copyUrl('f-\${bot.id}',this)">📋</button></div>
          <div class="bot-url"><span class="url-label">Upload</span><span class="url-value" id="u-\${bot.id}">\${HOST}/api/upload/\${bot.id}?method=sendDocument&chat_id=CHAT_ID&filename=file.json&mimetype=application/json</span><button class="copy-btn" onclick="copyUrl('u-\${bot.id}',this)">📋</button></div>
        </div>
      </div>
    \`).join("");
  }
  async function addBot() {
    const id = document.getElementById("bot-id").value.trim();
    const name = document.getElementById("bot-name").value.trim();
    const token = document.getElementById("bot-token").value.trim();
    const webhookUrl = document.getElementById("bot-webhook").value.trim();
    if (!id||!token||!webhookUrl) { showToast("❌ ملي كل الحقول المطلوبة"); return; }
    try {
      const res = await fetch("/api/bots", { method:"POST", headers:{"Content-Type":"application/json","x-admin-token":TOKEN}, body:JSON.stringify({id,name,token,webhookUrl}) });
      const data = await res.json();
      if (data.ok) {
        showToast("✅ البوت اتضاف والـ Webhook اتفعّل!");
        ["bot-id","bot-name","bot-token","bot-webhook"].forEach(id => document.getElementById(id).value="");
        loadBots();
      } else { showToast("❌ "+(data.error||"حصل خطأ")); }
    } catch(err) { showToast("❌ "+err.message); }
  }
  async function deleteBot(id) {
    if (!confirm('هتحذف البوت "'+id+'"؟')) return;
    try {
      const res = await fetch("/api/bots?id="+id, { method:"DELETE", headers:{"x-admin-token":TOKEN} });
      const data = await res.json();
      if (data.ok) { showToast("🗑️ البوت اتحذف"); loadBots(); }
    } catch(err) { showToast("❌ "+err.message); }
  }
  function copyUrl(eid, btn) {
    navigator.clipboard.writeText(document.getElementById(eid).textContent);
    btn.textContent="✅"; btn.classList.add("copied");
    setTimeout(()=>{btn.textContent="📋";btn.classList.remove("copied")},2000);
  }
  function copyAll(botId) {
    const urls = ["Webhook: "+HOST+"/api/webhook/"+botId,"Send: "+HOST+"/api/telegram/"+botId+"?method=sendMessage","File: "+HOST+"/api/file/"+botId+"?file_id=FILE_ID","Upload: "+HOST+"/api/upload/"+botId+"?method=sendDocument&chat_id=CHAT_ID"].join("\\n");
    navigator.clipboard.writeText(urls);
    showToast("📋 كل الـ URLs اتنسخوا!");
  }
  function showToast(msg) {
    const t = document.getElementById("toast");
    t.textContent=msg; t.classList.add("show");
    setTimeout(()=>t.classList.remove("show"),3000);
  }
</script>
</body>
</html>`;

export default async function handler(req, res) {
  const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;
  const url = new URL(req.url, `https://${req.headers.host}`);
  const path = url.pathname;

  // ============================================
  // Admin Panel UI
  // ============================================
  if (path === "/admin") {
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    return res.status(200).send(ADMIN_HTML);
  }

  // ============================================
  // Auth
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
      const proxyUrl = `https://${req.headers.host}/api/webhook/${id}`;
      const tgRes = await fetch(`https://api.telegram.org/bot${token}/setWebhook?url=${proxyUrl}`);
      const tgData = await tgRes.json();
      return res.status(200).json({ ok: true, webhookSet: tgData });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }

  // ============================================
  // DELETE /api/bots
  // ============================================
  if (path === "/api/bots" && req.method === "DELETE") {
    if (!isAuthorized(req)) return res.status(401).json({ error: "Unauthorized" });
    const id = url.searchParams.get("id");
    if (!id) return res.status(400).json({ error: "❌ id مطلوب" });
    try {
      const kv = getKV();
      const bot = await getBot(id);
      if (bot) await fetch(`https://api.telegram.org/bot${bot.token}/deleteWebhook`);
      await kv.del(`bot:${id}`);
      return res.status(200).json({ ok: true });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }

  // ============================================
  // POST /api/webhook/:botId
  // ============================================
  if (path.startsWith("/api/webhook/")) {
    if (req.method !== "POST") return res.status(200).json({ status: "🟢 ready" });
    const botId = path.replace("/api/webhook/", "");
    const bot = await getBot(botId);
    if (!bot) return res.status(200).json({ ok: true });
    const body = req.body;
    console.log(`📨 [${botId}] Telegram → n8n`);
    try {
      const n8nRes = await fetch(bot.webhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(55000),
      });
      console.log(`✅ [${botId}] n8n ${n8nRes.status}`);
    } catch (err) {
      console.error(`❌ [${botId}]`, err.message);
    }
    return res.status(200).json({ ok: true });
  }

  // ============================================
  // POST /api/telegram/:botId
  // ============================================
  if (path.startsWith("/api/telegram/")) {
    if (req.method !== "POST") return res.status(200).json({ status: "🟢 ready" });
    const botId = path.replace("/api/telegram/", "");
    const bot = await getBot(botId);
    if (!bot) return res.status(404).json({ error: `❌ Bot '${botId}' not found` });
    const method = url.searchParams.get("method") || "sendMessage";
    try {
      const tgRes = await fetch(`https://api.telegram.org/bot${bot.token}/${method}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(req.body),
      });
      return res.status(200).json(await tgRes.json());
    } catch (err) {
      return res.status(500).json({ ok: false, error: err.message });
    }
  }

  // ============================================
  // GET /api/file/:botId
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
      const getFileData = await (await fetch(`${TELEGRAM_API}/getFile`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ file_id }),
      })).json();
      if (!getFileData.ok) return res.status(400).json({ error: "❌ getFile failed" });
      const file_path = getFileData.result.file_path;
      const fileRes = await fetch(`https://api.telegram.org/file/bot${bot.token}/${file_path}`);
      if (!fileRes.ok) return res.status(500).json({ error: "❌ Download failed" });
      const mimeTypes = { mp4:"video/mp4",ogg:"audio/ogg",mp3:"audio/mpeg",jpg:"image/jpeg",jpeg:"image/jpeg",png:"image/png",gif:"image/gif",webp:"image/webp",pdf:"application/pdf",json:"application/json",zip:"application/zip" };
      const ext = file_path.split(".").pop().toLowerCase();
      const contentType = mimeTypes[ext] || "application/octet-stream";
      const fileName = file_path.split("/").pop();
      const buf = await fileRes.arrayBuffer();
      res.setHeader("Content-Type", contentType);
      res.setHeader("Content-Disposition", `attachment; filename="${fileName}"`);
      return res.send(Buffer.from(buf));
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }

  // ============================================
  // POST /api/upload/:botId
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
      const fieldNames = { sendDocument:"document",sendPhoto:"photo",sendVideo:"video",sendAudio:"audio",sendVoice:"voice",sendAnimation:"animation" };
      const formData = new FormData();
      formData.append("chat_id", chat_id);
      if (caption) formData.append("caption", caption);
      formData.append(fieldNames[method]||"document", new Blob([fileBuffer],{type:mimetype}), filename);
      const tgRes = await fetch(`https://api.telegram.org/bot${bot.token}/${method}`, { method:"POST", body:formData });
      return res.status(200).json(await tgRes.json());
    } catch (err) {
      return res.status(500).json({ ok: false, error: err.message });
    }
  }

  // ============================================
  // Health Check
  // ============================================
  return res.status(200).json({
    status: "🟢 Proxy v2 running",
    admin: "/admin",
    kv: process.env.KV_REST_API_URL ? "✅ Connected" : "❌ Missing",
  });
}
