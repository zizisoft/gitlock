"use strict";

let $fs = require("fs");
let $cp = require("child_process");
let rm = require("rimraf");
let ass = require("assert");
let $diff = require("../lib/diff");

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
        encoding: "utf8",
        stdio: ["pipe", process.stdout, process.stderr]
    };
    Object.assign(actualOptions, options);
    return $cp.execSync(command, actualOptions);
};

let execToLine = (command, options) => {
    return parseLine(exec(command, options));
};

let execToLines = (command, options) => {
    return parseLines(exec(command, options));
};

let runGit = (subcommand, options) => {
    let s = subcommand === undefined ? "" : " " + subcommand;
    return exec("git" + s, options);
};

let runGitlock = (subcommand, options) => {
    let s = subcommand === undefined ? "" : " " + subcommand;
    return exec("node ../bin/gitlock" + s, options);
};

let getLocks = commitId => {
    let lockNames = execToLines(`git tag -l --points-at ${commitId} --sort=refname gitlock-*`);
    return lockNames.map(lockName => {
        let tagId = execToLine(`git show-ref --tags -s ${lockName}`);
        let lines = execToLines(`git cat-file tag ${tagId}`);
        let emptyLineIndex = lines.indexOf("");

        // Can't use `join("\n")` because the return value must end with newline char.
        return {
            name: lockName,
            storedContent:
                lines.slice(emptyLineIndex + 1).map(m => m + "\n").join(""), // if out-of-boundary, it's ""
        };
    });
};

let createSimpleRepo = () => {
    rm.sync("temp");
    $fs.mkdirSync("temp");
    exec("git init");

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
    exec("git add . && git commit -m init");

    $fs.writeFileSync("temp/a.txt", "file body 1\n");
    $fs.writeFileSync("temp/我 你.txt", "文件 2\n");
    $fs.mkdirSync("temp/dir1");
    $fs.writeFileSync("temp/dir1/a.txt", "aaaaa\n");
    $fs.writeFileSync("temp/dir1/b.txt", "bbbbb\n");
    $fs.mkdirSync("temp/dir2");
    $fs.writeFileSync("temp/dir2/a.txt", "aaaaa\n");
    $fs.writeFileSync("temp/dir2/b.txt", "bbbbbbbb\n");
    $fs.writeFileSync("temp/dir2/c.txt", "ccccc\n");
    exec("git add .");
    exec("git commit -F -", {input: "第二个\n哈哈\n\n哈哈"});

    exec("git branch branch1");
    exec("git checkout branch1");
    $fs.writeFileSync("temp/b", new Buffer([0, 1, 2]));
    exec("git add . && git commit -m b");

    $fs.writeFileSync("temp/b1", new Buffer([0, 1, 2, 3]));
    exec("git add . && git commit -m b1");

    exec("git checkout master");
    $fs.writeFileSync("temp/c.txt", "c\n");
    exec("git add . && git commit -m c");

    exec("git merge -m m branch1 && git branch -d branch1");

    exec("git branch branch2");
    exec("git checkout branch2");
    $fs.writeFileSync("temp/d", "d\n");
    exec("git add . && git commit -m d");

    exec("git checkout master");
    $fs.writeFileSync("temp/e.txt", "e\n");
    exec("git add . && git commit --allow-empty-message -m \"\"");
};

describe("all", () => {
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

        it("main", () => {
            createSimpleRepo();
            runGitlock();
            runGitlock("verify --all");
            $fs.mkdirSync("temp/proof");
            runGitlock("proof --all proof");
        });
    });

    describe("simple with addition", () => {
        it("main", () => {
            createSimpleRepo();
            runGitlock();
            $fs.writeFileSync("temp/new.txt", "new\n");
            exec("git add . && git commit -m new");
            runGitlock();
        });
    });

    if (process.argv[3] === "--long") {
        describe("long", () => {
            it("main", () => {
                createSimpleRepo();
                runGitlock();
                for (let i = 0; i < 3; i++) {
                    for (let j = 0; j < 500; j++) {
                        $fs.writeFileSync(`temp/new-${j}.txt`, Math.random().toString());
                        exec("git add . && git commit -m new");
                    }
                    for (let j = 0; j < 500; j++) {
                        $fs.writeFileSync(`temp/new-${j}.txt`, Math.random().toString());
                        exec("git add . && git commit -m new");
                    }
                    for (let j = 0; j < 500; j++) {
                        $fs.unlinkSync(`temp/new-${j}.txt`);
                        exec("git add . && git commit -m new");
                    }
                }
                runGitlock();
            });
        });
    }
});
