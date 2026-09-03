import { createReadStream, existsSync, promises as fs } from 'node:fs';
import { createServer } from 'node:http';
import { extname, join, normalize, resolve } from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';

const root = resolve(fileURLToPath(new URL('.', import.meta.url)));
const cliPath = join(root, 'dist', 'cli', 'index.js');
const port = Number(process.env.PORT || 4173);
const contentTypes = { '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.html': 'text/html; charset=utf-8' };

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

async function runAnalysis(repositoryPath) {
  const targetPath = resolve(repositoryPath);
  if (!existsSync(targetPath)) throw new Error('The local repository path does not exist.');
  if (!existsSync(cliPath)) throw new Error('ArchMind CLI build is unavailable. Run npm run build first.');

  const reportPath = join(tmpdir(), `archmind-report-${Date.now()}.md`);
  return await new Promise((resolveResult, reject) => {
    const child = spawn(process.execPath, [cliPath, 'analyze', targetPath, '--output', reportPath], { cwd: root, stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (chunk) => { stdout += chunk; });
    child.stderr.on('data', (chunk) => { stderr += chunk; });
    child.on('error', reject);
    child.on('close', async (code) => {
      if (code !== 0) {
        reject(new Error(stderr.trim() || stdout.trim() || `ArchMind exited with code ${code ?? 'unknown'}.`));
        return;
      }
      try {
        const reportContent = await fs.readFile(reportPath, 'utf8');
        resolveResult({ success: true, reportPath, reportContent, runtimeOutput: stdout });
      } catch (error) {
        reject(error);
      }
    });
  });
}

const server = createServer(async (request, response) => {
  try {
    if (request.method === 'GET' && (request.url === '/' || request.url === '/index.html')) {
      serveIndex(response);
      return;
    }

    if (request.method === 'POST' && request.url === '/api/analyze') {
      const repositoryPath = await readJson(request);
      const result = await runAnalysis(repositoryPath);
      sendJson(response, 200, result);
      return;
    }

    if (request.method === 'GET' && request.url?.startsWith('/assets/')) {
      const relativePath = normalize(request.url.slice('/assets/'.length));
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

    sendJson(response, 404, { success: false, error: 'Not found.' });
  } catch (error) {
    sendJson(response, 400, { success: false, error: error instanceof Error ? error.message : 'Local analysis failed.' });
  }
});

server.listen(port, '127.0.0.1', () => {
  console.log(`ArchMind local interface: http://127.0.0.1:${port}`);
});
