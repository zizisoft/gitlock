"use strict";

let $cp = require("child_process");
let $util = require("./util");

let run = (args, options) => {
    let actualOptions = {encoding: "utf8"};
    Object.assign(actualOptions, options);

    // To workaround a Node.js bug:
    // In child process sync methods, `encoding` can't be explicitly set to "buffer".
    if (actualOptions.encoding === "buffer") {
        delete actualOptions.encoding;
    }

    return $cp.execFileSync("git", args, actualOptions);
};
let line = (args, options) => {
    return $util.parseLine(run(args, options));
};
let lines = (args, options) => {
    return $util.parseLines(run(args, options));
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

exports.run = run;
exports.line = line;
exports.lines = lines;
exports.parseTree = parseTree;
