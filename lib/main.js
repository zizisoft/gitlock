"use strict";

let $cp = require("child_process");

let args = process.argv.slice();
args.splice(0, 2); // strip "node" and the name of this file

if (args.length === 0) {
    let status = $cp.execSync("git status --porcelain", {encoding: "utf8"});
    if (status.length === 0) {
        let commits = $cp.execSync("git rev-list HEAD", {encoding: "utf8"}).trim().split("\n");
        console.log(commits);
    }
}
