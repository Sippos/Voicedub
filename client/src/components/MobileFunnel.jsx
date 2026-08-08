import React, { useState, useRef, useEffect } from 'react';
import DualWaveform from './DualWaveform';
import UniversalPlayer from './UniversalPlayer';
import { Mic, Square, Play, Pause, Download, ChevronRight, Video, Scissors } from 'lucide-react';

export default function MobileFunnel() {
  const [step, setStep] = useState('input'); // input, crop, dub, result
  const [url, setUrl] = useState('');
  const [clip, setClip] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  
  // Crop state
  const [startTime, setStartTime] = useState(0);
  const [endTime, setEndTime] = useState(15);
  
  // Dub state
  const [isRecording, setIsRecording] = useState(false);
  const [liveStream, setLiveStream] = useState(null);
  const [recordedUrl, setRecordedUrl] = useState(null);
  const [recordedBlob, setRecordedBlob] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  
  const videoRef = useRef(null);
  const audioRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);

  const importYouTube = async () => {
    if (!url) return;
    setIsLoading(true);
    try {
      const res = await fetch('/api/clips/youtube', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url })
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setClip(data);
      setStep('crop');
    } catch (e) {
      alert(e.message || 'Failed to import video');
    } finally {
      setIsLoading(false);
    }
  };

  const confirmCrop = () => {
    // In client-side mode, we just pass the start/end times to the player during dubbing
    setStep('dub');
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      setLiveStream(stream);
      audioChunksRef.current = [];
      const mediaRecorder = new MediaRecorder(stream);

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        setRecordedBlob(audioBlob);
        setRecordedUrl(URL.createObjectURL(audioBlob));
        setLiveStream(null);
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorderRef.current = mediaRecorder;
      mediaRecorder.start();
      setIsRecording(true);
      setRecordedUrl(null);

      if (videoRef.current) {
        videoRef.current.currentTime = startTime; // Start at cropped time
        videoRef.current.volume = 0.15;
        videoRef.current.play();
        setIsPlaying(true);
      }
    } catch (err) {
      alert('Could not access microphone! Please allow permissions.');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      setLiveStream(null);
      if (videoRef.current) {
        videoRef.current.pause();
        setIsPlaying(false);
      }
    }
  };

  const playAudition = () => {
    if (!recordedUrl || !videoRef.current || !audioRef.current) return;
    videoRef.current.currentTime = startTime;
    videoRef.current.volume = 0.2;
    audioRef.current.src = recordedUrl;
    audioRef.current.currentTime = 0;

    videoRef.current.play();
    audioRef.current.play();
    setIsPlaying(true);
  };

  const pausePlayback = () => {
    if (videoRef.current) videoRef.current.pause();
    if (audioRef.current) audioRef.current.pause();
    setIsPlaying(false);
  };

  // Enforce the crop end time during playback
  useEffect(() => {
    let interval;
    if (isPlaying && step === 'dub') {
      interval = setInterval(() => {
        if (videoRef.current && videoRef.current.currentTime >= endTime) {
          if (isRecording) stopRecording();
          else pausePlayback();
        }
      }, 200);
    }
    return () => clearInterval(interval);
  }, [isPlaying, isRecording, endTime, step]);

  const submitDub = async () => {
    if (!recordedBlob) return;
    setIsLoading(true);
    const formData = new FormData();
    formData.append('audio', recordedBlob, 'dub.webm');
    formData.append('title', 'My Mobile Dub');
    formData.append('mix_volume', 0.2);

    try {
      const res = await fetch(`/api/clips/${clip.id}/dubs`, {
        method: 'POST',
        body: formData
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      
      const exportRes = await fetch(`/api/dubs/${data.id}/export`, { method: 'POST' });
      const exportData = await exportRes.json();
      
      setClip({ ...clip, finalExportUrl: exportData.download_url });
      setStep('result');
    } catch (err) {
      alert('Error saving dub');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="mobile-funnel">
      <div className="funnel-header">
        <h1>VoiceDub</h1>
        <div className="steps-indicator">
          <span className={step === 'input' ? 'active' : ''}>1</span>
          <span className={step === 'crop' ? 'active' : ''}>2</span>
          <span className={step === 'dub' ? 'active' : ''}>3</span>
        </div>
      </div>

      <div className="funnel-content">
        {step === 'input' && (
          <div className="funnel-step input-step glass-card">
            <Video size={48} color="var(--primary)" style={{marginBottom: 20}} />
            <h2>Paste YouTube URL</h2>
            <p style={{color: 'var(--text-muted)'}}>Plays directly in your browser. No server bans, zero lag.</p>
            <input 
              type="text" 
              className="input-field" 
              placeholder="https://youtube.com/watch?v=..."
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              style={{width: '100%', marginTop: '20px', marginBottom: '20px'}}
            />
            <button className="btn btn-primary" onClick={importYouTube} disabled={!url || isLoading} style={{width: '100%'}}>
              {isLoading ? 'Loading...' : 'Next'} <ChevronRight size={18} />
            </button>
          </div>
        )}

        {step === 'crop' && clip && (
          <div className="funnel-step crop-step glass-card">
            <Scissors size={48} color="var(--primary)" style={{marginBottom: 10}} />
            <h2>Crop Scene</h2>
            <p style={{fontSize: '0.9rem', marginBottom: '15px'}}>{clip.title}</p>
            
            <div className="mobile-video-container" style={{width: '100%', borderRadius: '12px', overflow: 'hidden', marginBottom: '20px'}}>
              <UniversalPlayer 
                src={clip.original_url}
                controls={true}
                style={{width: '100%', display: 'block', aspectRatio: '16/9'}}
              />
            </div>
            
            <div className="time-controls" style={{display: 'flex', gap: '15px', marginBottom: '20px'}}>
              <div className="input-group" style={{flex: 1}}>
                <label className="input-label">Start (sec)</label>
                <input type="number" className="input-field" value={startTime} onChange={e => setStartTime(Number(e.target.value))} min="0" />
              </div>
              <div className="input-group" style={{flex: 1}}>
                <label className="input-label">End (sec)</label>
                <input type="number" className="input-field" value={endTime} onChange={e => setEndTime(Number(e.target.value))} min={startTime} />
              </div>
            </div>

            <button className="btn btn-primary" onClick={confirmCrop} style={{width: '100%'}}>
              Lock & Dub <ChevronRight size={18} />
            </button>
          </div>
        )}

        {step === 'dub' && clip && (
          <div className="funnel-step dub-step">
            <div className="mobile-video-container" style={{width: '100%', borderRadius: '16px', overflow: 'hidden', backgroundColor: '#000', marginBottom: '20px', pointerEvents: 'none'}}>
              <UniversalPlayer 
                ref={videoRef}
                src={clip.original_url}
                controls={false}
                style={{width: '100%', display: 'block', aspectRatio: '16/9'}}
                onEnded={() => {
                  if(isRecording) stopRecording();
                  else pausePlayback();
                }}
              />
            </div>
            
            <div className="dub-waveforms glass-card" style={{padding: '15px', marginBottom: '20px'}}>
              <h3 style={{fontSize: '1rem', marginBottom: '10px', color: 'var(--text-muted)'}}>Soundwaves</h3>
              <DualWaveform 
                originalAudioUrl={clip.original_url}
                recordedAudioUrl={recordedUrl}
                liveStream={liveStream}
                isRecording={isRecording}
                videoRef={videoRef}
              />
            </div>

            <audio ref={audioRef} style={{ display: 'none' }} />

            <div className="dub-controls" style={{display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '20px'}}>
              {!isRecording ? (
                <button className="btn btn-danger-record" onClick={startRecording} style={{width: '80px', height: '80px', borderRadius: '50%'}}>
                  <Mic size={36} />
                </button>
              ) : (
                <button className="btn btn-danger-record recording" onClick={stopRecording} style={{width: '80px', height: '80px', borderRadius: '50%', backgroundColor: '#444'}}>
                  <Square size={36} color="#ff1f5a" />
                </button>
              )}
              
              {recordedUrl && !isRecording && (
                <div className="playback-actions" style={{display: 'flex', gap: '15px', width: '100%'}}>
                  <button className="btn btn-outline" onClick={isPlaying ? pausePlayback : playAudition} style={{flex: 1}}>
                    {isPlaying ? <Pause /> : <Play />} Audition
                  </button>
                  <button className="btn btn-primary" onClick={submitDub} disabled={isLoading} style={{flex: 1}}>
                    {isLoading ? 'Saving...' : 'Finish!'}
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {step === 'result' && clip?.finalExportUrl && (
          <div className="funnel-step result-step glass-card" style={{textAlign: 'center'}}>
            <h2>Dub Saved!</h2>
            <p style={{color: 'var(--text-muted)', marginBottom: 20}}>Since this is a YouTube clip, you can download your isolated studio voice track below.</p>
            <audio src={clip.finalExportUrl} controls style={{width: '100%', marginBottom: 20}} />
            <a href={clip.finalExportUrl} download className="btn btn-primary" style={{width: '100%', marginBottom: '15px', display: 'flex', justifyContent: 'center'}}>
              <Download size={18} /> Download Audio Track
            </a>
            <button className="btn btn-outline" onClick={() => {
              setStep('input');
              setUrl('');
              setClip(null);
            }} style={{width: '100%'}}>
              Dub Another Video
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
