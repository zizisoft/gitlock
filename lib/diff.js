"use strict";

exports.diff = (base, str) => {
    let baseLines = parseLines(base);
    let strLines = parseLines(str);
    let basePaths = baseLines.map(m => m.match(/^(.*?) (.*?) (.*)$/)[1]);
    let strPaths = strLines.map(m => m.match(/^(.*?) (.*?) (.*)$/)[1]);
    let baseCursor = 0;
    let strCursor = 0;
    let baseIndex = 0;
    let strIndex = 0;
    let diff = [];
    while () {
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
            else {
                diff.push({
                    type: "change",
                    lineIndex: baseIndex,
                    lineCount: baseCursor - baseIndex,
                    lines: strLines.slice(strIndex, strCursor)
                });
            }
            baseIndex = baseCursor + 1;
            strIndex = strCursor + 1;
        }
        else {
            if (basePaths[baseCursor] < strPaths[strCursor]) {
                baseCursor++;
            }
            else if (basePaths[baseCursor] > strPaths[strCursor]) {
                strCursor++;
            }
            else {
                baseCursor++;
                strCursor++;
            }
        }
    }
};

exports.applyDiff = (base, diff) => {
};
