import React, { useState, useEffect } from 'react';
import Navbar from './components/Navbar';
import ClipVault from './components/ClipVault';
import DubStudio from './components/DubStudio';
import Showroom from './components/Showroom';

export default function App() {
  const [activeTab, setActiveTab] = useState('vault'); // 'vault', 'studio', 'showroom'
  const [clips, setClips] = useState([]);
  const [selectedClip, setSelectedClip] = useState(null);

  const fetchClips = async () => {
    try {
      const res = await fetch('/api/clips');
      const data = await res.json();
      setClips(data || []);
      if (data.length > 0 && !selectedClip) {
        setSelectedClip(data[0]);
      }
    } catch (err) {
      console.error('Could not connect to VoiceDub API server:', err);
    }
  };

  useEffect(() => {
    fetchClips();
  }, []);

  const handleDemoSeeded = (newClipId) => {
    fetchClips().then(() => {
      // Find and select the demo clip
      setTimeout(() => {
        fetch('/api/clips')
          .then(res => res.json())
          .then(latest => {
            setClips(latest || []);
            const seeded = latest.find(c => c.id === newClipId);
            if (seeded) setSelectedClip(seeded);
          });
      }, 300);
    });
  };

  const handleSelectForStudio = (clip) => {
    setSelectedClip(clip);
    setActiveTab('studio');
  };

  const handleSelectForShowroom = (clip) => {
    setSelectedClip(clip);
    setActiveTab('showroom');
  };

  const handleClipUploaded = (newClip) => {
    setClips(prev => [newClip, ...prev]);
    setSelectedClip(newClip);
    setActiveTab('studio'); // Immediately switch to studio to record voiceover!
  };

  const handleDubSubmitted = (clip, newDub) => {
    // Refresh clips to get updated dub counts and switch to showroom to hear it!
    fetchClips();
    setSelectedClip(clip);
    setActiveTab('showroom');
  };

  return (
    <div className="app-container">
      <Navbar 
        activeTab={activeTab} 
        setActiveTab={setActiveTab} 
        onDemoSeeded={handleDemoSeeded} 
      />

      <main className="main-content">
        {activeTab === 'vault' && (
          <ClipVault 
            clips={clips} 
            onSelectForStudio={handleSelectForStudio} 
            onSelectForShowroom={handleSelectForShowroom} 
            onClipUploaded={handleClipUploaded} 
          />
        )}

        {activeTab === 'studio' && (
          <DubStudio 
            clip={selectedClip} 
            allClips={clips} 
            onSelectClip={setSelectedClip} 
            onDubSubmitted={handleDubSubmitted} 
          />
        )}

        {activeTab === 'showroom' && (
          <Showroom 
            clip={selectedClip} 
            allClips={clips} 
            onSelectClip={setSelectedClip} 
          />
        )}
      </main>
    </div>
  );
}
