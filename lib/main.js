"use strict";

/*
In the code, unless otherwise specified, "hash" means our SHA-256 hash string,
including the "sha256-" prefix.

In the code, unless otherwise specified, ID means the Git object's SHA-1 hash string.
Commit is a concept (or object), not a string. But commit ID is a string.

In the code, "file" can also mean a directory. File is a concept (or object), not a string.
File path is a string.

The first lock for a commit is called the base lock. Subsequent locks for this commit
are called derived locks.

Lock name is the string starting with "gitlock-" (tag name). Lock content is usually
the tag message, but when using diff, the lock content is the diff-applied version, while
the tag message is called the stored lock content. Lock is a concept (or object), not a string.

Time is an ISO-8601 string, not a `Date` object or a number.

But, for JSON that is to be stored, we can make it shorter, such as "commit ID" to "commit",
because in JSON this field must be string, without ambiguity (can't be object).

The "000", "001" in the lock name is called label.
*/

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

let args = process.argv.slice();
args.splice(0, 2); // strip "node" and the name of this file

let config = $programData.config;
let baseLockCache = $programData.generated.baseLockCache;

let addLocks = () => {
    let commits = {};
    let commitIDs = [];
    let locksCache = {};
    let finishedCount = 0;
    let progressTime = new Date().toISOString();
    let taggerTime = TAGGER_TIME_ORIGIN;
    $git.lines(["rev-list", "--children", "--reverse", "--topo-order", "HEAD"])
    .forEach(m => {
        let parts = m.split(" ");
        let commit = commits[parts[0]] = {};
        commit.lockHashes = [];
        commit.childIDs = parts.slice(1);
        commit.isNew = true;
        commit.traversed = false;
        commitIDs.push(parts[0]);
    });
    let firstCommitId = commitIDs[0];
    let lastCommitId = $util.last(commitIDs);
    $git.lines(["rev-list", "--parents", "--topo-order", "HEAD"]).forEach(m => {
        let parts = m.split(" ");
        commits[parts[0]].parentIDs = parts.slice(1);
    });

    let loadAllLocks = () => {
        $lock.getAllLocks().forEach(lock => {
            // If it's on a new branch, and an old branch already has locks, these locks'
            // commits may be not in rev-list. We should prevent error.
            if (commits[lock.commitId] !== undefined) {
                commits[lock.commitId].lockHashes.push(lock.hash);
                commits[lock.commitId].time = lock.taggerTime;
                commits[lock.commitId].isNew = false;
            }

            let timespan = $util.subtractTime(lock.taggerTime, taggerTime);
            if (timespan > 0 && timespan % 2 === 0) {
                taggerTime = lock.taggerTime;
            }
        });
    };

    let processCommit = commitId => {
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

            let files = $git.getFilesInDirectoryRec(directoryId);
            let directoryIDs = files.filter(m => m.mode.startsWith("040")).map(m => m.id);

            // Some trees are less likely to be used later, because the tree ID isn't
            // in the current commit. We remove them from the cache.
            Object.keys($cache.directoryIdToFiles).forEach(id => {
                if (directoryIDs.indexOf(id) === -1) {
                    delete $cache.directoryIdToFiles[id];
                }
            });

            files.forEach(file => {
                file.hash = $git.getFileHash(file);
            });

            let obj = {};
            obj.parentHashes = commit.parentIDs.map(id => commits[id].lockHashes[0]);
            obj.files = files;
            obj.commitId = commitId;
            obj.commitMessage = commitMessage;
            let lock = new $lock.BaseLock(obj);
            commit.lockHashes.push(lock.hash);
            commit.baseLock = lock;

            let firstParentId = commit.parentIDs[0];
            if (firstParentId !== undefined) {
                let parentCommit = commits[firstParentId];
                if (parentCommit.baseLock === undefined) {
                    parentCommit.baseLock = $lock.Lock.fromName("gitlock-000-" + parentCommit.lockHashes[0]);
                }
                lock.fillDiff(parentCommit.baseLock, locksCache);
            }
            locksCache["gitlock-000-" + lock.hash] = lock;

            taggerTime = $util.addTime(taggerTime, 2);
            $lock.add(
                "gitlock-000-" + lock.hash,
                lock.storedContent,
                commitId,
                taggerTime
            );
        }

        commit.traversed = true;

        finishedCount++;

        // Remove no longer used references to release memory.
        commit.parentIDs.forEach(parentId => {
            let commit = commits[parentId];
            if (commit.baseLock !== undefined && commit.childIDs.every(m => commits[m].traversed)) {
                delete locksCache["gitlock-000-" + commit.baseLock.hash];
                commit.baseLock.destroy(); // this sentence may be redundant, but keep it
                delete commit.baseLock;
            }
        });

        let now = new Date().toISOString();
        if ($util.subtractTime(now, progressTime) >= 1) {
            console.log(`${finishedCount} of ${commitIDs.length} commits processed.`);
            progressTime = now;
        }

        commit.childIDs.forEach(child => {
            if (commit.isNew && !commits[child].isNew) {
                throw new Error("Old lock already exists after a new lock.");
            }
        });
    };

    console.log("Loading existing locks...");
    loadAllLocks();
    console.log("Processing locks...");
    commitIDs.forEach(commitId => processCommit(commitId));
    let lastLock = commits[lastCommitId].baseLock;
    if (lastLock !== undefined) {
        let cachePath = $path.join($programData.path, lastLock.hash);
        $fs.writeFileSync(cachePath, lastLock.getContent());
        baseLockCache.push({
            hash: lastLock.hash,
            repo: firstCommitId,
            commit: lastCommitId,
            time: new Date().toISOString()
        });
        $programData.saveGenerated();
    }
    console.log(`${finishedCount} of ${commitIDs.length} commits processed successfully.`);
};

let basicCommand = args => {
    if (args === undefined) {
        args = [];
    }
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
};

let BASE_LOCK_CACHE_LIMIT = 50;
if (baseLockCache.length > BASE_LOCK_CACHE_LIMIT) {
    for (let i = 0; i < baseLockCache.length - BASE_LOCK_CACHE_LIMIT; i++) {
        baseLockCache.shift();
    }
    $programData.saveGenerated();
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
    basicCommand(args);
}
else if (args[0] === "timestamp") {
    basicCommand();

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

    // OpenSSL doesn't throw error even if the command is invalid. Too bad. We must
    // do this trick to detect.
    if (request.length === 0) {
        throw new Error("OpenSSL version too low!");
    }

    let url = $url.parse(config.tsa[0]);
    assert(url.protocol === "http:");
    console.log(`Sending timestamp request to "${url.hostname}"...`);
    let clientRequest = $http.request({
        method: "POST",
        hostname: url.hostname,
        port: url.port,
        path: url.path,
        headers: {"Content-Type": "application/timestamp-query"}
    }, serverResponse => {
        let data = new Buffer([]);
        serverResponse.on("data", chunk => {
            data = Buffer.concat([data, chunk]);
        });
        serverResponse.on("end", () => {
            let newLock = new $lock.TimestampLock({parentHash: $lock.getHash(lockName), data: [data]});
            let newLockName =
                "gitlock-" + $lock.generateLabel(lockName) + "-" + newLock.hash;
            $lock.add(
                newLockName,
                newLock.storedContent,
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
    let lines = null;
    if (args[1] === "--all") {
        lines = $git.lines([
            "tag", "-l", "--format=%(object) %(refname:short)",
            "--sort=refname", "--sort=object", "gitlock-*"
        ]);
    }
    else {
        let commitId = args.length === 3 ? args[1] : $git.getLastCommitId();
        lines = $git.lines([
            "tag", "-l", "--format=%(object) %(refname:short)",
            "--points-at", $v.id(commitId), "--sort=refname", "--sort=object", "gitlock-*"
        ]);
    }
    let dirPath = $util.slashPath($util.last(args));
    assert($fs.existsSync(dirPath));
    let list = [];
    let cache = {};
    lines.forEach((line, index) => {
        let parts = line.split(" ");
        let commitId = parts[0];
        let lockName = parts[1];
        let lock = $lock.Lock.fromName(lockName);
        if (lock instanceof $lock.BaseLock && lock.filesString === undefined) {
            lock.fillContent(cache);
        }
        let label = $lock.getLabel(lockName);
        let filePath = $path.join(dirPath, lock.hash + ".txt");
        $fs.writeFileSync(filePath, lock.content);
        list.push(commitId + " " + label + " " + lock.hash + "\n");
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

        // Can't use cache, because we want to show the verbatim stored content.
        console.log($lock.Lock.fromName(name, false).storedContent);
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
    let removeLocks = names => {
        return $util.batchRunAsync(names, name => {
            return $git.runAsync(["tag", "-d", $v.lockName(name)]);
        });
    };

    let type = args[1];
    if (type === undefined) {
        type = "--commit";
    }

    if (type === "--all") {
        let lockNames = $git.lines(["tag", "-l", "gitlock-*"]);
        removeLocks(lockNames);
    }
    else if (type === "--commit") {
        let lockNames = $git.lines([
            "tag", "-l", "--points-at", $v.id($git.getLastCommitId()), "--sort=refname", "gitlock-*"
        ]);
        removeLocks(lockNames);
    }
    else if (type === "--last") {
        let lockNames = $git.lines([
            "tag", "-l", "--points-at", $v.id($git.getLastCommitId()), "--sort=refname", "gitlock-*"
        ]);
        let last = $util.last(lockNames);
        if ($lock.getLabel(last) !== "000") {
            removeLocks([last]);
        }
    }
    else {
        let inCommit = false;
        let startingCommitId = null;

        if (args[1].startsWith("gitlock-000-")) {
            startingCommitId = $lock.getCommitId(args[1]);
        }
        else if (args[1].startsWith("gitlock-")) {
            inCommit = true;
        }
        else {
            startingCommitId = args[1];
        }

        if (inCommit) {
            removeLocks($lock.getNamesFromName(args[1]));
        }
        else {
            let commits = {};
            let lockNames = [];

            $git.lines([
                "rev-list", "--ancestry-path", "--boundary", "--topo-order",
                $v.id(startingCommitId) + "..HEAD"
            ]).forEach(m => {
                if (m.startsWith("-")) {
                    if (m.startsWith("-" + startingCommitId)) {
                        m = m.substr(1);
                    }
                    else {
                        return;
                    }
                }
                commits[m] = {};
            });

            let loadAllLocks = () => {
                $lock.getAllLocks().forEach(lock => {
                    if (commits[lock.commitId] !== undefined) {
                        lockNames.push(lock.name);
                    }
                });
            };

            console.log("Checking locks...");
            loadAllLocks();
            console.log("Removing locks...");
            removeLocks(lockNames);
        }
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
else {
    console.error("Invalid arguments.");
    process.exit(1);
}
