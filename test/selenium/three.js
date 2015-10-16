'use strict';
var test = require('tape');

// https://code.google.com/p/selenium/wiki/WebDriverJs
var webdriver = require('selenium-webdriver');
var chrome = require('selenium-webdriver/chrome');
var firefox = require('selenium-webdriver/firefox');

function buildDriver(browser) {
    // Firefox options.
    // http://selenium.googlecode.com/git/docs/api/javascript/module_selenium-webdriver_firefox.html
    var profile = new firefox.Profile();
    profile.setPreference('media.navigator.streams.fake', true);
    var firefoxOptions = new firefox.Options()
        .setProfile(profile);

    // Chrome options.
    // http://selenium.googlecode.com/git/docs/api/javascript/module_selenium-webdriver_chrome_class_Options.html#addArguments
    var chromeOptions = new chrome.Options()
        /*
        .addArguments('enable-logging=1')
        .addArguments('v=1')
        .addArguments('vmodule=*libjingle/source/talk/*=4')
        .addArguments('user-data-dir=/some/where')
        */
        .addArguments('allow-file-access-from-files')
        .addArguments('use-fake-device-for-media-stream')
        .addArguments('use-fake-ui-for-media-stream');
        // use-file-for-fake-audio-capture -- see https://code.google.com/p/chromium/issues/detail?id=421054

    return new webdriver.Builder()
      .forBrowser(browser || process.env.BROWSER || 'firefox')
      .setFirefoxOptions(firefoxOptions)
      .setChromeOptions(chromeOptions)
      .build();
}

function doJoin(driver, room) {
    return driver.get('file://' + process.cwd() + '/index.html?' + room);
}

function test3(browserA, browserB, browserC, t) {
    var room = 'testing_' + Math.floor(Math.random() * 100000);

    var userA = buildDriver(browserA);
    doJoin(userA, room);

    var userB = buildDriver(browserB);
    doJoin(userB, room);

    var userC = buildDriver(browserC);
    doJoin(userC, room);
    userA.wait(function () {
        return userA.executeScript('return (function() {' +
            'var connected = 0;' +
            'webrtc.getPeers().forEach(function (peer) {' +
            '  if (peer.pc.iceConnectionState === \'connected\' || peer.pc.iceConnectionState === \'completed\') connected++;' +
            '});' +
            'return connected === 2;' +
            '})()');
    }, 15 * 1000)
    .then(function () {
        //return userA.sleep(2000);
    })
    .then(function () {
        t.pass('Mesh connected');
        userA.quit();
        userB.quit();
        userC.quit().then(function () {
            t.end();
        });
    })
    .then(null, function (err) {
        t.fail('Mesh failed');
        userA.quit();
        userB.quit();
        userC.quit().then(function () {
            t.end();
        });
    });
}

test('Mesh, Chrome-Chrome-Chrome', function (t) {
    test3('chrome', 'chrome', 'chrome', t);
});

test('Mesh, Chrome-Firefox-Firefox', function (t) {
    test3('chrome', 'firefox', 'firefox', t);
});

test('Mesh, Firefox-Firefox-Chrome', function (t) {
    test3('firefox', 'firefox', 'chrome', t);
});

test('Mesh, Chrome-Chrome-Firefox', function (t) {
    test3('chrome', 'chrome', 'chrome', t);
});

test('Mesh, Firefox-Firefox-Firefox', function (t) {
    test3('firefox', 'firefox', 'firefox', t);
});
