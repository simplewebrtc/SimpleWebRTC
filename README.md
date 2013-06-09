# SimpleWebRTC - World's easiest WebRTC lib

Check out the demo: http://conversat.io

Run / check out the example in index.html to see the various options (to enable chat, broadcasting only, audio only, etc.)

Check it out in action on Urbien.com (don't forget the underscore before the room name):
    http://urbien.com/app/UrbienApp#chatPrivate/_yourChatRoomName


## It's so easy:

### 1. Some basic html

```html
<!DOCTYPE html>
<html>
    <head>
        <script src="/path/to/socket.io.js"></script> 
        <script src="/path/to/simplewebrtc.js"></script> 
    </head>
    <body>
        <div id="localMedia"></div>
        <div id="remoteMedia"></div>
    </body>
</html>

```

### 1. Create our WebRTC object

```js
var webrtc = new WebRTC({
    local: {
        // the id/element dom element that will hold "our" video
        _el: 'localMedia',
        muted: true // we dont' want to hear ourselves in our headphones
    }
    remote: {
        // the id/element dom element that will hold remote videos
        _el: 'remoteMedia'
    }
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

webrtc.on('dataMessage', function (data, conversation) {
    // you can name it anything
	console.log(conversation.id, 'says:', data);
});

### Optional Parameters

```
video: {
    send: false, // if you don't want to send video
    receive: false, // if you don't want to receive video
    preview: false // if you don't want to preview your video (local media)
},
audio {
    send: false, // if you don't want to send audio
    receive: false // if you don't want to receive audio
},
data: false // if you don't want to open a data channel (for text chat, file sharing, etc.)

iceServers: {"iceServers":[{"url":"stun:124.124.124.2"}]}
```
