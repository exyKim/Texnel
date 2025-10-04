const { app, BrowserWindow, ipcMain, globalShortcut } = require('electron');
const path = require('node:path');
const os = require('node:os');
const fs = require('node:fs');
const { spawn, execSync, spawnSync } = require('node:child_process');

const isDev = process.env.NODE_ENV === 'development';
function exists(p) { try { return !!p && fs.existsSync(p); } catch { return false; } }

// 번들/개발 경로 얻기
function res(p) {
  // 패키징되면 process.resourcesPath (…/AppName/resources)
  // 개발 모드면 __dirname 기준
  return app.isPackaged ? path.join(process.resourcesPath, p) : path.join(__dirname, p);
}

// 1) 파이썬 찾기
function findPython() {
  // 번들된 파이썬
  const bundled = process.platform === 'win32'
    ? res('python/python.exe')
    : res('python/bin/python3');
  if (exists(bundled)) return bundled;

  // 환경변수 지정 우선: DETECT_PYTHON → PYTHON
  const tryEnv = (val) => {
    if (!val) return null;
    let p = val;
    if (process.platform === 'win32' && !/\.exe$/i.test(p)) {
      // 폴더가 넘어오면 python.exe 시도
      const exe = path.join(p, 'python.exe');
      if (exists(exe)) return exe;
    }
    return exists(p) ? p : null;
  };
  const envPy = tryEnv(process.env.DETECT_PYTHON) || tryEnv(process.env.PYTHON);
  if (envPy) return envPy;

  // PATH 검색 (실행 가능 여부 확인)
  const candidates = process.platform === 'win32' ? ['py -3', 'py', 'python', 'python3'] : ['python3', 'python'];
  for (const c of candidates) {
    try {
      const [cmd, ...args] = c.split(' ');
      const res = spawnSync(cmd, [...args, '-V'], { encoding: 'utf-8', windowsHide: true });
      if (res.status === 0) return c; // 스페이스 포함 커맨드 그대로 반환
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
    // path::origName 형태로 전달하여 원본 파일명 유지
    const args = [...preArgs, scannerPath, ...entries.map(e => `${e.path}::${e.name}`)];

    console.log('[Python] spawn:', cmd, args.join(' '));
    const env = {
      ...process.env,
      DETECT_LOG: '1',
      DETECT_VERBOSE: '1',
      PYTHONIOENCODING: 'utf-8', // 파이썬 stdout/stderr UTF-8 고정
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
      preload: path.join(__dirname, 'preload.js'), // ✅ 여기서만 preload 지정
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

// IPC (렌더러 → 메인)
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
    if (fs.existsSync(tmp)) fs.unlinkSync(tmp);
  }
});

ipcMain.handle('scan-files', async (_evt, items) => {
  const tmps = [];
  try {
    const entries = [];
    for (const it of items) {
      const tmp = writeTempFile(it.name, it.bytes);
      tmps.push(tmp);
      entries.push({ path: tmp, name: it.name }); // 원본 파일명 포함
    }
    return await runPythonScanner(entries);
  } catch (err) {
    console.error('[IPC][scan-files] Error:', err);
    return [];
  } finally {
    for (const t of tmps) fs.existsSync(t) && fs.unlinkSync(t);
  }
});

ipcMain.handle('ping', () => 'pong');

// 글로벌 예외/로그 가드
process.on('uncaughtException', (e) => console.error('[main][uncaughtException]', e));
process.on('unhandledRejection', (r) => console.error('[main][unhandledRejection]', r));

// 앱 라이프사이클 (윈도우 생성/종료 처리)
app.whenReady().then(createWindow);
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
app.on('will-quit', () => { try { globalShortcut.unregisterAll(); } catch {} });

