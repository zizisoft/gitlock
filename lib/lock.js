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
let $programData = require("./program-data");

let config = $programData.config;

class Lock {
    getContent() {
        return this.content;
    }

    static parse(storedContent) {
        let match = storedContent.match(/^(?:(signatures|timestamps)\n\n)?((?:.|\n)*)$/);
        if (match[1] === "signatures") {
        }
        else if (match[1] === "timestamps") {
            return new TimestampLock(match[2], storedContent);
        }
        else {
            return new BaseLock(storedContent);
        }
    }

    static fromName(name) {
        let hash = getHash(name);
        if (config.baseLockCache.indexOf(hash) !== -1) {
            let path = $path.join($programData.path, hash);
            return this.parse($fs.readFileSync(path, {encoding: "utf8"}));
        }
        else {
            let tagId = $git.line(["show-ref", "--tags", "-s", $v.lockName(name)]);
            let lines = $git.lines(["cat-file", "tag", $v.id(tagId)]);
            let emptyLineIndex = lines.indexOf("");

            // Can't use `join("\n")` because the return value must end with newline char.
            return this.parse(
                lines.slice(emptyLineIndex + 1).map(m => m + "\n").join("") // if out-of-boundary, it's ""
            );
        }
    }
}

class BaseLock extends Lock {
    // Base lock doesn't have lock type lines, so `info` parameter is not needed.
    constructor(storedContent) {
        super();
        let match = storedContent.match(
            /^(((?:parent [^\s]*\n)*)\n*)((?:(?:a|d|c|\d{6}) [^\n]*\n)*)(\n*commit ([^\s]*)\n\n*base64-([^\s]*)\n(?:.|\n)*)/
        );
        let parentLines = $util.parseLines(match[2]);
        let parentHashes = parentLines.map(m => m.split(" ")[1]);
        this.parentHashes = parentHashes;
        this.commitId = match[5];
        if (match[3].startsWith("a ") || match[3].startsWith("d ") || match[3].startsWith("c ")) {
            this.diff = match[3];
        }
        else {
            this.files = BaseLock.parseFilesString(match[3]);
            this.filesString = match[3];
            this.content = storedContent;
        }
        this.storedContent = storedContent;
        this.contentBefore = match[1];
        this.contentAfter = match[4];
    }

    applyDiff(cache) {
        assert(this.diff !== undefined && this.files === undefined && this.filesString === undefined);
        if (cache === undefined) {
            cache = {};
        }
        let parentName = "gitlock-000-" + this.parentHashes[0];
        if (cache[parentName] === undefined) {
            let parentLock = Lock.fromName(parentName);
            if (parentLock.filesString === undefined) {
                parentLock.applyDiff(cache);
            }
            cache[parentName] = parentLock;
        }
        this.filesString = $diff.applyDiff(cache[parentName].filesString, this.diff);
        this.files = BaseLock.parseFilesString(this.filesString);
        this.content = this.contentBefore + this.filesString + this.contentAfter;
    }

    getContent() {
        if (this.content === undefined) {
            this.applyDiff();
        }
        return super.getContent();
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
    constructor(info, storedContent) {
        super();
        this.content = this.storedContent = storedContent;
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

let generateLabel = baseName => {
    let s = (parseInt(baseName.match(/^gitlock-(\d\d\d)-.*$/)[1]) + 1).toString();
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
    let bytes = data instanceof Buffer ? data : Buffer.from(data);
    return "base64-" + bytes.toString("base64");
};

let generateNonce = () => {
    return "nonce " + $crypto.randomBytes(16).toString("hex") + "\n";
};

// `data` can be string or buffer.
let computeHash = data => "sha256-" + $crypto.createHash("sha256").update(data).digest("hex");

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

exports.getStoredContent = getStoredContent;
exports.getStoredContentAsync = getStoredContentAsync;
exports.getTime = getTime;
exports.generateLabel = generateLabel;
exports.getHash = getHash;
exports.generateBase64 = generateBase64;
exports.generateNonce = generateNonce;
exports.computeHash = computeHash;
exports.add = add;
exports.Lock = Lock;
exports.BaseLock = BaseLock;
exports.TimestampLock = TimestampLock;
