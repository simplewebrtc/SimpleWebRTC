var webrtc = require('webrtcsupport');
var getUserMedia = require('getusermedia');
var attachMediaStream = require('attachmediastream');
var PeerConnection = require('rtcpeerconnection');
var WildEmitter = require('wildemitter');
var hark = require('hark');
var log;


function WebRTC(opts) {
    var self = this;
    var options = opts || {};
    var config = this.config = {
            log: false,
            localVideoEl: '',
            remoteVideosEl: '',
            autoRequestMedia: false,
            // makes the entire PC config overridable
            peerConnectionConfig: {
                iceServers: [{"url": "stun:stun.l.google.com:19302"}]
            },
            peerConnectionContraints: {
                optional: [{"DtlsSrtpKeyAgreement": true}]
            },
            media: {
                audio: true,
                video: true
            }
        };
    var item, connection;

    // check for support
    if (!webrtc.support) {
        console.error('Your browser doesn\'t seem to support WebRTC');
    }

    // expose screensharing check
    this.screenSharingSupport = webrtc.screenSharing;

    // set options
    for (item in options) {
        this.config[item] = options[item];
    }

    // log if configured to
    log = (this.config.log) ? console.log.bind(console) : function () {};

    // where we'll store our peer connections
    this.peers = [];

    WildEmitter.call(this);

    // log events
    if (this.config.log) {
        this.on('*', function (event, val1, val2) {
            log('event:', event, val1, val2);
        });
    }
}

WebRTC.prototype = Object.create(WildEmitter.prototype, {
    constructor: {
        value: WebRTC
    }
});

WebRTC.prototype.createPeer = function (opts) {
    var peer;
    opts.parent = this;
    peer = new Peer(opts);
    this.peers.push(peer);
    return peer;
};

WebRTC.prototype.startLocalMedia = function (mediaConstraints, el) {
    var self = this;
    var constraints = mediaConstraints || {video: true, audio: true};

    getUserMedia(constraints, function (err, stream) {
        if (err) {
            throw new Error('Failed to get access to local media.');
        } else {
            if (constraints.audio) {
                self.setupAudioMonitor(stream);
            }
            self.localStream = self.setupMicVolumeControl(stream);

            if (el) {
                attachMediaStream(el, stream);
                el.muted = true;
            }

            self.emit('localStream', stream);

            // start out somewhat muted if we can track audio
            self.setMicVolume(0.5);
        }
    });
};

// Audio controls
WebRTC.prototype.mute = function () {
    this._audioEnabled(false);
    this.hardMuted = true;
    this.emit('audioOff');
};
WebRTC.prototype.unmute = function () {
    this._audioEnabled(true);
    this.hardMuted = false;
    this.emit('audioOn');
};

// Audio monitor
WebRTC.prototype.setupAudioMonitor = function (stream) {
    // disable for now:
    //return;

    log('Setup audio');
    var audio = hark(stream),
        self = this,
        timeout;
    audio.on('speaking', function() {
        if (self.hardMuted) return;
        self.setMicVolume(1);
        self.sendToAll('speaking', {});
    });

    audio.on('stopped_speaking', function() {
        if (self.hardMuted) return;
        if (timeout) clearTimeout(timeout);

        timeout = setTimeout(function () {
            self.setMicVolume(0.5);
            self.sendToAll('stopped_speaking', {});
        }, 1000);
    });
};

WebRTC.prototype.setupMicVolumeControl = function (stream) {
    if (!webrtc.webAudio) return stream;

    var context = new webkitAudioContext();
    var microphone = context.createMediaStreamSource(stream);
    var gainFilter = this.gainFilter = context.createGainNode();
    var destination = context.createMediaStreamDestination();
    var outputStream = destination.stream;

    microphone.connect(gainFilter);
    gainFilter.connect(destination);

    stream.removeTrack(stream.getAudioTracks()[0]);
    stream.addTrack(outputStream.getAudioTracks()[0]);

    return stream;
};


WebRTC.prototype.setMicVolume = function (volume) {
    if (!webrtc.webAudio) return;
    this.gainFilter.gain.value = volume;
};

// Video controls
WebRTC.prototype.pauseVideo = function () {
    this._videoEnabled(false);
    this.emit('videoOff');
};
WebRTC.prototype.resumeVideo = function () {
    this._videoEnabled(true);
    this.emit('videoOn');
};

// Combined controls
WebRTC.prototype.pause = function () {
    this._audioEnabled(false);
    this.pauseVideo();
};
WebRTC.prototype.resume = function () {
    this._audioEnabled(true);
    this.resumeVideo();
};

// Internal methods for enabling/disabling audio/video
WebRTC.prototype._audioEnabled = function (bool) {
    // work around for chrome 27 bug where disabling tracks
    // doesn't seem to work (works in canary, remove when working)
    this.setMicVolume(bool ? 1 : 0);
    this.localStream.getAudioTracks().forEach(function (track) {
        track.enabled = !!bool;
    });
};
WebRTC.prototype._videoEnabled = function (bool) {
    this.localStream.getVideoTracks().forEach(function (track) {
        track.enabled = !!bool;
    });
};

// removes peers
WebRTC.prototype.removePeers = function (id, type) {
    this.getPeers(id, type).forEach(function (peer) {
        peer.end();
    });
};

// fetches all Peer objects by session id and/or type
WebRTC.prototype.getPeers = function (sessionId, type) {
    return this.peers.filter(function (peer) {
        return (!sessionId || peer.id === sessionId) && (!type || peer.type === type);
    });
};

// sends message to all
WebRTC.prototype.sendToAll = function (message, payload) {
    this.peers.forEach(function (peer) {
        peer.send(message, payload);
    });
};


function Peer(options) {
    var self = this;

    this.id = options.id;
    this.parent = options.parent;
    this.type = options.type || 'video';
    this.oneway = options.oneway || false;
    this.sharemyscreen = options.sharemyscreen || false;
    this.stream = options.stream;
    // Create an RTCPeerConnection via the polyfill
    this.pc = new PeerConnection(this.parent.config.peerConnectionConfig, this.parent.config.peerConnectionContraints);
    this.pc.on('ice', this.onIceCandidate.bind(this));
    this.pc.on('addStream', this.handleRemoteStreamAdded.bind(this));
    this.pc.on('removeStream', this.handleStreamRemoved.bind(this));

    // handle screensharing/broadcast mode
    if (options.type === 'screen') {
        if (this.parent.localScreen && this.sharemyscreen) {
            log('adding local screen stream to peer connection');
            this.pc.addStream(this.parent.localScreen);
            this.broadcaster = options.broadcaster;
        }
    } else {
        this.pc.addStream(this.parent.localStream);
    }

    // call emitter constructor
    WildEmitter.call(this);

    // proxy events to parent
    this.on('*', function (name, value) {
        self.parent.emit(name, value, self);
    });
}

Peer.prototype = Object.create(WildEmitter.prototype, {
    constructor: {
        value: Peer
    }
});

Peer.prototype.handleMessage = function (message) {
    var self = this;

    log('getting', message.type, message.payload);

    if (message.type === 'offer') {
        this.pc.answer(message.payload, function (err, sessionDesc) {
            self.send('answer', sessionDesc);
        });
    } else if (message.type === 'answer') {
        this.pc.handleAnswer(message.payload);
    } else if (message.type === 'candidate') {
        this.pc.processIce(message.payload);
    } else if (message.type === 'speaking') {
        this.parent.emit('speaking', {id: message.from});
    } else if (message.type === 'stopped_speaking') {
        this.parent.emit('stopped_speaking', {id: message.from});
    }
};

Peer.prototype.send = function (messageType, payload) {
    log('sending', messageType, payload);
    this.parent.emit('message', {
        to: this.id,
        broadcaster: this.broadcaster,
        roomType: this.type,
        type: messageType,
        payload: payload
    });
};

Peer.prototype.onIceCandidate = function (candidate) {
    if (this.closed) return;
    if (candidate) {
        this.send('candidate', candidate);
    } else {
        log("End of candidates.");
    }
};

Peer.prototype.start = function () {
    var self = this;
    this.pc.offer(function (err, sessionDescription) {
        self.send('offer', sessionDescription);
    });
};

Peer.prototype.end = function () {
    this.pc.close();
    this.handleStreamRemoved();
};

Peer.prototype.handleRemoteStreamAdded = function (event) {
    this.stream = event.stream;
    this.parent.emit('peerStreamAdded', this);
};

Peer.prototype.handleStreamRemoved = function () {
    this.parent.peers.splice(this.parent.peers.indexOf(this), 1);
    this.closed = true;
    this.parent.emit('peerStreamRemoved', this);
};


module.exports = WebRTC;
