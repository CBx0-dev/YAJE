import * as fs from "@yaje/fs";

const file = "./tmp.txt";

console.log(`Open file '${file}'`);
const fd = fs.sync.native.open(file, "w");
console.log(`Write file (FILE* ${fd})`);
fs.sync.native.write(fd, "Hello World from @yaje/fs");
console.log(`Close file (FILE* ${fd})`);
fs.sync.native.close(fd);