const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const root = process.cwd();
const postsDir = path.join(root, "posts");
const distDir = path.join(root, "dist");
const assetsDir = path.join(root, "assets");

const site = {
  title: "Crystal Sky",
  subtitle: "把课程学成一张知识地图",
  description: "面向大学课程的专题式学习站，整理讲义、题库、真题解析与复习路径。",
  author: "Crystal-Sky",
  oldBlog: "https://www.cnblogs.com/Crystal-Sky",
  baseUrl: (process.env.SITE_URL || "").replace(/\/$/, "")
};

const courseCatalog = [
  {
    slug: "cpp",
    title: "C++",
    eyebrow: "编程语言",
    icon: "C++",
    accent: "blue",
    description: "从基础语法到现代 C++ 特性，按主题整理可直接查阅和练习的语言笔记。",
    goals: ["掌握 C++ 基础语法", "理解现代 C++ 常用特性", "写出清晰且安全的程序"]
  },
  {
    slug: "innovation-practice",
    title: "创新实践与展示",
    eyebrow: "创新素养",
    icon: "✦",
    accent: "coral",
    description: "从 MOOC 题目到期末复盘，把零散概念整理成可检索、可练习的复习专题。",
    goals: ["掌握课程核心概念", "熟悉常见题型", "形成期末复习框架"]
  },
  {
    slug: "computer-organization",
    title: "计算机组成原理",
    eyebrow: "计算机基础",
    icon: "▦",
    accent: "violet",
    description: "围绕数据表示、运算器、存储与指令系统，建立完整的期末复习知识链。",
    goals: ["串联核心章节", "强化计算与分析", "集中训练期末题型"]
  },
  {
    slug: "data-structures",
    title: "数据结构",
    eyebrow: "算法基础",
    icon: "⌘",
    accent: "teal",
    description: "用真题解析连接复杂度、线性结构、树与图，关注解题过程而不只给出答案。",
    goals: ["掌握复杂度分析", "理解经典数据结构", "训练算法解题思路"]
  },
  {
    slug: "learning-toolkit",
    title: "学习与写作工具",
    eyebrow: "方法与工具",
    icon: "✎",
    accent: "blue",
    description: "记录 LaTeX、知识整理与独立建站方法，让课程笔记更适合长期维护。",
    goals: ["规范课程笔记", "提升公式排版", "建立个人知识库"]
  }
];

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

function stripBalancedCmd(text, cmdName) {
  const prefix = `\\${cmdName}{`;
  let idx = 0;
  while ((idx = text.indexOf(prefix, idx)) !== -1) {
    let depth = 1;
    let pos = idx + prefix.length;
    while (pos < text.length && depth > 0) {
      if (text[pos] === "{") depth++;
      else if (text[pos] === "}") depth--;
      pos++;
    }
    text = text.slice(0, idx) + text.slice(pos);
  }
  return text;
}

function preprocessLatex(body) {
  let text = body;
  const documentStart = text.indexOf("\\begin{document}");
  if (documentStart !== -1) {
    text = text.slice(documentStart + "\\begin{document}".length);
  }

  text = text
    .replace(/\\documentclass(?:\[[^\]]+\])?\{[^}]+\}/g, "")
    .replace(/\\usepackage(?:\[[^\]]+\])?\{[^}]+\}/g, "")
    .replace(/\\begin\{document\}/g, "")
    .replace(/\\end\{document\}/g, "")
    .replace(/\\maketitle/g, "")
    .replace(/\\tableofcontents/g, "")
    .replace(/\\newpage/g, "")
    .replace(/\\addcontentsline\{[^}]+\}\{[^}]+\}\{[^}]+\}/g, "");

  // Strip commands that may have nested braces
  text = stripBalancedCmd(text, "lstset");
  text = stripBalancedCmd(text, "title");
  text = stripBalancedCmd(text, "author");
  text = stripBalancedCmd(text, "date");

  // \renewcommand takes two args: \renewcommand{cmd}{value}
  text = text.replace(/\\renewcommand\{[^}]+\}\{[^}]*\}/g, "");

  // Strip preamble-only commands that shouldn't appear in body
  text = text
    .replace(/\\pagestyle\{[^}]+\}/g, "")
    .replace(/\\fancyhf\{\}/g, "")
    .replace(/\\fancyhead\[[^\]]*\]\{[^}]*\}/g, "")
    .replace(/\\fancyfoot\[[^\]]*\]\{[^}]*\}/g, "")
    .replace(/\\thispagestyle\{[^}]+\}/g, "")
    .replace(/\\vspace\*?\{[^}]+\}/g, "")
    .replace(/\\hrule/g, "")
    .replace(/\\hspace\*?\{[^}]+\}/g, "")
    .replace(/\\noindent/g, "")
    .replace(/\\medskip/g, "")
    .replace(/\\smallskip/g, "")
    .replace(/\\bigskip/g, "")
    .replace(/\\newpage/g, "")
    .replace(/\\clearpage/g, "");

  text = text.replace(/\\begin\{(verbatim|lstlisting)\}(?:\[[^\]]*\])?([\s\S]*?)\\end\{\1\}/g, (_, _env, code) => {
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

  const codeText = (text) => String(text)
    .replace(/\\textbackslash\{\}/g, "\\")
    .replace(/\\([#$%&_{}])/g, "$1");

  let value = raw
    .replace(/\\href\{([^}]+)\}\{([^}]+)\}/g, (_, url, label) => {
      return hold(`<a href="${escapeAttr(url)}">${inlineFormat(label)}</a>`);
    })
    .replace(/\\url\{([^}]+)\}/g, (_, url) => {
      const safe = escapeAttr(url);
      return hold(`<a href="${safe}">${escapeHtml(url)}</a>`);
    })
    // Process inner commands BEFORE outer ones — \textcolor etc. may appear
    // inside \textbf/\emph, and replacing them first removes nested braces
    .replace(/\\textcolor\{([^}]+)\}\{([^}]+)\}/g, (_, color, text) => {
      const safeColor = /^[a-zA-Z]+$/.test(color) ? color : "";
      return safeColor ? hold(`<span style="color:${safeColor}">${inlineFormat(text)}</span>`) : hold(inlineFormat(text));
    })
    .replace(/\\texttt\{([^}]+)\}/g, (_, text) => hold(`<code>${escapeHtml(codeText(text))}</code>`))
    .replace(/\\textsf\{([^}]+)\}/g, (_, text) => hold(inlineFormat(text)))
    .replace(/\\small\{([^}]*)\}/g, (_, text) => hold(`<small>${inlineFormat(text)}</small>`))
    .replace(/\\textbf\{([^}]+)\}/g, (_, text) => hold(`<strong>${inlineFormat(text)}</strong>`))
    .replace(/\\emph\{([^}]+)\}/g, (_, text) => hold(`<em>${inlineFormat(text)}</em>`))
    .replace(/\\textit\{([^}]+)\}/g, (_, text) => hold(`<em>${inlineFormat(text)}</em>`))
    .replace(/\\underline\{\\hspace\{[^}]+\}\}/g, () => hold(`<span class="blank-line" aria-hidden="true"></span>`))
    .replace(/\\hspace\{[^}]+\}/g, () => hold(`<span class="blank-space" aria-hidden="true"></span>`))
    .replace(/`([^`]+)`/g, (_, text) => hold(`<code>${escapeHtml(text)}</code>`))
    .replace(/\\\(([\s\S]*?)\\\)/g, (match) => hold(match))
    .replace(/\$(?!\$)([^$\n]+?)\$/g, (match) => hold(match));

  value = escapeHtml(value)
    .replace(/``([^`]+)''/g, "&ldquo;$1&rdquo;")
    .replace(/\\LaTeX/g, "LaTeX")
    .replace(/\\TeX/g, "TeX")
    .replace(/\\ldots/g, "...")
    .replace(/\\qquad/g, " ")
    .replace(/\\quad/g, " ")
    .replace(/\\,/g, " ")
    .replace(/\\%/g, "%")
    .replace(/\\&/g, "&amp;")
    .replace(/\\_/g, "_")
    .replace(/\\\{/g, "{")
    .replace(/\\\}/g, "}")
    .replace(/\\#/g, "#")
    .replace(/~\/?/g, " ");

  // Multi-pass restoration: tokens may be nested in other tokens' HTML
  let changed = true;
  while (changed) {
    changed = false;
    for (const [token, html] of htmlTokens) {
      if (value.includes(token)) {
        value = value.replaceAll(token, html);
        changed = true;
      }
    }
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
  const nestedMap = new Map();
  let nestId = 0;

  // Protect nested list environments with tokens
  let text = raw;
  let prev = "";
  while (prev !== text) {
    prev = text;
    text = text.replace(/\\begin\{(itemize|enumerate)\}([\s\S]*?)\\end\{\1\}/g, (_match, env) => {
      const id = nestId++;
      const beginTag = `\\begin{${env}}`;
      const endTag = `\\end{${env}}`;
      const body = _match.slice(beginTag.length, _match.length - endTag.length);
      nestedMap.set(id, { env, body });
      return `@@NEST_${id}@@`;
    });
  }

  // Split by \item at top level only
  const rawItems = text.split(/\\item/g).map((s) => s.trim()).filter(Boolean);

  const renderedItems = rawItems.map((rawItem) => {
    // Parse into segments: text and nested tokens
    const segments = [];
    const tokenRe = /@@NEST_(\d+)@@/g;
    let lastIndex = 0;
    let match;

    while ((match = tokenRe.exec(rawItem)) !== null) {
      if (match.index > lastIndex) {
        segments.push({ type: "text", value: rawItem.slice(lastIndex, match.index) });
      }
      const id = Number(match[1]);
      const nested = nestedMap.get(id);
      if (nested) {
        segments.push({ type: "nested", env: nested.env, body: nested.body });
      }
      lastIndex = match.index + match[0].length;
    }
    if (lastIndex < rawItem.length) {
      segments.push({ type: "text", value: rawItem.slice(lastIndex) });
    }

    const rendered = segments.map((seg) => {
      if (seg.type === "text") {
        return inlineWithBreaks(seg.value);
      } else {
        return renderList(seg.body, seg.env === "enumerate");
      }
    }).join("");

    return `<li>${rendered}</li>`;
  }).join("");

  return `<${ordered ? "ol" : "ul"}>${renderedItems}</${ordered ? "ol" : "ul"}>`;
}

function renderOptionItems(items) {
  const rendered = items
    .map(({ key, text }, index) => {
      const option = key || String.fromCharCode(65 + index);
      return `<li data-option="${escapeAttr(option)}" tabindex="0">${inlineWithBreaks(text)}</li>`;
    })
    .join("");
  return `<ol class="option-list">${rendered}</ol>`;
}

function inlineWithBreaks(raw) {
  return String(raw)
    .split(/\\\\\s*/g)
    .map((part) => inlineFormat(part.replace(/\n+/g, " ")))
    .join("<br>");
}

function renderTable(raw) {
  // Strip LaTeX rule commands (use CSS borders instead)
  let text = raw.replace(/\\(?:hline|toprule|midrule|bottomrule)\s*/g, "");

  // Split by \\ (row endings)
  const rows = text.split(/\\\\/g).filter((row) => row.trim());

  const htmlRows = rows.map((row) => {
    // Split by & but not inside braces
    const cells = [];
    let depth = 0;
    let current = "";
    for (let i = 0; i < row.length; i++) {
      const ch = row[i];
      if (ch === "{" || ch === "[") {
        depth++;
        current += ch;
      } else if (ch === "}" || ch === "]") {
        depth--;
        current += ch;
      } else if (ch === "&" && depth === 0) {
        cells.push(current.trim());
        current = "";
      } else {
        current += ch;
      }
    }
    if (current.trim()) {
      cells.push(current.trim());
    }

    if (cells.length === 0) return null;

    const cellHtml = cells.map((cell) => {
      return `<td>${inlineFormat(cell)}</td>`;
    }).join("");
    return `<tr>${cellHtml}</tr>`;
  }).filter(Boolean).join("\n");

  return `<div class="table-wrapper"><table>${htmlRows}</table></div>`;
}

function renderPartList(raw) {
  const items = raw
    .split(/\\item/g)
    .map((item) => item.trim())
    .filter(Boolean)
    .map((item) => `<li>${inlineWithBreaks(item)}</li>`)
    .join("");
  return `<ol class="part-list">${items}</ol>`;
}

function renderAnswerBlock(className, label, raw) {
  return `<section class="${className}" hidden><strong>${label}</strong><div>${renderLines(raw)}</div></section>`;
}

function renderImage(source, alt = "") {
  const rawSource = String(source || "").trim();
  if (!rawSource) {
    return "";
  }
  const normalized = rawSource.replace(/^\/+/, "");
  const src = /^(?:https?:)?\/\//.test(normalized)
    ? normalized
    : `../${normalized.startsWith("assets/") ? normalized : `assets/${normalized}`}`;
  const safeAlt = alt || path.basename(normalized, path.extname(normalized));
  return `<figure class="article-figure"><img src="${escapeAttr(src)}" alt="${escapeAttr(safeAlt)}"></figure>`;
}

function renderLines(text, state = { sectionNumber: 0, questionNumber: 0, usedHeadings: new Map() }) {
  const lines = text.split(/\r?\n/);
  const output = [];
  let paragraph = [];

  const flushParagraph = () => {
    if (!paragraph.length) {
      return;
    }
    output.push(`<p>${inlineWithBreaks(paragraph.join(" "))}</p>`);
    paragraph = [];
  };

  const headingId = (title) => {
    const base = slugify(title, "section");
    const count = state.usedHeadings.get(base) || 0;
    state.usedHeadings.set(base, count + 1);
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

    const optionLine = line.match(/^([A-D])\.\s*(.+)$/);
    if (optionLine) {
      flushParagraph();
      const options = [];
      let cursor = index;
      for (; cursor < lines.length; cursor += 1) {
        const current = lines[cursor].trim();
        if (!current) {
          continue;
        }
        const option = current.match(/^([A-D])\.\s*(.+)$/);
        if (!option) {
          break;
        }
        options.push({ key: option[1], text: option[2] });
      }
      output.push(renderOptionItems(options));
      index = cursor - 1;
      continue;
    }

    const image = line.match(/^\\includegraphics(?:\[[^\]]+\])?\{([^}]+)\}$/);
    if (image) {
      flushParagraph();
      output.push(renderImage(image[1]));
      continue;
    }

    const heading = line.match(/^\\(section|subsection|subsubsection)\*?\{(.+)\}$/);
    if (heading) {
      flushParagraph();
      const level = heading[1] === "section" ? 2 : heading[1] === "subsection" ? 3 : 4;
      const title = inlineFormat(heading[2]);
      if (heading[1] === "section") {
        state.sectionNumber += 1;
        state.questionNumber = 0;
      }
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
      } else if (env === "parts") {
        output.push(renderPartList(collected.text));
      } else if (env === "figure") {
        const figureImage = collected.text.match(/\\includegraphics(?:\[[^\]]+\])?\{([^}]+)\}/);
        output.push(figureImage ? renderImage(figureImage[1]) : `<figure>${renderLines(collected.text, state)}</figure>`);
      } else if (env === "quote") {
        output.push(`<blockquote>${inlineFormat(collected.text.replace(/\n+/g, " "))}</blockquote>`);
      } else if (env === "center") {
        output.push(`<div class="center-block">${renderLines(collected.text, state)}</div>`);
      } else if (env === "knowledge") {
        output.push(`<aside class="knowledge-block"><strong>知识点：</strong>${renderLines(collected.text, state)}</aside>`);
      } else if (["conceptbox", "warningbox", "examplebox"].includes(env)) {
        const boxTitle = title ? `<strong>${inlineFormat(title)}</strong>` : "";
        output.push(`<aside class="article-callout ${env}">${boxTitle}${renderLines(collected.text, state)}</aside>`);
      } else if (env === "question") {
        state.questionNumber += 1;
        const fallbackTitle = state.sectionNumber ? `题目 ${state.sectionNumber}.${state.questionNumber}` : "题目";
        const questionTitle = title || (label ? `${fallbackTitle} ${label}` : fallbackTitle);
        const heading = `<p class="question-title">${inlineFormat(questionTitle)}</p>`;
        output.push(`<section class="qa-card">${heading}${renderLines(collected.text, state)}</section>`);
      } else if (env === "answer") {
        output.push(renderAnswerBlock("answer-line", "答案：", collected.text));
      } else if (env === "explanation" || env === "analysisenv" || env === "solution") {
        output.push(renderAnswerBlock("explanation-line", "解析：", collected.text));
      } else if (["theorem", "lemma", "definition", "proposition", "corollary"].includes(env)) {
        const name = label ? ` (${inlineFormat(label)})` : "";
        output.push(`<div class="theorem"><strong>${env[0].toUpperCase()}${env.slice(1)}${name}.</strong> ${renderLines(collected.text, state)}</div>`);
      } else if (env === "proof") {
        output.push(`<div class="proof"><strong>Proof.</strong> ${renderLines(collected.text, state)}</div>`);
      } else if (env === "tabular") {
        output.push(renderTable(collected.text));
      } else if (env === "tikzpicture") {
        output.push(`<div class="tikz-placeholder"><p>📐 TikZ 图表（请在 PDF 版本中查看完整图表）</p></div>`);
      } else {
        output.push(`<div>${renderLines(collected.text, state)}</div>`);
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

function latexEscape(value) {
  return String(value || "")
    .replace(/\\/g, "\\textbackslash{}")
    .replace(/([#$%&_{}])/g, "\\$1")
    .replace(/\^/g, "\\textasciicircum{}")
    .replace(/~/g, "\\textasciitilde{}");
}

function texPath(value) {
  return String(value).replace(/\\/g, "/").replace(/\/?$/, "/");
}

function pdfWrapper(post) {
  const assetPath = texPath(path.join(root, "assets"));
  const rootPath = texPath(root);
  return `\\documentclass[UTF8]{ctexart}
\\usepackage[a4paper,margin=2.4cm]{geometry}
\\usepackage{amsmath,amssymb,amsthm}
\\usepackage{enumitem}
\\usepackage[strings]{underscore}
\\usepackage{graphicx}
\\usepackage{float}
\\usepackage{xcolor}
\\usepackage[colorlinks=true,linkcolor=blue,urlcolor=blue]{hyperref}
\\graphicspath{{${assetPath}}{${rootPath}}}
\\newtheorem{theorem}{定理}
\\newtheorem{lemma}{引理}
\\newtheorem{definition}{定义}
\\newtheorem{proposition}{命题}
\\newtheorem{corollary}{推论}
\\newenvironment{question}[1]{\\par\\medskip\\noindent\\textbf{#1}\\par\\smallskip}{\\par\\medskip}
\\newenvironment{answer}{\\par\\noindent\\textbf{答案：}}{\\par}
\\newenvironment{explanation}{\\par\\noindent\\textbf{解析：}}{\\par}
\\title{${latexEscape(post.title)}}
\\author{${latexEscape(post.author)}}
\\date{${latexEscape(formatDate(post.date) || post.date)}}
\\begin{document}
\\maketitle
\\catcode\`\\#=12
\\catcode\`\\%=12
\\catcode\`\\^=12
${post.body}
\\end{document}
`;
}

function generatePostPdf(post) {
  const workDir = path.join(root, "tmp", "latex-pdf", post.slug);
  ensureDir(workDir);
  const texFile = path.join(workDir, `${post.slug}.tex`);
  const texSource = /\\documentclass(?:\[[^\]]+\])?\{/.test(post.body)
    ? post.body
    : pdfWrapper(post);
  fs.writeFileSync(texFile, texSource, "utf8");

  const result = spawnSync("xelatex", [
    "-interaction=nonstopmode",
    "-halt-on-error",
    "-output-directory",
    workDir,
    texFile
  ], { cwd: root, encoding: "utf8" });

  const pdfFile = path.join(workDir, `${post.slug}.pdf`);
  if (result.status !== 0 || !fs.existsSync(pdfFile)) {
    console.warn(`Skipped PDF for ${post.source}: xelatex failed.`);
    if (result.stdout) {
      console.warn(result.stdout.split(/\r?\n/).slice(-12).join("\n"));
    }
    if (result.stderr) {
      console.warn(result.stderr);
    }
    return "";
  }

  const targetRelative = `assets/${post.slug}.pdf`;
  const target = path.join(distDir, targetRelative);
  ensureDir(path.dirname(target));
  fs.copyFileSync(pdfFile, target);
  return targetRelative;
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

function courseUrl(course) {
  return `courses/${course.slug}.html`;
}

function courseForPost(post) {
  return courseCatalog.find((course) => course.slug === post.course_slug)
    || courseCatalog.find((course) => course.title === post.course)
    || courseCatalog[courseCatalog.length - 1];
}

function collectCourses(posts) {
  return courseCatalog
    .map((course) => {
      const lessons = posts
        .filter((post) => courseForPost(post).slug === course.slug)
        .sort((a, b) => {
          const chapterOrder = Number(a.chapter_order || 999) - Number(b.chapter_order || 999);
          return chapterOrder || Number(a.lesson_order || 999) - Number(b.lesson_order || 999);
        });
      return {
        ...course,
        lessons,
        minutes: lessons.reduce((sum, lesson) => sum + lesson.minutes, 0),
        updated: lessons.reduce((latest, lesson) => String(lesson.date) > String(latest) ? lesson.date : latest, "")
      };
    })
    .filter((course) => course.lessons.length);
}

function fullUrl(pathname) {
  if (!site.baseUrl) {
    return pathname;
  }
  return `${site.baseUrl}/${pathname.replace(/^\/+/, "")}`;
}

function pageShell({ title, description, body, pageClass = "", stats = {} }) {
  const pageTitle = title === site.title ? site.title : `${title} | ${site.title}`;
  const nestedPage = pageClass.split(/\s+/).some((name) => name === "article-page" || name === "course-page");
  const assetPrefix = nestedPage ? "../" : "";
  const homeHref = `${assetPrefix}index.html`;
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
    <div class="drawer-stats">${stats.courseCount || 4} 个课程专题 · ${stats.lessonCount || 5} 个学习单元</div>
    <label class="drawer-search">
      <span class="sr-only">搜索文章</span>
      <input data-drawer-search type="search" placeholder="找找看...">
      <span aria-hidden="true">⌕</span>
    </label>
    <nav class="drawer-nav" aria-label="侧边栏菜单">
      <a href="${homeHref}"><span>⌂</span><strong>学习首页</strong><em>i</em></a>
      <a href="${homeHref}#courses"><span>▦</span><strong>课程专题</strong><em>ii</em></a>
      <a href="${homeHref}#latest"><span>☑</span><strong>最近更新</strong><em>iii</em></a>
      <a href="${assetPrefix}feed.xml"><span>◉</span><strong>订阅更新</strong><em>iv</em></a>
      <a href="${escapeAttr(site.oldBlog)}"><span>↗</span><strong>博客园旧站</strong><em>v</em></a>
      <a href="https://github.com/moxiao11/myblogs"><span>⚙</span><strong>课程仓库</strong><em>vi</em></a>
    </nav>
    <div class="drawer-calendar" data-calendar></div>
    <div class="drawer-bottom">
      <a href="${homeHref}">⌂ 首页</a>
      <a href="https://www.cnblogs.com/Crystal-Sky">➤ 联系</a>
      <a href="${assetPrefix}feed.xml">❤ 订阅</a>
      <a href="https://github.com/moxiao11/myblogs">⚙ 管理</a>
    </div>
  </aside>
  <div class="site-shell">
    <header class="site-header">
      <div class="header-inner">
        <a class="brand" href="${homeHref}">
          <img src="${assetPrefix}assets/crystal-sky.svg" alt="">
          <span><strong>${escapeHtml(site.title)}</strong><span>${escapeHtml(site.subtitle)}</span></span>
        </a>
        <nav class="nav-links" aria-label="Primary">
          <a href="${homeHref}#courses">课程专题</a>
          <a href="${homeHref}#latest">最近更新</a>
          <a href="${assetPrefix}feed.xml">RSS</a>
          <a href="${escapeAttr(site.oldBlog)}">博客园旧站</a>
        </nav>
      </div>
    </header>
    ${body}
    <footer class="site-footer">
      <div class="footer-inner"><strong>${escapeHtml(site.title)}</strong><span>把零散笔记，整理成可以持续学习的课程。</span><span>© ${new Date().getFullYear()} ${escapeHtml(site.author)} · Built from LaTeX sources.</span></div>
    </footer>
  </div>
  <script src="${assetPrefix}assets/site.js?v=${assetVersion}"></script>
</body>
</html>`;
}

function renderIndex(posts) {
  const courses = collectCourses(posts);
  const totalMinutes = posts.reduce((sum, post) => sum + post.minutes, 0);
  const stats = { courseCount: courses.length, lessonCount: posts.length };
  const courseCards = courses.map((course, index) => {
    const haystack = `${course.title} ${course.description} ${course.lessons.map((lesson) => `${lesson.title} ${lesson.tags.join(" ")}`).join(" ")}`.toLowerCase();
    const lessonPreview = course.lessons.slice(0, 3).map((lesson, lessonIndex) => (
      `<li><span>${String(lessonIndex + 1).padStart(2, "0")}</span><strong>${escapeHtml(lesson.title)}</strong></li>`
    )).join("");
    return `<article class="course-card course-${escapeAttr(course.accent)}" data-search-item data-search-text="${escapeAttr(haystack)}">
      <div class="course-card-top">
        <span class="course-icon" aria-hidden="true">${course.icon}</span>
        <span class="course-index">0${index + 1}</span>
      </div>
      <p class="course-eyebrow">${escapeHtml(course.eyebrow)}</p>
      <h3>${escapeHtml(course.title)}</h3>
      <p>${escapeHtml(course.description)}</p>
      <ul class="course-preview">${lessonPreview}</ul>
      <a class="course-enter" href="${courseUrl(course)}"><span>进入专题</span><span aria-hidden="true">→</span></a>
    </article>`;
  }).join("\n");
  const latestLessons = posts.slice(0, 4).map((post) => {
    const course = courseForPost(post);
    const haystack = `${post.title} ${post.summary} ${post.tags.join(" ")} ${course.title}`.toLowerCase();
    return `<a class="lesson-row" data-search-item data-search-text="${escapeAttr(haystack)}" href="${postUrl(post)}">
      <span class="lesson-type">${escapeHtml(post.lesson_type || "课程讲义")}</span>
      <span class="lesson-row-main"><strong>${escapeHtml(post.title)}</strong><small>${escapeHtml(course.title)} · ${post.minutes} 分钟阅读</small></span>
      <time datetime="${escapeAttr(post.date)}">${escapeHtml(formatDate(post.date))}</time>
      <span class="lesson-arrow" aria-hidden="true">↗</span>
    </a>`;
  }).join("\n");

  const body = `<main>
  <section class="home-hero" id="top">
    <div class="hero-orbit hero-orbit-one" aria-hidden="true"></div>
    <div class="hero-orbit hero-orbit-two" aria-hidden="true"></div>
    <div class="hero-content">
      <p class="hero-kicker"><span></span> COURSE NOTES · LEARNING JOURNEY</p>
      <h1>Crystal Sky</h1>
      <p class="hero-motto">愿你历经山河，仍觉人间值得</p>
      <p class="hero-description">把课程讲义、题库、真题解析与复习路径，整理成可以循序学习的温柔知识地图。</p>
      <div class="hero-actions">
        <a class="primary-action" href="#courses">开始学习 <span>→</span></a>
        <a class="secondary-action" href="#latest">查看最近更新</a>
      </div>
      <div class="hero-stats" aria-label="站点内容统计">
        <div><strong>${courses.length}</strong><span>课程专题</span></div>
        <div><strong>${posts.length}</strong><span>学习单元</span></div>
        <div><strong>${totalMinutes}</strong><span>分钟内容</span></div>
      </div>
    </div>
    <div class="hero-board" aria-label="学习路径预览">
      <div class="hero-board-head"><span>本期学习地图</span><span class="live-dot">持续更新</span></div>
      ${courses.slice(0, 3).map((course, index) => `<a href="${courseUrl(course)}"><span class="board-number">0${index + 1}</span><span><strong>${escapeHtml(course.title)}</strong><small>${course.lessons.length} 个学习单元</small></span><em>→</em></a>`).join("")}
      <div class="hero-board-note">从专题进入，按课时顺序学习；也可以直接搜索知识点。</div>
    </div>
  </section>

  <section class="learning-section" id="courses">
    <div class="section-heading">
      <div><p>COURSE COLLECTION</p><h2>选择一个课程专题</h2></div>
      <p>每个专题都有清晰的学习目标、章节顺序和配套资料，适合系统复习，也方便考前快速定位。</p>
    </div>
    <div class="course-search"><span aria-hidden="true">⌕</span><input data-search type="search" placeholder="搜索课程、题目或知识点…" aria-label="搜索课程内容"><kbd>⌘ K</kbd></div>
    <div class="course-grid" data-search-results>${courseCards}</div>
    <div class="empty-state" data-empty hidden>没有找到匹配的课程或内容。</div>
  </section>

  <section class="latest-section" id="latest">
    <div class="section-heading compact"><div><p>LATEST LESSONS</p><h2>最近更新</h2></div><a href="feed.xml">订阅 RSS →</a></div>
    <div class="lesson-rows">${latestLessons}</div>
  </section>

  <section class="learning-callout">
    <div><p>学习不是收藏更多资料</p><h2>而是让知识之间，开始产生连接。</h2></div>
    <p>专题会持续补充章节讲义、复习题和真题解析。选择一门课，从第一个学习单元开始。</p>
    <a href="#courses">浏览全部课程 <span>↗</span></a>
  </section>
</main>`;

  return pageShell({ title: site.title, description: site.description, body, pageClass: "home-page", stats });
}

function renderCourse(course, allCourses) {
  const stats = {
    courseCount: allCourses.length,
    lessonCount: allCourses.reduce((sum, item) => sum + item.lessons.length, 0)
  };
  const renderLesson = (post, index) => {
    const tags = post.tags.slice(0, 3).map((tag) => `<span>${escapeHtml(tag)}</span>`).join("");
    return `<a class="course-lesson" href="../${postUrl(post)}">
      <span class="course-lesson-index">${String(index + 1).padStart(2, "0")}</span>
      <span class="course-lesson-content">
        <span class="course-lesson-type">${escapeHtml(post.lesson_type || "课程讲义")}</span>
        <strong>${escapeHtml(post.title)}</strong>
        <small>${escapeHtml(post.summary || "打开本课时开始学习。")}</small>
        <span class="course-lesson-tags">${tags}</span>
      </span>
      <span class="course-lesson-meta"><span>${post.minutes} min</span><time>${escapeHtml(formatDate(post.date))}</time><em>开始学习 →</em></span>
    </a>`;
  };
  const hasChapters = course.lessons.some((post) => post.chapter);
  let lessons;
  if (hasChapters) {
    const chapters = new Map();
    for (const post of course.lessons) {
      const chapter = post.chapter || "其他内容";
      if (!chapters.has(chapter)) chapters.set(chapter, []);
      chapters.get(chapter).push(post);
    }
    let lessonIndex = 0;
    lessons = [...chapters.entries()].map(([chapter, chapterLessons], chapterIndex) => {
      const items = chapterLessons.map((post) => renderLesson(post, lessonIndex++)).join("\n");
      return `<section class="course-chapter">
        <div class="course-chapter-heading"><span>${String(chapterIndex + 1).padStart(2, "0")}</span><h3>${escapeHtml(chapter)}</h3><small>${chapterLessons.length} 节</small></div>
        <div class="course-chapter-lessons">${items}</div>
      </section>`;
    }).join("\n");
  } else {
    lessons = course.lessons.map(renderLesson).join("\n");
  }
  const goalList = course.goals.map((goal) => `<li><span>✓</span>${escapeHtml(goal)}</li>`).join("");
  const body = `<main class="course-page-main">
    <nav class="breadcrumb"><a href="../index.html">学习首页</a><span>/</span><span>课程专题</span><span>/</span><strong>${escapeHtml(course.title)}</strong></nav>
    <section class="course-hero course-${escapeAttr(course.accent)}">
      <div>
        <p class="course-eyebrow">${escapeHtml(course.eyebrow)} · COURSE ${String(allCourses.indexOf(course) + 1).padStart(2, "0")}</p>
        <h1>${escapeHtml(course.title)}</h1>
        <p>${escapeHtml(course.description)}</p>
        <div class="course-hero-meta"><span>${course.lessons.length} 个学习单元</span><span>约 ${course.minutes} 分钟</span><span>更新于 ${escapeHtml(formatDate(course.updated))}</span></div>
      </div>
      <span class="course-hero-icon" aria-hidden="true">${course.icon}</span>
    </section>
    <div class="course-layout">
      <section class="course-curriculum">
        <div class="curriculum-heading"><div><p>CURRICULUM</p><h2>课程目录</h2></div><span>${course.lessons.length} / ${course.lessons.length} 已发布</span></div>
        <div class="course-lessons">${lessons}</div>
      </section>
      <aside class="course-sidebar">
        <section><p>LEARNING GOALS</p><h2>学完你将能够</h2><ul>${goalList}</ul></section>
        <section class="course-tip"><span>学习建议</span><p>先按目录顺序通读，再结合题库与真题查漏补缺。长文可以使用右侧书签快速跳转。</p></section>
        <a class="back-all-courses" href="../index.html#courses">← 返回全部课程</a>
      </aside>
    </div>
  </main>`;
  return pageShell({ title: course.title, description: course.description, body, pageClass: "course-page", stats });
}

function renderPost(post, allCourses) {
  const course = allCourses.find((item) => item.slug === courseForPost(post).slug);
  const tags = post.tags.map((tag) => `<span class="tag">${escapeHtml(tag)}</span>`).join("");
  const headings = extractHeadings(post.html);
  const pdfUrl = articleAssetUrl(post.pdf);
  const pdfButton = pdfUrl ? `<a class="pdf-download" href="${escapeAttr(pdfUrl)}" download>下载 PDF</a>` : "";
  const challengeButton = post.challenge !== "false" && post.html.includes("answer-line") ? `<button class="quiz-challenge-start" data-challenge-start type="button">一站到底</button>` : "";
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
  const inlineAnswers = post.inline_answers === "true";
  const stats = { courseCount: allCourses.length, lessonCount: allCourses.reduce((sum, item) => sum + item.lessons.length, 0) };
  const chapterCrumb = post.chapter ? `<span>/</span><span>${escapeHtml(post.chapter)}</span>` : "";
  const body = `<nav class="article-breadcrumb breadcrumb"><a href="../index.html">学习首页</a><span>/</span><a href="../${courseUrl(course)}">${escapeHtml(course.title)}</a>${chapterCrumb}<span>/</span><strong>${escapeHtml(post.title)}</strong></nav>
<main class="article-layout">
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
  return pageShell({ title: post.title, description: post.summary || site.description, body, pageClass: `article-page${inlineAnswers ? " inline-answers" : ""}`, stats });
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

function renderSitemap(posts, courses = []) {
  const urls = ["index.html", ...courses.map(courseUrl), ...posts.map(postUrl)].map((url) => `<url><loc>${escapeHtml(fullUrl(url))}</loc></url>`).join("\n");
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
  const findTexFiles = (dir) => fs.readdirSync(dir, { withFileTypes: true })
    .flatMap((entry) => {
      const entryPath = path.join(dir, entry.name);
      if (entry.isDirectory()) return findTexFiles(entryPath);
      return entry.isFile() && entry.name.endsWith(".tex") ? [entryPath] : [];
    });

  return findTexFiles(postsDir)
    .map((filePath) => {
      const source = fs.readFileSync(filePath, "utf8");
      const relativeSource = path.relative(postsDir, filePath);
      const isNested = path.dirname(relativeSource) !== ".";
      const hasMeta = /^(?:\uFEFF)?%\s*---\s*(?:\r?\n)/.test(source.slice(0, 100));
      if (isNested && !hasMeta) {
        console.warn(`Skipped draft without metadata: ${relativeSource}`);
        return null;
      }
      const { meta, body } = parseMeta(source, filePath);
      const html = renderLatex(body);
      return {
        ...meta,
        body,
        html,
        minutes: readingTime(html),
        source: relativeSource
      };
    })
    .filter(Boolean)
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
  const courses = collectCourses(posts);

  for (const post of posts) {
    if (!post.pdf) {
      const generatedPdf = generatePostPdf(post);
      if (generatedPdf) {
        post.pdf = generatedPdf;
      }
    }
  }

  for (const post of posts) {
    writeFile(path.join(distDir, postUrl(post)), renderPost(post, courses));
  }

  for (const course of courses) {
    writeFile(path.join(distDir, courseUrl(course)), renderCourse(course, courses));
  }

  writeFile(path.join(distDir, "index.html"), renderIndex(posts));
  writeFile(path.join(distDir, "404.html"), renderIndex(posts));
  writeFile(path.join(distDir, "feed.xml"), renderFeed(posts));
  writeFile(path.join(distDir, "sitemap.xml"), renderSitemap(posts, courses));
  writeFile(path.join(distDir, ".nojekyll"), "");
  writeFile(path.join(distDir, "search-index.json"), JSON.stringify(posts.map((post) => ({
    title: post.title,
    url: postUrl(post),
    course: courseForPost(post).title,
    summary: post.summary,
    tags: post.tags,
    date: post.date
  })), null, 2));

  console.log(`Built ${posts.length} post(s) into ${path.relative(root, distDir)}`);
}

build();
