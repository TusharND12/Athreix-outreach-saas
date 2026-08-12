import { createServer, type IncomingMessage } from "node:http";
import {
  executeSearchTask,
  SearchTaskRequestError,
} from "@/server/search-task-handler";

const MAX_BODY_BYTES = 16_384;

function readBody(request: IncomingMessage) {
  return new Promise<string>((resolve, reject) => {
    const chunks: Buffer[] = [];
    let size = 0;
    request.on("data", (chunk: Buffer) => {
      size += chunk.length;
      if (size > MAX_BODY_BYTES) {
        reject(new SearchTaskRequestError("Task body is too large", 413));
        request.resume();
        return;
      }
      chunks.push(chunk);
    });
    request.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    request.on("error", reject);
  });
}

const server = createServer(async (request, response) => {
  response.setHeader("cache-control", "no-store");
  if (request.method === "GET" && request.url === "/health") {
    response.writeHead(200, { "content-type": "application/json" });
    response.end(JSON.stringify({ status: "ok", dispatch: "cloud_tasks" }));
    return;
  }
  if (request.method !== "POST" || request.url !== "/tasks/search") {
    response.writeHead(404).end();
    return;
  }
  try {
    const body = await readBody(request);
    const signature = request.headers["x-athreix-task-signature"];
    await executeSearchTask({
      body,
      signature: typeof signature === "string" ? signature : "",
      retryCount:
        typeof request.headers["x-cloudtasks-taskretrycount"] === "string"
          ? request.headers["x-cloudtasks-taskretrycount"]
          : undefined,
    });
    response.writeHead(204).end();
  } catch (error) {
    const status = error instanceof SearchTaskRequestError ? error.status : 500;
    console.error(
      "Search task failed",
      error instanceof Error ? error.message : "Unknown worker error",
    );
    response.writeHead(status).end();
  }
});

const port = Number.parseInt(process.env.PORT ?? "8080", 10);
server.listen(port, "0.0.0.0", () => {
  console.info(`Athreix search worker listening on port ${port}`);
});

function shutdown() {
  server.close((error) => {
    if (error) {
      console.error("Search worker shutdown failed", error.message);
      process.exitCode = 1;
    }
  });
}

process.once("SIGTERM", shutdown);
process.once("SIGINT", shutdown);
