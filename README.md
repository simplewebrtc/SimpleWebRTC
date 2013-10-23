# SimpleWebRTC - World's easiest WebRTC lib

Check out the demo: https://talky.io


## It's so easy:

### 1. Some basic html

```html
<!DOCTYPE html>
<html>
    <head>
        <script src="http://simplewebrtc.com/latest.js"></script> 
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

### 1. Create our WebRTC object

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

### 2. Tell it to join a room when ready

```js
// we have to wait until it's ready
webrtc.on('readyToCall', function () {
    // you can name it anything
    webrtc.joinRoom('your awesome room name');
});
```

### Available Options


`peerConnectionConfig` - Set this to specify your own STUN and TURN servers. SimpleWebRTC uses Google's public STUN server by default: `stun.l.google.com:19302`. It's intended for public use according to: https://twitter.com/HenrikJoreteg/status/354105684591251456


