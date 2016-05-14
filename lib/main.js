"use strict";

let $cp = require("child_process");

let args = process.argv.slice();
args.splice(0, 2); // strip "node" and the name of this file

if (args.length === 0) {
    let status = $cp.execSync("git status --porcelain", {encoding: "utf8"});
    console.log(status, status.length);
}
