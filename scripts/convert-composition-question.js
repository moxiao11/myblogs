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

function normalizeExtractedLines(lines) {
  const normalized = [];
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    const previous = normalized[normalized.length - 1] || "";

    if (line === "）" && previous.endsWith("（")) {
      normalized[normalized.length - 1] = `${previous}）`;
      if (lines[index + 1] === "。") {
        normalized[normalized.length - 1] += "。";
        index += 1;
      }
      continue;
    }

    if (line === "。" && previous) {
      normalized[normalized.length - 1] = `${previous}。`;
      continue;
    }

    normalized.push(line);
  }
  return normalized;
}

function closeOptions(output, state) {
  if (state.inOptions) {
    output.push("\\end{enumerate}");
    output.push("");
    state.inOptions = false;
  }
}

function closeParts(output, state) {
  if (state.inParts) {
    output.push("\\end{parts}");
    output.push("");
    state.inParts = false;
  }
}

function closeQuestion(output, state) {
  if (state.inQuestion) {
    closeOptions(output, state);
    closeParts(output, state);
    output.push("\\end{question}");
    output.push("");
    state.inQuestion = false;
  }
}

function closeOpenBlocks(output, state) {
  closeQuestion(output, state);
  closeParts(output, state);
  state.block = "";
}

function writePart(output, state, rawLine) {
  const part = rawLine.match(/^（(\d+)）\s*(.*)$/) || rawLine.match(/^(\d+)\.\s+(.*)$/);
  if (!part) {
    return false;
  }
  if (!state.inParts) {
    output.push("\\begin{parts}");
    state.inParts = true;
  }
  output.push(`\\item ${latexText(part[2])}`);
  return true;
}

function isTableLikeLine(rawLine) {
  return /^(周期|节拍)\s+微操作$/.test(rawLine)
    || /^[CT]\d+\s+/.test(rawLine)
    || /^(MOD|存储单元地址|格式)\s+/.test(rawLine)
    || /^(00|01|10)\s+/.test(rawLine)
    || /^[0-9A-F]{4}H\s+/.test(rawLine)
    || /^(R 型|I 型|J 型)\s+/.test(rawLine);
}

function writeNormalLine(output, state, rawLine) {
  const line = latexText(rawLine);
  const option = rawLine.match(/^([A-D])\.\s*(.*)$/);

  if (/^[1-6]\s+[\u4e00-\u9fffA-Za-z]/.test(rawLine)) {
    closeOpenBlocks(output, state);
    output.push(`\\section{${line}}`);
    output.push("");
    return;
  }

  if (/^[1-6]\.\d+\s+[\u4e00-\u9fffA-Za-z]/.test(rawLine)) {
    closeOpenBlocks(output, state);
    output.push(`\\subsection{${line}}`);
    output.push("");
    return;
  }

  if (rawLine === "本部分重点") {
    closeOpenBlocks(output, state);
    output.push("\\subsection*{本部分重点}");
    output.push("");
    return;
  }

  if (rawLine === "知识点：") {
    closeOpenBlocks(output, state);
    output.push("\\textbf{知识点：}");
    output.push("");
    return;
  }

  if (/^题目\s+/.test(rawLine)) {
    closeOpenBlocks(output, state);
    output.push(`\\begin{question}{${line}}`);
    state.inQuestion = true;
    state.block = "question";
    return;
  }

  if (state.inQuestion && writePart(output, state, rawLine)) {
    return;
  }

  if (state.inQuestion && option) {
    if (!state.inOptions) {
      closeParts(output, state);
      output.push("\\begin{enumerate}");
      state.inOptions = true;
    }
    output.push(`\\item ${latexText(option[2])}`);
    return;
  }

  if (state.inQuestion && state.inOptions) {
    closeOptions(output, state);
  }

  if (/^答案：/.test(rawLine)) {
    closeOpenBlocks(output, state);
    state.block = "answer";
    const answer = rawLine.replace(/^答案：\s*/, "");
    output.push("");
    output.push(`\\textbf{${latexText("答案：")}}${answer ? "" : ""}`);
    if (answer) {
      if (!writePart(output, state, answer)) {
        output[output.length - 1] += ` ${latexText(answer)}`;
      }
    }
    return;
  }

  if (/^解析：/.test(rawLine)) {
    closeOpenBlocks(output, state);
    state.block = "explanation";
    const explanation = rawLine.replace(/^解析：\s*/, "");
    output.push("");
    output.push(`\\textbf{${latexText("解析：")}}${explanation ? "" : ""}`);
    if (explanation) {
      if (!writePart(output, state, explanation)) {
        output[output.length - 1] += ` ${latexText(explanation)}`;
      }
    }
    return;
  }

  if ((state.block === "answer" || state.block === "explanation") && writePart(output, state, rawLine)) {
    return;
  }

  output.push(isTableLikeLine(rawLine) ? `${line} \\\\` : line);
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
  const state = { block: "", inQuestion: false, inOptions: false, inParts: false };

  const firstTitle = lines.findIndex((line) => line === "计算机组成原理题库分类整理");
  const contentStarts = lines
    .map((line, index) => (line === "1 数据的编码表示" ? index : -1))
    .filter((index) => index >= 0);
  const actualStart = contentStarts.length > 1 ? contentStarts[1] : contentStarts[0];
  const start = actualStart >= 0 ? actualStart : Math.max(firstTitle + 1, 0);
  for (let index = start; index < lines.length; index += 1) {
    writeNormalLine(output, state, lines[index]);
  }
  closeOpenBlocks(output, state);

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
const lines = normalizeExtractedLines(stripPdfNoise(raw.split(/\r?\n/)));
fs.writeFileSync(postPath, convert(lines), "utf8");
console.log(`Wrote ${path.relative(root, postPath)} from ${path.relative(root, pdfPath)}`);
