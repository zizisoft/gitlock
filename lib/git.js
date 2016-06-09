/*
Please mind the Git versions. We must make it compatible with Git 1.9. So
`tag -l --format` can't be used. Use `for-each-ref --format` instead.
`tag -l --sort` can't be used. Use `sort` in code instead.
`for-each-ref --points-at` can't be used. Use `tag -l --points-at` instead.
`%(taggerdate:iso-strict)` can't be used. Luckily, both Git and JavaScript support RFC2822.
*/

"use strict";

let $cp = require("child_process");
let assert = require("assert");
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

let runWithoutCapture = (args, options) => {
    let actualOptions = {
        stdio: ["pipe", process.stdout, process.stderr]
    };
    Object.assign(actualOptions, options);
    return run(args, actualOptions);
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

let getParentCommitIDs = id =>
    line(["rev-list", "--parents", "--max-count=1", $v.id(id)])
    .split(" ").slice(1);

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
            for (let i = 0; i < file.name.length; i++) {
                let code = file.name.charCodeAt(i);
                if (
                    code === 0x002f || // the "/" character
                    code <= 0x001f || (0x007f <= code && code <= 0x009f) ||
                    code === 0x2028 || code === 0x2029
                ) {
                    throw new Error("Invalid file or directory name.");
                }
            }

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

let analyzeCommit = id => {
    let commitContent = run(["cat-file", "commit", $v.id(id)]);
    let lines = $util.parseLines(commitContent);
    let firstLineParts = lines[0].split(" ");
    assert(firstLineParts.length === 2 && firstLineParts[0] === "tree");
    let directoryId = firstLineParts[1];
    let emptyLineIndex = lines.indexOf("");

    // We verbatim restore the commit message. If the raw message ends with newline, it should
    // end with newline. If not, it should not.
    // (Normally all commit messages end with newlines. But if you use stdin to pass the
    // message and use verbatim option, it will not generate a trailing newline.)
    let commitMessage = lines.slice(emptyLineIndex + 1).join("\n"); // if out-of-boundary, it's ""
    if (commitMessage !== "" && commitContent.endsWith("\n")) {
        commitMessage += "\n";
    }

    let files = getFilesInDirectoryRec(directoryId);

    return {files: files, message: commitMessage};
};

// Get commits from `startId` to HEAD, sorted also in this order. If `startId` is omitted,
// it will be from root. It doesn't support multiple roots. Commits outside the chain are
// excluded (also not shown in child's `parentIDs` and parent's `childIDs` fields).
let getCommits = startId => {
    if (startId === undefined) {
        startId = getFirstCommitId();
    }

    // If `startId` is HEAD, we must do it specially because "rev-list" will show nothing.
    if (startId === getLastCommitId()) {
        let commit = {id: startId, parentIDs: [], childIDs: []};
        return {object: {[startId]: commit}, array: [commit]};
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
exports.runWithoutCapture = runWithoutCapture;
exports.line = line;
exports.lines = lines;
exports.parseTree = parseTree;
exports.getFileContent = getFileContent;
exports.getFileHash = getFileHash;
exports.getLastCommitId = getLastCommitId;
exports.getFirstCommitId = getFirstCommitId;
exports.getParentCommitIDs = getParentCommitIDs;
exports.getFilesInDirectoryRec = getFilesInDirectoryRec;
exports.analyzeCommit = analyzeCommit;
exports.getCommits = getCommits;
