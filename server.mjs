import { createReadStream, existsSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, join, normalize, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(fileURLToPath(new URL('.', import.meta.url)));
const port = Number(process.env.PORT || 4173);
const contentTypes = { '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.html': 'text/html; charset=utf-8' };

// Import the compiled AnalysisService from dist
const { AnalysisService } = await import('./dist/runtime/analysis-service.js');

/** @type {import('./dist/runtime/analysis-service.js').AnalysisService} */
const analysisService = new AnalysisService();

function sendJson(response, status, payload) {
  response.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
  response.end(JSON.stringify(payload));
}

function serveIndex(response) {
  response.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
  createReadStream(join(root, 'index.html')).pipe(response);
}

async function readJson(request) {
  let body = '';
  for await (const chunk of request) body += chunk;
  if (body.length > 10000) throw new Error('Request body is too large.');
  const value = JSON.parse(body);
  if (!value || typeof value.repositoryPath !== 'string' || value.repositoryPath.trim().length === 0) {
    throw new Error('A local repository path is required.');
  }
  return value.repositoryPath.trim();
}

/**
 * Extract :runId from a URL pattern like /api/graph/:runId or /api/run/:runId
 * @param {string} url
 * @param {string} prefix - e.g. '/api/graph/' or '/api/run/'
 * @returns {string|null}
 */
function extractRunId(url, prefix) {
  if (!url.startsWith(prefix)) return null;
  const runId = url.slice(prefix.length).replace(/\/$/, '');
  return runId.length > 0 ? runId : null;
}

const server = createServer(async (request, response) => {
  try {
    const parsedUrl = new URL(request.url || '/', `http://${request.headers.host || '127.0.0.1'}`);
    const url = parsedUrl.pathname;


    // --- Static routes ---

    if (request.method === 'GET' && (url === '/' || url === '/index.html')) {
      serveIndex(response);
      return;
    }

    if (request.method === 'GET' && url.startsWith('/assets/')) {
      const relativePath = normalize(url.slice('/assets/'.length));
      const assetPath = resolve(join(root, 'assets', relativePath));
      if (!assetPath.startsWith(resolve(join(root, 'assets')))) {
        sendJson(response, 403, { success: false, error: 'Forbidden.' });
        return;
      }
      if (!existsSync(assetPath)) {
        sendJson(response, 404, { success: false, error: 'Not found.' });
        return;
      }
      response.writeHead(200, { 'content-type': contentTypes[extname(assetPath)] || 'application/octet-stream' });
      createReadStream(assetPath).pipe(response);
      return;
    }

    if (request.method === 'GET' && url.startsWith('/node_modules/three/')) {
      const relativePath = normalize(url.slice('/node_modules/three/'.length));
      const filePath = resolve(join(root, 'node_modules', 'three', relativePath));
      if (!filePath.startsWith(resolve(join(root, 'node_modules', 'three')))) {
        sendJson(response, 403, { success: false, error: 'Forbidden.' });
        return;
      }
      if (!existsSync(filePath)) {
        sendJson(response, 404, { success: false, error: 'Not found.' });
        return;
      }
      response.writeHead(200, { 'content-type': contentTypes[extname(filePath)] || 'application/octet-stream' });
      createReadStream(filePath).pipe(response);
      return;
    }

    if (request.method === 'GET' && url.startsWith('/src/frontend/')) {
      const relativePath = normalize(url.slice('/src/frontend/'.length));
      const filePath = resolve(join(root, 'src', 'frontend', relativePath));
      if (!filePath.startsWith(resolve(join(root, 'src', 'frontend')))) {
        sendJson(response, 403, { success: false, error: 'Forbidden.' });
        return;
      }
      if (!existsSync(filePath)) {
        sendJson(response, 404, { success: false, error: 'Not found.' });
        return;
      }
      response.writeHead(200, { 'content-type': contentTypes[extname(filePath)] || 'application/octet-stream' });
      createReadStream(filePath).pipe(response);
      return;
    }

    // --- API routes ---

    // POST /api/analyze
    if (request.method === 'POST' && url === '/api/analyze') {
      if (analysisService.analyzing) {
        sendJson(response, 409, { success: false, error: 'Analysis already running.' });
        return;
      }

      const repositoryPath = await readJson(request);
      const result = await analysisService.analyze(repositoryPath);
      sendJson(response, 200, { success: true, runId: result.runId });
      return;
    }

    // GET /api/runs
    if (request.method === 'GET' && url === '/api/runs') {
      const runs = analysisService.listRuns();
      sendJson(response, 200, { success: true, runs });
      return;
    }

    // GET /api/run/:runId
    if (request.method === 'GET' && url.startsWith('/api/run/')) {
      const runId = extractRunId(url, '/api/run/');
      if (!runId) {
        sendJson(response, 400, { success: false, error: 'Missing runId.' });
        return;
      }

      const run = analysisService.getRun(runId);
      if (!run) {
        sendJson(response, 404, { success: false, error: 'Run not found.' });
        return;
      }
      sendJson(response, 200, { success: true, run });
      return;
    }

    // GET /api/graph/:runId
    if (request.method === 'GET' && url.startsWith('/api/graph/')) {
      const runId = extractRunId(url, '/api/graph/');
      if (!runId) {
        sendJson(response, 400, { success: false, error: 'Missing runId.' });
        return;
      }

      const graph = analysisService.getGraph(runId);
      if (!graph) {
        sendJson(response, 404, { success: false, error: 'Run not found.' });
        return;
      }
      sendJson(response, 200, { success: true, graph });
      return;
    }

    // --- Fallback ---
    sendJson(response, 404, { success: false, error: 'Not found.' });
  } catch (error) {
    sendJson(response, 400, { success: false, error: error instanceof Error ? error.message : 'Local analysis failed.' });
  }
});

server.listen(port, '127.0.0.1', () => {
  console.log(`ArchMind local interface: http://127.0.0.1:${port}`);
});
