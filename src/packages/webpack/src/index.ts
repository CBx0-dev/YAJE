import * as path from "path";

import {type Configuration, webpack} from "webpack";

import {CBG, type OutputInformation} from "@yaje/core/bundler";

export class WebpackCBG extends CBG {
    private config: Configuration | null;

    public constructor(projectInformation: OutputInformation) {
        super(projectInformation);
        this.config = null;
    }

    public async init(): Promise<void> {
        // Optional: load webpack.config.js dynamically
        this.config = null;
    }

    public async bundle(entry: string): Promise<string> {
        const outputPath = this.projectInformation.genFolder;

        const config: Configuration = {
            ...(this.config ?? {}),
            mode: "production",
            entry,
            output: {
                path: outputPath,
                filename: "bundle.js",
                module: true,
                library: {
                    type: "module"
                }
            },
            experiments: {
                outputModule: true
            },
            optimization: {
                splitChunks: false,
                runtimeChunk: false,
                minimize: false
            }
        };

        const compiler = webpack(config);

        await new Promise<void>((resolve, reject) => {
            compiler.run((err, stats) => {
                if (err) return reject(err);
                if (!stats || stats.hasErrors()) {
                    return reject(
                        new Error(stats?.toString({all: false, errors: true}))
                    );
                }

                const info = stats.toJson();
                const jsAssets = info.assets?.filter(a =>
                    a.name.endsWith(".js")
                ) ?? [];

                if (jsAssets.length !== 1) {
                    return reject(
                        new Error("Webpack did not produce exactly one JS file.")
                    );
                }

                resolve();
            });
        });

        return path.join(outputPath, "bundle.js");
    }
}

export default WebpackCBG;
