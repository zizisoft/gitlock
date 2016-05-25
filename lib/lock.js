"use strict";

let $cp = require("child_process");
let $crypto = require("crypto");
let $git = require("./git");
let $util = require("./util");
let $v = require("./validate");

let parseContent = content => {
    if (content.startsWith("signatures\n")) {
    }
    else if (content.startsWith("timestamps\n")) {
    }
    else {
        let match = content.match(
            /^((?:parent [^\s]*\n)*)\n*((?:(?:a|d|c|\d{6}) [^\n]*\n)*)\n*commit ([^\s]*)\n\n*base64-([^\s]*)\n/
        );
        let parentLines = $util.parseLines(match[1]);
        let parentHashes = parentLines.map(m => m.split(" ")[1]);
        if (match[2].startsWith("a ") || match[2].startsWith("d ") || match[2].startsWith("c ")) {
            return {parentHashes: parentHashes, diff: match[2], commitId: match[3]};
        }
        else {
            let fileLines = $util.parseLines(match[2]);
            let files = fileLines.map(line => {
                let match = line.match(/^(\d{6}) ([^\s]*) (.*)$/);
                return {mode: match[1], hash: match[2], path: match[3]};
            });
            return {parentHashes: parentHashes, files: files, commitId: match[3]};
        }
    }
};

let getContent = name => {
    let tagId = $git.line(["show-ref", "--tags", "-s", $v.lockName(name)]);
    let lines = $git.lines(["cat-file", "tag", $v.id(tagId)]);
    let emptyLineIndex = lines.indexOf("");

    // Can't use `join("\n")` because the return value must end with newline char.
    return lines.slice(emptyLineIndex + 1).map(m => m + "\n").join(""); // if out-of-boundary, it's ""
};

let getContentAsync = name => {
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

exports.parseContent = parseContent;
exports.getContent = getContent;
exports.getContentAsync = getContentAsync;
exports.getTime = getTime;
exports.generateLabel = generateLabel;
exports.getHash = getHash;
exports.generateBase64 = generateBase64;
exports.generateNonce = generateNonce;
exports.computeHash = computeHash;
