import * as fs from "fs/promises";
import * as fsSync from "fs";
import * as path from "path";

import prompts from "prompts";
import chalk from "chalk";
import ora from "ora";

/**
 * Creates the project structure for an "Application" template.
 *
 * @param projectDir         - The directory where the project should be created.
 * @param result             - The result from the user prompts.
 * @param packageJSONContent - The content for the package.json file.
 *
 * @return A promise that resolves when the structure has been created.
 */
async function createAppStructure(projectDir: string, result: any, packageJSONContent: any): Promise<void> {
    await fs.mkdir(projectDir, {recursive: true});
    await fs.writeFile(path.join(projectDir, "package.json"), JSON.stringify(packageJSONContent, null, 4));

    const srcDir: string = path.join(projectDir, "src");
    await fs.mkdir(srcDir, {recursive: true});

    const indexContent = `console.log("Hello, YAJE!");\n`;
    await fs.writeFile(path.join(projectDir, result.entry), indexContent);
}

/**
 * Creates the project structure for an "Engine Module" template.
 *
 * @param projectDir         - The directory where the project should be created.
 * @param result             - The result from the user prompts.
 * @param packageJSONContent - The content for the package.json file.
 *
 * @return A promise that resolves when the structure has been created.
 */
async function createEngineModuleStructure(projectDir: string, result: any, packageJSONContent: any): Promise<void> {
    await fs.mkdir(projectDir, {recursive: true});
    await fs.writeFile(path.join(projectDir, "package.json"), JSON.stringify(packageJSONContent, null, 4));

    const nativeDir: string = path.join(projectDir, "native");
    const srcDir: string = path.join(projectDir, "src");
    await fs.mkdir(nativeDir, {recursive: true});
    await fs.mkdir(srcDir, {recursive: true});

    const initCContent = `#include "quickjs.h"
#include <stdio.h>

static JSValue hello_world(JSContext *ctx, JSValueConst this_val, int argc, JSValueConst *argv) {
    printf("Hello from native module!\\n");
    return JS_UNDEFINED;
}

void yaje_${result.name.replace(/[^a-zA-Z0-9]/g, "_")}_init(JSRuntime *rt, JSContext *ctx) {
    JSValue global_obj = JS_GetGlobalObject(ctx);
    JS_SetPropertyStr(ctx, global_obj, "hello", JS_NewCFunction(ctx, hello_world, "hello", 0));
    JS_FreeValue(ctx, global_obj);
}
`;
    await fs.writeFile(path.join(nativeDir, "init.c"), initCContent);

    const buildJsContent = `import {CFG} from "@yaje/core/builder";

const cfg = new CFG();

cfg.addSource("./native");
cfg.addIncludeDir("./native");
cfg.setLoadingFunctions("yaje_${result.name.replace(/[^a-zA-Z0-9]/g, "_")}_init");

cfg.setCFlags("-g", "-fwrapv", "-Wall");
cfg.setLFlags("-g");

export default cfg;
`;
    await fs.writeFile(path.join(projectDir, "yaje.build.js"), buildJsContent);
    await fs.writeFile(path.join(srcDir, "index.ts"), "");
}

/**
 * Initializes a new YAJE project by prompting the user for configuration and generating the necessary files.
 *
 * @return A promise that resolves to 0 on success, or 1 on failure.
 */
export default async function init(): Promise<number> {
    const cwd: string = process.cwd();
    const initDir: string | undefined = fsSync.readdirSync(cwd).length == 0 ? "." : undefined;

    const result = await prompts([
        {
            type: "select",
            name: "template",
            message: "Project template",
            choices: [
                {title: "Application", value: "app", description: "A standard YAJE user application"},
                {title: "Engine Module", value: "module", description: "A native engine module with C bindings"}
            ]
        },
        {
            type: "text",
            message: "Init project in",
            name: "projectDir",
            initial: initDir,
            validate: value => {
                let projectDir: string = path.join(cwd, value);

                if (!fsSync.existsSync(projectDir) || !fsSync.statSync(projectDir).isDirectory()) {
                    return true;
                }

                return fsSync.readdirSync(path.join(cwd, value)).length > 0
                    ? "Project folder must be empty"
                    : true
            }
        },
        {
            type: "text",
            message: "Project name",
            name: "name",
        },
        {
            type: (_, values) => values.template == "app" ? "text" : null,
            message: "Entry point",
            name: "entry",
            initial: "./src/index.js"
        },
        {
            type: (_, values) => values.template == "app" ? "select" : null,
            name: "bundler",
            message: "Which bundler should be used",
            choices: [
                {title: "Vite", value: "@yaje/vite"}
            ]
        },
        {
            type: (_, values) => values.template == "app" ? "multiselect" : null,
            name: "modules",
            message: "Which modules should be installed",
            choices: [
                {title: "@yaje/core", value: "@yaje/core", disabled: true, selected: true},
                {title: "@yaje/console", value: "@yaje/console"},
                {title: "@yaje/fs", value: "@yaje/fs"},
            ]
        }
    ]);

    if (!result.projectDir) {
        return 1;
    }

    console.log();
    console.log(`${chalk.blue.bold("Initializing project")} ${chalk.cyan.bold(result.name)}`);

    const projectDir: string = path.join(cwd, result.projectDir);
    const isApp = result.template == "app";

    const dependencies: Record<string, string> = {
        "@yaje/core": "^1.0.0"
    };

    if (isApp) {
        dependencies[result.bundler] = "^1.0.0";
        for (const module of result.modules) {
            dependencies[module] = "^1.0.0";
        }
    }

    const packageJSONContent: any = {
        name: result.name,
        version: "1.0.0",
        type: "module",
        dependencies: dependencies,
        devDependencies: {
            "@yaje/cli": "^1.0.0"
        }
    };

    if (isApp) {
        packageJSONContent.main = result.entry;
    } else {
        packageJSONContent.main = "dist/index.js";
        packageJSONContent.scripts = {
            "build": "tsc -b",
            "clean": "tsc -b --clean"
        };
    }

    const initSpinner = ora({
        text: `  ${chalk.dim("Creating project structure")}`,
        color: 'cyan'
    }).start();

    try {
        if (isApp) {
            await createAppStructure(projectDir, result, packageJSONContent);
        } else {
            await createEngineModuleStructure(projectDir, result, packageJSONContent);
        }

        initSpinner.succeed();
    } catch (e) {
        initSpinner.fail();
        console.log(chalk.red(`Failed to initialize project: ${e}`));
        return 1;
    }

    console.log();
    console.log(chalk.green.bold("Project initialized successfully!"));
    console.log();

    console.log(chalk.blue.bold("Next steps:"));

    if (result.projectDir != ".") {
        console.log(`  ${chalk.yellow("cd")} ${result.projectDir}`);
    }

    console.log(`  ${chalk.yellow("npm")} install`);
    console.log(`  ${chalk.yellow("yaje")} build`);

    if (!isApp) {
        console.log(`  ${chalk.yellow("yaje")} cdb`);
    }

    return 0;
}