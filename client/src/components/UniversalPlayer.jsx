import React, { useState, useEffect, useRef, useImperativeHandle } from 'react';

export default React.forwardRef(function UniversalPlayer({
  src,
  controls = true,
  onPlay,
  onPause,
  onSeeked,
  onEnded,
  className = "video-element",
  style = {},
  ...props
}, ref) {
  // Check if source is a YouTube embed URL or ID
  const isYouTube = typeof src === 'string' && (src.includes('youtube.com/embed') || src.includes('youtu.be') || src.includes('youtube.com/watch'));
  
  // Extract 11-character Video ID if it's YouTube
  let videoId = null;
  if (isYouTube) {
    const match = src.match(/(?:embed\/|v=|v\/|youtu\.be\/|\/)([^"&?\/\s]{11})/i);
    if (match && match[1]) {
      videoId = match[1];
    }
  }

  const htmlVideoRef = useRef(null);
  const iframeRef = useRef(null);
  const ytPlayerRef = useRef(null);
  const [playerId] = useState(() => `yt-player-${Math.random().toString(36).substring(2, 9)}`);
  
  // Local state tracking for YouTube player metrics
  const currentTimeRef = useRef(0);
  const durationRef = useRef(0);
  const volumeRef = useRef(1.0);
  const timerRef = useRef(null);

  // Initialize YouTube Player via official IFrame API when component mounts or src changes
  useEffect(() => {
    if (!isYouTube || !videoId) return;

    let playerInstance = null;
    let checkInterval = null;

    const initPlayer = () => {
      if (!window.YT || !window.YT.Player || !document.getElementById(playerId)) {
        return false;
      }
      try {
        playerInstance = new window.YT.Player(playerId, {
          events: {
            onReady: (event) => {
              ytPlayerRef.current = event.target;
              try {
                const dur = event.target.getDuration();
                if (dur && !isNaN(dur)) durationRef.current = dur;
              } catch (e) {}
            },
            onStateChange: (event) => {
              const state = event.data;
              // YT.PlayerState: PLAYING = 1, PAUSED = 2, ENDED = 0
              if (state === 1) { // Playing
                if (onPlay) onPlay();
                startTimeTracker();
              } else if (state === 2) { // Paused
                if (onPause) onPause();
                stopTimeTracker();
              } else if (state === 0) { // Ended
                stopTimeTracker();
                if (onEnded) onEnded();
              }
            }
          }
        });
      } catch (e) {
        console.error('Error initializing YT Player SDK:', e);
      }
      return true;
    };

    if (!initPlayer()) {
      checkInterval = setInterval(() => {
        if (initPlayer() && checkInterval) {
          clearInterval(checkInterval);
        }
      }, 300);
    }

    const startTimeTracker = () => {
      if (timerRef.current) clearInterval(timerRef.current);
      timerRef.current = setInterval(() => {
        if (ytPlayerRef.current && typeof ytPlayerRef.current.getCurrentTime === 'function') {
          try {
            const time = ytPlayerRef.current.getCurrentTime();
            const dur = ytPlayerRef.current.getDuration();
            if (time !== undefined) currentTimeRef.current = time;
            if (dur && !isNaN(dur)) durationRef.current = dur;
          } catch (e) {}
        }
      }, 200);
    };

    const stopTimeTracker = () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };

    return () => {
      if (checkInterval) clearInterval(checkInterval);
      if (timerRef.current) clearInterval(timerRef.current);
      if (ytPlayerRef.current && typeof ytPlayerRef.current.destroy === 'function') {
        try { ytPlayerRef.current.destroy(); } catch (e) {}
      }
      ytPlayerRef.current = null;
    };
  }, [isYouTube, videoId, playerId]);

  // Provide a unified ref interface to parent components (DubStudio, Showroom, DualWaveform)
  useImperativeHandle(ref, () => ({
    // Getter & Setter for currentTime
    get currentTime() {
      if (!isYouTube && htmlVideoRef.current) {
        return htmlVideoRef.current.currentTime;
      }
      if (ytPlayerRef.current && typeof ytPlayerRef.current.getCurrentTime === 'function') {
        try {
          const t = ytPlayerRef.current.getCurrentTime();
          if (t !== undefined) currentTimeRef.current = t;
        } catch (e) {}
      }
      return currentTimeRef.current || 0;
    },
    set currentTime(val) {
      if (!isYouTube && htmlVideoRef.current) {
        htmlVideoRef.current.currentTime = val;
        return;
      }
      currentTimeRef.current = val;
      if (ytPlayerRef.current && typeof ytPlayerRef.current.seekTo === 'function') {
        try {
          ytPlayerRef.current.seekTo(val, true);
          if (onSeeked) onSeeked();
        } catch (e) {}
      }
    },
    // Getter & Setter for duration
    get duration() {
      if (!isYouTube && htmlVideoRef.current) {
        return htmlVideoRef.current.duration;
      }
      if (ytPlayerRef.current && typeof ytPlayerRef.current.getDuration === 'function') {
        try {
          const d = ytPlayerRef.current.getDuration();
          if (d && !isNaN(d)) durationRef.current = d;
        } catch (e) {}
      }
      return durationRef.current || 1;
    },
    // Getter & Setter for volume (0.0 to 1.0)
    get volume() {
      if (!isYouTube && htmlVideoRef.current) {
        return htmlVideoRef.current.volume;
      }
      if (ytPlayerRef.current && typeof ytPlayerRef.current.getVolume === 'function') {
        try {
          return ytPlayerRef.current.getVolume() / 100;
        } catch (e) {}
      }
      return volumeRef.current;
    },
    set volume(val) {
      if (!isYouTube && htmlVideoRef.current) {
        htmlVideoRef.current.volume = val;
        return;
      }
      volumeRef.current = val;
      if (ytPlayerRef.current && typeof ytPlayerRef.current.setVolume === 'function') {
        try {
          // YT Player volume ranges from 0 to 100
          ytPlayerRef.current.setVolume(Math.round(val * 100));
          if (val === 0 && typeof ytPlayerRef.current.mute === 'function') {
            ytPlayerRef.current.mute();
          } else if (val > 0 && typeof ytPlayerRef.current.unMute === 'function') {
            ytPlayerRef.current.unMute();
          }
        } catch (e) {}
      }
    },
    // Play & Pause methods
    play() {
      if (!isYouTube && htmlVideoRef.current) {
        return htmlVideoRef.current.play();
      }
      if (ytPlayerRef.current && typeof ytPlayerRef.current.playVideo === 'function') {
        try { ytPlayerRef.current.playVideo(); } catch (e) {}
      }
      return Promise.resolve();
    },
    pause() {
      if (!isYouTube && htmlVideoRef.current) {
        return htmlVideoRef.current.pause();
      }
      if (ytPlayerRef.current && typeof ytPlayerRef.current.pauseVideo === 'function') {
        try { ytPlayerRef.current.pauseVideo(); } catch (e) {}
      }
    }
  }), [isYouTube]);

  if (isYouTube && videoId) {
    // Render official YouTube Embedded IFrame Player
    return (
      <div style={{ width: '100%', height: '100%', position: 'relative', background: '#000', ...style }}>
        <iframe
          id={playerId}
          ref={iframeRef}
          src={`https://www.youtube.com/embed/${videoId}?enablejsapi=1&origin=${window.location.origin}&playsinline=1&controls=${controls ? 1 : 0}&rel=0&modestbranding=1`}
          className={className}
          style={{ width: '100%', height: '100%', border: 'none', display: 'block' }}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
          title="YouTube video player"
        />
      </div>
    );
  }

  // Fallback to native HTML5 video player for locally uploaded MP4 clips
  return (
    <video
      ref={htmlVideoRef}
      src={src}
      controls={controls}
      onPlay={onPlay}
      onPause={onPause}
      onSeeked={onSeeked}
      onEnded={onEnded}
      className={className}
      style={{ width: '100%', height: '100%', objectFit: 'cover', ...style }}
      playsInline
      {...props}
    />
  );
});
