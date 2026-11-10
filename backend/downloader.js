const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const YtDlpWrap = require('yt-dlp-wrap').default;

// Ruta al binario local de yt-dlp
const ytDlpBinary = process.platform === 'win32'
  ? path.join(__dirname, 'yt-dlp.exe')
  : path.join(__dirname, 'yt-dlp');

const ytDlpWrap = new YtDlpWrap(ytDlpBinary);

function obtenerInfoVideo(url) {
  return new Promise((resolve, reject) => {
    if (!url) return reject(new Error('URL vacía'));
    
    const args = [
      '--no-playlist',
      '--js-runtimes', 'node',
      '--ffmpeg-location', __dirname,
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
          // Si hay varias líneas o texto extra, intentar parsear la primera línea válida JSON
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

function descargarVideo(url, formato = 'best', rutaDescarga = __dirname) {
  const outputTemplate = '%(title)s.%(ext)s';
  const outputPath = path.join(rutaDescarga, outputTemplate);

  return new Promise(async (resolve, reject) => {
    let realOutputPath = '';
    let beforeFiles = [];
    try {
      beforeFiles = fs.readdirSync(rutaDescarga).map(f => path.join(rutaDescarga, f));
    } catch (e) {}

    let formatOption = formato;

    if (formato === 'mp3') {
      // Audio
    } else {
      // Si el formato es solo video (no contiene '+'), buscar el mejor audio y combinar
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
      '--ffmpeg-location', __dirname,
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
      .on('close', () => {
        let finalPath = realOutputPath;
        if (!finalPath) {
          try {
            const afterFiles = fs.readdirSync(rutaDescarga).map(f => path.join(rutaDescarga, f));
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

module.exports = { descargarVideo, obtenerInfoVideo };
