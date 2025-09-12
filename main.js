const { app, BrowserWindow, ipcMain, globalShortcut } = require('electron');
const path = require('node:path');

const isDev = process.env.NODE_ENV === 'development';

function createWindow() {
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'), 
      contextIsolation: true
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

  globalShortcut.register('CommandOrControl+Shift+I', () => {
    win.webContents.toggleDevTools();
  });
}

ipcMain.handle('ping', () => 'pong');

app.whenReady().then(() => {
  createWindow();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
