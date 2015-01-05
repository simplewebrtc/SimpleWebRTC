var bundle = require('browserify')(),
    fs = require('fs'),
    request = require('request'),
    uglify = require('uglify-js');

bundle.add('./simplewebrtc');
bundle.bundle({standalone: 'SimpleWebRTC'}, function (err, source) {
    if (err) console.error(err);
    fs.writeFileSync('simplewebrtc.bundle.js', source);
    fs.writeFile('latest.js', uglify.minify(source, {fromString: true}).code, function (err) {
        if (err) throw err;
    });
});
