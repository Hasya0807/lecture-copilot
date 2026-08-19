import React, { useState, useRef, useEffect } from 'react';
import { Send, Loader2, Bot, Sparkles, Trash2, Cpu, Zap } from 'lucide-react';
import Message from './Message';

const SUGGESTED_PROMPTS = [
  "Summarize the main takeaways",
  "Explain the core concept in simple terms",
  "What important formulas or definitions were introduced?",
  "Generate a 3-question quiz on this lecture"
];

const ChatWindow = ({ videoId, onSeek, externalPrompt, onClearExternalPrompt }) => {
  const [messages, setMessages] = useState([
    { 
      text: "👋 Welcome to your lecture copilot! Ask any question about this lecture — I'll cite exact timestamps with hybrid RAG retrieval so you can jump straight to the source.", 
      isUser: false 
    }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [activeStandaloneQuery, setActiveStandaloneQuery] = useState('');
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);
  const abortControllerRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, loading]);

  // Clean up ongoing stream on unmount or video switch
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [videoId]);

  // If parent triggers a prompt from quick actions
  useEffect(() => {
    if (externalPrompt) {
      handleSendMessage(externalPrompt);
      if (onClearExternalPrompt) onClearExternalPrompt();
    }
  }, [externalPrompt]);

  const handleSendMessage = async (queryText) => {
    const textToSend = (queryText || input).trim();
    if (!textToSend || loading) return;

    setInput('');
    setActiveStandaloneQuery('');

    // Prepare current history snapshot for multi-turn condensation
    const historyPayload = messages
      .filter(m => !m.text.startsWith("👋") && !m.text.startsWith("⚠️"))
      .slice(-6)
      .map(m => ({ text: m.text, isUser: m.isUser }));

    // Append User Message
    const userMsg = { text: textToSend, isUser: true };
    setMessages(prev => [...prev, userMsg]);
    setLoading(true);

    // Placeholder index for streaming response
    let assistantMessageIndex = null;

    try {
      // Abort any ongoing stream
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      const abortController = new AbortController();
      abortControllerRef.current = abortController;

      // Initiate Server-Sent Events stream request
      const response = await fetch('/api/chat/stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: abortController.signal,
        body: JSON.stringify({
          videoId,
          query: textToSend,
          history: historyPayload
        })
      });

      if (!response.ok) {
        const errJson = await response.json().catch(() => ({}));
        throw new Error(errJson.error || `HTTP error! status: ${response.status}`);
      }

      // Initialize empty assistant message in state
      setMessages(prev => {
        assistantMessageIndex = prev.length;
        return [...prev, { text: '', isUser: false, isStreaming: true }];
      });

      const reader = response.body.getReader();
      const decoder = new TextDecoder('utf-8');
      let buffer = '';
      let accumulatedText = '';
      let currentEvent = 'message';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop(); // Keep partial line in buffer

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed) continue;

          if (trimmed.startsWith('event:')) {
            currentEvent = trimmed.replace('event:', '').trim();
            continue;
          }

          if (trimmed.startsWith('data:')) {
            const dataStr = trimmed.replace('data:', '').trim();

            if (dataStr === '[DONE]') {
              currentEvent = 'message';
              break;
            }

            try {
              const data = JSON.parse(dataStr);

              if (currentEvent === 'metadata' && data.standaloneQuery) {
                if (data.standaloneQuery !== textToSend) {
                  setActiveStandaloneQuery(data.standaloneQuery);
                }
              } else if (currentEvent === 'token' && data.token) {
                accumulatedText += data.token;
                const currentText = accumulatedText;
                setMessages(prev => {
                  const updated = [...prev];
                  if (updated[assistantMessageIndex]) {
                    updated[assistantMessageIndex] = {
                      ...updated[assistantMessageIndex],
                      text: currentText
                    };
                  }
                  return updated;
                });
              } else if (currentEvent === 'error' && data.error) {
                throw new Error(data.error);
              }
            } catch (jsonErr) {
              if (currentEvent === 'error') throw jsonErr;
              // Ignore non-json or partial lines
            }
          }
        }
      }

      // Mark streaming complete
      setMessages(prev => {
        const updated = [...prev];
        if (updated[assistantMessageIndex]) {
          updated[assistantMessageIndex] = {
            ...updated[assistantMessageIndex],
            isStreaming: false
          };
        }
        return updated;
      });

    } catch (err) {
      if (err.name === 'AbortError') {
        // Request was aborted cleanly by the user
        return;
      }
      console.error("Chat streaming error:", err);
      const errorMessage = err.message || "Failed to generate answer";
      
      setMessages(prev => {
        const updated = [...prev];
        if (assistantMessageIndex !== null && updated[assistantMessageIndex]) {
          updated[assistantMessageIndex] = {
            text: `⚠️ **Error:** ${errorMessage}\n\nPlease check server logs and ensure your Gemini API key is valid.`,
            isUser: false,
            isStreaming: false
          };
          return updated;
        }
        return [...prev, { 
          text: `⚠️ **Error:** ${errorMessage}\n\nPlease check server logs and ensure your Gemini API key is valid.`, 
          isUser: false 
        }];
      });
    } finally {
      setLoading(false);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  };

  const handleClearChat = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    setActiveStandaloneQuery('');
    setMessages([
      { 
        text: "Chat cleared. What else would you like to explore from this video?", 
        isUser: false 
      }
    ]);
  };

  return (
    <div className="flex flex-col h-full bg-[#fafbfc]">
      {/* Header bar / Status */}
      <div className="px-4 py-2.5 border-b border-slate-200/80 bg-white flex items-center justify-between text-xs">
        <div className="flex items-center gap-2 text-slate-600">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
          <span className="font-semibold text-slate-800">Hybrid RAG Engine</span>
          <span className="text-slate-300">•</span>
          <span className="text-slate-500 font-mono text-[11px]">Dense + BM25</span>
        </div>
        {messages.length > 1 && (
          <button
            onClick={handleClearChat}
            className="text-slate-500 hover:text-slate-800 flex items-center gap-1 transition-colors px-2 py-1 rounded hover:bg-slate-100 cursor-pointer"
            title="Reset conversation"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Clear</span>
          </button>
        )}
      </div>

      {/* Standalone Query Indicator (Multi-turn Context Badge) */}
      {activeStandaloneQuery && (
        <div className="px-4 py-1.5 bg-blue-50/80 border-b border-blue-100 flex items-center gap-1.5 text-[11px] text-blue-700 animate-fade-in">
          <Zap className="w-3 h-3 text-blue-600 shrink-0" />
          <span className="font-medium">Context Resolved Query:</span>
          <span className="font-mono text-blue-900 truncate">"{activeStandaloneQuery}"</span>
        </div>
      )}

      {/* Messages Scroll Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-1 custom-scrollbar">
        {messages.map((msg, idx) => (
          <Message key={idx} text={msg.text} isUser={msg.isUser} onSeek={onSeek} />
        ))}

        {/* Loading Indicator when initiating connection */}
        {loading && messages.length > 0 && messages[messages.length - 1].isUser && (
          <div className="flex items-center gap-3 mb-4 animate-fade-in">
            <div className="w-7 h-7 rounded-lg shrink-0 flex items-center justify-center border bg-blue-50 border-blue-200 text-blue-600 shadow-xs">
              <Bot className="w-3.5 h-3.5 animate-pulse" />
            </div>
            <div className="bg-white border border-slate-200/80 rounded-2xl rounded-tl-sm px-4 py-2.5 flex items-center gap-2 text-xs text-slate-600 shadow-xs">
              <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-600" />
              <span>Searching vector store & streaming response...</span>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Suggested Quick Prompt Chips */}
      {messages.length <= 2 && !loading && (
        <div className="px-4 pb-2">
          <div className="flex items-center gap-1.5 text-[11px] font-medium text-slate-600 mb-1.5">
            <Sparkles className="w-3 h-3 text-blue-600" />
            <span>Suggested questions</span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {SUGGESTED_PROMPTS.map((prompt, index) => (
              <button
                key={index}
                onClick={() => handleSendMessage(prompt)}
                className="text-left text-xs bg-white hover:bg-slate-50 text-slate-700 hover:text-slate-900 px-2.5 py-1.5 rounded-lg border border-slate-200/90 hover:border-blue-300 shadow-xs transition-all cursor-pointer"
              >
                {prompt}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Input Form */}
      <div className="p-3 bg-white border-t border-slate-200">
        <form 
          onSubmit={(e) => { e.preventDefault(); handleSendMessage(); }} 
          className="relative flex items-center"
        >
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask anything (e.g. 'Can you explain the main equation?')..."
            disabled={loading}
            className="w-full bg-slate-50 focus:bg-white border border-slate-200 focus:border-blue-500 rounded-xl pl-4 pr-11 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500/20 transition-all disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={!input.trim() || loading}
            className="absolute right-1.5 p-2 bg-blue-600 hover:bg-blue-700 disabled:bg-transparent disabled:text-slate-300 text-white rounded-lg transition-all flex items-center justify-center cursor-pointer disabled:cursor-not-allowed shadow-xs"
            title="Send query"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin text-slate-400" /> : <Send className="w-3.5 h-3.5" />}
          </button>
        </form>
        <div className="flex items-center justify-between mt-1.5 px-1 text-[11px] text-slate-500">
          <span>Real-time SSE Token Streaming</span>
          <span className="flex items-center gap-1">
            <Cpu className="w-3 h-3 text-blue-600" />
            <span>Grounded Timestamps</span>
          </span>
        </div>
      </div>
    </div>
  );
};

export default ChatWindow;
