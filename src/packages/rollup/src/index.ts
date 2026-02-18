import * as path from "path";

import * as rollup from "rollup";

import {CBG, type OutputInformation} from "@yaje/core/bundler";


export class RollupCBG extends CBG {
    private config: rollup.RollupOptions | null;

    public constructor(projectInformation: OutputInformation) {
        super(projectInformation);
        this.config = null;
    }

    public async init(): Promise<void> {
        // Optional: load rollup.config.js dynamically if you want
        this.config = null;
    }

    public async bundle(entry: string): Promise<string> {
        const bundle = await rollup.rollup({
            ...(this.config ?? {}),
            input: entry
        });

        const outputOptions: rollup.OutputOptions = {
            file: path.join(this.projectInformation.genFolder, "bundle.js"),
            format: "es",
            inlineDynamicImports: true,
        };

        const { output } = await bundle.write(outputOptions);

        if (output.length !== 1 || output[0].type !== "chunk") {
            throw new Error("Rollup did not produce exactly one JS chunk.");
        }

        return outputOptions.file!;
    }
}

export default RollupCBG;
