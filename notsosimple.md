# Do not use the default sandbox signaling server in production

The signaling server is a server that helps the two browsers exchange a small amount of information they need to connect to each other in a secure manner.

We provide a sandbox signaling server so it easy to get started. However, installing [signalmaster](https://github.com/andyet/signalmaster) is one of the first things to do when you want to dive deeper. Then just point the url attribute in the SimpleWebRTC constructor to your server url:
```
var webrtc = new SimpleWebRTC({
  // the id/element dom element that will hold "our" video
  localVideoEl: 'localVideo',
  // the id/element dom element that will hold remote videos
  remoteVideosEl: 'remotesVideos',
  // immediately ask for camera access
  autoRequestMedia: true,
  url: 'https://example.com/'
});
```

# Add style your video element
Most of the time, you want to wrap your video element in a container, e.g. to add overlays instead of just having raw unstyled video elements in your remote video container.

To do this, you need to supress adding them to the remote video container by passing an empty string for the container id:
```
var webrtc = new SimpleWebRTC({
  localVideoEl: 'localVideo',
  remoteVideosEl: '' // empty string
});
```
Then, you need to hook the <i>videoAdded</i> event. It is called with the video element and the peer session as an argument:
```
// a peer video has been added
webrtc.on('videoAdded', function (video, peer) {
    console.log('video added', peer);
    var remotes = document.getElementById('remotes');
    if (remotes) {
        var container = document.createElement('div');
        container.className = 'videoContainer';
        container.id = 'container_' + webrtc.getDomId(peer);
        container.appendChild(video);

        // suppress contextmenu
        video.oncontextmenu = function () { return false; };

        remotes.appendChild(container);
    }
});
```
You create div element, set a className so you can style all video containers using CSS and add an id so you can remove that video element later on.

```
// a peer video was removed
webrtc.on('videoRemoved', function (video, peer) {
    console.log('video removed ', peer);
    var remotes = document.getElementById('remotes');
    var el = document.getElementById(peer ? 'container_' + webrtc.getDomId(peer) : 'localScreenContainer');
    if (remotes && el) {
        remotes.removeChild(el);
    }
});
```
Lets add a little CSS so you can create overlays in the next step:
```
.videoContainer {
    position: relative;
    width: 200px;
    height: 150px;
}
.videoContainer video {
    position: absolute;
    width: 100%;
    height: 100%;
}
```
See the <a href="/demo.html">demo page</a> for a complete example.


# Show more information about the state of the connection
The way the [RTCPeerConnection API](https://w3c.github.io/webrtc-pc/) works you get the stream (and therefore the video element) before the P2P connection is fully established. Therefore it's a good idea to display information about the state of the connection as done on the [demo page](/demo.html). Just extend the previous example a little bit by adding the following piece of code in the videoAdded event:
```
    // show the ice connection state
    if (peer && peer.pc) {
        var connstate = document.createElement('div');
        connstate.className = 'connectionstate';
        container.appendChild(connstate);
        peer.pc.on('iceConnectionStateChange', function (event) {
            switch (peer.pc.iceConnectionState) {
            case 'checking':
                connstate.innerText = 'Connecting to peer...';
                break;
            case 'connected':
            case 'completed': // on caller side
                connstate.innerText = 'Connection established.';
                break;
            case 'disconnected':
                connstate.innerText = 'Disconnected.';
                break;
            case 'failed':
                break;
            case 'closed':
                connstate.innerText = 'Connection closed.';
                break;
            }
        });
    }
```
This code adds an overlay inside the video container that visualized the connection state. Whenever the connection state changes, the callback for the iceConnectionStateChange will be called and you can inspect the new state of the connection. Note that some events like <i>connected</i> or <i>disconnected</i> can be called multiple times when there are short interruptions in connectivity. Now let's just add another bit of CSS:
```
.connectionstate {
    position: absolute;
    top: 0px;
    width: 100%;
    text-align: center;
    color: #fff
}
```
This positions the displayed at the top of the video container, centers it and makes it white. Of course, you can display it any other way you want, it just depends on your CSS magic.

The *failed* state is somewhat special. In Chrome, this can only occur on the initiating side whereas in Firefox it can happen on both sides. SimpleWebRTC abstracts this by providing two events for this:
```
// local p2p/ice failure
webrtc.on('iceFailed', function (peer) {
    var connstate = document.querySelector('#container_' + webrtc.getDomId(peer) + ' .connectionstate');
    console.log('local fail', connstate);
    if (connstate) {
        connstate.innerText = 'Connection failed.';
        fileinput.disabled = 'disabled';
    }
});

// remote p2p/ice failure
webrtc.on('connectivityError', function (peer) {
    var connstate = document.querySelector('#container_' + webrtc.getDomId(peer) + ' .connectionstate');
    console.log('remote fail', connstate);
    if (connstate) {
        connstate.innerText = 'Connection failed.';
        fileinput.disabled = 'disabled';
    }
});
```
For the purpose of the sample, this is just handled by showing it to the user.


# Show audio levels
Another thing that is nice to show is the audio level of a participant. We are going to use [hark](https://github.com/otalk/hark), an awesome Javascript module, to extract the audio level from the MediaStream with the WebAudio API. One of the advantage of this over other techniques (like querying the PeerConnections getStats method) is that it does not require an established peer-to-peer connection and therefore can be used in a screen that allows the users to check their microphone before joining a conference.

Since we will have different sources for the volume, let's start with a helper function that changes the height of a value of a HTML5 *meter* element that is overlayed ontop of the video element:
```
// helper function to show the volume
function showVolume(el, volume) {
    console.log('showVolume', volume, el);
    if (!el) return;
    if (volume < -45) volume = -45; // -45 to -20 is
    if (volume > -20) volume = -20; // a good range
    el.value = volume;
}
```
See the [hark documentation](https://github.com/otalk/hark#understanding-dbvolume-threshold) for the meaning of the volume parameter and play around with the parameters a little.


Next, add a little bit of CSS:
```
.volume {
    position: absolute;
    left: 15%;
    width: 70%;
    bottom: 2px;
    height: 10px;
}
```
And we need to create this volume meter element when creating the remote video, so add the following piece of code in the videoAdded element:
```
    // show the remote volume
    var vol = document.createElement('meter');
    vol.id = 'volume_' + peer.id;
    vol.className = 'volume';
    vol.min = -45;
    vol.max = -20;
    vol.low = -40;
    vol.high = -25;
    container.appendChild(vol);
```
See the [demo](/demo.html) for the full code. If you test this make sure you open the page in two different windows, not tabs, since browsers limit the number of times callbacks are executed in background pages.

Now, hook it up with the localStream. SimpleWebRTC includes hark and lets you subscribe to a *volumeChange* event:
```
// local volume has changed
webrtc.on('volumeChange', function (volume, treshold) {
    showVolume(document.getElementById('localVolume'), volume);
});
```
Now you should get a nice volume meter when you speak. Isn't that awesome?


Showing the volume of remote participants is a little more tricky due to the Chrome bug (which has since been fixed). Under the hood, this involves WebRTC datachannels and transferring the local volume to your peers. But everything is nicely hidden by SimpleWebRTC, so all you need is this little piece of Javascript:
```
// remote volume has changed
webrtc.on('remoteVolumeChange', function (peer, volume) {
    showVolume(document.getElementById('volume_' + peer.id), volume);
});
```
That's it. Showing the remote volume helps you visually identify noisy participants and allows you to mute them.


# All about muting
There are a number of usecases where you want to mute either your own audio/video stream or the stream of a remote participant. Let's look at those in detail.


Muting your own audio is pretty easy. To mute, just call `webrtc.mute()` and to unmute call `webrtc.unmute()`

Pretty simple, eh? If you hook it up to a button, make sure you wrap іt inside a function which just toggles a *muted* state.


Turning video on and off works similar, use the <i>.pauseVideo()</i> and <i>.resumeVideo()</i> methods to control the video:
```
webrtc.pauseVideo();
webrtc.resumeVideo();
```
Now, if you want to mute your audio and not send video there is a shortcut for that. The *.pause()* and *.resume()* methods. Unfortunately, this modifies both your muted and video send state, so make sure you keep track of those states.

Internally, the mute methods work by changing the audio or video tracks *.enabled* flag. Setting this flag to false causes WebRTC implementations to send silence (for audio) and black frames (for video). This requires relatively little bandwidth.


So now you are no longer sending audio and video. Wouldn't it be nice if the remote side was notified of that so it could do something more useful than displaying a black frame?
Whenever you mute or unmute someone, a message is sent via the signaling channel. Listening for this message is easy:
```
// listen for mute and unmute events
webrtc.on('mute', function (data) { // show muted symbol
    webrtc.getPeers(data.id).forEach(function (peer) {
        if (data.name == 'audio') {
            $('#videocontainer_' + webrtc.getDomId(peer) + ' .muted').show();
        } else if (data.name == 'video') {
            $('#videocontainer_' + webrtc.getDomId(peer) + ' .paused').show();
            $('#videocontainer_' + webrtc.getDomId(peer) + ' video').hide();
        }
    });
});
webrtc.on('unmute', function (data) { // hide muted symbol
    webrtc.getPeers(data.id).forEach(function (peer) {
        if (data.name == 'audio') {
            $('#videocontainer_' + webrtc.getDomId(peer) + ' .muted').hide();
        } else if (data.name == 'video') {
            $('#videocontainer_' + webrtc.getDomId(peer) + ' video').show();
            $('#videocontainer_' + webrtc.getDomId(peer) + ' .paused').hide();
        }
    });
});
```
This uses jQuery to show and hide mute symbols as overlays ontop the video. Again, those elements need to be created in the videoAdded event:
```
// add muted and paused elements
    var muted = document.createElement('span');
    vol.className = 'muted';
    container.appendChild(muted);

    var muted = document.createElement('span');
    vol.className = 'muted';
    container.appendChild(muted);
```
and styled with a little CSS:
```
.muted, .paused
    display: none
    position: absolute
    z-index: 1
    color: #12acef

.muted
    left: 0px
    bottom: 10%
    width: 100%

.paused
    left: 0px
    top: 40%
    width: 100%
```
For the local video, similar events are available:
```
//local mute/unmute events
webrtc.on('audioOn', function () {
    // your local audio just turned on
});
webrtc.on('audioOff', function () {
    // your local audio just turned off
});
webrtc.on('videoOn', function () {
    // local video just turned on
});
webrtc.on('videoOff', function () {
    // local video just turned off
});
```
By the way, if you are looking for a way to mute a remote participant that is even easier. Just set the *video* elements *volume* attribute to 0.


# Filetransfer
Filetransfer refers to sending a file to a single peer. If you want to share the same file with multiple participants, uploading it to a server is most likely a better way to do it. Or implementing something like [Bittorrent over WebRTC](https://webtorrent.io). Using the following technique to share a file with multiple participants works, but will be limited by the upload speed.

Let's start with a modified version of the basic SimpleWebRTC HTML structure:
```
<html>
  <head>
    <script src="https://simplewebrtc.com/latest-v2.js"></script>
  </head>
  <body>
  <div id="remotes"></div>
  </body>
</html>
```
Next, lets create the SimpleWebRTC object. This time, we don't want audio or video, so we set autoRequestMedia to false and also tweak the receive options:
```
var webrtc = new SimpleWebRTC({
    // we don't do video
    localVideoEl: '',
    remoteVideosEl: '',
    // dont ask for camera access
    autoRequestMedia: false
    // dont negotiate media
    receiveMedia: {
        offerToReceiveAudio: 0,
        offerToReceiveVideo: 0
    }
});
```
Since the readyToJoin callback relies on having access to the camera we just ignore it and join the room directly:
```
// join without waiting for media
webrtc.joinRoom('your awesome room name');</code></pre>
        <p>This will join the room and create a connection with every peer that joins. So let's wait for a peer to join:</p>
        <pre><code>// called when a peer is created
webrtc.on('createdPeer', function (peer) {
    console.log('createdPeer', peer);
});
```
See the [filetransfer demo](filetransfer.html) for the full implementation. Now we can do two things with this peer:

* send them a file and
* receive a file from them.


Let's look at the receive part first:
```
// receiving an incoming filetransfer
peer.on('fileTransfer', function (metadata, receiver) {
    console.log('incoming filetransfer', metadata.name, metadata);
    receiver.on('progress', function (bytesReceived) {
        console.log('receive progress', bytesReceived, 'out of', metadata.size);
    });
    // get notified when file is done
    receiver.on('receivedFile', function (file, metadata) {
        console.log('received file', metadata.name, metadata.size);

        // close the channel
        receiver.channel.close();
    });
    filelist.appendChild(item);
});
```
The *filetransfer* event is called with some metadata about the file (such as the filename and the size) and a receiver object. This receiver object emits two events: *progress* and *receivedFile*:

* progress is called whenever receiving data from the peer. It can be hooked up to a HTML5 progress element quite nicely as shown in the demo.
* receivedFile is called when the transfer is complete. Its arguments are a blob object of the file and the metadata. The file can then be easily made available for download by creating an *a* element and setting the href attribute to a url created with URL.createObjectURL(file)

That was easy, wasn't it? Lets look at sending the file next.



First, we need the user to select a file to transfer. This is done with an input element:
```
// select a file
var fileinput = document.createElement('input');
fileinput.type = 'file';</code></pre>
        <p>We then need to listen for the change event on that filelistener:</p>
        <pre><code>// send a file
fileinput.addEventListener('change', function() {
    fileinput.disabled = true;

    var file = fileinput.files[0];
    var sender = peer.sendFile(file);
});
```
Actually, that's it. Most of the work is again making a nice UI for it. The sender object returned by sendFile emits three events:

* *progress*
* *sentFile*
* *complete*

*progress* can again be hooked up to a progress bar. <i>sentFile</i> indicates that the sender considers the transfer to be complete. Due to internal buffering this may sometimes happen before the receiver has received the complete file. Therefore it is not safe to close the connection before receiving the *complete* event.

Building a nice filetransfer application with this is pretty easy. Note that the demo does not fall back to using TURN servers. While that is pretty much required for doing voice-over-ip, for filetransfer it might actually be better to relay encrypted file chunks via third parties.
**TODO**: describe the protocol used to transfer files. File data is sent in chunks, prefixed by a single metadata object that is serialized JSON and contains at minimum the filename and size. The datachannels *protocol* field is set to *https://simplewebrtc.com/protocol/filetransfer#inband-v1*.


# Share your screen

Sharing your screen is simple, but requires a small amount of work outside of your application. Browsers support this in different ways. Capturing screen media requires your application to be running on https.

## Chrome
Chrome exposes APIs for screen sharing through the [desktopCapture extension API](https://developer.chrome.com/extensions/desktopCapture). The [getScreenMedia package](https://github.com/otalk/getScreenMedia) contains a [sample extension](https://github.com/HenrikJoreteg/getScreenMedia/tree/master/chrome-extension-sample) for enabling screen capture in Chrome.

To run the extension for your application, you just have to [load the extension](https://developer.chrome.com/extensions/getstarted#unpacked) and modify the manifest file to match your development url:
```
        <pre><code>"content_scripts": [ {
    "js": [ "content.js" ],
    "matches": [ "https://localhost:*/*" ]
  }]
});
```
Older versions of Chrome used a flag called <i>enable-usermedia-screen-capture</i>. This is no longer the supported mechanism for screen capture in Chrome, but is still used in Chromium Embedded Framework and Node Webkit applications.

## Firefox
Firefox enabled screen media capturing by default for secure origins in Firefox 52. In you need to care about older versions, see below.


Firefox enables screen media capturing through the <i>media.getusermedia.screensharing.allowed_domains</i> config setting. This can be modified automatically via an add-on, or it can be modified manually by navigating to *about:config* in Firefox. Modifying the setting manually to add *localhost* is easiest for development.
The [getScreenMedia repository](https://github.com/HenrikJoreteg/getScreenMedia/">getScreenMedia) also contains a [sample extension](https://github.com/HenrikJoreteg/getScreenMedia/tree/master/firefox-extension-sample). Just modify the boostrap.js file to match your domain:
```
var domains = ["simplewebrtc.com"];
```

## Microsoft Edge
Microsoft Edge recently started supporting [screensharing](https://blogs.windows.com/msedgedev/2018/05/02/bringing-screen-capture-to-microsoft-edge-media-capture-api/). This is fully supported in recent versions of SimpleWebRTC.

## Starting screen share
Wire up an event handler or action for a user to initiate screen sharing. Here, we have a button to be disabled when screen sharing is unavailable, and to start sharing screen when clicked:
```
var button = document.getElementById('screenShareButton'),
    setButton = function (bool) {
        button.innerText = bool ? 'share screen' : 'stop sharing';
    };
if (!webrtc.capabilities.supportScreenSharing) {
    button.disabled = 'disabled';
}
webrtc.on('localScreenRemoved', function () {
    setButton(true);
});

setButton(true);

button.click(function () {
    if (webrtc.getLocalScreen()) {
        webrtc.stopScreenShare();
        setButton(true);
    } else {
        webrtc.shareScreen(function (err) {
            if (err) {
                setButton(true);
            } else {
                setButton(false);
            }
        });

    }
});
```
Then, you need to hook the <i>localScreenAdded</i> and <i>localScreenRemoved</i> events for adding and removing the local screen video element to the page:<
```
// local screen obtained
webrtc.on('localScreenAdded', function (video) {
    video.onclick = function () {
        video.style.width = video.videoWidth + 'px';
        video.style.height = video.videoHeight + 'px';
    };
    document.getElementById('localScreenContainer').appendChild(video);
    $('#localScreenContainer').show();
});
// local screen removed
webrtc.on('localScreenRemoved', function (video) {
    document.getElementById('localScreenContainer').removeChild(video);
    $('#localScreenContainer').hide();
});
```
You can style and show connection states for the screen sharing video elements similar to the examples above for video.


# Selecting a microphone and camera

The first step to selecting media input devices is to enumerate sources which is done in a callback passed to *navigator.mediaDevices.enumerateDevices. Separate and label audio and video devices:
```
var audioDevices = [],
    videoDevices = [];
navigator.mediaDevices.enumerateDevices().then(function (devices) {
  for (var i = 0; i !== devices.length; ++i) {
      var device = devices[i];
      if (device.kind === 'audioinput') {
          device.label = device.label || 'microphone ' + (audioDevices.length + 1);
          audioDevices.push(device);
      } else if (device.kind === 'videoinput') {
          device.label = device.label || 'camera ' + (videoDevices.length + 1);
          videoDevices.push(device);
      }
  }
});
```
Note that device labels are empty if you do not yet have permission to access the camera or microphone.


You can then use these audio and video devices to populate a selection UI like a *select* tag, e.g. as shown [here](https://webrtc.github.io/samples/src/content/devices/input-output/). For example simplicity, we'll assume you can populate the UI with options and extract the selected option.


Once you have the selected option, the user can trigger starting the connection. You'll create the SimpleWebRTC object similar to the basic example, but with additional options passed to the <i>media</i> option:
```
//default media options
var mediaOptions = {
    audio: true,
    video: true
};
if (selectedAudioDevice && selectedAudioDevice.sourceId) {
    mediaOptions.audio = {
        deviceId: selectedAudioDevice.deviceId
    };
}
if (selectedVideoDevice && selectedVideoDevice.sourceId) {
    mediaOptions.video = {
        deviceId: selectedDevice.deviceId
    };
}
var webrtc = new SimpleWebRTC({
  localVideoEl: 'localVideo',
  remoteVideosEl: 'remotesVideos',
  autoRequestMedia: true,
  url: 'https://example.com/'
  //use the media options to pass constraints for getUserMedia requests
  media: mediaOptions
});
```

Now, when SimpleWebRTC requests user media from the browser, it will request the specific devices selected by the user.

# Fail, with grace
Sometimes, connections fail. While there is little you can do about that, you can make some educated guesses about the *why*. Most of the time, this is caused by one of the peers being on a restriced network. In that case (and assuming that you are using a TURN server) the PeerConnection will not have gathered any candidates of type relay. SimpleWebRTC makes very easy to detect by exposing a *hadLocalRelayCandidate* and *hadRemoteRelayCandidate* property which can be checked when ICE fails:
```
// local p2p/ice failure
webrtc.on('iceFailed', function (peer) {
    var pc = peer.pc;
    console.log('had local relay candidate', pc.hadLocalRelayCandidate);
    console.log('had remote relay candidate', pc.hadRemoteRelayCandidate);
});

// remote p2p/ice failure
webrtc.on('connectivityError', function (peer) {
    var pc = peer.pc;
    console.log('had local relay candidate', pc.hadLocalRelayCandidate);
    console.log('had remote relay candidate', pc.hadRemoteRelayCandidate);
});
```
Based on this, you can determine which end of the connection is behind a restricted network. For more details (than you ever wanted to know) watch [this talk](http://www.tokbox.com/blog/failed-techtok-with-philipp-hancke/).

# User-friendly nicknames
Sometimes, you want to display a nickname along with the video. That's now pretty simple, just add a 'nick' property to the config when creating the SimpleWebRTC object:
```
var webrtc = new SimpleWebRTC({
  // the id/element dom element that will hold "our" video
  localVideoEl: 'localVideo',
  // the id/element dom element that will hold remote videos
  remoteVideosEl: 'remotesVideos',
  // immediately ask for camera access
  autoRequestMedia: true,
  nick: 'Jane Doe',
  url: 'https://example.com/'
});
```
and evaluate peer.nick in the *videoAdded* event:
```
webrtc.on('videoAdded', function (video, peer) {
    console.log('videoAdded', peer.nick);
});
```
