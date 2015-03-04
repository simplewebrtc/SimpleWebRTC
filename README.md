# SimpleWebRTC - World's easiest WebRTC lib

[![Gitter](https://badges.gitter.im/Join%20Chat.svg)](https://gitter.im/HenrikJoreteg/SimpleWebRTC?utm_source=badge&utm_medium=badge&utm_campaign=pr-badge&utm_content=badge)


Want to see it in action? Check out the demo: https://talky.io/


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

## It's not always that simple...

Sometimes you need to do more advanced stuff. See http://simplewebrtc.com/notsosimple.html for some examples.

## Got questions?

Join the SimpleWebRTC discussion list: 

http://lists.andyet.com/mailman/listinfo/simplewebrtc

or the Gitter channel:

https://gitter.im/HenrikJoreteg/SimpleWebRTC

## API
