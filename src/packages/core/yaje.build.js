import {CFG} from "./dist/builder.js";

const cfg = new CFG();

cfg.addSource("./native", true);

cfg.addIncludeDir("./native");
cfg.addIncludeDir("./native/quickjs");

cfg.setCFlags(
    "-g",
    "-fwrapv",
    "-Wall"
);

cfg.setLFlags("-g");

cfg.setLoadingFunctions("yaje_core_native_init");

export default cfg;