"use strict";

let $fs = require("fs");
let $cp = require("child_process");
let ass = require("assert");
let $os = require("os");
let $path = require("path").posix;
let $crypto = require("crypto");
let rm = require("rimraf");
let $diff = require("../lib/diff");

let programDataPath = $path.join($os.homedir(), ".gitlock");
let configPath = $path.join(programDataPath, "config.json");
let config = JSON.parse($fs.readFileSync(configPath, {encoding: "utf8"}));

let mkdir = path => $fs.mkdirSync($path.join("temp", path));

// `data` can be string or buffer
let writeFile = (path, data) => $fs.writeFileSync($path.join("temp", path), data);

let removeFile = path => $fs.unlinkSync($path.join("temp", path));

let reset = () => {
    rm.sync("temp");
    $fs.mkdirSync("temp");
};

let parseLines = str => {
    let r = str.split(/\r\n|\n/);
    if (r[r.length - 1] === "") {
        r.pop();
    }
    return r;
};

// Similar to `parseLines`, but forces exactly 1 line, otherwise throws. Returns the line.
// So in fact, the difference between in and out is just that the trailing newline char is stripped.
let parseLine = str => {
    let lines = parseLines(str);
    ass(lines.length === 1);
    return lines[0];
};

let exec = (command, options) => {
    let actualOptions = {
        cwd: "temp",
        encoding: "utf8"
    };
    Object.assign(actualOptions, options);
    return $cp.execSync(command, actualOptions);
};

// Similar to `exec`, but doesn't capture stdout and stderr.
let cmd = (command, options) => {
    let actualOptions = {
        stdio: ["pipe", process.stdout, process.stderr]
    };
    Object.assign(actualOptions, options);
    return exec(command, actualOptions);
};

let execToLine = (command, options) => {
    return parseLine(exec(command, options));
};

let execToLines = (command, options) => {
    return parseLines(exec(command, options));
};

let execGit = (subcommand, options) => {
    let s = subcommand === undefined ? "" : " " + subcommand;
    return exec("git" + s, options);
};

let execGitlock = (subcommand, options) => {
    let s = subcommand === undefined ? "" : " " + subcommand;
    return exec("node ../bin/gitlock" + s, options);
};

let cmdGitlock = (subcommand, options) => {
    let s = subcommand === undefined ? "" : " " + subcommand;
    return cmd("node ../bin/gitlock" + s, options);
};

let modifyLock = (name, storedContent) => {
    let commitId = execToLine(`git for-each-ref --format=%(object) refs/tags/${name}`);
    exec(`git tag -d ${name}`);
    exec(`git tag -a -F - --cleanup=verbatim ${name} ${commitId}`, {input: storedContent});
};

let getLocks = commitId => {
    let lockNames = execToLines(`git tag -l --points-at ${commitId} gitlock-*`).sort();
    return lockNames.map((lockName, index) => {
        let r = {name: lockName, content: execGitlock("show-content " + lockName)};
        r.hash = r.name.match(/^gitlock-\d\d\d-(.*)$/)[1];
        r.contentInBytes = new Buffer(r.content);
        r.index = index;
        return r;
    });
};

let getCommitIDs = () => execToLines("git rev-list --reverse --topo-order HEAD");

let getCommits = () => getCommitIDs().map(m => ({id: m, locks: getLocks(m)}));

// `data` can be Buffer or string
let getBase64 = data => {
    let bytes = data instanceof Buffer ? data : new Buffer(data);
    return "base64-" + bytes.toString("base64");
};

let encodeRegexPart = str => str.replace(/([.*+?{}()|^$\[\]\\])/g, "\\$1");

// `data` can be string or buffer.
let computeHash = data => "sha256-" + $crypto.createHash("sha256").update(data).digest("hex");

let assertLock = lock => {
    ass.strictEqual(lock.hash, computeHash(lock.content));

    // no more than 10 locks per commit is enough for test
    ass(lock.name.startsWith(`gitlock-00${lock.index}-`));
};

let assertBaseLock = (lock, expected) => {
    assertLock(lock);
    ass(lock.content.search(new RegExp(
        "^" +
        expected.parentLocks.map(m => "parent " + m.hash + "\\n").join("") +
        (expected.parentLocks.length === 0 ? "" : "\\n") +
        encodeRegexPart(expected.files) +
        (expected.files.length === 0 ? "" : "\\n") +
        "commit " + expected.commitId + "\\n" +
        "\\n" +
        encodeRegexPart(getBase64(expected.commitMessage)) + "\\n" +
        "\\n" +
        "nonce [0-9a-f]{32}\\n" +
        "$"
    )) !== -1);
};

let assertTimestampLock = (lock, expected) => {
    assertLock(lock);
    let match = lock.content.match(new RegExp(
        "^" +
        "timestamps\\n" +
        "\\n" +
        "parent " + expected.parentLock.hash + "\\n" +
        "\\n" +
        "base64-([a-zA-Z0-9+/=]*)\\n" +
        "\\n" +
        "nonce [0-9a-f]{32}\\n" +
        "$"
    ));
    ass(match !== null);
    $fs.writeFileSync("temp/temp.tsr", new Buffer(match[1], "base64"));
    $fs.writeFileSync("temp/temp.dat", expected.parentLock.content);
    cmd(`"${config.openssl}" ts -verify -in temp.tsr -data temp.dat -CApath "${config.rootCa}"`);
};

exports.mkdir = mkdir;
exports.writeFile = writeFile;
exports.removeFile = removeFile;
exports.reset = reset;
exports.cmd = cmd;
exports.cmdGitlock = cmdGitlock;
exports.modifyLock = modifyLock;
exports.getCommits = getCommits;
exports.assertBaseLock = assertBaseLock;
exports.assertTimestampLock = assertTimestampLock;
