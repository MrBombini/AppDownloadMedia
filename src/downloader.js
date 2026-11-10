import { app } from 'electron';
import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import YtDlpWrap from 'yt-dlp-wrap';

function getBackendDir() {
  if (!app.isPackaged) {
    return path.join(process.cwd(), 'backend');
  }
  const inResources = path.join(process.resourcesPath, 'backend');
  if (fs.existsSync(inResources)) return inResources;

  const nextToExe = path.join(path.dirname(process.execPath), 'backend');
  if (fs.existsSync(nextToExe)) return nextToExe;

  return inResources;
}

function getYtDlpBinary() {
  const backendDir = getBackendDir();
  return path.join(backendDir, process.platform === 'win32' ? 'yt-dlp.exe' : 'yt-dlp');
}

function getFfmpegDir() {
  return getBackendDir();
}

export function obtenerInfoVideo(url) {
  return new Promise((resolve, reject) => {
    if (!url) return reject(new Error('URL vacía'));
    
    const ytDlpBinary = getYtDlpBinary();
    const ffmpegDir = getFfmpegDir();

    const args = [
      '--no-playlist',
      '--js-runtimes', 'node',
      '--ffmpeg-location', ffmpegDir,
      '-J',
      url
    ];

    const ytDlp = spawn(ytDlpBinary, args);
    let data = '';
    let errorOutput = '';

    ytDlp.stdout.on('data', chunk => data += chunk);
    ytDlp.stderr.on('data', chunk => errorOutput += chunk);

    ytDlp.on('close', code => {
      if (code === 0) {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          const lines = data.trim().split('\n').filter(Boolean);
          for (const line of lines) {
            try {
              return resolve(JSON.parse(line));
            } catch (_) {}
          }
          console.error('Error al parsear JSON de yt-dlp:', e.message);
          reject(e);
        }
      } else {
        console.error('Error de yt-dlp:', errorOutput);
        reject(new Error(errorOutput || `yt-dlp terminó con código ${code}`));
      }
    });

    ytDlp.on('error', err => {
      console.error('Fallo al ejecutar yt-dlp:', err);
      reject(err);
    });
  });
}

export function descargarVideo(url, formato = 'best', rutaDescarga = null, onProgress = null) {
  const ytDlpBinary = getYtDlpBinary();
  const ffmpegDir = getFfmpegDir();
  const ytDlpWrap = new YtDlpWrap(ytDlpBinary);
  const targetDir = rutaDescarga || getBackendDir();

  const outputTemplate = '%(title)s.%(ext)s';
  const outputPath = path.join(targetDir, outputTemplate);

  return new Promise(async (resolve, reject) => {
    let realOutputPath = '';
    let beforeFiles = [];
    try {
      beforeFiles = fs.readdirSync(targetDir).map(f => path.join(targetDir, f));
    } catch (e) {}

    let formatOption = formato;

    if (formato === 'mp3') {
      // Audio
    } else {
      if (!formato.includes('+')) {
        try {
          const info = await obtenerInfoVideo(url);
          if (info && info.formats) {
            const selected = info.formats.find(f => f.format_id === formato);
            if (selected && selected.vcodec !== 'none' && selected.acodec === 'none') {
              let bestAudio = info.formats.filter(f => f.vcodec === 'none' && f.acodec !== 'none' && f.ext === 'm4a');
              if (!bestAudio.length) {
                bestAudio = info.formats.filter(f => f.vcodec === 'none' && f.acodec !== 'none');
              }
              bestAudio = bestAudio.sort((a, b) => (b.abr || 0) - (a.abr || 0))[0];
              if (bestAudio) {
                formatOption = `${formato}+${bestAudio.format_id}`;
              }
            }
          }
        } catch (e) {
          console.warn('No se pudo resolver audio combinado:', e.message);
        }
      }
    }

    const defaultArgs = [
      '--no-playlist',
      '--js-runtimes', 'node',
      '--ffmpeg-location', ffmpegDir,
      '-f', formatOption,
      '-o', outputPath,
      '--remux-video', 'mp4',
      '--no-keep-video'
    ];

    if (formato === 'mp3') {
      defaultArgs.push('--extract-audio', '--audio-format', 'mp3');
    }

    ytDlpWrap.exec([url, ...defaultArgs])
      .on('ytDlpEvent', (event) => {
        if (event.event === 'download' && event.info && event.info._filename) {
          realOutputPath = event.info._filename;
        }
      })
      .on('progress', (progress) => {
        if (typeof onProgress === 'function') {
          onProgress(progress);
        }
      })
      .on('close', () => {
        let finalPath = realOutputPath;
        if (!finalPath) {
          try {
            const afterFiles = fs.readdirSync(targetDir).map(f => path.join(targetDir, f));
            const newFiles = afterFiles.filter(f => !beforeFiles.includes(f));
            if (newFiles.length === 1) {
              finalPath = newFiles[0];
            } else if (newFiles.length > 1) {
              finalPath = newFiles.map(f => ({
                name: f,
                time: fs.statSync(f).mtime.getTime()
              })).sort((a, b) => b.time - a.time)[0].name;
            } else {
              const files = afterFiles.map(f => ({
                name: f,
                time: fs.statSync(f).mtime.getTime()
              })).sort((a, b) => b.time - a.time);
              if (files.length > 0) {
                finalPath = files[0].name;
              }
            }
          } catch (e) {}
        }
        if (finalPath && fs.existsSync(finalPath)) {
          const now = new Date();
          try {
            fs.utimesSync(finalPath, now, now);
          } catch (err) {
            console.error('Error al actualizar fechas del archivo:', err);
          }
        }
        resolve(finalPath);
      })
      .on('error', reject);
  });
}
