import * as path from "path";

import * as vite from "vite";

import {CBG, type OutputInformation} from "@yaje/core/bundler";

/**
 * Vite implementation of the Common Bundler Gateway.
 */
export class ViteCBG extends CBG {
    private config: vite.UserConfig | null;

    public constructor(projectInformation: OutputInformation) {
        super(projectInformation);

        this.config = null;
    }

    /**
     * Initializes the Vite bundler by loading the configuration from the project folder.
     *
     * @return A promise that resolves when initialization is complete.
     */
    public async init(): Promise<void> {
        const result = await vite.loadConfigFromFile({
            command: "build",
            mode: "production"
        }, undefined, this.projectInformation.projectFolder);
        if (result) {
            this.config = result.config;
        }
    }

    /**
     * Bundles the project using Vite.
     *
     * @param entry - The path to the entry file.
     *
     * @return A promise that resolves to the path of the generated bundle file.
     */
    public async bundle(entry: string): Promise<string> {
        let config: vite.UserConfig;
        if (this.config) {
            config = vite.mergeConfig(this.config, this.getBaseConfig(entry));
        } else {
            config = this.getBaseConfig(entry);
        }

        await vite.build(config);
        return path.join(this.projectInformation.genFolder, "bundle.js");
    }

    private getBaseConfig(entry: string): vite.UserConfig {
        return {
            root: this.projectInformation.projectFolder,
            build: {
                outDir: this.projectInformation.genFolder,
                lib: {
                    entry: entry,
                    formats: ["es"],
                    fileName: () => "bundle.js"
                },
                rollupOptions: {
                    output: {
                        inlineDynamicImports: true,
                        manualChunks: undefined
                    }
                },

                cssCodeSplit: false,
                assetsInlineLimit: 100000000,
                sourcemap: false,
                emptyOutDir: false,
                minify: false
            },
            logLevel: "error"
        }
    }
}

export default ViteCBG;
