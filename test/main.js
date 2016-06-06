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

let getLocks = commitId => {
    let lockNames = execToLines(`git tag -l --points-at ${commitId} --sort=refname gitlock-*`);
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

let assLock = lock => {
    ass.strictEqual(lock.hash, computeHash(lock.content));

    // no more than 10 locks per commit is enough for test
    ass(lock.name.startsWith(`gitlock-00${lock.index}-`));
};

let assBaseLock = (lock, commit, expected) => {
    assLock(lock);
    ass(lock.content.search(new RegExp(
        "^" +
        expected.parentLocks.map(m => "parent " + m.hash + "\\n").join("") +
        (expected.parentLocks.length === 0 ? "" : "\\n") +
        encodeRegexPart(expected.files) +
        (expected.files.length === 0 ? "" : "\\n") +
        "commit " + commit.id + "\\n" +
        "\\n" +
        encodeRegexPart(getBase64(expected.commitMessage)) + "\\n" +
        "\\n" +
        "nonce [0-9a-f]{32}\\n" +
        "$"
    )) !== -1);
};

let assTimestampLock = (lock, commit, expected) => {
    assLock(lock);
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

let createSimpleRepo = () => {
    rm.sync("temp");
    $fs.mkdirSync("temp");
    cmd("git init");

    $fs.writeFileSync("temp/.gitignore", String.raw`# OS X
.DS_Store

# Windows
Thumbs.db
Desktop.ini

# Linux
*~

# Node
node_modules

*.log
`);
    cmd("git add . && git commit -m init");

    $fs.writeFileSync("temp/a.txt", "file body 1\n");
    $fs.writeFileSync("temp/我 你.txt", "文件 2\n");
    $fs.mkdirSync("temp/dir1");
    $fs.writeFileSync("temp/dir1/a.txt", "aaaaa\n");
    $fs.writeFileSync("temp/dir1/b.txt", "bbbbb\n");
    $fs.mkdirSync("temp/dir2");
    $fs.writeFileSync("temp/dir2/a.txt", "aaaaa\n");
    $fs.writeFileSync("temp/dir2/b.txt", "bbbbbbbb\n");
    $fs.writeFileSync("temp/dir2/c.txt", "ccccc\n");
    cmd("git add .");
    cmd("git commit -F -", {input: "第二个\n哈哈\n\n哈哈"});

    cmd("git branch branch1");
    cmd("git checkout branch1");
    $fs.writeFileSync("temp/b", new Buffer([0, 1, 2]));
    cmd("git add . && git commit -m b");

    $fs.writeFileSync("temp/b1", new Buffer([0, 1, 2, 3]));
    cmd("git add . && git commit -m b1");

    cmd("git checkout master");
    $fs.writeFileSync("temp/c.txt", "c\n");
    cmd("git add . && git commit -m c");

    cmd("git merge -m m branch1 && git branch -d branch1");

    cmd("git branch branch2");
    cmd("git checkout branch2");
    $fs.writeFileSync("temp/d", "d\n");
    cmd("git add . && git commit -m d");

    cmd("git checkout master");
    $fs.writeFileSync("temp/e.txt", "e\n");
    cmd("git add . && git commit --allow-empty-message -m \"\"");
};

let createSimpleLocks = () => {
    createSimpleRepo();
    cmdGitlock();
    cmdGitlock("timestamp");
};

let assSimpleLocks = (commits) => {
    ass.strictEqual(commits[0].locks.length, 1);
    assBaseLock(commits[0].locks[0], commits[0], {
        parentLocks: [],
        files: "100644 sha256-7dfa8c4d0ae505ae9e5404495eff9d5c04ec13faae715f9dfc77d98b8426a620 .gitignore\n",
        commitMessage: "init\n"
    });
    ass.strictEqual(commits[1].locks.length, 1);
    assBaseLock(commits[1].locks[0], commits[1], {
        parentLocks: [commits[0].locks[0]],
        files:
            "100644 sha256-7dfa8c4d0ae505ae9e5404495eff9d5c04ec13faae715f9dfc77d98b8426a620 .gitignore\n" +
            "100644 sha256-3a7429fbbd37ec336920ca94afdb11116c71144209fec0b07eb7dc3c3bbe4f40 a.txt\n" +
            "040000 sha256-0000000000000000000000000000000000000000000000000000000000000000 dir1\n" +
            "100644 sha256-bdc26931acfb734b142a8d675f205becf27560dc461f501822de13274fe6fc8a dir1/a.txt\n" +
            "100644 sha256-8b410a5102fa5a38ef71e9e7c3f7888a9c029da41cfce2b16fd6f4c062b88030 dir1/b.txt\n" +
            "040000 sha256-0000000000000000000000000000000000000000000000000000000000000000 dir2\n" +
            "100644 sha256-bdc26931acfb734b142a8d675f205becf27560dc461f501822de13274fe6fc8a dir2/a.txt\n" +
            "100644 sha256-77f04111cf23a2831ad5ce51903577bff91b281780e445264368d1c78fab157f dir2/b.txt\n" +
            "100644 sha256-38446ff653e68d69e16e8358fefc829c4b8f027d2e00b6c98a40db2a1a255fef dir2/c.txt\n" +
            "100644 sha256-d7f6df5b097bcc6a4d11d1b4901f342fe0fd9aca663e7e32c704fe6816a744e5 我 你.txt\n",
        commitMessage: "第二个\n哈哈\n\n哈哈\n"
    });
    ass.strictEqual(commits[2].locks.length, 1);
    assBaseLock(commits[2].locks[0], commits[2], {
        parentLocks: [commits[1].locks[0]],
        files:
            "100644 sha256-7dfa8c4d0ae505ae9e5404495eff9d5c04ec13faae715f9dfc77d98b8426a620 .gitignore\n" +
            "100644 sha256-3a7429fbbd37ec336920ca94afdb11116c71144209fec0b07eb7dc3c3bbe4f40 a.txt\n" +
            "100644 sha256-a3a5e715f0cc574a73c3f9bebb6bc24f32ffd5b67b387244c2c909da779a1478 c.txt\n" +
            "040000 sha256-0000000000000000000000000000000000000000000000000000000000000000 dir1\n" +
            "100644 sha256-bdc26931acfb734b142a8d675f205becf27560dc461f501822de13274fe6fc8a dir1/a.txt\n" +
            "100644 sha256-8b410a5102fa5a38ef71e9e7c3f7888a9c029da41cfce2b16fd6f4c062b88030 dir1/b.txt\n" +
            "040000 sha256-0000000000000000000000000000000000000000000000000000000000000000 dir2\n" +
            "100644 sha256-bdc26931acfb734b142a8d675f205becf27560dc461f501822de13274fe6fc8a dir2/a.txt\n" +
            "100644 sha256-77f04111cf23a2831ad5ce51903577bff91b281780e445264368d1c78fab157f dir2/b.txt\n" +
            "100644 sha256-38446ff653e68d69e16e8358fefc829c4b8f027d2e00b6c98a40db2a1a255fef dir2/c.txt\n" +
            "100644 sha256-d7f6df5b097bcc6a4d11d1b4901f342fe0fd9aca663e7e32c704fe6816a744e5 我 你.txt\n",
        commitMessage: "c\n"
    });
    ass.strictEqual(commits[3].locks.length, 1);
    assBaseLock(commits[3].locks[0], commits[3], {
        parentLocks: [commits[1].locks[0]],
        files:
            "100644 sha256-7dfa8c4d0ae505ae9e5404495eff9d5c04ec13faae715f9dfc77d98b8426a620 .gitignore\n" +
            "100644 sha256-3a7429fbbd37ec336920ca94afdb11116c71144209fec0b07eb7dc3c3bbe4f40 a.txt\n" +
            "100644 sha256-ae4b3280e56e2faf83f414a6e3dabe9d5fbe18976544c05fed121accb85b53fc b\n" +
            "040000 sha256-0000000000000000000000000000000000000000000000000000000000000000 dir1\n" +
            "100644 sha256-bdc26931acfb734b142a8d675f205becf27560dc461f501822de13274fe6fc8a dir1/a.txt\n" +
            "100644 sha256-8b410a5102fa5a38ef71e9e7c3f7888a9c029da41cfce2b16fd6f4c062b88030 dir1/b.txt\n" +
            "040000 sha256-0000000000000000000000000000000000000000000000000000000000000000 dir2\n" +
            "100644 sha256-bdc26931acfb734b142a8d675f205becf27560dc461f501822de13274fe6fc8a dir2/a.txt\n" +
            "100644 sha256-77f04111cf23a2831ad5ce51903577bff91b281780e445264368d1c78fab157f dir2/b.txt\n" +
            "100644 sha256-38446ff653e68d69e16e8358fefc829c4b8f027d2e00b6c98a40db2a1a255fef dir2/c.txt\n" +
            "100644 sha256-d7f6df5b097bcc6a4d11d1b4901f342fe0fd9aca663e7e32c704fe6816a744e5 我 你.txt\n",
        commitMessage: "b\n"
    });
    ass.strictEqual(commits[4].locks.length, 1);
    assBaseLock(commits[4].locks[0], commits[4], {
        parentLocks: [commits[3].locks[0]],
        files:
            "100644 sha256-7dfa8c4d0ae505ae9e5404495eff9d5c04ec13faae715f9dfc77d98b8426a620 .gitignore\n" +
            "100644 sha256-3a7429fbbd37ec336920ca94afdb11116c71144209fec0b07eb7dc3c3bbe4f40 a.txt\n" +
            "100644 sha256-ae4b3280e56e2faf83f414a6e3dabe9d5fbe18976544c05fed121accb85b53fc b\n" +
            "100644 sha256-054edec1d0211f624fed0cbca9d4f9400b0e491c43742af2c5b0abebf0c990d8 b1\n" +
            "040000 sha256-0000000000000000000000000000000000000000000000000000000000000000 dir1\n" +
            "100644 sha256-bdc26931acfb734b142a8d675f205becf27560dc461f501822de13274fe6fc8a dir1/a.txt\n" +
            "100644 sha256-8b410a5102fa5a38ef71e9e7c3f7888a9c029da41cfce2b16fd6f4c062b88030 dir1/b.txt\n" +
            "040000 sha256-0000000000000000000000000000000000000000000000000000000000000000 dir2\n" +
            "100644 sha256-bdc26931acfb734b142a8d675f205becf27560dc461f501822de13274fe6fc8a dir2/a.txt\n" +
            "100644 sha256-77f04111cf23a2831ad5ce51903577bff91b281780e445264368d1c78fab157f dir2/b.txt\n" +
            "100644 sha256-38446ff653e68d69e16e8358fefc829c4b8f027d2e00b6c98a40db2a1a255fef dir2/c.txt\n" +
            "100644 sha256-d7f6df5b097bcc6a4d11d1b4901f342fe0fd9aca663e7e32c704fe6816a744e5 我 你.txt\n",
        commitMessage: "b1\n"
    });
    ass.strictEqual(commits[5].locks.length, 1);
    assBaseLock(commits[5].locks[0], commits[5], {
        parentLocks: [commits[2].locks[0], commits[4].locks[0]],
        files:
            "100644 sha256-7dfa8c4d0ae505ae9e5404495eff9d5c04ec13faae715f9dfc77d98b8426a620 .gitignore\n" +
            "100644 sha256-3a7429fbbd37ec336920ca94afdb11116c71144209fec0b07eb7dc3c3bbe4f40 a.txt\n" +
            "100644 sha256-ae4b3280e56e2faf83f414a6e3dabe9d5fbe18976544c05fed121accb85b53fc b\n" +
            "100644 sha256-054edec1d0211f624fed0cbca9d4f9400b0e491c43742af2c5b0abebf0c990d8 b1\n" +
            "100644 sha256-a3a5e715f0cc574a73c3f9bebb6bc24f32ffd5b67b387244c2c909da779a1478 c.txt\n" +
            "040000 sha256-0000000000000000000000000000000000000000000000000000000000000000 dir1\n" +
            "100644 sha256-bdc26931acfb734b142a8d675f205becf27560dc461f501822de13274fe6fc8a dir1/a.txt\n" +
            "100644 sha256-8b410a5102fa5a38ef71e9e7c3f7888a9c029da41cfce2b16fd6f4c062b88030 dir1/b.txt\n" +
            "040000 sha256-0000000000000000000000000000000000000000000000000000000000000000 dir2\n" +
            "100644 sha256-bdc26931acfb734b142a8d675f205becf27560dc461f501822de13274fe6fc8a dir2/a.txt\n" +
            "100644 sha256-77f04111cf23a2831ad5ce51903577bff91b281780e445264368d1c78fab157f dir2/b.txt\n" +
            "100644 sha256-38446ff653e68d69e16e8358fefc829c4b8f027d2e00b6c98a40db2a1a255fef dir2/c.txt\n" +
            "100644 sha256-d7f6df5b097bcc6a4d11d1b4901f342fe0fd9aca663e7e32c704fe6816a744e5 我 你.txt\n",
        commitMessage: "m\n"
    });
    ass.strictEqual(commits[6].locks.length, 2);
    assBaseLock(commits[6].locks[0], commits[6], {
        parentLocks: [commits[5].locks[0]],
        files:
            "100644 sha256-7dfa8c4d0ae505ae9e5404495eff9d5c04ec13faae715f9dfc77d98b8426a620 .gitignore\n" +
            "100644 sha256-3a7429fbbd37ec336920ca94afdb11116c71144209fec0b07eb7dc3c3bbe4f40 a.txt\n" +
            "100644 sha256-ae4b3280e56e2faf83f414a6e3dabe9d5fbe18976544c05fed121accb85b53fc b\n" +
            "100644 sha256-054edec1d0211f624fed0cbca9d4f9400b0e491c43742af2c5b0abebf0c990d8 b1\n" +
            "100644 sha256-a3a5e715f0cc574a73c3f9bebb6bc24f32ffd5b67b387244c2c909da779a1478 c.txt\n" +
            "040000 sha256-0000000000000000000000000000000000000000000000000000000000000000 dir1\n" +
            "100644 sha256-bdc26931acfb734b142a8d675f205becf27560dc461f501822de13274fe6fc8a dir1/a.txt\n" +
            "100644 sha256-8b410a5102fa5a38ef71e9e7c3f7888a9c029da41cfce2b16fd6f4c062b88030 dir1/b.txt\n" +
            "040000 sha256-0000000000000000000000000000000000000000000000000000000000000000 dir2\n" +
            "100644 sha256-bdc26931acfb734b142a8d675f205becf27560dc461f501822de13274fe6fc8a dir2/a.txt\n" +
            "100644 sha256-77f04111cf23a2831ad5ce51903577bff91b281780e445264368d1c78fab157f dir2/b.txt\n" +
            "100644 sha256-38446ff653e68d69e16e8358fefc829c4b8f027d2e00b6c98a40db2a1a255fef dir2/c.txt\n" +
            "100644 sha256-a2bbdb2de53523b8099b37013f251546f3d65dbe7a0774fa41af0a4176992fd4 e.txt\n" +
            "100644 sha256-d7f6df5b097bcc6a4d11d1b4901f342fe0fd9aca663e7e32c704fe6816a744e5 我 你.txt\n",
        commitMessage: ""
    });
    assTimestampLock(commits[6].locks[1], commits[6], {
        parentLock: commits[6].locks[0]
    });
};

describe("all", function() {
    this.timeout(0);

    describe("simple", () => {
        it("diff", () => {
            let base = null;
            let str = null;
            let diff = null;

            base =
                "100644 sha256-0e525d70686b35148ec01cc0f4c6fc1362e95397b31ed8c443c2089d371967dc a\n" +
                "100644 sha256-9d5e59eb113d996f9ad757ef46456de89040c427202a6609fb2fff4770a6740a b\n" +
                "100644 sha256-5a92a041ec13b494c4c2544633ecf58125426ff50a7f1c70b5d805c6d4ae45cd c\n" +
                "100644 sha256-c1e832fd54a0eedef78612f4a670083ec302a6843dba1e0001c3ddb27730ffa1 d\n" +
                "100644 sha256-6a44423094beb5fe7e5eb7112d3d4b6bd5651bd324838e711139528580fae855 e\n" +
                "100644 sha256-8be8f81c6652f7e2161805c52fe9e47a0a8515e27f4954154ff3e83ae5743d22 f\n";

            str =
                "100644 sha256-0e525d70686b35148ec01cc0f4c6fc1362e95397b31ed8c443c2089d371967dc a\n" +
                "100644 sha256-9d5e59eb113d996f9ad757ef46456de89040c427202a6609fb2fff4770a6740a b\n" +
                "100644 sha256-5a92a041ec13b494c4c2544633ecf58125426ff50a7f1c70b5d805c6d4ae45cd c\n" +
                "100644 sha256-c1e832fd54a0eedef78612f4a670083ec302a6843dba1e0001c3ddb27730ffa1 d\n" +
                "100644 sha256-6a44423094beb5fe7e5eb7112d3d4b6bd5651bd324838e711139528580fae855 e\n" +
                "100644 sha256-8be8f81c6652f7e2161805c52fe9e47a0a8515e27f4954154ff3e83ae5743d22 f\n";
            diff = $diff.computeDiff(base, str);
            ass.strictEqual(diff,
                ""
            );
            ass.strictEqual($diff.applyDiff(base, diff), str);

            str =
                "100644 sha256-0e525d70686b35148ec01cc0f4c6fc1362e95397b31ed8c443c2089d371967dc a\n" +
                "100644 sha256-9d5e59eb113d996f9ad757ef46456de89040c427202a6609fb2fff4770a6740a b\n" +
                "100644 sha256-61af961b3cea3e337020b872333c9decaf782e1e5ca6e8f1ba21a62a3638f70e b1\n" +
                "100644 sha256-5a92a041ec13b494c4c2544633ecf58125426ff50a7f1c70b5d805c6d4ae45cd c\n" +
                "100644 sha256-6a44423094beb5fe7e5eb7112d3d4b6bd5651bd324838e711139528580fae855 e\n" +
                "100644 sha256-0737491c6e810b8b12ab8a4144aec959b161b851ff64aa4be509e06285e503b0 f\n";
            diff = $diff.computeDiff(base, str);
            ass.strictEqual(diff,
                "a 2\n" +
                "100644 sha256-61af961b3cea3e337020b872333c9decaf782e1e5ca6e8f1ba21a62a3638f70e b1\n" +
                "d 3 1\n" +
                "c 5 1\n" +
                "100644 sha256-0737491c6e810b8b12ab8a4144aec959b161b851ff64aa4be509e06285e503b0 f\n"
            );
            ass.strictEqual($diff.applyDiff(base, diff), str);

            str =
                "100644 sha256-0e525d70686b35148ec01cc0f4c6fc1362e95397b31ed8c443c2089d371967dc a\n" +
                "100644 sha256-9d5e59eb113d996f9ad757ef46456de89040c427202a6609fb2fff4770a6740a b\n" +
                "100644 sha256-5a92a041ec13b494c4c2544633ecf58125426ff50a7f1c70b5d805c6d4ae45cd c\n" +
                "100644 sha256-c1e832fd54a0eedef78612f4a670083ec302a6843dba1e0001c3ddb27730ffa1 d\n" +
                "100644 sha256-6a44423094beb5fe7e5eb7112d3d4b6bd5651bd324838e711139528580fae855 e\n" +
                "100644 sha256-8be8f81c6652f7e2161805c52fe9e47a0a8515e27f4954154ff3e83ae5743d22 f\n" +
                "100644 sha256-ebe1093b8ae1bd88a4cc8890a9adf046174a62d74b516fc8b82a5b4e492ebf05 f1\n" +
                "100644 sha256-1769f660a3a94c1ed180c96c4bc43069e3e2dab23073cfec66a6feb4b5686068 f2\n";
            diff = $diff.computeDiff(base, str);
            ass.strictEqual(diff,
                "a 6\n" +
                "100644 sha256-ebe1093b8ae1bd88a4cc8890a9adf046174a62d74b516fc8b82a5b4e492ebf05 f1\n" +
                "100644 sha256-1769f660a3a94c1ed180c96c4bc43069e3e2dab23073cfec66a6feb4b5686068 f2\n"
            );
            ass.strictEqual($diff.applyDiff(base, diff), str);
        });

        it("diff 2", () => {
            let base = null;
            let str = null;
            let diff = null;

            base =
                "100644 sha256-0e525d70686b35148ec01cc0f4c6fc1362e95397b31ed8c443c2089d371967dc a\n";
            str =
                "100644 sha256-0e525d70686b35148ec01cc0f4c6fc1362e95397b31ed8c443c2089d371967dc a\n" +
                "100644 sha256-9d5e59eb113d996f9ad757ef46456de89040c427202a6609fb2fff4770a6740a b\n";
            diff = $diff.computeDiff(base, str);
            ass.strictEqual(diff,
                "a 1\n" +
                "100644 sha256-9d5e59eb113d996f9ad757ef46456de89040c427202a6609fb2fff4770a6740a b\n"
            );
            ass.strictEqual($diff.applyDiff(base, diff), str);

            base =
                "100644 sha256-9d5e59eb113d996f9ad757ef46456de89040c427202a6609fb2fff4770a6740a b\n";
            str =
                "100644 sha256-0e525d70686b35148ec01cc0f4c6fc1362e95397b31ed8c443c2089d371967dc a\n" +
                "100644 sha256-9d5e59eb113d996f9ad757ef46456de89040c427202a6609fb2fff4770a6740a b\n";
            diff = $diff.computeDiff(base, str);
            ass.strictEqual(diff,
                "a 0\n" +
                "100644 sha256-0e525d70686b35148ec01cc0f4c6fc1362e95397b31ed8c443c2089d371967dc a\n"
            );
            ass.strictEqual($diff.applyDiff(base, diff), str);

            base =
                "100644 sha256-0e525d70686b35148ec01cc0f4c6fc1362e95397b31ed8c443c2089d371967dc a\n";
            str =
                "100644 sha256-0e525d70686b35148ec01cc0f4c6fc1362e95397b31ed8c443c2089d371967dc a\n";
            diff = $diff.computeDiff(base, str);
            ass.strictEqual(diff,
                ""
            );
            ass.strictEqual($diff.applyDiff(base, diff), str);

            base = "";
            str = "";
            diff = $diff.computeDiff(base, str);
            ass.strictEqual(diff,
                ""
            );
            ass.strictEqual($diff.applyDiff(base, diff), str);

            base = "";
            str =
                "100644 sha256-0e525d70686b35148ec01cc0f4c6fc1362e95397b31ed8c443c2089d371967dc a\n";
            diff = $diff.computeDiff(base, str);
            ass.strictEqual(diff,
                "a 0\n" +
                "100644 sha256-0e525d70686b35148ec01cc0f4c6fc1362e95397b31ed8c443c2089d371967dc a\n"
            );
            ass.strictEqual($diff.applyDiff(base, diff), str);

            base =
                "100644 sha256-0e525d70686b35148ec01cc0f4c6fc1362e95397b31ed8c443c2089d371967dc a\n";
            str = "";
            diff = $diff.computeDiff(base, str);
            ass.strictEqual(diff,
                "d 0 1\n"
            );
            ass.strictEqual($diff.applyDiff(base, diff), str);

            base =
                "100644 sha256-0e525d70686b35148ec01cc0f4c6fc1362e95397b31ed8c443c2089d371967dc a\n";
            str =
                "100644 sha256-9d5e59eb113d996f9ad757ef46456de89040c427202a6609fb2fff4770a6740a b\n";
            diff = $diff.computeDiff(base, str);
            ass.strictEqual(diff,
                "c 0 1\n" +
                "100644 sha256-9d5e59eb113d996f9ad757ef46456de89040c427202a6609fb2fff4770a6740a b\n"
            );
            ass.strictEqual($diff.applyDiff(base, diff), str);

            base = "";
            str =
                "100644 sha256-0e525d70686b35148ec01cc0f4c6fc1362e95397b31ed8c443c2089d371967dc a\n" +
                "100644 sha256-9d5e59eb113d996f9ad757ef46456de89040c427202a6609fb2fff4770a6740a b\n";
            diff = $diff.computeDiff(base, str);
            ass.strictEqual(diff,
                "a 0\n" +
                "100644 sha256-0e525d70686b35148ec01cc0f4c6fc1362e95397b31ed8c443c2089d371967dc a\n" +
                "100644 sha256-9d5e59eb113d996f9ad757ef46456de89040c427202a6609fb2fff4770a6740a b\n"
            );
            ass.strictEqual($diff.applyDiff(base, diff), str);

            base =
                "100644 sha256-0e525d70686b35148ec01cc0f4c6fc1362e95397b31ed8c443c2089d371967dc a\n" +
                "100644 sha256-9d5e59eb113d996f9ad757ef46456de89040c427202a6609fb2fff4770a6740a b\n";
            str = "";
            diff = $diff.computeDiff(base, str);
            ass.strictEqual(diff,
                "d 0 2\n"
            );
            ass.strictEqual($diff.applyDiff(base, diff), str);

            base =
                "100644 sha256-0e525d70686b35148ec01cc0f4c6fc1362e95397b31ed8c443c2089d371967dc a\n" +
                "100644 sha256-9d5e59eb113d996f9ad757ef46456de89040c427202a6609fb2fff4770a6740a b\n";
            str =
                "100644 sha256-5a92a041ec13b494c4c2544633ecf58125426ff50a7f1c70b5d805c6d4ae45cd c\n" +
                "100644 sha256-c1e832fd54a0eedef78612f4a670083ec302a6843dba1e0001c3ddb27730ffa1 d\n";
            diff = $diff.computeDiff(base, str);
            ass.strictEqual(diff,
                "c 0 2\n" +
                "100644 sha256-5a92a041ec13b494c4c2544633ecf58125426ff50a7f1c70b5d805c6d4ae45cd c\n" +
                "100644 sha256-c1e832fd54a0eedef78612f4a670083ec302a6843dba1e0001c3ddb27730ffa1 d\n"
            );
            ass.strictEqual($diff.applyDiff(base, diff), str);
        });

        it("main", () => {
            createSimpleLocks();
            cmdGitlock("verify --all");
            $fs.mkdirSync("temp/proof");
            cmdGitlock("proof --all proof");
            let commits = getCommits();
            ass.strictEqual(commits.length, 7);
            assSimpleLocks(commits);
        });
    });

    describe("simple with addition", () => {
        it("main", () => {
            createSimpleLocks();
            $fs.writeFileSync("temp/new.txt", "new\n");
            cmd("git add . && git commit -m new");
            cmdGitlock();
            cmdGitlock("timestamp");
            let commits = getCommits();
            ass.strictEqual(commits.length, 8);
            assSimpleLocks(commits);

            ass.strictEqual(commits[7].locks.length, 2);
            assBaseLock(commits[7].locks[0], commits[7], {
                parentLocks: [commits[6].locks[0]],
                files:
                    "100644 sha256-7dfa8c4d0ae505ae9e5404495eff9d5c04ec13faae715f9dfc77d98b8426a620 .gitignore\n" +
                    "100644 sha256-3a7429fbbd37ec336920ca94afdb11116c71144209fec0b07eb7dc3c3bbe4f40 a.txt\n" +
                    "100644 sha256-ae4b3280e56e2faf83f414a6e3dabe9d5fbe18976544c05fed121accb85b53fc b\n" +
                    "100644 sha256-054edec1d0211f624fed0cbca9d4f9400b0e491c43742af2c5b0abebf0c990d8 b1\n" +
                    "100644 sha256-a3a5e715f0cc574a73c3f9bebb6bc24f32ffd5b67b387244c2c909da779a1478 c.txt\n" +
                    "040000 sha256-0000000000000000000000000000000000000000000000000000000000000000 dir1\n" +
                    "100644 sha256-bdc26931acfb734b142a8d675f205becf27560dc461f501822de13274fe6fc8a dir1/a.txt\n" +
                    "100644 sha256-8b410a5102fa5a38ef71e9e7c3f7888a9c029da41cfce2b16fd6f4c062b88030 dir1/b.txt\n" +
                    "040000 sha256-0000000000000000000000000000000000000000000000000000000000000000 dir2\n" +
                    "100644 sha256-bdc26931acfb734b142a8d675f205becf27560dc461f501822de13274fe6fc8a dir2/a.txt\n" +
                    "100644 sha256-77f04111cf23a2831ad5ce51903577bff91b281780e445264368d1c78fab157f dir2/b.txt\n" +
                    "100644 sha256-38446ff653e68d69e16e8358fefc829c4b8f027d2e00b6c98a40db2a1a255fef dir2/c.txt\n" +
                    "100644 sha256-a2bbdb2de53523b8099b37013f251546f3d65dbe7a0774fa41af0a4176992fd4 e.txt\n" +
                    "100644 sha256-7aa7a5359173d05b63cfd682e3c38487f3cb4f7f1d60659fe59fab1505977d4c new.txt\n" +
                    "100644 sha256-d7f6df5b097bcc6a4d11d1b4901f342fe0fd9aca663e7e32c704fe6816a744e5 我 你.txt\n",
                commitMessage: "new\n"
            });
            assTimestampLock(commits[7].locks[1], commits[7], {
                parentLock: commits[7].locks[0]
            });

            cmdGitlock("verify --all");
            $fs.mkdirSync("temp/proof");
            cmdGitlock("proof --all proof");
        });
    });

    describe("same tree", () => {
        it("main", () => {
            rm.sync("temp");
            $fs.mkdirSync("temp");
            cmd("git init");
            cmd("git commit -m first --allow-empty");
            cmd("git commit -m second --allow-empty");
            $fs.writeFileSync("temp/a.txt", "a\n");
            cmd("git add . && git commit -m a");
            cmd("git commit -m same-a --allow-empty");
            cmdGitlock();
            let commits = getCommits();
            ass.strictEqual(commits.length, 4);
            assBaseLock(commits[0].locks[0], commits[0], {
                parentLocks: [],
                files: "",
                commitMessage: "first\n"
            });
            assBaseLock(commits[1].locks[0], commits[1], {
                parentLocks: [commits[0].locks[0]],
                files: "",
                commitMessage: "second\n"
            });
            assBaseLock(commits[2].locks[0], commits[2], {
                parentLocks: [commits[1].locks[0]],
                files:
                    "100644 sha256-87428fc522803d31065e7bce3cf03fe475096631e5e07bbd7a0fde60c4cf25c7 a.txt\n",
                commitMessage: "a\n"
            });
            assBaseLock(commits[3].locks[0], commits[3], {
                parentLocks: [commits[2].locks[0]],
                files:
                    "100644 sha256-87428fc522803d31065e7bce3cf03fe475096631e5e07bbd7a0fde60c4cf25c7 a.txt\n",
                commitMessage: "same-a\n"
            });
        });
    });

    if (process.argv[3] === "--long") {
        describe("long", () => {
            it("main", () => {
                createSimpleRepo();
                cmdGitlock();
                for (let i = 0; i < 3; i++) {
                    for (let j = 0; j < 500; j++) {
                        $fs.writeFileSync(`temp/new-${j}.txt`, Math.random().toString());
                        cmd("git add . && git commit -m new");
                    }
                    for (let j = 0; j < 500; j++) {
                        $fs.writeFileSync(`temp/new-${j}.txt`, Math.random().toString());
                        cmd("git add . && git commit -m new");
                    }
                    for (let j = 0; j < 500; j++) {
                        $fs.unlinkSync(`temp/new-${j}.txt`);
                        cmd("git add . && git commit -m new");
                    }
                }
                cmdGitlock();
            });
        });
    }
});
