import { useState, useRef } from 'react';

function App() {
  const [youtubeUrl, setYoutubeUrl] = useState('');
  const [videoUrl, setVideoUrl] = useState('');
  const [isLoadingVideo, setIsLoadingVideo] = useState(false);
  
  const [startTime, setStartTime] = useState(0);
  const [endTime, setEndTime] = useState(10); // Default 10 seconds chunk
  const videoRef = useRef(null);
  
  // Recording state
  const [isRecording, setIsRecording] = useState(false);
  const [audioBlob, setAudioBlob] = useState(null);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);

  // Processing state
  const [isProcessing, setIsProcessing] = useState(false);
  const [downloadUrl, setDownloadUrl] = useState('');

  // 1. Fetch Video link from backend
  const handleLoadVideo = async () => {
    if (!youtubeUrl) return;
    setIsLoadingVideo(true);
    try {
      const response = await fetch('http://localhost:3001/api/get-video', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ youtubeUrl })
      });
      const data = await response.json();
      if (data.url) {
        setVideoUrl(data.url);
      } else {
        alert('Failed to get video URL');
      }
    } catch (err) {
      console.error(err);
      alert('Error fetching video link.');
    } finally {
      setIsLoadingVideo(false);
    }
  };

  // 2. Start Recording
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          audioChunksRef.current.push(e.data);
        }
      };

      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        setAudioBlob(audioBlob);
        
        // Stop all tracks to release microphone
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
      
      // Start video playback silently for sync context
      if (videoRef.current) {
        videoRef.current.currentTime = startTime;
        videoRef.current.play();
      }

    } catch (err) {
      console.error('Microphone access denied:', err);
      alert('Microphone permission is required to record dubbing.');
    }
  };

  // 3. Stop Recording
  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      
      if (videoRef.current) {
        videoRef.current.pause();
      }
    }
  };

  // 4. Process and Dub
  const handleDubAndDownload = async () => {
    if (!audioBlob || !videoUrl) return;
    setIsProcessing(true);
    setDownloadUrl('');

    const formData = new FormData();
    formData.append('videoUrl', videoUrl);
    formData.append('startTime', startTime);
    formData.append('endTime', endTime);
    // Append the blob, ensuring a filename is given
    formData.append('audioBlob', audioBlob, 'user_dub.webm');

    try {
      const response = await fetch('http://localhost:3001/api/process-video', {
        method: 'POST',
        body: formData,
      });
      
      if (!response.ok) throw new Error('Failed to process video');
      
      // The server returns a file to download
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      setDownloadUrl(url);
      
    } catch (err) {
      console.error(err);
      alert('Failed to process dubbing.');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="min-h-screen p-4 flex flex-col items-center max-w-lg mx-auto">
      <header className="mb-8 mt-4 text-center">
        <h1 className="text-4xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-primary to-accent mb-2">
          Choicer Voicer
        </h1>
        <p className="text-sm text-gray-400">Dub your favorite clips seamlessly</p>
      </header>

      {/* URL Input Section */}
      <div className="w-full bg-slate-800 p-4 rounded-xl shadow-lg border border-slate-700 mb-6">
        <input 
          type="text" 
          placeholder="Paste YouTube Link..." 
          className="w-full p-3 rounded-lg bg-slate-900 border border-slate-600 focus:outline-none focus:border-primary text-white mb-4"
          value={youtubeUrl}
          onChange={(e) => setYoutubeUrl(e.target.value)}
        />
        <button 
          onClick={handleLoadVideo}
          disabled={isLoadingVideo || !youtubeUrl}
          className="w-full bg-primary hover:bg-secondary text-white font-bold py-3 px-4 rounded-lg transition-colors disabled:opacity-50"
        >
          {isLoadingVideo ? 'Loading...' : 'Load Video'}
        </button>
      </div>

      {/* Video Player & Cropping */}
      {videoUrl && (
        <div className="w-full bg-slate-800 p-4 rounded-xl shadow-lg border border-slate-700 mb-6 flex flex-col items-center">
          <video 
            ref={videoRef}
            src={videoUrl} 
            controls 
            muted // Muted so user can record without loopback
            className="w-full rounded-lg mb-4 bg-black object-contain aspect-video"
          />
          
          <div className="w-full grid grid-cols-2 gap-4 mb-4">
            <div>
              <label className="text-xs text-gray-400 block mb-1">Start Time (s)</label>
              <input 
                type="number" 
                value={startTime} 
                onChange={(e) => setStartTime(Number(e.target.value))}
                className="w-full p-2 rounded bg-slate-900 border border-slate-600 focus:outline-none text-white"
              />
            </div>
            <div>
              <label className="text-xs text-gray-400 block mb-1">End Time (s)</label>
              <input 
                type="number" 
                value={endTime} 
                onChange={(e) => setEndTime(Number(e.target.value))}
                className="w-full p-2 rounded bg-slate-900 border border-slate-600 focus:outline-none text-white"
              />
            </div>
          </div>

          {/* Recording Controls */}
          <div className="w-full flex justify-center mt-2 mb-4">
            {!isRecording ? (
              <button 
                onClick={startRecording}
                className="bg-accent hover:bg-red-600 text-white font-bold py-4 px-8 rounded-full shadow-lg shadow-red-500/30 transition-all flex items-center justify-center space-x-2"
              >
                <div className="w-3 h-3 bg-white rounded-full animate-pulse"></div>
                <span>Start Recording</span>
              </button>
            ) : (
              <button 
                onClick={stopRecording}
                className="bg-slate-700 hover:bg-slate-600 text-white font-bold py-4 px-8 rounded-full shadow-lg transition-all flex items-center justify-center space-x-2"
              >
                <div className="w-3 h-3 bg-red-500 rounded-sm"></div>
                <span>Stop Recording</span>
              </button>
            )}
          </div>

          {/* Audio preview (optional) */}
          {audioBlob && !isRecording && (
            <div className="w-full mb-4">
               <p className="text-xs text-green-400 mb-2 text-center">Audio captured successfully!</p>
               <audio src={URL.createObjectURL(audioBlob)} controls className="w-full h-10" />
            </div>
          )}

          {/* Process & Download */}
          <button 
            onClick={handleDubAndDownload}
            disabled={!audioBlob || isProcessing}
            className="w-full bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white font-bold py-3 px-4 rounded-lg shadow-lg transition-all disabled:opacity-50 mt-2"
          >
            {isProcessing ? 'Dubbing & Processing...' : 'Dub & Download'}
          </button>

          {downloadUrl && (
            <a 
              href={downloadUrl} 
              download="choicer_voicer_dub.mp4"
              className="mt-4 text-primary hover:text-white underline text-sm transition-colors"
            >
              Click here if download doesn't start automatically
            </a>
          )}
        </div>
      )}
    </div>
  );
}

export default App;
