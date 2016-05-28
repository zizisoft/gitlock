"use strict";

let $fs = require("fs");
let $path = require("path").posix;
let $util = require("./util");

let path = $path.join($util.homeDir, ".gitlock");
let configPath = $path.join(path, "config.json");
let generatedPath = $path.join(path, "generated.json");

// default config
let config = {
    tsa: ["http://timestamp.comodoca.com/rfc3161"],
    openssl: "openssl",
    lockDefault: "lock",
    pushDefault: "lock",
    private: []
};

let generated = {
    baseLockCache: []
};

let saveConfig = () => {
    $fs.writeFileSync(configPath, JSON.stringify(config));
};

let saveGenerated = () => {
    $fs.writeFileSync(generatedPath, JSON.stringify(generated));
};

if (!$fs.existsSync(path)) {
    $fs.mkdirSync(path);
}

if ($fs.existsSync(configPath)) {
    let savedConfig = JSON.parse($fs.readFileSync(configPath, {encoding: "utf8"}));
    Object.assign(config, savedConfig);
    saveConfig();
}
else {
    saveConfig();
}

if ($fs.existsSync(generatedPath)) {
    generated = JSON.parse($fs.readFileSync(generatedPath, {encoding: "utf8"}));
}
else {
    saveGenerated();
}

exports.path = path;
exports.config = config;
exports.generated = generated;
exports.saveConfig = saveConfig;
exports.saveGenerated = saveGenerated;