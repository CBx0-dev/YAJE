import * as path from "path";
import * as fs from "fs";
import * as crypto from "crypto";

import chalk from "chalk";
import ora from "ora";

import {type CFGResult, generateOutputInformation, type OutputInformation, type TargetTriple} from "@yaje/core/builder";
import {CBG} from "@yaje/core/bundler";

import * as builder from "../builder.js";
import * as compiler from "../compiler.js";
import * as bundler from "../bundler.js";
import {type NativeTrackedPackage, PackageCollection, type PackageJSON, type TrackedPackage} from "../package.js";
import {getTargetTripleString} from "../compiler.js";

export function getBaseCFlags(target: TargetTriple): string[] {
    return [
        "-std=gnu11",
        "-Wall",
        "-Wextra",
        "-Wformat=2",
        "-Wno-implicit-fallthrough",
        "-Wno-sign-compare",
        "-Wno-missing-field-initializers",
        "-Wno-unused-parameter",
        "-Wno-unused-but-set-variable",
        "-Wno-unused-result",
        "-Wno-array-bounds",
        "-fwrapv",
        "-funsigned-char",
        "-g",
        "-target",
        getTargetTripleString(target),
        "-c"
    ];
}

export function getBaseLFlags(target: TargetTriple): string[] {
    return [
        "-g"
    ];
}

/**
 * Resolves the directory path of a package by searching up the directory tree.
 *
 * @param name    - The name of the package to resolve.
 * @param root    - The root directory of the project.
 * @param fromDir - The directory to start the search from.
 *
 * @return The absolute path to the resolved package directory.
 */
export function resolvePackageDir(name: string, root: string, fromDir: string): string {
    let dir: string = fromDir;
    while (true) {
        const resolvePath: string = path.join(dir, "node_modules", name);
        if (fs.existsSync(resolvePath) && fs.statSync(resolvePath).isDirectory()) {
            return resolvePath;
        }

        let parentDir: string = path.dirname(dir);
        if (parentDir == dir) {
            throw new Error(`Could not locate package '${name}'`);
        }
        dir = parentDir;
    }
}

/**
 * Checks and parses the package.json file of a directory and recursively processes its dependencies.
 *
 * @param root     - The root directory of the project.
 * @param dir      - The directory to check for a package.json file.
 * @param target   - The target triple for which the build is being performed.
 * @param packages - The collection of packages being built.
 *
 * @return A promise that resolves to the name of the package.
 */
export async function checkPackageJSON(
    root: string,
    dir: string,
    target: TargetTriple,
    packages: PackageCollection
): Promise<string> {
    const packageJSONPath: string = path.join(dir, "package.json");
    if (!fs.existsSync(packageJSONPath) || !fs.statSync(packageJSONPath).isFile()) {
        throw new Error(`Directory '${dir}' contains no package.json`);
    }

    const content: string = fs.readFileSync(packageJSONPath, "utf-8");
    let json: PackageJSON;
    try {
        json = JSON.parse(content);
    } catch (e) {
        throw new Error(`Failed to parse JSON in '${packageJSONPath}'`, {cause: e});
    }

    packages.set({
        packageJSON: json,
        packageFolder: dir,
        isNative: false,
        isBundler: json.yaje?.bundler ?? false
    })

    try {
        const instructions: CFGResult | null = await builder.loadBuildInstructions(dir, target, json.name);
        if (instructions) {
            packages.set({
                packageJSON: json,
                packageFolder: dir,
                isNative: true,
                instructions: instructions,
                isBundler: json.yaje?.bundler ?? false
            });
        }
    } catch (e) {
        throw new Error(`Failed to load build instructions '${json.name}'`, {cause: e});
    }

    if (!json.dependencies || !("@yaje/core" in json.dependencies)) {
        return json.name;
    }

    if (json.dependencies) for (const name of Object.keys(json.dependencies)) {
        if (packages.has(name)) {
            continue;
        }

        const dependencyDir: string = resolvePackageDir(name, root, dir);
        await checkPackageJSON(root, dependencyDir, target, packages);
    }

    return json.name;
}

/**
 * Compiles a native module into a static library.
 *
 * @param module      - The native tracked package to compile.
 * @param packages    - The collection of all tracked packages.
 * @param target      - The target triple to compile for.
 * @param output      - Information about the output configuration.
 * @param cacheFolder - Cache folder
 *
 * @return A promise that resolves to the path of the generated static library.
 */
async function compileModule(
    module: NativeTrackedPackage,
    packages: PackageCollection,
    target: TargetTriple,
    output: OutputInformation,
    cacheFolder: string
): Promise<string> {
    const flags: string[] = getBaseCFlags(target);
    const dependencies: CFGResult[] = [];


    if (module.packageJSON.dependencies) for (const name of Object.keys(module.packageJSON.dependencies)) {
        const pkg: TrackedPackage | NativeTrackedPackage | null = packages.get(name);
        if (!pkg || !pkg.isNative) {
            continue;
        }

        dependencies.push(pkg.instructions);
    }

    const outputFolder: string = path.join(output.objFolder, module.packageJSON.name);
    if (!fs.existsSync(outputFolder) || !fs.statSync(outputFolder).isDirectory()) {
        fs.mkdirSync(outputFolder, {recursive: true});
    }

    return await compiler.compileModule(
        module.instructions,
        dependencies,
        outputFolder,
        output.modFolder,
        cacheFolder,
        flags
    );
}

/**
 * Generates the main entry point C source file for the executable.
 *
 * @param sourceFile       - The path where the generated C source file will be saved.
 * @param loadingFunctions - An array of module loading function names to call.
 */
function generateEntryPoint(sourceFile: string, loadingFunctions: string[]): void {
    fs.writeFileSync(sourceFile, `#include "quickjs.h"
#include "yaje.h"

${loadingFunctions.map(fn => `extern void ${fn}(JSRuntime *rt, JSContext *ctx);`).join("\n")}

void yaje_core_load_modules(JSRuntime *rt, JSContext *ctx) {
    
${loadingFunctions.map(fn => `    ${fn}(rt, ctx);`).join("\n")}

}

int main(int argc, char **argv) {
    JSRuntime *rt = NULL;
    JSContext *ctx = NULL;
    
    yaje_core_ctor(&rt, &ctx);
    
    yaje_core_load_modules(rt, ctx);
    
    int exit_code = yaje_core_execute(rt, ctx);
    
    yaje_core_free(&rt, &ctx);
    return exit_code;
}`);
}

/**
 * Builds the object file for the main entry point of the executable.
 *
 * @param packages         - The collection of tracked packages.
 * @param output           - Information about the output configuration.
 * @param loadingFunctions - An array of module loading function names.
 *
 * @return A promise that resolves to the path of the generated entry point object file.
 */
async function buildEntryPoint(
    packages: PackageCollection,
    output: OutputInformation,
    loadingFunctions: string[]
): Promise<string> {
    const coreModule: NativeTrackedPackage = packages.getCore();

    const entryPointSource: string = path.join(output.genFolder, "main.c");
    generateEntryPoint(entryPointSource, loadingFunctions);

    const entryPointObject: string = path.join(output.modFolder, "main.o");
    const args: string[] = coreModule.instructions.includeDirs
        .map(includeDir => ["-I", includeDir])
        .flat()
        .concat(["-g", "-fwrapv", "-Wall", "-c"]);

    const entryPointHashFile: string = path.join(output.cacheFolder, "main.hash");
    const sourceDeps: string[] = await compiler.getDependencies(args, entryPointSource);
    const currentHash: string = await compiler.calculateHash(entryPointSource, sourceDeps, args);

    let skip: boolean = false;
    if (fs.existsSync(entryPointObject) && fs.existsSync(entryPointHashFile)) {
        const storedHash: string = fs.readFileSync(entryPointHashFile, "utf-8");
        if (storedHash == currentHash) {
            skip = true;
        }
    }

    if (!skip) {
        await compiler.compileFile(args, entryPointSource, entryPointObject);
        fs.writeFileSync(entryPointHashFile, currentHash);
    }

    return entryPointObject;
}

/**
 * Links the compiled object files and libraries into an executable.
 *
 * @param modules        - An array of paths to the modules or object files to link.
 * @param executableFile - The path to the output executable file.
 * @param linkerFlags    - An array of additional linker flags.
 *
 * @return A promise that resolves when linking is complete.
 */
async function linkModules(modules: string[], executableFile: string, linkerFlags: string[]): Promise<void> {
    await compiler.linkFiles(modules, executableFile, linkerFlags);
}

/**
 * Orchestrates the compilation and linking of native code for the project.
 *
 * @param packages   - The collection of tracked packages.
 * @param target     - The target triple to build for.
 * @param bundleFile - The path to the JavaScript bundle file to embed.
 * @param output     - Information about the output configuration.
 *
 * @return A promise that resolves to `true` if the native build was successful, `false` otherwise.
 */
async function buildNativeCode(packages: PackageCollection, target: TargetTriple, bundleFile: string, output: OutputInformation): Promise<boolean> {
    if (!await compiler.isClangInstalled()) {
        console.log(chalk.red("Could not find clang. Ensure it is in your PATH environment"));
        return false;
    }
    if (!await compiler.isArchiverInstalled()) {
        console.log(chalk.red("Could not find ar. Ensure it is in your PATH environment"));
        return false;
    }

    const loadingFunctions: string[] = [];
    const modules: string[] = [];
    const libraries: Set<string> = new Set<string>();

    console.log(chalk.blue.bold("Compiling Native Code"));

    for (const module of packages) {
        if (!module.isNative) {
            continue;
        }

        loadingFunctions.push(...module.instructions.loadingFunctions);
        for (const lib of module.instructions.linkLibraries) {
            libraries.add(`-l${lib}`);
        }

        const spinner = ora({
            text: `  ${chalk.dim("Compile module")} ${chalk.white(module.packageJSON.name)}`,
            color: 'cyan'
        }).start();

        try {
            modules.push(await compileModule(module, packages, target, output, output.cacheFolder));
            spinner.succeed();
        } catch (e) {
            spinner.fail();
            console.log(chalk.red(`Could not compile module '${module.packageJSON.name}': ${e}`));
            return false;
        }
    }

    console.log();
    const bundleSpinner = ora({
        text: `  ${chalk.dim("Embed bundle")}`,
        color: 'cyan'
    }).start();

    try {
        const bundleContent: Buffer = fs.readFileSync(bundleFile);
        const bundleObject: string = path.join(output.modFolder, "bundle.o");
        const bundleHashFile: string = path.join(output.cacheFolder, "bundle.hash");
        const currentHash: string = crypto.createHash("sha256").update(bundleContent).digest("hex");

        let skip = false;
        if (fs.existsSync(bundleObject) && fs.existsSync(bundleHashFile)) {
            const storedHash = fs.readFileSync(bundleHashFile, "utf-8");
            if (storedHash == currentHash) {
                skip = true;
            }
        }

        if (!skip) {
            await compiler.embedFile(bundleContent, bundleObject, "JS_BUNDLE", target, ["-g"]);
            fs.writeFileSync(bundleHashFile, currentHash);
        }

        modules.push(bundleObject);
        bundleSpinner.succeed();
    } catch (e) {
        bundleSpinner.fail();
        console.log(chalk.red(`Could not embed bundle: ${e}`));
        return false;
    }

    const entryPointSpinner = ora({
        text: `  ${chalk.dim("Compile entry point")}`,
        color: 'cyan'
    }).start();

    try {
        const entryPointObject: string = await buildEntryPoint(packages, output, loadingFunctions);
        modules.push(entryPointObject);
        entryPointSpinner.succeed();
    } catch (e) {
        entryPointSpinner.fail();
        console.log(chalk.red(`Could not compile entrypoint: ${e}`));
        return false;
    }

    console.log();
    console.log(chalk.blue.bold("Create Executable"));
    const executableFile: string = path.join(output.targetFolder, "a") + (target.platform == "windows" ? ".exe" : "");

    const linkSpinner = ora({
        text: `  ${chalk.dim("Linking modules")}`,
        color: 'cyan'
    }).start();

    const lFlags: string[] = getBaseLFlags(target).concat(Array.from(libraries));

    try {
        await linkModules(modules, executableFile, lFlags);
        linkSpinner.succeed();
    } catch (e) {
        linkSpinner.fail();
        console.log(chalk.red(`Could not link executable: ${e}`));
        return false;
    }

    return true;
}

/**
 * Orchestrates the bundling of managed (JavaScript) code for the project.
 *
 * @param packages    - The collection of tracked packages.
 * @param rootPKGName - The name of the root package to bundle.
 * @param output      - Information about the output configuration.
 *
 * @return A promise that resolves to the path of the generated bundle file, or `false` if bundling failed.
 */
async function buildManagedCode(packages: PackageCollection, rootPKGName: string, output: OutputInformation): Promise<false | string> {
    let gateway: CBG;

    const rootPkg: TrackedPackage | NativeTrackedPackage | null = packages.get(rootPKGName);
    if (!rootPkg) {
        console.log(chalk.red("Could not find root project"));
        return false;
    }

    if (!rootPkg.packageJSON.main) {
        console.log(chalk.red("package.json of the root project don't has a entry point set"));
        return false;
    }

    let bundlerPkg: TrackedPackage | NativeTrackedPackage;

    try {
        console.log();
        console.log(chalk.blue.bold("Bundling Project"));
        bundlerPkg = packages.getBundler();
        gateway = await bundler.loadBundler(bundlerPkg, output);
    } catch (e) {
        console.log(chalk.red(`Could not bundle code: ${e}`));
        return false;
    }

    const bundleSpinner = ora({
        text: `  ${chalk.dim("Bundling project using")} ${chalk.white(bundlerPkg.packageJSON.name)}`,
        color: 'cyan'
    }).start();

    try {
        await gateway.init();
        const bundleFile = await gateway.bundle(rootPkg.packageJSON.main);
        bundleSpinner.succeed();
        return bundleFile;
    } catch (e) {
        bundleSpinner.fail();
        console.log(chalk.red(`Could not bundle code: ${e}`));
        return false;
    }
}

/**
 * The main build function that handles both managed and native code compilation.
 *
 * @param target - The target triple to build the project for.
 *
 * @return A promise that resolves to the exit code (0 for success, 1 for failure).
 */
export async function build(target: TargetTriple): Promise<number> {
    const targetString: string = compiler.getTargetTripleString(target);
    console.log(`${chalk.blue.bold("Building project for")} ${chalk.cyan.bold(targetString)}`);

    const packages: PackageCollection = new PackageCollection();
    const cwd: string = process.cwd();

    let rootPackage: string;

    const dependencySpinner = ora({
        text: `  ${chalk.dim("Building dependency tree")}`,
        color: 'cyan'
    }).start();

    try {
        rootPackage = await checkPackageJSON(cwd, cwd, target, packages);
        dependencySpinner.succeed();
    } catch (e) {
        dependencySpinner.fail();
        console.log(chalk.red(`Failed to build dependency tree: ${e}`));
        return 1;
    }

    const output: OutputInformation = generateOutputInformation(cwd, compiler.getTargetTripleString(target));
    const bundleFile: string | false = await buildManagedCode(packages, rootPackage, output);
    if (!bundleFile) {
        return 1;
    }

    console.log();

    if (!await buildNativeCode(packages, target, bundleFile, output)) {
        return 1;
    }

    console.log();
    console.log(chalk.green.bold("Build successful!"));

    return 0;
}
