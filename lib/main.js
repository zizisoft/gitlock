"use strict";

// In the code, unless otherwise specified, "hash" means our SHA-256 hash string,
// including the "sha256-" prefix.
// In the code, unless otherwise specified, ID means the Git object's SHA-1 hash string.
// Commit is a concept (or object), not a string. But commit ID is a string.
// In the code, "file" can also mean a directory. File is a concept (or object), not a string.
// File path is a string.
// The first lock for a commit is called the base lock. Subsequent locks for this commit
// are called derived locks.
// Lock name is the string starting with "gitlock-" (tag name). Lock content is
// the tag message. Lock is a concept (or object), not a string.
// Time is an ISO-8601 string, not a `Date` object or a number.

// The first Git commit happens on 2005-04-07T22:13Z (see https://github.com/git/git).
// We set it to be a little after this time to respect Git.
let FAKE_DATE = Math.round(new Date("2005-04-08T00:00:00Z").getTime() / 1000);

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

let args = process.argv.slice();
args.splice(0, 2); // strip "node" and the name of this file

let lock = () => {
    let commits = {};
    let fileIdToHash = {}; // cache for performance
    let directoryFiles = {}; // cache for performance
    let finishedCount = 0;
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
                $lock.generateNonce;
            let lockContent = lockContentPart1 + lockContentPart2 + lockContentPart3;
            commit.lockHashes.push($lock.computeHash(lockContent));

            commit.filesString = lockContentPart2;

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
            $git.run(
                [
                    "tag", "-a", "-F", "-", "--cleanup=verbatim",
                    "gitlock-000-" + $v.hash(commit.lockHashes[0]),
                    $v.id(commitId)
                ],
                {
                    input: storedLockContent,
                    env: {
                        GIT_COMMITTER_DATE: `${FAKE_DATE + finishedCount * 2} +0000`
                    }
                }
            );
        }

        commit.traversed = true;

        finishedCount++;

        if (finishedCount % 10 === 0) {
            console.log(`${finishedCount} of ${commitIDs.length} commits processed.`);
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

    loadAllLocks();
    traverse(firstCommitId);
};

let configFilePath = $path.join($util.homeDir, ".gitlock");

// default config
let config = {
    tsa: ["http://timestamp.comodoca.com/rfc3161"],
    openssl: "openssl",
    lockDefault: "lock",
    pushDefault: "lock",
    private: []
};

if ($fs.existsSync(configFilePath)) {
    let savedConfig = JSON.parse($fs.readFileSync(configFilePath, {encoding: "utf8"}));
    Object.assign(config, savedConfig);
    $fs.writeFileSync(configFilePath, JSON.stringify(config));
}
else {
    $fs.writeFileSync(configFilePath, JSON.stringify(config));
}

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
    lock();
}
else if (args[0] === "timestamp") {
    let lastCommitId = $git.getLastCommitId();
    let tags = $git.lines([
        "tag", "-l", "--points-at", $v.id(lastCommitId), "--sort=refname", "gitlock-*"
    ]);
    let tag = tags[tags.length - 1];
    let firstTagTime = $lock.getTime(tags[0]);
    let request = $cp.execFileSync(
        config.openssl,
        ["ts", "-query", "-cert", "-sha256"],
        {input: $lock.getContent(tag)}
    );
    let url = $url.parse(config.tsa[0]);
    let clientRequest = $http.request({
        hostname: url.hostname,
        method: "POST",
        path: url.path,
        headers: {"Content-Type": "application/timestamp-query"}
    }, serverResponse => {
        let data = Buffer.from([]);
        serverResponse.on("data", chunk => {
            data = Buffer.concat([data, chunk]);
        });
        serverResponse.on("end", () => {
            let newMessage =
                "timestamps\n" +
                "\n" +
                "parent " + $lock.getHash(tag) + "\n" +
                "\n" +
                $lock.generateBase64(data) + "\n" +
                "\n" +
                $lock.generateNonce();
            let newTag = "gitlock-" + $lock.generateLabel(tag) + "-" + $lock.computeHash(newMessage);
            $git.run(
                [
                    "tag", "-a", "-F", "-", "--cleanup=verbatim",
                    $v.lockName(newTag),
                    $v.id(lastCommitId)
                ],
                {
                    input: newMessage,
                    env: {
                        GIT_COMMITTER_DATE: $util.addTime(firstTagTime, 1)
                    }
                }
            );
            console.log(data, data.length);
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
    let tags = $git.lines([
        "tag", "-l", "--points-at", $v.id(commitId), "--sort=refname", "gitlock-*"
    ]);
    let dirPath = $util.slashPath(args[2]);
    assert($fs.existsSync(dirPath));
    let list = [];
    tags.forEach((tag, index) => {
        let message = $lock.getContent(tag);
        let hash = $lock.getHash(tag);
        let filePath = $path.join(dirPath, hash + ".txt");
        $fs.writeFileSync(filePath, message);
        list.push(commitId + " " + $util.pad(index, 3) + " " + hash + "\n");
    });
    $fs.writeFileSync($path.join(dirPath, "list.txt"), list.join(""));
    let readme = `How to Verify
================================================================================

"list.txt" lists all commits in order (first on top, last on bottom) with their
SHA-256 locks.

Make sure you have OpenSSL 1.0+ installed on your computer. If you're not
certain of the version, type "openssl version" to find it. On Linux it's already
built-in. On Windows, it's already installed when you installed Git. But on Mac
OS, the built-in version is 0.9.8, so you have to compile and install 1.0+:

https://wiki.openssl.org/index.php/Compilation_and_Installation

In the following text, we use the command name "openssl" for simplification. You
may need to replace it with "your-path/openssl".

Verify a Timestamp
------------------

First, we'll need to find the timestamp. In "list.txt", a timestamp has a
3-digit mark greater than "000". Find it, and find the corresponding .txt file.
The file is like this:

- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
timestamps

parent sha256-...

base64-...

nonce ...
- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

The actual "base64" field is very long (usually 3K characters). You can use
whatever method to decode the Base64 string (excluding the "base64-" prefix) to
binary format and save it to a file named "timestamp.tsr". One method is to type
this in Node.js REPL:

fs.writeFileSync("your-path/timestamp.tsr", new Buffer("your-base64-string",
"base64"))

Then, we'll need to find the time in the timestamp. Use this command:

openssl asn1parse -inform DER -in <timestamp>

You can find these lines in the output:

... prim: OBJECT    :signingTime
... cons: SEQUENCE
... prim: UTCTIME   :150228132728Z

It means it's signed on 2015-02-28 13:27:28 UTC Time.

Finally, we verify the timestamp with the data file. The data's 3-digit mark is
less than the timestamp's by 1. If timestamp is to "001" then data is to "000".
Find the corresponding .txt data file. (Note that "data" here can also be a
timestamp, if you have "002" timestamp then the "001" timestamp is treated as
data when you verify "002". It's called the timestamp chain. The common use is
to extend the expiration date, because most timestamps expire in 5-10 years.)

On Linux, it's simple:

openssl ts -verify -in <timestamp> -data <data> -CApath /etc/ssl/certs

On Windows / Mac OS, you'll need to specify a self-signed root certificate it
should trust:

openssl ts -verify -in <timestamp> -data <data> -CAfile <root-cert>

The root certificate must be in PEM (i.e. Base64-encoded) format. You can
get it by exporting it. On Windows, type "certlm". On Mac OS, use KeyChain. For
example, Comodo uses this root "UTN-USERFirst-Object". You can also download it
at:

https://support.comodo.com/index.php?/Default/Knowledgebase/Article/View/910/93/
old-utn-userfirst-object

Which root certificate does the timestamp use? Analyse the parsed timestamp and
you'll know.

You may argue that many root certificates are using SHA-1! Please review this
article to find out why it doesn't matter if a root certificate is in SHA-1:

https://blog.qualys.com/ssllabs/2014/09/09/sha1-deprecation-what-you-need-to-
know

Verify Files
------------

You just need to find the "000" item and then find the corresponding .txt file.
Then compare the hash values with the raw files. That's very easy. I think you
already know it.
`;
    $fs.writeFileSync($path.join(dirPath, "README.txt"), readme);
}
else if (args[0] === "show") {
    // "--points-at" also applies to tag names. So it also works if `args[1]` is a lock name.
    // TODO: Currently do not support hash name
    let tags = $git.lines([
        "tag", "-l", "--points-at", $v.idOrHashOrLockName(args[1]), "--sort=refname", "gitlock-*"
    ]);
    tags.forEach(tag => {
        console.log(tag);
        console.log("=".repeat(tag.length));
        console.log("");
        console.log($lock.getContent(tag));
    });
}
else if (args[0] === "list") {
    let tags = $git.lines(["tag", "-l", "--sort=taggerdate", "gitlock-*"]);
    tags.forEach(tag => {
        console.log(tag);
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
        let tags = $git.lines(["tag", "-l", "gitlock-*"]);
        $git.run(["tag", "-d"].concat(tags.map(m => $v.lockName(m))));
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
        $fs.writeFileSync(configFilePath, JSON.stringify(config));
    }
}
