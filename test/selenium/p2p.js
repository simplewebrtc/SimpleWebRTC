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

function testP2P(browserA, browserB, t) {
    var room = 'testing_' + Math.floor(Math.random() * 100000);

    var userA = seleniumHelpers.buildDriver(browserA, {bver: process.env.BVER});
    var userB = seleniumHelpers.buildDriver(browserB, {bver: process.env.BVER});
    return Promise.all([doJoin(userA, room), doJoin(userB, room)])
    .then(() => {
        t.pass('joined room');
        return Promise.all([iceConnected(userA), iceConnected(userB)])
    })
    .then(() => {
        t.pass('P2P connected');
        return Promise.all([userA.quit(), userB.quit()])
    })
    .then(() => { 
        t.end();
    })
    .then(null, function (err) {
        return Promise.all([userA.quit(), userB.quit()])
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
