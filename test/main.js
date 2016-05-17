"use strict";

let $fs = require("fs");
let $cp = require("child_process");
let rm = require("rimraf");

let exec = (command, options) => {
    let actualOptions = {cwd: "temp"};
    Object.assign(actualOptions, options);
    return $cp.execSync(command, actualOptions);
};

describe("simple", () => {
    rm.sync("temp");
    $fs.mkdirSync("temp");
    exec("git init");

    $fs.writeFileSync("temp/.gitignore", String.raw`# OS X
.DS_Store

# Windows
Thumbs.db
Desktop.ini

# Linux
*~

# Node
node_modules

*.log
`);
    exec("git add . && git commit -m init");

    $fs.writeFileSync("temp/a.txt", "file body 1\n");
    $fs.writeFileSync("temp/我 你.txt", "文件 2\n");
    exec("git add .");
    exec("git commit -F -", {input: "第二个\n哈哈\n\n哈哈"});

    exec("git branch branch1");
    exec("git checkout branch1");
    $fs.writeFileSync("temp/b", Buffer.from([0, 1, 2]));
    exec("git add . && git commit -m b");

    exec("git checkout master");
    $fs.writeFileSync("temp/c.txt", "c\n");
    exec("git add . && git commit -m c");

    exec("git merge -m m branch1 && git branch -d branch1");
});