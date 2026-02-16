import * as path from "path";
import * as fs from "fs";

import {CFG, type CFGResult, type TargetTriple} from "@yaje/core/builder";

const BUILD_FILES: string[] = [
    "yaje.build.js",
    "yaje.build.mjs"
]

/**
 * Searches for a build configuration file in the specified project directory.
 *
 * @param projectDir - The path to the project directory to search in.
 *
 * @return The file URL of the build configuration file if found, or `null` otherwise.
 */
function getBuildFile(projectDir: string): string | null {
    for (const fileName of BUILD_FILES) {
        const filePath: string = path.join(projectDir, fileName);

        if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
            return `file:///${filePath}`;
        }
    }

    return null;
}

/**
 * Loads build instructions from a build configuration file in the specified project directory.
 *
 * @param projectDir - The path to the project directory containing the build file.
 * @param target     - The target triple for which to load the build instructions.
 *
 * @return A promise that resolves to the CFGResult if successful, or `null` if no build file is found.
 */
export async function loadBuildInstructions(projectDir: string, target: TargetTriple, name: string = "unnamed"): Promise<CFGResult | null> {
    CFG.projectDir = projectDir;
    CFG.target = target;
    CFG.moduleName = name;

    const buildFile: string | null = getBuildFile(projectDir);
    if (!buildFile) {
        return null;
    }

    const module: any = await import(buildFile);
    if (!("default" in module)) {
        throw new Error("Build file contains no default export");
    }

    if (!(module.default instanceof CFG)) {
        throw new Error("Default export is not of type 'CFG'");
    }

    return module.default.complete();
}