const elements = {
  blogPreview: document.querySelector("#blog-preview"),
  blogTab: document.querySelector("#blog-tab"),
  closeError: document.querySelector("#close-error"),
  compileStatus: document.querySelector("#compile-status"),
  createPost: document.querySelector("#create-post"),
  currentTitle: document.querySelector("#current-title"),
  dirtyDot: document.querySelector("#dirty-dot"),
  documentMode: document.querySelector("#document-mode"),
  editor: document.querySelector("#source-editor"),
  emptyPdf: document.querySelector("#empty-pdf"),
  errorOutput: document.querySelector("#error-output"),
  errorPanel: document.querySelector("#error-panel"),
  fileName: document.querySelector("#file-name"),
  lineCount: document.querySelector("#line-count"),
  lineNumbers: document.querySelector("#line-numbers"),
  newFolder: document.querySelector("#new-folder"),
  newPostButton: document.querySelector("#new-post-button"),
  newPostDialog: document.querySelector("#new-post-dialog"),
  newPostForm: document.querySelector("#new-post-form"),
  newTitle: document.querySelector("#new-title"),
  openPreview: document.querySelector("#open-preview"),
  pageBadge: document.querySelector("#page-badge"),
  pdfPreview: document.querySelector("#pdf-preview"),
  pdfTab: document.querySelector("#pdf-tab"),
  postList: document.querySelector("#post-list"),
  postSearch: document.querySelector("#post-search"),
  previewLoading: document.querySelector("#preview-loading"),
  refreshList: document.querySelector("#refresh-list"),
  reloadPreview: document.querySelector("#reload-preview"),
  saveButton: document.querySelector("#save-button"),
  saveState: document.querySelector("#save-state"),
  saveTemplate: document.querySelector("#save-template"),
  statusDot: document.querySelector("#status-dot"),
  templateButton: document.querySelector("#template-button"),
  templateDialog: document.querySelector("#template-dialog"),
  templateEditor: document.querySelector("#template-editor"),
  templateForm: document.querySelector("#template-form"),
  templateSelect: document.querySelector("#template-select"),
  toast: document.querySelector("#toast"),
  wordCount: document.querySelector("#word-count")
};

const state = {
  posts: [],
  templates: [],
  currentPath: "",
  currentTitle: "",
  fullDocument: false,
  previewUrl: "",
  pdfUrl: "",
  pdfObjectUrl: false,
  pdfFresh: false,
  previewMode: "blog",
  dirty: false,
  saveTimer: null,
  compileTimer: null,
  compileController: null,
  revision: 0
};

async function request(url, options) {
  const response = await fetch(url, options);
  const contentType = response.headers.get("content-type") || "";
  const value = contentType.includes("application/json") ? await response.json() : await response.blob();
  if (!response.ok) throw new Error(value.error || `请求失败（${response.status}）`);
  return { response, value };
}

function notify(message, error = false) {
  elements.toast.textContent = message;
  elements.toast.classList.toggle("error", error);
  elements.toast.classList.add("visible");
  clearTimeout(notify.timer);
  notify.timer = setTimeout(() => elements.toast.classList.remove("visible"), 2200);
}

function setStatus(text, kind = "") {
  elements.compileStatus.textContent = text;
  elements.statusDot.className = `status-dot ${kind}`.trim();
}

function titleFromSource(source, fallback) {
  const meta = source.match(/^%\s*---[\s\S]*?^%\s*title\s*:\s*(.+)$/mi);
  const latex = source.match(/\\title\{([^}]+)\}/);
  return (meta && meta[1].trim()) || (latex && latex[1].trim()) || fallback;
}

function updateEditorMeta() {
  const source = elements.editor.value;
  const lines = source.split("\n");
  elements.lineNumbers.textContent = lines.map((_, index) => index + 1).join("\n");
  elements.lineCount.textContent = `${lines.length} 行`;
  const compact = source.replace(/%.*$/gm, "").replace(/\\[a-zA-Z@]+\*?(?:\[[^\]]*\])?/g, " ").replace(/[{}$\\]/g, " ").trim();
  const chinese = (compact.match(/[\u3400-\u9fff]/g) || []).length;
  const words = (compact.replace(/[\u3400-\u9fff]/g, " ").match(/[A-Za-z0-9_]+/g) || []).length;
  elements.wordCount.textContent = `${chinese + words} 字`;
  state.currentTitle = titleFromSource(source, state.currentTitle || "未命名文章");
  elements.currentTitle.textContent = state.currentTitle;
}

function groupPosts(posts) {
  return posts.reduce((groups, post) => {
    const key = post.folder || "根目录";
    if (!groups[key]) groups[key] = [];
    groups[key].push(post);
    return groups;
  }, {});
}

function renderPosts(filter = "") {
  const query = filter.trim().toLowerCase();
  const visible = state.posts.filter((post) => `${post.title} ${post.path}`.toLowerCase().includes(query));
  const groups = groupPosts(visible);
  elements.postList.replaceChildren();

  for (const [folder, posts] of Object.entries(groups)) {
    const label = document.createElement("div");
    label.className = "folder-label";
    label.textContent = folder;
    elements.postList.append(label);
    for (const post of posts) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = `post-item${post.path === state.currentPath ? " active" : ""}`;
      button.dataset.path = post.path;
      button.innerHTML = `<span class="file-glyph">TEX</span><span class="post-copy"><strong></strong><small></small></span>`;
      button.querySelector("strong").textContent = post.title;
      button.querySelector("small").textContent = post.path;
      button.addEventListener("click", () => openPost(post.path));
      elements.postList.append(button);
    }
  }
  if (!visible.length) {
    const empty = document.createElement("div");
    empty.className = "folder-label";
    empty.textContent = "没有匹配的文章";
    elements.postList.append(empty);
  }
}

async function loadWorkspace(preferredPath = "") {
  const { value } = await request("/api/posts");
  state.posts = value.posts.sort((a, b) => new Date(b.modifiedAt) - new Date(a.modifiedAt));
  state.templates = value.templates;
  elements.templateSelect.replaceChildren(...state.templates.map((template) => {
    const option = document.createElement("option");
    option.value = template.id;
    option.textContent = template.name;
    return option;
  }));
  const savedTemplate = localStorage.getItem("paperleaf-template");
  if (savedTemplate && state.templates.some((item) => item.id === savedTemplate)) elements.templateSelect.value = savedTemplate;
  renderPosts(elements.postSearch.value);
  if (!state.posts.length) return;
  const remembered = preferredPath || localStorage.getItem("paperleaf-current-post");
  const next = state.posts.find((post) => post.path === remembered) || state.posts[0];
  if (next.path !== state.currentPath) await openPost(next.path);
}

async function openPost(relative) {
  if (state.dirty) await saveCurrent(false);
  setStatus("正在读取文章", "working");
  const { value } = await request(`/api/post?path=${encodeURIComponent(relative)}`);
  state.currentPath = value.path;
  state.fullDocument = value.fullDocument;
  state.previewUrl = value.previewUrl || "";
  if (state.pdfObjectUrl && state.pdfUrl) URL.revokeObjectURL(state.pdfUrl);
  state.pdfUrl = value.initialPdfUrl || "";
  state.pdfObjectUrl = false;
  state.pdfFresh = Boolean(value.pdfFresh);
  state.dirty = false;
  state.revision += 1;
  elements.editor.value = value.source;
  elements.fileName.textContent = value.path.split("/").pop();
  elements.dirtyDot.classList.remove("visible");
  elements.saveState.textContent = "已保存";
  elements.documentMode.textContent = value.fullDocument ? "完整文档 · 自带模板" : `正文片段 · ${elements.templateSelect.value || "blog.tex"}`;
  state.currentTitle = titleFromSource(value.source, elements.fileName.textContent);
  localStorage.setItem("paperleaf-current-post", value.path);
  updateEditorMeta();
  renderPosts(elements.postSearch.value);
  refreshBlogPreview();
  elements.pdfPreview.src = state.pdfUrl ? `${state.pdfUrl}#toolbar=1&navpanes=0&view=FitH` : "";
  elements.pageBadge.hidden = true;
  setStatus("博客预览已同步", "success");
}

function markDirty() {
  if (!state.currentPath) return;
  state.dirty = true;
  state.revision += 1;
  elements.dirtyDot.classList.add("visible");
  elements.saveState.textContent = "未保存";
  setStatus("等待自动保存…", "working");
  updateEditorMeta();
  clearTimeout(state.saveTimer);
  clearTimeout(state.compileTimer);
  state.saveTimer = setTimeout(() => saveCurrent(false), 650);
}

async function saveCurrent(showNotice = true) {
  if (!state.currentPath) return;
  clearTimeout(state.saveTimer);
  const source = elements.editor.value;
  const revision = state.revision;
  elements.saveState.textContent = "保存中…";
  setStatus("正在同步博客效果", "working");
  try {
    const { value } = await request("/api/post", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path: state.currentPath, source })
    });
    if (revision === state.revision) {
      state.dirty = false;
      elements.dirtyDot.classList.remove("visible");
      elements.saveState.textContent = "已自动保存";
    }
    state.previewUrl = value.previewUrl || state.previewUrl;
    state.pdfFresh = false;
    refreshBlogPreview();
    if (state.previewMode === "pdf") scheduleCompile(1200);
    setStatus("博客效果已更新", "success");
    if (showNotice) notify("已保存，博客与 PDF 预览正在更新");
  } catch (error) {
    elements.saveState.textContent = "保存失败";
    setStatus("保存失败", "error");
    notify(error.message, true);
  }
}

function refreshBlogPreview() {
  if (!state.previewUrl) return;
  elements.previewLoading.hidden = false;
  elements.blogPreview.src = `${state.previewUrl}?studio=${Date.now()}`;
  if (state.previewMode === "blog") {
    elements.blogPreview.style.display = "block";
    elements.pdfPreview.style.display = "none";
    elements.emptyPdf.hidden = true;
  }
}

function scheduleCompile(delay = 250) {
  clearTimeout(state.compileTimer);
  state.compileTimer = setTimeout(compilePdf, delay);
}

async function compilePdf(force = false) {
  if (!state.currentPath) return;
  if (state.compileController) state.compileController.abort();
  const controller = new AbortController();
  state.compileController = controller;
  const revision = state.revision;
  setStatus("XeLaTeX 正在编译…", "working");
  if (state.previewMode === "pdf" && !state.pdfUrl) elements.emptyPdf.hidden = false;
  try {
    const response = await fetch("/api/compile", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        path: state.currentPath,
        source: elements.editor.value,
        template: elements.templateSelect.value || "blog.tex",
        force
      }),
      signal: controller.signal
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || "PDF 编译失败");
    }
    const blob = await response.blob();
    if (revision !== state.revision) return;
    if (state.pdfObjectUrl && state.pdfUrl) URL.revokeObjectURL(state.pdfUrl);
    state.pdfUrl = URL.createObjectURL(blob);
    state.pdfObjectUrl = true;
    state.pdfFresh = true;
    elements.pdfPreview.src = `${state.pdfUrl}#toolbar=1&navpanes=0&view=FitH`;
    const pages = response.headers.get("X-Page-Count");
    const duration = Number(response.headers.get("X-Compile-Ms") || 0);
    const cacheHit = response.headers.get("X-Compile-Cache") === "hit";
    elements.pageBadge.hidden = !pages;
    elements.pageBadge.textContent = pages ? `${pages} 页` : "";
    elements.errorPanel.hidden = true;
    elements.emptyPdf.hidden = true;
    setStatus(cacheHit ? "PDF 已从缓存打开 · 即时" : `PDF 已更新 · ${(duration / 1000).toFixed(1)}s`, "success");
  } catch (error) {
    if (error.name === "AbortError") return;
    elements.errorOutput.textContent = error.message;
    elements.errorPanel.hidden = false;
    elements.emptyPdf.hidden = true;
    setStatus("博客已同步 · PDF 有编译错误", "error");
  } finally {
    if (state.compileController === controller) state.compileController = null;
  }
}

function setPreviewMode(mode) {
  state.previewMode = mode;
  const blog = mode === "blog";
  elements.blogTab.classList.toggle("active", blog);
  elements.pdfTab.classList.toggle("active", !blog);
  elements.blogTab.setAttribute("aria-selected", String(blog));
  elements.pdfTab.setAttribute("aria-selected", String(!blog));
  elements.blogPreview.style.display = blog ? "block" : "none";
  elements.pdfPreview.style.display = blog ? "none" : "block";
  elements.emptyPdf.hidden = blog || Boolean(state.pdfUrl);
  if (!blog && (!state.pdfUrl || !state.pdfFresh)) scheduleCompile(0);
}

async function openTemplateDialog() {
  try {
    const id = elements.templateSelect.value || "blog.tex";
    const { value } = await request(`/api/template?id=${encodeURIComponent(id)}`);
    elements.templateEditor.value = value.source;
    elements.templateDialog.showModal();
  } catch (error) {
    notify(error.message, true);
  }
}

elements.editor.addEventListener("input", markDirty);
elements.editor.addEventListener("scroll", () => { elements.lineNumbers.scrollTop = elements.editor.scrollTop; });
elements.editor.addEventListener("keydown", (event) => {
  if (event.key === "Tab") {
    event.preventDefault();
    const start = elements.editor.selectionStart;
    elements.editor.setRangeText("  ", start, elements.editor.selectionEnd, "end");
    markDirty();
  }
});
elements.blogPreview.addEventListener("load", () => { elements.previewLoading.hidden = true; });
elements.blogTab.addEventListener("click", () => setPreviewMode("blog"));
elements.pdfTab.addEventListener("click", () => setPreviewMode("pdf"));
elements.saveButton.addEventListener("click", () => saveCurrent(true));
elements.reloadPreview.addEventListener("click", () => state.previewMode === "blog" ? refreshBlogPreview() : compilePdf(true));
elements.openPreview.addEventListener("click", () => {
  const url = state.previewMode === "blog" ? elements.blogPreview.src : state.pdfUrl;
  if (url) window.open(url, "_blank", "noopener");
});
elements.closeError.addEventListener("click", () => { elements.errorPanel.hidden = true; });
elements.postSearch.addEventListener("input", () => renderPosts(elements.postSearch.value));
elements.refreshList.addEventListener("click", () => loadWorkspace(state.currentPath).catch((error) => notify(error.message, true)));
elements.newPostButton.addEventListener("click", () => {
  elements.newPostForm.reset();
  elements.newPostDialog.showModal();
  setTimeout(() => elements.newTitle.focus(), 40);
});
elements.newPostForm.addEventListener("submit", async (event) => {
  if (event.submitter?.value === "cancel") return;
  event.preventDefault();
  try {
    const { value } = await request("/api/posts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: elements.newTitle.value, folder: elements.newFolder.value })
    });
    elements.newPostDialog.close();
    await loadWorkspace(value.path);
    notify("新草稿已创建");
  } catch (error) {
    notify(error.message, true);
  }
});
elements.templateButton.addEventListener("click", openTemplateDialog);
elements.templateSelect.addEventListener("change", async () => {
  localStorage.setItem("paperleaf-template", elements.templateSelect.value);
  const { value } = await request(`/api/template?id=${encodeURIComponent(elements.templateSelect.value)}`);
  elements.templateEditor.value = value.source;
});
elements.templateForm.addEventListener("submit", async (event) => {
  if (event.submitter?.value === "cancel") return;
  event.preventDefault();
  try {
    await request("/api/template", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: elements.templateSelect.value, source: elements.templateEditor.value })
    });
    elements.templateDialog.close();
    elements.documentMode.textContent = state.fullDocument ? "完整文档 · 自带模板" : `正文片段 · ${elements.templateSelect.value}`;
    if (state.previewMode === "pdf") scheduleCompile(0);
    notify("模板已保存并重新编译");
  } catch (error) {
    notify(error.message, true);
  }
});

window.addEventListener("keydown", (event) => {
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "s") {
    event.preventDefault();
    saveCurrent(true);
  }
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
    event.preventDefault();
    elements.postSearch.focus();
  }
});

window.addEventListener("beforeunload", (event) => {
  if (!state.dirty) return;
  event.preventDefault();
  event.returnValue = "";
});

loadWorkspace().catch((error) => {
  setStatus("工作台启动失败", "error");
  notify(error.message, true);
});
