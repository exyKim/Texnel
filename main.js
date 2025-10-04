// main.js
const { app, BrowserWindow, ipcMain, globalShortcut } = require('electron');
const path = require('node:path');
const os = require('node:os');
const fs = require('node:fs');
const { spawn, spawnSync } = require('node:child_process');

const isDev = process.env.NODE_ENV === 'development';
function exists(p) { try { return !!p && fs.existsSync(p); } catch { return false; } }

// 번들/개발 경로
function res(p) {
  return app.isPackaged ? path.join(process.resourcesPath, p) : path.join(__dirname, p);
}

// 1) 파이썬 찾기
function findPython() {
  const bundled = process.platform === 'win32' ? res('python/python.exe') : res('python/bin/python3');
  if (exists(bundled)) return bundled;

  const tryEnv = (val) => {
    if (!val) return null;
    let p = val;
    if (process.platform === 'win32' && !/\.exe$/i.test(p)) {
      const exe = path.join(p, 'python.exe');
      if (exists(exe)) return exe;
    }
    return exists(p) ? p : null;
  };
  const envPy = tryEnv(process.env.DETECT_PYTHON) || tryEnv(process.env.PYTHON);
  if (envPy) return envPy;

  const candidates = process.platform === 'win32'
    ? ['py -3', 'py', 'python', 'python3']
    : ['python3', 'python'];
  for (const c of candidates) {
    try {
      const [cmd, ...args] = c.split(' ');
      const r = spawnSync(cmd, [...args, '-V'], { encoding: 'utf-8', windowsHide: true });
      if (r.status === 0) return c;
    } catch {}
  }
  throw new Error('Python executable not found. Set DETECT_PYTHON to full path of python.exe');
}

// 2) 스캐너 스크립트 경로
function getScannerEntry() {
  const p = res('detect_core/file_scanner.py');
  if (!exists(p)) throw new Error(`file_scanner.py not found: ${p}`);
  return p;
}

// 스캐너 실행 (단일/다중) - entries: [{ path, name }]
function runPythonScanner(entries) {
  return new Promise((resolve, reject) => {
    let py = null;
    try { py = findPython(); } catch (e) { return reject(e); }

    const parts = String(py).split(' ');
    const cmd = parts[0];
    const preArgs = parts.slice(1);

    const scannerPath = getScannerEntry();
    const args = [...preArgs, scannerPath, ...entries.map(e => `${e.path}::${e.name}`)];

    console.log('[Python] spawn:', cmd, args.join(' '));
    const env = {
      ...process.env,
      DETECT_LOG: '1',
      DETECT_VERBOSE: '1',
      PYTHONIOENCODING: 'utf-8',
    };
    const proc = spawn(cmd, args, { cwd: path.dirname(scannerPath), env, windowsHide: true });

    let out = '', err = '';
    proc.stdout.on('data', d => (out += d.toString()));
    proc.stderr.on('data', d => (err += d.toString()));
    proc.on('error', er => { console.error('[Python] spawn error:', er); reject(er); });
    proc.on('close', (code) => {
      console.log('[Python] exit', code);
      if (err) console.log('[Python][stderr]\n' + err.slice(0, 2000));
      if (code !== 0) return reject(new Error(`scanner rc=${code} ${err.slice(0, 300)}`));
      try { resolve(out.trim() ? JSON.parse(out) : (entries.length === 1 ? {} : [])); }
      catch { resolve([]); }
    });
  });
}

function writeTempFile(name, bytes) {
  const ext = name.includes('.') ? '.' + name.split('.').pop().toLowerCase() : '';
  const tmp = path.join(os.tmpdir(), `texnel_${Date.now()}_${Math.random().toString(16).slice(2)}${ext}`);
  fs.writeFileSync(tmp, Buffer.from(bytes));
  return tmp;
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1200, height: 800,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  win.setMenu(null);
  if (isDev) {
    const url = process.env.VITE_DEV_SERVER_URL || 'http://localhost:5173';
    win.loadURL(url);
    win.webContents.openDevTools();
  } else {
    win.loadFile(path.join(app.getAppPath(), 'dist', 'index.html'));
  }

  globalShortcut.register('CommandOrControl+Shift+I', () => win.webContents.toggleDevTools());
}

// -------------------- IPC 배선 (중복 방지) --------------------
let _wired = false;
function wireIpc() {
  if (_wired) return;
  _wired = true;

  // 기존 핸들러 제거 후 등록(중복 방지)
  ipcMain.removeHandler('scan-files');
  ipcMain.removeHandler('scan-file');
  ipcMain.removeHandler('ping');

  // 파일 여러 개: 부분 결과/진행률/완료 이벤트 쏘기
  ipcMain.handle('scan-files', async (evt, items) => {
    const wc = evt.sender;
    const total = items.length;

    const tmps = [];
    const results = [];
    let done = 0;

    try {
      for (const it of items) {
        const tmp = writeTempFile(it.name, it.bytes);
        tmps.push(tmp);

        const res = await runPythonScanner([{ path: tmp, name: it.name }]);
        const one = Array.isArray(res) ? (res[0] ?? {}) : res;

        wc.send('scan-result', { name: one.filename || it.name, result: one });
        done += 1;
        wc.send('scan-progress', { done, total, name: it.name });

        results.push(one);
      }

      wc.send('scan-complete', { total, results });
      return results;
    } catch (err) {
      console.error('[IPC][scan-files] Error:', err);
      try { wc.send('scan-complete', { total, results }); } catch {}
      return [];
    } finally {
      for (const t of tmps) { try { fs.existsSync(t) && fs.unlinkSync(t); } catch {} }
    }
  });

  // 단일 파일
  ipcMain.handle('scan-file', async (_evt, payload) => {
    const { name, bytes } = payload;
    console.log('[IPC] scan-file start', name);
    const tmp = writeTempFile(name, bytes);
    try {
      const json = await runPythonScanner([{ path: tmp, name }]);
      console.log('[IPC] scan-file done', name);
      return json;
    } catch (err) {
      console.error('[IPC][scan-file] Error:', err);
      return { filename: name, detections: [], error: String(err) };
    } finally {
      try { fs.existsSync(tmp) && fs.unlinkSync(tmp); } catch {}
    }
  });

  ipcMain.handle('ping', () => 'pong');
}

// 글로벌 예외/로그
process.on('uncaughtException', (e) => console.error('[main][uncaughtException]', e));
process.on('unhandledRejection', (r) => console.error('[main][unhandledRejection]', r));

// 앱 라이프사이클
app.whenReady().then(() => {
  wireIpc();           // <- 한번만
  createWindow();
});
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
app.on('will-quit', () => { try { globalShortcut.unregisterAll(); } catch {} });
