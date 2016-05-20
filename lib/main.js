"use strict";

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
    if (msg.startsWith("signatures")) {
    }
    else if (msg.startsWith("timestamps")) {
    }
    else {
        let match = msg.match(
            /^((?:parent [^\s]*\n)*)\n*((?:\d{6} [^\n]*\n)*)\n*(commit [^\s]*\n)\n*(base64-[^\s]*\n)/
        );
        let parentLines = $util.parseLines(match[1]);
        let parents = parentLines.map(m => m.split(" ")[1]);
        let fileLines = $util.parseLines(match[2]);
        let files = fileLines.map(line => {
            let match = line.match(/^(\d{6}) ([^\s]*) (.*)$/);
            return {mode: match[1], hash: match[2], path: match[3]};
        });
        return {parents: parents, files: files};
    }
};

let getTagMessage = tag => {
    let tagId = $util.parseLine($cp.execSync("git show-ref --tags -s " + tag, {encoding: "utf8"}));
    let lines = $util.parseLines($cp.execSync("git cat-file tag " + tagId, {encoding: "utf8"}));
    let emptyLineIndex = lines.indexOf("");

    // Can't use `join("\n")` because the return value must end with newline char.
    return lines.slice(emptyLineIndex + 1).map(m => m + "\n").join(""); // if out-of-boundary, it's ""
};

// `data` can be string or buffer.
let computeHash = data => "sha256-" + $crypto.createHash("sha256").update(data).digest("hex");

if (args.length === 0) {
    let status = $cp.execSync("git status --porcelain", {encoding: "utf8"});
    if (status.length === 0) {
        let commits = {};
        let idToHash = {}; // cache for performance
        let finishedCount = 0;
        $util.parseLines($cp.execSync("git rev-list --children --reverse HEAD", {encoding: "utf8"}))
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
        $util.parseLines($cp.execSync("git rev-list --parents HEAD", {encoding: "utf8"})).forEach(m => {
            let parts = m.split(" ");
            commits[parts[0]].parents = parts.slice(1);
        });

        let traverse = commit => {
            let tags = $util.parseLines(
                $cp.execSync(`git tag -l --points-at ${commit} "gitlock-000-*"`, {encoding: "utf8"})
            );
            if (tags.length === 0) {
                let rawCommitObject = $cp.execSync("git cat-file commit " + commit, {encoding: "utf8"});
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
                    parseTree($cp.execSync("git cat-file tree " + id)).forEach(file => {
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
                    let hash = idToHash[file.id];
                    if (hash === undefined) {
                        if (file.mode.startsWith("040")) {
                            hash = "sha256-0000000000000000000000000000000000000000000000000000000000000000";
                        }
                        else {
                            let bytes = $cp.execSync("git cat-file blob " + file.id);
                            hash = computeHash(bytes);
                        }
                        idToHash[file.id] = hash;
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
                $cp.execSync(
                    // We can't use the Bash style `GIT_COMMITTER_DATE=...` before the command,
                    // because Windows can't recognize it. So we must set `env`.
                    `git tag -a -F - --cleanup=verbatim gitlock-000-${commits[commit].locks[0]} ${commit}`,
                    {
                        encoding: "utf8",
                        input: storedTagMessage,
                        env: {
                            GIT_COMMITTER_DATE: `${FAKE_DATE + finishedCount} +0000`
                        }
                    }
                );
            }
            else {
                let tag = tags[0];
                let hash = tag.match(/^gitlock-000-(.*)$/)[1];
                commits[commit].locks.push(hash);
                commits[commit].isNew = false;
                if (commits[commit].parents.some(m => commits[m].isNew)) {
                    throw new Error("Old lock already exists after a new lock.");
                }
                /*
                let tag = tags[0];
                let commitLock = parseTagMessage(getTagMessage(tag));
                commitLock.parents
                let tagId = $util.parseLine(
                    $cp.execSync("git show-ref --tags -s " + tag, {encoding: "utf8"})
                );
                */
            }

            finishedCount++;

            if (finishedCount % 10 === 0) {
                console.log(`${finishedCount} of ${commitsArray.length} commits processed.`);
            }

            commits[commit].children.forEach(child => {
                if (commits[child].parents.every(m => commits[m].locks.length > 0)) {
                    traverse(child);
                }
            });
        };
        traverse(firstCommit);
    }
}
else if (args[0] === "show") {
    assert(args[1].length > 0);
    let tags = $util.parseLines(
        // "--points-at" also applies to tag names. So it also works if `args[1]` is a lock name.
        $cp.execSync(`git tag -l --points-at ${args[1]} --sort=refname "gitlock-*"`, {encoding: "utf8"})
    );
    tags.forEach(tag => {
        console.log(tag);
        console.log("=".repeat(tag.length));
        console.log("");
        console.log(getTagMessage(tag));
    });
}
else if (args[0] === "list") {
    let tags = $util.parseLines(
        $cp.execSync("git tag -l --sort=taggerdate \"gitlock-*\"", {encoding: "utf8"})
    );
    tags.forEach(tag => {
        console.log(tag);
    });
}
else if (args[0] === "log") {
    $cp.execSync("git log --all --decorate --graph", {stdio: ["pipe", process.stdout, process.stderr]});
}
