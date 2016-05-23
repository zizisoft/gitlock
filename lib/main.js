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
let $util = require("./util");
let $diff = require("./diff");

let args = process.argv.slice();
args.splice(0, 2); // strip "node" and the name of this file

// Validate. For security, we must avoid malicious command injection.
// At least we should use `vArg`, but better use the more strict others.
// The most important thing in these patterns is that `&&`, `;` and `|` are forbidden.
let vArg = arg => {
    assert(arg.search(/^[A-Za-z0-9\._\-]*$/) !== -1);
    return arg;
};
let vId = id => {
    assert(id.search(/^[0-9a-f]{40}$/) !== -1);
    return id;
};
let vHash = hash => {
    assert(hash.search(/^sha256-[0-9a-f]{64}$/) !== -1);
    return hash;
};
let vTagName = name => {
    assert(name.search(/^gitlock-\d\d\d-sha256-[0-9a-f]{64}$/) !== -1);
    return name;
};
let vIdOrHashOrTagName = str => {
    try {
        vId(str);
        return str;
    }
    catch (ex) {
        try {
            vHash(str);
            return str;
        }
        catch (ex) {
            vTagName(str);
            return str;
        }
    }
};

let runGit = (args, options) => {
    let actualOptions = {encoding: "utf8"};
    Object.assign(actualOptions, options);

    // To workaround a Node.js bug:
    // In child process sync methods, `encoding` can't be explicitly set to "buffer".
    if (actualOptions.encoding === "buffer") {
        delete actualOptions.encoding;
    }

    return $cp.execFileSync("git", args, actualOptions);
};
let gitLine = (args, options) => {
    return $util.parseLine(runGit(args, options));
};
let gitLines = (args, options) => {
    return $util.parseLines(runGit(args, options));
};

// Must parse the raw tree. Can't parse pretty-printed tree because Unicode filename will be transformed.
let parseTree = bytes => {
    let r = [];
    let index = 0;
    while (index < bytes.length) {
        let file = {};
        let pos1 = bytes.indexOf(0x20, index);
        file.mode = bytes.toString("utf8", index, pos1);
        if (file.mode.length === 5) { // Git uses "40000" for tree, we normalize it to "040000".
            file.mode = "0" + file.mode;
        }
        let pos2 = bytes.indexOf(0x00, pos1 + 1);
        file.name = bytes.toString("utf8", pos1 + 1, pos2);
        index = pos2 + 20 + 1;
        file.id = bytes.toString("hex", pos2 + 1, index);
        r.push(file);
    }
    return r;
};

let parseTagMessage = msg => {
    if (msg.startsWith("signatures\n")) {
    }
    else if (msg.startsWith("timestamps\n")) {
    }
    else {
        let match = msg.match(
            /^((?:parent [^\s]*\n)*)\n*((?:(?:a|d|c|\d{6}) [^\n]*\n)*)\n*commit ([^\s]*)\n\n*base64-([^\s]*)\n/
        );
        let parentLines = $util.parseLines(match[1]);
        let parents = parentLines.map(m => m.split(" ")[1]);
        if (match[2].startsWith("a ") || match[2].startsWith("d ") || match[2].startsWith("c ")) {
            return {parents: parents, diff: match[2], commit: match[3]};
        }
        else {
            let fileLines = $util.parseLines(match[2]);
            let files = fileLines.map(line => {
                let match = line.match(/^(\d{6}) ([^\s]*) (.*)$/);
                return {mode: match[1], hash: match[2], path: match[3]};
            });
            return {parents: parents, files: files, commit: match[3]};
        }
    }
};

let getTagMessage = tag => {
    let tagId = gitLine(["show-ref", "--tags", "-s", vTagName(tag)]);
    let lines = gitLines(["cat-file", "tag", vId(tagId)]);
    let emptyLineIndex = lines.indexOf("");

    // Can't use `join("\n")` because the return value must end with newline char.
    return lines.slice(emptyLineIndex + 1).map(m => m + "\n").join(""); // if out-of-boundary, it's ""
};

let getTagMessageAsync = tag => {
    return new Promise((resolve, reject) => {
        $cp.execFile(["show-ref", "--tags", "-s", vTagName(tag)], {encoding: "utf8"}, (err, stdout) => {
            if (err !== null) {
                reject(err);
                return;
            }
            let tagId = $util.parseLine(stdout);
            $cp.execFile(["cat-file", "tag", vId(tagId)], {encoding: "utf8"}, (err, stdout) => {
                if (err !== null) {
                    reject(err);
                    return;
                }
                let lines = $util.parseLines(stdout);
                let emptyLineIndex = lines.indexOf("");

                // Can't use `join("\n")` because the return value must end with newline char.
                resolve(
                    lines.slice(emptyLineIndex + 1).map(m => m + "\n").join("") // if out-of-boundary, it's ""
                );
            });
        });
    });
};

let delay = ms => {
    return new Promise((resolve, reject) => {
        setTimeout(() => {
            resolve();
        }, ms);
    });
};

// `data` can be string or buffer.
let computeHash = data => "sha256-" + $crypto.createHash("sha256").update(data).digest("hex");

let lock = () => {
    let commits = {};
    let fileIdToHash = {}; // cache for performance
    let treeFiles = {}; // cache for performance
    let finishedCount = 0;
    gitLines(["rev-list", "--children", "--reverse", "HEAD"])
    .forEach(m => {
        let parts = m.split(" ");
        commits[parts[0]] = {};
        commits[parts[0]].locks = [];
        commits[parts[0]].children = parts.slice(1);
        commits[parts[0]].isNew = true;
    });
    let commitsArray = Object.keys(commits);
    let firstCommit = commitsArray[0];
    let lastCommit = commitsArray[commitsArray.length - 1];
    gitLines(["rev-list", "--parents", "HEAD"]).forEach(m => {
        let parts = m.split(" ");
        commits[parts[0]].parents = parts.slice(1);
    });

    let loadAllTags = () => {
        return new Promise((resolve, reject) => {
            let tags = gitLines(["tag", "-l", "--sort=refname", "gitlock-*"]);
            if (tags.length === 0) {
                resolve();
            }
            else {
                let hashToCommit = {};
                let finishedCount = 0;
                tags.forEach(tag => {
                    let doTask = () => {
                        getTagMessageAsync(tag).then(message => {
                            let parsedMessage = parseTagMessage(message);
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
            let rawCommitObject = runGit(["cat-file", "commit", vId(commit)]);
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
                    parsedTree = parseTree(runGit(["cat-file", "tree", vId(id)], {encoding: "buffer"}));
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
                        let bytes = runGit(["cat-file", "blob", vId(file.id)], {encoding: "buffer"});
                        hash = computeHash(bytes);
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
            commits[commit].locks.push(computeHash(tagMessage));
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
            runGit(
                [
                    "tag", "-a", "-F", "-",
                    "--cleanup=verbatim gitlock-000-" + vHash(commits[commit].locks[0]),
                    vId(commit)
                ],
                {
                    input: storedTagMessage,
                    env: {
                        GIT_COMMITTER_DATE: `${FAKE_DATE + finishedCount} +0000`
                    }
                }
            );
        }

        finishedCount++;

        if (finishedCount % 10 === 0) {
            console.log(`${finishedCount} of ${commitsArray.length} commits processed.`);
        }

        commits[commit].children.forEach(child => {
            if (commits[commit].isNew && !commits[child].isNew) {
                throw new Error("Old lock already exists after a new lock.");
            }
            if (commits[child].parents.every(m => commits[m].locks.length > 0)) {
                traverse(child);
            }
        });
    };
    loadAllTags().then(() => {
        traverse(firstCommit);
    }).catch(err => {
        console.log(err);
    });
};

if (args.length === 0 || args[0] === "-m" || args[0] === "commit") {
    let status = gitLines(["status", "--porcelain"]);
    if (status.some(m => m[0] !== " " && m[0] !== "?" && m[0] !== "!")) {
        if (args.length === 0) {
            runGit(["commit", "--allow-empty-message"]);
        }
        else if (args[0] === "-m") {
            assert(args.length === 2);
            $cp.execFileSync("git", ["commit", "-m", args[1]]);
        }
        else if (args[0] === "commit") {
            $cp.execFileSync("git", args);
        }
    }
    lock();
}
else if (args[0] === "show") {
    // "--points-at" also applies to tag names. So it also works if `args[1]` is a lock name.
    // TODO: Currently do not support hash name
    let tags = gitLines([
        "tag", "-l", "--points-at", vIdOrHashOrTagName(args[1]), "--sort=refname", "gitlock-*"
    ]);
    tags.forEach(tag => {
        console.log(tag);
        console.log("=".repeat(tag.length));
        console.log("");
        console.log(getTagMessage(tag));
    });
}
else if (args[0] === "list") {
    let tags = gitLines("tag", "-l", "--sort=taggerdate", "gitlock-*");
    tags.forEach(tag => {
        console.log(tag);
    });
}
else if (args[0] === "log") {
    runGit(["log", "--all", "--decorate", "--graph"], {
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
        let tags = gitLines(["tag", "-l", "gitlock-*"]);
        runGit(["tag", "-d", tags.map(m => vTagName(m))]);
    }
}
