var bundle = require('browserify')(),
    fs = require('fs');
    request = require('request'),
    uglify = require('uglify-js');

bundle.add('./simplewebrtc');
bundle.bundle({standalone: 'WebRTC'}, function (err, source) {
    fs.writeFileSync('simplewebrtc.bundle.js', source);
    request.get('http://signaling.simplewebrtc.com:8888/socket.io/socket.io.js', function (err, res, body) {
        if (!err && body && body.length) {
            fs.writeFile('latest.js', uglify.minify(source + body, {fromString: true}).code, function (err) {
                if (err) throw err;
            });
        }
    });
});
