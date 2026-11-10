
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  elegirCarpeta: () => ipcRenderer.invoke('elegir-carpeta'),
  descargarVideo: (url, formato, ruta) =>
    ipcRenderer.invoke('descargar-video', { url, formato, ruta }),
  obtenerInfoVideo: (url) => ipcRenderer.invoke('obtener-info-video', url),
  bloquearVentana: (bloquear) => ipcRenderer.invoke('bloquear-ventana', bloquear),
  onProgreso: (callback) => {
    const handler = (_event, progress) => callback(progress);
    ipcRenderer.on('descarga-progreso', handler);
    return () => ipcRenderer.removeListener('descarga-progreso', handler);
  },
});
