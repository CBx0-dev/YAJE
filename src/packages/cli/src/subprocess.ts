import * as child_process from "node:child_process";

export interface SubprocessResult {
    stdout: string;
    stderr: string;
    code: number | null;
}

/**
 * Runs a command as a subprocess and captures its output.
 *
 * @param command - The command to execute.
 * @param args    - An array of arguments to pass to the command.
 * @param options - Optional spawn options.
 *
 * @return A promise that resolves to a SubprocessResult object containing stdout, stderr, and the exit code.
 */
export async function run(command: string, args: string[], options: child_process.SpawnOptions = {}): Promise<SubprocessResult> {
    return new Promise((resolve, reject) => {
        const proc = child_process.spawn(command, args, {
            ...options,
            stdio: ["ignore", "pipe", "pipe"]
        });

        let stdout = "";
        let stderr = "";

        proc.stdout?.on("data", (data: Buffer) => {
            stdout += data.toString();
        });

        proc.stderr?.on("data", (data: Buffer) => {
            stderr += data.toString();
        });

        proc.on("close", (code: number | null) => {
            resolve({
                stdout,
                stderr,
                code
            });
        });

        proc.on("error", (err: Error) => {
            reject(err);
        });
    });
}
