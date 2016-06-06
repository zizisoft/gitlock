/*
The constructor of every derived class of `Lock` takes 2 forms of arguments:
a single object argument, or several string argument.

Except for base lock, all locks have full-format contents during instantiation, so
we put them into cache in the constructor. For base lock, when filling the content
it will be cached. If a base lock has full-format content during instantiation,
it will also be cached.
*/

"use strict";

let $cp = require("child_process");
let $crypto = require("crypto");
let assert = require("assert");
let $path = require("path").posix;
let $fs = require("fs");
let $git = require("./git");
let $util = require("./util");
let $v = require("./validate");
let $diff = require("./diff");
let $cache = require("./cache");
let $programData = require("./program-data");

let config = $programData.config;

class Lock {
    // `storedContent` is required. `hash` is optional.
    // Also for every of its subclasses, `hash` is optional.
    constructor(storedContent, hash) {
        this.storedContent = storedContent;
        this.hash = hash;
    }

    getContent() {
        return this.content;
    }

    getContentInBytes() {
        return new Buffer(this.getContent());
    }

    computeHash() {
        return $util.computeHash(this.getContent());
    }

    verify() {
        assert(this.hash === this.computeHash());
    }

    tryCache() {
        if (this.content !== undefined && this.hash !== undefined) {
            $cache.hashToLock[this.hash] = this;
        }
    }

    static parse(storedContent, hash) {
        let match = storedContent.match(/^(?:(signatures|timestamps)\n\n)?((?:.|\n)*)$/);
        if (match[1] === "signatures") {
        }
        else if (match[1] === "timestamps") {
            return new TimestampLock(match[2], storedContent, hash);
        }
        else {
            return new BaseLock(storedContent, hash);
        }
    }

    // PD-cache doesn't hold stored content. The default value of `usesPdCache` is true.
    // But the problem is that when using PD-cache, if a lock is cached then `storedContent`
    // will be the same as `content`, which in some cases we want to avoid.
    // In those cases you can set it to false.
    static fromName(name, usesPdCache) {
        if (usesPdCache === undefined) {
            usesPdCache = true;
        }
        let hash = getHash(name);
        if ($cache.hashToLock[hash] !== undefined) {
            return $cache.hashToLock[hash];
        }
        else if (usesPdCache && $cache.inProgramData(hash)) {
            return this.parse($cache.getPdLockContent(hash), hash);
        }
        else {
            let tagId = $git.line(["show-ref", "--tags", "-s", $v.lockName(name)]);
            let lines = $git.lines(["cat-file", "tag", $v.id(tagId)]);
            let emptyLineIndex = lines.indexOf("");

            // Can't use `join("\n")` because the return value must end with newline char.
            return this.parse(
                lines.slice(emptyLineIndex + 1).map(m => m + "\n").join(""), // if out-of-boundary, it's ""
                hash
            );
        }
    }
}

class BaseLock extends Lock {
    // Base lock doesn't have lock type lines, so `info` parameter is not needed.
    constructor() {
        if (typeof arguments[0] === "string") {
            let storedContent = arguments[0];
            let hash = arguments[1];
            super(storedContent, hash);
            let match = storedContent.match(
                /^(((?:parent [^\s]*\n)*)\n*)((?:(?:a|d|c|\d{6}) [^\n]*\n)*|no-diff\n)(\n*commit ([^\s]*)\n\n*base64-([^\s]*)\n(?:.|\n)*)$/
            );
            let parentLines = $util.parseLines(match[2]);
            let parentHashes = parentLines.map(m => m.split(" ")[1]);
            this.parentHashes = parentHashes;
            this.commitId = match[5];
            this.commitMessage = new Buffer(match[6], "base64").toString();
            if (match[3] === "no-diff\n") {
                this.diff = "";
            }
            else if (match[3].startsWith("a ") || match[3].startsWith("d ") || match[3].startsWith("c ")) {
                this.diff = match[3];
            }
            else {
                this.files = BaseLock.parseFilesString(match[3]);
                this.filesString = match[3];
                this.content = storedContent;
            }
            this.contentBefore = match[1];
            this.contentAfter = match[4];
        }
        else {
            let obj = arguments[0];
            let part1 = "";
            if (obj.parentHashes.length > 0) {
                obj.parentHashes.forEach(hash => {
                    part1 += "parent " + hash + "\n";
                });
                part1 += "\n";
            }
            let part2 = "";
            obj.files.forEach(file => {
                part2 += file.mode + " " + file.hash + " " + file.path + "\n";
            });
            let part3 =
                (obj.files.length > 0 ? "\n" : "") +
                "commit " + obj.commitId + "\n" +
                "\n" +
                generateBase64(obj.commitMessage) + "\n" +
                "\n" +
                generateNonce();
            let content = part1 + part2 + part3;
            let hash = $util.computeHash(content);

            super(content, hash);
            this.parentHashes = obj.parentHashes;
            this.commitId = obj.commitId;
            this.commitMessage = obj.commitMessage;
            this.files = obj.files;
            this.filesString = part2;
            this.content = content;
            this.contentBefore = part1;
            this.contentAfter = part3;
        }
        this.tryCache();
    }

    fillContent() {
        assert(this.diff !== undefined);
        let parentHash = this.parentHashes[0];
        let parentName = "gitlock-000-" + parentHash;
        let parentLock = Lock.fromName(parentName);
        if (parentLock.filesString === undefined) {
            parentLock.fillContent();
        }
        this.filesString = $diff.applyDiff(parentLock.filesString, this.diff);
        this.files = BaseLock.parseFilesString(this.filesString);
        this.content = this._joinContentBeforeAndAfter(this.filesString);
        this.tryCache();
    }

    // `base` means the lock of the diff base, not "base lock" (though it is).
    fillDiff(base) {
        if (base.filesString === undefined) {
            base.fillContent();
        }
        this.diff = $diff.computeDiff(base.filesString, this.filesString);
        let s = this.diff === "" ? "no-diff\n" : this.diff;
        this.storedContent = this._joinContentBeforeAndAfter(s);
    }

    _joinContentBeforeAndAfter(str) {
        let before = this.contentBefore;
        let after = this.contentAfter;
        if (str === "") {
            if (before.endsWith("\n\n")) {
                before = before.substr(0, before.length - 1);
            }
            if (after.startsWith("\n")) {
                after = after.substr(1);
            }
            let joint = before === "" ? "" : "\n";
            return before + joint + after;
        }
        else {
            if (before !== "" && !before.endsWith("\n\n")) {
                before += "\n";
            }
            if (after !== "" && !after.startsWith("\n")) {
                after = "\n" + after;
            }
            return before + str + after;
        }
    }

    getContent() {
        if (this.content === undefined) {
            this.fillContent();
        }
        return super.getContent();
    }

    verify(commitId) {
        super.verify();
        let files = {};
        this.files.forEach(file => files[file.path] = file);
        let testFiles = $git.analyzeCommit(commitId).files;
        $cache.shrinkDirectoryIdToFiles(testFiles);
        testFiles.forEach(testFile => {
            assert($git.getFileHash(testFile) === files[testFile.path].hash);
        });
    }

    destroy() {
        this.storedContent = undefined;
        this.hash = undefined;
        this.content = undefined;
        this.parentHashes = undefined;
        this.diff = undefined;
        this.files = undefined;
        this.filesString = undefined;
        this.contentBefore = undefined;
        this.contentAfter = undefined;
        this.commitId = undefined;
        this.commitMessage = undefined;
    }

    static parseFilesString(str) {
        let fileLines = $util.parseLines(str);
        let files = fileLines.map(line => {
            let match = line.match(/^(\d{6}) ([^\s]*) (.*)$/);
            return {mode: match[1], hash: match[2], path: match[3]};
        });
        return files;
    }
}

class TimestampLock extends Lock {
    constructor() {
        if (typeof arguments[0] === "string") {
            let info = arguments[0];
            let storedContent = arguments[1];
            let hash = arguments[2];
            super(storedContent, hash);
            this.content = storedContent;

            let match = info.match(/^parent ([^\s]*)\n\n((?:base64-[^\s]*\n)+)(?:.|\n)*$/);
            this.parentHash = match[1];
            this.data = $util.parseLines(match[2]).map(m => new Buffer(m.substr("base64-".length), "base64"));
        }
        else {
            let obj = arguments[0];
            let content =
                "timestamps\n" +
                "\n" +
                "parent " + obj.parentHash + "\n" +
                "\n" +
                generateBase64(obj.data[0]) + "\n" +
                "\n" +
                generateNonce();
            let hash = $util.computeHash(content);
            super(content, hash);
            this.content = content;
            this.parentHash = obj.parentHash;
            this.data = obj.data;
        }
        this.tryCache();
    }

    verify(parent) {
        super.verify();
        let tempTsrPath = $path.join($programData.path, "temp.tsr");
        $fs.writeFileSync(tempTsrPath, this.data[0]);
        let tempDataPath = $path.join($programData.path, "temp.dat");
        $fs.writeFileSync(tempDataPath, parent.getContent());
        $cp.execFileSync(
            config.openssl,
            ["ts", "-verify", "-in", tempTsrPath, "-data", tempDataPath, "-CApath", config.rootCa]
        );
    }
}

let getStoredContent = name => {
    let tagId = $git.line(["show-ref", "--tags", "-s", $v.lockName(name)]);
    let lines = $git.lines(["cat-file", "tag", $v.id(tagId)]);
    let emptyLineIndex = lines.indexOf("");

    // Can't use `join("\n")` because the return value must end with newline char.
    return lines.slice(emptyLineIndex + 1).map(m => m + "\n").join(""); // if out-of-boundary, it's ""
};

let getStoredContentAsync = name => {
    return new Promise((resolve, reject) => {
        $cp.execFile("git", ["show-ref", "--tags", "-s", $v.lockName(name)],
        {encoding: "utf8"}, (err, stdout) => {
            if (err !== null) {
                reject(err);
                return;
            }
            let tagId = $util.parseLine(stdout);
            $cp.execFile("git", ["cat-file", "tag", $v.id(tagId)], {encoding: "utf8"}, (err, stdout) => {
                if (err !== null) {
                    reject(err);
                    return;
                }
                let lines = $util.parseLines(stdout);
                let emptyLineIndex = lines.indexOf("");

                // Can't use `join("\n")` because the return value must end with newline char.
                resolve(
                    lines.slice(emptyLineIndex + 1).map(m => m + "\n").join("") // if out-of-boundary, it's ""
                );
            });
        });
    });
};

let getTime = name => {
    let time = $git.line(["tag", "-l", "--format=%(taggerdate:iso-strict)", $v.lockName(name)]);
    return new Date(time).toISOString();
};

let getCommitId = name => {
    return $git.line(["tag", "-l", "--format=%(object)", $v.lockName(name)]);
};

let getNamesFromCommit = commitId => {
    return $git.lines([
        "tag", "-l", "--points-at", $v.id(commitId), "--sort=refname", "gitlock-*"
    ]);
};

let getNamesFromName = lockName => getNamesFromCommit(getCommitId(name));

let getLabel = name => name.match(/^gitlock-(\d\d\d)-.*$/)[1];

let generateLabel = baseName => {
    let s = (parseInt(getLabel(baseName)) + 1).toString();
    if (s.length === 1) {
        return "00" + s;
    }
    else if (s.length === 2) {
        return "0" + s;
    }
    else {
        return s;
    }
};

let getHash = name => {
    return name.match(/^gitlock-\d\d\d-(.*)$/)[1];
};

// `data` can be Buffer or string
let generateBase64 = data => {
    let bytes = data instanceof Buffer ? data : new Buffer(data);
    return "base64-" + bytes.toString("base64");
};

let generateNonce = () => {
    return "nonce " + $crypto.randomBytes(16).toString("hex") + "\n";
};

let add = (name, storedContent, commitId, time) => {
    $git.run(
        [
            "tag", "-a", "-F", "-", "--cleanup=verbatim",
            $v.lockName(name),
            $v.id(commitId)
        ],
        {
            input: storedContent,
            env: {
                GIT_COMMITTER_DATE: time
            }
        }
    );
};

let getAllLocks = () => {
    let lines = $git.lines([
        "for-each-ref",
        "--format=%(object) %(refname:short) %(taggerdate:iso-strict)",
        "refs/tags/gitlock-*"
    ]); // use the default "refname" sort order
    return lines.map(line => {
        let parts = line.split(" ");
        return {name: parts[1], hash: getHash(parts[1]), commitId: parts[0], taggerTime: parts[2]};
    });
};

exports.getStoredContent = getStoredContent;
exports.getStoredContentAsync = getStoredContentAsync;
exports.getTime = getTime;
exports.getCommitId = getCommitId;
exports.getNamesFromCommit = getNamesFromCommit;
exports.getNamesFromName = getNamesFromName;
exports.getLabel = getLabel;
exports.generateLabel = generateLabel;
exports.getHash = getHash;
exports.generateBase64 = generateBase64;
exports.generateNonce = generateNonce;
exports.add = add;
exports.getAllLocks = getAllLocks;
exports.Lock = Lock;
exports.BaseLock = BaseLock;
exports.TimestampLock = TimestampLock;
