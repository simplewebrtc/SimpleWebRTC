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
        .setBinary('browsers/bin/firefox-stable')
        .setProfile(profile);

    // Chrome options.
    // http://selenium.googlecode.com/git/docs/api/javascript/module_selenium-webdriver_chrome_class_Options.html#addArguments
    var chromeOptions = new chrome.Options()
        .setChromeBinaryPath('browsers/bin/chrome-stable')
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

module.exports = {
    buildDriver: buildDriver
};
