;(function () {

var logger = {
    log: function (){},
    warn: function (){},
    error: function (){}
};

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
WildEmitter.prototype.once = function (event, fn) {
    var self = this;
    function on() {
        self.off(event, on);
        fn.apply(this, arguments);
    }
    this.on(event, on);
    return this;
};

// Unbinds an entire group
WildEmitter.prototype.releaseGroup = function (groupName) {
    var item, i, len, handlers;
    for (item in this.callbacks) {
        handlers = this.callbacks[item];
        for (i = 0, len = handlers.length; i < len; i++) {
            if (handlers[i]._groupName === groupName) {
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
            callbacks[i].apply(this, args);
        }
    }

    if (specialCallbacks) {
        for (i = 0, len = specialCallbacks.length; i < len; ++i) {
            specialCallbacks[i].apply(this, [event].concat(args));
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


function WebRTC(opts) {
    var self = this,
        options = opts || {},
        config = this.config = {
            url: 'http://tool.andyet.net:8888',
            log: false,
            localVideoId: 'localVideo'
        },
        item,
        connection;

    // check for support
    if (!WebRTC.support) {
        console.error('Your browser doesn\'t seem to support WebRTC');
    }

    // set options
    for (item in options) {
        this.config[item] = options[item];
    }

    // log if configured to
    if (this.config.log) logger = console;

    // where we'll store our peer connections
    this.pcs = {};

    // our socket.io connection
    connection = this.connection = io.connect(this.config.url);

    connection.on('connect', function () {
        self.emit('ready', connection.socket.sessionid);
        self.sessionReady = true;
        self.testReadiness();
    });

    connection.on('message', function (message) {
        var existing = self.pcs[message.from];
        if (existing) {
            existing.handleMessage(message);
        } else {
            // create the conversation object
            self.pcs[message.from] = new Conversation({
                id: message.from,
                parent: self,
                initiator: false
            });
            self.pcs[message.from].handleMessage(message);
        }
    });

    connection.on('joined', function (room) {
        logger.log('got a joined', room);
        if (!self.pcs[room.id]) {
            self.startVideoCall(room.id);
        }
    });
    connection.on('left', function (room) {
        var conv = self.pcs[room.id];
        if (conv) conv.handleStreamRemoved();
    });

    WildEmitter.call(this);

    // log events
    this.on('*', function (event, val1, val2) {
        logger.log('event:', event, val1, val2);
    });
}

WebRTC.prototype = Object.create(WildEmitter.prototype, {
    constructor: {
        value: WebRTC
    }
});

// Thankfully borrowed from Google's examples
WebRTC.normalizeEnvironment = function () {
    WebRTC.RTCPeerConnection = null,
    WebRTC.getUserMedia = null,
    WebRTC.attachMediaStream = null,
    WebRTC.support = true;

    if (navigator.mozGetUserMedia) {
        // The RTCPeerConnection object.
        WebRTC.RTCPeerConnection = mozRTCPeerConnection;

        // Get UserMedia (only difference is the prefix).
        // Code from Adam Barth.
        WebRTC.getUserMedia = navigator.mozGetUserMedia.bind(navigator);

        // Attach a media stream to an element.
        WebRTC.attachMediaStream = function(element, stream) {
            element.mozSrcObject = stream;
            element.play();
        };
    } else if (navigator.webkitGetUserMedia) {
        // The RTCPeerConnection object.
        WebRTC.RTCPeerConnection = webkitRTCPeerConnection;

        // Get UserMedia (only difference is the prefix).
        // Code from Adam Barth.
        WebRTC.getUserMedia = navigator.webkitGetUserMedia.bind(navigator);

        // Attach a media stream to an element.
        WebRTC.attachMediaStream = function(element, stream) {
            element.autoplay = true;
            element.src = webkitURL.createObjectURL(stream);
        };

        // The representation of tracks in a stream is changed in M26.
        // Unify them for earlier Chrome versions in the coexisting period.
        if (!webkitMediaStream.prototype.getVideoTracks) {
            webkitMediaStream.prototype.getVideoTracks = function() {
                return this.videoTracks;
            }
        }
        if (!webkitMediaStream.prototype.getAudioTracks) {
            webkitMediaStream.prototype.getAudioTracks = function() {
                return this.audioTracks;
            }
        }
    } else {
        WebRTC.support = false;
        throw new Error("Browser does not appear to be WebRTC-capable");
    }
}();

WebRTC.prototype.getLocalVideoContainer = function () {
    var found;

    if (this.localVideoContainer) return this.localVideoContainer;

    if (this.config.localVideoId) {
        found = document.getElementById(this.config.localVideoId);
        if (found) {
            this.localVideoContainer = found;
        }
        return found;
    }
};

WebRTC.prototype.startVideoCall = function (id) {
    this.pcs[id] = new Conversation({
        id: id,
        parent: this,
        initiator: true
    });
    this.pcs[id].start();
};

WebRTC.prototype.createRoom = function (name, cb) {
    if (arguments.length === 2) {
        this.connection.emit('create', name, cb);
    } else {
        this.connection.emit('create', name);
    }
};

WebRTC.prototype.joinRoom = function (name) {
    this.connection.emit('join', name);
};

WebRTC.prototype.leaveRoom = function (name) {
    this.connection.emit('leave', name);
};

WebRTC.prototype.handleIncomingIceCandidate = function (candidate, moreToFollow) {
    logger.log('received candidate');
    var candidate = new IceCandidate(payload.label, payload.candidate);
    this.pc.processIceMessage(candidate);
};

WebRTC.prototype.testReadiness = function () {
    if (this.localStream && this.sessionReady) {
        this.emit('readyToCall', this.connection.socket.sessionid);
    }
};

WebRTC.prototype.startLocalVideo = function (element) {
    var self = this;
    WebRTC.getUserMedia({audio: true, video: true}, function (stream) {
        WebRTC.attachMediaStream(element || self.getLocalVideoContainer(), stream);
        self.localStream = stream;
        self.testReadiness();
    }, function () {
        throw new Error('Failed to get access to local media.');
    });
};


WebRTC.prototype.send = function (to, type, payload) {
    this.connection.emit('message', {
        to: to,
        type: type,
        payload: payload
    });
};

function Conversation(options) {
    var self = this;
    this.id = options.id;
    this.parent = options.parent;
    this.initiator = options.initiator;
    this.pc = new WebRTC.RTCPeerConnection({iceServers: [{url: "stun:stun.l.google.com:19302"}]}, {"optional": []});
    this.pc.onicecandidate = this.onIceCandidate.bind(this);
    this.pc.addStream(this.parent.localStream);
    this.pc.onaddstream = this.handleRemoteStreamAdded.bind(this);
    this.pc.onremovestream = this.handleStreamRemoved.bind(this);
    // for re-use
    this.mediaConstraints = {
        'mandatory': {
            'OfferToReceiveAudio':true,
            'OfferToReceiveVideo':true
        }
    };
    WildEmitter.call(this);

    // proxy events to parent
    this.on('*', function (name, value) {
        self.parent.emit(name, value, self);
    });
}

Conversation.prototype = Object.create(WildEmitter.prototype, {
    constructor: {
        value: Conversation
    }
});

Conversation.prototype.handleMessage = function (message) {
    if (message.type === 'offer') {
        logger.log('setting remote description');
        this.pc.setRemoteDescription(new RTCSessionDescription(message.payload));
        this.answer();
    } else if (message.type === 'answer') {
        this.pc.setRemoteDescription(new RTCSessionDescription(message.payload));
    } else if (message.type === 'candidate') {
        var candidate = new RTCIceCandidate({
            sdpMLineIndex: message.payload.label,
            candidate: message.payload.candidate
        });
        this.pc.addIceCandidate(candidate);
    }
};

Conversation.prototype.send = function (type, payload) {
    this.parent.send(this.id, type, payload);
};

Conversation.prototype.onIceCandidate = function (event) {
    if (event.candidate) {
        this.send('candidate', {
            label: event.candidate.sdpMLineIndex,
            id: event.candidate.sdpMid,
            candidate: event.candidate.candidate
        });
    } else {
      logger.log("End of candidates.");
    }
};

Conversation.prototype.start = function () {
    var self = this;
    this.pc.createOffer(function (sessionDescription) {
        logger.log('setting local description');
        self.pc.setLocalDescription(sessionDescription);
        logger.log('sending offer', sessionDescription);
        self.send('offer', sessionDescription);
    }, null, this.mediaConstraints);
};

Conversation.prototype.answer = function () {
    var self = this;
    logger.log('answer called');
    this.pc.createAnswer(function (sessionDescription) {
        logger.log('setting local description');
        self.pc.setLocalDescription(sessionDescription);
        logger.log('sending answer', sessionDescription);
        self.send('answer', sessionDescription);
    }, null, this.mediaConstraints);
};

Conversation.prototype.handleRemoteStreamAdded = function (event) {
    var stream = this.stream = event.stream,
        el = document.createElement('video');
    el.id = this.id;
    WebRTC.attachMediaStream(el, stream);
    this.emit('videoAdded', el);
};

Conversation.prototype.handleStreamRemoved = function () {
    this.emit('videoRemoved', document.getElementById(this.id));
};

// expose WebRTC
window.WebRTC = WebRTC;

}());
