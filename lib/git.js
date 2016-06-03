"use strict";

let $cp = require("child_process");
let $util = require("./util");
let $v = require("./validate");
let $cache = require("./cache");

let run = (args, options) => {
    let actualOptions = {encoding: "utf8"};
    Object.assign(actualOptions, options);

    // To workaround a Node.js bug:
    // In child process sync methods, `encoding` can't be explicitly set to "buffer".
    if (actualOptions.encoding === "buffer") {
        delete actualOptions.encoding;
    }

    return $cp.execFileSync("git", args, actualOptions);
};

// Because Node.js async methods default to utf-8, we don't need to explicitly set the default.
let runAsync = (args, options) => {
    return new Promise((resolve, reject) => {
        $cp.execFile("git", args, options, (err, stdout) => {
            if (err !== null) {
                reject(err);
                return;
            }
            resolve(stdout);
        });
    });
};

let line = (args, options) => {
    return $util.parseLine(run(args, options));
};
let lines = (args, options) => {
    return $util.parseLines(run(args, options));
};

// Must parse the raw tree. Can't parse pretty-printed tree because Unicode filename will be transformed.
let parseTree = bytes => {
    let r = [];
    let index = 0;
    while (index < bytes.length) {
        let file = {};
        let pos1 = bytes.indexOf(0x20, index);
        file.mode = bytes.toString("utf8", index, pos1);
        if (file.mode.length === 5) { // Git uses "40000" for tree, we normalize it to "040000".
            file.mode = "0" + file.mode;
        }
        let pos2 = bytes.indexOf(0x00, pos1 + 1);
        file.name = bytes.toString("utf8", pos1 + 1, pos2);
        index = pos2 + 20 + 1;
        file.id = bytes.toString("hex", pos2 + 1, index);
        r.push(file);
    }
    return r;
};

// returns buffer
let getFileContent = id => run(["cat-file", "blob", $v.id(id)], {encoding: "buffer"});

let getFileHash = file => {
    if (file.hash !== undefined) return file.hash;
    let hash = $cache.fileIdToHash[file.id];
    if (hash === undefined) {
        if (file.mode.startsWith("040")) {
            hash = "sha256-0000000000000000000000000000000000000000000000000000000000000000";
        }
        else {
            let bytes = getFileContent(file.id);
            hash = $util.computeHash(bytes);
        }
        $cache.fileIdToHash[file.id] = hash;
    }
    return hash;
};

let getLastCommitId = () => line(["rev-list", "--max-count=1", "HEAD"]);

// Doesn't support multiple roots.
let getFirstCommitId = () => line(["rev-list", "--max-parents=0", "HEAD"]);

let getFilesInDirectoryRec = id => {
    let files = [];
    let traverseDirectory = (id, pathPrefix) => {
        let parsedTree = $cache.directoryIdToFiles[id];
        if (parsedTree === undefined) {
            parsedTree = parseTree(
                run(["cat-file", "tree", $v.id(id)], {encoding: "buffer"})
            );
            $cache.directoryIdToFiles[id] = parsedTree;
        }
        parsedTree.forEach(file => {
            file.path = pathPrefix + file.name;
            if (!file.mode.startsWith("160")) { // exclude the submodule mode
                files.push(file);
                if (file.mode.startsWith("040")) { // is tree
                    traverseDirectory(file.id, file.path + "/");
                }
            }
        });
    };
    traverseDirectory(id, "");
    return files;
};

let getCommits = startId => {
    if (startId === undefined) {
        startId = getFirstCommitId();
    }
    let commitsObj = {};
    let commits = [];

    lines([
        "rev-list", "--children", "--reverse", "--ancestry-path", "--boundary", "--topo-order",
        $v.id(startId) + "..HEAD"
    ]).forEach(m => {
        if (m.startsWith("-")) {
            if (m.startsWith("-" + startId)) {
                m = m.substr(1);
            }
            else {
                return;
            }
        }

        let parts = m.split(" ");
        let commit = commitsObj[parts[0]] = {};
        commit.id = parts[0];
        commit.childIDs = parts.slice(1);
        commits.push(commit);
    });

    lines([
        "rev-list", "--parents", "--ancestry-path", "--boundary", "--topo-order",
        $v.id(startId) + "..HEAD"
    ]).forEach(m => {
        if (m.startsWith("-")) {
            if (m.startsWith("-" + startId)) {
                m = m.substr(1);
            }
            else {
                return;
            }
        }

        let parts = m.split(" ");
        commitsObj[parts[0]].parentIDs = parts.slice(1);
    });

    // Although "--ancestry-path" can reduce lines, it can't prevent the
    // already-filtered commits being shown as parents and children on the right.
    // We should remove them.
    commits.forEach(commit => {
        commit.childIDs = commit.childIDs.filter(m => commitsObj[m] !== undefined);
        commit.parentIDs = commit.parentIDs.filter(m => commitsObj[m] !== undefined);
    });

    return {object: commitsObj, array: commits};
};

exports.run = run;
exports.runAsync = runAsync;
exports.line = line;
exports.lines = lines;
exports.parseTree = parseTree;
exports.getFileContent = getFileContent;
exports.getFileHash = getFileHash;
exports.getLastCommitId = getLastCommitId;
exports.getFirstCommitId = getFirstCommitId;
exports.getFilesInDirectoryRec = getFilesInDirectoryRec;
exports.getCommits = getCommits;
