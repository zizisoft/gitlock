"use strict";

let $os = require("os");
let $path = require("path").posix;

module.exports = $path.join($os.homedir(), ".gitlock");
