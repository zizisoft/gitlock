"use strict";

let assert = require("assert");
let $base = require("./base");

describe("all", function() {
    this.timeout(0);

    require("./diff");

    describe("simple", () => {
        it("main", () => {
            $simple.createLocks();
            $base.cmdGitlock("verify");
            $base.cmdGitlock("verify --all");
            $base.mkdir("proof");
            $base.cmdGitlock("proof --all proof");
            let commits = $base.getCommits();
            assert.strictEqual(commits.length, 7);
            $simple.assertLocks(commits);
        });
    });

    describe("simple with addition", () => {
        it("main", () => {
            $simple.createLocks();
            $base.writeFile("new.txt", "new\n");
            $base.cmd("git add . && git commit -m new");
            $base.cmdGitlock();
            $base.cmdGitlock("timestamp");
            $base.cmdGitlock("timestamp");
            let commits = $base.getCommits();
            assert.strictEqual(commits.length, 8);
            $simple.assertLocks(commits);

            assert.strictEqual(commits[7].locks.length, 3);
            $base.assertBaseLock(commits[7].locks[0], {
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
                commitId: commits[7].id,
                commitMessage: "new\n"
            });
            $base.assertTimestampLock(commits[7].locks[1], {
                parentLock: commits[7].locks[0]
            });
            $base.assertTimestampLock(commits[7].locks[2], {
                parentLock: commits[7].locks[1]
            });

            $base.cmdGitlock("verify --all");
            $base.mkdir("proof");
            $base.cmdGitlock("proof --all proof");
        });
    });

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
                        $base.removeFile(`temp/new-${j}.txt`);
                        $base.cmd("git add . && git commit -m new");
                    }
                }
                $base.cmdGitlock();
            });
        });
    }
});
