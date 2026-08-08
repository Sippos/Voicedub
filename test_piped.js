const https = require('https');

const videoId = 'jNQXAC9IVRw'; // "Me at the zoo"
const url = `https://pipedapi.kavin.rocks/streams/${videoId}`;

https.get(url, (res) => {
  let data = '';
  res.on('data', chunk => { data += chunk; });
  res.on('end', () => {
    try {
      const json = JSON.parse(data);
      console.log('Title:', json.title);
      console.log('Duration:', json.duration);
      if (json.videoStreams) {
        const mp4 = json.videoStreams.find(s => s.mimeType === 'video/mp4' && s.videoOnly === false);
        console.log('MP4 URL:', mp4 ? mp4.url.substring(0, 50) + '...' : 'Not found');
      }
    } catch (e) {
      console.error('Error parsing JSON:', e);
      console.log('Raw response:', data.substring(0, 200));
    }
  });
}).on('error', (e) => {
  console.error('HTTP Error:', e);
});
