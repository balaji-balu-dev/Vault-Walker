import React, { useState, useRef, useEffect } from 'react';
import { UploadCloud, X, File, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';
import { api } from '../services/api';

function formatBytes(bytes) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

export default function UploadModal({ isOpen, onClose, currentPath, onUploadComplete, disk = null }) {
  const [filesQueue, setFilesQueue] = useState([]);
  const [isUploading, setIsUploading] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef(null);
  const autoCloseTimeoutRef = useRef(null);

  const handleClose = () => {
    if (isUploading) return;
    if (autoCloseTimeoutRef.current) {
      clearTimeout(autoCloseTimeoutRef.current);
      autoCloseTimeoutRef.current = null;
    }
    setFilesQueue([]);
    onClose();
  };

  // Reset queue when modal is opened afresh
  useEffect(() => {
    if (isOpen) {
      if (autoCloseTimeoutRef.current) {
        clearTimeout(autoCloseTimeoutRef.current);
        autoCloseTimeoutRef.current = null;
      }
      setFilesQueue(prev => prev.filter(f => f.status !== 'completed'));
    }
  }, [isOpen]);

  // Handle ESC key to dismiss
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isOpen && !isUploading) {
        handleClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isUploading]);

  if (!isOpen) return null;

  const handleFilesSelected = (files) => {
    if (autoCloseTimeoutRef.current) {
      clearTimeout(autoCloseTimeoutRef.current);
      autoCloseTimeoutRef.current = null;
    }
    const list = Array.from(files).map(f => ({
      file: f,
      name: f.name,
      size: f.size,
      progress: 0,
      status: 'pending', // 'pending' | 'uploading' | 'completed' | 'error'
      error: null
    }));
    setFilesQueue(prev => {
      const active = prev.filter(f => f.status !== 'completed');
      return [...active, ...list];
    });
  };

  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFilesSelected(e.dataTransfer.files);
    }
  };

  const startUpload = async () => {
    const pendingOrError = filesQueue.filter(f => f.status === 'pending' || f.status === 'error');
    if (pendingOrError.length === 0) {
      if (filesQueue.length > 0 && filesQueue.every(f => f.status === 'completed')) {
        handleClose();
      }
      return;
    }

    if (isUploading) return;
    setIsUploading(true);
    let hadError = false;

    for (let i = 0; i < filesQueue.length; i++) {
      const item = filesQueue[i];
      if (item.status === 'completed') continue;

      // Update item status to uploading
      setFilesQueue(prev => prev.map((f, idx) => idx === i ? { ...f, status: 'uploading' } : f));

      try {
        // If file >= 20MB, use chunked upload; otherwise direct upload
        if (item.file.size >= 20 * 1024 * 1024) {
          await api.uploadChunked(item.file, currentPath, (progress) => {
            setFilesQueue(prev => prev.map((f, idx) => idx === i ? { ...f, progress } : f));
          }, disk);
        } else {
          await api.uploadDirect(currentPath, item.file, (progress) => {
            setFilesQueue(prev => prev.map((f, idx) => idx === i ? { ...f, progress } : f));
          }, disk);
        }

        setFilesQueue(prev => prev.map((f, idx) => idx === i ? { ...f, status: 'completed', progress: 100 } : f));
      } catch (err) {
        hadError = true;
        setFilesQueue(prev => prev.map((f, idx) => idx === i ? { ...f, status: 'error', error: err.message } : f));
      }
    }

    setIsUploading(false);
    if (onUploadComplete) onUploadComplete();

    // If all items succeeded without errors, auto-close modal after 1.2 seconds
    if (!hadError) {
      autoCloseTimeoutRef.current = setTimeout(() => {
        handleClose();
      }, 1200);
    }
  };

  const removeFile = (idx) => {
    setFilesQueue(prev => prev.filter((_, i) => i !== idx));
  };

  const handleBackdropClick = (e) => {
    if (e.target === e.currentTarget && !isUploading) {
      handleClose();
    }
  };

  const completedCount = filesQueue.filter(f => f.status === 'completed').length;
  const errorCount = filesQueue.filter(f => f.status === 'error').length;
  const pendingCount = filesQueue.filter(f => f.status === 'pending').length;
  const allCompleted = filesQueue.length > 0 && completedCount === filesQueue.length;

  return (
    <div
      onClick={handleBackdropClick}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fade-in"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="glass-panel w-full max-w-xl rounded-3xl p-6 shadow-2xl border border-slate-200 dark:border-slate-700/80 space-y-5"
      >
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <UploadCloud className="w-5 h-5 text-cyan-600 dark:text-cyan-400" />
              <span>Upload to Storage</span>
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Target: <span className="font-mono text-cyan-700 dark:text-cyan-300 font-semibold">/{currentPath || 'Root'}</span>
            </p>
          </div>
          <button
            onClick={handleClose}
            disabled={isUploading}
            className="p-1.5 rounded-xl text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors disabled:opacity-50 cursor-pointer"
            title="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Dropzone */}
        <div
          onDragEnter={handleDrag}
          onDragLeave={handleDrag}
          onDragOver={handleDrag}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition-all ${
            dragActive
              ? 'border-cyan-500 bg-cyan-500/10 dark:bg-cyan-950/30 shadow-lg shadow-cyan-500/10'
              : 'border-slate-300 dark:border-slate-700/80 bg-slate-50/80 dark:bg-slate-900/40 hover:border-cyan-500/50 hover:bg-slate-100/80 dark:hover:bg-slate-900/60'
          }`}
        >
          <input
            ref={fileInputRef}
            type="file"
            multiple
            className="hidden"
            onChange={(e) => handleFilesSelected(e.target.files)}
          />
          <UploadCloud className="w-10 h-10 text-cyan-500 dark:text-cyan-400/80 mx-auto mb-3" />
          <p className="text-xs font-semibold text-slate-800 dark:text-slate-200">
            Drag & drop files here, or <span className="text-cyan-600 dark:text-cyan-400 underline">browse</span>
          </p>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 font-mono">
            Direct & chunked high-speed streaming supported
          </p>
        </div>

        {/* Success Notice if all completed */}
        {allCompleted && (
          <div className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-700 dark:text-emerald-400 text-xs font-medium animate-fade-in">
            <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
            <span>All files uploaded successfully! Closing window...</span>
          </div>
        )}

        {/* Queue list */}
        {filesQueue.length > 0 && (
          <div className="max-h-56 overflow-y-auto space-y-2 pr-1">
            {filesQueue.map((item, idx) => (
              <div
                key={idx}
                className="glass-card rounded-xl p-3 flex items-center justify-between text-xs border border-slate-200 dark:border-slate-800 shadow-sm"
              >
                <div className="flex items-center gap-2.5 truncate flex-1 mr-3">
                  <File className="w-4 h-4 text-slate-400 shrink-0" />
                  <div className="truncate flex-1">
                    <div className="text-slate-900 dark:text-slate-200 font-medium truncate">{item.name}</div>
                    <div className="text-[10px] text-slate-500 dark:text-slate-400 font-mono flex items-center gap-2">
                      <span>{formatBytes(item.size)}</span>
                      {item.status === 'uploading' && (
                        <span className="text-cyan-600 dark:text-cyan-400 font-semibold">{item.progress}%</span>
                      )}
                      {item.status === 'error' && (
                        <span className="text-rose-400">{item.error}</span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {item.status === 'completed' && (
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  )}
                  {item.status === 'uploading' && (
                    <Loader2 className="w-4 h-4 text-cyan-400 animate-spin" />
                  )}
                  {item.status === 'error' && (
                    <AlertCircle className="w-4 h-4 text-rose-400" />
                  )}
                  {item.status === 'pending' && !isUploading && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        removeFile(idx);
                      }}
                      className="text-slate-400 hover:text-rose-400 p-1"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center justify-end gap-3 pt-2 border-t border-slate-800">
          <button
            onClick={handleClose}
            disabled={isUploading}
            className="px-4 py-2 rounded-xl text-xs font-medium text-slate-400 hover:text-white hover:bg-slate-800 transition-colors disabled:opacity-50"
          >
            {allCompleted ? 'Close' : 'Cancel'}
          </button>
          <button
            onClick={startUpload}
            disabled={filesQueue.length === 0 || isUploading}
            className={`flex items-center gap-2 px-5 py-2 rounded-xl text-xs font-bold uppercase tracking-wider transition-all cursor-pointer shadow-lg ${
              allCompleted
                ? 'bg-emerald-500 hover:bg-emerald-400 text-slate-950 shadow-emerald-500/20'
                : 'bg-gradient-to-r from-cyan-500 to-emerald-500 hover:opacity-95 text-slate-950 shadow-cyan-500/20 disabled:opacity-50'
            }`}
          >
            {isUploading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Uploading...</span>
              </>
            ) : allCompleted ? (
              <>
                <CheckCircle2 className="w-4 h-4" />
                <span>Done</span>
              </>
            ) : errorCount > 0 && pendingCount === 0 ? (
              <span>Retry ({errorCount})</span>
            ) : (
              <span>Start Upload ({pendingCount || filesQueue.length})</span>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
