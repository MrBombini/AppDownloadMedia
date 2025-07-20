import React from 'react';

export default function Loader() {
  return (
    <div className="flex items-center justify-center w-full h-full">
      <div className="loader-spin" style={{ width: 48, height: 48 }}>
        <svg className="animate-spin" viewBox="0 0 50 50">
          <circle
            className="text-gray-300 opacity-30"
            cx="25" cy="25" r="20" fill="none" strokeWidth="6"
            stroke="currentColor"
          />
          <circle
            className="text-blue-600"
            cx="25" cy="25" r="20" fill="none" strokeWidth="6"
            strokeDasharray="90 150"
            strokeDashoffset="-35"
            strokeLinecap="round"
            stroke="currentColor"
          />
        </svg>
      </div>
    </div>
  );
}
