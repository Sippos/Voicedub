import React, { useState, useRef, useEffect } from 'react';
import { Mic, Square, Play, Pause, RotateCcw, Volume2, Save, Sparkles, Edit3, Check, Film, Music } from 'lucide-react';
import DualWaveform from './DualWaveform';

export default function DubStudio({ clip, allClips, onSelectClip, onDubSubmitted }) {
  const [recording, setRecording] = useState(false);
  const [liveStream, setLiveStream] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [takes, setTakes] = useState([]);
  const [selectedTake, setSelectedTake] = useState(null);
  const [mixVolume, setMixVolume] = useState(0.2); // 20% original volume during playback
  const [author, setAuthor] = useState('');
  const [dubTitle, setDubTitle] = useState('');
  const [submitting, setSubmitting] = useState(false);
  
  // Script teleprompter edit state
  const [editingScript, setEditingScript] = useState(false);
  const [scriptText, setScriptText] = useState('');
  
  const videoRef = useRef(null);
  const audioRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);

  useEffect(() => {
    if (clip) {
      setScriptText(clip.script_cues || '00:01 - Character A: [Your line here]\n00:03 - Character B: [Reply here]');
      setTakes([]);
      setSelectedTake(null);
    }
  }, [clip]);

  if (!clip) {
    return (
      <div className="glass-card" style={{ textAlign: 'center', padding: '60px 20px', maxWidth: '700px', margin: '40px auto' }}>
        <Mic size={54} color="var(--primary)" style={{ margin: '0 auto 20px' }} />
        <h2>Welcome to the Recording Booth!</h2>
        <p style={{ color: 'var(--text-muted)', margin: '12px 0 28px' }}>
          Select a scene from your vault below to start recording high-octane custom voiceovers and impressions!
        </p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', justifyContent: 'center' }}>
          {allClips && allClips.map(c => (
            <button
              key={c.id}
              className="btn btn-outline"
              style={{ padding: '10px 18px' }}
              onClick={() => onSelectClip(c)}
            >
              <Film size={16} /> {c.title}
            </button>
          ))}
        </div>
      </div>
    );
  }

  // Start recording voiceover from mic while playing video
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      setLiveStream(stream);
      audioChunksRef.current = [];
      const mediaRecorder = new MediaRecorder(stream);

      mediaRecorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          audioChunksRef.current.push(e.data);
        }
      };

      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        const audioUrl = URL.createObjectURL(audioBlob);
        const takeNumber = takes.length + 1;
        const newTake = {
          id: Date.now(),
          number: takeNumber,
          blob: audioBlob,
          url: audioUrl,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
        };

        const updatedTakes = [newTake, ...takes];
        setTakes(updatedTakes);
        setSelectedTake(newTake);
        setLiveStream(null);
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorderRef.current = mediaRecorder;
      mediaRecorder.start();
      setRecording(true);

      // Reset video to start and play! Mute video slightly to avoid mic feedback loop
      if (videoRef.current) {
        videoRef.current.currentTime = 0;
        videoRef.current.volume = 0.15; // low volume during recording
        videoRef.current.play();
        setIsPlaying(true);
      }
    } catch (err) {
      console.error('Microphone access denied:', err);
      alert('Could not access microphone! Please allow audio permissions in your browser to record voiceovers.');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop();
      setRecording(false);
      setLiveStream(null);
      if (videoRef.current) {
        videoRef.current.pause();
        setIsPlaying(false);
      }
    }
  };

  // Audition selected take synchronized with video
  const playAudition = (take) => {
    const activeTake = take || selectedTake;
    if (!activeTake || !videoRef.current || !audioRef.current) return;

    setSelectedTake(activeTake);
    videoRef.current.currentTime = 0;
    videoRef.current.volume = mixVolume;
    audioRef.current.src = activeTake.url;
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

  const handleSaveScript = async () => {
    try {
      await fetch(`/api/clips/${clip.id}/script`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ script_cues: scriptText })
      });
      setEditingScript(false);
    } catch (err) {
      console.error('Failed to update script:', err);
    }
  };

  const handleSubmitDub = async (e) => {
    e.preventDefault();
    if (!selectedTake) {
      alert('Please select a recorded take to submit!');
      return;
    }

    setSubmitting(true);
    const formData = new FormData();
    formData.append('audio', selectedTake.blob, `dub_${Date.now()}.webm`);
    formData.append('title', dubTitle || `Take #${selectedTake.number} Impression`);
    formData.append('author', author || 'Anonymous Talent');
    formData.append('mix_volume', mixVolume.toString());

    try {
      const res = await fetch(`/api/clips/${clip.id}/dubs`, {
        method: 'POST',
        body: formData,
      });
      const data = await res.json();
      onDubSubmitted(clip, data);
    } catch (err) {
      console.error('Submission failed:', err);
      alert('Failed to save dub to showroom.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="studio-container">
      {/* Studio Header & Clip Changer */}
      <div className="flex-responsive" style={{ marginBottom: '24px' }}>
        <div>
          <span className="badge badge-cyan" style={{ marginBottom: '6px', display: 'inline-block' }}>🎙️ Recording Studio</span>
          <h2>{clip.title}</h2>
        </div>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          <label style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Switch Clip:</label>
          <select 
            className="select-field" 
            style={{ padding: '8px 16px', fontSize: '0.9rem' }}
            value={clip.id}
            onChange={(e) => {
              const selected = allClips.find(c => c.id === e.target.value);
              if (selected) onSelectClip(selected);
            }}
          >
            {allClips && allClips.map(c => (
              <option key={c.id} value={c.id} style={{ background: '#140f26', color: '#fff' }}>
                {c.title} ({c.category})
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="studio-layout">
        {/* Left Column: Media Booth & Audition Controls */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          <div className="video-container" style={{ border: recording ? '2px solid #ff1f5a' : '1px solid var(--border-light)' }}>
            <video 
              ref={videoRef}
              src={clip.original_url} 
              className="video-element" 
              onEnded={() => {
                setIsPlaying(false);
                if (recording) stopRecording();
              }}
            />
            <audio ref={audioRef} />

            {/* Recording Banner Overlay */}
            {recording && (
              <div style={{ position: 'absolute', top: '16px', left: '16px', right: '16px', background: 'rgba(255, 31, 90, 0.9)', padding: '10px 20px', borderRadius: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', boxShadow: '0 0 25px rgba(255, 31, 90, 0.8)', zIndex: 10 }}>
                <span style={{ fontWeight: 800, fontSize: '1.05rem', display: 'flex', alignItems: 'center', gap: '8px', letterSpacing: '0.05em' }}>
                  🔴 RECORDING LIVE IN PROGRESS... PERFORM YOUR LINES!
                </span>
                <button 
                  onClick={stopRecording}
                  style={{ background: '#000', color: '#fff', border: '1px solid #fff', padding: '6px 14px', borderRadius: '8px', fontWeight: 700, cursor: 'pointer' }}
                >
                  ⏹️ Stop & Save Take
                </button>
              </div>
            )}
          </div>

          {/* Choicer Voicer Synchronized Soundwave Studio */}
          <DualWaveform 
            originalAudioUrl={clip.original_url}
            recordedAudioUrl={selectedTake ? selectedTake.url : null}
            liveStream={liveStream}
            isRecording={recording}
            videoRef={videoRef}
            onSeek={(time) => {
              if (audioRef.current) audioRef.current.currentTime = time;
            }}
          />

          {/* Recording & Audition Deck */}
          <div className="glass-card">
            <h3 style={{ fontSize: '1.2rem', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Music size={20} color="var(--primary)" /> Booth Master Controls
            </h3>

            <div className="action-row-responsive" style={{ marginBottom: '24px' }}>
              {!recording ? (
                <button className="btn btn-danger-record" onClick={startRecording}>
                  <Mic size={18} /> Record New Dub Take
                </button>
              ) : (
                <button className="btn" style={{ background: '#3b3154', color: '#fff', border: '1px solid #ff1f5a' }} onClick={stopRecording}>
                  <Square size={18} fill="#ff1f5a" color="#ff1f5a" /> Stop Recording
                </button>
              )}

              {selectedTake && (
                <button 
                  className="btn btn-primary" 
                  onClick={() => isPlaying ? pausePlayback() : playAudition(selectedTake)}
                >
                  {isPlaying ? <><Pause size={18} /> Pause Audition</> : <><Play size={18} /> Audition Synced Take #{selectedTake.number}</>}
                </button>
              )}

              <button 
                className="btn btn-outline" 
                onClick={() => {
                  if (videoRef.current) {
                    videoRef.current.currentTime = 0;
                    videoRef.current.volume = 1.0;
                    videoRef.current.play();
                    setIsPlaying(true);
                  }
                }}
              >
                <RotateCcw size={18} /> Replay Original Sound
              </button>
            </div>

            {/* Audio Mixer Slider */}
            <div style={{ background: 'rgba(0,0,0,0.4)', padding: '16px', borderRadius: '12px', border: '1px solid var(--border-light)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '0.9rem', fontWeight: 600 }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-muted)' }}>
                  <Volume2 size={16} /> Original Background Audio Mix Ratio
                </span>
                <span style={{ color: 'var(--primary)' }}>{Math.round(mixVolume * 100)}% Background / 100% Voice Dub</span>
              </div>
              <div className="slider-container">
                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Mute (0%)</span>
                <input 
                  type="range" 
                  min="0" 
                  max="1" 
                  step="0.05" 
                  value={mixVolume} 
                  onChange={(e) => {
                    const val = parseFloat(e.target.value);
                    setMixVolume(val);
                    if (videoRef.current) videoRef.current.volume = val;
                  }}
                  className="audio-slider"
                />
                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Full (100%)</span>
              </div>
            </div>
          </div>

          {/* Recorded Takes Audition Rack */}
          {takes.length > 0 && (
            <div className="glass-card">
              <h3 style={{ fontSize: '1.2rem', marginBottom: '16px' }}>🎧 Recorded Takes (This Session)</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxHeight: '220px', overflowY: 'auto' }}>
                {takes.map((take) => (
                  <div 
                    key={take.id} 
                    style={{ 
                      display: 'flex', 
                      justifyContent: 'space-between', 
                      alignItems: 'center', 
                      padding: '12px 16px', 
                      background: selectedTake && selectedTake.id === take.id ? 'rgba(0, 240, 255, 0.12)' : 'rgba(255, 255, 255, 0.03)',
                      border: selectedTake && selectedTake.id === take.id ? '1px solid var(--primary)' : '1px solid var(--border-light)',
                      borderRadius: '12px',
                      cursor: 'pointer',
                      transition: 'all 0.2s ease'
                    }}
                    onClick={() => playAudition(take)}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <span className="badge badge-cyan">Take #{take.number}</span>
                      <span style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>Recorded at {take.timestamp}</span>
                    </div>
                    <button className="btn btn-outline" style={{ padding: '6px 14px', fontSize: '0.85rem' }}>
                      <Play size={14} /> Audition
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Submit to Showroom Form */}
          {selectedTake && (
            <div className="glass-card" style={{ background: 'linear-gradient(135deg, rgba(255,0,127,0.15) 0%, rgba(23,17,43,0.85) 100%)', borderColor: 'var(--secondary)' }}>
              <h3 style={{ fontSize: '1.3rem', marginBottom: '8px', color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Sparkles size={20} color="var(--secondary)" /> Submit Take #{selectedTake.number} to Community Showroom
              </h3>
              <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)', marginBottom: '20px' }}>
                Satisfied with your vocal impression? Add your actor credentials and launch it into the showroom for community reactions and voting!
              </p>
              
              <form onSubmit={handleSubmitDub} className="two-col-grid">
                <div className="input-group">
                  <label className="input-label">Actor / Player Name</label>
                  <input 
                    type="text" 
                    className="input-field" 
                    placeholder="e.g. Sebastian The Dub God" 
                    value={author}
                    onChange={(e) => setAuthor(e.target.value)}
                    required
                  />
                </div>
                <div className="input-group">
                  <label className="input-label">Dub Performance Title</label>
                  <input 
                    type="text" 
                    className="input-field" 
                    placeholder="e.g. Epic Comedic Twist Version" 
                    value={dubTitle}
                    onChange={(e) => setDubTitle(e.target.value)}
                    required
                  />
                </div>
                <div style={{ gridColumn: 'span 2', display: 'flex', justifyContent: 'flex-end', marginTop: '8px' }}>
                  <button type="submit" className="btn btn-secondary" disabled={submitting} style={{ padding: '14px 28px', fontSize: '1.05rem' }}>
                    <Save size={18} /> {submitting ? 'Broadcasting...' : 'Launch Dub to Showroom 🚀'}
                  </button>
                </div>
              </form>
            </div>
          )}
        </div>

        {/* Right Column: Dialogue Teleprompter & Script Notes */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div className="script-prompter">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', paddingBottom: '12px', borderBottom: '1px solid var(--border-light)' }}>
              <span style={{ color: 'var(--accent-gold)', fontWeight: 700, fontSize: '1.05rem', fontFamily: 'var(--font-heading)' }}>
                📜 Dialogue Teleprompter & Cues
              </span>
              {!editingScript ? (
                <button 
                  onClick={() => setEditingScript(true)}
                  style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '0.85rem' }}
                >
                  <Edit3 size={15} /> Edit Script
                </button>
              ) : (
                <button 
                  onClick={handleSaveScript}
                  style={{ background: 'var(--accent-mint)', border: 'none', color: '#000', padding: '4px 12px', borderRadius: '6px', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '0.85rem', fontWeight: 700 }}
                >
                  <Check size={15} /> Save Cues
                </button>
              )}
            </div>

            <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '16px', fontFamily: 'var(--font-body)' }}>
              Read your lines aloud in time with the scene! Friends can edit timestamp notes collaboratively.
            </p>

            {editingScript ? (
              <textarea 
                className="textarea-field" 
                style={{ width: '100%', minHeight: '300px', fontFamily: 'monospace', background: '#07040d', fontSize: '0.95rem' }}
                value={scriptText}
                onChange={(e) => setScriptText(e.target.value)}
              />
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                {scriptText ? scriptText.split('\n').map((line, idx) => (
                  <div key={idx} className="script-line">
                    {line || '—'}
                  </div>
                )) : (
                  <div style={{ color: 'var(--text-muted)', fontStyle: 'italic', padding: '20px 0' }}>
                    No script cues added yet. Click "Edit Script" above to type dialogue lines for your actors!
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="glass-card" style={{ background: 'rgba(23, 17, 43, 0.4)' }}>
            <h4 style={{ fontSize: '1rem', color: 'var(--accent-mint)', marginBottom: '8px' }}>💡 Pro Voice Acting Tips:</h4>
            <ul style={{ paddingLeft: '18px', color: 'var(--text-muted)', fontSize: '0.9rem', display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <li>Use **headphones** so your microphone doesn't pick up the original movie background sound during recording!</li>
              <li>Record multiple quick takes in succession; the audition rack lets you review and compare instantly.</li>
              <li>Adjust the **Background Audio Mix** slider before submitting so background sound effects complement your vocals!</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
