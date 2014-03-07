var WebRTC = require('webrtc');
var WildEmitter = require('wildemitter');
var webrtcSupport = require('webrtcsupport');
var attachMediaStream = require('attachmediastream');
var getScreenMedia = require('getscreenmedia');
var mockconsole = require('mockconsole');
var io = require('socket.io-client');


function SimpleWebRTC(opts) {
    var self = this;
    var options = opts || {};
    var config = this.config = {
            url: 'http://signaling.simplewebrtc.com:8888',
            debug: false,
            localVideoEl: '',
            remoteVideosEl: '',
            enableDataChannels: true,
            autoRequestMedia: false,
            autoRemoveVideos: true,
            adjustPeerVolume: true,
            peerVolumeWhenSpeaking: 0.25
        };
    var item, connection;

    // We also allow a 'logger' option. It can be any object that implements
    // log, warn, and error methods.
    // We log nothing by default, following "the rule of silence":
    // http://www.linfo.org/rule_of_silence.html
    this.logger = function () {
        // we assume that if you're in debug mode and you didn't
        // pass in a logger, you actually want to log as much as
        // possible.
        if (opts.debug) {
            return opts.logger || console;
        } else {
        // or we'll use your logger which should have its own logic
        // for output. Or we'll return the no-op.
            return opts.logger || mockconsole;
        }
    }();

    // set our config from options
    for (item in options) {
        this.config[item] = options[item];
    }

    // attach detected support for convenience
    this.capabilities = webrtcSupport;

    // call WildEmitter constructor
    WildEmitter.call(this);

    // our socket.io connection
    connection = this.connection = io.connect(this.config.url);

    connection.on('connect', function () {
        self.emit('connectionReady', connection.socket.sessionid);
        self.sessionReady = true;
        self.testReadiness();
    });

    connection.on('message', function (message) {
        var peers = self.webrtc.getPeers(message.from, message.roomType);
        var peer;

        if (message.type === 'offer') {
            if (peers.length) {
                peer = peers[0];
            } else {
                peer = self.webrtc.createPeer({
                    id: message.from,
                    type: message.roomType,
                    sharemyscreen: message.roomType === 'screen' && !message.broadcaster
                });
            }
            peer.handleMessage(message);
        } else if (peers.length) {
            peers.forEach(function (peer) {
                peer.handleMessage(message);
            });
        }
    });

    connection.on('remove', function (room) {
        if (room.id !== self.connection.socket.sessionid) {
            self.webrtc.removePeers(room.id, room.type);
        }
    });

    // instantiate our main WebRTC helper
    // using same logger from logic here
    opts.logger = this.logger;
    opts.debug = false;
    this.webrtc = new WebRTC(opts);

    // attach a few methods from underlying lib to simple.
    ['mute', 'unmute', 'pause', 'resume'].forEach(function (method) {
        self[method] = self.webrtc[method].bind(self.webrtc);
    });

    // proxy events from WebRTC
    this.webrtc.on('*', function () {
       self.emit.apply(self, arguments);
    });

    // log all events in debug mode
    if (config.debug) {
        this.on('*', this.logger.log.bind(this.logger, 'SimpleWebRTC event:'));
    }

    // check for readiness
    this.webrtc.on('localStream', function () {
       self.testReadiness();
    });

    this.webrtc.on('message', function (payload) {
       self.connection.emit('message', payload);
    });

    this.webrtc.on('peerStreamAdded', this.handlePeerStreamAdded.bind(this));
    this.webrtc.on('peerStreamRemoved', this.handlePeerStreamRemoved.bind(this));

    // echo cancellation attempts
    if (this.config.adjustPeerVolume) {
        this.webrtc.on('speaking', this.setVolumeForAll.bind(this, this.config.peerVolumeWhenSpeaking));
        this.webrtc.on('stoppedSpeaking', this.setVolumeForAll.bind(this, 1));
    }

    connection.on('stunservers', function (args) {
        // resets/overrides the config
        self.webrtc.config.peerConnectionConfig.iceServers = args;
    });
    connection.on('turnservers', function (args) {
        // appends to the config
        self.webrtc.config.peerConnectionConfig.iceServers = self.webrtc.config.peerConnectionConfig.iceServers.concat(args);
    });

    if (this.config.autoRequestMedia) this.startLocalVideo();
}


SimpleWebRTC.prototype = Object.create(WildEmitter.prototype, {
    constructor: {
        value: SimpleWebRTC
    }
});

SimpleWebRTC.prototype.leaveRoom = function () {
    if (this.roomName) {
        this.connection.emit('leave', this.roomName);
        this.webrtc.peers.forEach(function (peer) {
            peer.end();
        });
        if (this.getLocalScreen()) {
            this.stopScreenShare();
        }
        this.emit('leftRoom', this.roomName);
    }
};

SimpleWebRTC.prototype.handlePeerStreamAdded = function (peer) {
    var container = this.getRemoteVideoContainer();
    var video = attachMediaStream(peer.stream);

    // store video element as part of peer for easy removal
    peer.videoEl = video;
    video.id = this.getDomId(peer);

    if (container) container.appendChild(video);

    this.emit('videoAdded', video, peer);
};

SimpleWebRTC.prototype.handlePeerStreamRemoved = function (peer) {
    var container = this.getRemoteVideoContainer();
    var videoEl = peer.videoEl;
    if (this.config.autoRemoveVideos && container && videoEl) {
        container.removeChild(videoEl);
    }
    if (videoEl) this.emit('videoRemoved', videoEl, peer);
};

SimpleWebRTC.prototype.getDomId = function (peer) {
    return [peer.id, peer.type, peer.broadcaster ? 'broadcasting' : 'incoming'].join('_');
};

// set volume on video tag for all peers takse a value between 0 and 1
SimpleWebRTC.prototype.setVolumeForAll = function (volume) {
    this.webrtc.peers.forEach(function (peer) {
        if (peer.videoEl) peer.videoEl.volume = volume;
    });
};

SimpleWebRTC.prototype.joinRoom = function (name, cb) {
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
                        peer = self.webrtc.createPeer({
                            id: id,
                            type: type
                        });
                        peer.start();
                    }
                }
            }
        }

        if (cb) cb(err, roomDescription);
        self.emit('joinedRoom', name);
    });
};

SimpleWebRTC.prototype.getEl = function (idOrEl) {
    if (typeof idOrEl === 'string') {
        return document.getElementById(idOrEl);
    } else {
        return idOrEl;
    }
};

SimpleWebRTC.prototype.startLocalVideo = function () {
    var self = this;
    this.webrtc.startLocalMedia(null, function (err, stream) {
        if (err) {
            self.emit(err);
        } else {
            attachMediaStream(stream, self.getLocalVideoContainer(), {muted: true, mirror: true});
        }
    });
};

SimpleWebRTC.prototype.stopLocalVideo = function () {
    this.webrtc.stopLocalMedia();
};

// this accepts either element ID or element
// and either the video tag itself or a container
// that will be used to put the video tag into.
SimpleWebRTC.prototype.getLocalVideoContainer = function () {
    var el = this.getEl(this.config.localVideoEl);
    if (el && el.tagName === 'VIDEO') {
        return el;
    } else if (el) {
        var video = document.createElement('video');
        video.oncontextmenu = function () { return false; };
        el.appendChild(video);
        return video;
    } else {
        return;
    }
};

SimpleWebRTC.prototype.getRemoteVideoContainer = function () {
    return this.getEl(this.config.remoteVideosEl);
};

SimpleWebRTC.prototype.shareScreen = function (cb) {
    var self = this,
        peer;
    getScreenMedia(function (err, stream) {
        var item,
            el = document.createElement('video'),
            container = self.getRemoteVideoContainer();

        el.oncontextmenu = function () { return false; };
        if (!err) {
            self.webrtc.localScreen = stream;
            el.id = 'localScreen';
            attachMediaStream(stream, el);
            if (container) {
                container.appendChild(el);
            }

            // TODO: Once this chrome bug is fixed:
            // https://code.google.com/p/chromium/issues/detail?id=227485
            // we need to listen for the screenshare stream ending and call
            // the "stopScreenShare" method to clean things up.
            stream.onended = function () {
                self.emit('localScreenRemoved', el);
                self.stopScreenShare();
            };

            self.emit('localScreenAdded', el);
            self.connection.emit('shareScreen');
            self.webrtc.peers.forEach(function (existingPeer) {
                var peer;
                if (existingPeer.type === 'video') {
                    peer = self.webrtc.createPeer({
                        id: existingPeer.id,
                        type: 'screen',
                        sharemyscreen: true,
                        broadcaster: self.connection.socket.sessionid
                    });
                    peer.start();
                }
            });
        } else {
            self.emit(err);
        }

        // enable the callback
        if (cb) cb(err, stream);
    });
};

SimpleWebRTC.prototype.getLocalScreen = function () {
    return this.webrtc.localScreen;
};

SimpleWebRTC.prototype.stopScreenShare = function () {
    this.connection.emit('unshareScreen');
    var videoEl = document.getElementById('localScreen');
    var container = this.getRemoteVideoContainer();
    var stream = this.getLocalScreen();

    if (this.config.autoRemoveVideos && container && videoEl) {
        container.removeChild(videoEl);
    }

    // a hack to emit the event the removes the video
    // element that we want
    if (videoEl) this.emit('videoRemoved', videoEl);
    if (stream) stream.stop();
    this.webrtc.peers.forEach(function (peer) {
        if (peer.broadcaster) {
            peer.end();
        }
    });
    delete this.webrtc.localScreen;
};

SimpleWebRTC.prototype.testReadiness = function () {
    var self = this;
    if (this.webrtc.localStream && this.sessionReady) {
        // This timeout is a workaround for the strange no-audio bug
        // as described here: https://code.google.com/p/webrtc/issues/detail?id=1525
        // remove timeout when this is fixed.
        setTimeout(function () {
            self.emit('readyToCall', self.connection.socket.sessionid);
        }, 1000);
    }
};

SimpleWebRTC.prototype.createRoom = function (name, cb) {
    if (arguments.length === 2) {
        this.connection.emit('create', name, cb);
    } else {
        this.connection.emit('create', name);
    }
};

SimpleWebRTC.prototype.sendFile = function () {
    if (!webrtcSupport.dataChannel) {
        return this.emit('error', new Error('DataChannelNotSupported'));
    }

};

module.exports = SimpleWebRTC;
