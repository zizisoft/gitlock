"use strict";

// For security, we must avoid malicious command injection.
// At least we should use `arg`, but better use the more strict others.
// Of course, since we use `execFile` rather than `exec`,
// even if we don't validate, it's moderately safe because `&&`, `;` and `|`
// can't have special meanings. But we still have to validate
// because it gives additional protection against in-Git subcommand injection.

let arg = x => {
    assert(x.search(/^[A-Za-z0-9\._\-]*$/) !== -1);
    return x;
};
let id = x => {
    assert(x.search(/^[0-9a-f]{40}$/) !== -1);
    return x;
};
let hash = x => {
    assert(x.search(/^sha256-[0-9a-f]{64}$/) !== -1);
    return x;
};
let tagName = x => {
    assert(x.search(/^gitlock-\d\d\d-sha256-[0-9a-f]{64}$/) !== -1);
    return x;
};
let idOrHashOrTagName = x => {
    try {
        id(x);
        return x;
    }
    catch (ex) {
        try {
            hash(x);
            return x;
        }
        catch (ex) {
            tagName(x);
            return x;
        }
    }
};

exports.arg = arg;
exports.id = id;
exports.hash = hash;
exports.tagName = tagName;
exports.idOrHashOrTagName = idOrHashOrTagName;
