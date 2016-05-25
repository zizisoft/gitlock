"use strict";

let $cp = require("child_process");
let $crypto = require("crypto");
let $git = require("./git");
let $util = require("./util");
let $v = require("./validate");

let parseContent = msg => {
    if (msg.startsWith("signatures\n")) {
    }
    else if (msg.startsWith("timestamps\n")) {
    }
    else {
        let match = msg.match(
            /^((?:parent [^\s]*\n)*)\n*((?:(?:a|d|c|\d{6}) [^\n]*\n)*)\n*commit ([^\s]*)\n\n*base64-([^\s]*)\n/
        );
        let parentLines = $util.parseLines(match[1]);
        let parents = parentLines.map(m => m.split(" ")[1]);
        if (match[2].startsWith("a ") || match[2].startsWith("d ") || match[2].startsWith("c ")) {
            return {parents: parents, diff: match[2], commit: match[3]};
        }
        else {
            let fileLines = $util.parseLines(match[2]);
            let files = fileLines.map(line => {
                let match = line.match(/^(\d{6}) ([^\s]*) (.*)$/);
                return {mode: match[1], hash: match[2], path: match[3]};
            });
            return {parents: parents, files: files, commit: match[3]};
        }
    }
};

let getContent = tag => {
    let tagId = $git.line(["show-ref", "--tags", "-s", $v.lockName(tag)]);
    let lines = $git.lines(["cat-file", "tag", $v.id(tagId)]);
    let emptyLineIndex = lines.indexOf("");

    // Can't use `join("\n")` because the return value must end with newline char.
    return lines.slice(emptyLineIndex + 1).map(m => m + "\n").join(""); // if out-of-boundary, it's ""
};

let getContentAsync = tag => {
    return new Promise((resolve, reject) => {
        $cp.execFile("git", ["show-ref", "--tags", "-s", $v.lockName(tag)],
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

let getTime = tag => {
    let time = $git.line(["tag", "-l", "--format=%(taggerdate:iso-strict)", $v.lockName(tag)]);
    return new Date(time).toISOString();
};

let generateLabel = baseTag => {
    let s = (parseInt(baseTag.match(/^gitlock-(\d\d\d)-.*$/)[1]) + 1).toString();
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

let getHash = tag => {
    return tag.match(/^gitlock-\d\d\d-(.*)$/)[1];
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
