import { readFile, stat } from "node:fs/promises";
import http from "node:http";
import https from "node:https";
import path from "node:path";

import {
  buildFrontendCsp,
  frontendSecurityHeaders
} from "../../Frontend/web-admin/csp-config.mjs";

const required = (name) => {
  const value = String(process.env[name] || "").trim();
  if (!value) throw new Error(`${name} is required.`);
  return value;
};

const certificate = await readFile(required("RC_HTTPS_CERT_FILE"));
const privateKey = await readFile(required("RC_HTTPS_KEY_FILE"));
const webRoot = path.resolve(required("RC_WEB_ROOT"));
const publicOrigin = new URL(required("RC_PUBLIC_ORIGIN"));
const apiUpstream = new URL(required("RC_API_UPSTREAM"));
const storageUpstream = new URL(required("RC_STORAGE_UPSTREAM"));
const port = Number(publicOrigin.port || 443);
const host = process.env.RC_HTTPS_HOST || "0.0.0.0";

if (publicOrigin.protocol !== "https:") {
  throw new Error("RC_PUBLIC_ORIGIN must use HTTPS.");
}
for (const upstream of [apiUpstream, storageUpstream]) {
  if (upstream.protocol !== "http:") {
    throw new Error("RC upstreams must use internal HTTP endpoints.");
  }
}

const csp = buildFrontendCsp({
  apiOrigin: publicOrigin.origin,
  storageOrigin: publicOrigin.origin,
  includeFrameAncestors: true,
  upgradeInsecureRequests: true
});
const securityHeaders = frontendSecurityHeaders(csp);
const contentTypes = new Map([
  [".css", "text/css; charset=utf-8"],
  [".html", "text/html; charset=utf-8"],
  [".ico", "image/x-icon"],
  [".js", "text/javascript; charset=utf-8"],
  [".json", "application/json; charset=utf-8"],
  [".png", "image/png"],
  [".svg", "image/svg+xml"],
  [".webp", "image/webp"]
]);

const applySecurityHeaders = (response) => {
  for (const [name, value] of Object.entries(securityHeaders)) {
    response.setHeader(name, value);
  }
  response.setHeader("Cache-Control", "no-store");
};

const proxyRequest = (request, response, upstream) => {
  const target = new URL(request.url || "/", upstream);
  const headers = { ...request.headers, host: target.host };
  delete headers["content-length"];
  const proxied = http.request(
    target,
    {
      method: request.method,
      headers
    },
    (upstreamResponse) => {
      for (const [name, value] of Object.entries(upstreamResponse.headers)) {
        if (value !== undefined) response.setHeader(name, value);
      }
      applySecurityHeaders(response);
      response.writeHead(upstreamResponse.statusCode || 502);
      upstreamResponse.pipe(response);
    }
  );
  proxied.on("error", () => {
    applySecurityHeaders(response);
    response.writeHead(502, { "Content-Type": "application/json" });
    response.end(JSON.stringify({ message: "RC upstream unavailable." }));
  });
  request.pipe(proxied);
};

const serveStatic = async (request, response) => {
  const requestPath = decodeURIComponent(new URL(request.url || "/", publicOrigin).pathname);
  const relative = requestPath === "/" ? "index.html" : requestPath.replace(/^\/+/u, "");
  const candidate = path.resolve(webRoot, relative);
  if (candidate !== webRoot && !candidate.startsWith(`${webRoot}${path.sep}`)) {
    applySecurityHeaders(response);
    response.writeHead(400);
    response.end();
    return;
  }

  let filePath = candidate;
  try {
    if (!(await stat(filePath)).isFile()) filePath = path.join(webRoot, "index.html");
  } catch {
    filePath = path.join(webRoot, "index.html");
  }
  const body = await readFile(filePath);
  applySecurityHeaders(response);
  response.writeHead(200, {
    "Content-Type": contentTypes.get(path.extname(filePath)) || "application/octet-stream"
  });
  response.end(body);
};

const server = https.createServer(
  { cert: certificate, key: privateKey },
  (request, response) => {
    const pathname = new URL(request.url || "/", publicOrigin).pathname;
    if (pathname.startsWith("/api/")) {
      proxyRequest(request, response, apiUpstream);
      return;
    }
    if (pathname.startsWith("/storage/v1/")) {
      proxyRequest(request, response, storageUpstream);
      return;
    }
    void serveStatic(request, response).catch(() => {
      applySecurityHeaders(response);
      response.writeHead(500);
      response.end();
    });
  }
);

const shutdown = () => {
  server.close((error) => {
    process.exit(error ? 1 : 0);
  });
};
process.once("SIGTERM", shutdown);
process.once("SIGINT", shutdown);
server.listen(port, host, () => {
  console.log(`GestSchool RC HTTPS gateway listening on ${publicOrigin.origin}.`);
});
