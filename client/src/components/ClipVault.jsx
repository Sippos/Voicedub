import React, { useState, useRef, useEffect } from 'react';
import { Upload, Film, Mic, Trophy, Plus, X, Search, Tag, Video, FileVideo, Loader2, Scissors, Clock, Sliders, ShieldAlert, ShieldCheck, Key } from 'lucide-react';
import UniversalPlayer from './UniversalPlayer.jsx';

export default function ClipVault({ clips, onSelectForStudio, onSelectForShowroom, onClipUploaded }) {
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [showCropModal, setShowCropModal] = useState(false);
  const [croppingClip, setCroppingClip] = useState(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [uploading, setUploading] = useState(false);
  const [processingCrop, setProcessingCrop] = useState(false);

  // Modal Tab ('file' or 'youtube')
  const [uploadTab, setUploadTab] = useState('file');

  // Upload Form states
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('Anime');
  const [tags, setTags] = useState('');
  const [scriptCues, setScriptCues] = useState('00:01 - Character A: (Speaking line...)\n00:04 - Character B: (Response line...)');
  const [file, setFile] = useState(null);
  const [youtubeUrl, setYoutubeUrl] = useState('');

  // Cookie Auth state for Cloud Server Deployment
  const [cookiesConfigured, setCookiesConfigured] = useState(false);
  const [showCookieAuth, setShowCookieAuth] = useState(false);
  const [cookiesText, setCookiesText] = useState('');
  const [savingCookies, setSavingCookies] = useState(false);

  useEffect(() => {
    if (showUploadModal) {
      fetch('/api/youtube/cookies-status')
        .then(r => r.json())
        .then(data => setCookiesConfigured(data.configured))
        .catch(() => setCookiesConfigured(false));
    }
  }, [showUploadModal, uploadTab]);

  const handleCookieFileUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => setCookiesText(event.target.result);
      reader.readAsText(file);
    }
  };

  const handleSaveCookies = async () => {
    if (!cookiesText || cookiesText.trim().length < 10) {
      alert('Please provide a valid Netscape format cookies.txt string or file.');
      return;
    }
    setSavingCookies(true);
    try {
      const res = await fetch('/api/youtube/cookies', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cookies: cookiesText })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setCookiesConfigured(true);
        alert('✅ YouTube authentication cookies saved to deployed server storage!');
        setShowCookieAuth(false);
        setCookiesText('');
      } else {
        alert(data.error || 'Failed to save cookies on server.');
      }
    } catch (err) {
      alert('Error connecting to server to save cookies.');
    } finally {
      setSavingCookies(false);
    }
  };

  // Crop Form states
  const [cropStartTime, setCropStartTime] = useState('');
  const [cropEndTime, setCropEndTime] = useState('');
  const [cropRatio, setCropRatio] = useState('original');
  const [cropTitle, setCropTitle] = useState('');
  const cropVideoRef = useRef(null);

  const categories = ['All', 'Anime', 'Memes', 'Movies', 'Gaming', 'Sci-Fi / Demo', 'General'];

  const filteredClips = clips.filter(clip => {
    const matchesSearch = clip.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          (clip.tags && clip.tags.some(t => t.toLowerCase().includes(searchQuery.toLowerCase())));
    const matchesCategory = selectedCategory === 'All' || clip.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  // Helper to parse YouTube Video or Short ID for instant embed preview
  const getYouTubeId = (url) => {
    if (!url) return null;
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|shorts\/|watch\?v=|\&v=)([^#\&\?]*).*/;
    const match = url.match(regExp);
    return (match && match[2].length === 11) ? match[2] : null;
  };

  const openCropModal = (clip) => {
    setCroppingClip(clip);
    setCropTitle(`${clip.title} (Cropped)`);
    setCropStartTime('0');
    setCropEndTime('');
    setCropRatio('original');
    setShowCropModal(true);
  };

  const handleSetStartToCurrent = () => {
    if (cropVideoRef.current) {
      setCropStartTime(cropVideoRef.current.currentTime.toFixed(2));
    }
  };

  const handleSetEndToCurrent = () => {
    if (cropVideoRef.current) {
      setCropEndTime(cropVideoRef.current.currentTime.toFixed(2));
    }
  };

  const handleCropSubmit = async (e) => {
    e.preventDefault();
    if (!croppingClip) return;
    setProcessingCrop(true);

    try {
      const res = await fetch(`/api/clips/${croppingClip.id}/crop`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          start_time: cropStartTime,
          end_time: cropEndTime,
          crop_ratio: cropRatio,
          title: cropTitle
        })
      });

      const newCroppedClip = await res.json();
      if (res.ok && !newCroppedClip.error) {
        onClipUploaded(newCroppedClip);
        setShowCropModal(false);
        setCroppingClip(null);
      } else {
        alert(newCroppedClip.error || 'Failed to crop video.');
      }
    } catch (err) {
      console.error('Crop submission failed:', err);
      alert('Error connecting to cropping server!');
    } finally {
      setProcessingCrop(false);
    }
  };

  const handleUpload = async (e) => {
    e.preventDefault();
    setUploading(true);

    try {
      let res, newClip;
      if (uploadTab === 'file') {
        if (!file) {
          alert('Please select a video file to upload!');
          setUploading(false);
          return;
        }
        const formData = new FormData();
        formData.append('video', file);
        formData.append('title', title || 'Untitled Clip');
        formData.append('category', category);
        formData.append('tags', tags);
        formData.append('script_cues', scriptCues);

        res = await fetch('/api/clips', {
          method: 'POST',
          body: formData,
        });
      } else {
        // YouTube import
        if (!youtubeUrl || !youtubeUrl.includes('http')) {
          alert('Please enter a valid YouTube video or short URL!');
          setUploading(false);
          return;
        }
        res = await fetch('/api/clips/youtube', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            url: youtubeUrl,
            title: title,
            category,
            tags,
            script_cues: scriptCues,
            cookies: cookiesText.trim() ? cookiesText : undefined
          })
        });
      }

      if (!res.ok && res.headers.get('content-type') && res.headers.get('content-type').includes('text/html')) {
        alert('Server returned a route error (404/500 HTML page). Please restart your local API server (Ctrl+C and run npm run dev again)!');
        setUploading(false);
        return;
      }

      newClip = await res.json();
      if (res.ok && !newClip.error) {
        onClipUploaded(newClip);
        setShowUploadModal(false);
        // Reset form
        setTitle('');
        setFile(null);
        setYoutubeUrl('');
        setTags('');
      } else {
        alert(newClip.error || 'Failed to import video clip.');
      }
    } catch (err) {
      console.error('Upload failed:', err);
      alert(`Error processing media: ${err.message || 'Ensure backend API server is running!'}`);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="vault-container">
      {/* Header controls & Search */}
      <div className="flex-responsive" style={{ marginBottom: '24px' }}>
        <div>
          <h2>🎬 Video Vault & Impressions</h2>
          <p style={{ color: 'var(--text-muted)' }}>Choose a scene to perform your custom voice dub or import new video footage for friends!</p>
        </div>
        <div className="action-row-responsive">
          <button 
            className="btn btn-secondary" 
            onClick={() => { setUploadTab('file'); setShowUploadModal(true); }}
            style={{ background: 'linear-gradient(135deg, #ff007f 0%, #7928ca 100%)' }}
          >
            <Plus size={20} /> Upload MP4
          </button>
          <button 
            className="btn" 
            onClick={() => { setUploadTab('youtube'); setShowUploadModal(true); }}
            style={{ background: '#ff0000', color: '#fff', boxShadow: '0 0 20px rgba(255, 0, 0, 0.4)' }}
          >
            <Video size={20} /> Import YouTube Link
          </button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="glass-card flex-responsive" style={{ padding: '16px 24px', marginBottom: '32px' }}>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          {categories.map(cat => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              style={{
                padding: '6px 14px',
                borderRadius: '99px',
                border: selectedCategory === cat ? '1px solid var(--primary)' : '1px solid var(--border-light)',
                background: selectedCategory === cat ? 'rgba(0, 240, 255, 0.15)' : 'transparent',
                color: selectedCategory === cat ? '#fff' : 'var(--text-muted)',
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'all 0.2s ease'
              }}
            >
              {cat}
            </button>
          ))}
        </div>

        <div style={{ position: 'relative', flex: '1 1 280px', minWidth: '220px' }}>
          <Search size={18} color="var(--text-muted)" style={{ position: 'absolute', left: '12px', top: '14px' }} />
          <input
            type="text"
            className="input-field"
            style={{ width: '100%', paddingLeft: '40px' }}
            placeholder="Search clips or tags..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      {/* Clip Cards Grid */}
      {filteredClips.length === 0 ? (
        <div className="glass-card" style={{ textAlign: 'center', padding: '60px 20px' }}>
          <Film size={48} color="var(--text-muted)" style={{ margin: '0 auto 16px', opacity: 0.5 }} />
          <h3>No Video Clips Found in Vault</h3>
          <p style={{ color: 'var(--text-muted)', marginTop: '8px', marginBottom: '24px' }}>
            Click "Seed Demo Clip" above to instantly generate an animated sample, upload an MP4, or paste a YouTube URL!
          </p>
          <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
            <button className="btn btn-secondary" onClick={() => { setUploadTab('file'); setShowUploadModal(true); }}>
              <Upload size={18} /> Upload Local MP4
            </button>
            <button className="btn" style={{ background: '#ff0000', color: '#fff' }} onClick={() => { setUploadTab('youtube'); setShowUploadModal(true); }}>
              <Video size={18} /> Import YouTube Video
            </button>
          </div>
        </div>
      ) : (
        <div className="clip-grid">
          {filteredClips.map(clip => (
            <div key={clip.id} className="glass-card" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div className="video-container" style={{ aspectRatio: '16/9', background: '#080514' }}>
                <UniversalPlayer 
                  src={clip.original_url} 
                  controls={true}
                  className="video-element" 
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }} 
                />
                <div style={{ position: 'absolute', top: '10px', right: '10px', display: 'flex', gap: '6px', pointerEvents: 'none' }}>
                  <span className="badge badge-pink">{clip.category}</span>
                  {clip.dub_count > 0 && (
                    <span className="badge badge-cyan" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                      <Trophy size={12} /> {clip.dub_count} Dub{clip.dub_count !== 1 && 's'}
                    </span>
                  )}
                </div>
              </div>

              <div>
                <h3 style={{ fontSize: '1.25rem', marginBottom: '6px' }}>{clip.title}</h3>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '8px' }}>
                  {clip.tags && clip.tags.map(tag => (
                    <span key={tag} style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                      <Tag size={11} /> #{tag}
                    </span>
                  ))}
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr 0.9fr', gap: '8px', marginTop: 'auto', paddingTop: '12px', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                <button 
                  className="btn btn-primary" 
                  style={{ padding: '8px 10px', fontSize: '0.9rem' }}
                  onClick={() => onSelectForStudio(clip)}
                >
                  <Mic size={15} /> Dub This
                </button>
                <button 
                  className="btn btn-outline" 
                  style={{ padding: '8px 10px', fontSize: '0.9rem' }}
                  onClick={() => onSelectForShowroom(clip)}
                >
                  <Trophy size={15} /> Show
                </button>
                <button 
                  className="btn btn-outline" 
                  style={{ padding: '8px 10px', fontSize: '0.9rem', borderColor: 'var(--accent-mint)', color: 'var(--accent-mint)' }}
                  onClick={() => openCropModal(clip)}
                  title="Trim start/end time or crop video dimensions"
                >
                  <Scissors size={15} /> Crop
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Crop & Trim Modal */}
      {showCropModal && croppingClip && (
        <div className="modal-overlay" onClick={(e) => { if (e.target.classList.contains('modal-overlay') && !processingCrop) setShowCropModal(false); }}>
          <div className="modal-content" style={{ maxWidth: '700px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--accent-mint)' }}>
                <Scissors size={24} /> Video Cutter & Crop Suite
              </h3>
              {!processingCrop && (
                <button onClick={() => setShowCropModal(false)} style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer' }}>
                  <X size={24} />
                </button>
              )}
            </div>

            <div style={{ marginBottom: '20px', borderRadius: '12px', overflow: 'hidden', border: '1px solid var(--border-light)', background: '#080514' }}>
              <UniversalPlayer 
                ref={cropVideoRef}
                src={croppingClip.original_url} 
                controls={true}
                style={{ maxHeight: '320px', width: '100%', display: 'block', margin: '0 auto' }} 
              />
              <div style={{ padding: '12px 16px', background: 'rgba(255,255,255,0.04)', display: 'flex', justifyContent: 'space-around', alignItems: 'center', gap: '12px', borderTop: '1px solid var(--border-light)' }}>
                <button 
                  type="button" 
                  className="btn btn-outline" 
                  style={{ padding: '6px 12px', fontSize: '0.85rem' }}
                  onClick={handleSetStartToCurrent}
                >
                  <Clock size={14} /> ⏱️ Set Start to Current Time
                </button>
                <button 
                  type="button" 
                  className="btn btn-outline" 
                  style={{ padding: '6px 12px', fontSize: '0.85rem' }}
                  onClick={handleSetEndToCurrent}
                >
                  <Clock size={14} /> ⏱️ Set End to Current Time
                </button>
              </div>
            </div>

            <form onSubmit={handleCropSubmit}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div className="input-group">
                  <label className="input-label" style={{ color: 'var(--accent-mint)' }}>Start Timestamp (in seconds)</label>
                  <input 
                    type="number" 
                    step="0.1" 
                    min="0"
                    className="input-field" 
                    placeholder="e.g. 1.5 or 0" 
                    value={cropStartTime}
                    onChange={(e) => setCropStartTime(e.target.value)}
                    disabled={processingCrop}
                  />
                </div>
                <div className="input-group">
                  <label className="input-label" style={{ color: 'var(--accent-mint)' }}>End Timestamp (in seconds)</label>
                  <input 
                    type="number" 
                    step="0.1" 
                    min="0"
                    className="input-field" 
                    placeholder="Leave blank for full duration" 
                    value={cropEndTime}
                    onChange={(e) => setCropEndTime(e.target.value)}
                    disabled={processingCrop}
                  />
                </div>
              </div>

              <div className="input-group">
                <label className="input-label" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Sliders size={16} /> Spatial Aspect Ratio & Frame Cropping
                </label>
                <select 
                  className="select-field" 
                  value={cropRatio} 
                  onChange={(e) => setCropRatio(e.target.value)}
                  disabled={processingCrop}
                >
                  <option value="original" style={{ background: '#140f26', color: '#fff' }}>Original Dimensions (No Spatial Crop)</option>
                  <option value="9:16" style={{ background: '#140f26', color: '#fff' }}>9:16 Vertical Crop (TikTok & YouTube Shorts style)</option>
                  <option value="1:1" style={{ background: '#140f26', color: '#fff' }}>1:1 Square Crop (Instagram style)</option>
                  <option value="16:9" style={{ background: '#140f26', color: '#fff' }}>16:9 Widescreen Cinema Crop</option>
                </select>
              </div>

              <div className="input-group">
                <label className="input-label">New Cropped Scene Title</label>
                <input 
                  type="text" 
                  className="input-field" 
                  value={cropTitle}
                  onChange={(e) => setCropTitle(e.target.value)}
                  required
                  disabled={processingCrop}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '24px' }}>
                {!processingCrop && (
                  <button type="button" className="btn btn-outline" onClick={() => setShowCropModal(false)}>
                    Cancel
                  </button>
                )}
                <button 
                  type="submit" 
                  className="btn" 
                  disabled={processingCrop}
                  style={{ background: 'var(--accent-mint)', color: '#000', fontWeight: 800, minWidth: '180px' }}
                >
                  {processingCrop ? (
                    <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <Loader2 size={18} className="animate-spin" style={{ animation: 'spin 1s linear infinite' }} />
                      Rendering Cropped Scene...
                    </span>
                  ) : (
                    '✂️ Render Cropped Scene ✨'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Upload Modal */}
      {showUploadModal && (
        <div className="modal-overlay" onClick={(e) => { if (e.target.classList.contains('modal-overlay') && !uploading) setShowUploadModal(false); }}>
          <div className="modal-content" style={{ maxWidth: '650px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                {uploadTab === 'file' ? <><FileVideo size={24} color="var(--secondary)" /> Upload Video File</> : <><Video size={26} color="#ff0000" /> Import from YouTube</>}
              </h3>
              {!uploading && (
                <button onClick={() => setShowUploadModal(false)} style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer' }}>
                  <X size={24} />
                </button>
              )}
            </div>

            {/* Tab Switcher inside modal */}
            <div style={{ display: 'flex', gap: '12px', marginBottom: '24px', borderBottom: '1px solid var(--border-light)', paddingBottom: '12px' }}>
              <button
                type="button"
                onClick={() => setUploadTab('file')}
                style={{
                  flex: 1,
                  padding: '10px',
                  borderRadius: '12px',
                  border: uploadTab === 'file' ? '1px solid var(--secondary)' : '1px solid var(--border-light)',
                  background: uploadTab === 'file' ? 'rgba(255, 0, 127, 0.15)' : 'transparent',
                  color: uploadTab === 'file' ? '#fff' : 'var(--text-muted)',
                  fontWeight: 700,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px'
                }}
              >
                <Upload size={16} /> Local File Upload
              </button>
              <button
                type="button"
                onClick={() => setUploadTab('youtube')}
                style={{
                  flex: 1,
                  padding: '10px',
                  borderRadius: '12px',
                  border: uploadTab === 'youtube' ? '1px solid #ff0000' : '1px solid var(--border-light)',
                  background: uploadTab === 'youtube' ? 'rgba(255, 0, 0, 0.15)' : 'transparent',
                  color: uploadTab === 'youtube' ? '#fff' : 'var(--text-muted)',
                  fontWeight: 700,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px'
                }}
              >
                <Video size={18} color="#ff0000" /> YouTube Video / Short
              </button>
            </div>

            <form onSubmit={handleUpload}>
              {/* Live Preview section inside Modal */}
              {uploadTab === 'file' && file && (
                <div style={{ marginBottom: '20px', borderRadius: '12px', overflow: 'hidden', border: '1px solid var(--border-light)', background: '#000' }}>
                  <div style={{ padding: '6px 12px', background: 'rgba(255,255,255,0.05)', fontSize: '0.8rem', color: 'var(--text-muted)' }}>📹 Local File Video Preview</div>
                  <video src={URL.createObjectURL(file)} controls style={{ maxHeight: '240px', width: '100%', display: 'block', margin: '0 auto' }} />
                </div>
              )}

              {uploadTab === 'youtube' && getYouTubeId(youtubeUrl) && (
                <div style={{ marginBottom: '20px', borderRadius: '12px', overflow: 'hidden', border: '1px solid var(--border-light)', background: '#000' }}>
                  <div style={{ padding: '6px 12px', background: 'rgba(255,255,255,0.05)', fontSize: '0.8rem', color: '#ff4d4d' }}>📺 Live YouTube Video Preview</div>
                  <iframe
                    width="100%"
                    height="240"
                    src={`https://www.youtube.com/embed/${getYouTubeId(youtubeUrl)}`}
                    title="YouTube video player preview"
                    style={{ border: 'none', display: 'block' }}
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                  ></iframe>
                </div>
              )}

              {uploadTab === 'file' ? (
                <div className="input-group">
                  <label className="input-label">Video File (MP4 / WebM / MKV)</label>
                  <input 
                    type="file" 
                    accept="video/*" 
                    className="input-field" 
                    onChange={(e) => setFile(e.target.files[0])}
                    required={uploadTab === 'file'}
                    disabled={uploading}
                  />
                </div>
              ) : (
                <div className="input-group">
                  <label className="input-label" style={{ color: '#ff4d4d' }}>YouTube Video or Short URL</label>
                  <input 
                    type="url" 
                    className="input-field" 
                    placeholder="https://www.youtube.com/watch?v=... or https://youtube.com/shorts/..." 
                    value={youtubeUrl}
                    onChange={(e) => setYoutubeUrl(e.target.value)}
                    required={uploadTab === 'youtube'}
                    disabled={uploading}
                  />

                  {/* Zero-Block Embedded Architecture Info Banner */}
                  <div style={{
                    background: 'rgba(16, 185, 129, 0.1)',
                    border: '1px solid rgba(16, 185, 129, 0.4)',
                    borderRadius: '10px',
                    padding: '14px 16px',
                    marginTop: '14px',
                    marginBottom: '10px'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontWeight: 700, fontSize: '0.9rem', color: '#10B981' }}>
                      <ShieldCheck size={20} color="#10B981" />
                      <span>Zero-Block Embedded Architecture Active ⚡</span>
                    </div>
                    <p style={{ margin: '8px 0 0 0', fontSize: '0.84rem', color: '#e2e8f0', lineHeight: 1.5 }}>
                      YouTube videos and Shorts stream natively via official client embedded players! No cloud IP blocking, no cookie uploading required, and instant importing in under 1 second.
                    </p>
                  </div>
                </div>
              )}

              <div className="input-group">
                <label className="input-label">
                  Clip Title {uploadTab === 'youtube' && <span style={{ textTransform: 'none', color: 'var(--accent-mint)' }}>(Optional - leave blank to use YouTube title)</span>}
                </label>
                <input 
                  type="text" 
                  className="input-field" 
                  placeholder={uploadTab === 'youtube' ? "Leave blank to auto-extract from YouTube..." : "e.g., Anakin vs Obi-Wan Betrayal Scene"} 
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  required={uploadTab === 'file'}
                  disabled={uploading}
                />
              </div>

              <div className="input-group">
                <label className="input-label">Category</label>
                <select 
                  className="select-field" 
                  value={category} 
                  onChange={(e) => setCategory(e.target.value)}
                  disabled={uploading}
                >
                  {categories.filter(c => c !== 'All').map(c => (
                    <option key={c} value={c} style={{ background: '#140f26', color: '#fff' }}>{c}</option>
                  ))}
                </select>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '24px' }}>
                {!uploading && (
                  <button type="button" className="btn btn-outline" onClick={() => setShowUploadModal(false)}>
                    Cancel
                  </button>
                )}
                <button 
                  type="submit" 
                  className="btn" 
                  disabled={uploading}
                  style={{ 
                    background: uploadTab === 'youtube' ? '#ff0000' : 'var(--secondary)',
                    color: '#fff',
                    minWidth: '180px'
                  }}
                >
                  {uploading ? (
                    <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <Loader2 size={18} className="animate-spin" style={{ animation: 'spin 1s linear infinite' }} />
                      {uploadTab === 'youtube' ? 'Downloading YouTube Media...' : 'Uploading Media...'}
                    </span>
                  ) : (
                    uploadTab === 'youtube' ? 'Import from YouTube ✨' : 'Add to Vault ✨'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
