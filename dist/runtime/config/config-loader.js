import * as fs from 'fs';
import * as path from 'path';
import { defaultRuntimeConfig } from './runtime-config.js';
export class ConfigLoader {
    static load(configPath) {
        const cwd = process.cwd();
        const defaultLocations = [
            'archmind.config.json',
            '.archmindrc.json'
        ];
        let targetPath = configPath;
        if (!targetPath) {
            for (const loc of defaultLocations) {
                const fullPath = path.join(cwd, loc);
                if (fs.existsSync(fullPath)) {
                    targetPath = fullPath;
                    break;
                }
            }
        }
        if (!targetPath) {
            return defaultRuntimeConfig;
        }
        try {
            const resolvedPath = path.resolve(cwd, targetPath);
            if (!fs.existsSync(resolvedPath)) {
                if (configPath) {
                    throw new Error(`Configuration file not found: ${resolvedPath}`);
                }
                return defaultRuntimeConfig;
            }
            const fileContent = fs.readFileSync(resolvedPath, 'utf8');
            const userConfig = JSON.parse(fileContent);
            return this.#mergeConfig(defaultRuntimeConfig, userConfig);
        }
        catch (error) {
            throw new Error(`Failed to load configuration: ${error instanceof Error ? error.message : String(error)}`);
        }
    }
    static #mergeConfig(base, override) {
        // Deep merge simplistic implementation
        const merged = { ...base };
        if (override.timeouts) {
            merged.timeouts = { ...base.timeouts, ...override.timeouts };
        }
        if (override.retryPolicy) {
            merged.retryPolicy = { ...base.retryPolicy, ...override.retryPolicy };
        }
        if (override.reviewer) {
            merged.reviewer = { ...base.reviewer, ...override.reviewer };
        }
        if (override.concurrency) {
            merged.concurrency = { ...base.concurrency, ...override.concurrency };
        }
        return merged;
    }
}
