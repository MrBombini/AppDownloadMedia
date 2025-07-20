
import { useState, useEffect } from 'react';
import VideoOptions from './VideoOptions';
import Thumbnail from './Thumbnail';
import Loader from '../assets/Loader';

export default function MultiDownload() {
  // Cargar cache si existe
  const cached = (() => {
    try {
      const c = localStorage.getItem('multiDownloadCache');
      return c ? JSON.parse(c) : null;
    } catch { return null; }
  })();
  const [urls, setUrls] = useState(cached?.urls || ['']);
  const [videoInfos, setVideoInfos] = useState(cached?.videoInfos || []);
  const [selectedFormats, setSelectedFormats] = useState(cached?.selectedFormats || []);
  const [selectedTypes, setSelectedTypes] = useState(cached?.selectedTypes || []); // 'mp4' o 'mp3' por video
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState('');
  const [carpeta, setCarpeta] = useState('');

  // Guardar en cache cada vez que cambian los datos relevantes
  useEffect(() => {
    localStorage.setItem('multiDownloadCache', JSON.stringify({ urls, videoInfos, selectedFormats, selectedTypes }));
  }, [urls, videoInfos, selectedFormats, selectedTypes]);

  // Limpiar cache al cerrar la app (o recargar)
  useEffect(() => {
    const clearCache = () => localStorage.removeItem('multiDownloadCache');
    window.addEventListener('beforeunload', clearCache);
    return () => window.removeEventListener('beforeunload', clearCache);
  }, []);

  const handleUrlChange = (i, value) => {
    const newUrls = [...urls];
    newUrls[i] = value;
    setUrls(newUrls);
  };

  const addUrl = () => setUrls([...urls, '']);
  const removeUrl = (i) => setUrls(urls.filter((_, idx) => idx !== i));

  const fetchInfos = async () => {
    setLoading(true);
    setStatus('Cargando información de videos...');
    try {
      const infos = await Promise.all(urls.map(u => window.api.obtenerInfoVideo(u)));
      setVideoInfos(infos);
      setSelectedTypes(infos.map(() => 'mp4'));
      setSelectedFormats(infos.map(info => {
        if (info && info.formats) {
          const filtered = info.formats.filter(f => f.vcodec !== 'none');
          return filtered.length > 0 ? filtered[0].format_id : '';
        }
        return '';
      }));
      setStatus('');
    } catch {
      setStatus('Error al cargar información de uno o más videos');
    }
    setLoading(false);
  };

  const handleFormatSelect = (i, fmt) => {
    const newSelected = [...selectedFormats];
    newSelected[i] = fmt;
    setSelectedFormats(newSelected);
  };

  const handleTypeSelect = (i, type) => {
    const newTypes = [...selectedTypes];
    newTypes[i] = type;
    setSelectedTypes(newTypes);
    // Reset formato al cambiar tipo
    if (videoInfos[i] && videoInfos[i].formats) {
      if (type === 'mp4') {
        const filtered = videoInfos[i].formats.filter(f => f.vcodec !== 'none');
        newSelectedFormats[i] = filtered.length > 0 ? filtered[0].format_id : '';
      } else {
        const filtered = videoInfos[i].formats.filter(f => f.vcodec === 'none' && f.acodec !== 'none');
        newSelectedFormats[i] = filtered.length > 0 ? filtered[0].format_id : '';
      }
      setSelectedFormats([...newSelectedFormats]);
    }
  };

  const handleDownload = async () => {
    setLoading(true);
    setStatus('');
    await window.api.bloquearVentana(true);
    const ruta = await window.api.elegirCarpeta();
    await window.api.bloquearVentana(false);
    if (!ruta) {
      setStatus('Selección cancelada');
      setLoading(false);
      return;
    }
    setCarpeta(ruta);
    setStatus('Descargando...');
    for (let i = 0; i < urls.length; i++) {
      if (!urls[i] || !selectedFormats[i]) continue;
      await window.api.descargarVideo(urls[i], selectedFormats[i], ruta, selectedTypes[i]);
    }
    setLoading(false);
    setStatus('Descarga completada');
  };

  const handleClearCache = () => {
    localStorage.removeItem('multiDownloadCache');
    setUrls(['']);
    setVideoInfos([]);
    setSelectedFormats([]);
    setSelectedTypes([]);
    setCarpeta('');
    setStatus('');
  };

  return (
    <div className="p-4 max-w-3xl mx-auto relative">
      <button
        className="absolute right-4 top-4 bg-gray-200 hover:bg-red-500 hover:text-white text-gray-700 px-3 py-1 rounded transition-colors"
        onClick={handleClearCache}
        title="Limpiar todo y empezar de nuevo"
      >
        Limpiar
      </button>
      {loading && (
        <div className="flex justify-center items-center w-full mb-4">
          <div className='mt-10'><Loader /></div>
        </div>
      )}
      <h2 className="text-lg font-bold mb-4">Descargar varios videos</h2>
      {urls.map((url, i) => (
        <div key={i} className="mb-4 flex gap-2 items-start">
          <input
            className="border p-2 flex-1"
            type="text"
            placeholder={`URL del video #${i+1}`}
            value={url}
            onChange={e => handleUrlChange(i, e.target.value)}
          />
          {urls.length > 1 && (
            <button className="text-red-500 font-bold" onClick={() => removeUrl(i)}>-</button>
          )}
        </div>
      ))}
      <button className="mb-4 bg-gray-300 px-3 py-1 rounded" onClick={addUrl}>Agregar otro</button>
      <button className="ml-2 bg-blue-600 text-white px-4 py-2 rounded" onClick={fetchInfos} disabled={loading || urls.some(u => !u)}>
        {loading ? 'Cargando...' : 'Cargar info'}
      </button>
      {videoInfos.length > 0 && videoInfos.map((info, i) => info && info.formats ? (
        <div key={i} className="mt-4 border p-3 rounded bg-white flex flex-row gap-8 items-stretch max-w-full">
          {info.thumbnail && (
            <div className="flex-shrink-0 flex items-center justify-center" style={{minWidth:'220px'}}>
              <div className="rounded overflow-hidden shadow" style={{width:'220px',height:'124px',background:'#eee',display:'flex',alignItems:'center',justifyContent:'center'}}>
                <Thumbnail url={info.thumbnail} style={{maxWidth:'100%',maxHeight:'100%',objectFit:'cover'}} />
              </div>
            </div>
          )}
          <div className="flex-1 min-w-0 flex flex-col justify-center pl-8">
            <div className="font-semibold mb-2">Opciones para video #{i+1}</div>
            <div className="flex gap-4 mb-2">
              <button
                className={`px-4 py-2 rounded ${selectedTypes[i] === 'mp4' ? 'bg-blue-500 text-white' : 'bg-gray-200'}`}
                onClick={() => handleTypeSelect(i, 'mp4')}
              >
                Video (mp4)
              </button>
              <button
                className={`px-4 py-2 rounded ${selectedTypes[i] === 'mp3' ? 'bg-blue-500 text-white' : 'bg-gray-200'}`}
                onClick={() => handleTypeSelect(i, 'mp3')}
              >
                Audio (mp3)
              </button>
            </div>
            <VideoOptions
              formats={selectedTypes[i] === 'mp4'
                ? info.formats.filter(f => f.vcodec !== 'none')
                : info.formats.filter(f => f.vcodec === 'none' && f.acodec !== 'none')}
              selected={selectedFormats[i]}
              onSelect={fmt => handleFormatSelect(i, fmt)}
              name={`video-quality-${i}`}
            />
          </div>
        </div>
      ) : null)}
      {videoInfos.length > 0 && selectedFormats.length === urls.length && selectedFormats.every(f => !!f) && (
        <button
          className="mt-6 bg-green-600 text-white px-6 py-2 rounded w-full"
          onClick={handleDownload}
          disabled={loading}
        >
          Descargar todos
        </button>
      )}
      <p className="mt-4 text-sm text-gray-600">Carpeta: {carpeta}</p>
      <p className="mt-2 font-semibold">{status}</p>
    </div>
  );
}
