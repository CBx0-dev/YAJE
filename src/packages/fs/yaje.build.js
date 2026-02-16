import {CFG} from "@yaje/core/builder";

const cfg = new CFG();

cfg.addSource("./native");
cfg.addIncludeDir("./native");
cfg.setLoadingFunctions("yaje_fs_init");

cfg.setCFlags(
    "-g",
    "-fwrapv",
    "-Wall"
);

cfg.setLFlags("-g");

export default cfg;
