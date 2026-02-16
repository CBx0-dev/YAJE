import * as path from "path";
import * as fs from "fs";

export * from "./shared.js";

export namespace TargetTriple {
    type OpenString = string & {};

    export type Arch =
        | "x86_64"
        | "i686"
        | "aarch64"
        | "armv7"
        | OpenString;

    export type Vendor =
        | "pc"
        | "unknown"
        | OpenString;

    export type Platform =
        | "windows"
        | "linux"
        | "darwin"
        | OpenString;

    export type Abi =
        | "msvc"
        | "gnu"
        | "musl"
        | OpenString;
}

export interface TargetTriple {
    arch: TargetTriple.Arch;
    vendor: TargetTriple.Vendor;
    platform: TargetTriple.Platform;
    abi: TargetTriple.Abi;
}

export interface CFGResult {
    name: string;
    sources: string[];
    libraryLookup: string[];
    includeDirs: string[];
    defineMacros: Record<string, string | number | true>;
    loadingFunctions: string[];
    cFlags: string[];
    lFlags: string[];
}

class Arch {
    private readonly targetArch: TargetTriple.Arch;

    public constructor(targetArch: TargetTriple.Arch) {
        this.targetArch = targetArch;
    }

    public isX64(): boolean {
        return this.targetArch == "x86_64";
    }

    public isI686(): boolean {
        return this.targetArch == "i686";
    }

    public isAArch64(): boolean {
        return this.targetArch == "aarch64";
    }

    public isArmv7(): boolean {
        return this.targetArch == "armv7"
    }

    public is(target: string): boolean {
        return this.targetArch == target;
    }
}

class Vendor {
    private readonly targetVendor: TargetTriple.Vendor;

    public constructor(targetVendor: TargetTriple.Platform) {
        this.targetVendor = targetVendor;
    }

    public is(target: string): boolean {
        return this.targetVendor == target;
    }
}

class Platform {
    private readonly targetPlatform: TargetTriple.Platform;

    public constructor(targetPlatform: TargetTriple.Platform) {
        this.targetPlatform = targetPlatform;
    }

    public isWindows(): boolean {
        return this.targetPlatform == "windows";
    }

    public isLinux(): boolean {
        return this.targetPlatform == "linux";
    }

    public isDarwin(): boolean {
        return this.targetPlatform == "darwin";
    }

    public is(target: string): boolean {
        return this.targetPlatform == target;
    }
}

class Abi {
    private readonly targetAbi: TargetTriple.Abi;

    public constructor(targetAbi: TargetTriple.Abi) {
        this.targetAbi = targetAbi;
    }

    public isMSVC(): boolean {
        return this.targetAbi == "msvc";
    }

    public isMusl(): boolean {
        return this.targetAbi == "musl";
    }

    public isGNU(): boolean {
        return this.targetAbi == "gnu";
    }

    public is(target: string): boolean {
        return this.targetAbi == target;
    }
}

/**
 * Configuration class for defining build settings, sources, and dependencies.
 */
export class CFG {
    public static target: TargetTriple | null = null;
    public static projectDir: string | null = null;
    public static moduleName: string = "unnamed";

    private readonly projectDir: string;
    private readonly libraryLookup: Set<string> = new Set<string>();
    private readonly sources: Set<string> = new Set<string>();
    private readonly includeDirs: Set<string> = new Set<string>();
    private readonly defineMacros: Record<string, string | number | true> = {};
    private loadingFunctions: string[] = [];
    private cFlags: string[] = [];
    private lFlags: string[] = [];

    public readonly arch: Arch;
    public readonly vendor: Vendor;
    public readonly platform: Platform;
    public readonly abi: Abi;

    public constructor() {
        if (!CFG.target) {
            throw Error("Target triple is not set");
        }
        if (!CFG.projectDir) {
            throw new Error("ProjectDir must be set");
        }

        this.projectDir = CFG.projectDir;

        this.arch = new Arch(CFG.target.arch);
        this.vendor = new Vendor(CFG.target.vendor);
        this.platform = new Platform(CFG.target.platform);
        this.abi = new Abi(CFG.target.abi);
    }

    /**
     * Adds C source files from a directory to the build configuration.
     *
     * @param relativePath - The path to the source directory, relative to the project root.
     * @param recursive    - Whether to search for source files in subdirectories.
     *
     * @return The CFG instance for chaining.
     */
    public addSource(relativePath: string, recursive: boolean = false): this {
        const sourceDir: string = path.join(this.projectDir, relativePath);

        if (!fs.existsSync(sourceDir) || !fs.statSync(sourceDir).isDirectory()) {
            throw "Source path don't points to a directory";
        }

        this.lookupSourceFolder(sourceDir, recursive);

        return this;
    }

    private lookupSourceFolder(sourceDir: string, recursive: boolean) {
        for (const fileName of fs.readdirSync(sourceDir)) {
            const filePath: string = path.join(sourceDir, fileName);

            if (fileName.endsWith(".c")) {
                this.sources.add(filePath);
            }

            if (recursive && fs.statSync(filePath).isDirectory()) {
                this.lookupSourceFolder(filePath, true);
            }
        }
    }

    /**
     * Adds a directory to the library lookup path.
     *
     * @param relativePath - The path to the library directory, relative to the project root.
     *
     * @return The CFG instance for chaining.
     */
    public addLibraryLookup(relativePath: string): this {
        const importDir: string = path.join(this.projectDir, relativePath);

        if (!fs.existsSync(importDir) || !fs.statSync(importDir).isDirectory()) {
            throw "Library path don't points to a directory";
        }

        this.libraryLookup.add(importDir);

        return this;
    }

    /**
     * Adds a directory to the include path for the compiler.
     *
     * @param relativePath - The path to the include directory, relative to the project root.
     *
     * @return The CFG instance for chaining.
     */
    public addIncludeDir(relativePath: string): this {
        const includeDir: string = path.join(this.projectDir, relativePath);

        if (!fs.existsSync(includeDir) || !fs.statSync(includeDir).isDirectory()) {
            throw "Include path don't points to a directory";
        }

        this.includeDirs.add(includeDir);

        return this;
    }

    /**
     * Defines a preprocessor macro.
     *
     * @param name  - The name of the macro.
     * @param value - The value of the macro, or `true` for a macro without a value.
     *
     * @return The CFG instance for chaining.
     */
    public defineMacro(name: string, value: string | number | true): this {
        this.defineMacros[name] = value;

        return this;
    }

    /**
     * Sets the names of the functions that load modules into the JavaScript context.
     *
     * @param loadingFunctions - An array of function names.
     *
     * @return The CFG instance for chaining.
     */
    public setLoadingFunctions(...loadingFunctions: string[]): this {
        this.loadingFunctions = loadingFunctions;

        return this;
    }

    /**
     * Sets additional compiler flags.
     *
     * @param flags - An array of compiler flags.
     *
     * @return The CFG instance for chaining.
     */
    public setCFlags(...flags: string[]): this {
        this.cFlags = flags;

        return this;
    }

    /**
     * Sets additional linker flags.
     *
     * @param flags - An array of linker flags.
     *
     * @return The CFG instance for chaining.
     */
    public setLFlags(...flags: string[]): this {
        this.lFlags = flags;

        return this;
    }

    /**
     * Completes the configuration and returns the result.
     *
     * @return The build configuration result.
     */
    public complete(): CFGResult {
        return {
            name: CFG.moduleName,
            sources: Array.from(this.sources),
            libraryLookup: Array.from(this.libraryLookup),
            includeDirs: Array.from(this.includeDirs),
            defineMacros: this.defineMacros,
            loadingFunctions: this.loadingFunctions,
            cFlags: this.cFlags,
            lFlags: this.lFlags
        }
    }
}