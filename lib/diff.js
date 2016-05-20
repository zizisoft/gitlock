"use strict";

let $util = require("./util");

let computeDiff = (base, str) => {
    let baseLines = $util.parseLines(base);
    let strLines = $util.parseLines(str);
    let baseParts = baseLines.map(m => m.match(/^(.*?) (.*?) (.*)$/));
    let strParts = strLines.map(m => m.match(/^(.*?) (.*?) (.*)$/));
    let baseCursor = 0;
    let strCursor = 0;
    let baseIndex = 0;
    let strIndex = 0;
    let diff = [];

    while (baseCursor < baseLines.length && strCursor < strLines.length) {
        if (baseLines[baseCursor] === strLines[strCursor]) {
            if (baseCursor === baseIndex && strCursor > strIndex) {
                diff.push({
                    type: "add",
                    lineIndex: baseCursor,
                    lines: strLines.slice(strIndex, strCursor)
                });
            }
            else if (baseCursor > baseIndex && strCursor === strIndex) {
                diff.push({
                    type: "delete",
                    lineIndex: baseIndex,
                    lineCount: baseCursor - baseIndex
                });
            }
            else if (baseCursor > baseIndex && strCursor > strIndex) {
                diff.push({
                    type: "change",
                    lineIndex: baseIndex,
                    lineCount: baseCursor - baseIndex,
                    lines: strLines.slice(strIndex, strCursor)
                });
            }
            baseCursor++;
            strCursor++;
            baseIndex = baseCursor;
            strIndex = strCursor;
        }
        else {
            if (baseParts[baseCursor][3] < strParts[strCursor][3]) {
                baseCursor++;
            }
            else if (baseParts[baseCursor][3] > strParts[strCursor][3]) {
                strCursor++;
            }
            else {
                baseCursor++;
                strCursor++;
            }
        }
    }

    // boundary
    if (baseIndex === baseLines.length && strIndex < strLines.length) {
        diff.push({
            type: "add",
            lineIndex: baseIndex,
            lines: strLines.slice(strIndex)
        });
    }
    else if (baseIndex < baseLines.length && strIndex === strLines.length) {
        diff.push({
            type: "delete",
            lineIndex: baseIndex,
            lineCount: baseLines.length - baseIndex
        });
    }
    else if (baseIndex < baseLines.length && strIndex < strLines.length) {
        diff.push({
            type: "change",
            lineIndex: baseIndex,
            lineCount: baseLines.length - baseIndex,
            lines: strLines.slice(strIndex)
        });
    }

    return diff.map(action => {
        if (action.type === "add") {
            return `a ${action.lineIndex}\n` + action.lines.map(m => m + "\n").join("");
        }
        else if (action.type === "delete") {
            return `d ${action.lineIndex} ${action.lineCount}\n`;
        }
        else if (action.type === "change") {
            return `c ${action.lineIndex} ${action.lineCount}\n` + action.lines.map(m => m + "\n").join("");
        }
    }).join("");
};

let applyDiff = (base, diff) => {
};

exports.computeDiff = computeDiff;
exports.applyDiff = applyDiff;
