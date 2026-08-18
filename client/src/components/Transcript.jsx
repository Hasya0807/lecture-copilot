import React, { useState, useMemo } from 'react';
import { Play, Search, X, Copy, Check, Download, FileText } from 'lucide-react';

const Transcript = ({ transcript = [], onSeek }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [copied, setCopied] = useState(false);

  const formatTime = (ms) => {
    const totalSeconds = Math.floor(ms / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60).toString().padStart(2, '0');
    const seconds = (totalSeconds % 60).toString().padStart(2, '0');
    
    if (hours > 0) {
      return `${hours}:${minutes}:${seconds}`;
    }
    return `${minutes}:${seconds}`;
  };

  const filteredTranscript = useMemo(() => {
    if (!searchQuery.trim()) return transcript;
    const query = searchQuery.toLowerCase();
    return transcript.filter(item => item.text.toLowerCase().includes(query));
  }, [transcript, searchQuery]);

  const handleCopyAll = () => {
    const fullText = transcript
      .map(item => `[${formatTime(item.offset)}] ${item.text}`)
      .join('\n');
    navigator.clipboard.writeText(fullText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    const fullText = transcript
      .map(item => `[${formatTime(item.offset)}] ${item.text}`)
      .join('\n');
    const blob = new Blob([fullText], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `lecture-transcript.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const renderHighlightedText = (text, query) => {
    if (!query.trim()) return text;
    const regex = new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
    const parts = text.split(regex);

    return parts.map((part, index) =>
      regex.test(part) ? (
        <mark key={index} className="bg-amber-100 text-amber-900 font-semibold px-0.5 rounded">
          {part}
        </mark>
      ) : (
        part
      )
    );
  };

  return (
    <div className="flex flex-col h-full bg-[#fafbfc]">
      {/* Search & Actions Bar */}
      <div className="p-3 border-b border-slate-200 bg-white space-y-2">
        <div className="relative flex items-center">
          <Search className="w-3.5 h-3.5 absolute left-3 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search transcript text or keywords..."
            className="w-full bg-slate-50 focus:bg-white border border-slate-200 focus:border-blue-500 rounded-lg pl-8 pr-8 py-1.5 text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500/20 transition-all"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-2.5 text-slate-400 hover:text-slate-700 cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        <div className="flex items-center justify-between text-[11px] text-slate-600 px-1 font-medium">
          <div className="flex items-center gap-1.5">
            <FileText className="w-3 h-3 text-slate-400" />
            <span>
              {searchQuery ? `${filteredTranscript.length} of ${transcript.length} segments` : `${transcript.length} transcript segments`}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleCopyAll}
              className="hover:text-slate-900 flex items-center gap-1 px-1.5 py-0.5 rounded hover:bg-slate-100 transition-colors cursor-pointer"
              title="Copy entire transcript with timestamps"
            >
              {copied ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
              <span>{copied ? 'Copied' : 'Copy all'}</span>
            </button>
            <button
              onClick={handleDownload}
              className="hover:text-slate-900 flex items-center gap-1 px-1.5 py-0.5 rounded hover:bg-slate-100 transition-colors cursor-pointer"
              title="Export as .txt"
            >
              <Download className="w-3 h-3" />
              <span>Export</span>
            </button>
          </div>
        </div>
      </div>

      {/* Transcript Items Scroll Area */}
      <div className="flex-1 overflow-y-auto p-3 space-y-0.5 divide-y divide-slate-100 custom-scrollbar">
        {filteredTranscript.length === 0 ? (
          <div className="text-center py-12 text-slate-500 text-xs">
            <Search className="w-8 h-8 mx-auto mb-2 opacity-30 text-slate-400" />
            <p className="text-slate-700 font-medium">No transcript segments matched "{searchQuery}"</p>
          </div>
        ) : (
          filteredTranscript.map((item, index) => {
            const seekSeconds = Math.floor(item.offset / 1000);
            return (
              <div 
                key={index} 
                onClick={() => onSeek(seekSeconds)}
                className="group flex gap-3 pt-2 pb-2 px-2 rounded-lg hover:bg-white hover:shadow-xs transition-all cursor-pointer text-left"
              >
                <div className="shrink-0 pt-0.5">
                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-slate-100 border border-slate-200 text-slate-700 group-hover:border-blue-200 group-hover:bg-blue-50 group-hover:text-blue-700 font-mono text-[11px] font-medium rounded transition-colors shadow-2xs">
                    <Play className="w-2.5 h-2.5 opacity-70 group-hover:opacity-100 fill-current" />
                    {formatTime(item.offset)}
                  </span>
                </div>
                <p className="text-[13px] text-slate-700 group-hover:text-slate-900 leading-relaxed transition-colors">
                  {renderHighlightedText(item.text, searchQuery)}
                </p>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

export default Transcript;
