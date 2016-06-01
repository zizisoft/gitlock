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
    return new Date(new Date(time) - (-seconds) * 1000).toISOString();
};

// returns the seconds
let subtractTime = (time1, time2) => {
    return (new Date(time1) - new Date(time2)) / 1000;
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

let last = arr => arr[arr.length - 1];

// Mostly it's for command. Because there's a max number of processes limit, we must
// intelligently control it.
let batchRunAsync = (arrayOfArgs, fn) => {
    return new Promise((resolve, reject) => {
        if (arrayOfArgs.length === 0) {
            resolve();
        }
        else {
            let finishedCount = 0;
            arrayOfArgs.forEach(args => {
                let doTask = () => {
                    fn(args).then(() => {
                        finishedCount++;
                        if (finishedCount === arrayOfArgs.length) {
                            resolve();
                        }
                    }).catch(() => {
                        // This is a must. It's possible that it exceeds the per user process
                        // limit and throw a EAGAIN error, so we will retry.
                        delay(300).then(() => doTask());
                    });
                };
                doTask();
            });
        }
    });
};

exports.parseLines = parseLines;
exports.parseLine = parseLine;
exports.slashPath = slashPath;
exports.homeDir = homeDir;
exports.addTime = addTime;
exports.subtractTime = subtractTime;
exports.pad = pad;
exports.delay = delay;
exports.last = last;
exports.batchRunAsync = batchRunAsync;
