import * as fs from "@yaje/fs";

const fd = fs.sync.native.open(".\\tmp.txt", "w");
fs.sync.native.write(fd, "Hello World from @yaje/fs");
fs.sync.native.close(fd);