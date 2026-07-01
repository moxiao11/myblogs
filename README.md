# Crystal Sky LaTeX Blog

这是一个零依赖的静态博客生成器，专门为 LaTeX 写作准备。文章放在 `posts/*.tex`，运行构建命令后会生成 `dist/`，可以部署到 GitHub Pages、Netlify、Vercel 或任意静态托管服务。

## 本地使用

```bash
npm run dev
```

打开终端输出里的本地地址即可预览。开发服务器会监听 `posts/`、`assets/` 和 `scripts/` 的变化并自动重新构建。

## 新建文章

```bash
npm run new "我的第一篇 LaTeX 博客"
```

这会在 `posts/` 里创建一篇 `.tex` 草稿。写完后运行：

```bash
npm run build
```

生成的网站文件在 `dist/`。

## 文章格式

推荐在 `.tex` 文件顶部写元信息：

```tex
% ---
% title: 文章标题
% date: 2026-07-01
% author: Crystal-Sky
% tags: LaTeX, 数学, 算法
% summary: 首页和 RSS 中显示的摘要。
% ---
```

正文支持常见 LaTeX 写法：

- `\section{}`、`\subsection{}`、`\subsubsection{}`
- 行内公式 `$a^2+b^2=c^2$` 和 `\( ... \)`
- 展示公式 `\[ ... \]`、`$$ ... $$`
- `equation`、`align`、`gather`、`multline` 等数学环境
- `itemize`、`enumerate`
- `abstract`、`theorem`、`lemma`、`definition`、`proposition`、`corollary`、`proof`
- `verbatim` 代码块
- `\textbf{}`、`\emph{}`、`\textit{}`、`\texttt{}`、`\href{}{}`、`\url{}`

## GitHub Pages 部署

1. 在 GitHub 新建一个仓库，例如 `crystal-sky-blog`。
2. 把本目录推送到该仓库。
3. 打开仓库 `Settings -> Pages`，`Source` 选择 `GitHub Actions`。
4. 推送到 `main` 分支后，`.github/workflows/deploy.yml` 会自动构建并发布 `dist/`。

如果你使用自定义域名，在仓库的 Pages 设置里添加域名；也可以在 `dist/` 生成阶段加入 `CNAME` 文件。

当前自定义域名配置为：

```text
ustbcode.top
```

DNS 解析建议：

- 根域名 `ustbcode.top`：添加 4 条 `A` 记录，主机记录为 `@`，记录值分别为 GitHub Pages 的 4 个 IPv4 地址。
- 可选 `www.ustbcode.top`：添加 1 条 `CNAME` 记录，主机记录为 `www`，记录值为 `moxiao11.github.io`。

## 从博客园迁移

博客园旧站链接已经放进站点导航：<https://www.cnblogs.com/Crystal-Sky>。后续可以把旧文章逐篇转成 `.tex` 或 Markdown/LaTeX 混写，再放入 `posts/` 统一发布。
