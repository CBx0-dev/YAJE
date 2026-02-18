import * as path from "path";

import * as esbuild from "esbuild";

import { CBG, type OutputInformation } from "@yaje/core/bundler";

export class EsbuildCBG extends CBG {
    public constructor(projectInformation: OutputInformation) {
        super(projectInformation);
    }

    public async init(): Promise<void> {
        // No init required
    }

    public async bundle(entry: string): Promise<string> {
        const outfile = path.join(
            this.projectInformation.genFolder,
            "bundle.js"
        );

        const result = await esbuild.build({
            entryPoints: [entry],
            bundle: true,
            format: "esm",
            splitting: false,
            outfile,
            sourcemap: false,
            minify: false,
            write: true,
            metafile: true,
            platform: "neutral"
        });

        const outputs = Object.keys(result.metafile?.outputs ?? {});
        if (outputs.length !== 1 || !outputs[0]!.endsWith(".js")) {
            throw new Error("esbuild did not produce exactly one JS file.");
        }

        return outfile;
    }
}

export default EsbuildCBG;