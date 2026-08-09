const express = require('express');
const cors = require('cors');
const multer = require('multer');
const axios = require('axios');
const ffmpeg = require('fluent-ffmpeg');
const ffmpegStatic = require('ffmpeg-static');
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

// Set up ffmpeg path
ffmpeg.setFfmpegPath(ffmpegStatic);

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
    const rapidApiKey = process.env.RAPIDAPI_KEY;
    const rapidApiHost = process.env.RAPIDAPI_HOST;
    const rapidApiUrl = process.env.RAPIDAPI_URL; // e.g. https://youtube-media-downloader.p.rapidapi.com/v2/video/details

    if (!rapidApiKey || !rapidApiHost || !rapidApiUrl) {
      console.warn('RapidAPI config missing in .env. Returning a mock MP4 URL for testing.');
      // Fallback/mock video for local testing if API key is not configured
      return res.json({
        url: 'http://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4'
      });
    }

    // Ensure we handle the weird path from this specific API
    const response = await axios.get(rapidApiUrl, {
      params: { 
        url: youtubeUrl,
        title: "Video" // The API snippet required a title parameter
      },
      headers: {
        'Content-Type': 'application/json',
        'x-rapidapi-key': rapidApiKey,
        'x-rapidapi-host': rapidApiHost
      }
    });
    
    // Extract the MP4 URL from the response. 
    // We check common keys returned by RapidAPI services:
    const data = response.data;
    const mp4Url = data.url || data.link || data.download_url || data.download || 
                  (data[0] && data[0].url) || (data.data && data.data.url) ||
                  (data.url_video); 
    
    if (!mp4Url) {
        console.error("Unrecognized API response format:", data);
        throw new Error("Could not extract MP4 URL from RapidAPI response. Check the server logs for the raw response.");
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
      
      res.status(500).json({ error: 'Error processing video' });
    });
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
