#!/usr/bin/env node
import { Command } from "commander";
import chalk from "chalk";

import type {TargetTriple} from "@yaje/core/builder";

import * as compiler from "../compiler.js";
import packageJSON from "../../package.json" with { type: "json" };

import {build} from "./build.js";
import init from "./init.js";
import cdb from "./cdb.js";
import path from "path";

const program = new Command();

program
    .name("yaje")
    .description("YAJE CLI tool")
    .version(packageJSON.version);

program
    .command("build")
    .description("Build the project")
    .option("-t --target <target>", "A valid Clang target triple")
    .action(async (options) => {
        const target: TargetTriple | null = options.target
            ? compiler.parseTargetTriple(options.target)
            : compiler.getHostTargetTriple();

        if (!target) {
            console.log(chalk.red("Failed to parse target triple."));
            return;
        }

        process.exit(await build(target));
    });

program
    .command("init")
    .description("Initialize a new project")
    .action(async () => {
        process.exit(await init());
    });

program
    .command("cdb")
    .description("Generate a compilation database")
    .option("-t --target <target>", "A valid Clang target triple")
    .option("-o, --out <path>", "Output file path")
    .action(async (options) => {
        const target: TargetTriple | null = options.target
            ? compiler.parseTargetTriple(options.target)
            : compiler.getHostTargetTriple();

        if (!target) {
            console.log(chalk.red("Failed to parse target triple."));
            return;
        }

        let out: string = options.out ? options.out : process.cwd();

        process.exit(await cdb(target, out));
    });

program.parse();
