"use strict";

let assert = require("assert");
let $os = require("os");

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

// For Windows compatibility. Convert path to Unix style.
let slashPath = path => {
    if (typeof path === "string") {
        return path.replace(/\\/g, "/");
    }
    else {
        return path;
    }
};

let homeDir = slashPath($os.homedir());

// `seconds` can't be negative
let addTime = (time, seconds) => {
    return new Date(new Date(time) - (-seconds)).toISOString();
};

let pad = (num, len) => {
    let s = num.toString();
    return "0".repeat(len - s.length) + s;
};

let delay = ms => {
    return new Promise((resolve, reject) => {
        setTimeout(() => {
            resolve();
        }, ms);
    });
};

exports.parseLines = parseLines;
exports.parseLine = parseLine;
exports.slashPath = slashPath;
exports.homeDir = homeDir;
exports.addTime = addTime;
exports.pad = pad;
exports.delay = delay;
