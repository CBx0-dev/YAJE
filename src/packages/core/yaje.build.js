import {CFG} from "./dist/builder.js";

const cfg = new CFG();

cfg
    .addSource("./native", true)
    .addIncludeDir("./native")
    .addIncludeDir("./native/quickjs")
    .defineMacro("QUICKJS_NG_BUILD", true);

if (cfg.platform.isLinux() || cfg.platform.isDarwin()) {
    cfg.defineMacro("_GNU_SOURCE", true);
}

if (cfg.platform.isWindows()) {
    cfg.defineMacro("WIN32_LEAN_AND_MEAN", true);
}

if (cfg.platform.isLinux()) {
    cfg.linkLibrary("m");
    cfg.linkLibrary("dl");
    cfg.linkLibrary("pthread");
}

if (cfg.platform.isDarwin()) {
    cfg.linkLibrary("m");
    cfg.linkLibrary("pthread");
}

cfg.setLoadingFunctions("yaje_core_native_init");

export default cfg;
