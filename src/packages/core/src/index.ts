declare global {
    /**
     * Interface for the native ABI exposed to the JavaScript environment.
     */
    export interface NativeABI {
        /**
         * Retrieves a native module by its identifier.
         *
         * @template T - The expected type of the returned module object.
         *
         * @param identifier - The unique string identifier of the module.
         *
         * @returns The native module object.
         *
         * @throws {TypeError} If the module with the given identifier is not found.
         */
        getModule<T extends object>(identifier: string): T;
    }

    /**
     * The global `Native` object providing access to native engine modules.
     */
    export const Native: NativeABI;
}

export {};