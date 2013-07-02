(function(e){if("function"==typeof bootstrap)bootstrap("webrtc",e);else if("object"==typeof exports)module.exports=e();else if("function"==typeof define&&define.amd)define(e);else if("undefined"!=typeof ses){if(!ses.ok())return;ses.makeWebRTC=e}else"undefined"!=typeof window?window.WebRTC=e():global.WebRTC=e()})(function(){var define,ses,bootstrap,module,exports;
return (function(e,t,n){function i(n,s){if(!t[n]){if(!e[n]){var o=typeof require=="function"&&require;if(!s&&o)return o(n,!0);if(r)return r(n,!0);throw new Error("Cannot find module '"+n+"'")}var u=t[n]={exports:{}};e[n][0].call(u.exports,function(t){var r=e[n][1][t];return i(r?r:t)},u,u.exports)}return t[n].exports}var r=typeof require=="function"&&require;for(var s=0;s<n.length;s++)i(n[s]);return i})({1:[function(require,module,exports){
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

},{"webrtcsupport":2,"getusermedia":3,"attachmediastream":4,"getscreenmedia":5,"hark":6,"wildemitter":7,"rtcpeerconnection":8}],2:[function(require,module,exports){
// created by @HenrikJoreteg
var PC = window.mozRTCPeerConnection || window.webkitRTCPeerConnection || window.RTCPeerConnection;
var IceCandidate = window.mozRTCIceCandidate || window.RTCIceCandidate;
var SessionDescription = window.mozRTCSessionDescription || window.RTCSessionDescription;
var prefix = function () {
    if (window.mozRTCPeerConnection) {
        return 'moz';
    } else if (window.webkitRTCPeerConnection) {
        return 'webkit';
    }
}();
var screenSharing = navigator.userAgent.match('Chrome') && parseInt(navigator.userAgent.match(/Chrome\/(.*) /)[1], 10) >= 26;
var webAudio = !!window.webkitAudioContext;

// export support flags and constructors.prototype && PC
module.exports = {
    support: !!PC,
    dataChannel: !!(PC && PC.prototype && PC.prototype.createDataChannel),
    prefix: prefix,
    webAudio: webAudio,
    screenSharing: screenSharing,
    PeerConnection: PC,
    SessionDescription: SessionDescription,
    IceCandidate: IceCandidate
};

},{}],4:[function(require,module,exports){
module.exports = function (element, stream, play) {
    var autoPlay = (play === false) ? false : true;

    if (autoPlay) element.autoplay = true;

    // handle mozilla case
    if (window.mozGetUserMedia) {
        element.mozSrcObject = stream;
        if (autoPlay) element.play();
    } else {
        if (typeof element.srcObject !== 'undefined') {
            element.srcObject = stream;
        } else if (typeof element.mozSrcObject !== 'undefined') {
            element.mozSrcObject = stream;
        } else if (typeof element.src !== 'undefined') {
            element.src = URL.createObjectURL(stream);
        } else {
            return false;
        }
    }

    return true;
};

},{}],3:[function(require,module,exports){
// getUserMedia helper by @HenrikJoreteg
var func = (navigator.getUserMedia ||
            navigator.webkitGetUserMedia ||
            navigator.mozGetUserMedia ||
            navigator.msGetUserMedia);


module.exports = function (contstraints, cb) {
    var options;
    var haveOpts = arguments.length === 2;
    var defaultOpts = {video: true, audio: true};

    // make contstraints optional
    if (!haveOpts) {
        cb = contstraints;
        contstraints = defaultOpts;
    }

    // treat lack of browser support like an error
    if (!func) return cb(new Error('notSupported'));

    func.call(navigator, contstraints, function (stream) {
        cb(null, stream);
    }, function (err) {
        cb(err);
    });
};

},{}],7:[function(require,module,exports){
/*
WildEmitter.js is a slim little event emitter by @henrikjoreteg largely based 
on @visionmedia's Emitter from UI Kit.

Why? I wanted it standalone.

I also wanted support for wildcard emitters like this:

emitter.on('*', function (eventName, other, event, payloads) {
    
});

emitter.on('somenamespace*', function (eventName, payloads) {
    
});

Please note that callbacks triggered by wildcard registered events also get 
the event name as the first argument.
*/
module.exports = WildEmitter;

function WildEmitter() {
    this.callbacks = {};
}

// Listen on the given `event` with `fn`. Store a group name if present.
WildEmitter.prototype.on = function (event, groupName, fn) {
    var hasGroup = (arguments.length === 3),
        group = hasGroup ? arguments[1] : undefined, 
        func = hasGroup ? arguments[2] : arguments[1];
    func._groupName = group;
    (this.callbacks[event] = this.callbacks[event] || []).push(func);
    return this;
};

// Adds an `event` listener that will be invoked a single
// time then automatically removed.
WildEmitter.prototype.once = function (event, groupName, fn) {
    var self = this,
        hasGroup = (arguments.length === 3),
        group = hasGroup ? arguments[1] : undefined, 
        func = hasGroup ? arguments[2] : arguments[1];
    function on() {
        self.off(event, on);
        func.apply(this, arguments);
    }
    this.on(event, group, on);
    return this;
};

// Unbinds an entire group
WildEmitter.prototype.releaseGroup = function (groupName) {
    var item, i, len, handlers;
    for (item in this.callbacks) {
        handlers = this.callbacks[item];
        for (i = 0, len = handlers.length; i < len; i++) {
            if (handlers[i]._groupName === groupName) {
                //console.log('removing');
                // remove it and shorten the array we're looping through
                handlers.splice(i, 1);
                i--;
                len--;
            }
        }
    }
    return this;
};

// Remove the given callback for `event` or all
// registered callbacks.
WildEmitter.prototype.off = function (event, fn) {
    var callbacks = this.callbacks[event],
        i;
    
    if (!callbacks) return this;

    // remove all handlers
    if (arguments.length === 1) {
        delete this.callbacks[event];
        return this;
    }

    // remove specific handler
    i = callbacks.indexOf(fn);
    callbacks.splice(i, 1);
    return this;
};

// Emit `event` with the given args.
// also calls any `*` handlers
WildEmitter.prototype.emit = function (event) {
    var args = [].slice.call(arguments, 1),
        callbacks = this.callbacks[event],
        specialCallbacks = this.getWildcardCallbacks(event),
        i,
        len,
        item;

    if (callbacks) {
        for (i = 0, len = callbacks.length; i < len; ++i) {
            if (callbacks[i]) {
                callbacks[i].apply(this, args);
            } else {
                break;
            }
        }
    }

    if (specialCallbacks) {
        for (i = 0, len = specialCallbacks.length; i < len; ++i) {
            if (specialCallbacks[i]) {
                specialCallbacks[i].apply(this, [event].concat(args));
            } else {
                break;
            }
        }
    }

    return this;
};

// Helper for for finding special wildcard event handlers that match the event
WildEmitter.prototype.getWildcardCallbacks = function (eventName) {
    var item,
        split,
        result = [];

    for (item in this.callbacks) {
        split = item.split('*');
        if (item === '*' || (split.length === 2 && eventName.slice(0, split[1].length) === split[1])) {
            result = result.concat(this.callbacks[item]);
        }
    }
    return result;
};

},{}],5:[function(require,module,exports){
// getScreenMedia helper by @HenrikJoreteg
var getUserMedia = require('getusermedia');

module.exports = function (cb) {
    var constraints = {
            video: {
                mandatory: {
                    chromeMediaSource: 'screen'
                }
            }
        };

    if (window.location.protocol === 'http:') {
        return cb(new Error('HttpsRequired'));
    }

    if (!navigator.webkitGetUserMedia) {
        return cb(new Error('NotSupported'));
    }

    getUserMedia(constraints, cb);
};

},{"getusermedia":3}],6:[function(require,module,exports){
var WildEmitter = require('wildemitter');

function getMaxVolume (analyser, fftBins) {
  var maxVolume = -Infinity;
  analyser.getFloatFrequencyData(fftBins);

  for(var i=0, ii=fftBins.length; i < ii; i++) {
    if (fftBins[i] > maxVolume && fftBins[i] < 0) {
      maxVolume = fftBins[i];
    }
  };

  return maxVolume;
}


module.exports = function(stream, options) {
  var harker = new WildEmitter();

  // make it not break in non-supported browsers
  if (!window.webkitAudioContext) return harker;

  //Config
  var options = options || {},
      smoothing = (options.smoothing || 0.5),
      interval = (options.interval || 100),
      threshold = options.threshold,
      play = options.play;

  //Setup Audio Context
  var audioContext = new webkitAudioContext();
  var sourceNode, fftBins, analyser;

  analyser = audioContext.createAnalyser();
  analyser.fftSize = 512;
  analyser.smoothingTimeConstant = smoothing;
  fftBins = new Float32Array(analyser.fftSize);

  if (stream.jquery) stream = stream[0];
  if (stream instanceof HTMLAudioElement) {
    //Audio Tag
    sourceNode = audioContext.createMediaElementSource(stream);
    if (typeof play === 'undefined') play = true;
    threshold = threshold || -65;
  } else {
    //WebRTC Stream
    sourceNode = audioContext.createMediaStreamSource(stream);
    threshold = threshold || -45;
  }

  sourceNode.connect(analyser);
  if (play) analyser.connect(audioContext.destination);

  harker.speaking = false;

  harker.setThreshold = function(t) {
    threshold = t;
  };

  harker.setInterval = function(i) {
    interval = i;
  };

  // Poll the analyser node to determine if speaking
  // and emit events if changed
  var looper = function() {
    setTimeout(function() {
      var currentVolume = getMaxVolume(analyser, fftBins);

      harker.emit('volume_change', currentVolume, threshold);

      if (currentVolume > threshold) {
        if (!harker.speaking) {
          harker.speaking = true;
          harker.emit('speaking');
        }
      } else {
        if (harker.speaking) {
          harker.speaking = false;
          harker.emit('stopped_speaking');
        }
      }

      looper();
    }, interval);
  };
  looper();


  return harker;
}

},{"wildemitter":7}],8:[function(require,module,exports){
var WildEmitter = require('wildemitter');
var webrtc = require('webrtcsupport');


function PeerConnection(config, constraints) {
    this.pc = new webrtc.PeerConnection(config, constraints);
    WildEmitter.call(this);
    this.pc.onicecandidate = this._onIce.bind(this);
    this.pc.onaddstream = this._onAddStream.bind(this);
    this.pc.onremovestream = this._onRemoveStream.bind(this);

    if (config.debug) {
        this.on('*', function (eventName, event) {
            console.log('PeerConnection event:', eventName, event);
        });
    }
}

PeerConnection.prototype = Object.create(WildEmitter.prototype, {
    constructor: {
        value: PeerConnection
    }
});

PeerConnection.prototype.addStream = function (stream) {
    this.localStream = stream;
    this.pc.addStream(stream);
};

PeerConnection.prototype._onIce = function (event) {
    if (event.candidate) {
        this.emit('ice', event.candidate);
    } else {
        this.emit('endOfCandidates');
    }
};

PeerConnection.prototype._onAddStream = function (event) {
    this.emit('addStream', event);
};

PeerConnection.prototype._onRemoveStream = function (event) {
    this.emit('removeStream', event);
};

PeerConnection.prototype.processIce = function (candidate) {
    this.pc.addIceCandidate(new webrtc.IceCandidate(candidate));
};

PeerConnection.prototype.offer = function (constraints, cb) {
    var self = this;
    var hasConstraints = arguments.length === 2;
    var mediaConstraints = hasConstraints ? constraints : {
            mandatory: {
                OfferToReceiveAudio: true,
                OfferToReceiveVideo: true
            }
        };
    var callback = hasConstraints ? cb : constraints;

    this.pc.createOffer(
        function (sessionDescription) {
            self.pc.setLocalDescription(sessionDescription);
            self.emit('offer', sessionDescription);
            if (callback) callback(null, sessionDescription);
        },
        function (err) {
            self.emit('error', err);
            if (callback) callback(err);
        },
        mediaConstraints
    );
};

PeerConnection.prototype.answerAudioOnly = function (offer, cb) {
    var mediaConstraints = {
            mandatory: {
                OfferToReceiveAudio: true,
                OfferToReceiveVideo: false
            }
        };

    this._answer(offer, mediaConstraints, cb);
};

PeerConnection.prototype.answerVideoOnly = function (offer, cb) {
    var mediaConstraints = {
            mandatory: {
                OfferToReceiveAudio: false,
                OfferToReceiveVideo: true
            }
        };

    this._answer(offer, mediaConstraints, cb);
};

PeerConnection.prototype._answer = function (offer, constraints, cb) {
    var self = this;
    this.pc.setRemoteDescription(new webrtc.SessionDescription(offer));
    this.pc.createAnswer(
        function (sessionDescription) {
            self.pc.setLocalDescription(sessionDescription);
            self.emit('answer', sessionDescription);
            if (cb) cb(null, sessionDescription);
        }, function (err) {
            self.emit('error', err);
            if (cb) cb(err);
        },
        constraints
    );
};

PeerConnection.prototype.answer = function (offer, constraints, cb) {
    var self = this;
    var hasConstraints = arguments.length === 3;
    var callback = hasConstraints ? cb : constraints;
    var mediaConstraints = hasConstraints ? constraints : {
            mandatory: {
                OfferToReceiveAudio: true,
                OfferToReceiveVideo: true
            }
        };

    this._answer(offer, mediaConstraints, callback);
};

PeerConnection.prototype.handleAnswer = function (answer) {
    this.pc.setRemoteDescription(new webrtc.SessionDescription(answer));
};

PeerConnection.prototype.close = function () {
    this.pc.close();
    this.emit('close');
};

module.exports = PeerConnection;

},{"wildemitter":7,"webrtcsupport":2}]},{},[1])(1)
});
;