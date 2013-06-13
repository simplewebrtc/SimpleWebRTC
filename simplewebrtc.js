//;define('lib/simplewebrtc', ['lib/socket.io'], 
(function(window) {
    // util functions
    var logger = {
        log: function() {},
        warn: function() {},
        error: function() {}
    };

    function cap(str) {
        return str.slice(0, 1).toUpperCase() + str.slice(1);
    };
    
    function wrapMessage(data, type) {
      var msg = {
        body: data
      };
      
      if (type)
        msg.type = type;
      
      return JSON.stringify(msg);
    };

    function isObject(obj) {
      return obj === Object(obj);
    };

    function has(obj, key) {
      return hasOwnProperty.call(obj, key);
    };

    function deepExtend(obj, source) {
      for (var p in source) {
        if (has(source, p) && !has(obj, p)) {
          obj[p] = source[p];
          continue;
        }
          
        var val = source[p], 
            org = obj[p];
        
        if (isObject(val) && isObject(org))
          deepExtend(org, val);
        else
          obj[p] = val;          
      }
      
      return obj;
    };
    
    // increase the bandwidth field: https://github.com/Peer5/ShareFest/issues/10
    // https://github.com/Peer5/ShareFest/blob/master/public/js/peerConnectionImplChrome.js
    function transformOutgoingSdp(sessionDescription) {
      var sdp = sessionDescription.sdp;
      var splitted = sdp.split("b=AS:30");
      sessionDescription.sdp = splitted[0] + "b=AS:1638400" + splitted[1];
    };
    
    // normalize environment
    var RTCPeerConnection       = window.RTCPeerConnection     || window.mozRTCPeerConnection     			  || window.webkitRTCPeerConnection,
        getUserMedia            = navigator.getUserMedia       || navigator.mozGetUserMedia.bind(navigator)   || navigator.webkitGetUserMedia.bind(navigator),
        RTCIceCandidate         = window.RTCIceCandidate       || window.mozRTCIceCandidate,
        RTCSessionDescription   = window.RTCSessionDescription || window.mozRTCSessionDescription,
        MediaStream             = window.MediaStream           || window.webkitMediaStream;
        attachMediaStream = null,
        reattachMediaStream = null,
        webRTCSupport = true,
        docStyle = document.documentElement.style,
        isChrome = 'WebkitTransform' in docStyle,
        isFirefox = 'MozBoxSizing' in docStyle;

    if (!(isFirefox || isChrome) || 
        !(RTCPeerConnection && RTCIceCandidate && RTCSessionDescription && MediaStream)) {
      
      webRTCSupport = false;
      throw new Error("Browser does not appear to be WebRTC-capable");
    }
        
    if (isFirefox) {
        // Attach a media stream to an element.
        attachMediaStream = function(element, stream) {
            element.mozSrcObject = stream;
            element.play();
        };

        reattachMediaStream = function(to, from) {
            to.mozSrcObject = from.mozSrcObject;
            to.play();
        };

        // Fake get{Video,Audio}Tracks
        MediaStream.prototype.getVideoTracks = function() {
            return [];
        };

        MediaStream.prototype.getAudioTracks = function() {
            return [];
        };
    } else if (isChrome) {
        // Attach a media stream to an element.
        attachMediaStream = function(element, stream) {
            element.autoplay = true;
            element.src = webkitURL.createObjectURL(stream);
        };

        reattachMediaStream = function(to, from) {
            to.src = from.src;
        };

        // The representation of tracks in a stream is changed in M26.
        // Unify them for earlier Chrome versions in the coexisting period.
        if (!webkitMediaStream.prototype.getVideoTracks) {
            webkitMediaStream.prototype.getVideoTracks = function() {
                return this.videoTracks;
            };
            webkitMediaStream.prototype.getAudioTracks = function() {
                return this.audioTracks;
            };
        }

        // New syntax of getXXXStreams method in M26.
        if (!webkitRTCPeerConnection.prototype.getLocalStreams) {
            webkitRTCPeerConnection.prototype.getLocalStreams = function() {
                return this.localStreams;
            };
            webkitRTCPeerConnection.prototype.getRemoteStreams = function() {
                return this.remoteStreams;
            };
        }
    } else {
        webRTCSupport = false;
        throw new Error("Browser does not appear to be WebRTC-capable");
    }


    // emitter that we use as a base

    function WildEmitter() {
        this.callbacks = {};
    }

    // Listen on the given `event` with `fn`. Store a group name if present.
    WildEmitter.prototype.on = function(event, groupName, fn) {
        var hasGroup = (arguments.length === 3),
            group = hasGroup ? arguments[1] : undefined,
            func = hasGroup ? arguments[2] : arguments[1];
        func._groupName = group;
        (this.callbacks[event] = this.callbacks[event] || []).push(func);
        return this;
    };

    // Adds an `event` listener that will be invoked a single
    // time then automatically removed.
    WildEmitter.prototype.once = function(event, fn) {
        var self = this;

        function on() {
            self.off(event, on);
            fn.apply(this, arguments);
        }
        this.on(event, on);
        return this;
    };

    // Unbinds an entire group
//    WildEmitter.prototype.releaseGroup = function(groupName) {
//        var item, i, len, handlers;
//        for (item in this.callbacks) {
//            handlers = this.callbacks[item];
//            for (i = 0, len = handlers.length; i < len; i++) {
//                if (handlers[i]._groupName === groupName) {
//                    handlers.splice(i, 1);
//                    i--;
//                    len--;
//                }
//            }
//        }
//        return this;
//    };

    // Remove the given callback for `event` or all
    // registered callbacks.
    WildEmitter.prototype.off = function(event, fn) {
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
    WildEmitter.prototype.emit = function(event) {
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
    WildEmitter.prototype.getWildcardCallbacks = function(eventName) {
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
        var options = opts || {};
        var self = this,
            config = this.config = {
                url: 'http://signaling.simplewebrtc.com:8888',
                log: false,
                data: true,
                audio: {
                    send: true,
                    receive: true
                },
                video: {
                    send: true,
                    receive: true,
                    preview: true
                },
                local: {
                  muted: true
                },
                remote: null,
                autoRequestMedia: false,
                // makes the entire PC config overridable
                peerConnectionConfig: {
                    iceServers: isChrome ? [{
                            "url": "stun:stun.l.google.com:19302"
                        }
                    ] : [{
                            "url": "stun:124.124.124.2"
                        }
                    ]
                },
                peerConnectionContraints: {
                    optional: isChrome ? [{
                            RtpDataChannels: true
                        }
                    ] : [{
                            DtlsSrtpKeyAgreement: true
                        }
                    ]
                }
            },
            vConfig,
            aConfig,
            item,
            connection;

        // check for support
        if (!webRTCSupport) {
            console.error('Your browser doesn\'t seem to support WebRTC');
        }

        // set options
//        for (item in options) {
//            this.config[item] = options[item] || this.config[item];
//        }
        
        deepExtend(this.config, options);
        vConfig = config.video;
        aConfig = config.audio;
        this.outboundMedia = {
          video: this.config.video.send,
          audio: this.config.audio.send
        };
        
        if (isFirefox) {
          // in Firefox, you can't clone or partially clone MediaStream objects yet
          if (vConfig.preview && !vConfig.send)
            throw new Error("In Firefox, you currently can only preview video if you send it");
          if (!aConfig.send && (this.config.local && !this.config.local.muted))
            throw new Error("In Firefox, you currently can only preview audio if you send it");
        }

        config.mediaConstraints = config.mediaConstraints || {
            audio: aConfig.send,
            video: vConfig.send || vConfig.preview ? {
                mandatory: {},
                optional: []
            } : false
        }
        
        // log if configured to
        if (this.config.log) logger = console;

        // where we'll store our peer connections
        this.pcs = {};

        // our socket.io connection
        connection = this.connection = io.connect(this.config.url, {
            'force new connection': true // otherwise the 2nd instance of WebRTC will fail to connect
        });

        connection.on('connect', function() {
            self.emit('ready', connection.socket.sessionid);
            self.sessionReady = true;
            self.testReadiness();
        });

        connection.on('message', function(message) {
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

        connection.on('joined', function(info) {
            logger.log('got a joined', info);
            // First 'joined' event carries my own id (as my own 'joined' event is the first one I can receive) 
            // All subsequent ones carry ids of other people who joined
            if (!self.id || info.id == self.id) {
                self.id = info.id;
                self.emit('userid', info.id);
                return;
            }

            if (!self.pcs[info.id])
                self.startCall(info.id);
        });

        connection.on('left', function(room) {
            var conv = self.pcs[room.id];
            if (conv)
                conv.end();
        });

        WildEmitter.call(this);

        // log events
        this.on('*', function(event, val1, val2) {
            logger.log('event:', event, val1, val2);
        });

        // auto request if configured
        this.dontRequestMedia = !vConfig.preview && !vConfig.send && !aConfig.send;
        if (this.config.autoRequestMedia) {
          if (this.dontRequestMedia)
            throw new Error("Please set autoRequestMedia to false, or choose at least one media type to send or preview");
          
          this.startLocalMedia();
        }
    }
    
    WebRTC.prototype = Object.create(WildEmitter.prototype, {
        constructor: {
            value: WebRTC
        }
    });

    WebRTC.prototype.getEl = function(idOrEl) {
        if (typeof idOrEl == 'string') {
            return document.getElementById(idOrEl);
        } else {
            return idOrEl;
        }
    };

    // this accepts either element ID or element
    // and either the video or audio tag itself or a container
    // that will be used to put the video or audio tag into.
    WebRTC.prototype.getLocalVideoContainer = function() {
        var local = this.config.local;
        if (!local)
            throw new Error('no local media container or element specified');

        var el = this.getEl(this.config.local._el);
        if (el && el.tagName === 'VIDEO') {
            return el;
        } else {
            var media = document.createElement('video');
            var options = this.config.local;
            if (options) {
                for (var opt in options) {
                    if (!/_/.test(opt))
                        media[opt] = options[opt];
                }
            }

            el.appendChild(media);
            return media;
        }
    };

    WebRTC.prototype.getRemoteMediaContainer = function() {
        return this.getEl(this.config.remote._el);
    };

    WebRTC.prototype.startCall = function(id) {
        this.pcs[id] = new Conversation({
            id: id,
            parent: this,
            initiator: true
        });

        this.pcs[id].start();
    };

    WebRTC.prototype.createRoom = function(name, cb) {
        if (arguments.length === 2) {
            this.connection.emit('create', name, cb);
        } else {
            this.connection.emit('create', name);
        }
    };

    WebRTC.prototype.joinRoom = function(name) {
        this.connection.emit('join', name);
        this.roomName = name;
    };

    WebRTC.prototype.leaveRoom = function() {
        if (this.roomName) {
            this.connection.emit('leave', this.roomName);
            for (var pc in this.pcs) {
                this.pcs[pc].end();
            }
        }
    };

    WebRTC.prototype.testReadiness = function() {
        var self = this,
            config = this.config,
            sessionid = self.connection.socket.sessionid,
            noMedia = this.dontRequestMedia;
        
        if (this.sessionReady && (this.localStreamSent || noMedia)) {
              // This timeout is a workaround for the strange no-audio bug
              // as described here: https://code.google.com/p/webrtc/issues/detail?id=1525
              // remove timeout when this is fixed.
              var sessionid = self.connection.socket.sessionid;
              setTimeout(function() {
                  self.emit('readyToCall', sessionid);
              }, noMedia ? 0 : 1000);
        }
    };

    WebRTC.prototype.startLocalMedia = function(element) {
        var self = this;
        if (this.dontRequestMedia)
            throw new Error('You have disabled video preview, and video/audio broadcasting');

        if (element) {
            if (element instanceof MediaStream)
                return this.addMediaFromStream(element);
            else if (element.src || element.mozSrcObject)
                return;
        }

        getUserMedia(this.config.mediaConstraints, this.addMediaFromStream.bind(this), function() {
            throw new Error('Failed to get access to local media.');
        });
    };

    WebRTC.prototype.addMediaFromStream = function(stream) {
        var config = this.config,
            vConfig = config.video,
            aConfig = config.audio,
            media;

        if (vConfig.preview) {
            media = this.getLocalVideoContainer();
            attachMediaStream(media, stream);
        }

        this.localStream = this.localStreamSent = stream;
        if (isChrome) {
          if (!vConfig.send) { // allow previewing video, while not sending it
              this.localStreamSent = new MediaStream(stream.getAudioTracks());
          } else if (!aConfig.send && !this.config.local.muted) { // only send video
              this.localStreamSent = new MediaStream(stream.getVideoTracks());
          }
        }

        this.testReadiness();
        if (media) {
            this.emit('mediaAdded', {
                type: 'local',
                media: media,
                stream: stream
            });
        }
    }

    /**
     * broadcast data over all channels, or over one channel, if "to" is specified
     */
    WebRTC.prototype.send = function(data, to, callbacks) {
      var convs = to ? {} : this.pcs;
      
      if (to) {
        var conv = this.pcs[to];
        if (!conv)
          throw new Error('no user found with this id');
        
        convs[to] = conv;
      }
      
      for (var conv in convs) {
        convs[conv].send(data, callbacks);
      }
    };

    /**
     * for internal use
     */
    WebRTC.prototype._send = function(to, type, payload, misc) {
        this.connection.emit('message', deepExtend({
            to: to,
            type: type,
            payload: payload
        }, misc || {}));
    };

    function Conversation(options) {
        this.options = options || {};
        for (var o in this.options) {
            this[o] = this.options[o];
        }

        logger.log(this.initiator ? "started" : "joined", "new conversation");
        
        var self = this;
            config = this.config = this.parent.config,
            vConfig = this.videoConfig = config.video,
            aConfig = this.audioConfig = config.audio;

        this.receiver = new Receiver();

        // Create an RTCPeerConnection via the polyfill (adapter.js).
        this.pc = new RTCPeerConnection(this.config.peerConnectionConfig, this.config.peerConnectionContraints);
        this.pc.onicecandidate = this.onIceCandidate.bind(this);
        if ((vConfig.send || aConfig.send) && this.parent.localStreamSent)
            this.pc.addStream(this.parent.localStreamSent);

        if (vConfig.receive || aConfig.receive) {
            this.pc.onaddstream = this.handleRemoteStreamAdded.bind(this);
            this.pc.onremovestream = this.handleStreamRemoved.bind(this);
        }

        // for re-use
        this.mediaConstraints = {
            optional: [],
            mandatory: {
                OfferToReceiveAudio: !! aConfig.receive,
                OfferToReceiveVideo: !! vConfig.receive
            }
        };

        if (isFirefox && !config.data)
          this.mediaConstraints.mandatory.MozDontOfferDataChannel = true;

        
        if (this.config.data) {
            // in Firefox we have to initialize the RTCDataChannel via RTCPeerConnection.createDataChannel as the offerer, 
            // and via the RTCPeerConnection.ondatachannel event handler as the answerer  
            if (isChrome || (this.initiator && isFirefox)) {
                var channel = this.pc.createDataChannel(
                    'RTCDataChannel',
                    isChrome ? {
                        reliable: false
                    } : {}
                );
    
                if (isFirefox)
                  channel.binaryType = 'blob';
    
                this.handleDataChannelAdded({
                    channel: channel
                });
            }
            else {
                this.pc.ondatachannel = this.handleDataChannelAdded.bind(this);
            }
        }

        WildEmitter.call(this);

        // proxy events to parent
        this.on('*', function(name, value) {
            self.parent.emit(name, value, self);
        });
    }

    Conversation.prototype = Object.create(WildEmitter.prototype, {
        constructor: {
            value: Conversation
        }
    });

    Conversation.prototype.handleMessage = function(message) {
        var type = message.type,
            payload = message.payload,
            media = message.media;
        
        switch (type) {
        case 'offer':
            logger.log('setting remote description');
            this.remoteConfig = media;
            this.pc.setRemoteDescription(new RTCSessionDescription(payload));
            this.answer();
            break;
        case 'answer':
            this.remoteConfig = media;
            this.pc.setRemoteDescription(new RTCSessionDescription(payload));
            break;
        case 'candidate':
            logger.log('message.payload', payload);
            var candidate = new RTCIceCandidate({
                sdpMLineIndex: message.payload.label,
                candidate: payload.candidate
            });
            this.pc.addIceCandidate(candidate);
            break;
        default:
            logger.log("no such message type:", type);
            break;
        }
    };

    /**
     * for internal use
     */
    Conversation.prototype._send = function(type, payload, misc) {
        this.parent._send(this.id, type, payload, misc);
    };

    Conversation.prototype.send = function(data, callbacks) {
        var self = this,
            channel = this.channel;
        
        if (!channel) {
          // data channel is not set up yet, 
          // send the message when it opens 
          this.once('dataOpen', function() {
            self.send(data, callbacks);
          });
          
          return;
        }
        
        callbacks = callbacks || {};
        if (channel.readyState != 'open')
            return;
        
        Sender.send({
            data: data,
            channel: channel
        });
    };

    Conversation.prototype.onProcessedDataChannelEvent_For = function(event) {
        var self = this;
        return function() {
            self.onProcessedDataChannelEvent.apply(self, [event].concat([].slice.call(arguments)));
        };
    };

    Conversation.prototype.onProcessedDataChannelEvent = function(event, args) {
        logger.log('data channel event', event, args);
        this.emit.apply(this, ['data' + cap(event)].concat(args || []));
    };

    Conversation.prototype.onProcessedDataChannelMessage = function(data) {
        this.onProcessedDataChannelEvent('message', data);
    };

    Conversation.prototype.onDataChannelMessage = function(event) {
        this.receiver.receive(JSON.parse(event.data), this.onProcessedDataChannelMessage.bind(this));
    };

    Conversation.prototype.onIceCandidate = function(event) {
        if (this.closed) return;
        
        if (event.candidate) {
            this._send('candidate', {
                label: event.candidate.sdpMLineIndex,
                id: event.candidate.sdpMid,
                candidate: event.candidate.candidate
            });
        } else {
            logger.log("End of candidates.");
        }
    };

    Conversation.prototype.start = function() {
        var self = this
        this.pc.createOffer(function(sessionDescription) {
            logger.log('setting local description');
            transformOutgoingSdp(sessionDescription);
            self.pc.setLocalDescription(sessionDescription);
            logger.log('sending offer', sessionDescription);
            self._send('offer', sessionDescription, {
              media: self.parent.outboundMedia
            });
        }, null, this.mediaConstraints);
    };

    Conversation.prototype.end = function() {
        if (this.channel && this.channel.readyState !== 'closed')
            this.channel.close();

        if (this.pc.signalingState !== 'closed')
            this.pc.close();

        if (this.stream)
            this.handleStreamRemoved();

        this.handleDataChannelRemoved();
    };

    Conversation.prototype.answer = function() {
        var self = this;
        logger.log('answer called');        
        this.pc.createAnswer(function(sessionDescription) {
            logger.log('setting local description');
            self.pc.setLocalDescription(sessionDescription);
            logger.log('sending answer', sessionDescription);
            self._send('answer', sessionDescription, {
              media: self.parent.outboundMedia
            });
        }, null, this.mediaConstraints);
    };

    Conversation.prototype.handleDataChannelAdded = function(event) {
      var dataEvents = ['open', 'close', 'error', 'message']; // onmessage is special
      this.channel = event.channel;
      if (isFirefox)
        this.channel.binaryType = 'blob';
      
      for (var i = 0; i < dataEvents.length; i++) {
        var event = dataEvents[i],
            cbName = 'on' + event;

        switch (event) {
        case 'open':
        case 'close':
        case 'error':
            this.channel[cbName] = this.onProcessedDataChannelEvent_For(event);
            break;
        case 'message':
            this.channel.onmessage = this.onDataChannelMessage.bind(this);
            break;
        }
      }
    };

    Conversation.prototype.handleRemoteStreamAdded = function(event) {
        var stream = this.stream = event.stream,
            tag = this.remoteConfig.video ? 'video' : 'audio';
        
        el = document.createElement(tag),
        container = this.parent.getRemoteMediaContainer(),
        options = this.remote;

        el.id = this.id;
        if (options) {
            for (var opt in options) {
                if (!/^_/.test(opt))
                    el[opt] = options[opt];
            }
        }

        attachMediaStream(el, stream);
        if (container)
            container.appendChild(el);

        this.emit('mediaAdded', {
            type: 'remote',
            media: el,
            stream: stream
        });
    };

    Conversation.prototype.handleDataChannelRemoved = function() {
        this.cleanup();
    };

    Conversation.prototype.handleStreamRemoved = function() {
        var media = document.getElementById(this.id),
            container = this.parent.getRemoteMediaContainer();

        var stream = this.stream;
        this.stream = null;
        if (media) {
            if (container)
                container.removeChild(media);

            this.emit('mediaRemoved', {
                type: 'remote',
                media: media,
                stream: stream
            });
        }

        this.cleanup();
    };

    // check if the peerConnection is dead enough to be buried (if media stream and data channel have both been closed) 
    Conversation.prototype.cleanup = function() {
        if (this.stream)
            return;

        var me = this.parent.pcs[this.id];
        if (!me || (me.channel && me.channel.readyState == 'open'))
            return;

        delete this.parent.pcs[this.id];
        this.closed = true;
    }

    ////////////////////////////////////////////////////////////////////////// START ////////////////////////////////////////////////////////////////////////////////
    ///////////////////////////////////////// adapted from Muaz Khan's RTCMultiConnection (with minor modifications) ////////////////////////////////////////////////
    ///////////////////////////////////////// Copyright © 2013 [Muaz Khan](https://github.com/muaz-khan)<[@muazkh](http://twitter.com/muazkh)>. /////////////////////

    function chunkify(text, chunkSize) {
        var chunks = [], 
            numChunks = Math.ceil(text.length / chunkSize),
            from = to = 0;
        
        for (var i = 0; i < numChunks; i++) {
          from = to;
          to += chunkSize;
          chunks.push(text.slice(from, to));
        }

        return chunks;
    };
    
    /**
     * Data channel message sender, will auto-chunkify data if needed
     */
    var Sender = {
//        var chunkifyRegExp = new RegExp(".{1," + chunkSize + "}", "g");
        send: function(config) {
            var channel = config.channel,
                data = config.data,
                chunkSize = 1000,
                text = typeof data === 'string' ? data : JSON.stringify(data); /* chars */

            if (isFirefox || text.length <= chunkSize) {
                channel.send(wrapMessage(data));
                return;
            }
            
            var chunks = chunkify(text, chunkSize); //text.match(chunkifyRegExp);    // RegExp is slow
            sendChunk(chunks);
            
            // loops over chunks
            function sendChunk(chunks, idx) {
                if (channel.readyState !== 'open')
                  return; // channel may have closed during the timeouts
              
                idx = idx || 0;
                var first = !idx,
                    last = idx == chunks.length - 1,
                    data = {};
                    
                if (first) 
                    data.packets = chunks.length;
                else if (last)
                    data.last = true;
                  
                data.chunk = chunks[idx];
                channel.send(wrapMessage(data, 'chunk'));
                if (!last) {
                    setTimeout(function() {                      
                        sendChunk(chunks, ++idx);
                    }, 500);
                }
            }
        }
    };

    /**
     * Data channel message receiver
     * @param data - arbitrary data
     * @param onreceived - callback for when a message is received in its entirety (it may be chunked) 
     */
    function Receiver() {
        var content = [];

        function receive(data, onreceived) {
            if (data.type !== 'chunk') {
              onreceived(data.body);
              return;
            }
            
            var chunkInfo = data.body;
            content.push(chunkInfo.chunk);
            // if it's a regular message (not chunked), data.chunk should be undefined
            if (chunkInfo.last) { 
                onreceived(content.join(''));
                content = [];
            }
        }

        return {
            receive: receive
        };
    }

    ///////////////////////////////////////// adapted from Muaz Khan's RTCMultiConnection (with minor modifications) //////////////////////////////////////////////
    ////////////////////////////////////////////////////////////////////////// END ////////////////////////////////////////////////////////////////////////////////
    
    //expose WebRTC
    if (typeof define === 'function' && define.amd) {
        define('simplewebrtc', function() {
            return WebRTC;
        });
    } else
        window.WebRTC = WebRTC;
    
})(window)