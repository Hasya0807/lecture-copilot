import React, { useState, useRef, useEffect } from 'react';
import axios from 'axios';
import { 
  Play, 
  Pause, 
  RotateCcw, 
  RotateCw, 
  Search, 
  MessageSquare, 
  FileText, 
  BookOpen, 
  Edit3, 
  History as HistoryIcon, 
  Sparkles, 
  Loader2, 
  Video, 
  Clipboard, 
  X, 
  ChevronRight,
  Clock,
  Plus,
  Globe
} from 'lucide-react';

import VideoPlayer from './components/VideoPlayer';
import ChatWindow from './components/ChatWindow';
import Transcript from './components/Transcript';
import SummaryView from './components/SummaryView';
import NotesView from './components/NotesView';
import HistoryDrawer from './components/HistoryDrawer';

function App() {
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [videoData, setVideoData] = useState(null);
  const [transcript, setTranscript] = useState([]);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState('chat'); // 'chat' | 'transcript' | 'summary' | 'notes'
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [showSwitchModal, setShowSwitchModal] = useState(false);
  const [chatExternalPrompt, setChatExternalPrompt] = useState('');
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const [isPlaying, setIsPlaying] = useState(false);
  
  // History stored in localStorage
  const [history, setHistory] = useState(() => {
    try {
      const saved = localStorage.getItem('lecture_copilot_history');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const playerRef = useRef(null);

  useEffect(() => {
    try {
      localStorage.setItem('lecture_copilot_history', JSON.stringify(history));
    } catch (e) {
      console.error("Failed to save history to localStorage", e);
    }
  }, [history]);

  const saveToHistory = (videoObj) => {
    if (!videoObj?.videoId) return;
    setHistory(prev => {
      const filtered = prev.filter(item => item.videoId !== videoObj.videoId);
      return [
        {
          videoId: videoObj.videoId,
          title: videoObj.title || `Video ${videoObj.videoId}`,
          thumbnailUrl: videoObj.thumbnailUrl || `https://img.youtube.com/vi/${videoObj.videoId}/hqdefault.jpg`,
          duration: videoObj.duration || 0,
          date: new Date().toISOString()
        },
        ...filtered
      ].slice(0, 20); // keep up to 20 recent
    });
  };

  const handleIngest = async (videoUrlToIngest) => {
    const targetUrl = (videoUrlToIngest || url).trim();
    if (!targetUrl) return;

    setLoading(true);
    setError('');
    
    try {
      const response = await axios.post('/api/video/ingest', { url: targetUrl });
      setVideoData(response.data.video);
      setTranscript(response.data.transcript || []);
      saveToHistory(response.data.video);
      setShowSwitchModal(false);
      setUrl('');
      setActiveTab('chat');
    } catch (err) {
      const msg = err.response?.data?.error || err.message || 'Failed to process video lecture';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const handlePasteClipboard = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        setUrl(text);
      }
    } catch (err) {
      console.error("Could not read clipboard", err);
    }
  };

  const handleSeek = (seconds) => {
    if (playerRef.current) {
      playerRef.current.seekTo(seconds, true);
      playerRef.current.playVideo();
      setIsPlaying(true);
    }
  };

  const handleTogglePlay = () => {
    if (!playerRef.current) return;
    try {
      const state = playerRef.current.getPlayerState();
      if (state === 1) { // 1 = playing
        playerRef.current.pauseVideo();
        setIsPlaying(false);
      } else {
        playerRef.current.playVideo();
        setIsPlaying(true);
      }
    } catch (e) {
      playerRef.current.playVideo();
      setIsPlaying(true);
    }
  };

  const handleSeekRelative = (deltaSeconds) => {
    if (!playerRef.current) return;
    try {
      const current = playerRef.current.getCurrentTime() || 0;
      const target = Math.max(0, current + deltaSeconds);
      playerRef.current.seekTo(target, true);
    } catch (e) {
      console.error(e);
    }
  };

  const handleChangeSpeed = (speed) => {
    setPlaybackSpeed(speed);
    if (playerRef.current?.setPlaybackRate) {
      playerRef.current.setPlaybackRate(speed);
    }
  };

  const handleSelectHistoryVideo = (item) => {
    const targetUrl = `https://www.youtube.com/watch?v=${item.videoId}`;
    setUrl(targetUrl);
    handleIngest(targetUrl);
  };

  const handleClearHistory = () => {
    setHistory([]);
    localStorage.removeItem('lecture_copilot_history');
  };

  const handleRemoveHistoryItem = (videoId) => {
    setHistory(prev => prev.filter(item => item.videoId !== videoId));
  };

  const formatDuration = (seconds) => {
    if (!seconds) return '';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}m ${secs}s`;
  };

  return (
    <div className="min-h-screen bg-[#f8fafc] text-slate-900 font-sans flex flex-col selection:bg-blue-500/20 selection:text-blue-900">
      
      {/* Top Navigation Bar */}
      <header className="px-4 sm:px-8 py-3.5 border-b border-slate-200/80 bg-white/80 backdrop-blur-md sticky top-0 z-40 flex items-center justify-between">
        {/* Brand */}
        <div className="flex items-center gap-3">
          <div 
            onClick={() => { setVideoData(null); }}
            className="flex items-center gap-2.5 cursor-pointer group"
          >
            <div className="w-8 h-8 rounded-xl bg-blue-50 border border-blue-200/80 flex items-center justify-center text-blue-600 group-hover:bg-blue-100 transition-all shadow-2xs">
              <Play className="w-4 h-4 fill-current ml-0.5" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="font-extrabold text-base sm:text-lg tracking-tight text-slate-900">
                  Lecture Copilot
                </span>
                <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 font-semibold border border-slate-200">
                  v2.0
                </span>
              </div>
            </div>
          </div>

          {videoData && (
            <div className="hidden md:flex items-center gap-2 ml-4 pl-4 border-l border-slate-200 max-w-md">
              <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0"></span>
              <span className="text-xs text-slate-700 truncate font-semibold">
                {videoData.title}
              </span>
            </div>
          )}
        </div>

        {/* Right Navigation Actions */}
        <div className="flex items-center gap-2">
          {videoData && (
            <button
              onClick={() => setShowSwitchModal(true)}
              className="px-3.5 py-1.5 bg-white hover:bg-slate-50 border border-slate-200 text-xs font-semibold text-slate-700 hover:text-slate-900 rounded-xl transition-all flex items-center gap-1.5 cursor-pointer shadow-2xs"
            >
              <Plus className="w-3.5 h-3.5 text-blue-600" />
              <span className="hidden sm:inline">Change Lecture</span>
            </button>
          )}

          <button
            onClick={() => setIsHistoryOpen(true)}
            className="px-3.5 py-1.5 bg-white hover:bg-slate-50 border border-slate-200 text-xs font-semibold text-slate-700 hover:text-slate-900 rounded-xl transition-all flex items-center gap-1.5 cursor-pointer shadow-2xs"
            title="View recent lecture history"
          >
            <HistoryIcon className="w-3.5 h-3.5 text-slate-500" />
            <span>History</span>
            {history.length > 0 && (
              <span className="w-4 h-4 rounded-full bg-blue-50 border border-blue-200 text-[10px] flex items-center justify-center font-mono font-bold text-blue-700">
                {history.length}
              </span>
            )}
          </button>
        </div>
      </header>

      {/* Main App Body */}
      <main className="flex-1 flex flex-col">
        {/* Error notification banner */}
        {error && (
          <div className="mx-4 mt-3 p-3.5 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800 flex items-center justify-between animate-fade-in shadow-2xs">
            <div className="flex items-center gap-2 font-medium">
              <span className="w-2 h-2 rounded-full bg-rose-500"></span>
              <span>{error}</span>
            </div>
            <button onClick={() => setError('')} className="p-1 hover:text-rose-950 cursor-pointer">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* STATE 1: Hero Landing Page (No Video Loaded) */}
        {!videoData && (
          <div className="flex-1 flex flex-col justify-between relative overflow-hidden bg-grid-pattern bg-radial-gradient">
            <div className="w-full max-w-5xl mx-auto px-4 sm:px-6 pt-12 sm:pt-20 pb-16 flex flex-col items-center text-center">
              
              {/* Top Badge */}
              <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-blue-50/90 border border-blue-200 text-xs text-blue-700 font-semibold mb-6 shadow-2xs">
                <Globe className="w-3.5 h-3.5 text-blue-600" />
                <span>AI-Powered Video Lecture Workspace</span>
              </div>

              {/* High-Contrast Main Headline */}
              <h1 className="text-3xl sm:text-5xl lg:text-[54px] font-extrabold tracking-tight text-slate-900 max-w-3xl leading-[1.15] mb-4">
                Master Any Video Lecture with <span className="text-blue-600 font-extrabold">AI-Powered Precision</span>
              </h1>
              <p className="text-sm sm:text-base text-slate-600 max-w-2xl font-normal mb-8 leading-relaxed">
                Ingest any YouTube lecture to ask timestamp-aware questions, search full transcripts, generate structured summaries, and take synchronized study notes.
              </p>

              {/* Main Floating Search Box Card */}
              <div className="w-full max-w-2xl bg-white border border-slate-200/90 rounded-2xl p-2 sm:p-2.5 shadow-[0_10px_35px_rgba(0,0,0,0.06)] mb-8">
                <form 
                  onSubmit={(e) => { e.preventDefault(); handleIngest(); }} 
                  className="flex flex-col sm:flex-row gap-2"
                >
                  <div className="relative flex-1 flex items-center">
                    <Video className="absolute left-3.5 w-4 h-4 text-slate-400" />
                    <input
                      type="url"
                      placeholder="Paste YouTube lecture URL (e.g., https://youtube.com/watch?v=...)"
                      value={url}
                      onChange={(e) => setUrl(e.target.value)}
                      disabled={loading}
                      className="w-full pl-10 pr-20 py-3 bg-transparent border-none rounded-xl text-xs sm:text-sm text-slate-900 placeholder:text-slate-400 font-normal focus:outline-none disabled:opacity-50"
                    />
                    
                    {/* Input action icons (Clear / Paste) */}
                    <div className="absolute right-2.5 flex items-center gap-1">
                      {url ? (
                        <button
                          type="button"
                          onClick={() => setUrl('')}
                          className="p-1 text-slate-400 hover:text-slate-700 rounded cursor-pointer"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={handlePasteClipboard}
                          className="px-2.5 py-1 text-[11px] text-slate-700 font-medium bg-slate-100 hover:bg-slate-200 border border-slate-200 rounded-md flex items-center gap-1 transition-colors cursor-pointer"
                          title="Paste from clipboard"
                        >
                          <Clipboard className="w-3 h-3 text-slate-500" />
                          <span>Paste</span>
                        </button>
                      )}
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={loading || !url.trim()}
                    className="px-6 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-200 disabled:text-slate-400 text-white rounded-xl font-semibold text-xs sm:text-sm transition-all flex items-center justify-center gap-2 cursor-pointer disabled:cursor-not-allowed shadow-md shadow-blue-500/20 shrink-0"
                  >
                    {loading ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin text-white" />
                        <span>Indexing Lecture...</span>
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-4 h-4 text-blue-100" />
                        <span>Analyze Lecture</span>
                      </>
                    )}
                  </button>
                </form>

                {loading && (
                  <div className="mt-2.5 pt-2.5 border-t border-slate-100 flex items-center justify-center gap-2 text-xs text-slate-600 font-medium animate-pulse">
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-600" />
                    <span>Extracting transcript, calculating vectors & preparing copilot...</span>
                  </div>
                )}
              </div>

              {/* 4 Feature Architecture Cards */}
              <div className="w-full max-w-4xl grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5 mt-4 text-left">
                {/* 1. Timestamped Q&A */}
                <div className="bg-white border border-slate-200/90 rounded-2xl p-4 sm:p-5 shadow-2xs hover:shadow-md hover:border-blue-200 transition-all">
                  <div className="w-9 h-9 rounded-xl bg-blue-50 border border-blue-100 text-blue-600 flex items-center justify-center mb-3">
                    <MessageSquare className="w-4 h-4" />
                  </div>
                  <h3 className="text-sm font-bold text-slate-900 mb-1">Timestamped Q&A</h3>
                  <p className="text-xs text-slate-600 leading-relaxed font-normal">
                    Ask any question and receive direct answers linked with exact video jump points.
                  </p>
                </div>

                {/* 2. Transcript Search */}
                <div className="bg-white border border-slate-200/90 rounded-2xl p-4 sm:p-5 shadow-2xs hover:shadow-md hover:border-emerald-200 transition-all">
                  <div className="w-9 h-9 rounded-xl bg-emerald-50 border border-emerald-100 text-emerald-600 flex items-center justify-center mb-3">
                    <Search className="w-4 h-4" />
                  </div>
                  <h3 className="text-sm font-bold text-slate-900 mb-1">Transcript Search</h3>
                  <p className="text-xs text-slate-600 leading-relaxed font-normal">
                    Real-time keyword search with instant term highlighting and timestamp navigation.
                  </p>
                </div>

                {/* 3. AI Summary */}
                <div className="bg-white border border-slate-200/90 rounded-2xl p-4 sm:p-5 shadow-2xs hover:shadow-md hover:border-purple-200 transition-all">
                  <div className="w-9 h-9 rounded-xl bg-purple-50 border border-purple-100 text-purple-600 flex items-center justify-center mb-3">
                    <BookOpen className="w-4 h-4" />
                  </div>
                  <h3 className="text-sm font-bold text-slate-900 mb-1">AI Summary</h3>
                  <p className="text-xs text-slate-600 leading-relaxed font-normal">
                    Structured breakdown of core chapters, key takeaways, and self-quizzes in Markdown.
                  </p>
                </div>

                {/* 4. Study Notes */}
                <div className="bg-white border border-slate-200/90 rounded-2xl p-4 sm:p-5 shadow-2xs hover:shadow-md hover:border-amber-200 transition-all">
                  <div className="w-9 h-9 rounded-xl bg-amber-50 border border-amber-100 text-amber-600 flex items-center justify-center mb-3">
                    <Edit3 className="w-4 h-4" />
                  </div>
                  <h3 className="text-sm font-bold text-slate-900 mb-1">Study Notes</h3>
                  <p className="text-xs text-slate-600 leading-relaxed font-normal">
                    Take synced notes with 1-click current video time stamping and local persistence.
                  </p>
                </div>
              </div>

              {/* Recent History Preview */}
              {history.length > 0 && (
                <div className="w-full max-w-4xl mt-12 text-left">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <HistoryIcon className="w-4 h-4 text-slate-500" />
                      <h3 className="text-xs font-bold text-slate-800">Recently Analyzed</h3>
                    </div>
                    <button
                      onClick={() => setIsHistoryOpen(true)}
                      className="text-xs font-semibold text-blue-600 hover:text-blue-700 flex items-center gap-1 cursor-pointer"
                    >
                      <span>View all ({history.length})</span>
                      <ChevronRight className="w-3 h-3" />
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    {history.slice(0, 3).map((item) => (
                      <div
                        key={item.videoId}
                        onClick={() => handleSelectHistoryVideo(item)}
                        className="bg-white hover:bg-slate-50 border border-slate-200 rounded-xl p-2.5 transition-all flex gap-3 cursor-pointer shadow-2xs group"
                      >
                        <div className="relative w-16 h-12 rounded-lg bg-slate-100 overflow-hidden shrink-0">
                          <img
                            src={item.thumbnailUrl || `https://img.youtube.com/vi/${item.videoId}/hqdefault.jpg`}
                            alt={item.title}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                          />
                          <div className="absolute inset-0 bg-black/20 group-hover:bg-transparent flex items-center justify-center">
                            <Play className="w-3.5 h-3.5 text-white fill-current opacity-90 group-hover:opacity-100" />
                          </div>
                        </div>
                        <div className="flex-1 min-w-0">
                          <h4 className="text-xs font-semibold text-slate-900 group-hover:text-blue-600 line-clamp-1 leading-snug transition-colors">
                            {item.title}
                          </h4>
                          <span className="text-[10px] text-slate-500 font-mono font-medium mt-1 block">
                            {formatDuration(item.duration) || 'Lecture'}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

            </div>

            {/* Clean Light Footer with Breadcrumb Navigation */}
            <footer className="w-full border-t border-slate-200/80 py-3.5 px-6 sm:px-8 bg-white text-xs text-slate-500 flex flex-col sm:flex-row items-center justify-between">
              <div className="flex items-center gap-2 font-medium">
                <button 
                  onClick={() => setVideoData(null)}
                  className="text-slate-600 hover:text-slate-900 font-semibold cursor-pointer"
                >
                  Home
                </button>
                <span>›</span>
                <button 
                  onClick={() => setIsHistoryOpen(true)}
                  className="text-slate-600 hover:text-slate-900 cursor-pointer"
                >
                  History
                </button>
              </div>
              <div className="flex items-center gap-4 mt-2 sm:mt-0 font-medium text-slate-500">
                <span>Lecture Copilot v2.0</span>
                <span>•</span>
                <span>Vector RAG + Timestamp Grounding</span>
              </div>
            </footer>
          </div>
        )}

        {/* STATE 2: Active Lecture Workspace (Video Loaded) */}
        {videoData && (
          <div className="flex-1 flex flex-col lg:flex-row p-3 sm:p-4 gap-3 sm:gap-4 overflow-hidden h-[calc(100vh-57px)]">
            
            {/* LEFT COLUMN: Video Player & Controls */}
            <div className="flex-1 flex flex-col min-h-0 bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
              
              {/* Video Player Container */}
              <div className="w-full bg-black shrink-0">
                <VideoPlayer videoId={videoData.videoId} playerRef={playerRef} />
              </div>

              {/* Video Quick Controls Toolbar */}
              <div className="px-4 py-2.5 border-b border-slate-200 bg-slate-50 flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleTogglePlay}
                    className="p-1.5 bg-white hover:bg-slate-100 text-slate-700 hover:text-slate-900 rounded-lg border border-slate-200 transition-colors cursor-pointer shadow-2xs"
                    title={isPlaying ? 'Pause' : 'Play'}
                  >
                    {isPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5 fill-current text-blue-600" />}
                  </button>
                  <button
                    onClick={() => handleSeekRelative(-10)}
                    className="p-1.5 bg-white hover:bg-slate-100 text-slate-700 hover:text-slate-900 rounded-lg border border-slate-200 transition-colors flex items-center gap-0.5 cursor-pointer shadow-2xs"
                    title="Rewind 10s"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span className="text-[10px] font-mono font-medium">10s</span>
                  </button>
                  <button
                    onClick={() => handleSeekRelative(10)}
                    className="p-1.5 bg-white hover:bg-slate-100 text-slate-700 hover:text-slate-900 rounded-lg border border-slate-200 transition-colors flex items-center gap-0.5 cursor-pointer shadow-2xs"
                    title="Forward 10s"
                  >
                    <RotateCw className="w-3.5 h-3.5" />
                    <span className="text-[10px] font-mono font-medium">10s</span>
                  </button>
                </div>

                {/* Speed Selector */}
                <div className="flex items-center gap-1">
                  <span className="text-[11px] text-slate-500 font-medium mr-1 hidden sm:inline">Speed:</span>
                  {[1, 1.25, 1.5, 2].map((spd) => (
                    <button
                      key={spd}
                      onClick={() => handleChangeSpeed(spd)}
                      className={`px-2 py-0.5 rounded-md text-[11px] font-mono font-semibold transition-colors cursor-pointer ${
                        playbackSpeed === spd
                          ? 'bg-blue-600 text-white shadow-2xs'
                          : 'bg-white text-slate-600 hover:text-slate-900 border border-slate-200 shadow-2xs'
                      }`}
                    >
                      {spd}x
                    </button>
                  ))}
                </div>
              </div>

              {/* Video Title & Quick Actions */}
              <div className="p-4 flex-1 overflow-y-auto space-y-3 bg-white custom-scrollbar">
                <div>
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-50 border border-emerald-200 text-emerald-700 uppercase tracking-wider">
                      Indexed & Ready
                    </span>
                    {videoData.duration && (
                      <span className="text-xs text-slate-600 font-mono font-medium flex items-center gap-1">
                        <Clock className="w-3 h-3 text-slate-400" />
                        {formatDuration(videoData.duration)}
                      </span>
                    )}
                    <span className="text-xs text-slate-500">• {transcript.length} transcript segments</span>
                  </div>
                  <h2 className="font-bold text-sm sm:text-base text-slate-900 leading-snug">
                    {videoData.title}
                  </h2>
                </div>

                {/* Quick Action Pills under video */}
                <div className="pt-2 border-t border-slate-100">
                  <span className="text-[11px] text-slate-500 block mb-2 font-semibold">Quick Workspace Triggers</span>
                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={() => {
                        setActiveTab('summary');
                      }}
                      className="px-3 py-1.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg text-xs font-semibold text-slate-700 hover:text-slate-900 transition-all flex items-center gap-1.5 cursor-pointer shadow-2xs"
                    >
                      <BookOpen className="w-3.5 h-3.5 text-purple-600" />
                      <span>Generate Summary</span>
                    </button>
                    <button
                      onClick={() => {
                        setActiveTab('notes');
                      }}
                      className="px-3 py-1.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg text-xs font-semibold text-slate-700 hover:text-slate-900 transition-all flex items-center gap-1.5 cursor-pointer shadow-2xs"
                    >
                      <Edit3 className="w-3.5 h-3.5 text-amber-600" />
                      <span>Take Study Notes</span>
                    </button>
                    <button
                      onClick={() => {
                        setActiveTab('transcript');
                      }}
                      className="px-3 py-1.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg text-xs font-semibold text-slate-700 hover:text-slate-900 transition-all flex items-center gap-1.5 cursor-pointer shadow-2xs"
                    >
                      <Search className="w-3.5 h-3.5 text-emerald-600" />
                      <span>Search Transcript</span>
                    </button>
                    <button
                      onClick={() => {
                        setActiveTab('chat');
                        setChatExternalPrompt("Generate a 3-question review quiz on this lecture");
                      }}
                      className="px-3 py-1.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg text-xs font-semibold text-slate-700 hover:text-slate-900 transition-all flex items-center gap-1.5 cursor-pointer shadow-2xs"
                    >
                      <Sparkles className="w-3.5 h-3.5 text-blue-600" />
                      <span>Quiz Me</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* RIGHT COLUMN: Multi-Tab Intelligence Hub */}
            <div className="w-full lg:w-[480px] xl:w-[520px] flex flex-col min-h-[420px] lg:min-h-0 bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
              
              {/* Tab Navigation Header */}
              <div className="flex border-b border-slate-200 p-1.5 gap-1 bg-slate-50 shrink-0">
                <button
                  onClick={() => setActiveTab('chat')}
                  className={`flex-1 py-2 px-2.5 rounded-lg flex items-center justify-center gap-1.5 text-xs font-semibold transition-all cursor-pointer ${
                    activeTab === 'chat'
                      ? 'bg-white text-slate-900 shadow-xs border border-slate-200'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
                  }`}
                >
                  <MessageSquare className="w-3.5 h-3.5 text-blue-600" />
                  <span>Copilot</span>
                </button>

                <button
                  onClick={() => setActiveTab('transcript')}
                  className={`flex-1 py-2 px-2.5 rounded-lg flex items-center justify-center gap-1.5 text-xs font-semibold transition-all cursor-pointer ${
                    activeTab === 'transcript'
                      ? 'bg-white text-slate-900 shadow-xs border border-slate-200'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
                  }`}
                >
                  <FileText className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Transcript</span>
                </button>

                <button
                  onClick={() => setActiveTab('summary')}
                  className={`flex-1 py-2 px-2.5 rounded-lg flex items-center justify-center gap-1.5 text-xs font-semibold transition-all cursor-pointer ${
                    activeTab === 'summary'
                      ? 'bg-white text-slate-900 shadow-xs border border-slate-200'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
                  }`}
                >
                  <BookOpen className="w-3.5 h-3.5 text-purple-600" />
                  <span>Summary</span>
                </button>

                <button
                  onClick={() => setActiveTab('notes')}
                  className={`flex-1 py-2 px-2.5 rounded-lg flex items-center justify-center gap-1.5 text-xs font-semibold transition-all cursor-pointer ${
                    activeTab === 'notes'
                      ? 'bg-white text-slate-900 shadow-xs border border-slate-200'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
                  }`}
                >
                  <Edit3 className="w-3.5 h-3.5 text-amber-600" />
                  <span>Notes</span>
                </button>
              </div>

              {/* Tab Views Content Area */}
              <div className="flex-1 overflow-hidden relative">
                <div className={`absolute inset-0 transition-opacity duration-200 ${activeTab === 'chat' ? 'opacity-100 z-10' : 'opacity-0 z-0 pointer-events-none'}`}>
                  <ChatWindow 
                    videoId={videoData.videoId} 
                    onSeek={handleSeek}
                    externalPrompt={chatExternalPrompt}
                    onClearExternalPrompt={() => setChatExternalPrompt('')}
                  />
                </div>

                <div className={`absolute inset-0 transition-opacity duration-200 ${activeTab === 'transcript' ? 'opacity-100 z-10' : 'opacity-0 z-0 pointer-events-none'}`}>
                  <Transcript 
                    transcript={transcript} 
                    onSeek={handleSeek} 
                  />
                </div>

                <div className={`absolute inset-0 transition-opacity duration-200 ${activeTab === 'summary' ? 'opacity-100 z-10' : 'opacity-0 z-0 pointer-events-none'}`}>
                  <SummaryView 
                    videoId={videoData.videoId} 
                    videoTitle={videoData.title}
                    onSeek={handleSeek} 
                  />
                </div>

                <div className={`absolute inset-0 transition-opacity duration-200 ${activeTab === 'notes' ? 'opacity-100 z-10' : 'opacity-0 z-0 pointer-events-none'}`}>
                  <NotesView 
                    videoId={videoData.videoId} 
                    videoTitle={videoData.title}
                    playerRef={playerRef}
                    onSeek={handleSeek} 
                  />
                </div>
              </div>
            </div>

          </div>
        )}
      </main>

      {/* History Slide-over Drawer */}
      <HistoryDrawer
        isOpen={isHistoryOpen}
        onClose={() => setIsHistoryOpen(false)}
        history={history}
        onSelectVideo={handleSelectHistoryVideo}
        onClearHistory={handleClearHistory}
        onRemoveHistoryItem={handleRemoveHistoryItem}
      />

      {/* Switch Lecture Modal */}
      {showSwitchModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div 
            className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs animate-fade-in"
            onClick={() => setShowSwitchModal(false)}
          />
          <div className="relative w-full max-w-lg bg-white border border-slate-200 rounded-2xl p-5 shadow-2xl z-10 animate-fade-in">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Video className="w-4 h-4 text-blue-600" />
                <h3 className="text-sm font-bold text-slate-900">Analyze Another Lecture</h3>
              </div>
              <button
                onClick={() => setShowSwitchModal(false)}
                className="p-1 text-slate-400 hover:text-slate-700 rounded cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={(e) => { e.preventDefault(); handleIngest(); }}>
              <div className="relative mb-3">
                <input
                  type="url"
                  placeholder="Paste new YouTube URL..."
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  className="w-full pl-3.5 pr-10 py-2.5 bg-slate-50 border border-slate-200 focus:bg-white rounded-xl text-xs sm:text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-blue-500 font-medium"
                  autoFocus
                />
              </div>

              <div className="flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowSwitchModal(false)}
                  className="px-3.5 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900 rounded-lg hover:bg-slate-100 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading || !url.trim()}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-200 disabled:text-slate-400 text-white rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer shadow-xs"
                >
                  {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                  <span>Analyze</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
