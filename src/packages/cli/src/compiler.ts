import * as path from "path";
import * as fs from "fs";
import * as crypto from "crypto";

import type {CFGResult, TargetTriple} from "@yaje/core/builder";
import * as child_process from "node:child_process";
import type {Writable} from "node:stream";

import * as subprocess from "./subprocess.js";

/**
 * Checks if Clang is installed and available in the system path.
 *
 * @return True if Clang is installed, false otherwise.
 */
export async function isClangInstalled(): Promise<boolean> {
    try {
        const result = await subprocess.run("clang", ["--version"]);
        return result.code == 0;
    } catch (error) {
        return false;
    }
}

/**
 * Checks if the system archiver llvm-ar is installed and available in the system path.
 *
 * @return True if the archiver is installed, false otherwise.
 */
export async function isArchiverInstalled(): Promise<boolean> {
    try {
        const result = await subprocess.run("llvm-ar", ["--version"]);
        return result.code == 0
    } catch (error) {
        return false;
    }
}

/**
 * Checks if the `clang++` compiler is installed and accessible in the system's PATH.
 * This is determined by executing the `clang++ --version` command.
 *
 * @return Returns `true` if `clang++` is installed and the command executes successfully, otherwise `false`.
 */
export async function isClangPlusPlusInstalled(): Promise<boolean> {
    try {
        const result = await subprocess.run("clang++", ["--version"]);
        return result.code == 0;
    } catch (error) {
        return false;
    }
}

/**
 * Gets the host target triple based on the current process architecture and platform.
 *
 * @return An object containing the host target triple components.
 */
export function getHostTargetTriple(): TargetTriple {
    let arch: TargetTriple.Arch;
    switch (process.arch) {
        case "x64":
            arch = "x86_64";
            break;
        case "ia32":
            arch = "i686";
            break;
        case "arm64":
            arch = "aarch64";
            break;
        case "arm":
            arch = "armv7";
            break;
        default:
            arch = process.arch;
    }

    let platform: TargetTriple.Platform;
    let abi: TargetTriple.Abi;

    switch (process.platform) {
        case "win32":
            platform = "windows";
            abi = "msvc";
            break;
        case "linux":
            platform = "linux";
            abi = "gnu";
            break;
        case "darwin":
            platform = "darwin";
            abi = "system";
            break;
        default:
            platform = process.platform as TargetTriple.Platform;
            abi = "system";
    }

    return {
        arch,
        vendor: "unknown",
        platform,
        abi
    }
}

/**
 * Parses a target triple string and extracts its components: architecture, vendor, platform, and ABI.
 *
 * @param triple - The target triple string to parse, formatted as a combination of architecture,
 *                 vendor, platform, and ABI (e.g., "arch-vendor-platform-abi").
 *
 * @return An object containing the parsed target triple components (arch, vendor, platform, abi)
 *         if the input is valid, or `null` if the input format is incorrect.
 */
export function parseTargetTriple(triple: string): TargetTriple | null {
    let arch: TargetTriple.Arch = "";
    let vendor: TargetTriple.Vendor = "unknown";
    let platform: TargetTriple.Platform = "";
    let abi: TargetTriple.Abi = "";

    let parts: string[] = triple.split("-");

    if (parts.length == 4) {
        [arch, vendor, platform, abi] = parts as [TargetTriple.Arch, TargetTriple.Vendor, TargetTriple.Platform, TargetTriple.Abi];
    } else if (parts.length == 3) {
        [arch, platform, abi] = parts as [TargetTriple.Arch, TargetTriple.Platform, TargetTriple.Abi];
    } else if (parts.length == 2) {
        [arch, platform] = parts as [TargetTriple.Arch, TargetTriple.Platform];

        switch (platform) {
            case "windows":
                abi = "msvc";
                break;
            case "linux":
                abi = "gnu";
                break;
            default:
                abi = "system";
        }
    } else {
        return null;
    }

    return {
        arch,
        vendor,
        platform,
        abi
    }
}

/**
 * Converts a TargetTriple object into its string representation.
 *
 * @param target - The TargetTriple object to convert.
 *
 * @return The target triple string.
 */
export function getTargetTripleString(target: TargetTriple): string {
    if (target.platform == "darwin" && target.abi == "system") {
        return `${target.arch}-${target.vendor}-${target.platform}`;
    }

    return `${target.arch}-${target.vendor}-${target.platform}-${target.abi}`;
}

/**
 * Generates the compiler arguments for a given module and its dependencies.
 *
 * @param dependencies - An array of CFGResult objects representing the module's dependencies.
 * @param module       - The CFGResult object representing the module to compile.
 * @param flags        - CFlags that should for compiling
 *
 * @return An array of strings containing the compiler arguments.
 */
export function generateCompilerArguments(dependencies: CFGResult[], module: CFGResult, flags: string[]): string[] {
    const includeDirs: string[] = [];
    const defineMacros: string[] = [];

    for (const dependency of dependencies.concat(module)) {
        for (const includeDir of dependency.includeDirs) {
            includeDirs.push("-I", includeDir);
        }

        for (const [macroName, macroValue] of Object.entries(dependency.defineMacros)) {
            let value: string;
            switch (typeof macroValue) {
                case "boolean":
                    value = macroName;
                    break;
                case "number":
                    value = `${macroName}=${macroValue}`;
                    break;
                case "string":
                    value = `${macroName}="${macroValue}"`;
                    break;
                default:
                    throw new Error(`Unknown macro type '${typeof macroValue}'`);
            }

            defineMacros.push("-D", value);
        }
    }

    const args: string[] = includeDirs.concat(defineMacros);

    for (const libraryLookup of module.libraryLookup) {
        args.push("-L", libraryLookup);
    }
    args.push(...flags);
    return args;
}

/**
 * Compiles a single C source file into an object file using Clang.
 *
 * @param args   - The compiler arguments to use for compilation.
 * @param source - The path to the source file.
 * @param object - The path to the output object file.
 *
 * @return True if compilation was successful.
 */
export async function compileFile(args: string[], source: string, object: string): Promise<boolean> {
    const result = await subprocess.run("clang", args.concat(source, "-o", object));

    if (result.code != 0) {
        throw new Error(result.stderr);
    }

    return true;
}

/**
 * Gets the header dependencies for a C source file using Clang's -MM flag.
 *
 * @param args   - The compiler arguments to use.
 * @param source - The path to the source file.
 *
 * @return A promise that resolves to an array of absolute paths to the header dependencies.
 */
export async function getDependencies(args: string[], source: string): Promise<string[]> {
    const finalArgs: string[] = [];
    for (let i = 0; i < args.length; i++) {
        const arg = args[i];
        if (!arg) continue;

        if (arg.startsWith("-I") || arg.startsWith("-D")) {
            finalArgs.push(arg);
        } else if (arg == "-target") {
            const nextArg = args[i + 1];
            if (nextArg !== undefined) {
                finalArgs.push("-target", nextArg);
                i++;
            }
        }
    }

    const result = await subprocess.run("clang", ["-MM", ...finalArgs, source]);
    if (result.code != 0) {
        return [];
    }

    const output = result.stdout.replace(/\\\r?\n/g, "").replace(`${path.basename(source, ".c")}.o:`, "");
    return output.split(/\s+/).filter(file => file.length > 0).map(file => path.resolve(path.dirname(source), file));
}

/**
 * Streams the content of a file into a hash object.
 *
 * @param filePath - The path to the file to hash.
 * @param hash     - The hash object to update.
 *
 * @return A promise that resolves when the file has been fully processed.
 */
function streamFileToHash(filePath: string, hash: crypto.Hash): Promise<void> {
    return new Promise<void>((resolve, reject) => {
        const stream: fs.ReadStream = fs.createReadStream(filePath);

        stream.on('data', (chunk) => {
            hash.update(chunk);
        });
        stream.on('end', () => {
            resolve();
        });
        stream.on('error', (err) => {
            reject(err);
        });
    });
}

/**
 * Calculates an SHA-256 hash for a source file and its dependencies.
 *
 * @param source       - The path to the source file.
 * @param dependencies - An array of paths to the header dependencies.
 * @param args         - The compiler arguments.
 *
 * @return The calculated hash string.
 */
export async function calculateHash(source: string, dependencies: string[], args: string[]): Promise<string> {
    const hash: crypto.Hash = crypto.createHash("sha256");
    hash.update(args.join(" "));
    await streamFileToHash(source, hash);
    for (const dep of dependencies) {
        if (fs.existsSync(dep)) {
            await streamFileToHash(dep, hash);
        }
    }
    return hash.digest("hex");
}

/**
 * Bundles multiple object files into a static library archive using the system archiver (ar).
 *
 * @param objects - An array of paths to the object files to bundle.
 * @param archive - The path to the output archive file.
 *
 * @return True if bundling was successful.
 */
async function bundleFiles(objects: string[], archive: string): Promise<boolean> {
    const result = await subprocess.run("llvm-ar", ["rcs", archive, ...objects]);

    if (result.code != 0) {
        throw new Error(result.stderr);
    }

    return true;
}

/**
 * Compiles a module and its dependencies into a static library.
 *
 * @param module        - The CFGResult object representing the module to compile.
 * @param dependencies  - An array of CFGResult objects representing the module's dependencies.
 * @param objectFolder  - The directory where object files should be stored.
 * @param libraryFolder - The directory where the resulting library should be stored.
 * @param cacheFolder   - The directory where cache files should be stored.
 * @param flags         - CFlgas that should be used for compiling
 *
 * @return The path to the generated static library archive.
 */
export async function compileModule(
    module: CFGResult,
    dependencies: CFGResult[],
    objectFolder: string,
    libraryFolder: string,
    cacheFolder: string,
    flags: string[]
): Promise<string> {
    const args: string[] = generateCompilerArguments(dependencies, module, flags);

    const nameTable: Map<string, number> = new Map<string, number>();
    const objects: string[] = [];

    const moduleCacheFolder = path.join(cacheFolder, module.name);
    if (!fs.existsSync(moduleCacheFolder)) {
        fs.mkdirSync(moduleCacheFolder, {recursive: true});
    }

    for (const source of module.sources) {
        let name: string = path.basename(source, ".c");
        let index: number | undefined = nameTable.get(name);
        if (index) {
            index++;
            name += index;
            nameTable.set(name, index);
        } else {
            nameTable.set(name, 1);
        }

        const object: string = path.join(objectFolder, name + ".o");
        const hashFile: string = path.join(moduleCacheFolder, name + ".hash");

        const sourceDeps: string[] = await getDependencies(args, source);
        const currentHash: string = await calculateHash(source, sourceDeps, args);

        let skip: boolean = false;
        if (fs.existsSync(object) && fs.existsSync(hashFile)) {
            const storedHash: string = fs.readFileSync(hashFile, "utf-8");
            if (storedHash == currentHash) {
                skip = true;
            }
        }

        if (!skip) {
            if (!await compileFile(args, source, object)) {
                throw new Error(`Failed to compile '${source}' (clang ${args.map(arg => `"${arg}"`).join(' ')} "${source}" "-o" "${object}")`);
            }
            fs.writeFileSync(hashFile, currentHash);
        }
        objects.push(object);
    }

    const archiveHash: string = crypto.hash("SHA256", objectFolder, "base64").replace("=", "").substring(0, 12);
    const archiveName: string = `lib_${archiveHash}.a`;
    const archive: string = path.join(libraryFolder, archiveName);
    if (!await bundleFiles(objects, archive)) {
        throw new Error(`Failed to bundle module`);
    }

    return archive;
}

/**
 * Embeds binary content into an object file by generating C code and compiling it.
 *
 * @param content - The binary content to embed.
 * @param object  - The path to the output object file.
 * @param prefix  - The prefix to use for the generated C symbols.
 * @param target  - The target triple for which to compile the embedded content.
 * @param flags   - Additional compiler flags.
 *
 * @return A promise that resolves when the embedding is complete.
 */
export async function embedFile(content: Buffer, object: string, prefix: string, target: TargetTriple, flags: string[]): Promise<void> {
    return new Promise((resolve, reject) => {
        const process = child_process.spawn("clang", flags.concat("-x", "c", "-c", "-target", getTargetTripleString(target), "-", "-o", object), {
            stdio: [undefined, "pipe", "pipe"]
        });
        const stdin: Writable = process.stdin;

        let stderr = "";
        process.stderr?.on("data", (data) => {
            stderr += data.toString();
        });

        stdin.write("size_t ");
        stdin.write(prefix);
        stdin.write("_LENGTH = ");
        stdin.write(content.length.toString());
        stdin.write(";\n\n");
        stdin.write("unsigned char ");
        stdin.write(prefix);
        stdin.write("_DATA[] = {");

        for (let i: number = 0; i < content.length; i++) {
            stdin.write("0x");
            stdin.write(content[i]!.toString(16).padStart(2, "0"));
            stdin.write(",");
        }

        stdin.write("0x00");
        stdin.write("};")
        stdin.end();

        process.on("close", (code) => {
            if (code != 0) {
                reject(new Error(`Clang exited with code ${code}\n${stderr}`));
            } else {
                resolve();
            }
        });
    });
}

/**
 * Links multiple object files and libraries into an executable or shared library using Clang.
 *
 * @param modules         - An array of paths to the modules or object files to link.
 * @param executableFiles - The path to the output executable or library file.
 * @param flags           - Additional linker flags.
 *
 * @return True if linking was successful.
 */
export async function linkFiles(modules: string[], executableFiles: string, flags: string[]): Promise<boolean> {
    const result = await subprocess.run("clang", modules.concat(flags).concat("-o", executableFiles));

    if (result.code != 0) {
        throw new Error(result.stderr);
    }

    return true;
}