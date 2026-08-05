import React, { useState } from 'react';
import { Mic, Film, Trophy, Sparkles, Loader2 } from 'lucide-react';

export default function Navbar({ activeTab, setActiveTab, onDemoSeeded }) {
  const [loadingDemo, setLoadingDemo] = useState(false);

  const handleSeedDemo = async () => {
    setLoadingDemo(true);
    try {
      const res = await fetch('/api/seed-demo', {
        method: 'POST',
      });
      const data = await res.json();
      if (data.success || data.clip_id) {
        onDemoSeeded(data.clip_id);
      }
    } catch (err) {
      console.error('Failed to generate demo clip:', err);
      alert('Could not generate demo clip. Make sure API server is running!');
    } finally {
      setLoadingDemo(false);
    }
  };

  return (
    <header className="navbar">
      <div className="brand">
        <div className="brand-icon">
          <Mic color="#000" size={28} strokeWidth={2.5} />
        </div>
        <div>
          <span>VOICEDUB</span> <span style={{ fontWeight: 400, fontSize: '1.2rem', color: 'var(--accent-mint)' }}>ARENA</span>
        </div>
      </div>

      <nav className="nav-tabs">
        <button
          className={`nav-tab ${activeTab === 'vault' ? 'active' : ''}`}
          onClick={() => setActiveTab('vault')}
        >
          <Film size={18} />
          Clip Vault
        </button>
        <button
          className={`nav-tab ${activeTab === 'studio' ? 'active' : ''}`}
          onClick={() => setActiveTab('studio')}
        >
          <Mic size={18} />
          Dubbing Studio
        </button>
        <button
          className={`nav-tab ${activeTab === 'showroom' ? 'active' : ''}`}
          onClick={() => setActiveTab('showroom')}
        >
          <Trophy size={18} />
          Showroom & Votes
        </button>
      </nav>

      <div className="navbar-actions">
        <button 
          className="btn btn-primary" 
          onClick={handleSeedDemo}
          disabled={loadingDemo}
        >
          {loadingDemo ? (
            <>
              <Loader2 className="animate-spin" size={18} style={{ animation: 'spin 1s linear infinite' }} />
              Generating...
            </>
          ) : (
            <>
              <Sparkles size={18} />
              Seed Demo Clip
            </>
          )}
        </button>
      </div>
    </header>
  );
}
