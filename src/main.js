import { app, BrowserWindow, ipcMain, dialog } from 'electron';
import path from 'path';
import fs from 'fs';
import { descargarVideo, obtenerInfoVideo } from './downloader.js';

const isDev = process.env.NODE_ENV === 'development' || process.env.ELECTRON_IS_DEV === '1';

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  if (isDev) {
    mainWindow.loadURL('http://localhost:5173');
  } else {
    const rendererPath = path.join(__dirname, '../renderer/main_window/index.html');
    console.log('Buscando index.html en:', rendererPath, 'Existe:', fs.existsSync(rendererPath));
    mainWindow.loadFile(rendererPath);
  }

  if (isDev) {
    mainWindow.webContents.openDevTools();
  }
  mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription) => {
    console.error('Falló la carga de la ventana:', errorCode, errorDescription);
  });

  mainWindow.on('closed', () => (mainWindow = null));
}

app.on('ready', createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (mainWindow === null) {
    createWindow();
  }
});

ipcMain.handle('obtener-info-video', async (event, url) => {
  try {
    const info = await obtenerInfoVideo(url);
    return info;
  } catch (err) {
    console.error('Error al obtener info del video:', err);
    return null;
  }
});

ipcMain.handle('elegir-carpeta', async () => {
  const result = await dialog.showOpenDialog({
    properties: ['openDirectory'],
  });
  return result.canceled ? null : result.filePaths[0];
});

ipcMain.handle('descargar-video', async (event, { url, formato, ruta }) => {
  try {
    const resultPath = await descargarVideo(url, formato, ruta, (progress) => {
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('descarga-progreso', progress);
      }
    });
    return { ok: true, path: resultPath };
  } catch (err) {
    return { ok: false, error: err.message };
  }
});

ipcMain.handle('bloquear-ventana', async (event, bloquear) => {
  if (mainWindow) {
    mainWindow.setEnabled(!bloquear);
    if (!bloquear) {
      setTimeout(() => {
        if (!mainWindow.isFocused()) {
          mainWindow.focus();
        }
      }, 100);
    }
  }
});
