'use strict';
var test = require('tape');

// https://code.google.com/p/selenium/wiki/WebDriverJs
var seleniumHelpers = require('webrtc-testbed/webdriver');
var webdriver = require('selenium-webdriver');

function doJoin(driver, room) {
    return driver.get('file://' + process.cwd() + '/test/index.html?' + room);
}

function iceConnected(driver) {
    return driver.wait(() => {
        return driver.executeScript(function () {
            return window.webrtc && window.webrtc.getPeers().length === 1 &&
                (window.webrtc.getPeers()[0].pc.iceConnectionState === 'connected' ||
                 window.webrtc.getPeers()[0].pc.iceConnectionState === 'completed');
        });
    }, 30 * 1000)
}

const TIMEOUT = 30000;
function waitNPeerConnectionsExist(driver, n) {
    return driver.wait(function() {
        return driver.executeScript(function(n) {
            return webrtc.getPeers().length === n;
        }, n);
    }, TIMEOUT);
}

function waitAllPeerConnectionsConnected(driver) {
    return driver.wait(function() {
        return driver.executeScript(function() {
            var peers = webrtc.getPeers();
            var states = [];
            peers.forEach(function(peer) {
                states.push(peer.pc.iceConnectionState);
            });
            return states.length === states.filter((s) => s === 'connected' || s === 'completed').length;
        });
    }, TIMEOUT);
}

function waitNVideosExist(driver, n) {
    return driver.wait(function() {
        return driver.executeScript(function(n) {
            return document.querySelectorAll('video').length === n;
        }, n);
    }, TIMEOUT);
}

function waitAllVideosHaveEnoughData(driver) {
    return driver.wait(function() {
        return driver.executeScript(function() {
            var videos = document.querySelectorAll('video');
            var ready = 0;
            for (var i = 0; i < videos.length; i++) {
                if (videos[i].readyState >= videos[i].HAVE_ENOUGH_DATA) {
                    ready++;
                }
            }
            return ready === videos.length;
        });
    }, TIMEOUT);
}

function testP2P(browserA, browserB, t) {
    const room = 'testing_' + Math.floor(Math.random() * 100000);

    const driverA = seleniumHelpers.buildDriver(browserA, {bver: process.env.BVER});
    const driverB = seleniumHelpers.buildDriver(browserB, {bver: process.env.BVER});
    const drivers = [driverA, driverB];

    return Promise.all(drivers.map(driver => doJoin(driver, room)))
    .then(() => {
        t.pass('joined room');
        return Promise.all(drivers.map(driver => waitNPeerConnectionsExist(driver, 1)));
    })
    .then(() => {
        return Promise.all(drivers.map(driver => waitAllPeerConnectionsConnected(driver)));
    })
    .then(() => {
        t.pass('P2P connected');
        return Promise.all(drivers.map(driver => waitNVideosExist(driver, 2)));
    })
    .then(() => {
        return Promise.all(drivers.map(driver => waitAllVideosHaveEnoughData(driver)));
    })
    .then(() => {
        t.pass('all videos have enough data');
        return Promise.all(drivers.map(driver => driver.quit()));
    })
    .then(() => { 
        t.end();
    })
    .then(null, function (err) {
        return Promise.all(drivers.map(driver => driver.quit()))
            .then(() => t.fail(err));
    });
}

test('P2P, Chrome-Chrome', function (t) {
    testP2P('chrome', 'chrome', t);
});

test('P2P, Firefox-Firefox', function (t) {
    testP2P('firefox', 'firefox', t);
});

test('P2P, Chrome-Firefox', function (t) {
    testP2P('chrome', 'firefox', t);
});

test('P2P, Firefox-Chrome', function (t) {
    testP2P('firefox', 'chrome', t);
});
