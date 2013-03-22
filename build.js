var request = require('request'),
    fs = require('fs'),
    uglify = require('uglify-js');

var source = fs.readFileSync('simplewebrtc.js').toString();

request.get('http://signaling.simplewebrtc.com:8888/socket.io/socket.io.js', function (err, res, body) {
    if (!err && body && body.length) {
        fs.writeFile('latest.js', uglify.minify(source + body, {fromString: true}).code, function (err) {
            if (err) throw err;
        });
    }
});
