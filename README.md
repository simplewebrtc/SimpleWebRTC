# webrtc.js - World's easiest webrtc lib

Check out the demo: http://conversat.io


## It's so easy:

### 1. Some basic html

```html
<!DOCTYPE html>
<html>
    <head>
        <script src="http://conversat.io/latest.min.js"></script> 
    </head>
    <body>
        <div id="localVideo"></div>
        <div id="remotesVideos"></div>
    </body>
</html>

```

### 1. Create our WebRTC object

```js
var webrtc = new WebRTC({
    // the id/element dom element that will hold "our" video
    localVideoEl: 'localVideo',
    // the id/element dom element that will hold remote videos
    remoteVideosEl: 'remotesVideos',
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
