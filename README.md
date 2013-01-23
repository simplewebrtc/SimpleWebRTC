# webrtc.js - World's easiest webrtc lib

## Simplest WebRTC ever

Starting a video call:

```js
// create our webrtc connection
var connection = new WebRTC();

connection.on('ready', function () {
    connection.startVideoCall("userWeWantToCall");
});
```

If we use all the defaults you don't have to do anything other than create a connection

```js
// create our webrtc connection
var connection = new WebRTC();

connection.on('ready', function () {
    console.log('You can now be called at this ID: ' + connection.id); 
});
```


## A complete working example

Open [this] and then send the generated link to a friend by chat or something.

```html
<html>
    <head>
        <title>Webrtc.js Demo</title>
    </head>
    <body>
        <video id="localVideo" style="height: 300px; width: 400px">
        <video id="remoteVideo" style="height: 300px; width: 400px">
        <p>Someone can call you by clicking here: <a id="link" href=""></a></p>
        <script src="webrtc.js"></script>
        <script>
            // get our link element (we'll put our connection ID in there)
            var link = document.getElementById('link'),
                userWeWantToCall = location.search && location.search.split('?')[1];

            // create our webrtc connection
            var connection = new WebRTC();

            // if wewhen it's ready call if we've got an id in our URL
            connection.on('ready', function () {
                // here we just create a link that can be used to call you
                var url = '?' + connection.id;
                link.href = url;
                link.innerHTML = url;

                // if we've got an id in the url, start the call
                if (userWeWantToCall) {
                    connection.startVideoCall(userWeWantToCall);
                }
            });
        </script>
    </body>
</html>
```
