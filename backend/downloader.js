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
    const ytDlp = spawn(ytDlpBinary, ['-j', url]);
    let data = '';
    ytDlp.stdout.on('data', chunk => data += chunk);
    ytDlp.stderr.on('data', () => {});
    ytDlp.on('close', code => {
      if (code === 0) {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          reject(e);
        }
      } else {
        reject(new Error('yt-dlp error'));
      }
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

    let args = ['-f', formato, '-o', outputPath, '--remux-video', 'mp4', '--no-keep-video'];
    if (formato === 'mp3') {
      args.push('--extract-audio', '--audio-format', 'mp3');
    } else {
      // Si el formato es solo video (no contiene '+'), buscar el mejor audio y combinar
      if (!formato.includes('+')) {
        try {
          // Obtener info del video para buscar el mejor audio
          const info = await obtenerInfoVideo(url);
          if (info && info.formats) {
            const selected = info.formats.find(f => f.format_id === formato);
            if (selected && selected.vcodec !== 'none' && selected.acodec === 'none') {
              // Buscar mejor audio mp4 (audio only)
              let bestAudio = info.formats.filter(f => f.vcodec === 'none' && f.acodec !== 'none' && f.ext === 'm4a');
              if (!bestAudio.length) {
                // Si no hay m4a, usar cualquier audio only
                bestAudio = info.formats.filter(f => f.vcodec === 'none' && f.acodec !== 'none');
              }
              bestAudio = bestAudio.sort((a, b) => (b.abr || 0) - (a.abr || 0))[0];
              if (bestAudio) {
                args = ['-f', `${formato}+${bestAudio.format_id}`, '-o', outputPath, '--remux-video', 'mp4', '--no-keep-video'];
              }
            }
          }
        } catch (e) {}
      }
    }

    ytDlpWrap.exec([url, ...args])
      .on('ytDlpEvent', (event) => {
        if (event.event === 'download' && event.info && event.info._filename) {
          realOutputPath = event.info._filename;
        }
      })
      .on('close', () => {
        let finalPath = realOutputPath;
        if (!finalPath) {
          // Detectar el archivo nuevo comparando antes y después
          try {
            const afterFiles = fs.readdirSync(rutaDescarga).map(f => path.join(rutaDescarga, f));
            const newFiles = afterFiles.filter(f => !beforeFiles.includes(f));
            if (newFiles.length === 1) {
              finalPath = newFiles[0];
            } else if (newFiles.length > 1) {
              // Si hay más de uno, tomar el más reciente
              finalPath = newFiles.map(f => ({
                name: f,
                time: fs.statSync(f).mtime.getTime()
              })).sort((a, b) => b.time - a.time)[0].name;
            } else {
              // Fallback: buscar el archivo más reciente
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
            fs.utimesSync(finalPath, now, now); // Asignar la fecha de descarga
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
