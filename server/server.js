const express = require('express');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const ffmpeg = require('fluent-ffmpeg');
const db = require('./database');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// Ensure upload directories exist
const uploadsDir = path.join(__dirname, 'uploads');
const videosDir = path.join(uploadsDir, 'videos');
const dubsDir = path.join(uploadsDir, 'dubs');
const exportsDir = path.join(uploadsDir, 'exports');

[uploadsDir, videosDir, dubsDir, exportsDir].forEach(dir => {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

// Serve static uploaded files
app.use('/uploads', express.static(uploadsDir));

// Configure Multer for video and audio file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    if (file.fieldname === 'video') cb(null, videosDir);
    else if (file.fieldname === 'audio') cb(null, dubsDir);
    else cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname) || (file.fieldname === 'audio' ? '.webm' : '.mp4');
    cb(null, `${uuidv4()}${ext}`);
  }
});

const upload = multer({ storage });

// =======================
// API Endpoints
// =======================

// 1. Get all video clips
app.get('/api/clips', (req, res) => {
  try {
    const clips = db.prepare(`
      SELECT c.*, COUNT(d.id) as dub_count 
      FROM clips c 
      LEFT JOIN dubs d ON c.id = d.clip_id 
      GROUP BY c.id 
      ORDER BY c.created_at DESC
    `).all();

    const formattedClips = clips.map(c => ({
      ...c,
      tags: JSON.parse(c.tags || '[]'),
      original_url: c.original_url
    }));

    res.json(formattedClips);
  } catch (error) {
    console.error('Error fetching clips:', error);
    res.status(500).json({ error: 'Failed to fetch video clips.' });
  }
});

// 2. Get single clip by ID with its dubs and reactions
app.get('/api/clips/:id', (req, res) => {
  try {
    const clip = db.prepare('SELECT * FROM clips WHERE id = ?').get(req.params.id);
    if (!clip) return res.status(404).json({ error: 'Clip not found.' });

    clip.tags = JSON.parse(clip.tags || '[]');
    // clip.original_url is already relative (/uploads/...)

    // Fetch dubs for this clip
    const dubs = db.prepare('SELECT * FROM dubs WHERE clip_id = ? ORDER BY created_at DESC').all(clip.id);

    // For each dub, attach its reaction vote counts
    const dubsWithReactions = dubs.map(d => {
      const reactions = db.prepare('SELECT reaction_type, count FROM reactions WHERE dub_id = ?').all(d.id);
      const reactionMap = { award: 0, funny: 0, spot_on: 0, cursed: 0 };
      reactions.forEach(r => {
        reactionMap[r.reaction_type] = r.count;
      });

      return {
        ...d,
        audio_url: d.audio_url,
        reactions: reactionMap
      };
    });

    res.json({ ...clip, dubs: dubsWithReactions });
  } catch (error) {
    console.error('Error fetching clip details:', error);
    res.status(500).json({ error: 'Failed to fetch clip details.' });
  }
});

// 3. Upload a new video clip
app.post('/api/clips', upload.single('video'), (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No video file provided.' });

    const id = uuidv4();
    const title = req.body.title || 'Untitled Clip';
    const category = req.body.category || 'General';
    const tags = req.body.tags ? JSON.stringify(req.body.tags.split(',').map(t => t.trim()).filter(Boolean)) : '[]';
    const script_cues = req.body.script_cues || '00:01 - Character A: (Gasps) What is that?!\n00:03 - Character B: It looks like an ancient gaming console!';
    const filename = req.file.filename;
    const original_url = `/uploads/videos/${filename}`;
    const created_at = new Date().toISOString();

    db.prepare(`
      INSERT INTO clips (id, title, category, tags, filename, original_url, script_cues, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(id, title, category, tags, filename, original_url, script_cues, created_at);

    res.status(201).json({
      id,
      title,
      category,
      tags: JSON.parse(tags),
      filename,
      original_url,
      script_cues,
      created_at,
      dub_count: 0
    });
  } catch (error) {
    console.error('Error uploading clip:', error);
    res.status(500).json({ error: 'Failed to save video clip.' });
  }
});

// Helper to clean, decode Base64, format, and validate Netscape HTTP cookie text
const cleanAndFormatCookies = (rawText) => {
  if (!rawText || typeof rawText !== 'string') return null;
  let text = rawText.trim();
  
  // Strip surrounding single or double quotes (common when pasting into cloud environment dashboards or .env files)
  if ((text.startsWith('"') && text.endsWith('"')) || (text.startsWith("'") && text.endsWith("'"))) {
    text = text.slice(1, -1).trim();
  }
  
  // Automatically detect and decode Base64 strings (relying on Base64 eliminates all line break and formatting corruption in cloud env vars!)
  if (!text.includes('.youtube.com') && !text.includes('.google.com') && !text.includes('# Netscape') && /^[a-zA-Z0-9+/=\s]+$/.test(text) && text.length > 50) {
    try {
      const decoded = Buffer.from(text, 'base64').toString('utf8');
      if (decoded.includes('.youtube.com') || decoded.includes('.google.com') || decoded.includes('# Netscape')) {
        console.log('✅ Successfully decoded Base64 encoded YouTube authentication cookies.');
        text = decoded.trim();
      }
    } catch (e) {
      // Ignore base64 decoding errors
    }
  }

  // Normalize escaped line endings (\r\n, \n, \r) to actual linebreaks
  text = text.replace(/\\r\\n/g, '\n').replace(/\\n/g, '\n').replace(/\\r/g, '\n').replace(/\r\n/g, '\n');
  
  // Automatically convert raw browser HTTP Cookie header strings (semicolon separated key=value pairs) to Netscape format!
  if (!text.includes('\t') && (text.includes('LOGIN_INFO=') || text.includes('HSID=') || text.includes('SID='))) {
    console.log('🔄 [YouTube Cookies] Detected raw HTTP Cookie header string! Automatically converting to Netscape tab-delimited format...');
    const cookiePairs = text.split(';');
    const netscapeRows = ['# Netscape HTTP Cookie File', '# Auto-converted from HTTP Cookie header string for yt-dlp', ''];
    const futureExpiry = Math.floor(Date.now() / 1000) + 31536000; // 1 year validity timestamp
    
    for (const pair of cookiePairs) {
      const trimmed = pair.trim();
      if (!trimmed) continue;
      const eqIdx = trimmed.indexOf('=');
      if (eqIdx === -1) continue;
      const name = trimmed.substring(0, eqIdx).trim();
      const val = trimmed.substring(eqIdx + 1).trim();
      netscapeRows.push(`.youtube.com\tTRUE\t/\tTRUE\t${futureExpiry}\t${name}\t${val}`);
    }
    text = netscapeRows.join('\n');
  }
  
  // Ensure the mandatory Netscape header is present (yt-dlp will throw a syntax error without it)
  if (!text.startsWith('# Netscape HTTP Cookie File') && !text.startsWith('# HTTP Cookie File')) {
    text = `# Netscape HTTP Cookie File\n# Automated cookie configuration for VoiceDub Arena yt-dlp imports.\n\n${text}`;
  }

  return text;
};

// Helper to manage YouTube authentication cookies from environment variables or client submissions
const getYouTubeCookiesPath = (customCookiesText) => {
  const dataDir = path.join(__dirname, 'data');
  if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
  
  const targetCookiePath = path.join(dataDir, 'youtube_cookies.txt');
  let newCookieContent = null;
  let source = '';
  
  // 1. If custom cookies text was passed directly from UI or endpoint, use it
  if (customCookiesText && typeof customCookiesText === 'string' && customCookiesText.trim().length > 10) {
    newCookieContent = cleanAndFormatCookies(customCookiesText);
    source = 'submitted user data';
  } 
  // 2. Otherwise check YOUTUBE_COOKIES, YT_COOKIES, or COOKIES_TXT environment variables on deployed server
  else {
    const envCookies = process.env.YOUTUBE_COOKIES || process.env.YT_COOKIES || process.env.COOKIES_TXT;
    if (envCookies && envCookies.trim().length > 10) {
      newCookieContent = cleanAndFormatCookies(envCookies);
      source = 'environment variables';
    }
  }

  // Write/update the cookie file whenever new content differs from existing disk content
  if (newCookieContent) {
    try {
      let needsUpdate = true;
      if (fs.existsSync(targetCookiePath)) {
        const existingContent = fs.readFileSync(targetCookiePath, 'utf8');
        if (existingContent === newCookieContent) {
          needsUpdate = false;
        }
      }
      if (needsUpdate) {
        fs.writeFileSync(targetCookiePath, newCookieContent, 'utf8');
        console.log(`🍪 [YouTube Cookies] Updated server cookies file from ${source}.`);
      }
    } catch (e) {
      console.error(`Failed to write YouTube cookies to file from ${source}:`, e);
    }
  }
  
  // 3. Check all standard cookie file locations on server
  const possiblePaths = [
    targetCookiePath,
    path.join(__dirname, 'data', 'cookies.txt'),
    path.join(__dirname, 'cookies.txt'),
    '/app/server/data/cookies.txt',
    '/app/cookies.txt',
    '/data/cookies.txt'
  ];
  
  for (const p of possiblePaths) {
    if (fs.existsSync(p) && fs.statSync(p).size > 10) {
      return p;
    }
  }
  return null;
};

// Check YouTube cookie configuration status on the server
app.get('/api/youtube/cookies-status', (req, res) => {
  try {
    const cookiePath = getYouTubeCookiesPath();
    res.json({ configured: !!cookiePath });
  } catch (error) {
    res.status(500).json({ error: 'Failed to inspect cookie status' });
  }
});

// Update YouTube cookie configuration on the server directly from frontend UI
app.post('/api/youtube/cookies', (req, res) => {
  try {
    const { cookies } = req.body;
    if (!cookies || typeof cookies !== 'string' || cookies.trim().length < 10) {
      return res.status(400).json({ error: 'Please paste a valid Netscape format cookies.txt string (must start with # Netscape HTTP Cookie File or contain cookie domain rows).' });
    }
    const cookiePath = getYouTubeCookiesPath(cookies);
    res.json({ success: true, configured: !!cookiePath, message: 'YouTube authentication cookies successfully saved on server!' });
  } catch (error) {
    console.error('Error saving cookies:', error);
    res.status(500).json({ error: 'Failed to save cookies on server.' });
  }
});

// 3.5. Import video directly from YouTube link using instantaneous Embedded YouTube Architecture (Zero cloud server downloading / Zero anti-bot blocks!)
app.post('/api/clips/youtube', async (req, res) => {
  try {
    const { url, title, category, tags, script_cues } = req.body;
    if (!url || typeof url !== 'string') {
      return res.status(400).json({ error: 'Please provide a valid YouTube video or short URL.' });
    }

    // Extract 11-character YouTube video ID using robust regex
    const ytMatch = url.match(/(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=|shorts\/)|youtu\.be\/)([^"&?\/\s]{11})/i);
    if (!ytMatch || !ytMatch[1]) {
      return res.status(400).json({ error: 'Could not detect a valid YouTube Video ID from the provided URL. Please enter a valid link (e.g. https://www.youtube.com/watch?v=... or https://www.youtube.com/shorts/...)' });
    }
    const videoId = ytMatch[1];
    const id = uuidv4();

    // Construct standard embedded streaming URL and virtual filename
    const original_url = `https://www.youtube-nocookie.com/embed/${videoId}`;
    const filename = `youtube_${videoId}`;
    const created_at = new Date().toISOString();

    // Attempt to retrieve authentic YouTube title via public oEmbed (immune to anti-bot verification)
    let extractedTitle = `YouTube Clip (${videoId})`;
    try {
      const oembedRes = await fetch(`https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`, {
        signal: AbortSignal.timeout(4000)
      });
      if (oembedRes.ok) {
        const oembedData = await oembedRes.json();
        if (oembedData && oembedData.title) {
          extractedTitle = oembedData.title;
        }
      }
    } catch (oErr) {
      console.log(`[YouTube oEmbed] Could not fetch metadata for video ID ${videoId} (defaulting to custom title):`, oErr.message);
    }

    const finalTitle = title && title.trim() !== '' ? title.trim() : extractedTitle;
    const finalCategory = category || 'General';
    const parsedTags = tags ? JSON.stringify(typeof tags === 'string' ? tags.split(',').map(t => t.trim()).filter(Boolean) : tags) : '["YouTube"]';
    const finalCues = script_cues || '00:01 - Character A: (Performing vocal dub over YouTube video...)\n00:05 - Character B: (Replying in studio take...)';

    db.prepare(`
      INSERT INTO clips (id, title, category, tags, filename, original_url, script_cues, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(id, finalTitle, finalCategory, parsedTags, filename, original_url, finalCues, created_at);

    console.log(`✨ [Embedded YouTube Import] Immediately linked YouTube clip '${finalTitle}' (ID: ${videoId}) into Vault!`);

    res.status(201).json({
      id,
      title: finalTitle,
      category: finalCategory,
      tags: JSON.parse(parsedTags),
      filename,
      original_url,
      script_cues: finalCues,
      created_at,
      dub_count: 0
    });
  } catch (error) {
    console.error('YouTube import route error:', error);
    res.status(500).json({ error: 'Failed to import embedded YouTube video link.' });
  }
});

// 4. Update dialogue teleprompter script for a clip
app.put('/api/clips/:id/script', (req, res) => {
  try {
    const { script_cues } = req.body;
    db.prepare('UPDATE clips SET script_cues = ? WHERE id = ?').run(script_cues || '', req.params.id);
    res.json({ success: true, script_cues });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update script cues.' });
  }
});

// 4.5. Crop / Trim a video clip by timestamps or aspect ratio using ffmpeg
app.post('/api/clips/:id/crop', (req, res) => {
  try {
    const clip = db.prepare('SELECT * FROM clips WHERE id = ?').get(req.params.id);
    if (!clip) return res.status(404).json({ error: 'Source clip not found in database.' });

    const sourcePath = path.join(videosDir, clip.filename);
    if (!fs.existsSync(sourcePath)) {
      return res.status(404).json({ error: 'Source video file missing on disk.' });
    }

    const { start_time, end_time, crop_ratio, title } = req.body;
    const newId = uuidv4();
    const newFilename = `${newId}.mp4`;
    const outputPath = path.join(videosDir, newFilename);

    let filterOpts = '';
    if (crop_ratio === '9:16') filterOpts = ' -vf "crop=in_h*9/16:in_h"';
    else if (crop_ratio === '1:1') filterOpts = ' -vf "crop=in_h:in_h"';
    else if (crop_ratio === '16:9') filterOpts = ' -vf "crop=in_w:in_w*9/16"';

    // Place -ss and -to after -i so timestamps align exactly with video playback controls
    let timeOpts = '';
    if (start_time !== undefined && start_time !== '' && parseFloat(start_time) > 0) {
      timeOpts += ` -ss "${start_time}"`;
    }
    if (end_time !== undefined && end_time !== '' && parseFloat(end_time) > 0) {
      timeOpts += ` -to "${end_time}"`;
    }

    const cmd = `ffmpeg -i "${sourcePath}"${timeOpts}${filterOpts} -c:v libx264 -pix_fmt yuv420p -c:a aac -b:a 128k -y "${outputPath}"`;

    require('child_process').exec(cmd, { timeout: 120000 }, (err, stdout, stderr) => {
      if (err) {
        console.error('ffmpeg crop error:', err, stderr);
        return res.status(500).json({ error: 'Failed to crop video file. Check timestamp values.' });
      }

      try {
        let existingTags = [];
        try { existingTags = JSON.parse(clip.tags || '[]'); } catch (e) {}
        if (!existingTags.includes('Cropped')) existingTags.push('Cropped');

        const newTitle = (title && title.trim()) || `${clip.title} (Cropped)`;
        const newTags = JSON.stringify(existingTags);
        const original_url = `/uploads/videos/${newFilename}`;
        const created_at = new Date().toISOString();

        db.prepare(`
          INSERT INTO clips (id, title, category, tags, filename, original_url, script_cues, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `).run(newId, newTitle, clip.category, newTags, newFilename, original_url, clip.script_cues, created_at);

        res.status(201).json({
          id: newId,
          title: newTitle,
          category: clip.category,
          tags: existingTags,
          filename: newFilename,
          original_url,
          script_cues: clip.script_cues,
          created_at,
          dub_count: 0
        });
      } catch (dbErr) {
        console.error('Database insertion error for cropped clip:', dbErr);
        res.status(500).json({ error: 'Failed to record cropped clip in database.' });
      }
    });
  } catch (error) {
    console.error('Crop endpoint error:', error);
    res.status(500).json({ error: 'Failed to initialize crop command.' });
  }
});

// 5. Upload a recorded dub for a clip
app.post('/api/clips/:id/dubs', upload.single('audio'), (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No audio recording provided.' });

    const clip = db.prepare('SELECT id FROM clips WHERE id = ?').get(req.params.id);
    if (!clip) return res.status(404).json({ error: 'Target clip not found.' });

    const id = uuidv4();
    const title = req.body.title || 'My Ultimate Dub';
    const author = req.body.author || 'Anonymous Dubber';
    const mix_volume = req.body.mix_volume !== undefined ? parseFloat(req.body.mix_volume) : 0.2;
    const audio_filename = req.file.filename;
    const audio_url = `/uploads/dubs/${audio_filename}`;
    const created_at = new Date().toISOString();

    db.prepare(`
      INSERT INTO dubs (id, clip_id, title, author, audio_filename, audio_url, mix_volume, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(id, clip.id, title, author, audio_filename, audio_url, mix_volume, created_at);

    // Initialize default reaction votes for the dub
    ['award', 'funny', 'spot_on', 'cursed'].forEach(type => {
      db.prepare('INSERT INTO reactions (dub_id, reaction_type, count) VALUES (?, ?, 0)').run(id, type);
    });

    res.status(201).json({
      id,
      clip_id: clip.id,
      title,
      author,
      audio_url,
      mix_volume,
      created_at,
      reactions: { award: 0, funny: 0, spot_on: 0, cursed: 0 }
    });
  } catch (error) {
    console.error('Error saving voice dub:', error);
    res.status(500).json({ error: 'Failed to save voice dub.' });
  }
});

// 6. Vote / React to a dub
app.post('/api/dubs/:id/vote', (req, res) => {
  try {
    const { reaction } = req.body;
    if (!['award', 'funny', 'spot_on', 'cursed'].includes(reaction)) {
      return res.status(400).json({ error: 'Invalid reaction type.' });
    }

    const existing = db.prepare('SELECT count FROM reactions WHERE dub_id = ? AND reaction_type = ?').get(req.params.id, reaction);
    if (existing !== undefined) {
      db.prepare('UPDATE reactions SET count = count + 1 WHERE dub_id = ? AND reaction_type = ?').run(req.params.id, reaction);
    } else {
      db.prepare('INSERT INTO reactions (dub_id, reaction_type, count) VALUES (?, ?, 1)').run(req.params.id, reaction);
    }

    const updated = db.prepare('SELECT count FROM reactions WHERE dub_id = ? AND reaction_type = ?').get(req.params.id, reaction);
    res.json({ success: true, count: updated ? updated.count : 1 });
  } catch (error) {
    console.error('Error recording vote:', error);
    res.status(500).json({ error: 'Failed to record vote.' });
  }
});

// 7. Export mixed video MP4 using fluent-ffmpeg (or audio soundtrack for YouTube embedded clips!)
app.post('/api/dubs/:id/export', (req, res) => {
  try {
    const dub = db.prepare('SELECT d.*, c.filename as clip_filename, c.original_url FROM dubs d JOIN clips c ON d.clip_id = c.id WHERE d.id = ?').get(req.params.id);
    if (!dub) return res.status(404).json({ error: 'Dub not found.' });

    const audioPath = path.join(dubsDir, dub.audio_filename);
    if (!fs.existsSync(audioPath)) {
      return res.status(404).json({ error: 'Recorded dub audio file missing on server.' });
    }

    // Check if source video is an embedded YouTube link
    const isYouTubeClip = (dub.clip_filename && dub.clip_filename.startsWith('youtube_')) || (dub.original_url && dub.original_url.includes('youtube'));
    if (isYouTubeClip) {
      return res.json({ 
        download_url: `/uploads/dubs/${dub.audio_filename}`,
        is_youtube_soundtrack: true,
        message: 'This dub is powered by zero-block Embedded YouTube architecture. Downloading your studio audio soundtrack!'
      });
    }

    const videoPath = path.join(videosDir, dub.clip_filename);
    const exportFilename = `export_${dub.id}.mp4`;
    const exportPath = path.join(exportsDir, exportFilename);

    if (!fs.existsSync(videoPath)) {
      return res.status(404).json({ error: 'Source media video missing on server.' });
    }

    // If export already exists, return it immediately!
    if (fs.existsSync(exportPath)) {
      return res.json({ download_url: `/uploads/exports/${exportFilename}` });
    }

    const mixVol = dub.mix_volume !== undefined ? dub.mix_volume : 0.2;

    // Use ffmpeg to mix original video's audio at mixVol and recorded audio at full volume
    ffmpeg()
      .input(videoPath)
      .input(audioPath)
      .complexFilter([
        `[0:a]volume=${mixVol}[original_a];[1:a]volume=1.0[dub_a];[original_a][dub_a]amix=inputs=2:duration=first:dropout_transition=2[a_out]`
      ])
      .outputOptions([
        '-c:v copy',              // Copy video stream directly for instant processing!
        '-map 0:v:0',             // Map original video stream
        '-map [a_out]',           // Map mixed audio stream
        '-c:a aac',               // Encode mixed audio to AAC for MP4 compatibility
        '-shortest'
      ])
      .on('end', () => {
        res.json({ download_url: `/uploads/exports/${exportFilename}` });
      })
      .on('error', (err) => {
        console.error('ffmpeg export error:', err);
        res.status(500).json({ error: 'Failed to process MP4 export video.' });
      })
      .save(exportPath);

  } catch (error) {
    console.error('Export error:', error);
    res.status(500).json({ error: 'Failed to initialize export job.' });
  }
});

// 8. Seed Demo Clip endpoint (Generates a sci-fi countdown animation video using ffmpeg!)
app.post('/api/seed-demo', (req, res) => {
  try {
    const demoFilename = 'demo_sci_fi.mp4';
    const videoPath = path.join(videosDir, demoFilename);

    // Check if Demo clip already exists in DB
    const existing = db.prepare('SELECT * FROM clips WHERE filename = ?').get(demoFilename);
    if (existing) {
      return res.json({ message: 'Demo clip already ready in vault!', clip_id: existing.id });
    }

    const id = uuidv4();
    const title = 'Cyberpunk Neon Broadcast (Demo)';
    const category = 'Sci-Fi / Demo';
    const tags = JSON.stringify(['Cyberpunk', 'Demo', 'Sci-Fi', 'Countdown']);
    const script_cues = `00:01 - AI Overlord: ALERT. Unauthorized frequency detected in Sector 7.\n00:03 - Rebel Hacker: Relax, computer! We're just firing up VoiceDub Arena!\n00:06 - AI Overlord: Warning! Dubbing protocol initiated! Volume exceeding maximum parameters!`;
    const original_url = `/uploads/videos/${demoFilename}`;
    const created_at = new Date().toISOString();

    // Generate a vibrant test pattern video with synthesizer audio tones via ffmpeg
    const cmd = `ffmpeg -f lavfi -i testsrc=size=1280x720:rate=30 -f lavfi -i sine=frequency=440:beep_factor=4 -t 8 -c:v libx264 -pix_fmt yuv420p -c:a aac -b:a 128k -y "${videoPath}"`;
    require('child_process').exec(cmd, (err) => {
      if (err) {
        console.error('Error generating demo video:', err);
        return res.status(500).json({ error: 'Failed to generate demo video clip.' });
      }
      try {
        db.prepare(`
          INSERT INTO clips (id, title, category, tags, filename, original_url, script_cues, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `).run(id, title, category, tags, demoFilename, original_url, script_cues, created_at);
        res.json({ success: true, message: 'Generated demo animation clip!', clip_id: id });
      } catch (dbErr) {
        console.error('Database insertion error:', dbErr);
        res.status(500).json({ error: 'Failed to record clip in db.' });
      }
    });

  } catch (error) {
    res.status(500).json({ error: 'Failed to seed demo.' });
  }
});

// Serve static frontend build in production
const clientDist = path.join(__dirname, '../client/dist');
if (fs.existsSync(clientDist)) {
  app.use(express.static(clientDist));
  // Catch-all fallback handler (compatible with Express 5 path routing)
  app.use((req, res) => {
    if (!req.path.startsWith('/api') && !req.path.startsWith('/uploads')) {
      res.sendFile(path.join(clientDist, 'index.html'));
    } else {
      res.status(404).json({ error: 'Endpoint or media resource not found on server.' });
    }
  });
}

app.listen(PORT, '0.0.0.0', () => {
  console.log(`🎤 VoiceDub Arena API Server listening on port ${PORT}`);
  
  // Initialize and verify YouTube cookies on startup
  try {
    const cookiePath = getYouTubeCookiesPath();
    if (cookiePath) {
      console.log(`🍪 [YouTube Cookies] Successfully verified active cookies file at: ${cookiePath}`);
    } else {
      console.log('🍪 [YouTube Cookies] No custom cookies configured (YOUTUBE_COOKIES env variable not set or empty).');
    }
  } catch (e) {
    console.error('Error checking YouTube cookies on startup:', e);
  }

  // Automatically check and upgrade yt-dlp in background on server start to keep pace with YouTube anti-bot updates
  try {
    const venvPip = path.join(__dirname, 'venv', 'bin', 'pip');
    const pipCmd = fs.existsSync(venvPip) ? venvPip : 'pip3';
    require('child_process').execFile(pipCmd, ['install', '--upgrade', '--no-cache-dir', 'yt-dlp'], (err, stdout, stderr) => {
      if (!err) {
        console.log('✨ [yt-dlp Auto-Updater] Verified/Upgraded yt-dlp to newest release on server boot.');
      } else {
        console.warn('ℹ️ [yt-dlp Auto-Updater] Could not auto-upgrade yt-dlp via pip (normal if container root is read-only):', err ? err.message : stderr);
      }
    });
  } catch (e) {
    // Ignore updater failures
  }
});
