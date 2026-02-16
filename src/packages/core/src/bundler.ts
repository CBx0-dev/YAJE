import type {OutputInformation} from "./shared.js";

export * from "./shared.js";

// Common Bundler Gateway
/**
 * Common Bundler Gateway (CBG) abstract class for implementing custom bundlers.
 */
export abstract class CBG {
    protected projectInformation: OutputInformation;

    protected constructor(projectInformation: OutputInformation) {
       this.projectInformation = projectInformation;
    }

    /**
     * Initializes the bundler.
     *
     * @return A promise that resolves when initialization is complete.
     */
    public abstract init(): Promise<void>;

    /**
     * Bundles the project starting from the specified entry file.
     *
     * @param entry - The path to the entry file.
     *
     * @return A promise that resolves to the path of the generated bundle file.
     */
    public abstract bundle(entry: string): Promise<string>;
}