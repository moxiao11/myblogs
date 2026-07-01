const fs = require("fs");
const http = require("http");
const path = require("path");
const { spawnSync } = require("child_process");

const root = process.cwd();
const distDir = path.join(root, "dist");
const port = Number(process.env.PORT || 4173);
const host = process.env.HOST || "127.0.0.1";

const types = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".xml": "application/xml; charset=utf-8",
  ".svg": "image/svg+xml; charset=utf-8"
};

function build() {
  const result = spawnSync(process.execPath, [path.join("scripts", "build.js")], {
    cwd: root,
    stdio: "inherit"
  });
  return result.status === 0;
}

function resolveRequest(url) {
  const requestPath = decodeURIComponent(new URL(url, `http://${host}:${port}`).pathname);
  const safePath = path.normalize(requestPath).replace(/^(\.\.[/\\])+/, "");
  let filePath = path.join(distDir, safePath);

  if (requestPath.endsWith("/")) {
    filePath = path.join(filePath, "index.html");
  }

  if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
    filePath = path.join(distDir, "404.html");
  }

  return filePath;
}

build();

const server = http.createServer((req, res) => {
  const filePath = resolveRequest(req.url || "/");
  const ext = path.extname(filePath);
  res.setHeader("Content-Type", types[ext] || "application/octet-stream");
  fs.createReadStream(filePath).pipe(res);
});

server.listen(port, host, () => {
  console.log(`Blog preview: http://${host}:${port}`);
});

const watchTargets = ["posts", "assets", "scripts"]
  .map((folder) => path.join(root, folder))
  .filter((folder) => fs.existsSync(folder));

let timer = null;
for (const folder of watchTargets) {
  fs.watch(folder, { recursive: true }, () => {
    clearTimeout(timer);
    timer = setTimeout(build, 150);
  });
}
