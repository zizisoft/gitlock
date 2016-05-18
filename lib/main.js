"use strict";

// The first Git commit happens on 2005-04-07T22:13Z (see https://github.com/git/git).
// We set it to be a little after this time to respect Git.
let FAKE_DATE = Math.round(new Date("2005-04-08T00:00:00Z").getTime() / 1000);

let $cp = require("child_process");
let assert = require("assert");
let $crypto = require("crypto");

let args = process.argv.slice();
args.splice(0, 2); // strip "node" and the name of this file

let parseLines = str => {
    let r = str.split(/\r\n|\n/);
    if (r[r.length - 1] === "") {
        r.pop();
    }
    return r;
};

// Similar to `parseLines`, but forces exactly 1 line, otherwise throws. Returns the line.
// So in fact, the difference between in and out is just that the trailing newline char is stripped.
let parseLine = str => {
    let lines = parseLines(str);
    assert(lines.length === 1);
    return lines[0];
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
    if (msg.startsWith("signatures")) {
    }
    else if (msg.startsWith("timestamps")) {
    }
    else {
        let match = msg.match(
            /^((?:parent [^\s]*\n)*)\n*((?:\d{6} [^\n]*\n)*)\n*(commit [^\s]*\n)\n*(base64-[^\s]*\n)/
        );
        let parentLines = parseLines(match[1]);
        let parents = parentLines.map(m => m.split(" ")[1]);
        let fileLines = parseLines(match[2]);
        let files = fileLines.map(line => {
            let match = line.match(/^(\d{6}) ([^\s]*) (.*)$/);
            return {mode: match[1], hash: match[2], path: match[3]};
        });
        return {parents: parents, files: files};
    }
};

let getTagMessage = tag => {
    let tagId = parseLine($cp.execSync("git show-ref --tags -s " + tag, {encoding: "utf8"}));
    let lines = parseLines($cp.execSync("git cat-file tag " + tagId, {encoding: "utf8"}));
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
        let fakeDateOffset = 0;
        parseLines($cp.execSync("git rev-list --children --reverse HEAD", {encoding: "utf8"})).forEach(m => {
            let parts = m.split(" ");
            commits[parts[0]] = {};
            commits[parts[0]].locks = [];
            commits[parts[0]].children = parts.slice(1);
            commits[parts[0]].isNew = true;
        });
        let commitsArray = Object.keys(commits);
        let firstCommit = commitsArray[0];
        let lastCommit = commitsArray[commitsArray.length - 1];
        parseLines($cp.execSync("git rev-list --parents HEAD", {encoding: "utf8"})).forEach(m => {
            let parts = m.split(" ");
            commits[parts[0]].parents = parts.slice(1);
        });

        let traverse = commit => {
            let tags = parseLines(
                $cp.execSync(`git tag -l --points-at ${commit} "gitlock-000-*"`, {encoding: "utf8"})
            );
            if (tags.length === 0) {
                let rawCommitObject = $cp.execSync("git cat-file commit " + commit, {encoding: "utf8"});
                let lines = parseLines(rawCommitObject);
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

                let tagMessage = "";
                if (commits[commit].parents.length > 0) {
                    commits[commit].parents.forEach(parent => {
                        tagMessage += "parent " + commits[parent].locks[0] + "\n";
                    });
                    tagMessage += "\n";
                }
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
                    tagMessage += file.mode + " " + hash + " " + file.path + "\n";
                });
                tagMessage += "\ncommit " + commit + "\n";
                tagMessage += "\nbase64-" + Buffer.from(commitMessage).toString("base64") + "\n";
                tagMessage += "\nnonce " + $crypto.randomBytes(16).toString("hex") + "\n";
                commits[commit].locks.push(computeHash(tagMessage));
                $cp.execSync(
                    `GIT_COMMITTER_DATE="${FAKE_DATE + fakeDateOffset} +0000" ` +
                    `git tag -a -F - --cleanup=verbatim gitlock-000-${commits[commit].locks[0]} ${commit}`,
                    {encoding: "utf8", input: tagMessage}
                );
                fakeDateOffset++;
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
                let tagId = parseLine($cp.execSync("git show-ref --tags -s " + tag, {encoding: "utf8"}));
                */
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
    let tags = parseLines(
        $cp.execSync(`git tag -l --points-at ${args[1]} "gitlock-*" --sort=refname`, {encoding: "utf8"})
    );
    tags.forEach(tag => {
        console.log(tag);
        console.log("=".repeat(tag.length));
        console.log("");
        console.log(getTagMessage(tag));
    });
}
