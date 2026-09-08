import React, { useState, useEffect } from 'react';
import { X, Download, ZoomIn, ZoomOut, RotateCw, FileText } from 'lucide-react';
import { api } from '../services/api';

export default function Lightbox({ item, onClose, currentDisk }) {
  const [scale, setScale] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [textContent, setTextContent] = useState(null);
  const [loadingText, setLoadingText] = useState(false);

  useEffect(() => {
    if (!item) return;
    setScale(1);
    setRotation(0);
    setTextContent(null);

    // If text/doc type, fetch content
    const textExts = ['txt', 'md', 'json', 'csv', 'log', 'yaml', 'yml', 'xml', 'js', 'py'];
    if (textExts.includes(item.extension?.toLowerCase())) {
      setLoadingText(true);
      fetch(api.getDownloadUrl(item.path, currentDisk, true))
        .then(r => r.text())
        .then(txt => {
          setTextContent(txt);
          setLoadingText(false);
        })
        .catch(() => {
          setTextContent('Failed to load text preview.');
          setLoadingText(false);
        });
    }
  }, [item, currentDisk]);

  if (!item) return null;

  const previewUrl = api.getDownloadUrl(item.path, currentDisk, true);
  const downloadUrl = api.getDownloadUrl(item.path, currentDisk, false);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-2 sm:p-4 animate-fade-in select-none">
      {/* Top Header */}
      <div className="absolute top-3 left-3 right-3 sm:top-4 sm:left-6 sm:right-6 flex items-center justify-between text-xs text-slate-300 z-10">
        <div className="flex items-center gap-2 sm:gap-3">
          <span className="font-semibold text-white text-xs sm:text-sm truncate max-w-[130px] sm:max-w-sm">{item.name}</span>
          <span className="font-mono text-[10px] sm:text-[11px] px-1.5 sm:px-2 py-0.5 rounded bg-slate-800 border border-slate-700">
            {item.extension?.toUpperCase()}
          </span>
        </div>

        <div className="flex items-center gap-1.5 sm:gap-2">
          {item.category === 'image' && (
            <div className="hidden sm:flex items-center gap-1.5">
              <button
                onClick={() => setScale(s => Math.min(s + 0.25, 3))}
                className="p-2 rounded-xl bg-slate-900/80 border border-slate-800 hover:text-white transition-colors"
                title="Zoom In"
              >
                <ZoomIn className="w-4 h-4" />
              </button>
              <button
                onClick={() => setScale(s => Math.max(s - 0.25, 0.5))}
                className="p-2 rounded-xl bg-slate-900/80 border border-slate-800 hover:text-white transition-colors"
                title="Zoom Out"
              >
                <ZoomOut className="w-4 h-4" />
              </button>
              <button
                onClick={() => setRotation(r => (r + 90) % 360)}
                className="p-2 rounded-xl bg-slate-900/80 border border-slate-800 hover:text-white transition-colors"
                title="Rotate"
              >
                <RotateCw className="w-4 h-4" />
              </button>
            </div>
          )}

          <a
            href={downloadUrl}
            download={item.name}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 hover:bg-cyan-500/30 transition-colors"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Download</span>
          </a>

          <button
            onClick={onClose}
            className="p-2 rounded-xl bg-slate-900/80 border border-slate-800 text-slate-400 hover:text-white transition-colors"
            title="Close Preview"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Main Preview Container */}
      <div className="w-full h-full flex items-center justify-center p-8 overflow-hidden">
        {item.category === 'image' && (
          <div className="relative max-w-full max-h-full flex items-center justify-center">
            <img
              src={previewUrl}
              alt={item.name}
              style={{
                transform: `scale(${scale}) rotate(${rotation}deg)`,
                transition: 'transform 0.2s cubic-bezier(0.16, 1, 0.3, 1)'
              }}
              className="max-h-[82vh] max-w-[85vw] object-contain rounded-xl shadow-2xl"
            />
          </div>
        )}

        {item.category === 'video' && (
          <div className="w-full max-w-4xl max-h-[80vh] rounded-2xl overflow-hidden shadow-2xl bg-black border border-slate-800">
            <video
              src={previewUrl}
              controls
              autoPlay
              className="w-full h-full max-h-[78vh] object-contain"
            />
          </div>
        )}

        {textContent !== null && (
          <div className="w-full max-w-3xl max-h-[78vh] glass-card rounded-2xl p-6 overflow-y-auto border border-slate-800 shadow-2xl">
            <div className="flex items-center gap-2 mb-3 pb-2 border-b border-slate-800 text-slate-400 font-mono text-xs">
              <FileText className="w-4 h-4 text-cyan-400" />
              <span>Document Contents</span>
            </div>
            <pre className="font-mono text-xs text-slate-300 whitespace-pre-wrap leading-relaxed">
              {textContent}
            </pre>
          </div>
        )}

        {loadingText && (
          <div className="text-center">
            <div className="w-8 h-8 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
            <p className="text-xs font-mono text-slate-400">Loading document...</p>
          </div>
        )}
      </div>
    </div>
  );
}
