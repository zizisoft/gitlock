"use strict";

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
let $cache = require("./cache");

let args = process.argv.slice();
args.splice(0, 2); // strip "node" and the name of this file

let config = $programData.config;

let loadCommits = startId => {
    let info = $git.getCommits(startId);
    let commits = info.object;
    let commitsArray = info.array;
    let taggerTime = TAGGER_TIME_ORIGIN;

    commitsArray.forEach(commit => {
        commit.lockNames = [];
        commit.isNew = true;
        commit.traversed = false;
    });

    $lock.getAllLocks().forEach(lock => {
        // If it's on a new branch, and an old branch already has locks, these locks'
        // commits may be not in rev-list. We should prevent error.
        if (commits[lock.commitId] !== undefined) {
            commits[lock.commitId].lockNames.push(lock.name);
            commits[lock.commitId].time = lock.taggerTime;
            commits[lock.commitId].isNew = false;
        }

        let timespan = $util.subtractTime(lock.taggerTime, taggerTime);
        if (timespan > 0 && timespan % 2 === 0) {
            taggerTime = lock.taggerTime;
        }
    });

    return {commits: commits, commitsArray: commitsArray, latestTaggerTime: taggerTime};
};

let addLocks = () => {
    let finishedCount = 0;
    let progressTime = new Date().toISOString();

    console.log("Loading commits and existing locks...");
    let commitsInfo = loadCommits();
    let commits = commitsInfo.commits;
    let commitsArray = commitsInfo.commitsArray;
    let taggerTime = commitsInfo.latestTaggerTime;
    let firstCommitId = commitsArray[0].id;
    let lastCommitId = $util.last(commitsArray).id;

    let processCommit = commitId => {
        let commit = commits[commitId];
        if (commit.isNew) {
            let commitProperties = $git.analyzeCommit(commitId);
            let commitMessage = commitProperties.message;
            let files = commitProperties.files;

            $cache.shrinkDirectoryIdToFiles(files);

            files.forEach(file => {
                file.hash = $git.getFileHash(file);
            });

            let obj = {};
            obj.parentHashes = commit.parentIDs.map(id => $lock.getHash(commits[id].lockNames[0]));
            obj.files = files;
            obj.commitId = commitId;
            obj.commitMessage = commitMessage;
            let lock = new $lock.BaseLock(obj);
            commit.lockNames.push("gitlock-000-" + lock.hash);
            commit.baseLock = lock;

            let firstParentId = commit.parentIDs[0];
            if (firstParentId !== undefined) {
                let parentCommit = commits[firstParentId];
                if (parentCommit.baseLock === undefined) {
                    parentCommit.baseLock = $lock.Lock.fromName(parentCommit.lockNames[0]);
                }
                lock.fillDiff(parentCommit.baseLock);
            }

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
                delete $cache.hashToLock[commit.baseLock.hash];
                commit.baseLock.destroy(); // this sentence may be redundant, but keep it
                delete commit.baseLock;
            }
        });

        let now = new Date().toISOString();
        if ($util.subtractTime(now, progressTime) >= 1) {
            console.log(`${finishedCount} of ${commitsArray.length} commits processed.`);
            progressTime = now;
        }

        commit.childIDs.forEach(child => {
            if (commit.isNew && !commits[child].isNew) {
                throw new Error("Old lock already exists after a new lock.");
            }
        });
    };

    console.log("Processing locks...");
    commitsArray.forEach(commit => processCommit(commit.id));
    let lastLock = commits[lastCommitId].baseLock;
    if (lastLock !== undefined) {
        $cache.addPdBaseLock({
            hash: lastLock.hash,
            repo: firstCommitId,
            commit: lastCommitId,
            time: new Date().toISOString()
        }, lastLock.getContent());
    }
    console.log(`${finishedCount} of ${commitsArray.length} commits processed successfully.`);
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

let scanLocks = (args, callback) => {
    let commitsInfo = null;
    let commitId = null;
    let progressTime = new Date().toISOString();

    if (args[0] === "--all") {
        commitsInfo = loadCommits();
    }
    else {
        commitId = args.length === 1 ? args[0] : $git.getLastCommitId();
        let lockNames = $lock.getNamesFromCommit(commitId);
        let lockHashes = lockNames.map(m => $lock.getHash(m));
        if ($cache.inProgramData(lockHashes[0])) {
            commitsInfo = loadCommits(commitId);
        }
        else {
            commitsInfo = loadCommits();
        }
    }
    let commits = commitsInfo.commits;
    let commitsArray = commitsInfo.commitsArray;

    commitsArray.forEach((commit, index) => {
        commit.lockNames.forEach(lockName => {
            let lock = $lock.Lock.fromName(lockName);
            if (lockName.startsWith("gitlock-000-")) {
                if (lock.content === undefined) {
                    lock.fillContent();
                }
                commit.baseLock = lock;
            }

            if (commitId === null || commit.id === commitId) {
                callback(lock, lockName, commit, commits);
            }
        });

        commit.traversed = true;

        // Remove no longer used references to release memory.
        commit.parentIDs.forEach(parentId => {
            let commit = commits[parentId];
            if (commit.baseLock !== undefined && commit.childIDs.every(m => commits[m].traversed)) {
                delete $cache.hashToLock[commit.baseLock.hash];
                commit.baseLock.destroy(); // this sentence may be redundant, but keep it
                delete commit.baseLock;
            }
        });

        let now = new Date().toISOString();
        if ($util.subtractTime(now, progressTime) >= 1) {
            console.log(`${index + 1} of ${commitsArray.length} commits processed.`);
            progressTime = now;
        }
    });
};

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
    let errorLockNames = [];
    scanLocks(args.slice(1), (lock, lockName, commit, commits) => {
        try {
            if (lock instanceof $lock.BaseLock) {
                lock.verify(commit.id);
                lock.parentHashes.forEach(parentHash => {
                    assert(commit.parentIDs.some(m => commits[m].baseLock.hash === parentHash));
                });
                assert(lock.parentHashes.length === commit.parentIDs.length);
            }
            else {
                let parentLockName = commit.lockNames[parseInt($lock.getLabel(lockName)) - 1];
                let parentLock = $lock.Lock.fromName(parentLockName);
                lock.verify(parentLock);
                assert(lock.parentHash === parentLock.hash);
            }
        }
        catch (ex) {
            errorLockNames.push(lockName);
        }
    });
    if (errorLockNames.length === 0) {
        console.log("Verification OK.");
    }
    else {
        console.error("These locks didn't pass the verification:");
        errorLockNames.forEach(m => console.error(m));
        process.exit(1);
    }
}
else if (args[0] === "proof") {
    let dirPath = $util.slashPath($util.last(args));
    assert($fs.existsSync(dirPath));

    let list = [];
    scanLocks(args.slice(1, args.length - 1), (lock, lockName, commit) => {
        let label = $lock.getLabel(lockName);
        let filePath = $path.join(dirPath, lock.hash + ".txt");
        $fs.writeFileSync(filePath, lock.getContent());
        list.push(commit.id + " " + label + " " + lock.hash + "\n");
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
            console.log("Checking locks...");
            let commits = loadCommits(startingCommitId).commitsArray;
            console.log("Removing locks...");
            let lockNames = [];
            commits.forEach(commit => {
                commit.lockNames.forEach(m => lockNames.push(m));
            });
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
        else if (args[1] === "root-ca") {
            config.rootCa = args[2];
        }
        else {
            throw new Error("Invalid configuration name.");
        }
        $programData.saveConfig();
    }
}
else {
    console.error("Invalid arguments.");
    process.exit(1);
}
