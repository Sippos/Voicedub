const ytdl = require('@distube/ytdl-core');
const ffmpeg = require('fluent-ffmpeg');

const url = 'https://www.youtube.com/watch?v=jNQXAC9IVRw'; // "Me at the zoo" (19s)

// Find best format with both video and audio
console.log('Fetching info...');
ytdl.getInfo(url).then(info => {
  const format = ytdl.chooseFormat(info.formats, { quality: 'highest', filter: 'audioandvideo' });
  console.log('Selected format:', format.container, format.resolution);
  
  const stream = ytdl.downloadFromInfo(info, { format });
  
  ffmpeg(stream)
    .setStartTime('00:00:02')
    .setDuration(3) // 3 seconds long
    .outputOptions(['-c:v copy', '-c:a copy'])
    .save('test_crop.mp4')
    .on('end', () => console.log('Crop finished!'))
    .on('error', err => console.error('FFmpeg Error:', err));
}).catch(console.error);
