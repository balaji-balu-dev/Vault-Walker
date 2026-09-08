import React, { useState } from 'react';
import { 
  Folder, FileText, Image as ImageIcon, Film, Package, 
  Download, Archive, Trash2, Edit2, MoreVertical, LayoutGrid, 
  List as ListIcon, Search, ArrowUpDown, Eye, CheckSquare, Square,
  Loader2 
} from 'lucide-react';
import { api } from '../services/api';

function formatBytes(bytes) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

function formatDate(timestamp) {
  if (!timestamp) return '--';
  return new Date(timestamp * 1000).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

function getFileIcon(item) {
  if (item.is_dir) return <Folder className="w-6 h-6 text-cyan-500 dark:text-cyan-400 fill-cyan-400/10" />;
  switch (item.category) {
    case 'image':
      return <ImageIcon className="w-6 h-6 text-emerald-500 dark:text-emerald-400" />;
    case 'video':
      return <Film className="w-6 h-6 text-violet-500 dark:text-violet-400" />;
    case 'document':
      return <FileText className="w-6 h-6 text-amber-500 dark:text-amber-400" />;
    default:
      return <Package className="w-6 h-6 text-slate-400" />;
  }
}

export default function FileGrid({
  items = [],
  loading = false,
  user,
  viewMode = 'grid',
  onToggleView,
  onNavigateFolder,
  onPreviewItem,
  onDeleteItems,
  onRenameItem,
  searchQuery,
  onSearchChange,
  sortBy,
  sortOrder,
  onSortChange,
  currentDisk = null,
  hasMore = false,
  onLoadMore = null,
  totalCount = 0
}) {
  const [selectedPaths, setSelectedPaths] = useState(new Set());
  const [activeDropdown, setActiveDropdown] = useState(null);

  const toggleSelect = (path, e) => {
    e.stopPropagation();
    const next = new Set(selectedPaths);
    if (next.has(path)) {
      next.delete(path);
    } else {
      next.add(path);
    }
    setSelectedPaths(next);
  };

  const selectAll = () => {
    if (selectedPaths.size === items.length) {
      setSelectedPaths(new Set());
    } else {
      setSelectedPaths(new Set(items.map(i => i.path)));
    }
  };

  const handleDownloadZip = async () => {
    if (selectedPaths.size === 0) return;
    try {
      await api.downloadZip(Array.from(selectedPaths), currentDisk);
    } catch (err) {
      alert(err.message || 'ZIP download failed');
    }
  };

  const handleDeleteSelected = () => {
    if (selectedPaths.size === 0) return;
    if (window.confirm(`Permanently delete ${selectedPaths.size} selected item(s)?`)) {
      onDeleteItems(Array.from(selectedPaths));
      setSelectedPaths(new Set());
    }
  };

  return (
    <div className="space-y-4">
      {/* Controls & Filter Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white/70 dark:bg-slate-900/60 p-3 rounded-2xl border border-slate-200 dark:border-slate-800/80 shadow-sm backdrop-blur-md">
        {/* Search */}
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Filter files by name..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="w-full pl-9 pr-4 py-2 rounded-xl bg-slate-50 dark:bg-slate-950/80 border border-slate-200 dark:border-slate-800 text-xs text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-cyan-500/40 transition-all font-mono"
          />
        </div>

        {/* Selection & Sorting Actions */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0">
          {items.length > 0 && (
            <button
              onClick={selectAll}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/60 text-xs text-slate-700 dark:text-slate-300 hover:text-cyan-500 font-mono transition-colors shrink-0 cursor-pointer"
            >
              {selectedPaths.size === items.length && items.length > 0 ? (
                <CheckSquare className="w-3.5 h-3.5 text-cyan-500" />
              ) : (
                <Square className="w-3.5 h-3.5" />
              )}
              <span>Select All</span>
            </button>
          )}

          {selectedPaths.size > 0 && (
            <>
              <button
                onClick={handleDownloadZip}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-xs font-semibold text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/25 transition-colors shrink-0 cursor-pointer"
              >
                <Archive className="w-3.5 h-3.5" />
                <span>Download Zip ({selectedPaths.size})</span>
              </button>

              {user?.role === 'admin' && (
                <button
                  onClick={handleDeleteSelected}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-rose-500/15 border border-rose-500/30 text-xs font-semibold text-rose-600 dark:text-rose-400 hover:bg-rose-500/25 transition-colors shrink-0 cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Delete ({selectedPaths.size})</span>
                </button>
              )}
            </>
          )}

          {/* Sort Dropdown */}
          <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800/60 p-1 rounded-xl border border-slate-200 dark:border-slate-700/60 shrink-0">
            <select
              value={sortBy}
              onChange={(e) => onSortChange(e.target.value, sortOrder)}
              className="bg-transparent text-xs text-slate-700 dark:text-slate-300 font-mono px-2 py-0.5 focus:outline-none cursor-pointer"
            >
              <option value="name" className="bg-white dark:bg-slate-900 text-slate-900 dark:text-white">Name</option>
              <option value="date" className="bg-white dark:bg-slate-900 text-slate-900 dark:text-white">Modified</option>
              <option value="size" className="bg-white dark:bg-slate-900 text-slate-900 dark:text-white">Size</option>
            </select>
            <button
              onClick={() => onSortChange(sortBy, sortOrder === 'asc' ? 'desc' : 'asc')}
              className="p-1 text-slate-500 dark:text-slate-400 hover:text-cyan-500"
              title={`Sorting ${sortOrder.toUpperCase()}`}
            >
              <ArrowUpDown className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* View Mode Toggle */}
          <div className="flex items-center bg-slate-100 dark:bg-slate-800/60 p-1 rounded-xl border border-slate-200 dark:border-slate-700/60 shrink-0">
            <button
              onClick={() => onToggleView('grid')}
              className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                viewMode === 'grid' ? 'bg-cyan-500/20 text-cyan-600 dark:text-cyan-400 font-bold' : 'text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
              }`}
              title="Grid View"
            >
              <LayoutGrid className="w-4 h-4" />
            </button>
            <button
              onClick={() => onToggleView('list')}
              className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                viewMode === 'list' ? 'bg-cyan-500/20 text-cyan-600 dark:text-cyan-400 font-bold' : 'text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
              }`}
              title="List View"
            >
              <ListIcon className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Loading Skeleton Placeholders */}
      {loading && items.length === 0 && (
        viewMode === 'grid' ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3.5">
            {[...Array(12)].map((_, idx) => (
              <div key={idx} className="glass-card rounded-2xl p-3 flex flex-col justify-between h-44 space-y-2 animate-pulse">
                <div className="flex justify-between items-center">
                  <div className="w-4 h-4 rounded bg-slate-200 dark:bg-slate-800" />
                  <div className="w-4 h-4 rounded bg-slate-200 dark:bg-slate-800" />
                </div>
                <div className="w-full flex-1 rounded-xl skeleton-shimmer bg-slate-200/50 dark:bg-slate-800/50 my-1" />
                <div className="space-y-1">
                  <div className="w-3/4 h-3 rounded bg-slate-200 dark:bg-slate-800" />
                  <div className="w-1/2 h-2 rounded bg-slate-200 dark:bg-slate-800" />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="glass-card rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-800 animate-pulse">
            <div className="p-4 space-y-3">
              {[...Array(8)].map((_, idx) => (
                <div key={idx} className="flex items-center gap-4 py-2 border-b border-slate-100 dark:border-slate-800/50">
                  <div className="w-5 h-5 rounded bg-slate-200 dark:bg-slate-800" />
                  <div className="w-48 h-3 rounded bg-slate-200 dark:bg-slate-800" />
                  <div className="w-24 h-3 rounded bg-slate-200 dark:bg-slate-800 ml-auto" />
                  <div className="w-32 h-3 rounded bg-slate-200 dark:bg-slate-800" />
                </div>
              ))}
            </div>
          </div>
        )
      )}

      {/* Empty State */}
      {!loading && items.length === 0 && (
        <div className="py-24 text-center glass-card rounded-3xl border border-dashed border-slate-200 dark:border-slate-800/80">
          <div className="w-14 h-14 rounded-2xl bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex items-center justify-center text-slate-400 mx-auto mb-4">
            <Folder className="w-7 h-7" />
          </div>
          <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-200">No files found</h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-sm mx-auto">
            {searchQuery
              ? `No items matching "${searchQuery}". Try clearing your search filter.`
              : 'This folder is currently empty. Drop files here or use the upload button.'}
          </p>
        </div>
      )}

      {/* Grid View */}
      {items.length > 0 && viewMode === 'grid' && (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3.5">
          {items.map((item) => {
            const isSelected = selectedPaths.has(item.path);

            return (
              <div
                key={item.path}
                onClick={() => {
                  if (item.is_dir) onNavigateFolder(item.path);
                  else onPreviewItem(item);
                }}
                className={`group relative glass-card rounded-2xl p-3 cursor-pointer glass-hover select-none flex flex-col justify-between h-44 transition-all duration-200 ${
                  isSelected ? 'border-cyan-500 bg-cyan-500/10 shadow-md ring-1 ring-cyan-500' : ''
                }`}
              >
                {/* Select checkbox & dropdown toggle */}
                <div className="flex items-center justify-between z-10">
                  <button
                    onClick={(e) => toggleSelect(item.path, e)}
                    className={`p-1.5 rounded-lg transition-colors ${
                      isSelected ? 'text-cyan-500 dark:text-cyan-400' : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 opacity-80 sm:opacity-0 sm:group-hover:opacity-100'
                    }`}
                  >
                    {isSelected ? <CheckSquare className="w-4 h-4" /> : <Square className="w-4 h-4" />}
                  </button>

                  <div className="relative">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setActiveDropdown(activeDropdown === item.path ? null : item.path);
                      }}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800/60 opacity-80 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity"
                    >
                      <MoreVertical className="w-4 h-4" />
                    </button>

                    {/* Context Menu */}
                    {activeDropdown === item.path && (
                      <div
                        onClick={(e) => e.stopPropagation()}
                        className="absolute right-0 top-6 w-36 py-1 glass-panel rounded-xl shadow-xl z-20 border border-slate-200 dark:border-slate-700/80 text-xs"
                      >
                        {!item.is_dir && (
                          <>
                            <button
                              onClick={() => {
                                onPreviewItem(item);
                                setActiveDropdown(null);
                              }}
                              className="w-full px-3 py-1.5 text-left text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800/80 flex items-center gap-2"
                            >
                              <Eye className="w-3.5 h-3.5 text-cyan-500" />
                              <span>Preview</span>
                            </button>
                            <a
                              href={api.getDownloadUrl(item.path, currentDisk)}
                              download={item.name}
                              onClick={() => setActiveDropdown(null)}
                              className="w-full px-3 py-1.5 text-left text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800/80 flex items-center gap-2"
                            >
                              <Download className="w-3.5 h-3.5 text-emerald-500" />
                              <span>Download</span>
                            </a>
                          </>
                        )}

                        {user?.role === 'admin' && (
                          <>
                            <button
                              onClick={() => {
                                const newName = prompt('Enter new name:', item.name);
                                if (newName && newName !== item.name) onRenameItem(item.path, newName);
                                setActiveDropdown(null);
                              }}
                              className="w-full px-3 py-1.5 text-left text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800/80 flex items-center gap-2"
                            >
                              <Edit2 className="w-3.5 h-3.5 text-amber-500" />
                              <span>Rename</span>
                            </button>
                            <button
                              onClick={() => {
                                if (confirm(`Delete "${item.name}"?`)) onDeleteItems([item.path]);
                                setActiveDropdown(null);
                              }}
                              className="w-full px-3 py-1.5 text-left text-rose-500 hover:bg-rose-500/10 flex items-center gap-2"
                            >
                              <Trash2 className="w-3.5 h-3.5 text-rose-500" />
                              <span>Delete</span>
                            </button>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* Thumbnail / Icon Preview */}
                <div className="flex-1 flex items-center justify-center my-1 overflow-hidden rounded-xl bg-slate-100 dark:bg-slate-950/40 relative">
                  {item.category === 'image' ? (
                    <img
                      src={api.getThumbnailUrl(item.path, currentDisk)}
                      alt={item.name}
                      loading="lazy"
                      className="w-full h-full object-cover rounded-xl transition-transform duration-300 group-hover:scale-105"
                      onError={(e) => {
                        e.target.onerror = null;
                        e.target.style.display = 'none';
                      }}
                    />
                  ) : (
                    <div className="transition-transform duration-300 group-hover:scale-110">
                      {getFileIcon(item)}
                    </div>
                  )}
                </div>

                {/* Name & Metadata */}
                <div className="mt-1 leading-tight">
                  <div className="text-xs font-medium text-slate-800 dark:text-slate-200 truncate" title={item.name}>
                    {item.name}
                  </div>
                  <div className="text-[10px] text-slate-500 dark:text-slate-400 font-mono flex items-center justify-between mt-0.5">
                    <span>{item.is_dir ? 'Folder' : formatBytes(item.size)}</span>
                    <span>{item.extension?.toUpperCase()}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* List View */}
      {items.length > 0 && viewMode === 'list' && (
        <div className="glass-card rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-800/80 shadow-sm">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-100/90 dark:bg-slate-950/80 border-b border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 font-mono uppercase text-[11px]">
              <tr>
                <th className="p-3 w-10 text-center">
                  <input
                    type="checkbox"
                    checked={selectedPaths.size === items.length && items.length > 0}
                    onChange={selectAll}
                    className="rounded border-slate-300 dark:border-slate-700 text-cyan-500 cursor-pointer"
                  />
                </th>
                <th className="p-3">Name</th>
                <th className="p-3 hidden sm:table-cell">Size</th>
                <th className="p-3 hidden md:table-cell">Modified</th>
                <th className="p-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800/40">
              {items.map((item) => {
                const isSelected = selectedPaths.has(item.path);

                return (
                  <tr
                    key={item.path}
                    onClick={() => {
                      if (item.is_dir) onNavigateFolder(item.path);
                      else onPreviewItem(item);
                    }}
                    className={`hover:bg-slate-100/60 dark:hover:bg-slate-800/40 transition-colors cursor-pointer ${
                      isSelected ? 'bg-cyan-500/10' : ''
                    }`}
                  >
                    <td className="p-3 text-center" onClick={(e) => toggleSelect(item.path, e)}>
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => {}}
                        className="rounded border-slate-300 dark:border-slate-700 text-cyan-500 cursor-pointer"
                      />
                    </td>
                    <td className="p-3">
                      <div className="flex items-center gap-2.5">
                        <div className="shrink-0">{getFileIcon(item)}</div>
                        <span className="font-medium text-slate-800 dark:text-slate-200 truncate max-w-xs md:max-w-md">
                          {item.name}
                        </span>
                      </div>
                    </td>
                    <td className="p-3 font-mono text-slate-500 dark:text-slate-400 hidden sm:table-cell">
                      {item.is_dir ? '--' : formatBytes(item.size)}
                    </td>
                    <td className="p-3 font-mono text-slate-500 dark:text-slate-400 hidden md:table-cell">
                      {formatDate(item.modified_at)}
                    </td>
                    <td className="p-3 text-right" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-end gap-1.5">
                        {!item.is_dir && (
                          <a
                            href={api.getDownloadUrl(item.path, currentDisk)}
                            download={item.name}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-cyan-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                            title="Download"
                          >
                            <Download className="w-4 h-4" />
                          </a>
                        )}
                        {user?.role === 'admin' && (
                          <>
                            <button
                              onClick={() => {
                                const newName = prompt('Enter new name:', item.name);
                                if (newName && newName !== item.name) onRenameItem(item.path, newName);
                              }}
                              className="p-1.5 rounded-lg text-slate-400 hover:text-amber-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                              title="Rename"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => {
                                if (confirm(`Delete "${item.name}"?`)) onDeleteItems([item.path]);
                              }}
                              className="p-1.5 rounded-lg text-slate-400 hover:text-rose-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                              title="Delete"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination "Load More" */}
      {hasMore && (
        <div className="text-center pt-4 pb-2">
          <button
            onClick={onLoadMore}
            disabled={loading}
            className="inline-flex items-center gap-2 px-6 py-2.5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:border-cyan-500/50 hover:text-cyan-500 shadow-sm transition-all cursor-pointer disabled:opacity-50"
          >
            {loading ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin text-cyan-500" />
                <span>Loading more files...</span>
              </>
            ) : (
              <span>Load More Files ({items.length} of {totalCount})</span>
            )}
          </button>
        </div>
      )}
    </div>
  );
}
