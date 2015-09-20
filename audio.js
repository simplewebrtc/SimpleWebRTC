// grab the room from the URL
var room = location.search && location.search.split('?')[1];

var nick;
var avatar;
var hasCameras = false;

var webrtc = new SimpleWebRTC({
    url: 'https://api.talky.io', // this will only work from simplewebrtc.com, please use the default sandbox otherwise
    // we don't do video
    localVideoEl: '',
    remoteVideosEl: '',
    autoRequestMedia: false,
    enableDataChannels: false,
    media: {
        audio: true,
        video: false
    },
    receiveMedia: { // FIXME: remove old chrome <= 37 constraints format
        mandatory: {
            OfferToReceiveAudio: true,
            OfferToReceiveVideo: false
        }
    },
});

webrtc.on('localStream', function(stream) {
    var localAudio = document.getElementById('localAudio');
    localAudio.disabled = false;
    localAudio.volume = 0;
    //localAudio.srcObject = stream; 
    if (hasCameras) {
        document.querySelector('.local-controls').style.visibility = 'visible';
    }

    var track = stream.getAudioTracks()[0];
    var btn = document.querySelector('.local .button-mute');
    btn.onclick = function() {
        track.enabled = !track.enabled;
        btn.className = 'button button-small button-mute' + (track.enabled ? '' : ' muted');
    };
});

webrtc.on('readyToCall', function () {
    if (room) {
        webrtc.joinRoom(room, function (err, res) {
            if (err) return;
            window.setTimeout(function () {
                if (avatar) {
                    webrtc.sendToAll('avatar', {avatar: avatar});
                }
                if (nick) {
                    webrtc.sendToAll('nickname', {nick: nickname});
                }
            }, 1000);
        });
    }
});

// working around weird simplewebrtc behaviour
webrtc.on('videoAdded', function (video, peer) {
    document.querySelector('#container_' + webrtc.getDomId(peer) + '>div.remote-details').appendChild(video);
});
// called when a peer is created
webrtc.on('createdPeer', function (peer) {
    var remotes = document.getElementById('remotes');
    if (!remotes) return;

    var container = document.createElement('div');
    container.className = 'peerContainer';
    container.id = 'container_' + webrtc.getDomId(peer);

    // inner container
    var d = document.createElement('div');
    d.className = 'remote-details';
    container.appendChild(d);

    // nickname
    var nickname = document.createElement('div');
    nickname.className = 'nick';
    d.appendChild(nickname);

    // avatar image
    var avatar = document.createElement('img');
    avatar.className = 'avatar';
    d.appendChild(avatar);

    // audio element
    // inserted later

    // mute button
    var mute = document.createElement('a');
    mute.className = 'button button-small button-mute';
    mute.appendChild(document.createTextNode('Mute'));
    mute.style.visibility = 'hidden';
    d.appendChild(mute);

    mute.onclick = function() {
      if (peer.videoEl.muted) { // unmute
        mute.className = 'button button-small button-mute';
      } else { // mute
        mute.className = 'button button-small button-mute muted';
      }
      peer.videoEl.muted = !peer.videoEl.muted;
    }

    if (peer && peer.pc) {
        peer.pc.on('iceConnectionStateChange', function (event) {
            var state = peer.pc.iceConnectionState;
            container.className = 'peerContainer p2p' +
                state.substr(0, 1).toUpperCase() +
                state.substr(1);
            switch (state) {
            case 'connected':
            case 'completed':
                //audio.srcObject = peer.stream;
                mute.style.visibility = 'visible';
                break;
            case 'closed':
                container.remove();
                break;
            }
        });
    }
    remotes.appendChild(container);
});

webrtc.connection.on('message', function (message) {
    var peers = self.webrtc.getPeers(message.from, message.roomType);
    if (!peers && peers.length > 0) return;
    var peer = peers[0];

    // FIXME: also send current avatar and nick to newly joining participants
    var container = document.getElementById('container_' + webrtc.getDomId(peer));
    if (message.type === 'nickname') {
        container.querySelector('.nick').innerText = message.payload.nick;
    } else if (message.type === 'avatar') {
        container.querySelector('.avatar').src = message.payload.avatar;
    } else if (message.type === 'offer') {
        // update things
        if (nick) {
            peer.send('nickname', {nick: nick});
        }
        if (avatar) {
            peer.send('avatar', {avatar: avatar});
        }
    }
});

// local p2p/ice failure
webrtc.on('iceFailed', function (peer) {
    var connstate = document.querySelector('#container_' + webrtc.getDomId(peer) + ' .connectionstate');
    console.log('local fail', connstate);
    if (connstate) {
        connstate.innerText = 'Connection failed.';
    }
});

// remote p2p/ice failure
webrtc.on('connectivityError', function (peer) {
    var connstate = document.querySelector('#container_' + webrtc.getDomId(peer) + ' .connectionstate');
    console.log('remote fail', connstate);
    if (connstate) {
        connstate.innerText = 'Connection failed.';
    }
});

function setRoom(name) {
    document.querySelector('form#createRoom').remove();
    document.getElementById('title').innerText = 'Room: ' + name;
    document.getElementById('subTitle').innerText =  'Link to join: ' + location.href;
}

function generateRoomName() {
    var adjectives = ['autumn', 'hidden', 'bitter', 'misty', 'silent', 'empty', 'dry', 'dark', 'summer', 'icy', 'delicate', 'quiet', 'white', 'cool', 'spring', 'winter', 'patient', 'twilight', 'dawn', 'crimson', 'wispy', 'weathered', 'blue', 'billowing', 'broken', 'cold', 'falling', 'frosty', 'green', 'long', 'late', 'lingering', 'bold', 'little', 'morning', 'muddy', 'old', 'red', 'rough', 'still', 'small', 'sparkling', 'shy', 'wandering', 'withered', 'wild', 'black', 'young', 'holy', 'solitary', 'fragrant', 'aged', 'snowy', 'proud', 'floral', 'restless', 'divine', 'polished', 'ancient', 'purple', 'lively', 'nameless'];

    var nouns = ['waterfall', 'river', 'breeze', 'moon', 'rain', 'wind', 'sea', 'morning', 'snow', 'lake', 'sunset', 'pine', 'shadow', 'leaf', 'dawn', 'glitter', 'forest', 'hill', 'cloud', 'meadow', 'sun', 'glade', 'bird', 'brook', 'butterfly', 'bush', 'dew', 'dust', 'field', 'fire', 'flower', 'firefly', 'feather', 'grass', 'haze', 'mountain', 'night', 'pond', 'darkness', 'snowflake', 'silence', 'sound', 'sky', 'shape', 'surf', 'thunder', 'violet', 'water', 'wildflower', 'wave', 'water', 'resonance', 'sun', 'wood', 'dream', 'cherry', 'tree', 'fog', 'frost', 'voice', 'paper', 'frog', 'smoke', 'star'];

    var verbs = ['shakes', 'drifts', 'has stopped', 'struggles', 'hears', 'has passed', 'sleeps', 'creeps', 'flutters', 'fades', 'is falling', 'trickles', 'murmurs', 'warms', 'hides', 'jumps', 'is dreaming', 'sleeps', 'falls', 'wanders', 'waits', 'has risen', 'stands', 'dying', 'is drawing', 'singing', 'rises', 'paints', 'capturing', 'flying', 'lies', 'picked up', 'gathers in', 'invites', 'separates', 'eats', 'plants', 'digs into', 'has fallen', 'weeping', 'facing', 'mourns', 'tastes', 'breaking', 'shaking', 'walks', 'builds', 'reveals', 'piercing', 'craves', 'departing', 'opens', 'falling', 'confronts', 'keeps', 'breaking', 'is floating', 'settles', 'reaches', 'illuminates', 'closes', 'leaves', 'explodes', 'drawing'];

    var preps = ['on', 'beside', 'in', 'beneath', 'above', 'under', 'by', 'over', 'against', 'near'];

    var random = function (arr) {
        return arr[Math.floor(Math.random()*arr.length)];
    };

    var prep = random(preps);
    var adjective = random(adjectives);
    var noun = random(nouns);
    return [
        prep,
        'a',
        adjective,
        noun
    ].join('-')
     .replace(/\s/g, '-')
     .replace(/-a-(a|e|i|o|u)/, '-an-$1');
}

function getSnapshot() {
    return new Promise(function (resolve, reject) {
        navigator.mediaDevices.getUserMedia({video:{width: 320, height:240}})
        .then(function (stream) {
            // UX: takes snapshot after 2 seconds.
            var img = document.getElementById('snapshot');
            theStream = stream;
            var canvasEl = document.createElement('canvas');
            var video = document.getElementById('snapshotvideo');
            video.srcObject = stream;
            video.autoplay = true;
            video.onloadeddata = function() {
                img.style.display = 'none';
                video.style.display = 'block';
                // wait 2 seconds
                window.setTimeout(function() {
                    var w = 320;
                    var h = 240;
                    canvasEl.width = w;
                    canvasEl.height = h;
                    var context = canvasEl.getContext('2d');

                    context.fillRect(0, 0, w, h);
                    context.translate(w/2, h/2);
                    context.scale(-1, 1);
                    context.translate(w/-2, h/-2);
                    context.drawImage(
                        video,
                        0, 0, w, h
                    );
                    img.style.display = 'block';
                    video.style.display = 'none';
                    stream.getTracks().forEach(function(track) {
                        track.stop();
                    });
                    var url = canvasEl.toDataURL('image/jpg');
                    var data = url.match(/data:([^;]*);(base64)?,([0-9A-Za-z+/]+)/);
                    resolve(url);
                }, 2000);
            };
        })
        .catch(reject);
    });
}

// if we have a camera, we can use it to take a snapshot
// should happen on a button click
document.getElementById('snapshotButton').onclick = function() {
    var p;
    p = getSnapshot();
    p.then(function (dataurl) {
       document.getElementById('snapshot').src = dataurl;
       avatar = dataurl;
       webrtc.sendToAll('avatar', {avatar: avatar});
        document.querySelector('.local-controls').style.visibility = 'hidden';
   })
   .catch(function (err) {
   });
};

// update nickname
document.getElementById('nickInput').onkeydown = function(e) {
    if (e.keyCode !== 13) return;
    var el = document.getElementById('nickInput');
    el.disabled = true;
    nick = el.value;
    nick = nick.toLowerCase().replace(/\s/g, '-').replace(/[^A-Za-z0-9_\-]/g, '');
    webrtc.sendToAll('nickname', {nick: nick});
    return false;
};

if (room) {
    setRoom(room);
} else {
    document.getElementById('sessionInput').disabled = false;
    document.getElementById('sessionInput').value = generateRoomName();
    document.querySelector('form#createRoom>button').disabled = false;
    document.getElementById('createRoom').onsubmit = function () {
        console.log('create room...');
        room = document.getElementById('sessionInput').value;
        room = room.toLowerCase().replace(/\s/g, '-').replace(/[^A-Za-z0-9_\-]/g, '');
        webrtc.startLocalVideo();
        webrtc.createRoom(room, function (err, name) {
            console.log('create room cb', arguments);
        
            var newUrl = location.pathname + '?' + room;
            if (!err) {
                history.replaceState({foo: 'bar'}, null, newUrl);
                setRoom(room);
            } else {
                console.log(err);
            }
        });
        return false; 
    };
}

if (navigator && navigator.mediaDevices && navigator.mediaDevices.enumerateDevices) {
    navigator.mediaDevices.enumerateDevices()
    .then(function (devices) {
        var cameras = devices.filter(function(device) { return device.kind === 'videoinput'; });
        hasCameras = cameras.length;
        var mics = devices.filter(function(device) { return device.kind === 'audioinput'; });
        if (mics.length) {
            // do we want a button the user has to click before this happens?
            if (room) webrtc.startLocalVideo();
        } else {
            console.log('no microphones');
            // FIXME: show error
        }
    });
} else {
    // FIXME: show "sorry, get a modern browser" (recommending Edge)
}

