"use strict";

let flushAll = () => {
    exports.fileIdToHash = {};
    exports.directoryIdToFiles = {};
    exports.hashToLock = {};
};

flushAll();

exports.flushAll = flushAll;
