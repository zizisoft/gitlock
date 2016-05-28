"use strict";

let $path = require("path").posix;
let $fs = require("fs");
let programDataPath = require("./program-data-path");

let args = process.argv.slice();
args.splice(0, 2); // strip "node" and the name of this file

if (args[0] === "reset-program-data") {
    if ($fs.existsSync(programDataPath)) {
        let counter = 0;
        let items = $fs.readdirSync(programDataPath);
        items.forEach(item => {
            let path = $path.join(programDataPath, item);

            // We don't detect error, so it won't get stuck regardless of whether every file is
            // successfully deleted.
            $fs.unlink(path, () => {
                counter++;
                if (counter === items.length) process.exit();
            });
        });
    }
}
else {
    // We must use this structure to suppress all other functions while resetting
    // program data. Resetting is often because the program doesn't work well. If most
    // functions still run, then the resetting may be not successful.
    require("./main");
}
