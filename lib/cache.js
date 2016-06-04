// Both memory caches and program data caches are here.
// Cached lock must be in full format.

"use strict";

let $fs = require("fs");
let $path = require("path").posix;
let $programData = require("./program-data");

let fileIdToHash = null;
let directoryIdToFiles = null;
let hashToLock = null;

let flushMemory = () => {
    fileIdToHash = {};
    directoryIdToFiles = {};
    hashToLock = {};
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

// Some trees are less likely to be used later, because the tree ID isn't
// in the current commit. They can be removed from the cache.
let shrinkDirectoryIdToFiles = filesToKeep => {
    let directoryIDs = filesToKeep.filter(m => m.mode.startsWith("040")).map(m => m.id);
    Object.keys(directoryIdToFiles).forEach(id => {
        if (directoryIDs.indexOf(id) === -1) {
            delete directoryIdToFiles[id];
        }
    });
};

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

exports.fileIdToHash = fileIdToHash;
exports.directoryIdToFiles = directoryIdToFiles;
exports.hashToLock = hashToLock;
exports.flushMemory = flushMemory;
exports.shrinkDirectoryIdToFiles = shrinkDirectoryIdToFiles;
exports.inProgramData = inProgramData;
exports.getPdLockContent = getPdLockContent;
exports.addPdBaseLock = addPdBaseLock;
