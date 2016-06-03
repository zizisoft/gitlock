// Both memory caches and program data caches are here.

"use strict";

let $fs = require("fs");
let $path = require("path").posix;
let $programData = require("./program-data");

let flushMemory = () => {
    exports.fileIdToHash = {};
    exports.directoryIdToFiles = {};
    exports.hashToLock = {}; // cached lock must be in full format
};

flushMemory();

let BASE_LOCK_CACHE_LIMIT = 50;
let baseLockCache = $programData.generated.baseLockCache;
if (baseLockCache.length > BASE_LOCK_CACHE_LIMIT) {
    for (let i = 0; i < baseLockCache.length - BASE_LOCK_CACHE_LIMIT; i++) {
        baseLockCache.shift();
    }
    $programData.saveGenerated();
}

$fs.readdirSync($programData.path).forEach(item => {
    if (
        item.startsWith("sha256-") &&
        $path.extname(item) !== ".json" &&
        !baseLockCache.some(m => m.hash === item)
    ) {
        let path = $path.join($programData.path, item);
        $fs.unlinkSync(path);
    }
});

let inProgramData = hash => {
    let path = $path.join($programData.path, hash);
    return $fs.existsSync(path);
};

let getPdLockContent = hash => {
    let path = $path.join($programData.path, hash);
    return $fs.readFileSync(path, {encoding: "utf8"});
};

let addPdBaseLock = (info, content) => {
    let cachePath = $path.join($programData.path, info.hash);
    $fs.writeFileSync(cachePath, content);
    baseLockCache.push(info);
    $programData.saveGenerated();
};

exports.flushMemory = flushMemory;
exports.inProgramData = inProgramData;
exports.getPdLockContent = getPdLockContent;
exports.addPdBaseLock = addPdBaseLock;
