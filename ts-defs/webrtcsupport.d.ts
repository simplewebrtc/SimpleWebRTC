/// <reference types="webrtc" />
/**
 * A tiny browser module for detecting support for WebRTC and also for extracting the necessary constructors such as PeerConnection, SessionDescription, and IceCandidate.
 *
 * @interface WebRTCSupport
 */
interface WebRTCSupport {
	/**
	 * whether basic WebRTC support exists
	 *
	 * @type {boolean}
	 * @memberOf WebRTCSupport
	 */
	support: boolean;

    /**
     * browser version
     *
     * @type {number}
     * @memberOf WebRTCSupport
     */
    browserVersion: number;

    /**
     * whether basic support for RTCPeerConnection exists
     *
     * @type {boolean}
     * @memberOf WebRTCSupport
     */
    supportRTCPeerConnection: boolean;

    /**
     * guess whether VP8 is supported by the browser
     *
     * @type {boolean}
     * @memberOf WebRTCSupport
     */
    supportVp8: boolean;

    /**
     * whether getUserMedia is supported by the browser
     *
     * @type {boolean}
     * @memberOf WebRTCSupport
     */
    supportGetUserMedia: boolean;

    /**
     *  whether WebRTC data channels are supported
     *
     * @type {boolean}
     * @memberOf WebRTCSupport
     */
    supportDataChannel: boolean;

    /**
     * whether WebAudio API is supported
     *
     * @type {boolean}
     * @memberOf WebRTCSupport
     */
    supportWebAudio: boolean;

    /**
     * whether MediaStream is supported
     *
     * @type {boolean}
     * @memberOf WebRTCSupport
     */
    supportMediaStream: boolean;

    /**
     * guess of whether screensharing is supported
     *
     * @type {boolean}
     * @memberOf WebRTCSupport
     */
    supportScreenSharing: boolean;

    /**
     * browser prefix (either moz or webkit for now)
     *
     * @type {string}
     * @memberOf WebRTCSupport
     */
    prefix: string;

    /**
     * the audio context constructor from the web audio API
     *
     * @type {AudioContext}
     * @memberOf WebRTCSupport
     */
    AudioContext: new() => AudioContext;

    /**
     * constructor for creating a peer connection
     *
     * @memberOf WebRTCSupport
     */
    PeerConnection: new(configuration?: RTCConfiguration) => RTCPeerConnection;

    /**
     * constructor for RTCSessionDescriptions
     *
     *
     * @memberOf WebRTCSupport
     */
    SessionDescription: new(descriptionInitDict: RTCSessionDescriptionInit) => RTCSessionDescription;

    /**
     * constructor for ice candidate
     *
     *
     * @memberOf WebRTCSupport
     */
    IceCandidate: new() => RTCIceCandidate;

    /**
     * constructor for MediaStreams
     *
     *
     * @memberOf WebRTCSupport
     */
    MediaStream: new(streamOrTracks?: MediaStream | MediaStreamTrack[]) => MediaStream;
    getUserMedia: NavigatorGetUserMedia; // getUserMedia function
}

declare module "webrtcsupport" {
	export = webrtcsupport;
}

declare var webrtcsupport: WebRTCSupport;
