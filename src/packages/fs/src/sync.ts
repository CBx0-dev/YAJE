import "@yaje/core";

export const enum Seek {
    SET,
    CURRENT,
    END
}

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

    /**
     * Changes the file position.
     *
     * @param fd     - The file descriptor.
     * @param offset - The offset from the origin.
     * @param origin - The starting position.
     */
    seek(fd: number, offset: number, origin: Seek): void;

    /**
     * Returns the current file position.
     *
     * @param fd - The file descriptor.
     *
     * @returns The current position in the file.
     */
    tell(fd: number): number;
}

const native: SyncFS = Native.getModule("fs.sync");

export const sync = {
    native
}

export function writeFileSync(path: string, content: string): void {
    const {open, write, close} = native;

    const fd: number = open(path, "w+");
    write(fd, content);
    close(fd);
}

export function readFileSync(path: string): string {
    const {open, read, close, seek, tell} = native;

    const fd: number = open(path, "r+");
    
    seek(fd, 0, Seek.END);
    const length: number = tell(fd);
    seek(fd, 0, Seek.SET);

    const content: string = read(fd, length);
    
    close(fd);
    return content;
}