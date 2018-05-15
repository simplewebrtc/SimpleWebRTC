var url = require("url");
var config = require("config");

console.log(url.parse(window.location.toString()));
console.log("JS has been browserified");
console.log("The config is", config);
