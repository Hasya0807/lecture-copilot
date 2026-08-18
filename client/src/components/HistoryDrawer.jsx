import React from 'react';
import { X, History, Trash2, Clock, Play } from 'lucide-react';

const HistoryDrawer = ({ isOpen, onClose, history = [], onSelectVideo, onClearHistory, onRemoveHistoryItem }) => {
  if (!isOpen) return null;

  const formatDuration = (seconds) => {
    if (!seconds) return '';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}m ${secs}s`;
  };

  const formatDate = (dateString) => {
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    } catch {
      return '';
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs transition-opacity animate-fade-in"
        onClick={onClose}
      />

      {/* Drawer Panel */}
      <div className="relative w-full max-w-sm bg-white border-l border-slate-200 h-full flex flex-col z-10 shadow-2xl animate-fade-in">
        {/* Header */}
        <div className="p-4 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <History className="w-4 h-4 text-blue-600" />
            <h2 className="text-sm font-bold text-slate-900">Recent Lectures</h2>
            <span className="px-2 py-0.5 rounded text-[11px] bg-slate-100 text-slate-700 font-mono font-medium border border-slate-200">
              {history.length}
            </span>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* List Content */}
        <div className="flex-1 overflow-y-auto p-3 space-y-2 custom-scrollbar">
          {history.length === 0 ? (
            <div className="text-center py-16 px-4 text-slate-500">
              <History className="w-8 h-8 mx-auto mb-2 opacity-30 text-slate-400" />
              <p className="text-xs font-medium text-slate-700">No lecture history yet.</p>
              <p className="text-[11px] text-slate-500 mt-1">Videos you analyze will appear here for 1-click re-access.</p>
            </div>
          ) : (
            history.map((item) => (
              <div
                key={item.videoId}
                className="group relative bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl p-2.5 transition-all flex gap-3 cursor-pointer shadow-2xs"
                onClick={() => {
                  onSelectVideo(item);
                  onClose();
                }}
              >
                {/* Thumbnail */}
                <div className="relative w-20 h-14 rounded-lg bg-slate-200 overflow-hidden shrink-0">
                  <img
                    src={item.thumbnailUrl || `https://img.youtube.com/vi/${item.videoId}/hqdefault.jpg`}
                    alt={item.title}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    onError={(e) => {
                      e.target.src = 'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?w=300&auto=format&fit=crop&q=60';
                    }}
                  />
                  <div className="absolute inset-0 bg-black/20 group-hover:bg-black/10 flex items-center justify-center transition-colors">
                    <Play className="w-4 h-4 text-white opacity-90 group-hover:opacity-100 fill-current" />
                  </div>
                </div>

                {/* Details */}
                <div className="flex-1 min-w-0 pr-4">
                  <h3 className="text-xs font-semibold text-slate-900 group-hover:text-blue-600 line-clamp-2 leading-snug transition-colors">
                    {item.title || `Video ${item.videoId}`}
                  </h3>
                  <div className="flex items-center gap-2 mt-1.5 text-[11px] text-slate-500 font-medium">
                    {item.duration && (
                      <span className="flex items-center gap-1 font-mono">
                        <Clock className="w-2.5 h-2.5" />
                        {formatDuration(item.duration)}
                      </span>
                    )}
                    {item.date && <span>• {formatDate(item.date)}</span>}
                  </div>
                </div>

                {/* Remove button */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onRemoveHistoryItem(item.videoId);
                  }}
                  className="absolute top-2 right-2 p-1 text-slate-400 hover:text-rose-600 opacity-0 group-hover:opacity-100 transition-all rounded hover:bg-white"
                  title="Remove from history"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        {history.length > 0 && (
          <div className="p-3 border-t border-slate-200 bg-slate-50">
            <button
              onClick={onClearHistory}
              className="w-full py-1.5 text-xs font-semibold text-slate-600 hover:text-rose-600 flex items-center justify-center gap-1.5 transition-colors rounded-lg hover:bg-slate-100 cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Clear History</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default HistoryDrawer;
