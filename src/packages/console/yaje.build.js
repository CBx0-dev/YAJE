import {CFG} from "@yaje/core/builder";

const cfg = new CFG();

cfg.addSource("./native");
cfg.addIncludeDir("./native");
cfg.setLoadingFunctions("yaje_console_init");

export default cfg;