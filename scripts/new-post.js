const fs = require("fs");
const path = require("path");

const root = process.cwd();
const postsDir = path.join(root, "posts");
const title = process.argv.slice(2).join(" ").trim();

function slugify(value) {
  return String(value)
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "untitled";
}

if (!title) {
  console.error('Usage: npm run new "文章标题"');
  process.exit(1);
}

fs.mkdirSync(postsDir, { recursive: true });

const date = new Date().toISOString().slice(0, 10);
const fileName = `${date}-${slugify(title)}.tex`;
const filePath = path.join(postsDir, fileName);

if (fs.existsSync(filePath)) {
  console.error(`Post already exists: ${filePath}`);
  process.exit(1);
}

const template = `% ---
% title: ${title}
% date: ${date}
% author: Crystal-Sky
% tags: LaTeX
% summary: 在这里写一句文章摘要。
% ---

\\section{引言}

这里开始写正文。行内公式示例：$e^{i\\pi}+1=0$。

\\[
  \\int_0^1 x^2\\,dx = \\frac{1}{3}
\\]

\\begin{theorem}[示例]
如果 $a=b$，那么 $a+c=b+c$。
\\end{theorem}

\\begin{proof}
等式两边同时加上 $c$ 即可。
\\end{proof}
`;

fs.writeFileSync(filePath, template, "utf8");
console.log(`Created ${path.relative(root, filePath)}`);
