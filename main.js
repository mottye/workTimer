const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 400,
    height: 500,
    minWidth: 400,
    maxWidth: 400,
    minHeight: 350,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    },
    resizable: true,
    alwaysOnTop: true, // 常に最前面に表示
    title: 'ストップウォッチ',
    opacity: 1.0 // デフォルトの透明度
  });

  mainWindow.loadFile('index.html');

  // 開発時はDevToolsを開く（本番では削除可能）
  // mainWindow.webContents.openDevTools();
}

// 透明度変更のIPCハンドラ
ipcMain.on('set-opacity', (event, opacity) => {
  if (mainWindow && opacity >= 0 && opacity <= 1) {
    mainWindow.setOpacity(opacity);
  }
});

// Always On Top変更のIPCハンドラ
ipcMain.on('set-always-on-top', (event, alwaysOnTop) => {
  if (mainWindow) {
    mainWindow.setAlwaysOnTop(alwaysOnTop);
    console.log('Always On Top設定を変更しました:', alwaysOnTop);
  }
});

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

