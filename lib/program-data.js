"use strict";

let $fs = require("fs");
let $path = require("path").posix;
let $util = require("./util");

let path = $path.join($util.homeDir, ".gitlock");
let configFilePath = $path.join(path, "config.json");

// default config
let config = {
    tsa: ["http://timestamp.comodoca.com/rfc3161"],
    openssl: "openssl",
    lockDefault: "lock",
    pushDefault: "lock",
    private: [],
    baseLockCache: []
};

let saveConfig = () => {
    $fs.writeFileSync(configFilePath, JSON.stringify(config));
};

if (!$fs.existsSync(path)) {
    $fs.mkdirSync(path);
}
if ($fs.existsSync(configFilePath)) {
    let savedConfig = JSON.parse($fs.readFileSync(configFilePath, {encoding: "utf8"}));
    Object.assign(config, savedConfig);
    saveConfig();
}
else {
    saveConfig();
}

exports.path = path;
exports.config = config;
exports.saveConfig = saveConfig;
