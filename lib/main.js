"use strict";

// In the code, unless otherwise specified, "hash" means our SHA-256 hash.
// In the code, unless otherwise specified, ID means the Git object's SHA-1 hash.
// In the code, "file" can also mean a directory.

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

// `seconds` can't be negative
let addTime = (time, seconds) => {
    return new Date(new Date(time) - (-seconds)).toISOString();
};

let pad = (num, len) => {
    let s = num.toString();
    return "0".repeat(len - s.length) + s;
};

let delay = ms => {
    return new Promise((resolve, reject) => {
        setTimeout(() => {
            resolve();
        }, ms);
    });
};

let getLastCommit = () => $git.line(["rev-list", "--max-count=1", "HEAD"]);

let lock = () => {
    let commits = {};
    let fileIdToHash = {}; // cache for performance
    let treeFiles = {}; // cache for performance
    let finishedCount = 0;
    $git.lines(["rev-list", "--children", "--reverse", "HEAD"])
    .forEach(m => {
        let parts = m.split(" ");
        commits[parts[0]] = {};
        commits[parts[0]].locks = [];
        commits[parts[0]].children = parts.slice(1);
        commits[parts[0]].isNew = true;
        commits[parts[0]].traversed = false;
    });
    let commitsArray = Object.keys(commits);
    let firstCommit = commitsArray[0];
    let lastCommit = commitsArray[commitsArray.length - 1];
    $git.lines(["rev-list", "--parents", "HEAD"]).forEach(m => {
        let parts = m.split(" ");
        commits[parts[0]].parents = parts.slice(1);
    });

    let loadAllTags = () => {
        return new Promise((resolve, reject) => {
            let tags = $git.lines(["tag", "-l", "--sort=refname", "gitlock-*"]);
            if (tags.length === 0) {
                resolve();
            }
            else {
                let hashToCommit = {};
                let finishedCount = 0;
                tags.forEach(tag => {
                    let doTask = () => {
                        $lock.getContentAsync(tag).then(message => {
                            let parsedMessage = $lock.parseContent(message);
                            let commit = parsedMessage.commit;
                            if (commit === undefined) {
                                commit = hashToCommit[parsedMessage.parent];
                            }
                            commits[commit].locks.push(tag);
                            commits[commit].isNew = false;
                            hashToCommit[tag.match(/^gitlock-\d\d\d-(.*)$/)[1]] = commit;
                            finishedCount++;
                            if (finishedCount === tags.length) {
                                resolve();
                            }
                        }).catch(() => {
                            // This is a must. It's possible that it exceeds the per user process
                            // limit and throw a EAGAIN error, so we will retry.
                            delay(300).then(() => doTask());
                        });
                    };
                    doTask();
                });
            }
        });
    };

    let traverse = commit => {
        if (commits[commit].isNew) {
            let rawCommitObject = $git.run(["cat-file", "commit", $v.id(commit)]);
            let lines = $util.parseLines(rawCommitObject);
            let firstLineParts = lines[0].split(" ");
            assert(firstLineParts.length === 2 && firstLineParts[0] === "tree");
            let tree = firstLineParts[1];
            let emptyLineIndex = lines.indexOf("");

            // We verbatim restore the commit message. If the raw message ends with newline, it should
            // end with newline. If not, it should not.
            // (Normally all commit messages end with newlines. But if you use stdin to pass the
            // message and use verbatim option, it will not generate a trailing newline.)
            let commitMessage = lines.slice(emptyLineIndex + 1).join("\n"); // if out-of-boundary, it's ""
            if (commitMessage !== "" && rawCommitObject.endsWith("\n")) {
                commitMessage += "\n";
            }

            let files = [];
            let traverseDirectory = (id, pathPrefix) => {
                let parsedTree = treeFiles[id];
                if (parsedTree === undefined) {
                    parsedTree = $git.parseTree(
                        $git.run(["cat-file", "tree", $v.id(id)], {encoding: "buffer"})
                    );
                    treeFiles[id] = parsedTree;
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
            traverseDirectory(tree, "");

            let tagMessagePart1 = "";
            if (commits[commit].parents.length > 0) {
                commits[commit].parents.forEach(parent => {
                    tagMessagePart1 += "parent " + commits[parent].locks[0] + "\n";
                });
                tagMessagePart1 += "\n";
            }
            let tagMessagePart2 = "";
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
                tagMessagePart2 += file.mode + " " + hash + " " + file.path + "\n";
            });
            let tagMessagePart3 = "";
            tagMessagePart3 += "\ncommit " + commit + "\n";
            tagMessagePart3 += "\nbase64-" + Buffer.from(commitMessage).toString("base64") + "\n";
            tagMessagePart3 += "\nnonce " + $crypto.randomBytes(16).toString("hex") + "\n";
            let tagMessage = tagMessagePart1 + tagMessagePart2 + tagMessagePart3;
            commits[commit].locks.push($lock.computeHash(tagMessage));
            commits[commit].filesString = tagMessagePart2;
            let storedTagMessage = null;
            let firstParent = commits[commit].parents[0];
            if (firstParent === undefined) {
                storedTagMessage = tagMessage;
            }
            else {
                let baseFilesString = commits[firstParent].filesString;
                if (baseFilesString === undefined) {
                    storedTagMessage = tagMessage;
                }
                else {
                    storedTagMessage =
                        tagMessagePart1 +
                        $diff.computeDiff(baseFilesString, tagMessagePart2) +
                        tagMessagePart3;
                }
            }
            $git.run(
                [
                    "tag", "-a", "-F", "-", "--cleanup=verbatim",
                    "gitlock-000-" + $v.hash(commits[commit].locks[0]),
                    $v.id(commit)
                ],
                {
                    input: storedTagMessage,
                    env: {
                        GIT_COMMITTER_DATE: `${FAKE_DATE + finishedCount * 2} +0000`
                    }
                }
            );
        }

        commits[commit].traversed = true;

        finishedCount++;

        if (finishedCount % 10 === 0) {
            console.log(`${finishedCount} of ${commitsArray.length} commits processed.`);
        }

        commits[commit].children.forEach(child => {
            if (commits[commit].isNew && !commits[child].isNew) {
                throw new Error("Old lock already exists after a new lock.");
            }
            if (commits[child].parents.every(m => commits[m].traversed)) {
                traverse(child);
            }
        });
    };
    loadAllTags().then(() => {
        traverse(firstCommit);
    }).catch(err => {
        console.error(err);
        process.exit(1);
    });
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
    let lastCommit = getLastCommit();
    let tags = $git.lines([
        "tag", "-l", "--points-at", $v.id(lastCommit), "--sort=refname", "gitlock-*"
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
                    $v.id(lastCommit)
                ],
                {
                    input: newMessage,
                    env: {
                        GIT_COMMITTER_DATE: addTime(firstTagTime, 1)
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
    let commit = args[1];
    let tags = $git.lines([
        "tag", "-l", "--points-at", $v.id(commit), "--sort=refname", "gitlock-*"
    ]);
    let dirPath = $util.slashPath(args[2]);
    assert($fs.existsSync(dirPath));
    let list = [];
    tags.forEach((tag, index) => {
        let message = $lock.getContent(tag);
        let hash = $lock.getHash(tag);
        let filePath = $path.join(dirPath, hash + ".txt");
        $fs.writeFileSync(filePath, message);
        list.push(commit + " " + pad(index, 3) + " " + hash + "\n");
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
