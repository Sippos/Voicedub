# VoiceDub Arena 🎙️🏆 

Welcome to **VoiceDub Arena**. This social platform lets you and your friends upload video scenes, enter a digital recording booth to voice over them in real-time, audition synchronized multi-takes with customizable background sound mixing, and showcase performances in a community voting showroom!

---

## ✨ Key Features

1. **🎬 The Vault & Clip Uploader**:
   - Easily drop in any video file (MP4, WebM, MKV).
   - Tag clips by genres (*Anime, Memes, Movies, Gaming, Sci-Fi*).
   - **Demo Generator**: Click `"Seed Demo Clip"` anywhere in the app to instantly instruct the server to render a sci-fi cyberpunk test animation using `ffmpeg` so you can start recording dubs immediately!

2. **🎙️ Recording Booth (Dub Studio)**:
   - Synchronized Video Player with low-latency browser audio capturing via `MediaRecorder`.
   - **Multi-Take Audition Rack**: Record Take #1, #2, etc. Click `"Audition"` on any take to immediately rewind the video and listen to your vocal performance timed precisely to the movie action!
   - **Background Audio Mixer**: Adjustable slider lets you control how much original music/sound effects bleed through underneath your new voiceover (e.g., 20% background / 100% voice dub).
   - **📜 Interactive Teleprompter & Script Editor**: Live dialogue cues and timestamps displayed directly beside the player. Collaborate with friends by typing line assignments right into the script deck!

3. **🏆 Community Showroom & Watch Party**:
   - Cinema screening room to watch any friend's submitted dubs.
   - One-click toggling between the **Original Video Soundtrack** vs. **Friend's Custom Voice Dub**.
   - **Interactive Emoji Award Ratings**: Cast live reaction votes for:
     - 🏆 *Academy Award*
     - 🤣 *Hilarious*
     - 🔥 *Spot On*
     - 💀 *Cursed*
   - **Export Shareable MP4**: Uses server-side `fluent-ffmpeg` audio mixing to physically merge the movie clip with your recorded voiceover into a permanent `.mp4` file ready to download and share on Discord or TikTok!

---

## 🚀 Quickstart Guide

To start both the API Server and React Frontend simultaneously in a single terminal:

```bash
npm run dev
```

- **Frontend Client**: Runs on `http://localhost:5173` (open this in your browser!).
- **API Backend Server**: Runs automatically in parallel on `http://localhost:3001` (handling SQLite storage, media upload, and ffmpeg rendering).

---

## 🎨 Tech Stack & Styling
- **Frontend**: React (Vite) + Lucide Icons + Custom Neon Studio Glassmorphism Design System.
- **Backend**: Node.js + Express + Multer media storage + Better-SQLite3 database.
- **Audio/Video Processing**: HTML5 Web Audio API & MediaRecorder + server-side `ffmpeg`.
# Voicedub
