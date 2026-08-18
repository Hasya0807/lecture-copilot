import React from 'react';
import YouTube from 'react-youtube';

const VideoPlayer = ({ videoId, playerRef, onReadyCallback }) => {
  const opts = {
    height: '100%',
    width: '100%',
    playerVars: {
      autoplay: 0,
      modestbranding: 1,
      rel: 0,
      origin: window.location.origin,
      playsinline: 1,
    },
  };

  const onReady = (event) => {
    if (playerRef) {
      playerRef.current = event.target;
    }
    if (onReadyCallback) {
      onReadyCallback(event.target);
    }
  };

  return (
    <div className="w-full h-full relative aspect-video bg-black rounded-xl overflow-hidden shadow-lg border border-white/[0.06]">
      <YouTube 
        videoId={videoId} 
        opts={opts} 
        onReady={onReady} 
        className="w-full h-full"
        iframeClassName="w-full h-full border-none absolute inset-0"
      />
    </div>
  );
};

export default VideoPlayer;
