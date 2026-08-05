import React, { useState, useEffect, useRef } from 'react';
import { Trophy, Flame, Laugh, Skull, Download, Film, Volume2, Loader2, Share2, Music, User } from 'lucide-react';
import DualWaveform from './DualWaveform';

export default function Showroom({ clip, allClips, onSelectClip }) {
  const [clipData, setClipData] = useState(null);
  const [selectedDub, setSelectedDub] = useState(null);
  const [audioMode, setAudioMode] = useState('dub'); // 'dub' or 'original'
  const [loading, setLoading] = useState(true);
  const [exportingDubId, setExportingDubId] = useState(null);
  const [exportUrls, setExportUrls] = useState({});

  const videoRef = useRef(null);
  const audioRef = useRef(null);

  // Fetch complete details including dubs and reactions
  useEffect(() => {
    const fetchClipDetails = async () => {
      if (!clip) return;
      setLoading(true);
      try {
        const res = await fetch(`/api/clips/${clip.id}`);
        const data = await res.json();
        setClipData(data);
        if (data.dubs && data.dubs.length > 0) {
          setSelectedDub(data.dubs[0]); // Default to latest dub!
        } else {
          setSelectedDub(null);
        }
      } catch (err) {
        console.error('Failed to load clip showroom data:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchClipDetails();
  }, [clip]);

  // Synchronize audio playback with video play/pause/seek
  const handlePlay = () => {
    if (audioMode === 'dub' && selectedDub && audioRef.current && videoRef.current) {
      audioRef.current.currentTime = videoRef.current.currentTime;
      videoRef.current.volume = selectedDub.mix_volume !== undefined ? selectedDub.mix_volume : 0.2;
      audioRef.current.play().catch(e => console.error(e));
    } else if (videoRef.current) {
      videoRef.current.volume = 1.0;
    }
  };

  const handlePause = () => {
    if (audioRef.current) audioRef.current.pause();
  };

  const handleSeek = () => {
    if (audioRef.current && videoRef.current) {
      audioRef.current.currentTime = videoRef.current.currentTime;
    }
  };

  const handleVote = async (dubId, reactionType) => {
    try {
      const res = await fetch(`/api/dubs/${dubId}/vote`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reaction: reactionType })
      });
      const result = await res.json();

      if (result.success) {
        // Update reaction numbers in local state smoothly
        setClipData(prev => ({
          ...prev,
          dubs: prev.dubs.map(d => {
            if (d.id === dubId) {
              return {
                ...d,
                reactions: {
                  ...d.reactions,
                  [reactionType]: result.count
                }
              };
            }
            return d;
          })
        }));

        if (selectedDub && selectedDub.id === dubId) {
          setSelectedDub(prev => ({
            ...prev,
            reactions: {
              ...prev.reactions,
              [reactionType]: result.count
            }
          }));
        }
      }
    } catch (err) {
      console.error('Vote failed:', err);
    }
  };

  const handleExportMP4 = async (dubId) => {
    setExportingDubId(dubId);
    try {
      const res = await fetch(`/api/dubs/${dubId}/export`, { method: 'POST' });
      const data = await res.json();
      if (data.download_url) {
        setExportUrls(prev => ({ ...prev, [dubId]: data.download_url }));
      }
    } catch (err) {
      alert('Failed to render MP4 video on server.');
    } finally {
      setExportingDubId(null);
    }
  };

  if (!clip) {
    return (
      <div className="glass-card" style={{ textAlign: 'center', padding: '60px 20px', maxWidth: '700px', margin: '40px auto' }}>
        <Trophy size={54} color="var(--accent-gold)" style={{ margin: '0 auto 20px' }} />
        <h2>Welcome to The Watch Party Showroom!</h2>
        <p style={{ color: 'var(--text-muted)', margin: '12px 0 28px' }}>
          Select any video scene from your library to watch all submitted voiceover performances, cast emoji awards, and download finished MP4 clips!
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

  return (
    <div className="showroom-container">
      {/* Header & Clip Switcher */}
      <div className="flex-responsive" style={{ marginBottom: '24px' }}>
        <div>
          <span className="badge badge-gold" style={{ marginBottom: '6px', display: 'inline-block' }}>🏆 COMMUNITY SHOWROOM & AWARDS</span>
          <h2>{clipData ? clipData.title : clip.title}</h2>
        </div>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          <label style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Showroom Scene:</label>
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
        {/* Cinema Video Player Deck */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div className="video-container" style={{ boxShadow: '0 0 35px rgba(255, 0, 127, 0.25)', borderColor: 'var(--border-glow)' }}>
            <video 
              ref={videoRef}
              src={clip.original_url} 
              controls={true}
              onPlay={handlePlay}
              onPause={handlePause}
              onSeeked={handleSeek}
              className="video-element" 
            />
            {selectedDub && (
              <audio 
                ref={audioRef} 
                src={selectedDub.audio_url} 
              />
            )}
          </div>

          {/* Choicer Voicer Synchronized Showroom Waveform */}
          <DualWaveform 
            originalAudioUrl={clip.original_url}
            recordedAudioUrl={selectedDub ? selectedDub.audio_url : null}
            liveStream={null}
            isRecording={false}
            videoRef={videoRef}
            onSeek={(time) => {
              if (audioRef.current && audioMode === 'dub') {
                audioRef.current.currentTime = time;
              }
            }}
          />

          {/* Audio Switcher Controls */}
          <div className="glass-card flex-responsive">
            <div style={{ width: '100%' }}>
              <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', display: 'block', marginBottom: '8px', textTransform: 'uppercase', fontWeight: 700 }}>
                Active Soundtrack Source:
              </span>
              <div className="action-row-responsive">
                <button
                  className="btn"
                  style={{ 
                    padding: '8px 18px', 
                    background: audioMode === 'dub' && selectedDub ? 'var(--secondary)' : 'transparent',
                    border: '1px solid var(--secondary)',
                    color: '#fff'
                  }}
                  disabled={!selectedDub}
                  onClick={() => {
                    setAudioMode('dub');
                    if (videoRef.current) {
                      videoRef.current.currentTime = 0;
                      videoRef.current.volume = selectedDub ? selectedDub.mix_volume : 0.2;
                      videoRef.current.play();
                    }
                  }}
                >
                  🎧 {selectedDub ? `Dub: "${selectedDub.title}" by ${selectedDub.author}` : 'No Dub Selected'}
                </button>

                <button
                  className="btn"
                  style={{ 
                    padding: '8px 18px', 
                    background: audioMode === 'original' ? 'var(--primary)' : 'transparent',
                    border: '1px solid var(--primary)',
                    color: audioMode === 'original' ? '#000' : '#fff'
                  }}
                  onClick={() => {
                    setAudioMode('original');
                    if (audioRef.current) audioRef.current.pause();
                    if (videoRef.current) {
                      videoRef.current.volume = 1.0;
                      videoRef.current.play();
                    }
                  }}
                >
                  🔊 Original Video Soundtrack
                </button>
              </div>
            </div>

            {selectedDub && (
              <div>
                {exportUrls[selectedDub.id] ? (
                  <a 
                    href={exportUrls[selectedDub.id]} 
                    download
                    className="btn btn-primary"
                    style={{ background: 'var(--accent-mint)', color: '#000' }}
                  >
                    <Download size={18} /> Download Finished MP4
                  </a>
                ) : (
                  <button 
                    className="btn btn-outline" 
                    onClick={() => handleExportMP4(selectedDub.id)}
                    disabled={exportingDubId === selectedDub.id}
                    style={{ borderColor: 'var(--accent-mint)', color: 'var(--accent-mint)' }}
                  >
                    {exportingDubId === selectedDub.id ? (
                      <><Loader2 className="animate-spin" size={18} style={{ animation: 'spin 1s linear infinite' }} /> Mixing MP4 on Server...</>
                    ) : (
                      <><Share2 size={18} /> Export Merged MP4 Video</>
                    )}
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Submitted Dubs & Interactive Voting */}
        <div>
          <div className="glass-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', paddingBottom: '12px', borderBottom: '1px solid var(--border-light)' }}>
              <h3 style={{ fontSize: '1.25rem', color: '#fff', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Music size={22} color="var(--secondary)" /> Submitted Dub Showcase ({clipData?.dubs?.length || 0})
              </h3>
            </div>

            {loading ? (
              <div style={{ padding: '40px 0', textAlign: 'center', color: 'var(--text-muted)' }}>
                <Loader2 size={32} style={{ animation: 'spin 1s linear infinite', margin: '0 auto 10px' }} />
                Loading community performances...
              </div>
            ) : (!clipData || !clipData.dubs || clipData.dubs.length === 0) ? (
              <div style={{ textAlign: 'center', padding: '40px 10px' }}>
                <p style={{ color: 'var(--text-muted)', marginBottom: '16px' }}>
                  No voice dubs recorded for this clip yet. Step into the studio and be the first to dub it!
                </p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', maxHeight: '600px', overflowY: 'auto', paddingRight: '4px' }}>
                {clipData.dubs.map(dub => {
                  const isSelected = selectedDub && selectedDub.id === dub.id && audioMode === 'dub';
                  return (
                    <div 
                      key={dub.id}
                      style={{
                        padding: '16px',
                        background: isSelected ? 'linear-gradient(135deg, rgba(0, 240, 255, 0.12) 0%, rgba(35, 27, 66, 0.9) 100%)' : 'rgba(255, 255, 255, 0.02)',
                        border: isSelected ? '1px solid var(--primary)' : '1px solid var(--border-light)',
                        borderRadius: '16px',
                        transition: 'all 0.2s ease'
                      }}
                    >
                      <div 
                        style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', cursor: 'pointer', marginBottom: '12px' }}
                        onClick={() => {
                          setSelectedDub(dub);
                          setAudioMode('dub');
                          if (videoRef.current) {
                            videoRef.current.currentTime = 0;
                            videoRef.current.volume = dub.mix_volume !== undefined ? dub.mix_volume : 0.2;
                            videoRef.current.play();
                          }
                        }}
                      >
                        <div>
                          <h4 style={{ fontSize: '1.15rem', color: isSelected ? 'var(--primary)' : '#fff', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                            {isSelected ? '▶️' : '🎙️'} {dub.title}
                          </h4>
                          <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                            <User size={13} /> Performed by <strong style={{ color: '#fff' }}>{dub.author}</strong>
                          </span>
                        </div>
                        <span className="badge badge-cyan" style={{ fontSize: '0.75rem' }}>
                          Mix: {Math.round((dub.mix_volume !== undefined ? dub.mix_volume : 0.2) * 100)}% Bg
                        </span>
                      </div>

                      {/* Interactive Emoji Reaction Rating System */}
                      <div className="reaction-pills">
                        <button 
                          className="reaction-pill award" 
                          title="Academy Award - Outstanding Voice Acting!"
                          onClick={(e) => { e.stopPropagation(); handleVote(dub.id, 'award'); }}
                        >
                          <span>🏆</span> <span>{dub.reactions?.award || 0}</span>
                        </button>
                        <button 
                          className="reaction-pill" 
                          title="Hilarious / Comedic Genius!"
                          onClick={(e) => { e.stopPropagation(); handleVote(dub.id, 'funny'); }}
                        >
                          <span>🤣</span> <span>{dub.reactions?.funny || 0}</span>
                        </button>
                        <button 
                          className="reaction-pill spot-on" 
                          title="Spot On Impression!"
                          onClick={(e) => { e.stopPropagation(); handleVote(dub.id, 'spot_on'); }}
                        >
                          <span>🔥</span> <span>{dub.reactions?.spot_on || 0}</span>
                        </button>
                        <button 
                          className="reaction-pill" 
                          title="Cursed / Wild Interpretation"
                          onClick={(e) => { e.stopPropagation(); handleVote(dub.id, 'cursed'); }}
                        >
                          <span>💀</span> <span>{dub.reactions?.cursed || 0}</span>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
