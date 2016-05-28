var bundle = require('browserify')({standalone: 'SimpleWebRTC'}),
    fs = require('fs'),
    request = require('request'),
    uglify = require('uglify-js');

bundle.add('./simplewebrtc');
bundle.bundle(function (err, source) {
    if (err) console.error(err);
    fs.writeFileSync('simplewebrtc.bundle.js', source);
    fs.writeFile('latest-v2.js', uglify.minify(source.toString('utf8'), {fromString: true}).code, function (err) {
      if (err) throw err;
    });
});
