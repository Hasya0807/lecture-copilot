import React, { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { Play, Copy, Check, Bot, User } from 'lucide-react';

const Message = ({ text, isUser, onSeek }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className={`flex gap-3 mb-4 group ${isUser ? 'flex-row-reverse' : 'flex-row'}`}>
      {/* Avatar Icon */}
      <div 
        className={`w-7 h-7 rounded-lg shrink-0 flex items-center justify-center text-xs font-medium border shadow-xs ${
          isUser 
            ? 'bg-blue-600 border-blue-600 text-white' 
            : 'bg-blue-50 border-blue-200/80 text-blue-600'
        }`}
      >
        {isUser ? <User className="w-3.5 h-3.5" /> : <Bot className="w-3.5 h-3.5" />}
      </div>

      {/* Message Body */}
      <div className={`max-w-[85%] sm:max-w-[80%] flex flex-col ${isUser ? 'items-end' : 'items-start'}`}>
        <div 
          className={`relative rounded-2xl px-4 py-3 text-sm leading-relaxed border ${
            isUser 
              ? 'bg-blue-600 text-white border-blue-600 rounded-tr-sm shadow-sm' 
              : 'bg-white text-slate-800 border-slate-200/90 rounded-tl-sm shadow-xs'
          }`}
        >
          <div className={`prose prose-sm max-w-none prose-p:leading-relaxed ${
            isUser 
              ? 'text-white prose-p:text-white prose-headings:text-white' 
              : 'text-slate-800 prose-headings:text-slate-900 prose-headings:font-bold prose-code:text-blue-700 prose-code:bg-blue-50 prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded prose-code:text-xs prose-pre:bg-slate-900 prose-pre:text-slate-100'
          }`}>
            <ReactMarkdown
              components={{
                a: ({ node, href, children, ...props }) => {
                  if (href?.startsWith('timestamp:')) {
                    const seconds = parseInt(href.replace('timestamp:', ''), 10);
                    return (
                      <button
                        type="button"
                        onClick={() => onSeek(seconds)}
                        className={`inline-flex items-center gap-1 mx-1 px-2 py-0.5 rounded-md transition-colors text-xs font-mono font-semibold border align-middle cursor-pointer ${
                          isUser
                            ? 'bg-white/20 hover:bg-white/30 text-white border-white/30'
                            : 'bg-blue-50 hover:bg-blue-100 text-blue-700 border-blue-200 hover:border-blue-300'
                        }`}
                        title={`Jump to ${children}`}
                      >
                        <Play className="w-2.5 h-2.5 fill-current" />
                        <span>{children}</span>
                      </button>
                    );
                  }
                  return (
                    <a 
                      href={href} 
                      target="_blank" 
                      rel="noopener noreferrer" 
                      className={`hover:underline inline-flex items-center gap-0.5 font-medium ${
                        isUser ? 'text-white underline' : 'text-blue-600'
                      }`} 
                      {...props}
                    >
                      {children}
                    </a>
                  );
                },
                p: ({ children }) => <p className="mb-2 last:mb-0 text-[13.5px] leading-relaxed">{children}</p>,
                ul: ({ children }) => <ul className={`my-2 pl-4 list-disc space-y-1 text-[13.5px] ${isUser ? 'text-white/90' : 'text-slate-700'}`}>{children}</ul>,
                ol: ({ children }) => <ol className={`my-2 pl-4 list-decimal space-y-1 text-[13.5px] ${isUser ? 'text-white/90' : 'text-slate-700'}`}>{children}</ol>,
                li: ({ children }) => <li className="leading-relaxed">{children}</li>,
                h1: ({ children }) => <h1 className="text-base font-bold mt-2 mb-1">{children}</h1>,
                h2: ({ children }) => <h2 className="text-sm font-semibold mt-2 mb-1">{children}</h2>,
                h3: ({ children }) => <h3 className="text-xs font-semibold uppercase tracking-wider mt-2 mb-1">{children}</h3>,
                blockquote: ({ children }) => (
                  <blockquote className={`border-l-2 pl-3 italic my-2 ${isUser ? 'border-white/40 text-white/80' : 'border-slate-300 text-slate-600'}`}>
                    {children}
                  </blockquote>
                ),
              }}
            >
              {text}
            </ReactMarkdown>
          </div>
        </div>

        {/* Action Toolbar (Copy) */}
        {!isUser && (
          <div className="flex items-center gap-1 mt-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <button
              onClick={handleCopy}
              className="px-2 py-0.5 text-xs text-slate-500 hover:text-slate-800 rounded flex items-center gap-1 hover:bg-slate-100 transition-colors"
              title="Copy message"
            >
              {copied ? (
                <>
                  <Check className="w-3 h-3 text-emerald-600" />
                  <span className="text-emerald-600 font-medium text-[11px]">Copied</span>
                </>
              ) : (
                <>
                  <Copy className="w-3 h-3" />
                  <span className="text-[11px]">Copy</span>
                </>
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default Message;
