var _a;
import fs from 'node:fs';
import path from 'node:path';
/**
 * Filesystem-only repository scanner that enumerates files and directories without parsing source semantics.
 */
export class RepositoryScanner {
    #rootPath;
    #ignoredDirectories = new Set(['.git', 'node_modules', 'dist', 'build', 'coverage']);
    constructor(rootPath) {
        this.#rootPath = path.resolve(rootPath);
    }
    /** Scan the repository filesystem deterministically. */
    scan() {
        const files = [];
        const directories = [];
        this.#walk(this.#rootPath, '', files, directories);
        return {
            rootPath: this.#rootPath,
            files: Object.freeze([...files].sort((left, right) => left.relativePath.localeCompare(right.relativePath))),
            directories: Object.freeze([...directories].sort((left, right) => left.relativePath.localeCompare(right.relativePath))),
        };
    }
    /** Normalize path separators to forward slashes for cross-platform determinism. */
    static normalizePath(filePath) {
        return filePath.split(path.sep).join('/');
    }
    #walk(currentPath, relativePath, files, directories) {
        const normalizedRelativePath = _a.normalizePath(relativePath);
        directories.push(Object.freeze({
            relativePath: normalizedRelativePath,
            depth: normalizedRelativePath === '' ? 0 : normalizedRelativePath.split('/').length,
        }));
        const entries = fs.readdirSync(currentPath, { withFileTypes: true })
            .map((entry) => entry.name)
            .sort((left, right) => left.localeCompare(right));
        for (const entryName of entries) {
            const absolutePath = path.join(currentPath, entryName);
            const nextRelativePath = relativePath === '' ? entryName : path.join(relativePath, entryName);
            const stats = fs.statSync(absolutePath);
            if (stats.isDirectory()) {
                if (this.#ignoredDirectories.has(entryName)) {
                    continue;
                }
                this.#walk(absolutePath, nextRelativePath, files, directories);
                continue;
            }
            files.push(Object.freeze({
                relativePath: _a.normalizePath(nextRelativePath),
                extension: path.extname(entryName).replace(/^\./, '').toLowerCase(),
                size: stats.size,
            }));
        }
    }
}
_a = RepositoryScanner;
