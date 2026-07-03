const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const root = process.cwd();
const pdfPath = path.join(root, "assets", "composition-question.pdf");
const tmpDir = path.join(root, "tmp", "pdf-extract");
const textPath = path.join(tmpDir, "composition-question-raw.txt");
const postPath = path.join(root, "posts", "2026-07-03-computer-organization-final-question-bank.tex");

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function latexText(value) {
  return String(value)
    .replace(/\\/g, "\\textbackslash{}")
    .replace(/([%&_#{}])/g, "\\$1");
}

function stripPdfNoise(lines) {
  const cleaned = [];
  for (let index = 0; index < lines.length; index += 1) {
    const rawLine = lines[index];
    const line = rawLine.replace(/\f/g, "").trim();
    const nextLine = lines[index + 1] || "";
    const isLastContentLine = lines.slice(index + 1).every((laterLine) => laterLine.replace(/\f/g, "").trim() === "");
    const isPageNumber = /^\d+$/.test(line) && /^\f?计算机组成原理题库分类整理\s+期末复习/.test(nextLine);

    if (!line || isPageNumber || (/^\d+$/.test(line) && isLastContentLine) || line === "计算机组成原理题库分类整理 期末复习") {
      continue;
    }
    cleaned.push(line);
  }
  return cleaned;
}

function closeQuestion(output, state) {
  if (state.inQuestion) {
    output.push("\\end{question}");
    output.push("");
    state.inQuestion = false;
  }
}

function writeNormalLine(output, state, rawLine) {
  const line = latexText(rawLine);

  if (/^[1-6]\s+[\u4e00-\u9fffA-Za-z]/.test(rawLine)) {
    closeQuestion(output, state);
    output.push(`\\section{${line}}`);
    output.push("");
    return;
  }

  if (/^[1-6]\.\d+\s+[\u4e00-\u9fffA-Za-z]/.test(rawLine)) {
    closeQuestion(output, state);
    output.push(`\\subsection{${line}}`);
    output.push("");
    return;
  }

  if (rawLine === "本部分重点") {
    closeQuestion(output, state);
    output.push("\\subsection*{本部分重点}");
    output.push("");
    return;
  }

  if (rawLine === "知识点：") {
    closeQuestion(output, state);
    output.push("\\textbf{知识点：}");
    return;
  }

  if (/^题目\s+/.test(rawLine)) {
    closeQuestion(output, state);
    output.push(`\\begin{question}{${line}}`);
    state.inQuestion = true;
    return;
  }

  if (/^答案：/.test(rawLine)) {
    closeQuestion(output, state);
    output.push(`\\textbf{${latexText("答案：")}} ${latexText(rawLine.replace(/^答案：\s*/, ""))}`);
    return;
  }

  if (/^解析：/.test(rawLine)) {
    closeQuestion(output, state);
    output.push(`\\textbf{${latexText("解析：")}} ${latexText(rawLine.replace(/^解析：\s*/, ""))}`);
    return;
  }

  output.push(line);
}

function convert(lines) {
  const output = [
    "% ---",
    "% title: 计算机组成原理期末复习题库",
    "% date: 2026-07-03",
    "% author: Crystal-Sky",
    "% tags: 计算机组成原理, 计组, 期末复习, 题库",
    "% summary: 《计算机组成原理》期末复习题库 PDF 转写版，正文可在博客直接阅读，并保留原始 PDF 下载。",
    "% slug: computer-organization-final-question-bank",
    "% pdf: assets/composition-question.pdf",
    "% ---",
    ""
  ];
  const state = { inQuestion: false };

  const firstTitle = lines.findIndex((line) => line === "计算机组成原理题库分类整理");
  const contentStarts = lines
    .map((line, index) => (line === "1 数据的编码表示" ? index : -1))
    .filter((index) => index >= 0);
  const actualStart = contentStarts.length > 1 ? contentStarts[1] : contentStarts[0];
  const tocStart = lines.findIndex((line) => line === "目录");

  if (tocStart >= 0 && actualStart > tocStart) {
    output.push("\\section*{目录}");
    output.push("");
    for (let index = tocStart + 1; index < actualStart; index += 1) {
      output.push(latexText(lines[index]));
    }
    output.push("");
  }

  const start = actualStart >= 0 ? actualStart : Math.max(firstTitle + 1, 0);
  for (let index = start; index < lines.length; index += 1) {
    writeNormalLine(output, state, lines[index]);
  }
  closeQuestion(output, state);

  return `${output.join("\n").replace(/\n{3,}/g, "\n\n")}\n`;
}

ensureDir(tmpDir);
const extracted = spawnSync("pdftotext", ["-raw", "-enc", "UTF-8", pdfPath, textPath], {
  cwd: root,
  encoding: "utf8"
});

if (extracted.status !== 0) {
  throw new Error(`pdftotext failed: ${extracted.stderr || extracted.stdout}`);
}

const raw = fs.readFileSync(textPath, "utf8");
const lines = stripPdfNoise(raw.split(/\r?\n/));
fs.writeFileSync(postPath, convert(lines), "utf8");
console.log(`Wrote ${path.relative(root, postPath)} from ${path.relative(root, pdfPath)}`);
