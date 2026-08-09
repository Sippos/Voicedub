import React, { useRef, useEffect } from 'react';

const AudioVisualizer = ({ stream, isRecording, videoRef }) => {
  const canvasRef = useRef(null);
  const audioContextRef = useRef(null);
  
  const micAnalyserRef = useRef(null);
  const videoAnalyserRef = useRef(null);
  const animationRef = useRef(null);
  
  // Keep track if we already connected the video source, as it can only be done once per element
  const videoSourceConnected = useRef(false);

  useEffect(() => {
    if (!isRecording) {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
      return;
    }

    const canvas = canvasRef.current;
    const canvasCtx = canvas.getContext('2d');
    
    if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)();
    }
    
    if (audioContextRef.current.state === 'suspended') {
        audioContextRef.current.resume();
    }

    // 1. Setup Microphone Source
    let micSource = null;
    if (stream) {
        micSource = audioContextRef.current.createMediaStreamSource(stream);
        micAnalyserRef.current = audioContextRef.current.createAnalyser();
        micSource.connect(micAnalyserRef.current);
        micAnalyserRef.current.fftSize = 256;
    }

    // 2. Setup Video Source (only once per video element)
    if (videoRef && videoRef.current && !videoSourceConnected.current) {
        try {
            const videoSource = audioContextRef.current.createMediaElementSource(videoRef.current);
            videoAnalyserRef.current = audioContextRef.current.createAnalyser();
            
            videoSource.connect(videoAnalyserRef.current);
            // Re-connect video audio to speakers so it's not muted by the AudioContext extraction!
            // Wait, the video is muted in the UI during recording, so we don't connect it to destination.
            // videoAnalyserRef.current.connect(audioContextRef.current.destination);
            
            videoAnalyserRef.current.fftSize = 256;
            videoSourceConnected.current = true;
        } catch (err) {
            console.warn("Could not connect video audio for visualization (likely CORS issue):", err);
        }
    }

    const bufferLength = 128; // Half of fftSize
    const micDataArray = new Uint8Array(bufferLength);
    const videoDataArray = new Uint8Array(bufferLength);

    const draw = () => {
      if (!isRecording) return;
      animationRef.current = requestAnimationFrame(draw);

      if (micAnalyserRef.current) micAnalyserRef.current.getByteFrequencyData(micDataArray);
      if (videoAnalyserRef.current) videoAnalyserRef.current.getByteFrequencyData(videoDataArray);

      canvasCtx.fillStyle = '#0f172a'; // background
      canvasCtx.fillRect(0, 0, canvas.width, canvas.height);

      const barWidth = (canvas.width / bufferLength) * 2.5;
      let x = 0;

      for (let i = 0; i < bufferLength; i++) {
        // Draw Video Waveform (Background / Blueish)
        const videoBarHeight = videoDataArray[i] || 0;
        if (videoBarHeight > 0) {
            canvasCtx.fillStyle = `rgba(59, 130, 246, 0.4)`; // Blue with opacity
            canvasCtx.fillRect(x, canvas.height - videoBarHeight / 2, barWidth, videoBarHeight / 2);
        }

        // Draw Mic Waveform (Foreground / Redish)
        const micBarHeight = micDataArray[i] || 0;
        if (micBarHeight > 0) {
            canvasCtx.fillStyle = `rgba(239, 68, 68, 0.9)`; // Red solid
            canvasCtx.fillRect(x, canvas.height - micBarHeight / 2, barWidth, micBarHeight / 2);
        }

        x += barWidth + 1;
      }
    };

    draw();

    return () => {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
      if (micSource) micSource.disconnect();
      // We don't disconnect the video source, as reconnecting it next time throws an error in Web Audio API.
    };
  }, [stream, isRecording, videoRef]);

  return (
    <div className="w-full relative">
        <canvas 
            ref={canvasRef} 
            width="300" 
            height="100" 
            className="w-full h-24 rounded-lg bg-slate-900 border border-slate-700 shadow-inner"
        />
        <div className="absolute top-2 left-2 flex flex-col space-y-1">
            <span className="text-[10px] font-mono text-blue-400 bg-slate-900/80 px-1 rounded">● Original Video</span>
            <span className="text-[10px] font-mono text-red-400 bg-slate-900/80 px-1 rounded">● Your Voice</span>
        </div>
    </div>
  );
};

export default AudioVisualizer;
