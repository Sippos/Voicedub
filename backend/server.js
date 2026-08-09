const express = require('express');
const cors = require('cors');
const multer = require('multer');
const axios = require('axios');
const ffmpeg = require('fluent-ffmpeg');
const path = require('path');
const fs = require('fs');
require('dotenv').config();

// Initialize Express App
const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

// Serve static frontend files in production
app.use(express.static(path.join(__dirname, '../frontend/dist')));

// Setup multer for audio file uploads (saving to temporary directory)
const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir);
}
const upload = multer({ dest: uploadDir });

// Route 1: Get Video MP4 Link via RapidAPI
app.post('/api/get-video', async (req, res) => {
  const { youtubeUrl } = req.body;

  if (!youtubeUrl) {
    return res.status(400).json({ error: 'YouTube URL is required' });
  }

  try {
    // -------------------------------------------------------------
    // DEMO MODE: If the user inputs 'demo', bypass RapidAPI completely
    // and return a working MP4 so they can test the full app pipeline.
    // -------------------------------------------------------------
    if (youtubeUrl.toLowerCase().trim() === 'demo') {
      return res.json({
        url: 'https://raw.githubusercontent.com/intel-iot-devkit/sample-videos/master/person-bicycle-car-detection.mp4'
      });
    }

    // NOTE: This is a placeholder for the RapidAPI integration.
    // Since the specific endpoint was not provided, this is ready to be configured.
    // Extract Video ID
    const extractVideoId = (url) => {
        const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
        const match = url.match(regExp);
        return (match && match[2].length === 11) ? match[2] : url; // fallback to url if it's just an id
    };

    const videoId = extractVideoId(youtubeUrl);
    
    const rapidApiKey = process.env.RAPIDAPI_KEY;

    // Ensure API Key is available
    if (!rapidApiKey) {
      return res.status(500).json({ error: 'RAPIDAPI_KEY is not set in environment variables.' });
    }

    // Hit the yt-api.p.rapidapi.com /dl endpoint
    const options = {
      method: 'GET',
      url: 'https://yt-api.p.rapidapi.com/dl',
      params: { id: videoId },
      headers: {
        'x-rapidapi-key': rapidApiKey,
        'x-rapidapi-host': 'yt-api.p.rapidapi.com'
      }
    };

    let data = null;
    let retries = 5;
    
    while (retries > 0) {
      const response = await axios.request(options);
      data = response.data;
      
      if (data.status === 'processing') {
          console.log(`Video ${videoId} is still processing on RapidAPI, waiting 2s...`);
          await new Promise(resolve => setTimeout(resolve, 2000));
          retries--;
      } else {
          break; // Data is ready
      }
    }

    if (data.status === 'processing' || !data) {
        throw new Error('RapidAPI timeout: Video is taking too long to process on the provider side.');
    }

    let mp4Url = null;
    
    // Find pre-muxed mp4 format (contains both audio and video)
    if (data.formats && Array.isArray(data.formats)) {
        const mp4Format = data.formats.find(f => f.mimeType && f.mimeType.includes('video/mp4'));
        if (mp4Format) {
            mp4Url = mp4Format.url;
        }
    }

    // Fallbacks just in case
    if (!mp4Url) {
       mp4Url = data.url || data.link || (data.formats && data.formats[0] && data.formats[0].url);
    }

    if (!mp4Url) {
      console.error('Failed to extract URL. Raw data:', JSON.stringify(data).substring(0, 300));
      return res.status(500).json({ 
        error: 'Could not extract MP4 URL from RapidAPI response.',
        details: 'No video/mp4 stream found.'
      });
    }

    return res.json({ url: mp4Url });
  } catch (error) {
    const errorDetails = error.response ? error.response.data : error.message;
    console.error('Error fetching video from RapidAPI:', errorDetails);
    res.status(500).json({ 
        error: 'Failed to fetch video link', 
        details: errorDetails 
    });
  }
});

// Route 2: Process Video and Audio
app.post('/api/process-video', upload.single('audioBlob'), (req, res) => {
  const { videoUrl, startTime, endTime } = req.body;
  const audioFile = req.file;

  if (!videoUrl || !startTime || !endTime || !audioFile) {
    return res.status(400).json({ error: 'Missing required parameters' });
  }

  const outputFilePath = path.join(uploadDir, `output_${Date.now()}.mp4`);
  
  // Calculate duration to trim
  const duration = parseFloat(endTime) - parseFloat(startTime);

  console.log(`Starting FFmpeg process:
    Video URL: ${videoUrl}
    Start Time: ${startTime}
    Duration: ${duration}
    Audio File: ${audioFile.path}
  `);

  ffmpeg()
    // Input 1: The original video from the direct MP4 URL
    .input(videoUrl)
    .inputOptions([
        '-user_agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
        '-headers', 'Accept-Language: en-US,en;q=0.9\r\n'
    ])
    .setStartTime(startTime)
    .setDuration(duration)
    // Input 2: The user's recorded audio
    .input(audioFile.path)
    // Map video from input 0, audio from input 1
    .outputOptions([
      '-map 0:v:0',         // Use first video stream from first input
      '-map 1:a:0',         // Use first audio stream from second input
      '-c:v copy',          // Copy video codec (EXTREMELY FAST, avoids re-encoding)
      '-c:a aac',           // Encode audio to AAC for MP4 compatibility
      '-shortest'           // Finish encoding when the shortest input stream ends
    ])
    .save(outputFilePath)
    .on('end', () => {
      console.log('FFmpeg processing completed successfully.');
      
      // Send the resulting file to the client for download
      res.download(outputFilePath, 'dubbed_video.mp4', (err) => {
        if (err) {
          console.error('Error sending file to client:', err);
        }
        
        // CLEANUP: Delete temporary uploaded audio and the output video
        try {
          fs.unlinkSync(audioFile.path); // Delete uploaded audio blob
          fs.unlinkSync(outputFilePath); // Delete generated mp4
          console.log('Cleanup successful: Deleted temporary files.');
        } catch (cleanupErr) {
          console.error('Error during cleanup:', cleanupErr);
        }
      });
    })
    .on('error', (err) => {
      console.error('FFmpeg error:', err.message);
      
      // Clean up uploaded audio on failure
      try {
         if (fs.existsSync(audioFile.path)) fs.unlinkSync(audioFile.path);
      } catch (e) {
         console.error('Error cleaning up audio after failure', e);
      }
      
      res.status(500).json({ error: `Error processing video: ${err.message}` });
    });
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
