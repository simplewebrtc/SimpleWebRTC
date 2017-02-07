// Type definitions for SimpleWebRTC v2.2.2
// Project: https://simplewebrtc.com/
// Definitions by: Konstantin Mamaev <https://github.com/MrMeison>

/// <reference types="socket.io-client" />
/// <reference types="webrtc" />
/// <reference path="webrtcsupport.d.ts" />

interface SimpleWebRTC {
	new (options: SimpleWebRTCOptions): SimpleWebRTC;

	/**
	 * the webrtcSupport object that describes browser capabilities, for convenience
	 *
	 * @type {WebRTCSupport}
	 * @memberOf SimpleWebRTC
	 */
	capabilities: WebRTCSupport;

	/**
	 * the configuration options extended from options passed to the constructor
	 *
	 * @type {SimpleWebRTCOptions}
	 * @memberOf SimpleWebRTC
	 */
	config: SimpleWebRTCOptions;

	/**
	 * the socket (or alternate) signaling connection
	 *
	 * @type {SocketIO.Client}
	 * @memberOf SimpleWebRTC
	 */
	connection: SocketIoConnection;

	/**
	 * the underlying WebRTC session manager
	 *
	 * @type {WebRTCWrapper}
	 * @memberOf SimpleWebRTC
	 */
	webrtc: WebRTCWrapper;

}

interface SimpleWebRTCPeerOptions {
	readonly id: string;
	readonly sid: string;
	/**
	 * message type, "offer", "screen", "video", "audio"
	 *
	 * @type {string}
	 * @memberOf SimpleWebRTCPeerOptions
	 */
	readonly type: string;

	/**
	 * enable
	 *
	 * @type {boolean}
	 * @memberOf SimpleWebRTCPeerOptions
	 */
	readonly enableDataChannels: boolean;
	readonly sharemyscreen: boolean;
	readonly broadcaster: boolean;
}
interface SimpleWebRTCPeer {
	new (options: SimpleWebRTCPeerOptions): SimpleWebRTCPeer;
	readonly id: string;
	readonly pc: RTCPeerConnection;
	readonly parent: WebRTCWrapper;
	readonly type: string;
	readonly oneway: boolean;
	readonly sharemyscreen: boolean;
	readonly browserPrefix: string;
	readonly stream: MediaStream;
	readonly enableDataChannels: boolean;
	readonly receiveMedia: RTCConfiguration;
	readonly channels: Array<RTCDataChannel>;
	readonly sid: string;

	/**
	 * emmited when peer sending file
	 *
	 * @param {"fileTransfer"} event
	 * @param {(metadata: { name: string, size: number }, receiver: any) => void} callback
	 *
	 * @memberOf SimpleWebRTCPeer
	 */
	on(event: "fileTransfer", callback: (metadata: { name: string, size: number }, receiver: any) => void): void;
}

interface SimpleWebRTCMuteData {
	/**
	 * SimpleWebRTCPeer id
	 *
	 * @type {string}
	 * @memberOf SimpleWebRTCMuteData
	 */
	id: string;

	/**
	 * name of payload data
	 *
	 * @type {string}
	 * @memberOf SimpleWebRTCMuteData
	 */
	name: string;
}

interface WebRTCWrapper {
	/**
	 * emitted when the signaling connection emits the connect event, with the unique id for the session
	 *
	 * @param {"connectionReady"} event
	 * @param {(sessionId: string) => void} listener
	 *
	 * @memberOf WebRTCWrapper
	 */
	on(event: "connectionReady", listener: (sessionId: string) => void): void;

	/**
	 * emitted three times:
	 * when joining a room with existing peers, once for each peer
	 * when a new peer joins a joined room
	 * when sharing screen, once for each peer
	 *
	 * @param {"createdPeer"} event
	 * @param {(peer: SimpleWebRTCPeer) => void} listener
	 *
	 * @memberOf WebRTCWrapper
	 */
	on(event: "createdPeer", listener: (peer: SimpleWebRTCPeer) => void): void;

	/**
	 * emitted when the signaling connection emits the same event
	 *
	 * @param {"stunservers"} event
	 * @param {(...args: any[]) => void} listener
	 *
	 * @memberOf WebRTCWrapper
	 */
	on(event: "stunservers", listener: (...args: any[]) => void): void;

	/**
	 *  emitted when the signaling connection emits the same event
	 *
	 * @param {"turnservers"} event
	 * @param {(...args: any[]) => void} listener
	 *
	 * @memberOf WebRTCWrapper
	 */
	on(event: "turnservers", listener: (...args: any[]) => void): void;

	/**
	 * emitted after triggering the start of screen sharing
	 *
	 * @param {"localScreenAdded"} event
	 * @param {(videoElement: HTMLVideoElement) => void} listener
	 *
	 * @memberOf WebRTCWrapper
	 */
	on(event: "localScreenAdded", listener: (element: HTMLElement) => void): void;

	/**
	 * emitted after successfully leaving the current room, ending all peers, and stopping the local screen stream
	 *
	 * @param {"leftRoom"} event
	 * @param {(roomName: string) => void} listener
	 *
	 * @memberOf WebRTCWrapper
	 */
	on(event: "leftRoom", listener: (roomName: string) => void): void;

	/**
	 * emitted when a peer stream is added
	 *
	 * @param {"videoAdded"} event
	 * @param {(videoElement: HTMLVideoElement, peer: SimpleWebRTCPeer) => void} listener
	 *
	 * @memberOf WebRTCWrapper
	 */
	on(event: "videoAdded", listener: (videoElement: HTMLVideoElement, peer: SimpleWebRTCPeer) => void): void;

	/**
	 * emitted when a peer stream is removed
	 *
	 * @param {"videoRemoved"} event
	 * @param {(videoElement: HTMLVideoElement, peer: SimpleWebRTCPeer) => void} listener
	 *
	 * @memberOf WebRTCWrapper
	 */
	on(event: "videoRemoved", listener: (videoElement: HTMLVideoElement, peer: SimpleWebRTCPeer) => void): void;

	/**
	 * emitted when a local p2p/ice failure
	 *
	 * @param {"iceFailed"} event
	 * @param {(peer: SimpleWebRTCPeer) => void} listener
	 *
	 * @memberOf WebRTCWrapper
	 */
	on(event: "iceFailed", listener: (peer: SimpleWebRTCPeer) => void): void;

	/**
	 * emitted when a local p2p/ice failure
	 *
	 * @param {"connectivityError"} event
	 * @param {(peer: SimpleWebRTCPeer) => void} listener
	 *
	 * @memberOf WebRTCWrapper
	 */
	on(event: "connectivityError", listener: (peer: SimpleWebRTCPeer) => void): void;

	/**
	 *  emitted when a local audio volume changed
	 *
	 * @param {"volumeChange"} event
	 * @param {(volume: number, treshold: number) => void} listener
	 *
	 * @memberOf WebRTCWrapper
	 */
	on(event: "volumeChange", listener: (volume: number, treshold: number) => void): void;

	/**
	 * emitted when a remote audio volume changed
	 *
	 * @param {"remoteVolumeChange"} event
	 * @param {(peer: SimpleWebRTCPeer, volume: number) => void} listener
	 *
	 * @memberOf WebRTCWrapper
	 */
	on(event: "remoteVolumeChange", listener: (peer: SimpleWebRTCPeer, volume: number) => void): void;

	/**
	 *  emitted when a local audio muted
	 *
	 * @param {"mute"} event
	 * @param {(data: SimpleWebRTCMuteData) => void} listener
	 *
	 * @memberOf WebRTCWrapper
	 */
	on(event: "mute", listener: (data: SimpleWebRTCMuteData) => void): void;

	/**
	 * emitted when a local audio unmuted
	 *
	 * @param {"unmute"} event
	 * @param {(data: SimpleWebRTCMuteData) => void} listener
	 *
	 * @memberOf WebRTCWrapper
	 */
	on(event: "unmute", listener: (data: SimpleWebRTCMuteData) => void): void;

	/**
	 * emitted when a local audio turned on
	 *
	 * @param {"audioOn"} event
	 * @param {() => void} listener
	 *
	 * @memberOf WebRTCWrapper
	 */
	on(event: "audioOn", listener: () => void): void;

	/**
	 * emitted when a local audio turned off
	 *
	 * @param {"audioOff"} event
	 * @param {() => void} listener
	 *
	 * @memberOf WebRTCWrapper
	 */
	on(event: "audioOff", listener: () => void): void;

	/**
	 * emitted when a local video turned on
	 *
	 * @param {"videoOn"} event
	 * @param {() => void} listener
	 *
	 * @memberOf WebRTCWrapper
	 */
	on(event: "videoOn", listener: () => void): void;

	/**
	 * emitted when a local video turned off
	 *
	 * @param {"videoOff"} event
	 * @param {() => void} listener
	 *
	 * @memberOf WebRTCWrapper
	 */
	on(event: "videoOff", listener: () => void): void;

	/**
	 *
	 *
	 * @param {"speaking"} event
	 * @param {() => void} listener
	 *
	 * @memberOf WebRTCWrapper
	 */
	on(event: "speaking", listener: () => void): void;
	on(event: "stoppedSpeaking", listener: () => void): void;

	/**
	 * emitted when local connection ready to call
	 *
	 * @param {"readyToCall"} event
	 * @param {() => void} listener
	 *
	 * @memberOf WebRTCWrapper
	 */
	on(event: "readyToCall", listener: () => void): void;


	/**
	 * emitted when local stream was added
	 *
	 * @param {"localStream"} event
	 * @param {(stream: MediaStream) => void} listener
	 *
	 * @memberOf WebRTCWrapper
	 */
	on(event: "localStreamAdded", listener: (videoElement: HTMLVideoElement) => void): void;

	/**
	 * emitted when the permissions were obtained
	 *
	 * @param {"localStream"} event
	 * @param {(videoElement: HTMLVideoElement) => void} listener
	 *
	 * @memberOf WebRTCWrapper
	 */
	on(event: "localStream", listener: (stream: MediaStream) => void): void;

	/**
	 * emitted when the access to the camera wasn't obtained
	 *
	 * @param {"localMediaError"} event
	 * @param {(error: Error) => void} listener
	 *
	 * @memberOf WebRTCWrapper
	 */
	on(event: "localMediaError", listener: (error: Error) => void): void;

	/**
	 * emits the create event on the connection with name and (if provided) invokes callback on response
	 *
	 * @param {string} name room's name
	 * @param {() => void} callback invoke when create connection
	 *
	 * @memberOf WebRTCWrapper
	 */
	createRoom(name: string, callback: () => void): void;

	/**
	 * joins the conference in room name
	 *
	 * @param {string} name room name
	 * @param {(error: Error, roomDescription: any) => void} callback yielded by the connection on the join event
	 *
	 * @memberOf WebRTCWrapper
	 */
	joinRoom(name: string, callback: (error: Error, roomDescription: any) => void): void;

	/**
	 * starts the local media with the media options provided in the config passed to the constructor
	 *
	 * @memberOf WebRTCWrapper
	 */
	startLocalVideo(): void;

	/**
	 * tests that the connection is ready and that (if media is enabled) streams have started
	 *
	 *
	 * @memberOf WebRTCWrapper
	 */
	testReadiness(): void;

	/**
	 * mutes the local audio stream for all peers (pauses sending audio)
	 *
	 *
	 * @memberOf WebRTCWrapper
	 */
	mute(): void;

	/**
	 * unmutes local audio stream for all peers (resumes sending audio)
	 *
	 *
	 * @memberOf WebRTCWrapper
	 */
	unmute(): void;

	/**
	 * pauses sending video to peers
	 *
	 *
	 * @memberOf WebRTCWrapper
	 */
	pauseVideo(): void;

	/**
	 * resumes sending video to all peers
	 *
	 *
	 * @memberOf WebRTCWrapper
	 */
	resumeVideo(): void;

	/**
	 * pauses sending audio and video to all peers
	 *
	 *
	 * @memberOf WebRTCWrapper
	 */
	pause(): void;

	/**
	 * resumes sending audio and video to all peers
	 *
	 *
	 * @memberOf WebRTCWrapper
	 */
	resume(): void;

	/**
	 * sends message to all
	 *
	 * @param {string} messageType the key for the type of message being sent
	 * @param {any} payload  an arbitrary value or object to send to peers
	 *
	 * @memberOf WebRTCWrapper
	 */
	sendToAll(messageType: string, payload: any): void;

	/**
	 * broadcasts a message to all peers in the room via a dataChannel
	 *
	 * @param {string} channelLabel  the label for the dataChannel to send on
	 * @param {string} messageType the key for the type of message being sent
	 * @param {*} payload an arbitrary value or object to send to peers
	 *
	 * @memberOf WebRTCWrapper
	 */
	sendDirectlyToAll(channelLabel: string, messageType: string, payload: any): void;

	/**
	 * returns all peers by sessionId and/or type
	 *
	 * @param {string} [sessionId]
	 * @param {string} [type]
	 * @returns {Array<SimpleWebRTCPeer>}
	 *
	 * @memberOf WebRTCWrapper
	 */
	getPeers(sessionId?: string, type?: string): Array<SimpleWebRTCPeer>;

	/**
	 *  initiates screen capture request to browser, then adds the stream to the conference
	 *
	 * @param {() => void} callback
	 *
	 * @memberOf WebRTCWrapper
	 */
	shareScreen(callback: () => void): void;


	/**
	 * returns the local screen stream
	 *
	 * @returns {MediaStream}
	 *
	 * @memberOf WebRTCWrapper
	 */
	getLocalScreen(): MediaStream;

	/**
	 *  stops the screen share stream and removes it from the room
	 *
	 *
	 * @memberOf WebRTCWrapper
	 */
	stopScreenShare(): void;

	/**
	 * stops all local media streams
	 *
	 *
	 * @memberOf WebRTCWrapper
	 */
	stopLocalVideo(): void;

	/**
	 * used to set the volume level for all peers
	 *
	 * @param {number} volume the volume level, between 0 and 1
	 *
	 * @memberOf WebRTCWrapper
	 */
	setVolumeForAll(volume: number): void;

	/**
	 * leaves the currently joined room and stops local screen share
	 *
	 *
	 * @memberOf WebRTCWrapper
	 */
	leaveRoom(): void;

	/**
	 * calls disconnect on the signaling connection and deletes it
	 *
	 *
	 * @memberOf WebRTCWrapper
	 */
	disconnect(): void;

	/**
	 * used internally to attach media stream to the DOM and perform other setup
	 *
	 * @param {SimpleWebRTCPeer} peer
	 *
	 * @memberOf WebRTCWrapper
	 */
	handlePeerStreamAdded(peer: SimpleWebRTCPeer): void;

	/**
	 * used internally to remove the video container from the DOM and emit videoRemoved
	 *
	 * @param {SimpleWebRTCPeer} peer
	 *
	 * @memberOf WebRTCWrapper
	 */
	handlePeerStreamRemoved(peer: SimpleWebRTCPeer): void;

	/**
	 * used internally to get the DOM id associated with a peer
	 *
	 * @param {SimpleWebRTCPeer} peer
	 *
	 * @returns {string}
	 * @memberOf WebRTCWrapper
	 */
	getDomId(peer: SimpleWebRTCPeer): string;

	/**
	 * helper used internally to get an element where idOrEl is either an element, or an id of an element
	 *
	 * @param {(string | HTMLElement)} idOrEl
	 * @returns {HTMLElement}
	 *
	 * @memberOf WebRTCWrapper
	 */
	getEl(idOrEl: string | HTMLElement): HTMLElement;

	/**
	 * used internally to get the container that will hold the local video element
	 *
	 * @returns {HTMLElement}
	 *
	 * @memberOf WebRTCWrapper
	 */
	getLocalVideoContainer(): HTMLElement;

	/**
	 * used internally to get the container that holds the remote video elements
	 *
	 * @returns {HTMLElement}
	 *
	 * @memberOf WebRTCWrapper
	 */
	getLocalVideoContainer(): HTMLElement;

}

/**
 * subset console logging
 *
 * @interface SimpleWebRTCLogger
 */
interface SimpleWebRTCLogger {
	error(message?: any, ...optionalParams: any[]): void;
	log(message?: any, ...optionalParams: any[]): void;
	warn(message?: any, ...optionalParams: any[]): void;
}
interface LocalVideoOptions {
	/**
	 * automatically play the video stream on the page
	 *
	 * @type {boolean}
	 * @memberOf LocalVideoOptions
	 */
	autoplay: boolean;

	/**
	 * flip the local video to mirror mode (for UX)
	 *
	 * @type {boolean}
	 * @memberOf LocalVideoOptions
	 */
	mirror: boolean;

	/**
	 * mute local video stream to prevent echo
	 *
	 * @type {boolean}
	 * @memberOf LocalVideoOptions
	 */
	muted: boolean;
}

interface SocketIoConnection {
	new (config: SimpleWebRTCOptions): SocketIoConnection;

	/**
	 * Adds a listener for a particular event. Calling multiple times will add
	 * multiple listeners
	 * @param {string} event The event that we're listening for
	 * @param {Function} fn The function to call when we get the event. Parameters depend on the
	 * event in question
	 *
	 * @memberOf SocketIoConnection
	 */
	on(event: string, fn: Function): void;

	/**
	 * Emits 'event' with the given args
	 *
	 * @param {string} event The event that we want to emit
	 * @param {...any[]} args Optional arguments to emit with the event
	 *
	 * @memberOf SocketIoConnection
	 */
	emit(event: string, ...args: any[]): void;

	/**
	 * The ID of the socket; matches the server ID and is set when we're connected, and cleared
	 * when we're disconnected
	 *
	 * @returns {string}
	 *
	 * @memberOf SocketIoConnection
	 */
	getSessionid(): string;

	/**
	 * Disconnects the socket manually
	 *
	 * @returns {number}
	 *
	 * @memberOf SocketIoConnection
	 */
	disconnect(): number;
}
interface SimpleWebRTCOptions {
	/**
	 * url for signaling server.
	 * @default https://sandbox.simplewebrtc.com:443/
	 *
	 * @type {string}
	 * @memberOf SimpleWebRTCOptions
	 */
	url: string;

	/**
	 * object to be passed as options to the signaling server connection
	 *
	 * @type {SocketIOClient.ConnectOpts}
	 * @memberOf SimpleWebRTCOptions
	 */
	socketio?: SocketIOClient.ConnectOpts;

	/**
	 * connection object for signaling, Defaults to a new SocketIoConnection
	 *
	 * @type {SocketIoConnection}
	 * @memberOf SimpleWebRTCOptions
	 */
	connection?: SocketIoConnection;
	/**
	 * optional, flag to set the instance to debug mode
	 *
	 * @type {boolean}
	 * @memberOf SimpleWebRTCOptions
	 */
	debug?: boolean;
	/**
	 * ID or Element to contain the local video element
	 *
	 * @type {(string | HTMLElement)}
	 * @memberOf SimpleWebRTCOptions
	 */
	localVideoEl: string | HTMLElement;
	/**
	 * ID or Element to contain the remote video elements
	 *
	 * @type {(string | HTMLElement)}
	 * @memberOf SimpleWebRTCOptions
	 */
	remoteVideosEl: string | HTMLElement;

	/**
	 * option to automatically request user media. Use true to request automatically, or false to request media later with startLocalVideo
	 * @default false
	 *
	 * @type {boolean}
	 * @memberOf SimpleWebRTCOptions
	 */
	autoRequestMedia?: boolean;

	/**
	 * option to enable/disable data channels (used for volume levels or direct messaging)
	 * @default true
	 *
	 * @type {boolean}
	 * @memberOf SimpleWebRTCOptions
	 */
	enableDataChannels?: boolean;

	/**
	 * option to automatically remove video elements when streams are stopped.
	 * @default true
	 *
	 * @type {boolean}
	 * @memberOf SimpleWebRTCOptions
	 */
	autoRemoveVideos?: boolean;

	/**
	 * option to reduce peer volume when the local participant is speaking
	 * @default false
	 *
	 * @type {boolean}
	 * @memberOf SimpleWebRTCOptions
	 */
	adjustPeerVolume?: boolean;

	/**
	 *  value used in conjunction with adjustPeerVolume. Uses values between 0 and 1.
	 * @default 0.25
	 *
	 * @type {number}
	 * @memberOf SimpleWebRTCOptions
	 */
	peerVolumeWhenSpeaking?: number;

	/**
	 * edia options to be passed to getUserMedia.
	 * @default { video: true, audio: true }.
	 *
	 * @type {MediaStreamConstraints}
	 * @memberOf SimpleWebRTCOptions
	 */
	media?: MediaStreamConstraints;

	/**
	 * RTCPeerConnection options
	 * Defaults { offerToReceiveAudio: 1, offerToReceiveVideo: 1 }
	 *
	 * @type {RTCConfiguration}
	 * @memberOf SimpleWebRTCOptions
	 */
	receiveMedia?: RTCConfiguration;

	/**
	 * options for attaching the local video stream to the page
	 * @default { autoplay: true, mirror: true, muted: true }
	 * @type {LocalVideoOptions}
	 * @memberOf SimpleWebRTCOptions
	 */
	localVideo?: LocalVideoOptions;

	/**
	 * alternate logger for the instance; any object that implements log, warn, and error methods.
	 *
	 * @type {SimpleWebRTCLogger}
	 * @memberOf SimpleWebRTCOptions
	 */
	logger?: SimpleWebRTCLogger;

	/**
	 * User-friendly nickname
	 *
	 * @type {string}
	 * @memberOf SimpleWebRTCOptions
	 */
	nick?: string;

}

declare module "simplewebrtc" {
	export = simpleWebRTC;
}

declare var simpleWebRTC: SimpleWebRTC;
