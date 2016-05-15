"use strict";

let $cp = require("child_process");

let args = process.argv.slice();
args.splice(0, 2); // strip "node" and the name of this file

if (args.length === 0) {
    let status = $cp.execSync("git status --porcelain", {encoding: "utf8"});
    if (status.length === 0) {
        let commits = {};
        $cp.execSync("git rev-list --children --reverse HEAD", {encoding: "utf8"})
        .trim() // strip the EOF newline
        .split("\n").forEach(m => {
            let parts = m.split(" ");
            commits[parts[0]] = {};
            commits[parts[0]].children = parts.slice(1);
        });
        let commitsArray = Object.keys(commits);
        let firstCommit = commitsArray[0];
        let lastCommit = commitsArray[commitsArray.length - 1];
        $cp.execSync("git rev-list --parents HEAD", {encoding: "utf8"})
        .trim() // strip the EOF newline
        .split("\n").forEach(m => {
            let parts = m.split(" ");
            commits[parts[0]].parents = parts.slice(1);
        });
        console.log(commits, firstCommit, lastCommit);
    }
}
