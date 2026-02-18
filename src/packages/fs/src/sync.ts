import "@yaje/core";

/**
 * Interface for synchronous file system operations.
 */
interface SyncFS {
    /**
     * Opens a file.
     *
     * @param path - The path to the file.
     * @param mode - The mode in which to open the file (e.g., "r", "w", "a").
     *
     * @returns A file descriptor (pointer) to the opened file.
     */
    open(path: string, mode: string): number;

    /**
     * Reads data from a file.
     *
     * @param fd     - The file descriptor of the file to read from.
     * @param length - The number of bytes to read.
     *
     * @returns The data read from the file as a string.
     */
    read(fd: number, length: number): string;

    /**
     * Writes data to a file.
     *
     * @param fd   - The file descriptor of the file to write to.
     * @param data - The data to write to the file.
     */
    write(fd: number, data: string): void;

    /**
     * Closes a file.
     *
     * @param fd - The file descriptor of the file to close.
     */
    close(fd: number): void;
}

const native: SyncFS = Native.getModule("fs.sync");

export const sync = {
    native
}

export function writeFileSync(path: string, content: string): void {
    const {open, write, close} = native;

    const fd: number = open(path, "w");
    write(fd, content);
    close(fd);
}