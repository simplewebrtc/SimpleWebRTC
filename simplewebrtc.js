var WebRTC = require('./webrtc');
var WildEmitter = require('wildemitter');
var webrtcSupport = require('webrtcsupport');
var attachMediaStream = require('attachmediastream');
var getScreenMedia = require('getscreenmedia');



function SimpleWebRTC(opts) {
	var self = this;
	var options = opts || {};
	var config = this.config = {
            url: 'http://signaling.simplewebrtc.com:8888',
            log: false,
            localVideoEl: '',
            remoteVideosEl: '',
            autoRequestMedia: false,
            autoRemoveVideos: true
        };
    var item, connection;

    // set options
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
        self.emit('ready', connection.socket.sessionid);
        self.sessionReady = true;
        self.testReadiness();
    });

    connection.on('message', function (message) {
        var peers = self.webrtc.getPeers(message.from, message.roomType);
        var peer;

        if (message.type === 'offer') {
            peer = self.webrtc.createPeer({
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
            self.webrtc.removePeers(room.id, room.type);
        }
    });

    // instantiate our main WebRTC helper
   	this.webrtc = new WebRTC(opts);

   	// proxy events from WebRTC
   	this.webrtc.on('*', function (eventname, event) {
   		var args = [].splice.call(arguments, 0, 0, eventname);
   		//self.emit.apply(self, args);
   	});

   	// check for readiness
   	this.webrtc.on('localStream', function () {
   		self.testReadiness();
   	});

   	this.webrtc.on('message', function (payload) {
   		self.connection.emit('message', payload)
   	});

   	this.webrtc.on('peerStreamAdded', this.handlePeerStreamAdded.bind(this));
   	this.webrtc.on('peerStreamRemoved', this.handlePeerStreamRemoved.bind(this));

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
        this.peers.forEach(function (peer) {
            peer.end();
        });
    }
};

SimpleWebRTC.prototype.handlePeerStreamAdded = function (peer) {
	var container = this.getRemoteVideoContainer();
	console.log("peer");
	var video = attachMediaStream(document.createElement('video'), peer.stream);
	if (container) {
		// store video element as part of peer for easy removal
		peer.videoEl = video;
		video.id = this.getDomId(peer);
		container.appendChild(video);
	}
	this.emit('videoAdded', video);
};

SimpleWebRTC.prototype.handlePeerStreamRemoved = function (peer) {
	var container = this.getRemoteVideoContainer();
	var videoEl = peer.videoEl;
	if (this.config.autoRemoveVideos && container && videoEl) {
		container.removeChild(videoEl);
	}
	if (videoEl) this.emit('videoRemoved', videoEl);
};

SimpleWebRTC.prototype.getDomId = function (peer) {
    return [peer.id, peer.type, peer.broadcaster ? 'broadcasting' : 'incoming'].join('_');
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
	this.webrtc.startLocalMedia(null, this.getLocalVideoContainer());
};

// this accepts either element ID or element
// and either the video tag itself or a container
// that will be used to put the video tag into.
SimpleWebRTC.prototype.getLocalVideoContainer = function () {
    var el = this.getEl(this.config.localVideoEl);
    if (el && el.tagName === 'VIDEO') {
        return el;
    } else {
        var video = document.createElement('video');
        el.appendChild(video);
        return video;
    }
};

SimpleWebRTC.prototype.getRemoteVideoContainer = function () {
    return this.getEl(this.config.remoteVideosEl);
};

SimpleWebRTC.prototype.shareScreen = function (cb) {
    var self = this,
        peer;
    if (webrtcSupport.screenSharing) {
        getScreenMedia(function (err, stream) {
            var item,
                el = document.createElement('video'),
                container = self.getRemoteVideoContainer();

            if (err) {
                if (cb) cb('Screen sharing failed');
                throw new Error('Failed to access to screen media.');
            } else {
                self.webrtc.localScreen = stream;
                el.id = 'localScreen';
                attachMediaStream(el, stream);
                if (container) {
                    container.appendChild(el);
                }

                // TODO: Once this chrome bug is fixed:
                // https://code.google.com/p/chromium/issues/detail?id=227485
                // we need to listen for the screenshare stream ending and call
                // the "stopScreenShare" method to clean things up.

                self.webrtc.emit('peerStreamAdded', {stream: stream});
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

                if (cb) cb();
            }
        });
    } else {
        if (cb) cb('Screen sharing not supported');
    }
};

SimpleWebRTC.prototype.stopScreenShare = function () {
    this.connection.emit('unshareScreen');
    var videoEl = document.getElementById('localScreen'),
        container = this.getRemoteVideoContainer(),
        stream = this.localScreen;

    if (this.config.autoRemoveVideos && container && videoEl) {
        container.removeChild(videoEl);
    }

    // a hack to emit the event the removes the video
    // element that we want
    if (videoEl) this.webrtc.emit('peerStreamRemoved', videoEl);
    if (this.localScreen) this.localScreen.stop();
    this.peers.forEach(function (peer) {
        if (peer.broadcaster) {
            peer.end();
        }
    });
    delete this.localScreen;
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

module.exports = SimpleWebRTC;
