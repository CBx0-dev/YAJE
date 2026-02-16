import * as path from "path";
import * as fs from "fs";

export interface OutputInformation {
    projectFolder: string;
    yajeFolder: string;
    targetFolder: string;
    objFolder: string;
    modFolder: string;
    genFolder: string;
    cacheFolder: string;
}

/**
 * Generates the output directory structure for the build process.
 *
 * @param root   - The root directory of the project.
 * @param target - The target triple string.
 *
 * @return An object containing paths to the generated output directories.
 */
export function generateOutputInformation(root: string, target: string): OutputInformation {
    const yajeFolder: string = path.join(root, ".yaje");
    if (!fs.existsSync(yajeFolder) || !fs.statSync(yajeFolder).isDirectory()) {
        fs.mkdirSync(yajeFolder);
    }

    const targetFolder: string = path.join(yajeFolder, target);
    if (!fs.existsSync(targetFolder) || !fs.statSync(targetFolder).isDirectory()) {
        fs.mkdirSync(targetFolder);
    }

    const objFolder: string = path.join(targetFolder, "obj");
    if (!fs.existsSync(objFolder) || !fs.statSync(objFolder).isDirectory()) {
        fs.mkdirSync(objFolder);
    }

    const modFolder: string = path.join(targetFolder, "modules");
    if (!fs.existsSync(modFolder) || !fs.statSync(modFolder).isDirectory()) {
        fs.mkdirSync(modFolder);
    }


    const genFolder: string = path.join(targetFolder, "gen");
    if (!fs.existsSync(genFolder) || !fs.statSync(genFolder).isDirectory()) {
        fs.mkdirSync(genFolder);
    }

    const cacheFolder: string = path.join(targetFolder, "cache");
    if (!fs.existsSync(cacheFolder) || !fs.statSync(cacheFolder).isDirectory()) {
        fs.mkdirSync(cacheFolder);
    }

    return {
        projectFolder: root,
        yajeFolder: yajeFolder,
        targetFolder: targetFolder,
        objFolder: objFolder,
        modFolder: modFolder,
        genFolder: genFolder,
        cacheFolder: cacheFolder
    }
}
