var webrtc = require('webrtcsupport');
var getUserMedia = require('getusermedia');
var getScreenMedia = require('getscreenmedia');
var attachMediaStream = require('attachmediastream');
var PeerConnection = require('rtcpeerconnection');
var WildEmitter = require('wildemitter');
var hark = require('hark');
var log;


function WebRTC(opts) {
    var self = this,
        options = opts || {},
        config = this.config = {
            url: 'http://signaling.simplewebrtc.com:8888',
            log: false,
            localVideoEl: '',
            remoteVideosEl: '',
            autoRequestMedia: false,
            autoRemoveVideos: true,
            // makes the entire PC config overridable
            peerConnectionConfig: {
                iceServers: webrtc.prefix == 'moz' ? [{"url":"stun:124.124.124.2"}] : [{"url": "stun:stun.l.google.com:19302"}]
            },
            peerConnectionContraints: {
                optional: [{"DtlsSrtpKeyAgreement": true}]
            },
            media: {
                audio: true,
                video: true
            }
        },
        item,
        connection;

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

    // our socket.io connection
    connection = this.connection = io.connect(this.config.url);

    connection.on('connect', function () {
        self.emit('ready', connection.socket.sessionid);
        self.sessionReady = true;
        self.testReadiness();
    });

    connection.on('message', function (message) {
        var peers = self.getPeers(message.from, message.roomType),
            peer;

        if (message.type === 'offer') {
            peer = self.createPeer({
                id: message.from,
                type: message.roomType,
                sharemyscreen: message.roomType === 'screen' && !message.broadcaster
            });
            peer.handleMessage(message);
        } else if (peers.length) {
            peers.forEach(function (peer) {
                peer.handleMessage(message);
            });
        }
    });

    connection.on('remove', function (room) {
        if (room.id !== self.connection.socket.sessionid) {
            self.removeForPeerSession(room.id, room.type);
        }
    });

    WildEmitter.call(this);

    // log events
    if (this.config.log) {
        this.on('*', function (event, val1, val2) {
            log('event:', event, val1, val2);
        });
    }

    // auto request if configured
    if (this.config.autoRequestMedia) this.startLocalVideo();
}

WebRTC.prototype = Object.create(WildEmitter.prototype, {
    constructor: {
        value: WebRTC
    }
});

WebRTC.prototype.getEl = function (idOrEl) {
    if (typeof idOrEl === 'string') {
        return document.getElementById(idOrEl);
    } else {
        return idOrEl;
    }
};

// this accepts either element ID or element
// and either the video tag itself or a container
// that will be used to put the video tag into.
WebRTC.prototype.getLocalVideoContainer = function () {
    var el = this.getEl(this.config.localVideoEl);
    if (el && el.tagName === 'VIDEO') {
        return el;
    } else {
        var video = document.createElement('video');
        el.appendChild(video);
        return video;
    }
};

WebRTC.prototype.getRemoteVideoContainer = function () {
    return this.getEl(this.config.remoteVideosEl);
};

WebRTC.prototype.createPeer = function (opts) {
    var peer;
    opts.parent = this;
    peer = new Peer(opts);
    this.peers.push(peer);
    return peer;
};

WebRTC.prototype.createRoom = function (name, cb) {
    if (arguments.length === 2) {
        this.connection.emit('create', name, cb);
    } else {
        this.connection.emit('create', name);
    }
};

WebRTC.prototype.joinRoom = function (name, cb) {
    var self = this;
    this.roomName = name;
    this.connection.emit('join', name, function (err, roomDescription) {
        if (err) {
            self.emit('error', err);
        } else {
            var id,
                client,
                type,
                peer;
            for (id in roomDescription.clients) {
                client = roomDescription.clients[id];
                for (type in client) {
                    if (client[type]) {
                        peer = self.createPeer({
                            id: id,
                            type: type
                        });
                        peer.start();
                    }
                }
            }
        }

        if (cb instanceof Function) cb(err, roomDescription);
    });
};

WebRTC.prototype.leaveRoom = function () {
    if (this.roomName) {
        this.connection.emit('leave', this.roomName);
        this.peers.forEach(function (peer) {
            peer.end();
        });
    }
};

WebRTC.prototype.testReadiness = function () {
    var self = this;
    if (this.localStream && this.sessionReady) {
        // This timeout is a workaround for the strange no-audio bug
        // as described here: https://code.google.com/p/webrtc/issues/detail?id=1525
        // remove timeout when this is fixed.
        setTimeout(function () {
            self.emit('readyToCall', self.connection.socket.sessionid);
        }, 1000);
    }
};

WebRTC.prototype.startLocalVideo = function (el) {
    var self = this;
    var element = el || self.getLocalVideoContainer();

    getUserMedia(function (err, stream) {
        if (err) {
            throw new Error('Failed to get access to local media.');
        } else {
            attachMediaStream(element, stream);
            element.muted = true;
            self.setupAudioMonitor(stream);
            self.localStream = self.setupMicVolumeControl(stream);
            self.testReadiness();

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

WebRTC.prototype.shareScreen = function (cb) {
    var self = this,
        peer;
    if (webrtc.screenSharing) {
        getScreenMedia(function (err, stream) {
            var item,
                el = document.createElement('video'),
                container = self.getRemoteVideoContainer();

            if (err) {
                if (cb) cb('Screen sharing failed');
                throw new Error('Failed to access to screen media.');
            } else {
                self.localScreen = stream;
                el.id = 'localScreen';
                attachMediaStream(el, stream);
                if (container) {
                    container.appendChild(el);
                }

                // TODO: Once this chrome bug is fixed:
                // https://code.google.com/p/chromium/issues/detail?id=227485
                // we need to listen for the screenshare stream ending and call
                // the "stopScreenShare" method to clean things up.

                self.emit('videoAdded', el);
                self.connection.emit('shareScreen');
                self.peers.forEach(function (existingPeer) {
                    var peer;
                    if (existingPeer.type === 'video') {
                        peer = self.createPeer({
                            id: existingPeer.id,
                            type: 'screen',
                            sharemyscreen: true
                        });
                        peer.start();
                    }
                });

                if (cb) cb();
            }
        });
    } else {
        if (cb) cb('Screen sharing not supported');
    }
};

WebRTC.prototype.stopScreenShare = function () {
    this.connection.emit('unshareScreen');
    var videoEl = document.getElementById('localScreen'),
        container = this.getRemoteVideoContainer(),
        stream = this.localScreen;

    if (this.config.autoRemoveVideos && container && videoEl) {
        container.removeChild(videoEl);

    }

    // a hack to emit the event the removes the video
    // element that we want
    if (videoEl) this.emit('videoRemoved', videoEl);
    if (this.localScreen) this.localScreen.stop();
    this.peers.forEach(function (peer) {
        if (peer.broadcaster) {
            peer.end();
        }
    });
    delete this.localScreen;
};

WebRTC.prototype.removeForPeerSession = function (id, type) {
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
    if (options.type === 'screen') {
        if (this.parent.localScreen && this.sharemyscreen) {
            log('adding local screen stream to peer connection');
            this.pc.addStream(this.parent.localScreen);
            this.broadcaster = this.parent.connection.socket.sessionid;
        }
    } else {
        this.pc.addStream(this.parent.localStream);
    }
    this.pc.on('addStream', this.handleRemoteStreamAdded.bind(this));
    this.pc.on('removeStream', this.handleStreamRemoved.bind(this));
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

Peer.prototype.send = function (type, payload) {
    log('sending', type, payload);
    this.parent.connection.emit('message', {
        to: this.id,
        broadcaster: this.broadcaster,
        roomType: this.type,
        type: type,
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
    var stream = this.stream = event.stream,
        el = document.createElement('video'),
        container = this.parent.getRemoteVideoContainer();

    el.id = this.getDomId();
    attachMediaStream(el, stream);
    if (container) container.appendChild(el);
    this.emit('videoAdded', el);
};

Peer.prototype.handleStreamRemoved = function () {
    var video = document.getElementById(this.getDomId()),
        container = this.parent.getRemoteVideoContainer();
    if (video) {
        this.emit('videoRemoved', video);
        if (container && this.parent.config.autoRemoveVideos) {
            container.removeChild(video);
        }
    }
    this.parent.peers.splice(this.parent.peers.indexOf(this), 1);
    this.closed = true;
};

Peer.prototype.getDomId = function () {
    return [this.id, this.type, this.broadcaster ? 'broadcasting' : 'incoming'].join('_');
};

// expose WebRTC
if (typeof module !== 'undefined') {
    module.exports = WebRTC;
} else {
    window.WebRTC = WebRTC;
}
