import React, { useState, useEffect } from 'react';
import { Edit3, Clock, Download, Copy, Check, Trash2 } from 'lucide-react';

const NotesView = ({ videoId, videoTitle, playerRef, onSeek }) => {
  const storageKey = `lecture_copilot_notes_${videoId}`;
  const [notes, setNotes] = useState(() => {
    return localStorage.getItem(storageKey) || '';
  });
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    localStorage.setItem(storageKey, notes);
  }, [notes, storageKey]);

  const getCurrentTimeFormatted = () => {
    let seconds = 0;
    try {
      if (playerRef?.current?.getCurrentTime) {
        seconds = Math.floor(playerRef.current.getCurrentTime());
      }
    } catch (e) {
      seconds = 0;
    }
    const mins = Math.floor(seconds / 60).toString().padStart(2, '0');
    const secs = (seconds % 60).toString().padStart(2, '0');
    return { formatted: `${mins}:${secs}`, seconds };
  };

  const handleInsertTimestamp = () => {
    const { formatted, seconds } = getCurrentTimeFormatted();
    const tag = `\n\n### [${formatted}](timestamp:${seconds})\n- `;
    setNotes(prev => (prev ? prev + tag : `### [${formatted}](timestamp:${seconds})\n- `));
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(notes);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    const blob = new Blob([notes], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${(videoTitle || 'lecture').replace(/[^a-z0-9]/gi, '_')}-notes.md`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex flex-col h-full bg-[#fafbfc]">
      {/* Action Toolbar */}
      <div className="p-3 border-b border-slate-200 bg-white flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Edit3 className="w-3.5 h-3.5 text-blue-600" />
          <span className="text-xs font-semibold text-slate-800">Personal Study Notes</span>
        </div>
        <div className="flex items-center gap-1.5">
          <button
            onClick={handleInsertTimestamp}
            className="text-xs bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 px-2.5 py-1 rounded-lg font-semibold flex items-center gap-1 transition-colors cursor-pointer shadow-2xs"
            title="Insert timestamp at current video position"
          >
            <Clock className="w-3 h-3" />
            <span>Stamp time</span>
          </button>
          {notes && (
            <>
              <button
                onClick={handleCopy}
                className="text-xs text-slate-600 hover:text-slate-900 p-1.5 rounded hover:bg-slate-100 transition-colors cursor-pointer"
                title="Copy notes"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
              </button>
              <button
                onClick={handleDownload}
                className="text-xs text-slate-600 hover:text-slate-900 p-1.5 rounded hover:bg-slate-100 transition-colors cursor-pointer"
                title="Download as Markdown"
              >
                <Download className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => {
                  if (confirm('Clear all study notes for this lecture?')) setNotes('');
                }}
                className="text-xs text-slate-400 hover:text-rose-600 p-1.5 rounded hover:bg-slate-100 transition-colors cursor-pointer"
                title="Clear notes"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </>
          )}
        </div>
      </div>

      {/* Editor Area */}
      <div className="flex-1 flex flex-col p-3">
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder={`Take timestamped study notes as you watch...\n\nClick "Stamp time" above to insert bookmarks, formulas, or key observations.\nNotes automatically save to your browser storage.`}
          className="w-full flex-1 bg-white border border-slate-200 rounded-xl p-3 text-xs sm:text-sm text-slate-900 placeholder:text-slate-400 font-sans focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/20 resize-none leading-relaxed custom-scrollbar shadow-xs"
        />
        <div className="flex items-center justify-between text-[11px] text-slate-500 mt-2 px-1 font-medium">
          <span>Markdown supported</span>
          <span>{notes.length} characters • Auto-saved locally</span>
        </div>
      </div>
    </div>
  );
};

export default NotesView;
