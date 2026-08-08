const https = require('https');

const data = JSON.stringify({
  url: "https://www.youtube.com/watch?v=jNQXAC9IVRw",
  vQuality: "720"
});

const options = {
  hostname: 'co.wuk.sh',
  path: '/api/json',
  method: 'POST',
  headers: {
    'Accept': 'application/json',
    'Content-Type': 'application/json',
    'Content-Length': data.length
  }
};

const req = https.request(options, (res) => {
  let resData = '';
  res.on('data', chunk => { resData += chunk; });
  res.on('end', () => {
    console.log(resData);
  });
});

req.on('error', e => console.error(e));
req.write(data);
req.end();
