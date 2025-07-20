import { useState } from 'react';
import { notifyDownload } from './notification';
import Thumbnail from './Thumbnail';
import VideoOptions from './VideoOptions';

import MultiDownload from './MultiDownload';
import Loader from '../assets/Loader';


function MainMenu() {
  const [activeTab, setActiveTab] = useState('single');
  const [url, setUrl] = useState('');
  const [videoInfo, setVideoInfo] = useState(null);
  const [tab, setTab] = useState('video');
  const [selectedFormat, setSelectedFormat] = useState('');
  const [userSelected, setUserSelected] = useState(false);
  const [status, setStatus] = useState('');
  const [carpeta, setCarpeta] = useState('');
  const [loading, setLoading] = useState(false);

  const fetchInfo = async () => {
    setStatus('Cargando información...');
    setLoading(true);
    try {
      const info = await window.api.obtenerInfoVideo(url);
      setVideoInfo(info);
      setStatus('');
      // Seleccionar por defecto la mejor calidad de la pestaña activa
      if (info && info.formats) {
        const filtered = info.formats.filter(f => tab === 'video' ? f.vcodec !== 'none' : (f.vcodec === 'none' && f.acodec !== 'none'));
        if (filtered.length > 0) {
          setSelectedFormat(filtered[0].format_id);
          setUserSelected(false);
        }
      }
    } catch (e) {
      setStatus('No se pudo obtener la información del video');
    }
    setLoading(false);
  };

  const handleTab = (t) => {
    setTab(t);
    if (videoInfo && videoInfo.formats) {
      const filtered = videoInfo.formats.filter(f => t === 'video' ? f.vcodec !== 'none' : (f.vcodec === 'none' && f.acodec !== 'none'));
      if (filtered.length > 0) {
        setSelectedFormat(filtered[0].format_id);
        setUserSelected(false);
      }
    }
  };

  const handleDownload = async () => {
    if (!selectedFormat || !videoInfo) {
      setStatus('Debes cargar el video y seleccionar una calidad primero');
      return;
    }
    setLoading(true);
    // Bloquear la ventana principal mientras se elige la carpeta
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
    const result = await window.api.descargarVideo(url, selectedFormat, ruta);
    setLoading(false);
    if (result.ok) {
      setStatus(`Descarga completada`);
      notifyDownload(result.path);
    } else {
      setStatus(`Error: ${result.error}`);
    }
  };

  return (
    <div className="p-4 max-w-3xl mx-auto relative">
      <div className="flex gap-2 mb-6">
        <button
          className={`px-4 py-2 rounded-t ${activeTab === 'single' ? 'bg-blue-500 text-white' : 'bg-gray-200'}`}
          onClick={() => setActiveTab('single')}
        >
          Descargar un video
        </button>
        <button
          className={`px-4 py-2 rounded-t ${activeTab === 'multi' ? 'bg-blue-500 text-white' : 'bg-gray-200'}`}
          onClick={() => setActiveTab('multi')}
        >
          Descargar varios videos
        </button>
      </div>
      {activeTab === 'single' ? (
        <>
          <div className="flex items-center gap-2 mb-6">
            <input
              className="border p-2 flex-1"
              type="text"
              placeholder="URL del video"
              value={url}
              onChange={e => setUrl(e.target.value)}
            />
            <button
              className="bg-blue-600 text-white px-4 py-2 rounded"
              onClick={fetchInfo}
              disabled={loading || !url}
            >
              {loading ? 'Cargando...' : 'Cargar'}
            </button>
          </div>
          {videoInfo && (
            <div className="flex gap-8">
              <Thumbnail url={videoInfo.thumbnail} />
              <div className="flex-1">
                <div className="mb-4">
                  <button
                    className={`px-4 py-2 rounded-t ${tab === 'video' ? 'bg-blue-500 text-white' : 'bg-gray-200'}`}
                    onClick={() => handleTab('video')}
                  >
                    Video MP4
                  </button>
                  <button
                    className={`px-4 py-2 rounded-t ${tab === 'audio' ? 'bg-blue-500 text-white' : 'bg-gray-200'}`}
                    onClick={() => handleTab('audio')}
                  >
                    MP3
                  </button>
                </div>
                <div className="border p-4 rounded-b">
                  <VideoOptions
                    formats={videoInfo.formats.filter(f => tab === 'video' ? f.vcodec !== 'none' : f.acodec !== 'none' && f.vcodec === 'none')}
                    selected={selectedFormat}
                    onSelect={fmt => { setSelectedFormat(fmt); setUserSelected(true); }}
                  />
                </div>
                {userSelected && selectedFormat && (
                  <button
                    className="mt-6 bg-green-600 text-white px-6 py-2 rounded w-full"
                    onClick={handleDownload}
                    disabled={loading}
                  >
                    Descargar
                  </button>
                )}
              </div>
            </div>
          )}
          <p className="mt-4 text-sm text-gray-600">Carpeta: {carpeta}</p>
          <p className="mt-2 font-semibold">{status}</p>
          {loading && (
            <div className="flex justify-center items-center w-full mb-4">
              <div className='mt-10'>
                <Loader />
              </div>
            </div>
          )}
        </>
      ) : (
        <MultiDownload />
      )}
    </div>
  );
}

export default MainMenu;
