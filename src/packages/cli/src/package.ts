import type {CFGResult} from "@yaje/core/builder";

export interface PackageJSON {
    name: string;
    main?: string;
    dependencies?: Record<string, string>;
    yaje?: {
        bundler: boolean;
    }
}

export type TrackedPackage = {
    packageJSON: PackageJSON;
    packageFolder: string;
    isNative: false;
    isBundler: boolean;
}

export type NativeTrackedPackage = Omit<TrackedPackage, "isNative"> & {
    isNative: true
    instructions: CFGResult;
}

/**
 * Represents a collection of tracked packages, providing methods to manage and retrieve them.
 */
export class PackageCollection implements Iterable<TrackedPackage | NativeTrackedPackage> {
    private readonly packages: Map<string, TrackedPackage | NativeTrackedPackage> = new Map<string, TrackedPackage | NativeTrackedPackage>();

    public constructor() {
    }

    public [Symbol.iterator](): Iterator<TrackedPackage | NativeTrackedPackage> {
        return this.packages.values();
    }

    /**
     * Adds or updates a package in the collection.
     *
     * @param pkg - The package to add or update.
     */
    public set(pkg: TrackedPackage | NativeTrackedPackage): void {
        this.packages.set(pkg.packageJSON.name, pkg);
    }

    /**
     * Checks if a package with the given name exists in the collection.
     *
     * @param name - The name of the package to check for.
     *
     * @return True if the package exists, false otherwise.
     */
    public has(name: string): boolean {
        return this.packages.has(name);
    }

    /**
     * Retrieves a package from the collection by its name.
     *
     * @param name - The name of the package to retrieve.
     *
     * @return The tracked package if found, or `null` otherwise.
     */
    public get(name: string): TrackedPackage | NativeTrackedPackage | null {
        const pkg: TrackedPackage | NativeTrackedPackage | undefined = this.packages.get(name);
        if (!pkg) {
            return null;
        }

        return pkg;
    }

    /**
     * Retrieves the core package (@yaje/core) from the collection.
     *
     * @return The native tracked core package.
     */
    public getCore(): NativeTrackedPackage {
        const pkg: TrackedPackage | NativeTrackedPackage | undefined = this.packages.get("@yaje/core");
        if (!pkg) {
            throw new Error("'@yaje/core' could not be found as package");
        }
        if (!pkg.isNative) {
            throw new Error("'@yaje/core' is not a native package");
        }

        return pkg;
    }

    /**
     * Retrieves the first package in the collection that is marked as a bundler.
     *
     * @return The tracked bundler package.
     */
    public getBundler(): TrackedPackage | NativeTrackedPackage {
        for (const pkg of this.packages.values()) {
            if (pkg.isBundler) {
                return pkg;
            }
        }

        throw new Error("No compatible bundler is installed.");
    }
}