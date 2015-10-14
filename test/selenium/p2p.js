'use strict';
var test = require('tape');

// https://code.google.com/p/selenium/wiki/WebDriverJs
var seleniumHelpers = require('./selenium-lib');
var webdriver = require('selenium-webdriver');

function doJoin(driver, room) {
    return driver.get('file://' + process.cwd() + '/index.html?' + room);
}

function testP2P(browserA, browserB, t) {
    var room = 'testing_' + Math.floor(Math.random() * 100000);

    var userA = seleniumHelpers.buildDriver(browserA);
    doJoin(userA, room);

    var userB = seleniumHelpers.buildDriver(browserB);
    doJoin(userB, room);

    userA.wait(function () {
        return userA.executeScript(function () {
            return window.webrtc.getPeers().length === 1 && window.webrtc.getPeers()[0].pc.iceConnectionState === 'connected';
        });
    }, 30 * 1000)
    .then(function () {
        t.pass('P2P connected');
        userA.quit();
        userB.quit().then(function () {
            t.end();
        });
    })
    .then(null, function (err) {
        t.fail(err);
        userA.quit();
        userB.quit();
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
