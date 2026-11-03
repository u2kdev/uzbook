process.stdin.resume();
process.argv = [process.argv[0], require.resolve("next/dist/bin/next"), "dev"];
require("next/dist/bin/next");
