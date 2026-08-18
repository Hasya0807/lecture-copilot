import React, { useState } from 'react';
import axios from 'axios';
import ReactMarkdown from 'react-markdown';
import { Sparkles, Loader2, Play, Copy, Check, Download, RefreshCw, BookOpen } from 'lucide-react';

const SummaryView = ({ videoId, videoTitle, onSeek }) => {
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);

  const generateSummary = async () => {
    setLoading(true);
    setError('');

    const prompt = `Please provide a comprehensive, beautifully structured study summary of this lecture.
Include:
1. **Executive Overview**: 2-3 sentences summarizing the main topic and purpose.
2. **Key Chapters & Timestamps**: A bulleted list of 4-8 main sections or subtopics with their approximate timestamp links in format [MM:SS](timestamp:seconds).
3. **Core Concepts & Takeaways**: Key theories, definitions, or code insights explained clearly.
4. **Key Formulae / Terminology**: If applicable, important terms defined.
5. **Quick Self-Check Quiz**: 3 short conceptual questions to test understanding.`;

    try {
      const response = await axios.post('/api/chat', {
        videoId,
        query: prompt
      });

      setSummary(response.data.answer);
    } catch (err) {
      const errMsg = err.response?.data?.error || err.message || "Failed to generate summary";
      setError(errMsg);
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = () => {
    if (!summary) return;
    navigator.clipboard.writeText(summary);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    if (!summary) return;
    const blob = new Blob([summary], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${(videoTitle || 'lecture').replace(/[^a-z0-9]/gi, '_')}-summary.md`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex flex-col h-full bg-[#fafbfc]">
      {/* Header Bar */}
      <div className="p-3 border-b border-slate-200 bg-white flex items-center justify-between">
        <div className="flex items-center gap-2">
          <BookOpen className="w-3.5 h-3.5 text-blue-600" />
          <span className="text-xs font-semibold text-slate-800">Lecture Summary & Insights</span>
        </div>
        {summary && (
          <div className="flex items-center gap-1.5">
            <button
              onClick={handleCopy}
              className="text-xs text-slate-600 hover:text-slate-900 flex items-center gap-1 px-2 py-1 rounded hover:bg-slate-100 transition-colors cursor-pointer"
              title="Copy Summary"
            >
              {copied ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
              <span>{copied ? 'Copied' : 'Copy'}</span>
            </button>
            <button
              onClick={handleDownload}
              className="text-xs text-slate-600 hover:text-slate-900 flex items-center gap-1 px-2 py-1 rounded hover:bg-slate-100 transition-colors cursor-pointer"
              title="Export as Markdown"
            >
              <Download className="w-3 h-3" />
              <span>Export</span>
            </button>
            <button
              onClick={generateSummary}
              disabled={loading}
              className="text-xs text-slate-600 hover:text-slate-900 p-1 rounded hover:bg-slate-100 transition-colors cursor-pointer"
              title="Regenerate"
            >
              <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        )}
      </div>

      {/* Content Area */}
      <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
        {!summary && !loading && (
          <div className="flex flex-col items-center justify-center h-full text-center py-12 px-4 max-w-sm mx-auto">
            <div className="w-12 h-12 rounded-2xl bg-blue-50 border border-blue-200 flex items-center justify-center text-blue-600 mb-4 shadow-xs">
              <Sparkles className="w-6 h-6" />
            </div>
            <h3 className="text-sm font-bold text-slate-900 mb-1">Generate Instant Summary</h3>
            <p className="text-xs text-slate-600 mb-5 leading-relaxed">
              Synthesize key chapters, critical insights, timestamp markers, and review questions automatically.
            </p>
            <button
              onClick={generateSummary}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold transition-all shadow-sm flex items-center gap-2 cursor-pointer"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Generate Summary</span>
            </button>
          </div>
        )}

        {loading && (
          <div className="flex flex-col items-center justify-center h-full py-12 text-center">
            <Loader2 className="w-8 h-8 animate-spin text-blue-600 mb-3" />
            <p className="text-xs text-slate-800 font-semibold">Extracting key concepts & timestamps...</p>
            <p className="text-[11px] text-slate-500 mt-1">Analyzing transcript segments</p>
          </div>
        )}

        {error && !loading && (
          <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 text-xs mb-4">
            <p className="font-semibold mb-1">Generation failed</p>
            <p className="text-rose-700">{error}</p>
            <button 
              onClick={generateSummary}
              className="mt-2 text-xs font-medium text-rose-800 underline hover:text-rose-900 cursor-pointer"
            >
              Try again
            </button>
          </div>
        )}

        {summary && (
          <div className="prose prose-sm max-w-none text-slate-800 text-[13px] leading-relaxed">
            <ReactMarkdown
              components={{
                a: ({ node, href, children, ...props }) => {
                  if (href?.startsWith('timestamp:')) {
                    const seconds = parseInt(href.replace('timestamp:', ''), 10);
                    return (
                      <button
                        type="button"
                        onClick={() => onSeek(seconds)}
                        className="inline-flex items-center gap-1 mx-1 px-2 py-0.5 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-md transition-colors text-xs font-mono font-semibold border border-blue-200 align-middle cursor-pointer"
                        title={`Jump to ${children}`}
                      >
                        <Play className="w-2.5 h-2.5 fill-current" />
                        <span>{children}</span>
                      </button>
                    );
                  }
                  return (
                    <a href={href} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline font-medium" {...props}>
                      {children}
                    </a>
                  );
                },
                h1: ({ children }) => <h1 className="text-base font-bold text-slate-900 mt-4 mb-2 pb-1 border-b border-slate-200">{children}</h1>,
                h2: ({ children }) => <h2 className="text-sm font-bold text-slate-900 mt-4 mb-2">{children}</h2>,
                h3: ({ children }) => <h3 className="text-xs font-semibold text-slate-800 uppercase tracking-wider mt-3 mb-1">{children}</h3>,
                ul: ({ children }) => <ul className="my-2 pl-4 list-disc space-y-1 text-slate-700">{children}</ul>,
                ol: ({ children }) => <ol className="my-2 pl-4 list-decimal space-y-1 text-slate-700">{children}</ol>,
                p: ({ children }) => <p className="mb-2.5 leading-relaxed text-slate-700">{children}</p>,
                strong: ({ children }) => <strong className="font-bold text-slate-900">{children}</strong>,
              }}
            >
              {summary}
            </ReactMarkdown>
          </div>
        )}
      </div>
    </div>
  );
};

export default SummaryView;
