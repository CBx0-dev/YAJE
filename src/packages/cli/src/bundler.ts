import * as path from "path";

import {CBG, type OutputInformation} from "@yaje/core/bundler";

import type {NativeTrackedPackage, TrackedPackage} from "./package.js";


/**
 * Loads and instantiates a bundler from the given package.
 *
 * @param pkg               - The tracked package (native or regular) containing the bundler.
 * @param outputInformation - Information about the output configuration.
 *
 * @return A promise that resolves to an instance of the CBG bundler.
 */
export async function loadBundler(pkg: TrackedPackage | NativeTrackedPackage, outputInformation: OutputInformation): Promise<CBG> {
    if (!pkg.packageJSON.main) {
        throw new Error("Bundler package.json is missing 'main' property");
    }
    const entryFile: string = `file:///${path.join(pkg.packageFolder, pkg.packageJSON.main)}`;

    const module: any = await import(entryFile);
    if (!("default" in module)) {
        throw new Error("Bundler contains no default export");
    }

    if (Object.getPrototypeOf(module.default) != CBG) {
        throw new Error("Bundler export is not of type 'CBG'");
    }

    return new module.default(outputInformation);
}