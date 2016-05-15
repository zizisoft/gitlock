"use strict";

let $cp = require("child_process");

let args = process.argv.slice();
args.splice(0, 2); // strip "node" and the name of this file

if (args.length === 0) {
    let status = $cp.execSync("git status --porcelain", {encoding: "utf8"});
    if (status.length === 0) {
        let commits = {};
        let cursor = null;
        $cp.execSync("git rev-list --children --reverse HEAD", {encoding: "utf8"})
        .trim() // strip the EOF newline
        .split("\n").forEach(m => {
            let parts = m.split(" ");
            cursor = parts[0];
            commits[cursor] = parts.slice(1);
        });
        console.log(commits);
    }
}
