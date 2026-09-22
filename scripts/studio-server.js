const fs = require("fs");
const http = require("http");
const path = require("path");
const crypto = require("crypto");
const { spawn } = require("child_process");
const { collectCourses, loadPosts, postUrl, renderPost } = require("./build");

const root = process.cwd();
const studioDir = path.join(root, "latex-studio");
const postsDir = path.join(root, "posts");
const assetsDir = path.join(root, "assets");
const templatesDir = path.join(studioDir, "templates");
const buildDir = path.join(root, ".latex-studio-build");
const host = process.env.STUDIO_HOST || "127.0.0.1";
const port = Number(process.env.STUDIO_PORT || 4317);
const maxBodyBytes = 8 * 1024 * 1024;
const activeCompiles = new Map();

const mimeTypes = {
  ".css": "text/css; charset=utf-8",
  ".gif": "image/gif",
  ".html": "text/html; charset=utf-8",
  ".ico": "image/x-icon",
  ".jpeg": "image/jpeg",
  ".jpg": "image/jpeg",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".pdf": "application/pdf",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".webp": "image/webp"
};

function normalizeRelative(value) {
  return String(value || "").replace(/\\/g, "/").replace(/^\/+/, "");
}

function safeInside(base, relative, extension) {
  const normalized = normalizeRelative(relative);
  const target = path.resolve(base, normalized);
  const relativeTarget = path.relative(base, target);
  if (!normalized || relativeTarget.startsWith("..") || path.isAbsolute(relativeTarget)) {
    throw new Error("路径不在允许的目录中。");
  }
  if (extension && path.extname(target).toLowerCase() !== extension) {
    throw new Error(`只支持 ${extension} 文件。`);
  }
  return target;
}

function walkTex(dir, prefix = "") {
  if (!fs.existsSync(dir)) return [];
  const entries = fs.readdirSync(dir, { withFileTypes: true })
    .sort((a, b) => a.name.localeCompare(b.name, "zh-CN"));
  const files = [];
  for (const entry of entries) {
    const relative = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.isDirectory()) files.push(...walkTex(path.join(dir, entry.name), relative));
    if (entry.isFile() && entry.name.toLowerCase().endsWith(".tex")) files.push(relative);
  }
  return files;
}

function parseTitle(source, fallback) {
  const metaMatch = source.match(/^%\s*---[\s\S]*?^%\s*title\s*:\s*(.+)$/mi);
  const titleMatch = source.match(/\\title\{([^}]+)\}/);
  return (metaMatch && metaMatch[1].trim()) || (titleMatch && titleMatch[1].trim()) || fallback;
}

function postSummary(relative) {
  const file = safeInside(postsDir, relative, ".tex");
  const source = fs.readFileSync(file, "utf8");
  const stat = fs.statSync(file);
  return {
    path: normalizeRelative(relative),
    title: parseTitle(source, path.basename(relative, ".tex")),
    folder: normalizeRelative(path.dirname(relative)) === "." ? "" : normalizeRelative(path.dirname(relative)),
    fullDocument: /\\documentclass(?:\[[^\]]+\])?\{/.test(source),
    modifiedAt: stat.mtime.toISOString()
  };
}

function templateList() {
  return walkTex(templatesDir).map((relative) => ({
    id: relative,
    name: path.basename(relative, ".tex")
  }));
}

function readJson(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on("data", (chunk) => {
      size += chunk.length;
      if (size > maxBodyBytes) {
        reject(new Error("请求内容过大。"));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", () => {
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}"));
      } catch {
        reject(new Error("JSON 格式不正确。"));
      }
    });
    req.on("error", reject);
  });
}

function json(res, status, value) {
  const body = Buffer.from(JSON.stringify(value));
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": body.length,
    "Cache-Control": "no-store"
  });
  res.end(body);
}

function sendFile(res, file, cache = false) {
  if (!fs.existsSync(file) || !fs.statSync(file).isFile()) {
    json(res, 404, { error: "文件不存在。" });
    return;
  }
  res.writeHead(200, {
    "Content-Type": mimeTypes[path.extname(file).toLowerCase()] || "application/octet-stream",
    "Content-Length": fs.statSync(file).size,
    "Cache-Control": cache ? "public, max-age=3600" : "no-store"
  });
  fs.createReadStream(file).pipe(res);
}

function previewForSource(relative) {
  const source = normalizeRelative(relative);
  const posts = loadPreviewPosts();
  const post = posts.find((item) => normalizeRelative(item.source) === source);
  if (!post) return null;
  const courses = collectCourses(posts);
  let pdfUrl = "";
  let pdfFresh = false;
  if (post.pdf && !/^[a-z]+:\/\//i.test(post.pdf)) {
    const pdfRelative = normalizeRelative(post.pdf);
    const pdfFile = path.join(root, "dist", pdfRelative);
    if (fs.existsSync(pdfFile)) {
      pdfUrl = `/preview/${pdfRelative}`;
      const sourceFile = safeInside(postsDir, relative, ".tex");
      pdfFresh = fs.statSync(pdfFile).mtimeMs >= fs.statSync(sourceFile).mtimeMs;
    }
  }
  return {
    html: renderPreviewPost(post, courses),
    url: `/preview/${postUrl(post)}`,
    pdfUrl,
    pdfFresh
  };
}

function loadPreviewPosts() {
  const posts = loadPosts({ includeDrafts: true });
  for (const post of posts) {
    if (post.pdf) continue;
    const generated = path.join(root, "dist", "assets", `${post.slug}.pdf`);
    if (fs.existsSync(generated)) post.pdf = `assets/${post.slug}.pdf`;
  }
  return posts;
}

function renderPreviewPost(post, courses) {
  const builtFile = path.join(root, "dist", postUrl(post));
  let version = "";
  if (fs.existsSync(builtFile)) {
    const built = fs.readFileSync(builtFile, "utf8");
    const match = built.match(/assets\/styles\.css\?v=([^"&]+)/);
    version = match ? match[1] : "";
  }
  const previous = process.env.GITHUB_SHA;
  if (version) process.env.GITHUB_SHA = version;
  try {
    return renderPost(post, courses);
  } finally {
    if (previous === undefined) delete process.env.GITHUB_SHA;
    else process.env.GITHUB_SHA = previous;
  }
}

function slugify(value) {
  return String(value || "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fff]+/g, "-")
    .replace(/^-+|-+$/g, "") || "new-post";
}

function sourceWithTemplate(source, templateId) {
  if (/\\documentclass(?:\[[^\]]+\])?\{/.test(source)) return source;
  const templateFile = safeInside(templatesDir, templateId || "blog.tex", ".tex");
  const template = fs.readFileSync(templateFile, "utf8");
  if (!template.includes("%% CONTENT %%")) {
    throw new Error("模板中缺少 %% CONTENT %% 占位符。");
  }
  return template.replace("%% CONTENT %%", source);
}

function validCachedPdf(pdfFile) {
  if (!fs.existsSync(pdfFile) || fs.statSync(pdfFile).size < 1024) return null;
  const pdf = fs.readFileSync(pdfFile);
  if (!pdf.subarray(0, 5).equals(Buffer.from("%PDF-"))) return null;
  if (!pdf.subarray(Math.max(0, pdf.length - 2048)).includes(Buffer.from("%%EOF"))) return null;
  return pdf;
}

function compileLatex(relative, source, templateId, force = false) {
  const startedAt = Date.now();
  const compileId = normalizeRelative(relative);
  const fullDocument = /\\documentclass(?:\[[^\]]+\])?\{/.test(source);
  let templateFingerprint = templateId;
  if (!fullDocument) {
    const templateFile = safeInside(templatesDir, templateId || "blog.tex", ".tex");
    templateFingerprint = `${templateId}:${fs.statSync(templateFile).mtimeMs}`;
  }
  const key = crypto.createHash("sha1").update(`${compileId}\0${source}\0${templateFingerprint}`).digest("hex").slice(0, 16);
  const workDir = path.join(buildDir, key);
  fs.mkdirSync(workDir, { recursive: true });
  const texFile = path.join(workDir, "document.tex");
  const pdfFile = path.join(workDir, "document.pdf");
  const logFile = path.join(workDir, "document.log");

  if (!force) {
    const cachedPdf = validCachedPdf(pdfFile);
    if (cachedPdf) {
      const log = fs.existsSync(logFile) ? fs.readFileSync(logFile, "utf8") : "";
      const pageMatch = log.match(/Output written on [\s\S]*?\((\d+) pages?[,)]/i);
      return Promise.resolve({
        ok: true,
        pdf: cachedPdf,
        pageCount: pageMatch ? Number(pageMatch[1]) : null,
        duration: Date.now() - startedAt,
        cached: true
      });
    }
  }

  fs.writeFileSync(texFile, sourceWithTemplate(source, templateId), "utf8");

  const delimiter = process.platform === "win32" ? ";" : ":";
  const texInputs = [assetsDir, root, path.dirname(safeInside(postsDir, relative, ".tex")), ""].join(delimiter);
  const previous = activeCompiles.get(compileId);
  if (previous) previous.kill();

  return new Promise((resolve) => {
    const child = spawn("xelatex", [
    "-interaction=nonstopmode",
    "-halt-on-error",
    "-file-line-error",
    "-output-directory", workDir,
    texFile
  ], {
    cwd: path.dirname(safeInside(postsDir, relative, ".tex")),
    env: { ...process.env, TEXINPUTS: texInputs },
    windowsHide: true
  });
    activeCompiles.set(compileId, child);
    let stdout = "";
    let stderr = "";
    let settled = false;
    const finish = (value) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (activeCompiles.get(compileId) === child) activeCompiles.delete(compileId);
      resolve(value);
    };
    child.stdout.on("data", (chunk) => { stdout += chunk.toString("utf8"); });
    child.stderr.on("data", (chunk) => { stderr += chunk.toString("utf8"); });
    child.on("error", (error) => {
      const message = error.code === "ENOENT"
        ? "未找到 XeLaTeX。请先安装 TeX Live 并将 xelatex 加入 PATH。"
        : error.message;
      finish({ ok: false, error: message, duration: Date.now() - startedAt });
    });
    child.on("close", (status, signal) => {
      if (signal && activeCompiles.get(compileId) !== child) {
        finish({ ok: false, cancelled: true, error: "编译已被更新的内容取代。", duration: Date.now() - startedAt });
        return;
      }
      if (status !== 0 || !fs.existsSync(pdfFile)) {
        const output = `${stdout}\n${stderr}`;
        const important = output.split(/\r?\n/)
          .filter((line) => /^!|^l\.\d+|LaTeX Error|Undefined control sequence|Emergency stop|Fatal error/i.test(line.trim()));
        const fallback = output.split(/\r?\n/).filter(Boolean).slice(-24);
        finish({ ok: false, error: (important.length ? important : fallback).join("\n") || "XeLaTeX 编译失败。", duration: Date.now() - startedAt });
        return;
      }
      const pdf = fs.readFileSync(pdfFile);
      const pageMatch = stdout.match(/Output written on [\s\S]*?\((\d+) pages?[,)]/i);
      finish({
        ok: true,
        pdf,
        pageCount: pageMatch ? Number(pageMatch[1]) : null,
        duration: Date.now() - startedAt,
        cached: false
      });
    });
    const timer = setTimeout(() => {
      child.kill();
      finish({ ok: false, error: "XeLaTeX 编译超过 45 秒，已自动停止。", duration: Date.now() - startedAt });
    }, 45000);
  });
}

async function api(req, res, url) {
  if (req.method === "GET" && url.pathname === "/api/posts") {
    json(res, 200, { posts: walkTex(postsDir).map(postSummary), templates: templateList() });
    return;
  }

  if (req.method === "GET" && url.pathname === "/api/post") {
    const relative = normalizeRelative(url.searchParams.get("path"));
    const file = safeInside(postsDir, relative, ".tex");
    const source = fs.readFileSync(file, "utf8");
    const preview = previewForSource(relative);
    json(res, 200, {
      path: relative,
      source,
      fullDocument: /\\documentclass(?:\[[^\]]+\])?\{/.test(source),
      previewUrl: preview && preview.url,
      initialPdfUrl: preview && preview.pdfUrl,
      pdfFresh: Boolean(preview && preview.pdfFresh)
    });
    return;
  }

  if (req.method === "PUT" && url.pathname === "/api/post") {
    const body = await readJson(req);
    const relative = normalizeRelative(body.path);
    const file = safeInside(postsDir, relative, ".tex");
    fs.mkdirSync(path.dirname(file), { recursive: true });
    const temporary = `${file}.studio-saving`;
    fs.writeFileSync(temporary, String(body.source ?? ""), "utf8");
    fs.renameSync(temporary, file);
    const preview = previewForSource(relative);
    json(res, 200, {
      saved: true,
      modifiedAt: new Date().toISOString(),
      previewUrl: preview && preview.url,
      initialPdfUrl: preview && preview.pdfUrl,
      pdfFresh: Boolean(preview && preview.pdfFresh)
    });
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/posts") {
    const body = await readJson(req);
    const title = String(body.title || "新文章").trim();
    const folder = normalizeRelative(body.folder || "");
    const date = new Date().toISOString().slice(0, 10);
    const relative = normalizeRelative(path.join(folder, `${date}-${slugify(body.filename || title)}.tex`));
    const file = safeInside(postsDir, relative, ".tex");
    if (fs.existsSync(file)) {
      json(res, 409, { error: "同名文章已存在。" });
      return;
    }
    fs.mkdirSync(path.dirname(file), { recursive: true });
    const source = `% ---\n% title: ${title}\n% date: ${date}\n% author: Crystal-Sky\n% tags: \n% summary: \n% ---\n\n\\section{开始写作}\n\n在这里写下正文。\n`;
    fs.writeFileSync(file, source, "utf8");
    json(res, 201, { path: relative, source });
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/compile") {
    const body = await readJson(req);
    const result = await compileLatex(
      normalizeRelative(body.path),
      String(body.source ?? ""),
      normalizeRelative(body.template || "blog.tex"),
      Boolean(body.force)
    );
    if (!result.ok) {
      json(res, 422, result);
      return;
    }
    res.writeHead(200, {
      "Content-Type": "application/pdf",
      "Content-Length": result.pdf.length,
      "Cache-Control": "no-store",
      "X-Compile-Ms": String(result.duration),
      "X-Page-Count": result.pageCount ? String(result.pageCount) : "",
      "X-Compile-Cache": result.cached ? "hit" : "miss"
    });
    res.end(result.pdf);
    return;
  }

  if (req.method === "GET" && url.pathname === "/api/template") {
    const id = normalizeRelative(url.searchParams.get("id") || "blog.tex");
    const file = safeInside(templatesDir, id, ".tex");
    json(res, 200, { id, source: fs.readFileSync(file, "utf8") });
    return;
  }

  if (req.method === "PUT" && url.pathname === "/api/template") {
    const body = await readJson(req);
    const id = normalizeRelative(body.id || "blog.tex");
    const source = String(body.source ?? "");
    if (!source.includes("%% CONTENT %%")) {
      json(res, 422, { error: "模板中必须保留 %% CONTENT %% 占位符。" });
      return;
    }
    const file = safeInside(templatesDir, id, ".tex");
    fs.writeFileSync(file, source, "utf8");
    json(res, 200, { saved: true });
    return;
  }

  json(res, 404, { error: "API 不存在。" });
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url || "/", `http://${host}:${port}`);
  try {
    if (url.pathname.startsWith("/api/")) {
      await api(req, res, url);
      return;
    }

    if (url.pathname.startsWith("/preview/assets/")) {
      sendFile(res, safeInside(assetsDir, decodeURIComponent(url.pathname.slice("/preview/assets/".length))), true);
      return;
    }

    if (url.pathname.startsWith("/preview/posts/") && url.pathname.endsWith(".html")) {
      const slug = path.basename(url.pathname, ".html");
      const posts = loadPreviewPosts();
      const post = posts.find((item) => item.slug === slug);
      if (!post) {
        json(res, 404, { error: "预览文章不存在。" });
        return;
      }
      const html = Buffer.from(renderPreviewPost(post, collectCourses(posts)));
      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8", "Content-Length": html.length, "Cache-Control": "no-store" });
      res.end(html);
      return;
    }

    if (url.pathname.startsWith("/preview/")) {
      const relative = decodeURIComponent(url.pathname.slice("/preview/".length)) || "index.html";
      sendFile(res, safeInside(path.join(root, "dist"), relative));
      return;
    }

    const relative = url.pathname === "/" ? "index.html" : decodeURIComponent(url.pathname.slice(1));
    sendFile(res, safeInside(studioDir, relative));
  } catch (error) {
    json(res, 500, { error: error.message || "服务器错误。" });
  }
});

server.on("error", (error) => {
  if (error.code === "EADDRINUSE") {
    console.log(`Paperleaf 已经在运行：http://${host}:${port}`);
    console.log("无需重复启动，直接打开上面的地址即可。");
    process.exitCode = 0;
    return;
  }
  console.error(`Paperleaf 启动失败：${error.message}`);
  process.exitCode = 1;
});

server.listen(port, host, () => {
  console.log(`LaTeX Studio: http://${host}:${port}`);
  console.log("默认预览与博客正式构建共用同一渲染器。");
});
