# SimpleWebRTC - World's easiest WebRTC lib

[![Gitter](https://badges.gitter.im/Join%20Chat.svg)](https://gitter.im/HenrikJoreteg/SimpleWebRTC?utm_source=badge&utm_medium=badge&utm_campaign=pr-badge&utm_content=badge)


Want to see it in action? Check out the demo: https://talky.io/


## It's so easy:

### 1. Some basic html

```html
<!DOCTYPE html>
<html>
    <head>
        <script src="http://simplewebrtc.com/latest-v2.js"></script>
        <style>
            #remoteVideos video {
                height: 150px;
            }
            #localVideo {
                height: 150px;
            }
        </style>
    </head>
    <body>
        <video id="localVideo"></video>
        <div id="remoteVideos"></div>
    </body>
</html>

```

### 2. Create our WebRTC object

```js
var webrtc = new SimpleWebRTC({
    // the id/element dom element that will hold "our" video
    localVideoEl: 'localVideo',
    // the id/element dom element that will hold remote videos
    remoteVideosEl: 'remoteVideos',
    // immediately ask for camera access
    autoRequestMedia: true
});
```

### 3. Tell it to join a room when ready

```js
// we have to wait until it's ready
webrtc.on('readyToCall', function () {
    // you can name it anything
    webrtc.joinRoom('your awesome room name');
});
```

### Available options


`peerConnectionConfig` - Set this to specify your own STUN and TURN servers. By default, SimpleWebRTC uses Google's public STUN server (`stun.l.google.com:19302`), which is intended for public use according to: https://twitter.com/HenrikJoreteg/status/354105684591251456

Note that you will most likely also need to run your own TURN servers. See http://www.html5rocks.com/en/tutorials/webrtc/infrastructure/ for a basic tutorial.

## Filetransfer
Sending files between individual participants is supported. See http://simplewebrtc.com/filetransfer.html for a demo.

Note that this is not file sharing between a group which requires a completly different approach.

## It's not always that simple...

Sometimes you need to do more advanced stuff. See http://simplewebrtc.com/notsosimple.html for some examples.

## Got questions?

Join the SimpleWebRTC discussion list:

http://lists.andyet.com/mailman/listinfo/simplewebrtc

or the Gitter channel:

https://gitter.im/HenrikJoreteg/SimpleWebRTC

## API

### Constructor

`new SimpleWebRTC(options)`

- `object options` - options object provided to constructor consisting of:
  - `string url` - *required* url for signaling server. Defaults to signaling server URL which can be used for development. You must use your own signaling server for production.
  - `object sockio` - *optional* object to be passed as options to the signaling server connection.
  - `Connection connection` - *optional* connection object for signaling. See `Connection` below. Defaults to a new SocketIoConnection
  - `bool debug` - *optional* flag to set the instance to debug mode
  - `[string|DomElement] locaVidelEl` - ID or Element to contain the local video element
  - `[string|DomElement] remoteVideosEl` - ID or Element to contain the
  remote video elements
  - `bool autoRequestMedia` - *optional(=false)* option to automatically request user media. Use `true` to request automatically, or `false` to request media later with `startLocalVideo`
  - `bool enableDataChannels` *optional(=true)* option to enable/disable data channels (used for volume levels or direct messaging)
  - `bool autoRemoveVideos` - *optional(=true)* option to automatically remove video elements when streams are stopped.
  - `bool adjustPeerVolume` - *optional(=false)* option to reduce peer volume when the local participant is speaking
  - `number peerVolumeWhenSpeaking` - *optional(=.0.25)* value used in
  conjunction with `adjustPeerVolume`. Uses values between 0 and 1.
  - `object media` - media options to be passed to `getUserMedia`. Defaults to `{ video: true, audio: true }`. Valid configurations described [on MDN](https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices/getUserMedia) with official spec [at w3c](http://w3c.github.io/mediacapture-main/#dom-mediadevices-getusermedia).
  - `object receiveMedia` - *optional* RTCPeerConnection options. Defaults to `{ offerToReceiveAudio: 1, offerToReceiveVideo: 1 }`.
  - `object localVideo` - *optional* options for attaching the local video stream to the page. Defaults to
  ```javascript
  {
      autoplay: true, // automatically play the video stream on the page
      mirror: true, // flip the local video to mirror mode (for UX)
      muted: true // mute local video stream to prevent echo
  }
  ```
  - `object logger` - *optional* alternate logger for the instance; any object that implements `log`, `warn`, and `error` methods.

### Fields

`capabilities` - the [`webrtcSupport`](https://github.com/HenrikJoreteg/webrtcsupport) object that describes browser capabilities, for convenience

`config` - the configuration options extended from options passed to the constructor

`connection` - the socket (or alternate) signaling connection

`webrtc` - the underlying WebRTC session manager

### Events

`'connectionReady', sessionId`

`'createdPeer', peer`

`'stunservers', stunServers`

`'turnservers', turnservers`

`'localScreenAdded', el`

### Methods

`leaveRoom()`

`disconnect()`

`handlePeerStreamAdded(peer)`

`handlePeerStreamRemoved(peer)`

`getDomId(peer)`

`setVolumeForAll(volume)`

`joinRoom(name, callback)`

`getEl(idOrEl)`

`startLocalVideo()`

`stopLocalVideo()`

`getLocalVideoContainer()`

`getRemoteVideoContainer()`

`shareScreen(callback)`

`getLocalScreen()`

`stopScreenShare()`

`testReadiness()`

`createRoom(name, callback)`

`sendFile()`

### Connection

By default, SimpleWebRTC uses a Socket.io connection to communicate with the signaling server. However, you can provide an alternate connection object to use. All that your alternate connection need provide are four methods:

- `on(ev, fn)` - A method to invoke `fn` when event `ev` is triggered
- `emit()` - A method to send/emit arbitrary arguments on the connection
- `getSessionId()` - A method to get a unique session Id for the connection
- `disconnect()` - A method to disconnect the connection
