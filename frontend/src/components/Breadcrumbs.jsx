import React from 'react';
import { Home, ChevronRight, Copy, Check } from 'lucide-react';

export default function Breadcrumbs({ breadcrumbs = [], onNavigate }) {
  const [copied, setCopied] = React.useState(false);

  const fullPath = breadcrumbs.map(b => b.name).join('/');

  const handleCopy = () => {
    navigator.clipboard.writeText(fullPath || '/');
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <nav className="flex items-center justify-between text-xs py-2 px-1">
      <div className="flex items-center gap-1.5 flex-wrap">
        {breadcrumbs.map((crumb, idx) => {
          const isLast = idx === breadcrumbs.length - 1;
          const isRoot = idx === 0;

          return (
            <React.Fragment key={crumb.path || 'root'}>
              {idx > 0 && <ChevronRight className="w-3.5 h-3.5 text-slate-400" />}
              <button
                onClick={() => onNavigate(crumb.path)}
                disabled={isLast}
                className={`flex items-center gap-1 px-2 py-1 rounded-md transition-colors ${
                  isLast
                    ? 'text-cyan-700 dark:text-cyan-300 font-semibold bg-cyan-500/10 border border-cyan-500/20'
                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800/60'
                }`}
              >
                {isRoot && <Home className="w-3.5 h-3.5" />}
                <span>{crumb.name}</span>
              </button>
            </React.Fragment>
          );
        })}
      </div>

      <button
        onClick={handleCopy}
        className="text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 p-1.5 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
        title="Copy path"
      >
        {copied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
      </button>
    </nav>
  );
}
