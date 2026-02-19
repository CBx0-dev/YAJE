import * as fs from "@yaje/fs";

fs.writeFileSync("./tmp.txt", "Hello World from @yaje/fs");

const content = fs.readFileSync("./tmp.txt");
console.log(content);