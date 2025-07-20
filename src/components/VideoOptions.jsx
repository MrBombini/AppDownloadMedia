import React from 'react';

export default function VideoOptions({ formats, selected, onSelect, name = "video-quality" }) {
  let options = [];
  if (formats.length > 0 && formats[0].vcodec !== 'none') {
    // VIDEO: mostrar primero las opciones con audio, luego las de solo video (sin audio)
    let grouped = {};
    // Primero, agregar video+audio
    formats.filter(f => f.vcodec !== 'none' && f.acodec !== 'none').forEach(fmt => {
      const height = fmt.height || (fmt.resolution ? parseInt(fmt.resolution.split('x')[1]) : null);
      if (!height) return;
      if (!grouped[height] || (fmt.tbr > (grouped[height].tbr || 0))) {
        grouped[height] = fmt;
      }
    });
    // Luego, si falta alguna altura, agregar solo video
    formats.filter(f => f.vcodec !== 'none' && f.acodec === 'none').forEach(fmt => {
      const height = fmt.height || (fmt.resolution ? parseInt(fmt.resolution.split('x')[1]) : null);
      if (!height) return;
      if (!grouped[height] || (fmt.tbr > (grouped[height].tbr || 0))) {
        grouped[height] = fmt;
      }
    });
    options = Object.values(grouped);
    // Ordenar por altura descendente
    options.sort((a, b) => (b.height || 0) - (a.height || 0));
  } else {
    // AUDIO: agrupar por bitrate
    options = Object.values(
      formats.reduce((acc, fmt) => {
        const abr = fmt.abr || (fmt.format_note ? parseInt(fmt.format_note) : null);
        if (!abr) return acc;
        if (!acc[abr] || (fmt.tbr > (acc[abr].tbr || 0))) {
          acc[abr] = fmt;
        }
        return acc;
      }, {})
    );
    // Ordenar por bitrate descendente
    options.sort((a, b) => (b.abr || 0) - (a.abr || 0));
  }
  return (
    <div className="flex flex-col gap-2">
      {options.map((fmt) => (
        <label key={fmt.format_id} className="flex items-center gap-2">
          <input
            type="radio"
            name={name}
            value={fmt.format_id}
            checked={selected === fmt.format_id}
            onChange={() => onSelect(fmt.format_id)}
          />
          {fmt.height ? `${fmt.height}p` : (fmt.abr ? `${fmt.abr}kbps` : (fmt.format_note || fmt.ext))}
          
          
        </label>
      ))}
    </div>
  );
}
