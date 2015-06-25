var WebRTC = require('./webrtc');
var WildEmitter = require('wildemitter');
var webrtcSupport = require('webrtcsupport');
var attachMediaStream = require('attachmediastream');
var mockconsole = require('mockconsole');
var SOCKET_STATES = {
    CONNECTING : 0,
        OPEN: 1,
        CLOSING: 2,
        CLOSED: 3
};

function SimpleWebRTC(opts, roomName) {
    var self = this;
    var room = roomName;
    var options = opts || {};
    var config = this.config = {
            url: 'https://signaling.simplewebrtc.com:443/',
            wsUrl: 'ws://135.55.22.67:9727',
            ////socketio: {/* 'force new connection':true*/},
            connection: null,
            debug: false,
            localVideoEl: '',
            remoteVideosEl: '',
            enableDataChannels: true,
            autoRequestMedia: false,
            autoRemoveVideos: true,
            adjustPeerVolume: true,
            peerVolumeWhenSpeaking: 0.25,
            media: {
                video: true,
                audio: true
            },
            receiveMedia: { // FIXME: remove old chrome <= 37 constraints format
                mandatory: {
                    OfferToReceiveAudio: true,
                    OfferToReceiveVideo: true
                }
            },
            localVideo: {
                autoplay: true,
                mirror: true,
                muted: true
            }
        };
    var item;

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

    // create default SocketIoConnection if it's not passed in
    if (self.config.connection === null) {
        self.connection = new WebSocket(config.wsUrl + "/ws/" + room);
        self.connection.onopen = function(){
            console.log('Socket open! Sending message to authenticate!');
        };

        self.connection.onerror = function(err){
            console.log("Socket error occured");
        };

        self.connection.onclose = function(){
            console.log("Socket is closed!");
        };

        self.connection.onConnect = function (data) {
            if(data.stunservers){
                self.webrtc.config.peerConnectionConfig.iceServers = data.stunservers;
                self.emit('stunservers', data.stunservers);
            }
            if(data.turnservers){
                self.webrtc.config.peerConnectionConfig.iceServers = self.webrtc.config.peerConnectionConfig.iceServers.concat(data.turnservers);
                self.emit('turnservers', data.turnservers);
            }

            self.connection.sessionid = data.sessionid;
            self.emit('connectionReady', data.sessionid);
            self.sessionReady = true;
            self.testReadiness();
        };

        self.connection.onMessage = function (data) {
            var peers = self.webrtc.getPeers(data.from, data.roomType);
            var peer;

            if (data.type === 'offer') {
                if (peers.length) {
                    peers.forEach(function (p) {
                        if (p.sid == data.sid) peer = p;
                    });
                    //if (!peer) peer = peers[0]; // fallback for old protocol versions
                }
                if (!peer) {
                    peer = self.webrtc.createPeer({
                        id: data.from,
                        sid: data.sid,
                        type: data.roomType,
                        enableDataChannels: self.config.enableDataChannels && data.roomType !== 'screen',
                        sharemyscreen: data.roomType === 'screen' && !data.broadcaster,
                        broadcaster: data.roomType === 'screen' && !data.broadcaster ? self.connection.sessionid : null
                    });
                    self.emit('createdPeer', peer);
                }
                peer.handleMessage(data);
            } else if (peers.length) {
                peers.forEach(function (peer) {
                    if (data.sid) {
                        if (peer.sid === data.sid) {
                            peer.handleMessage(data);
                        }
                    } else {
                        peer.handleMessage(data);
                    }
                });
            }
        };

        self.connection.onRemove =  function (pr) {
            if (pr.id !== self.connection.sessionid) {
                self.webrtc.removePeers(pr.id, pr.type);
            }
        };

        self.connection.onJoin = function(data){
            var roomDescription = data.roomDescription;
            var err = data.err;
            if (err) {
                self.emit('error', err);
            } else if(roomDescription) {
                var id,
                    client,
                    type,
                    peer;
                for (id in roomDescription) {
                    client = roomDescription[id];
                    for (type in client) {
                        if (client[type]) {
                            peer = self.webrtc.createPeer({
                                id: id,
                                type: type,
                                enableDataChannels: self.config.enableDataChannels && type !== 'screen',
                                receiveMedia: {
                                    mandatory: {
                                        OfferToReceiveAudio: type !== 'screen' && self.config.receiveMedia.mandatory.OfferToReceiveAudio,
                                        OfferToReceiveVideo: self.config.receiveMedia.mandatory.OfferToReceiveVideo
                                    }
                                }
                            });
                            self.emit('createdPeer', peer);
                            peer.start();
                        }
                    }
                }
            }

            if (self.joinCb) self.joinCb(err, roomDescription);
            self.emit('joinedRoom', name);
        };

        self.connection.disconnect = function(){
            self.connection.emit('disconnect');
            self.connection.close();
            self.connection = null;
        };

        self.connection.emit = function(event, payload){
            if(self.connection){
                if(self.connection.readyState === SOCKET_STATES.OPEN){
                    var msg = {event: event};
                    if(payload) msg.data = payload;
                    try{
                        self.connection.send(JSON.stringify(msg));
                    }catch (ex){
                        console.log('Connection send exeption');
                        console.log(ex);
                    }
                }else alert('Not connected to Snap Engage server, should reconnect here');
            }else alert('Not connected to Snap Engage server, should reconnect here');
        };

        self.connection.onmessage = function(socketMsg){
            console.log("Raw message received:");
            //console.log(socketMsg.data);
            var msg = JSON.parse(socketMsg.data);
            switch (msg.event){
                case 'message':
                    self.connection.onMessage(msg.data);
                    break;
                case 'connect':  //TODO: Add data:{sessionid : xxx} to connection message
                    self.connection.onConnect(msg.data);
                    break;
                case 'remove':
                    self.connection.onRemove(msg.data);
                    break;
                case '_join':
                    self.connection.onJoin(msg.data);
                    break;
                default : console.log("Unknown socket event");
            }
        };
    } else {
        connection = this.connection = this.config.connection;
    }

    // instantiate our main WebRTC helper
    // using same logger from logic here
    opts.logger = this.logger;
    opts.debug = false;
    this.webrtc = new WebRTC(opts);

    // attach a few methods from underlying lib to simple.
    ['mute', 'unmute', 'pauseVideo', 'resumeVideo', 'pause', 'resume', 'sendToAll', 'sendDirectlyToAll', 'getPeers'].forEach(function (method) {
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

    this.webrtc.on('iceFailed', function (peer) {
        // local ice failure
        console.log("Local ICE failure for peer:");
        console.log(peer);
    });
    this.webrtc.on('connectivityError', function (peer) {
        // remote ice failure
        console.log("Remote ICE failure for peer:");
        console.log(peer);
    });


    // sending mute/unmute to all peers
    this.webrtc.on('audioOn', function () {
        self.webrtc.sendToAll('unmute', {name: 'audio'});
    });
    this.webrtc.on('audioOff', function () {
        self.webrtc.sendToAll('mute', {name: 'audio'});
    });
    this.webrtc.on('videoOn', function () {
        self.webrtc.sendToAll('unmute', {name: 'video'});
    });
    this.webrtc.on('videoOff', function () {
        self.webrtc.sendToAll('mute', {name: 'video'});
    });

    // screensharing events
    this.webrtc.on('localScreen', function (stream) {
        var item,
            el = document.createElement('video'),
            container = self.getRemoteVideoContainer();

        el.oncontextmenu = function () { return false; };
        el.id = 'localScreen';
        attachMediaStream(stream, el);
        if (container) {
            container.appendChild(el);
        }

        self.emit('localScreenAdded', el);
        self.connection.emit('shareScreen');

        self.webrtc.peers.forEach(function (existingPeer) {
            var peer;
            if (existingPeer.type === 'video') {
                peer = self.webrtc.createPeer({
                    id: existingPeer.id,
                    type: 'screen',
                    sharemyscreen: true,
                    enableDataChannels: false,
                    receiveMedia: {
                        mandatory: {
                            OfferToReceiveAudio: false,
                            OfferToReceiveVideo: false
                        }
                    },
                    broadcaster: self.connection.sessionid
                });
                self.emit('createdPeer', peer);
                peer.start();
            }
        });
    });
    this.webrtc.on('localScreenStopped', function (stream) {
        self.stopScreenShare();
    });

    this.webrtc.on('channelMessage', function (peer, label, data) {
        if (data.type == 'volume') {
            self.emit('remoteVolumeChange', peer, data.volume);
        }
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
        this.connection.emit('leave');
        this.webrtc.peers.forEach(function (peer) {
            peer.end();
        });
        if (this.getLocalScreen()) {
            this.stopScreenShare();
        }
        this.emit('leftRoom', this.roomName);
        this.roomName = undefined;
    }
};

SimpleWebRTC.prototype.disconnect = function () {
    this.connection.disconnect();
    delete this.connection;
};

SimpleWebRTC.prototype.handlePeerStreamAdded = function (peer) {
    var self = this;
    var container = this.getRemoteVideoContainer();
    var video = attachMediaStream(peer.stream);

    // store video element as part of peer for easy removal
    peer.videoEl = video;
    video.id = this.getDomId(peer);

    if (container) container.appendChild(video);

    this.emit('videoAdded', video, peer);

    // send our mute status to new peer if we're muted
    // currently called with a small delay because it arrives before
    // the video element is created otherwise (which happens after
    // the async setRemoteDescription-createAnswer)
    window.setTimeout(function () {
        if (!self.webrtc.isAudioEnabled()) {
            peer.send('mute', {name: 'audio'});
        }
        if (!self.webrtc.isVideoEnabled()) {
            peer.send('mute', {name: 'video'});
        }
    }, 250);
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
    this.roomName = name;
    if(cb) this.joinCb = cb;
    else this.joinCb = null;

    this.connection.emit('join', name);
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
    this.webrtc.startLocalMedia(this.config.media, function (err, stream) {
        if (err) {
            self.emit('localMediaError', err);
        } else {
            attachMediaStream(stream, self.getLocalVideoContainer(), self.config.localVideo);
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
        el.oncontextmenu = function () { return false; };
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
    this.webrtc.startScreenShare(cb);
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
    //delete this.webrtc.localScreen;
};

SimpleWebRTC.prototype.testReadiness = function () {
    var self = this;
    if (this.webrtc.localStream && this.sessionReady) {
        self.emit('readyToCall', self.connection.sessionid);
    }
};

/**
 * Unnecessary because we are not creating room
 *
SimpleWebRTC.prototype.createRoom = function (name, cb) {
    if (arguments.length === 2) {
        this.connection.emit('create', name, cb);
    } else {
        this.connection.emit('create', name);
    }
};*/

SimpleWebRTC.prototype.sendFile = function () {
    if (!webrtcSupport.dataChannel) {
        return this.emit('error', new Error('DataChannelNotSupported'));
    }

};

module.exports = SimpleWebRTC;
