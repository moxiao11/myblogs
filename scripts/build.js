const fs = require("fs");
const path = require("path");

const root = process.cwd();
const postsDir = path.join(root, "posts");
const distDir = path.join(root, "dist");
const assetsDir = path.join(root, "assets");

const site = {
  title: "Crystal Sky",
  subtitle: "LaTeX, algorithms, math, and notes",
  description: "一个支持 LaTeX 写作与数学公式渲染的个人博客。",
  author: "Crystal-Sky",
  oldBlog: "https://www.cnblogs.com/Crystal-Sky",
  baseUrl: (process.env.SITE_URL || "").replace(/\/$/, "")
};

const blockTokens = new Map();
let tokenId = 0;

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function cleanDist() {
  if (fs.existsSync(distDir)) {
    fs.rmSync(distDir, { recursive: true, force: true });
  }
  ensureDir(distDir);
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function escapeAttr(value) {
  return escapeHtml(value).replace(/'/g, "&#39;");
}

function slugify(value, fallback = "post") {
  const slug = String(value)
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug || fallback;
}

function parseMeta(source, filePath) {
  const meta = {};
  let body = source.replace(/^\uFEFF/, "");
  const lines = body.split(/\r?\n/);

  if (/^%\s*---\s*$/.test(lines[0] || "")) {
    let index = 1;
    for (; index < lines.length; index += 1) {
      if (/^%\s*---\s*$/.test(lines[index])) {
        index += 1;
        break;
      }
      const match = lines[index].match(/^%\s*([A-Za-z0-9_-]+)\s*:\s*(.*)$/);
      if (match) {
        meta[match[1].toLowerCase()] = match[2].trim();
      }
    }
    body = lines.slice(index).join("\n");
  }

  const titleMatch = body.match(/\\title\{([^}]+)\}/);
  const authorMatch = body.match(/\\author\{([^}]+)\}/);
  const dateMatch = body.match(/\\date\{([^}]+)\}/);

  const fallbackTitle = path.basename(filePath, path.extname(filePath)).replace(/[-_]+/g, " ");
  meta.title = meta.title || (titleMatch && titleMatch[1].trim()) || fallbackTitle;
  meta.author = meta.author || (authorMatch && authorMatch[1].trim()) || site.author;
  meta.date = meta.date || (dateMatch && dateMatch[1].trim()) || "";
  meta.tags = (meta.tags || "")
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean);
  meta.summary = meta.summary || "";
  meta.slug = meta.slug || slugify(path.basename(filePath, path.extname(filePath)));

  return { meta, body };
}

function tokenFor(html) {
  const token = `@@BLOCK_${tokenId++}@@`;
  blockTokens.set(token, html);
  return `\n${token}\n`;
}

function preprocessLatex(body) {
  let text = body
    .replace(/\\documentclass(?:\[[^\]]+\])?\{[^}]+\}/g, "")
    .replace(/\\usepackage(?:\[[^\]]+\])?\{[^}]+\}/g, "")
    .replace(/\\begin\{document\}/g, "")
    .replace(/\\end\{document\}/g, "")
    .replace(/\\maketitle/g, "")
    .replace(/\\tableofcontents/g, "")
    .replace(/\\newpage/g, "")
    .replace(/\\addcontentsline\{[^}]+\}\{[^}]+\}\{[^}]+\}/g, "")
    .replace(/\\title\{[^}]+\}/g, "")
    .replace(/\\author\{[^}]+\}/g, "")
    .replace(/\\date\{[^}]+\}/g, "");

  text = text.replace(/\\begin\{(verbatim|lstlisting)\}([\s\S]*?)\\end\{\1\}/g, (_, _env, code) => {
    return tokenFor(`<pre><code>${escapeHtml(code.trim())}</code></pre>`);
  });

  text = text.replace(/\\\[((?:.|\n)*?)\\\]/g, (match) => tokenFor(`<div class="math-box">${match}</div>`));
  text = text.replace(/\$\$([\s\S]*?)\$\$/g, (match) => tokenFor(`<div class="math-box">${match}</div>`));
  text = text.replace(/\\begin\{(equation\*?|align\*?|gather\*?|multline\*?)\}([\s\S]*?)\\end\{\1\}/g, (match) => {
    return tokenFor(`<div class="math-box">${match}</div>`);
  });

  text = text
    .split(/\r?\n/)
    .filter((line) => !/^\s*%/.test(line))
    .join("\n");

  return text;
}

function inlineFormat(raw) {
  const htmlTokens = [];
  const hold = (html) => {
    const token = `@@HTML_${htmlTokens.length}@@`;
    htmlTokens.push([token, html]);
    return token;
  };

  let value = raw
    .replace(/\\href\{([^}]+)\}\{([^}]+)\}/g, (_, url, label) => {
      return hold(`<a href="${escapeAttr(url)}">${inlineFormat(label)}</a>`);
    })
    .replace(/\\url\{([^}]+)\}/g, (_, url) => {
      const safe = escapeAttr(url);
      return hold(`<a href="${safe}">${escapeHtml(url)}</a>`);
    })
    .replace(/\\textbf\{([^}]+)\}/g, (_, text) => hold(`<strong>${inlineFormat(text)}</strong>`))
    .replace(/\\emph\{([^}]+)\}/g, (_, text) => hold(`<em>${inlineFormat(text)}</em>`))
    .replace(/\\textit\{([^}]+)\}/g, (_, text) => hold(`<em>${inlineFormat(text)}</em>`))
    .replace(/\\texttt\{([^}]+)\}/g, (_, text) => hold(`<code>${escapeHtml(text)}</code>`))
    .replace(/`([^`]+)`/g, (_, text) => hold(`<code>${escapeHtml(text)}</code>`))
    .replace(/\\\(([\s\S]*?)\\\)/g, (match) => hold(match))
    .replace(/\$(?!\$)([^$\n]+?)\$/g, (match) => hold(match));

  value = escapeHtml(value)
    .replace(/``([^`]+)''/g, "&ldquo;$1&rdquo;")
    .replace(/\\LaTeX/g, "LaTeX")
    .replace(/\\TeX/g, "TeX")
    .replace(/\\ldots/g, "...")
    .replace(/\\%/g, "%")
    .replace(/\\&/g, "&amp;")
    .replace(/\\_/g, "_")
    .replace(/\\\{/g, "{")
    .replace(/\\\}/g, "}")
    .replace(/\\#/g, "#")
    .replace(/~\/?/g, " ");

  for (const [token, html] of htmlTokens) {
    value = value.replaceAll(token, html);
  }

  return value.trim();
}

function collectEnvironment(lines, start, envName) {
  const collected = [];
  let index = start + 1;
  const endPattern = new RegExp(`\\\\end\\{${envName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\}`);

  for (; index < lines.length; index += 1) {
    const endIndex = lines[index].search(endPattern);
    if (endIndex >= 0) {
      const beforeEnd = lines[index].slice(0, endIndex).trimEnd();
      if (beforeEnd) {
        collected.push(beforeEnd);
      }
      break;
    }
    collected.push(lines[index]);
  }

  return { text: collected.join("\n"), next: index };
}

function renderList(raw, ordered) {
  const items = raw
    .split(/\\item/g)
    .map((item) => item.trim())
    .filter(Boolean)
    .map((item, index) => {
      const option = ordered ? ` data-option="${String.fromCharCode(65 + index)}" tabindex="0"` : "";
      return `<li${option}>${inlineFormat(item.replace(/\n+/g, " "))}</li>`;
    })
    .join("");
  return `<${ordered ? "ol" : "ul"}>${items}</${ordered ? "ol" : "ul"}>`;
}

function renderLines(text) {
  const lines = text.split(/\r?\n/);
  const output = [];
  let paragraph = [];
  const usedHeadings = new Map();

  const flushParagraph = () => {
    if (!paragraph.length) {
      return;
    }
    const joined = paragraph.join(" ").replace(/\\\\\s*/g, "<br>");
    output.push(`<p>${inlineFormat(joined)}</p>`);
    paragraph = [];
  };

  const headingId = (title) => {
    const base = slugify(title, "section");
    const count = usedHeadings.get(base) || 0;
    usedHeadings.set(base, count + 1);
    return count ? `${base}-${count + 1}` : base;
  };

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index].trim();

    if (!line) {
      flushParagraph();
      continue;
    }

    if (blockTokens.has(line)) {
      flushParagraph();
      output.push(blockTokens.get(line));
      continue;
    }

    const heading = line.match(/^\\(section|subsection|subsubsection)\*?\{(.+)\}$/);
    if (heading) {
      flushParagraph();
      const level = heading[1] === "section" ? 2 : heading[1] === "subsection" ? 3 : 4;
      const title = inlineFormat(heading[2]);
      output.push(`<h${level} id="${headingId(heading[2])}">${title}</h${level}>`);
      continue;
    }

    const begin = line.match(/^\\begin\{([A-Za-z*]+)\}(?:\[([^\]]+)\])?(?:\{(.+)\})?/);
    if (begin) {
      flushParagraph();
      const env = begin[1];
      const label = begin[2] || "";
      const title = begin[3] || "";
      const collected = collectEnvironment(lines, index, env);
      index = collected.next;

      if (env === "abstract") {
        output.push(`<div class="abstract"><strong>Abstract.</strong> ${inlineFormat(collected.text.replace(/\n+/g, " "))}</div>`);
      } else if (env === "itemize" || env === "enumerate") {
        output.push(renderList(collected.text, env === "enumerate"));
      } else if (env === "quote") {
        output.push(`<blockquote>${inlineFormat(collected.text.replace(/\n+/g, " "))}</blockquote>`);
      } else if (env === "question") {
        const heading = title ? `<p class="question-title">${inlineFormat(title)}</p>` : "";
        output.push(`<section class="qa-card">${heading}${renderLines(collected.text)}</section>`);
      } else if (env === "answer") {
        output.push(`<p class="answer-line" hidden><strong>答案：</strong>${inlineFormat(collected.text.replace(/\n+/g, " "))}</p>`);
      } else if (["theorem", "lemma", "definition", "proposition", "corollary"].includes(env)) {
        const name = label ? ` (${inlineFormat(label)})` : "";
        output.push(`<div class="theorem"><strong>${env[0].toUpperCase()}${env.slice(1)}${name}.</strong> ${renderLines(collected.text)}</div>`);
      } else if (env === "proof") {
        output.push(`<div class="proof"><strong>Proof.</strong> ${renderLines(collected.text)}</div>`);
      } else {
        output.push(`<div>${renderLines(collected.text)}</div>`);
      }
      continue;
    }

    paragraph.push(line);
  }

  flushParagraph();
  return output.join("\n");
}

function renderLatex(body) {
  blockTokens.clear();
  tokenId = 0;
  return renderLines(preprocessLatex(body));
}

function readingTime(html) {
  const text = html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  const cjk = (text.match(/[\u4e00-\u9fff]/g) || []).length;
  const latin = text.replace(/[\u4e00-\u9fff]/g, " ").split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.ceil((cjk / 350 + latin / 220) || 1));
}

function plainTextFromHtml(html) {
  return String(html)
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, "\"")
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function extractHeadings(html) {
  return [...String(html).matchAll(/<h([2-4]) id="([^"]+)">([\s\S]*?)<\/h\1>/g)]
    .map((match) => ({
      level: Number(match[1]),
      id: match[2],
      title: plainTextFromHtml(match[3])
    }));
}

function articleAssetUrl(value) {
  if (!value) {
    return "";
  }
  if (/^(?:https?:)?\/\//.test(value)) {
    return value;
  }
  return `../${String(value).replace(/^\/+/, "")}`;
}

function formatDate(dateValue) {
  if (!dateValue) {
    return "";
  }
  const date = new Date(`${dateValue}T00:00:00`);
  if (Number.isNaN(date.getTime())) {
    return dateValue;
  }
  return new Intl.DateTimeFormat("zh-CN", { year: "numeric", month: "long", day: "numeric" }).format(date);
}

function postUrl(post) {
  return `posts/${post.slug}.html`;
}

function fullUrl(pathname) {
  if (!site.baseUrl) {
    return pathname;
  }
  return `${site.baseUrl}/${pathname.replace(/^\/+/, "")}`;
}

function pageShell({ title, description, body, pageClass = "" }) {
  const pageTitle = title === site.title ? site.title : `${title} | ${site.title}`;
  const assetPrefix = pageClass === "article-page" ? "../" : "";
  const assetVersion = (process.env.GITHUB_SHA || String(Date.now())).slice(0, 12);
  return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(pageTitle)}</title>
  <meta name="description" content="${escapeAttr(description || site.description)}">
  <link rel="stylesheet" href="${assetPrefix}assets/styles.css?v=${assetVersion}">
  <script>
    window.MathJax = {
      tex: {
        inlineMath: [["$", "$"], ["\\\\(", "\\\\)"]],
        displayMath: [["$$", "$$"], ["\\\\[", "\\\\]"]],
        processEscapes: true
      },
      svg: { fontCache: "global" }
    };
  </script>
  <script defer src="https://cdn.jsdelivr.net/npm/mathjax@3/es5/tex-svg.js"></script>
</head>
<body class="${pageClass}">
  <button class="menu-button" data-menu-toggle type="button" aria-controls="site-drawer" aria-expanded="false">
    <span aria-hidden="true">☰</span>
    <span>MENU</span>
  </button>
  <button class="theme-switch" data-theme-toggle type="button" aria-label="切换背景亮度">
    <span class="theme-switch-sky"></span>
    <span class="theme-switch-orb"></span>
  </button>
  <div class="drawer-backdrop" data-menu-close hidden></div>
  <aside class="site-drawer" id="site-drawer" aria-hidden="true">
    <div class="drawer-title">
      <span>欢迎来到我的博客</span>
      <button data-menu-close type="button" aria-label="关闭菜单">×</button>
    </div>
    <div class="drawer-profile">
      <img src="${assetPrefix}assets/avatar.png" alt="莫枭">
      <div>
        <div>昵称：莫枭</div>
        <div>园龄：2个月</div>
        <div>粉丝：0</div>
        <div>关注：0</div>
      </div>
    </div>
    <div class="drawer-stats">随笔 - 6&nbsp;&nbsp;文章 - 0&nbsp;&nbsp;评论 - 0&nbsp;&nbsp;阅读 - 297</div>
    <label class="drawer-search">
      <span class="sr-only">搜索文章</span>
      <input data-drawer-search type="search" placeholder="找找看...">
      <span aria-hidden="true">⌕</span>
    </label>
    <nav class="drawer-nav" aria-label="侧边栏菜单">
      <a href="${assetPrefix}index.html"><span>⌂</span><strong>首页</strong><em>i</em></a>
      <a href="https://www.cnblogs.com/Crystal-Sky/category/algorithm.html"><span>⌘</span><strong>算法竞赛</strong><em>ii</em></a>
      <a href="https://www.cnblogs.com/Crystal-Sky/category/2503943.html"><span>▣</span><strong>操作系统</strong><em>iii</em></a>
      <a href="https://www.cnblogs.com/Crystal-Sky/category/frontend.html"><span>▤</span><strong>前端开发</strong><em>iv</em></a>
      <a href="https://www.cnblogs.com/Crystal-Sky/archive.html"><span>☑</span><strong>随笔归档</strong><em>v</em></a>
      <a href="https://github.com/moxiao11/myblogs"><span>⚙</span><strong>管理后台</strong><em>vi</em></a>
    </nav>
    <div class="drawer-calendar" data-calendar></div>
    <div class="drawer-bottom">
      <a href="${assetPrefix}index.html">⌂ 首页</a>
      <a href="https://www.cnblogs.com/Crystal-Sky">➤ 联系</a>
      <a href="${assetPrefix}feed.xml">❤ 订阅</a>
      <a href="https://github.com/moxiao11/myblogs">⚙ 管理</a>
    </div>
  </aside>
  <div class="site-shell">
    <header class="site-header">
      <div class="header-inner">
        <a class="brand" href="${pageClass === "article-page" ? "../index.html" : "index.html"}">
          <img src="${assetPrefix}assets/crystal-sky.svg" alt="">
          <span><strong>${escapeHtml(site.title)}</strong><span>${escapeHtml(site.subtitle)}</span></span>
        </a>
        <nav class="nav-links" aria-label="Primary">
          <a href="${pageClass === "article-page" ? "../index.html" : "index.html"}">文章</a>
          <a href="${pageClass === "article-page" ? "../feed.xml" : "feed.xml"}">RSS</a>
          <a href="${escapeAttr(site.oldBlog)}">博客园旧站</a>
        </nav>
      </div>
    </header>
    ${body}
    <footer class="site-footer">
      <div class="footer-inner">Copyright ${new Date().getFullYear()} ${escapeHtml(site.author)}. Built from LaTeX sources.</div>
    </footer>
  </div>
  <script src="${assetPrefix}assets/site.js?v=${assetVersion}"></script>
</body>
</html>`;
}

function renderIndex(posts) {
  const cards = posts.map((post) => {
    const haystack = `${post.title} ${post.summary} ${post.tags.join(" ")}`.toLowerCase();
    const tags = post.tags.map((tag) => `<span class="tag">${escapeHtml(tag)}</span>`).join("");
    return `<a class="post-card" data-post-card data-search-text="${escapeAttr(haystack)}" href="${postUrl(post)}">
  <h2>${escapeHtml(post.title)}</h2>
  <p>${escapeHtml(post.summary || "打开文章阅读全文。")}</p>
  <div class="meta">
    <span>${escapeHtml(formatDate(post.date) || "未注明日期")}</span>
    <span>${post.minutes} min read</span>
    ${tags}
  </div>
</a>`;
  }).join("\n");

  const body = `<section class="home-hero" id="top">
  <div class="hero-content">
    <h1>${escapeHtml(site.title)}</h1>
    <p>愿你历经山河，仍觉人间值得</p>
  </div>
  <a class="scroll-down" href="#posts" aria-label="查看文章">⌄</a>
</section>
<main class="main-grid" id="posts">
  <section>
    <div class="toolbar">
      <input class="search-input" data-search type="search" placeholder="搜索标题、摘要或标签" aria-label="搜索文章">
    </div>
    <div class="post-list" data-post-list>
      ${cards || `<div class="empty-state">还没有文章。运行 npm run new "文章标题" 创建第一篇。</div>`}
    </div>
    <div class="empty-state" data-empty hidden>没有匹配的文章。</div>
  </section>
  <aside class="side-panel">
    <section class="panel">
      <h2>写作方式</h2>
      <ul>
        <li>文章源文件：posts/*.tex</li>
        <li>数学渲染：MathJax</li>
        <li>发布目录：dist/</li>
      </ul>
    </section>
    <section class="panel">
      <h2>关于</h2>
      <p>这是 Crystal-Sky 从博客园迁移出来的独立博客。旧文章可以逐步整理成 LaTeX 源文件并重新发布。</p>
    </section>
  </aside>
</main>`;

  return pageShell({ title: site.title, description: site.description, body, pageClass: "home-page" });
}

function renderPost(post) {
  const tags = post.tags.map((tag) => `<span class="tag">${escapeHtml(tag)}</span>`).join("");
  const headings = extractHeadings(post.html);
  const pdfUrl = articleAssetUrl(post.pdf);
  const pdfButton = pdfUrl ? `<a class="pdf-download" href="${escapeAttr(pdfUrl)}" download>下载 PDF</a>` : "";
  const challengeButton = post.html.includes("qa-card") ? `<button class="quiz-challenge-start" data-challenge-start type="button">一站到底</button>` : "";
  const actionButtons = `${challengeButton}${pdfButton}`;
  const bookmarks = headings.map((heading) => {
    return `<a class="toc-level-${heading.level}" href="#${escapeAttr(heading.id)}">${escapeHtml(heading.title)}</a>`;
  }).join("");
  const bookmarkPanel = (bookmarks || pdfButton) ? `<aside class="article-toc" aria-label="文章书签">
    <div class="article-toc-inner">
      ${pdfButton}
      ${bookmarks ? `<strong>文章书签</strong><nav>${bookmarks}</nav>` : ""}
    </div>
  </aside>` : "";
  const body = `<main class="article-layout">
  <article class="article">
    <header class="article-header">
      <h1>${escapeHtml(post.title)}</h1>
      <div class="meta">
        <span>${escapeHtml(formatDate(post.date) || "未注明日期")}</span>
        <span>${escapeHtml(post.author)}</span>
        <span>${post.minutes} min read</span>
        ${tags}
      </div>
      ${actionButtons ? `<div class="article-actions">${actionButtons}</div>` : ""}
    </header>
    ${post.html}
  </article>
  ${bookmarkPanel}
</main>`;
  return pageShell({ title: post.title, description: post.summary || site.description, body, pageClass: "article-page" });
}

function renderFeed(posts) {
  const items = posts.map((post) => `<item>
  <title>${escapeHtml(post.title)}</title>
  <link>${escapeHtml(fullUrl(postUrl(post)))}</link>
  <guid>${escapeHtml(fullUrl(postUrl(post)))}</guid>
  <pubDate>${post.date ? new Date(`${post.date}T00:00:00Z`).toUTCString() : new Date().toUTCString()}</pubDate>
  <description>${escapeHtml(post.summary || post.title)}</description>
</item>`).join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
<channel>
  <title>${escapeHtml(site.title)}</title>
  <link>${escapeHtml(fullUrl("index.html"))}</link>
  <description>${escapeHtml(site.description)}</description>
  ${items}
</channel>
</rss>`;
}

function renderSitemap(posts) {
  const urls = ["index.html", ...posts.map(postUrl)].map((url) => `<url><loc>${escapeHtml(fullUrl(url))}</loc></url>`).join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls}
</urlset>`;
}

function copyAssets() {
  ensureDir(path.join(distDir, "assets"));
  for (const entry of fs.readdirSync(assetsDir, { withFileTypes: true })) {
    const from = path.join(assetsDir, entry.name);
    const to = path.join(distDir, "assets", entry.name);
    if (entry.isDirectory()) {
      fs.cpSync(from, to, { recursive: true });
    } else {
      fs.copyFileSync(from, to);
    }
  }

  const cnamePath = path.join(root, "CNAME");
  if (fs.existsSync(cnamePath)) {
    fs.copyFileSync(cnamePath, path.join(distDir, "CNAME"));
  }
}

function loadPosts() {
  ensureDir(postsDir);
  return fs.readdirSync(postsDir)
    .filter((file) => file.endsWith(".tex"))
    .map((file) => {
      const filePath = path.join(postsDir, file);
      const source = fs.readFileSync(filePath, "utf8");
      const { meta, body } = parseMeta(source, filePath);
      const html = renderLatex(body);
      return {
        ...meta,
        html,
        minutes: readingTime(html),
        source: file
      };
    })
    .sort((a, b) => String(b.date).localeCompare(String(a.date)));
}

function writeFile(filePath, content) {
  ensureDir(path.dirname(filePath));
  fs.writeFileSync(filePath, content, "utf8");
}

function build() {
  cleanDist();
  copyAssets();
  const posts = loadPosts();

  for (const post of posts) {
    writeFile(path.join(distDir, postUrl(post)), renderPost(post));
  }

  writeFile(path.join(distDir, "index.html"), renderIndex(posts));
  writeFile(path.join(distDir, "404.html"), renderIndex(posts));
  writeFile(path.join(distDir, "feed.xml"), renderFeed(posts));
  writeFile(path.join(distDir, "sitemap.xml"), renderSitemap(posts));
  writeFile(path.join(distDir, ".nojekyll"), "");
  writeFile(path.join(distDir, "search-index.json"), JSON.stringify(posts.map((post) => ({
    title: post.title,
    url: postUrl(post),
    summary: post.summary,
    tags: post.tags,
    date: post.date
  })), null, 2));

  console.log(`Built ${posts.length} post(s) into ${path.relative(root, distDir)}`);
}

build();
