"use strict";

let assert = require("assert");
let $base = require("./base");
let $simple = require("./simple");

describe("all", function() {
    this.timeout(0);

    require("./diff");

    $simple.test();

    describe("simple-based", () => require("./simple-based"));

    describe("same tree", () => {
        it("main", () => {
            $base.reset();
            $base.cmd("git init");
            $base.cmd("git commit -m first --allow-empty");
            $base.cmd("git commit -m second --allow-empty");
            $base.writeFile("a.txt", "a\n");
            $base.cmd("git add . && git commit -m a");
            $base.cmd("git commit -m same-a --allow-empty");
            $base.cmdGitlock();

            let commits = $base.getCommits();
            assert.strictEqual(commits.length, 4);
            $base.assertBaseLock(commits[0].locks[0], {
                parentLocks: [],
                files: "",
                commitId: commits[0].id,
                commitMessage: "first\n"
            });
            $base.assertBaseLock(commits[1].locks[0], {
                parentLocks: [commits[0].locks[0]],
                files: "",
                commitId: commits[1].id,
                commitMessage: "second\n"
            });
            $base.assertBaseLock(commits[2].locks[0], {
                parentLocks: [commits[1].locks[0]],
                files:
                    "100644 sha256-87428fc522803d31065e7bce3cf03fe475096631e5e07bbd7a0fde60c4cf25c7 a.txt\n",
                commitId: commits[2].id,
                commitMessage: "a\n"
            });
            $base.assertBaseLock(commits[3].locks[0], {
                parentLocks: [commits[2].locks[0]],
                files:
                    "100644 sha256-87428fc522803d31065e7bce3cf03fe475096631e5e07bbd7a0fde60c4cf25c7 a.txt\n",
                commitId: commits[3].id,
                commitMessage: "same-a\n"
            });

            $base.cmdGitlock("verify --all");
        });
    });

    describe("submodule should be ignored", () => {
        it("main", () => {
            $base.reset();
            $base.cmd("git init");
            $base.writeFile("a.txt", "a\n");
            $base.cmd("git add . && git commit -m a");
            $base.mkdir("subm");
            $base.cmd("git init", {cwd: "temp/subm"});
            $base.writeFile("subm/sub-a.txt", "sub-a\n");
            $base.cmd("git add . && git commit -m init", {cwd: "temp/subm"});
            $base.cmd("git add . && git commit -m subm");
            $base.cmdGitlock();

            let commits = $base.getCommits();
            assert.strictEqual(commits.length, 2);
            $base.assertBaseLock(commits[0].locks[0], {
                parentLocks: [],
                files:
                    "100644 sha256-87428fc522803d31065e7bce3cf03fe475096631e5e07bbd7a0fde60c4cf25c7 a.txt\n",
                commitId: commits[0].id,
                commitMessage: "a\n"
            });
            $base.assertBaseLock(commits[1].locks[0], {
                parentLocks: [commits[0].locks[0]],
                files:
                    "100644 sha256-87428fc522803d31065e7bce3cf03fe475096631e5e07bbd7a0fde60c4cf25c7 a.txt\n",
                commitId: commits[1].id,
                commitMessage: "subm\n"
            });

            $base.cmdGitlock("verify --all");
        });
    });

    if (process.argv[3] === "--long") {
        describe("long", () => {
            it("main", () => {
                $simple.createRepo();
                $base.cmdGitlock();
                for (let i = 0; i < 3; i++) {
                    for (let j = 0; j < 500; j++) {
                        $base.writeFile(`new-${j}.txt`, Math.random().toString());
                        $base.cmd("git add . && git commit -m new");
                    }
                    for (let j = 0; j < 500; j++) {
                        $base.writeFile(`new-${j}.txt`, Math.random().toString());
                        $base.cmd("git add . && git commit -m new");
                    }
                    for (let j = 0; j < 500; j++) {
                        $base.removeFile(`new-${j}.txt`);
                        $base.cmd("git add . && git commit -m new");
                    }
                }
                $base.cmdGitlock();
            });
        });
    }
});
