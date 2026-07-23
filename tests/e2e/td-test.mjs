import { spawn } from 'child_process';
import http from 'http';
import { resolve } from 'path';

const PORT = 4444;
const NATIVE_PORT = 9516;
const EXE = resolve('G:/AI/Claude-Workspace/Projects/glyph/target/debug/glyph.exe');

function wd(method, path, body) {
  return new Promise((resolve, reject) => {
    const opts = {
      hostname: '127.0.0.1', port: PORT,
      path, method,
      headers: body ? { 'Content-Type': 'application/json' } : {},
      timeout: 30000,
    };
    const req = http.request(opts, res => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); }
        catch { resolve({ value: data }); }
      });
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('timeout')); });
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function main() {
  console.log('Starting tauri-driver (port 4444, native port 9516)...');
  const driver = spawn('tauri-driver', [
    '--port', String(PORT),
    '--native-port', String(NATIVE_PORT),
  ], {
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  driver.stderr.on('data', d => {
    const s = d.toString().trim();
    if (s) process.stderr.write(`[driver] ${s.slice(0, 150)}\n`);
  });

  // Wait for driver
  for (let i = 0; i < 20; i++) {
    try {
      await wd('GET', '/sessions');
      console.log('Driver ready');
      break;
    } catch { await sleep(1000); }
  }

  // Create session
  console.log('Creating session...');
  const caps = {
    capabilities: {
      alwaysMatch: {
        browserName: 'tauri',
        'tauri:options': { application: EXE },
      },
    },
  };

  let sessionId = null;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      console.log(`Attempt ${attempt}...`);
      const res = await wd('POST', '/session', caps);
      if (res?.value?.sessionId) sessionId = res.value.sessionId;
      else if (res?.sessionId) sessionId = res.sessionId;
      if (sessionId) { console.log(`Session: ${sessionId}`); break; }
      console.log('Response:', JSON.stringify(res).slice(0, 300));
    } catch (e) {
      console.log(`Error: ${e.message}`);
    }
    await sleep(5000);
  }

  if (!sessionId) {
    console.log('FAILED');
    driver.kill();
    return;
  }

  const base = `/session/${sessionId}`;

  // Get source
  await sleep(5000);
  const source = await wd('GET', `${base}/source`);
  console.log(`Source: ${(source?.value || '').slice(0, 200)}`);

  // Inject probe
  console.log('Injecting probe...');
  await wd('POST', `${base}/execute/sync`, {
    script: `document.title = 'Glyph-Probe'; return 'ok'`,
    args: [],
  });
  await sleep(1000);

  const title = await wd('GET', `${base}/title`);
  console.log('Title:', JSON.stringify(title));

  driver.kill();
  console.log('Done');
}

main().catch(e => console.error('Error:', e.message));
