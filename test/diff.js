"use strict";

let assert = require("assert");
let $diff = require("../lib/diff");

describe("diff", () => {
    it("diff 1", () => {
        let base = null;
        let str = null;
        let diff = null;

        base =
            "100644 sha256-0e525d70686b35148ec01cc0f4c6fc1362e95397b31ed8c443c2089d371967dc a\n" +
            "100644 sha256-9d5e59eb113d996f9ad757ef46456de89040c427202a6609fb2fff4770a6740a b\n" +
            "100644 sha256-5a92a041ec13b494c4c2544633ecf58125426ff50a7f1c70b5d805c6d4ae45cd c\n" +
            "100644 sha256-c1e832fd54a0eedef78612f4a670083ec302a6843dba1e0001c3ddb27730ffa1 d\n" +
            "100644 sha256-6a44423094beb5fe7e5eb7112d3d4b6bd5651bd324838e711139528580fae855 e\n" +
            "100644 sha256-8be8f81c6652f7e2161805c52fe9e47a0a8515e27f4954154ff3e83ae5743d22 f\n";

        str =
            "100644 sha256-0e525d70686b35148ec01cc0f4c6fc1362e95397b31ed8c443c2089d371967dc a\n" +
            "100644 sha256-9d5e59eb113d996f9ad757ef46456de89040c427202a6609fb2fff4770a6740a b\n" +
            "100644 sha256-5a92a041ec13b494c4c2544633ecf58125426ff50a7f1c70b5d805c6d4ae45cd c\n" +
            "100644 sha256-c1e832fd54a0eedef78612f4a670083ec302a6843dba1e0001c3ddb27730ffa1 d\n" +
            "100644 sha256-6a44423094beb5fe7e5eb7112d3d4b6bd5651bd324838e711139528580fae855 e\n" +
            "100644 sha256-8be8f81c6652f7e2161805c52fe9e47a0a8515e27f4954154ff3e83ae5743d22 f\n";
        diff = $diff.computeDiff(base, str);
        assert.strictEqual(diff,
            ""
        );
        assert.strictEqual($diff.applyDiff(base, diff), str);

        str =
            "100644 sha256-0e525d70686b35148ec01cc0f4c6fc1362e95397b31ed8c443c2089d371967dc a\n" +
            "100644 sha256-9d5e59eb113d996f9ad757ef46456de89040c427202a6609fb2fff4770a6740a b\n" +
            "100644 sha256-61af961b3cea3e337020b872333c9decaf782e1e5ca6e8f1ba21a62a3638f70e b1\n" +
            "100644 sha256-5a92a041ec13b494c4c2544633ecf58125426ff50a7f1c70b5d805c6d4ae45cd c\n" +
            "100644 sha256-6a44423094beb5fe7e5eb7112d3d4b6bd5651bd324838e711139528580fae855 e\n" +
            "100644 sha256-0737491c6e810b8b12ab8a4144aec959b161b851ff64aa4be509e06285e503b0 f\n";
        diff = $diff.computeDiff(base, str);
        assert.strictEqual(diff,
            "a 2\n" +
            "100644 sha256-61af961b3cea3e337020b872333c9decaf782e1e5ca6e8f1ba21a62a3638f70e b1\n" +
            "d 3 1\n" +
            "c 5 1\n" +
            "100644 sha256-0737491c6e810b8b12ab8a4144aec959b161b851ff64aa4be509e06285e503b0 f\n"
        );
        assert.strictEqual($diff.applyDiff(base, diff), str);

        str =
            "100644 sha256-0e525d70686b35148ec01cc0f4c6fc1362e95397b31ed8c443c2089d371967dc a\n" +
            "100644 sha256-9d5e59eb113d996f9ad757ef46456de89040c427202a6609fb2fff4770a6740a b\n" +
            "100644 sha256-5a92a041ec13b494c4c2544633ecf58125426ff50a7f1c70b5d805c6d4ae45cd c\n" +
            "100644 sha256-c1e832fd54a0eedef78612f4a670083ec302a6843dba1e0001c3ddb27730ffa1 d\n" +
            "100644 sha256-6a44423094beb5fe7e5eb7112d3d4b6bd5651bd324838e711139528580fae855 e\n" +
            "100644 sha256-8be8f81c6652f7e2161805c52fe9e47a0a8515e27f4954154ff3e83ae5743d22 f\n" +
            "100644 sha256-ebe1093b8ae1bd88a4cc8890a9adf046174a62d74b516fc8b82a5b4e492ebf05 f1\n" +
            "100644 sha256-1769f660a3a94c1ed180c96c4bc43069e3e2dab23073cfec66a6feb4b5686068 f2\n";
        diff = $diff.computeDiff(base, str);
        assert.strictEqual(diff,
            "a 6\n" +
            "100644 sha256-ebe1093b8ae1bd88a4cc8890a9adf046174a62d74b516fc8b82a5b4e492ebf05 f1\n" +
            "100644 sha256-1769f660a3a94c1ed180c96c4bc43069e3e2dab23073cfec66a6feb4b5686068 f2\n"
        );
        assert.strictEqual($diff.applyDiff(base, diff), str);
    });

    it("diff 2", () => {
        let base = null;
        let str = null;
        let diff = null;

        base =
            "100644 sha256-0e525d70686b35148ec01cc0f4c6fc1362e95397b31ed8c443c2089d371967dc a\n";
        str =
            "100644 sha256-0e525d70686b35148ec01cc0f4c6fc1362e95397b31ed8c443c2089d371967dc a\n" +
            "100644 sha256-9d5e59eb113d996f9ad757ef46456de89040c427202a6609fb2fff4770a6740a b\n";
        diff = $diff.computeDiff(base, str);
        assert.strictEqual(diff,
            "a 1\n" +
            "100644 sha256-9d5e59eb113d996f9ad757ef46456de89040c427202a6609fb2fff4770a6740a b\n"
        );
        assert.strictEqual($diff.applyDiff(base, diff), str);

        base =
            "100644 sha256-9d5e59eb113d996f9ad757ef46456de89040c427202a6609fb2fff4770a6740a b\n";
        str =
            "100644 sha256-0e525d70686b35148ec01cc0f4c6fc1362e95397b31ed8c443c2089d371967dc a\n" +
            "100644 sha256-9d5e59eb113d996f9ad757ef46456de89040c427202a6609fb2fff4770a6740a b\n";
        diff = $diff.computeDiff(base, str);
        assert.strictEqual(diff,
            "a 0\n" +
            "100644 sha256-0e525d70686b35148ec01cc0f4c6fc1362e95397b31ed8c443c2089d371967dc a\n"
        );
        assert.strictEqual($diff.applyDiff(base, diff), str);

        base =
            "100644 sha256-0e525d70686b35148ec01cc0f4c6fc1362e95397b31ed8c443c2089d371967dc a\n";
        str =
            "100644 sha256-0e525d70686b35148ec01cc0f4c6fc1362e95397b31ed8c443c2089d371967dc a\n";
        diff = $diff.computeDiff(base, str);
        assert.strictEqual(diff,
            ""
        );
        assert.strictEqual($diff.applyDiff(base, diff), str);

        base = "";
        str = "";
        diff = $diff.computeDiff(base, str);
        assert.strictEqual(diff,
            ""
        );
        assert.strictEqual($diff.applyDiff(base, diff), str);

        base = "";
        str =
            "100644 sha256-0e525d70686b35148ec01cc0f4c6fc1362e95397b31ed8c443c2089d371967dc a\n";
        diff = $diff.computeDiff(base, str);
        assert.strictEqual(diff,
            "a 0\n" +
            "100644 sha256-0e525d70686b35148ec01cc0f4c6fc1362e95397b31ed8c443c2089d371967dc a\n"
        );
        assert.strictEqual($diff.applyDiff(base, diff), str);

        base =
            "100644 sha256-0e525d70686b35148ec01cc0f4c6fc1362e95397b31ed8c443c2089d371967dc a\n";
        str = "";
        diff = $diff.computeDiff(base, str);
        assert.strictEqual(diff,
            "d 0 1\n"
        );
        assert.strictEqual($diff.applyDiff(base, diff), str);

        base =
            "100644 sha256-0e525d70686b35148ec01cc0f4c6fc1362e95397b31ed8c443c2089d371967dc a\n";
        str =
            "100644 sha256-9d5e59eb113d996f9ad757ef46456de89040c427202a6609fb2fff4770a6740a b\n";
        diff = $diff.computeDiff(base, str);
        assert.strictEqual(diff,
            "c 0 1\n" +
            "100644 sha256-9d5e59eb113d996f9ad757ef46456de89040c427202a6609fb2fff4770a6740a b\n"
        );
        assert.strictEqual($diff.applyDiff(base, diff), str);

        base = "";
        str =
            "100644 sha256-0e525d70686b35148ec01cc0f4c6fc1362e95397b31ed8c443c2089d371967dc a\n" +
            "100644 sha256-9d5e59eb113d996f9ad757ef46456de89040c427202a6609fb2fff4770a6740a b\n";
        diff = $diff.computeDiff(base, str);
        assert.strictEqual(diff,
            "a 0\n" +
            "100644 sha256-0e525d70686b35148ec01cc0f4c6fc1362e95397b31ed8c443c2089d371967dc a\n" +
            "100644 sha256-9d5e59eb113d996f9ad757ef46456de89040c427202a6609fb2fff4770a6740a b\n"
        );
        assert.strictEqual($diff.applyDiff(base, diff), str);

        base =
            "100644 sha256-0e525d70686b35148ec01cc0f4c6fc1362e95397b31ed8c443c2089d371967dc a\n" +
            "100644 sha256-9d5e59eb113d996f9ad757ef46456de89040c427202a6609fb2fff4770a6740a b\n";
        str = "";
        diff = $diff.computeDiff(base, str);
        assert.strictEqual(diff,
            "d 0 2\n"
        );
        assert.strictEqual($diff.applyDiff(base, diff), str);

        base =
            "100644 sha256-0e525d70686b35148ec01cc0f4c6fc1362e95397b31ed8c443c2089d371967dc a\n" +
            "100644 sha256-9d5e59eb113d996f9ad757ef46456de89040c427202a6609fb2fff4770a6740a b\n";
        str =
            "100644 sha256-5a92a041ec13b494c4c2544633ecf58125426ff50a7f1c70b5d805c6d4ae45cd c\n" +
            "100644 sha256-c1e832fd54a0eedef78612f4a670083ec302a6843dba1e0001c3ddb27730ffa1 d\n";
        diff = $diff.computeDiff(base, str);
        assert.strictEqual(diff,
            "c 0 2\n" +
            "100644 sha256-5a92a041ec13b494c4c2544633ecf58125426ff50a7f1c70b5d805c6d4ae45cd c\n" +
            "100644 sha256-c1e832fd54a0eedef78612f4a670083ec302a6843dba1e0001c3ddb27730ffa1 d\n"
        );
        assert.strictEqual($diff.applyDiff(base, diff), str);
    });
});
