"use strict";

// The first Git commit happens on 2005-04-07T22:13Z (see https://github.com/git/git).
// We set it to be a little after this time to respect Git.
let fakeDateString = "GIT_COMMITTER_DATE=\"2005-04-08T00:00:00Z\"";

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

// `data` can be string or buffer.
let computeHash = data => "sha256-" + $crypto.createHash("sha256").update(data).digest("hex");

if (args.length === 0) {
    let status = $cp.execSync("git status --porcelain", {encoding: "utf8"});
    if (status.length === 0) {
        let commits = {};
        let idToHash = {}; // cache for performance
        parseLines($cp.execSync("git rev-list --children --reverse HEAD", {encoding: "utf8"})).forEach(m => {
            let parts = m.split(" ");
            commits[parts[0]] = {};
            commits[parts[0]].locks = [];
            commits[parts[0]].children = parts.slice(1);
        });
        let commitsArray = Object.keys(commits);
        let firstCommit = commitsArray[0];
        let lastCommit = commitsArray[commitsArray.length - 1];
        parseLines($cp.execSync("git rev-list --parents HEAD", {encoding: "utf8"})).forEach(m => {
            let parts = m.split(" ");
            commits[parts[0]].parents = parts.slice(1);
        });

        let traverse = commit => {
            let lines = parseLines($cp.execSync("git cat-file -p " + commit, {encoding: "utf8"}));
            let firstLineParts = lines[0].split(" ");
            assert(firstLineParts.length === 2 && firstLineParts[0] === "tree");
            let tree = firstLineParts[1];
            let emptyLineIndex = lines.indexOf("");
            let commitMessage = lines.slice(emptyLineIndex + 1).join(""); // if out-of-boundary, it's ""

            let files = [];
            let traverseDirectory = (id, pathPrefix) => {
                parseLines($cp.execSync("git cat-file -p " + id, {encoding: "utf8"})).forEach(m => {
                    let matches = m.match(/^(.*?) (.*?) (.*?)\t(.*)$/);
                    let file = {
                        mode: matches[1],
                        type: matches[2],
                        id: matches[3],
                        path: pathPrefix + matches[4]
                    };

                    // Exclude the "commit" type that represents submodule.
                    if (file.type === "tree" || file.type === "blob") {
                        files.push(file);
                        if (file.type === "tree") {
                            traverseDirectory(file.id, file.path + "/");
                        }
                    }
                });
            };
            traverseDirectory(tree, "");

            let tagMessage = "";
            if (commits[commit].parents.length > 0) {
                commits[commit].parents.forEach(parent => {
                    tagMessage += "parent " + commits[parent].locks[0].hash + "\n";
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
            commits[commit].locks.push({content: tagMessage, hash: computeHash(tagMessage)});
            console.log(commits[commit].locks[0].content);

            commits[commit].children.forEach(child => {
                if (commits[child].parents.every(m => commits[m].locks.length > 0)) {
                    traverse(child);
                }
            });
        };
        traverse(firstCommit);
        console.log(commits, firstCommit, lastCommit);
    }
}
