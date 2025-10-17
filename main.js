const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');

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

// データエクスポート用のIPCハンドラ
ipcMain.handle('save-data-file', async (event, { data, defaultFilename }) => {
  const result = await dialog.showSaveDialog(mainWindow, {
    title: 'データを保存',
    defaultPath: defaultFilename,
    filters: [
      { name: 'JSON Files', extensions: ['json'] },
      { name: 'All Files', extensions: ['*'] }
    ]
  });

  if (result.canceled) {
    return { success: false, canceled: true };
  }

  try {
    fs.writeFileSync(result.filePath, data, 'utf8');
    return { success: true, filePath: result.filePath };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// 保存先選択用のIPCハンドラ
ipcMain.handle('select-save-location', async (event) => {
  const result = await dialog.showOpenDialog(mainWindow, {
    title: '保存先フォルダを選択',
    properties: ['openDirectory', 'createDirectory']
  });

  if (result.canceled || result.filePaths.length === 0) {
    return null;
  }

  return result.filePaths[0];
});

// 自動保存用のIPCハンドラ（ダイアログなし）
ipcMain.handle('auto-save-data', async (event, { saveLocation, data }) => {
  try {
    // ファイル名を生成（タイムスタンプ付き）
    const now = new Date();
    const filename = `autosave_${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}_${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}.json`;
    const filePath = path.join(saveLocation, filename);
    
    // データを保存
    fs.writeFileSync(filePath, data, 'utf8');
    
    return { success: true, filePath: filePath };
  } catch (error) {
    console.error('自動保存エラー:', error);
    return { success: false, error: error.message };
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

