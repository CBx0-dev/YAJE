import * as path from "path";
import * as fs from "fs";

import chalk from "chalk";
import ora from "ora";

import {type CFGResult, generateOutputInformation, type OutputInformation, type TargetTriple} from "@yaje/core/builder";

import * as compiler from "../compiler.js";
import {type NativeTrackedPackage, PackageCollection} from "../package.js";
import {checkPackageJSON, getBaseCFlags} from "./build.js";

interface CDBEntry {
    directory: string;
    command: string;
    file: string;
}

/**
 * Generates a compilation database for the project.
 *
 * @param target - The target triple for which to generate the compilation database.
 * @param out    - The output file path.
 *
 * @return A promise that resolves to 0 on success, or 1 on failure.
 */
export default async function cdb(target: TargetTriple, out: string): Promise<number> {
    const root: string = process.cwd();
    const packages: PackageCollection = new PackageCollection();

    console.log(`${chalk.blue.bold("Generating Compilation Database")}`);

    const spinner = ora({
        text: `  ${chalk.dim("Tracing dependencies")}`,
        color: 'cyan'
    }).start();

    try {
        await checkPackageJSON(root, root, target, packages);
        spinner.succeed();
    } catch (e) {
        spinner.fail();
        console.log(chalk.red(`Failed to trace dependencies: ${e}`));
        return 1;
    }

    const output: OutputInformation = generateOutputInformation(root, compiler.getTargetTripleString(target));
    const cdbEntries: CDBEntry[] = [];

    for (const module of packages) {
        if (!module.isNative) {
            continue;
        }

        const nativeModule: NativeTrackedPackage = module;
        const moduleSpinner = ora({
            text: `  ${chalk.dim("Processing module")} ${chalk.white(nativeModule.packageJSON.name)}`,
            color: 'cyan'
        }).start();

        const dependencies: CFGResult[] = [];
        for (const pkg of packages) {
            if (pkg.isNative && pkg.packageJSON.name != nativeModule.packageJSON.name) {
                dependencies.push(pkg.instructions);
            }
        }

        const args: string[] = compiler.generateCompilerArguments(dependencies, nativeModule.instructions, getBaseCFlags(target));

        for (const source of nativeModule.instructions.sources) {
            const absoluteSource: string = path.isAbsolute(source) ? source : path.join(nativeModule.packageFolder, source);
            cdbEntries.push({
                directory: nativeModule.packageFolder,
                command: `clang ${args.join(" ")} ${source}`,
                file: absoluteSource
            });
        }
        moduleSpinner.succeed();
    }

    const coreSpinner = ora({
        text: `  ${chalk.dim("Processing entry point")}`,
        color: 'cyan'
    }).start();

    try {
        const coreModule: NativeTrackedPackage = packages.getCore();
        const entryPointSource: string = path.join(output.genFolder, "main.c");
        const entryPointArgs: string[] = coreModule.instructions.includeDirs
            .map(includeDir => ["-I", includeDir])
            .flat()
            .concat(["-g", "-fwrapv", "-Wall", "-c"]);

        cdbEntries.push({
            directory: root,
            command: `clang ${entryPointArgs.join(" ")} ${entryPointSource}`,
            file: entryPointSource
        });
        coreSpinner.succeed();
    } catch (e) {
        coreSpinner.stop();
        // Core might not be present if not needed, but yaje build expects it.
    }

    const outputPath: string = path.join(out, "compile_commands.json");

    try {
        fs.writeFileSync(outputPath, JSON.stringify(cdbEntries, null, 4));
        console.log();
        console.log(chalk.green.bold(`Compilation database written successfully to ${outputPath}`));
    } catch (e) {
        console.log(chalk.red(`Failed to write compilation database: ${e}`));
        return 1;
    }

    return 0;
}
