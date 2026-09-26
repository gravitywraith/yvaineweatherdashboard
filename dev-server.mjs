import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { createServer } from "node:http";
import { extname, join, normalize, resolve } from "node:path";

const host = "0.0.0.0";
const port = 4174;
const publicDirectory = resolve(".");
const contentTypes = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
};

createServer(async (request, response) => {
  const pathname = decodeURIComponent(new URL(request.url, `http://${request.headers.host}`).pathname);
  const requestedFile = pathname === "/" ? "index.html" : pathname.slice(1);
  const filePath = resolve(publicDirectory, normalize(requestedFile));

  if (!filePath.startsWith(`${publicDirectory}\\`) && filePath !== publicDirectory) {
    response.writeHead(403).end("Forbidden");
    return;
  }

  try {
    const file = await stat(filePath);
    const finalPath = file.isDirectory() ? join(filePath, "index.html") : filePath;
    response.writeHead(200, { "Content-Type": contentTypes[extname(finalPath)] ?? "application/octet-stream" });
    createReadStream(finalPath).pipe(response);
  } catch {
    response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" }).end("File not found");
  }
}).listen(port, host, () => {
  console.log(`Yvaine is available at http://localhost:${port}`);
});
