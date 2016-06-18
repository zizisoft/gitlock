"use strict";

/*
Since GitHub mixes all tags into "releases" and can only sort them by tagger time, we must
put locks into an earlier time, so that people can still easily find real releases.
Luckily, tagger time can be different from the commit time as long as it's annotated.
The first Git commit happens on 2005-04-07T22:13Z (see https://github.com/git/git).
We set it to be a little after this time to respect Git.
The first lock's time will be 2 seconds after this time.

Only 3 subcommands can bypass the argument validation, because it's impossible.
They are "-m", "commit" and "tag". But luckily, on one hand, "git commit -m <message>"
is obviously safe. On the other hand, when one use "gitlock commit [...]" he must
be aware that it has the same grammar as "git commit [...]", so it's also safe.
The same goes for "tag" because "git tag -a -m '' <tagname>" is obviously safe.
*/

let TAGGER_TIME_ORIGIN = "2005-04-08T00:00:00Z";

let $cp = require("child_process");
let assert = require("assert");
let $crypto = require("crypto");
let $path = require("path").posix;
let $fs = require("fs");
let $http = require("http");
let $url = require("url");

let $packageInfo = require("../package.json");
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

let normalizeConfigCommas = str => str.split(",").map(m => m.trim()).join(",");

let loadCommits = startId => {
    let info = $git.getCommits(startId);
    let commits = info.object;
    let commitsArray = info.array;
    let taggerTime = TAGGER_TIME_ORIGIN;

    commitsArray.forEach(commit => {
        commit.locks = [];
        commit.isNew = true;
        commit.traversed = false;
    });

    $lock.getAllLocks().forEach(lock => {
        // If it's on a new branch, and an old branch already has locks, these locks'
        // commits may be not in rev-list. We should prevent error.
        if (commits[lock.commitId] !== undefined) {
            commits[lock.commitId].locks.push(lock);
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
    let hasNewLocks = false;

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
            obj.parentHashes = commit.parentIDs.map(id => commits[id].locks[0].hash);
            obj.files = files;
            obj.commitId = commitId;
            obj.commitMessage = commitMessage;
            let lock = new $lock.BaseLock(obj);
            lock.name = "gitlock-000-" + lock.hash;
            commit.locks.push(lock);
            commit.baseLock = lock;

            let firstParentId = commit.parentIDs[0];
            if (firstParentId !== undefined) {
                let parentCommit = commits[firstParentId];
                if (parentCommit.baseLock === undefined) {
                    parentCommit.baseLock = $lock.Lock.fromMini(parentCommit.locks[0]);
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
            hasNewLocks = true;
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
    return hasNewLocks;
};

let basicCommand = args => {
    if (args === undefined) {
        args = [];
    }
    let status = $git.lines(["status", "--porcelain"]);
    if (status.some(m => m[0] !== " " && m[0] !== "?" && m[0] !== "!")) {
        console.log("Committing files in the index...");

        if (args.length === 0) {
            $git.runWithoutCapture(["commit", "--allow-empty-message", "-m", ""]);
        }
        else if (args[0] === "-m") {
            assert(args.length === 2);
            $git.runWithoutCapture(["commit", "-m", args[1]]);
        }
        else if (args[0] === "commit") {
            $git.runWithoutCapture(args);
        }
    }
    return addLocks();
};

let scanLocks = (args, callback) => {
    let commitsInfo = null;
    let commitId = null;
    let ownCommitsInfo = null;
    let progressTime = new Date().toISOString();

    if (args[0] === "--all") {
        assert(args.length === 1);
        if (!$lock.headHasLocks()) {
            throw new Error("head-has-no-lock");
        }
        commitsInfo = loadCommits();
    }
    else {
        if (args.length === 0) {
            if (!$lock.headHasLocks()) {
                throw new Error("head-has-no-lock");
            }
            commitId = $git.getLastCommitId();
        }
        else if (args[0] === "--to-head") {
            assert(args.length === 2);
            commitId = args[1];
            ownCommitsInfo = loadCommits(commitId);
        }
        else {
            assert(args.length === 1);
            commitId = args[0];
        }
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
    let allCommitsInfo = loadCommits();

    commitsArray.forEach((commit, index) => {
        commit.locks.forEach((lock, index) => {
            assert(index === parseInt($lock.getLabel(lock.name)));

            lock = commit.locks[index] = $lock.Lock.fromMini(lock);
            if (lock.name.startsWith("gitlock-000-")) {
                if (lock.content === undefined) {
                    lock.fillContent();
                }
                commit.baseLock = lock;
            }

            if (
                commitId === null ||
                commit.id === commitId ||
                (ownCommitsInfo !== null && ownCommitsInfo.commits[commit.id] !== undefined)
            ) {
                // The 5th argument denotes whether it's the specified starting commit.
                callback(
                    lock, lock.name, commit, commits,
                    commitId !== null && commit.id === commitId,
                    allCommitsInfo.commits
                );
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

let addTimestamp = () => {
    let lastCommitId = $git.getLastCommitId();
    let lockNames = $git.lines([
        "tag", "-l", "--points-at", $v.id(lastCommitId), "gitlock-*"
    ]).sort();
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
        throw new Error("openssl-version-too-low");
    }

    let url = $url.parse(config.tsa[0]);
    assert(url.protocol === "http:");
    console.log(`Sending timestamp request to "${url.hostname}"...`);
    return new Promise((resolve, reject) => {
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
                console.log(`Timestamp added. Content length: ${data.length}. Verifying timestamp...`);
                try {
                    verify([lastCommitId]); // TODO: This is not perfect, for it verifies the whole commit
                    resolve();
                }
                catch (ex) {
                    reject(ex);
                }
            });
            serverResponse.on("error", ex => {
                reject(ex);
            });
        });
        clientRequest.write(request);
        clientRequest.end();
    });
};

let verify = args => {
    let errorLockNames = [];
    scanLocks(args, (lock, lockName, commit, commits, isSpecifiedStarting, allCommits) => {
        try {
            if (lock instanceof $lock.BaseLock) {
                lock.verify(commit.id);

                // Can't use `commit.parentIDs` because they may be incomplete.
                let parentCommitIDs = allCommits[commit.id].parentIDs;

                lock.parentHashes.forEach(parentHash => {
                    assert(parentCommitIDs.some(m =>
                        (commits[m] !== undefined ?
                            commits[m].baseLock.hash :
                            $lock.getHash($lock.getNamesFromCommit(m)[0])
                        ) === parentHash
                    ));
                });
                assert(lock.parentHashes.length === parentCommitIDs.length);
            }
            else {
                let parentMiniLock = commit.locks[parseInt($lock.getLabel(lockName)) - 1];
                let parentLock = $lock.Lock.fromMini(parentMiniLock);
                lock.verify(parentLock);
                assert(lock.parentHash === parentLock.hash);
            }
        }
        catch (ex) {
            if (ex.message === "no-root-ca") throw ex;
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
};

let handleError = ex => {
    let code = ex.message;
    let text = null;
    if (code === "invalid-arguments") {
        text = "Invalid arguments.";
    }
    else if (code === "invalid-config-name") {
        text = "Invalid configuration name.";
    }
    else if (code === "openssl-version-too-low") {
        text =
            "Your OpenSSL version is too low. This program requires OpenSSL 1.0+. " +
            "Please `config openssl` to a path containing a different version.";
    }
    else if (code === "no-root-ca") {
        text = "You must `config root-ca` to a path before you can verify timestamps.";
    }
    else if (code === "head-has-no-lock") {
        text = "No lock found in HEAD commit.";
    }
    else if (code === "parse-non-timestamp") {
        text = "`parse` only applies to timestamps.";
    }
    else if (code === "directory-not-exist") {
        text = "Directory doesn't exist.";
    }
    else {
        throw ex;
    }
    console.error("Error:");
    console.error(text);
    process.exit(1);
};

if (args[0] !== "config" && args[0] !== "version" && args[0] !== "--version") {
    try {
        let version = $cp.execFileSync(config.openssl, ["version"], {encoding: "utf8"});
        if (version.startsWith("OpenSSL 0.")) throw new Error();
    }
    catch (ex) {
        console.error(
            "Warning: OpenSSL not found, or OpenSSL version lower than 1.0. " +
            "You may need to `config openssl` to a different path."
        );
    }
}

try {
    if (args.length === 0 || args[0] === "-m" || args[0] === "commit") {
        let hasNewLocks = basicCommand(args);
        if (hasNewLocks) {
            let lockDefault = normalizeConfigCommas(config.lockDefault);
            if (lockDefault === "lock,timestamp") {
                addTimestamp().catch(ex => {
                    handleError(ex);
                });
            }
        }
        else {
            console.log("Locks are already up-to-date. No new lock added.");
        }
    }
    else if (args[0] === "timestamp") {
        basicCommand();
        addTimestamp().catch(ex => {
            handleError(ex);
        });
    }
    else if (args[0] === "push") {
        let hasNewLocks = basicCommand();
        if (hasNewLocks) {
            let pushDefault = normalizeConfigCommas(config.pushDefault);
            if (pushDefault === "lock,timestamp") {
                addTimestamp().then(() => {
                    console.log("Applying secure delay. Will continue after 5 seconds...");
                    return $util.delay(5000);
                }).then(() => {
                    $git.runWithoutCapture(["push", "--follow-tags"]);
                }).catch(ex => {
                    handleError(ex);
                });
            }
            else {
                $git.runWithoutCapture(["push", "--follow-tags"]);
            }
        }
        else {
            console.log("Locks are already up-to-date. No new lock added.");
            $git.runWithoutCapture(["push", "--follow-tags"]);
        }
    }
    else if (args[0] === "verify") {
        verify(args.slice(1));
    }
    else if (args[0] === "proof") {
        assert(args.length >= 2);
        let dirPath = $util.slashPath($util.last(args));
        assert($fs.existsSync(dirPath), "directory-not-exist");

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
            "tag", "-l", "--points-at", $v.idOrHashOrLockName(args[1]), "gitlock-*"
        ]).sort();
        lockNames.forEach(name => {
            console.log(name);
            console.log("=".repeat(name.length));
            console.log("");

            // Can't use cache, because we want to show the verbatim stored content.
            console.log($lock.Lock.fromName(name, false).storedContent);
        });
    }
    else if (args[0] === "show-content") { // for testing purposes only
        process.stdout.write($lock.Lock.fromName(args[1]).getContent());
    }
    else if (args[0] === "show-stored-content") { // for testing purposes only
        // Can't use cache, because we want to show the verbatim stored content.
        process.stdout.write($lock.Lock.fromName(args[1], false).storedContent);
    }
    else if (args[0] === "parse") {
        let lock = $lock.Lock.fromName(args[1]);
        assert(lock instanceof $lock.TimestampLock, "parse-non-timestamp");
        $cp.execFileSync(
            config.openssl,
            ["asn1parse", "-inform", "DER"],
            {
                input: lock.data[0],
                stdio: ["pipe", process.stdout, process.stderr]
            }
        );
    }
    else if (args[0] === "list") {
        let lockNames = $git.lines([
            "for-each-ref", "--format=%(refname:short)", "--sort=taggerdate", "refs/tags/gitlock-*"
        ]);
        lockNames.forEach(name => {
            console.log(name);
        });
    }
    else if (args[0] === "log") {
        $git.runWithoutCapture(["log", "--all", "--decorate", "--graph"]);
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
                "tag", "-l", "--points-at", $v.id($git.getLastCommitId()), "gitlock-*"
            ]).sort();
            removeLocks(lockNames);
        }
        else if (type === "--last") {
            let lockNames = $git.lines([
                "tag", "-l", "--points-at", $v.id($git.getLastCommitId()), "gitlock-*"
            ]).sort();
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
                    commit.locks.forEach(m => lockNames.push(m.name));
                });
                removeLocks(lockNames);
            }
        }
    }
    else if (args[0] === "tag") {
        if (args[1] === undefined) {
            let tagNames = $git.lines(["tag", "-l"]);
            tagNames.forEach(name => {
                if (!name.startsWith("gitlock-")) {
                    console.log(name);
                }
            });
        }
        else {
            $git.runWithoutCapture(["tag", "-a", "-m", "", args[1]]);
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
            else if (args[1] === "lock-default") {
                let setting = normalizeConfigCommas(args[2]);
                assert(setting === "lock" || setting === "lock,timestamp");
                config.lockDefault = setting;
            }
            else if (args[1] === "push-default") {
                let setting = normalizeConfigCommas(args[2]);
                assert(setting === "lock" || setting === "lock,timestamp");
                config.pushDefault = setting;
            }
            else {
                throw new Error("invalid-config-name");
            }
            $programData.saveConfig();
        }
    }
    else if (args[0] === "--version" || args[0] === "version") {
        console.log($packageInfo.version);
    }
    else {
        throw new Error("invalid-arguments");
    }
}
catch (ex) {
    handleError(ex);
}
