import React from 'react';

export default function Thumbnail({ url }) {
  if (!url) return null;
  return (
    <div className="flex items-center justify-center">
      <img src={url} alt="Miniatura" className="rounded shadow max-w-xs max-h-48" />
    </div>
  );
}
