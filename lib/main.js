"use strict";

// In the code, unless otherwise specified, "hash" means our SHA-256 hash string,
// including the "sha256-" prefix.
// In the code, unless otherwise specified, ID means the Git object's SHA-1 hash string.
// Commit is a concept (or object), not a string. But commit ID is a string.
// In the code, "file" can also mean a directory. File is a concept (or object), not a string.
// File path is a string.
// The first lock for a commit is called the base lock. Subsequent locks for this commit
// are called derived locks.
// Lock name is the string starting with "gitlock-" (tag name). Lock content is usually
// the tag message, but when using diff, the lock content is the diff-applied version, while
// the tag message is called the stored lock content. Lock is a concept (or object), not a string.
// Time is an ISO-8601 string, not a `Date` object or a number.
// But, for JSON that is to be stored, we can make it shorter, such as "commit ID" to "commit",
// because in JSON this field must be string, without ambiguity (can't be object).

// Since GitHub mixes all tags into "releases" and can only sort them by tagger time, we must
// put locks into an earlier time, so that people can still easily find real releases.
// Luckily, tagger time can be different from the commit time as long as it's annotated.
// The first Git commit happens on 2005-04-07T22:13Z (see https://github.com/git/git).
// We set it to be a little after this time to respect Git.
// The first lock's time will be 2 seconds after this time.
let TAGGER_TIME_ORIGIN = "2005-04-08T00:00:00Z";

let $cp = require("child_process");
let assert = require("assert");
let $crypto = require("crypto");
let $path = require("path").posix;
let $fs = require("fs");
let $http = require("http");
let $url = require("url");
let $util = require("./util");
let $git = require("./git");
let $diff = require("./diff");
let $v = require("./validate");
let $lock = require("./lock");
let $programData = require("./program-data");

let config = $programData.config;
let baseLockCache = $programData.generated.baseLockCache;

let args = process.argv.slice();
args.splice(0, 2); // strip "node" and the name of this file

let addLocks = () => {
    let commits = {};
    let fileIdToHash = {}; // cache for performance
    let directoryFiles = {}; // cache for performance
    let finishedCount = 0;
    let progressTime = new Date().toISOString();
    let taggerTime = TAGGER_TIME_ORIGIN;
    $git.lines(["rev-list", "--children", "--reverse", "HEAD"])
    .forEach(m => {
        let parts = m.split(" ");
        let commit = commits[parts[0]] = {};
        commit.lockHashes = [];
        commit.childIDs = parts.slice(1);
        commit.isNew = true;
        commit.traversed = false;
    });
    let commitIDs = Object.keys(commits);
    let firstCommitId = commitIDs[0];
    let lastCommitId = $util.last(commitIDs);
    $git.lines(["rev-list", "--parents", "HEAD"]).forEach(m => {
        let parts = m.split(" ");
        commits[parts[0]].parentIDs = parts.slice(1);
    });

    let loadAllLocks = () => {
        let lines = $git.lines([
            "for-each-ref",
            "--format=%(object) %(refname:short) %(taggerdate:iso-strict)",
            "refs/tags/gitlock-*"
        ]);
        lines.forEach(line => {
            let parts = line.split(" ");
            let commitId = parts[0];
            let lock = parts[1];
            let time = parts[2];
            commits[commitId].lockHashes.push(lock);
            commits[commitId].time = time;
            commits[commitId].isNew = false;
            let timespan = $util.subtractTime(time, taggerTime);
            if (timespan > 0 && timespan % 2 === 0) {
                taggerTime = time;
            }
        });
    };

    let traverse = commitId => {
        let commit = commits[commitId];
        if (commit.isNew) {
            let commitContent = $git.run(["cat-file", "commit", $v.id(commitId)]);
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

            let files = [];
            let traverseDirectory = (id, pathPrefix) => {
                let parsedTree = directoryFiles[id];
                if (parsedTree === undefined) {
                    parsedTree = $git.parseTree(
                        $git.run(["cat-file", "tree", $v.id(id)], {encoding: "buffer"})
                    );
                    directoryFiles[id] = parsedTree;
                }
                parsedTree.forEach(file => {
                    file.path = pathPrefix + file.name;
                    if (!file.mode.startsWith("160")) { // exclude the submodule mode
                        files.push(file);
                        if (file.mode.startsWith("040")) { // is tree
                            traverseDirectory(file.id, file.path + "/");
                        }
                    }
                });
            };
            traverseDirectory(directoryId, "");

            let lockContentPart1 = "";
            if (commit.parentIDs.length > 0) {
                commit.parentIDs.forEach(id => {
                    lockContentPart1 += "parent " + commits[id].lockHashes[0] + "\n";
                });
                lockContentPart1 += "\n";
            }
            let lockContentPart2 = "";
            files.forEach(file => {
                let hash = fileIdToHash[file.id];
                if (hash === undefined) {
                    if (file.mode.startsWith("040")) {
                        hash = "sha256-0000000000000000000000000000000000000000000000000000000000000000";
                    }
                    else {
                        let bytes = $git.run(["cat-file", "blob", $v.id(file.id)], {encoding: "buffer"});
                        hash = $lock.computeHash(bytes);
                    }
                    fileIdToHash[file.id] = hash;
                }
                lockContentPart2 += file.mode + " " + hash + " " + file.path + "\n";
            });
            let lockContentPart3 =
                "\n" +
                "commit " + commitId + "\n" +
                "\n" +
                $lock.generateBase64(commitMessage) + "\n" +
                "\n" +
                $lock.generateNonce();
            let lockContent = lockContentPart1 + lockContentPart2 + lockContentPart3;
            commit.lockHashes.push($lock.computeHash(lockContent));

            commit.filesString = lockContentPart2;
            commit.lockContent = lockContent;

            let storedLockContent = null;
            let firstParentId = commit.parentIDs[0];
            if (firstParentId === undefined) {
                storedLockContent = lockContent;
            }
            else {
                let baseFilesString = commits[firstParentId].filesString;
                if (baseFilesString === undefined) {
                    storedLockContent = lockContent;
                }
                else {
                    storedLockContent =
                        lockContentPart1 +
                        $diff.computeDiff(baseFilesString, lockContentPart2) +
                        lockContentPart3;
                }
            }
            taggerTime = $util.addTime(taggerTime, 2);
            $lock.add(
                "gitlock-000-" + commit.lockHashes[0],
                storedLockContent,
                commitId,
                taggerTime
            );
        }

        commit.traversed = true;

        finishedCount++;

        let now = new Date().toISOString();
        if ($util.subtractTime(now, progressTime) >= 1) {
            console.log(`${finishedCount} of ${commitIDs.length} commits processed.`);
            progressTime = now;
        }

        commit.childIDs.forEach(child => {
            if (commit.isNew && !commits[child].isNew) {
                throw new Error("Old lock already exists after a new lock.");
            }
            if (commits[child].parentIDs.every(m => commits[m].traversed)) {
                traverse(child);
            }
        });
    };

    console.log("Loading existing locks...");
    loadAllLocks();
    console.log("Adding locks...");
    traverse(firstCommitId);
    if (commits[lastCommitId].lockContent !== undefined) {
        let hash = commits[lastCommitId].lockHashes[0];
        let cachePath = $path.join($programData.path, hash);
        $fs.writeFileSync(cachePath, commits[lastCommitId].lockContent);
        baseLockCache.push({
            hash: hash,
            repo: firstCommitId,
            commit: lastCommitId,
            time: new Date().toISOString()
        });
        $programData.saveGenerated();
    }
    console.log(`${finishedCount} of ${commitIDs.length} commits processed successfully.`);
};

let BASE_LOCK_CACHE_LIMIT = 50;
for (let i = 0; i < baseLockCache.length - BASE_LOCK_CACHE_LIMIT; i++) {
    baseLockCache.shift();
}

$fs.readdirSync($programData.path).forEach(item => {
    if (
        item.startsWith("sha256-") &&
        $path.extname(item) !== ".json" &&
        !baseLockCache.some(m => m.hash === item)
    ) {
        let path = $path.join($programData.path, item);
        $fs.unlinkSync(path);
    }
});

if (args.length === 0 || args[0] === "-m" || args[0] === "commit") {
    let status = $git.lines(["status", "--porcelain"]);
    if (status.some(m => m[0] !== " " && m[0] !== "?" && m[0] !== "!")) {
        if (args.length === 0) {
            $git.run(["commit", "--allow-empty-message", "-m", ""]);
        }

        // These are the only 2 commands that bypass the argument validation,
        // because it's impossible. But luckily, on one hand, "git commit -m <message>"
        // is obviously safe. On the other hand, when one use "gitlock commit [...]" he must
        // be aware that it has the same grammar as "git commit [...]", so it's also safe.
        else if (args[0] === "-m") {
            assert(args.length === 2);
            $git.run(["commit", "-m", args[1]]);
        }
        else if (args[0] === "commit") {
            $git.run(args);
        }
    }
    addLocks();
}
else if (args[0] === "timestamp") {
    let lastCommitId = $git.getLastCommitId();
    let lockNames = $git.lines([
        "tag", "-l", "--points-at", $v.id(lastCommitId), "--sort=refname", "gitlock-*"
    ]);
    let lockName = $util.last(lockNames);
    let baseTaggerTime = $lock.getTime(lockNames[0]);
    let request = $cp.execFileSync(
        config.openssl,
        ["ts", "-query", "-cert", "-sha256"],
        {input: $lock.Lock.fromName(lockName).getContent()}
    );
    let url = $url.parse(config.tsa[0]);
    assert(url.protocol === "http:");
    let clientRequest = $http.request({
        method: "POST",
        hostname: url.hostname,
        port: url.port,
        path: url.path,
        headers: {"Content-Type": "application/timestamp-query"}
    }, serverResponse => {
        let data = Buffer.from([]);
        serverResponse.on("data", chunk => {
            data = Buffer.concat([data, chunk]);
        });
        serverResponse.on("end", () => {
            let newLockContent =
                "timestamps\n" +
                "\n" +
                "parent " + $lock.getHash(lockName) + "\n" +
                "\n" +
                $lock.generateBase64(data) + "\n" +
                "\n" +
                $lock.generateNonce();
            let newLockName =
                "gitlock-" + $lock.generateLabel(lockName) + "-" + $lock.computeHash(newLockContent);
            $lock.add(
                newLockName,
                newLockContent,
                lastCommitId,
                $util.addTime(baseTaggerTime, 1)
            );
            console.log(`Timestamp added. Content length: ${data.length}`);
        });
    });
    clientRequest.write(request);
    clientRequest.end();
}
else if (args[0] === "verify") {
}
else if (args[0] === "proof") {
    assert(args.length === 3);
    let commitId = args[1];
    let lockNames = $git.lines([
        "tag", "-l", "--points-at", $v.id(commitId), "--sort=refname", "gitlock-*"
    ]);
    let dirPath = $util.slashPath(args[2]);
    assert($fs.existsSync(dirPath));
    let list = [];
    let cache = {};
    lockNames.forEach((name, index) => {
        let lock = $lock.Lock.fromName(name);
        if (lock instanceof $lock.BaseLock && lock.filesString === undefined) {
            lock.applyDiff(cache);
        }
        let hash = $lock.getHash(name);
        let filePath = $path.join(dirPath, hash + ".txt");
        $fs.writeFileSync(filePath, lock.content);
        list.push(commitId + " " + $util.pad(index, 3) + " " + hash + "\n");
    });
    $fs.writeFileSync($path.join(dirPath, "list.txt"), list.join(""));
    let readmePath = $path.join($path.dirname($util.slashPath(module.filename)), "proof-readme.txt");
    let readmeBytes = $fs.readFileSync(readmePath);
    $fs.writeFileSync($path.join(dirPath, "README.txt"), readmeBytes);
}
else if (args[0] === "show") {
    // "--points-at" also applies to tag names. So it also works if `args[1]` is a lock name.
    // TODO: Currently do not support hash name
    let lockNames = $git.lines([
        "tag", "-l", "--points-at", $v.idOrHashOrLockName(args[1]), "--sort=refname", "gitlock-*"
    ]);
    lockNames.forEach(name => {
        console.log(name);
        console.log("=".repeat(name.length));
        console.log("");
        console.log($lock.Lock.fromName(name).storedContent);
    });
}
else if (args[0] === "list") {
    let lockNames = $git.lines(["tag", "-l", "--sort=taggerdate", "gitlock-*"]);
    lockNames.forEach(name => {
        console.log(name);
    });
}
else if (args[0] === "log") {
    $git.run(["log", "--all", "--decorate", "--graph"], {
        stdio: ["pipe", process.stdout, process.stderr],
        encoding: "buffer"
    });
}
else if (args[0] === "remove") {
    let type = args[1];
    if (type === undefined) {
        type = "--commit";
    }
    assert(type === "--all");
    if (type === "--all") {
        let lockNames = $git.lines(["tag", "-l", "gitlock-*"]);
        $git.run(["tag", "-d"].concat(lockNames.map(m => $v.lockName(m))));
    }
}
else if (args[0] === "config") {
    if (args.length === 1) {
        console.log(config);
    }
    else {
        if (args[1] === "tsa") {
            config.tsa = [args[2]];
        }
        else if (args[1] === "openssl") {
            config.openssl = args[2];
        }
        $programData.saveConfig();
    }
}
