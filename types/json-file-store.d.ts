// types/json-file-store.d.ts

// This tells TypeScript to treat the 'json-file-store' module as a standard
// JavaScript module without strict type definitions.
declare module 'json-file-store' {
    export default class Store {
        constructor(options: { file: string, fallback: Record<string, any> });
        save(data: any): Promise<void>;
        load(id: any): Promise<any>;
        purge(): Promise<void>;
        // Add other methods used in your code if necessary
    }
}