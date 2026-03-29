import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import leadHandler from "./api/lead.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const port = Number(process.env.PORT || 3000);

loadEnvFile(path.join(__dirname, ".env"));

const mimeTypes = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8"
};

const server = createServer(async (request, response) => {
  try {
    const url = new URL(request.url || "/", `http://${request.headers.host || "localhost"}`);

    if (url.pathname === "/api/lead") {
      await handleLeadRequest(request, response);
      return;
    }

    if (request.method !== "GET" && request.method !== "HEAD") {
      response.writeHead(405, { "Content-Type": "application/json; charset=utf-8" });
      response.end(JSON.stringify({ message: "Метод не поддерживается" }));
      return;
    }

    await serveStaticFile(url.pathname, response, request.method === "HEAD");
  } catch (error) {
    response.writeHead(500, { "Content-Type": "application/json; charset=utf-8" });
    response.end(JSON.stringify({ message: "Внутренняя ошибка сервера" }));
  }
});

server.listen(port, () => {
  console.log(`Локальный сервер запущен: http://localhost:${port}`);
});

async function handleLeadRequest(request, response) {
  const body = await readJsonBody(request);

  const apiRequest = {
    body,
    headers: request.headers,
    method: request.method
  };

  const apiResponse = createJsonResponse(response);
  await leadHandler(apiRequest, apiResponse);
}

async function readJsonBody(request) {
  const chunks = [];

  for await (const chunk of request) {
    chunks.push(chunk);
  }

  const rawBody = Buffer.concat(chunks).toString("utf8");

  if (!rawBody) {
    return {};
  }

  try {
    return JSON.parse(rawBody);
  } catch (error) {
    return {};
  }
}

function createJsonResponse(response) {
  return {
    headersSent: false,
    status(code) {
      this.statusCode = code;
      return this;
    },
    setHeader(name, value) {
      response.setHeader(name, value);
      return this;
    },
    json(payload) {
      const statusCode = this.statusCode || 200;
      response.writeHead(statusCode, {
        "Content-Type": "application/json; charset=utf-8"
      });
      response.end(JSON.stringify(payload));
      this.headersSent = true;
      return this;
    }
  };
}

async function serveStaticFile(requestPath, response, isHeadRequest) {
  const safePath = requestPath === "/" ? "/index.html" : requestPath;
  const normalizedPath = path.normalize(safePath).replace(/^(\.\.[/\\])+/, "");
  const filePath = path.join(__dirname, normalizedPath);

  if (!filePath.startsWith(__dirname)) {
    response.writeHead(403, { "Content-Type": "text/plain; charset=utf-8" });
    response.end("Доступ запрещён");
    return;
  }

  if (!existsSync(filePath)) {
    response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    response.end("Файл не найден");
    return;
  }

  const extension = path.extname(filePath);
  const contentType = mimeTypes[extension] || "application/octet-stream";
  const fileContents = await readFile(filePath);

  response.writeHead(200, { "Content-Type": contentType });

  if (isHeadRequest) {
    response.end();
    return;
  }

  response.end(fileContents);
}

function loadEnvFile(envPath) {
  if (!existsSync(envPath)) {
    return;
  }

  const contents = readFileSync(envPath, "utf8");
  const lines = contents.split(/\r?\n/);

  for (const line of lines) {
    const trimmedLine = line.trim();

    if (!trimmedLine || trimmedLine.startsWith("#")) {
      continue;
    }

    const separatorIndex = trimmedLine.indexOf("=");

    if (separatorIndex === -1) {
      continue;
    }

    const key = trimmedLine.slice(0, separatorIndex).trim();
    const value = trimmedLine.slice(separatorIndex + 1).trim();

    if (!process.env[key]) {
      process.env[key] = stripWrappingQuotes(value);
    }
  }
}

function stripWrappingQuotes(value) {
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    return value.slice(1, -1);
  }

  return value;
}
