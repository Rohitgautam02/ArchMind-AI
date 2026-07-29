import fs from 'node:fs';
import path from 'node:path';
import { deterministicToolConfidence, freezeToolValue } from './tool-result.js';
import { validateAgainstSchema } from './tool-contract.js';
const inputSchema = Object.freeze({
    title: 'MetadataResult',
    description: 'Repository metadata used to locate dependency manifests.',
    fields: Object.freeze({
        extractedAt: Object.freeze({ type: 'string', required: true }),
        summary: Object.freeze({ type: 'object', required: true }),
    }),
});
const outputSchema = Object.freeze({
    title: 'DependencyScanResult',
    description: 'Deterministic dependency inventory.',
    fields: Object.freeze({
        dependencies: Object.freeze({ type: 'array', required: true, itemType: 'object' }),
    }),
});
export class DependencyScanner {
    metadata = Object.freeze({
        id: 'dependency-scanner@1.0.0',
        name: 'dependency-scanner',
        capability: 'dependency.scan',
        version: '1.0.0',
        inputSchema,
        outputSchema,
    });
    validate(input) {
        return validateAgainstSchema(input, this.metadata.inputSchema);
    }
    execute(input) {
        const rootPath = input.summary.repository.rootPath;
        const dependencies = this.#scanDependencies(rootPath);
        const output = freezeToolValue({
            dependencies,
        });
        return freezeToolValue({
            toolId: this.metadata.id,
            toolName: this.metadata.name,
            capability: this.metadata.capability,
            version: this.metadata.version,
            output,
            evidence: {
                nodes: dependencies.map((dependency) => ({
                    id: `dependency:${dependency.package}:${dependency.source}`,
                    kind: 'dependency',
                    label: dependency.package,
                    value: dependency,
                    confidence: deterministicToolConfidence,
                    provenance: [],
                })),
            },
        });
    }
    #scanDependencies(rootPath) {
        const manifestPath = path.join(rootPath, 'package.json');
        const dependencyRecords = [];
        if (fs.existsSync(manifestPath)) {
            const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
            dependencyRecords.push(...this.#fromSection(manifest.dependencies, 'runtime', 'package.json'));
            dependencyRecords.push(...this.#fromSection(manifest.devDependencies, 'development', 'package.json'));
            dependencyRecords.push(...this.#fromSection(manifest.peerDependencies, 'peer', 'package.json'));
            dependencyRecords.push(...this.#fromSection(manifest.optionalDependencies, 'optional', 'package.json'));
        }
        for (const lockfile of ['package-lock.json', 'yarn.lock', 'pnpm-lock.yaml']) {
            const lockfilePath = path.join(rootPath, lockfile);
            if (!fs.existsSync(lockfilePath)) {
                continue;
            }
            dependencyRecords.push({
                package: lockfile,
                version: this.#lockfileVersion(lockfilePath),
                type: 'unknown',
                source: lockfile,
            });
        }
        return dependencyRecords.sort((left, right) => {
            const packageComparison = left.package.localeCompare(right.package);
            if (packageComparison !== 0) {
                return packageComparison;
            }
            const sourceComparison = left.source.localeCompare(right.source);
            if (sourceComparison !== 0) {
                return sourceComparison;
            }
            return left.version.localeCompare(right.version);
        });
    }
    #fromSection(section, type, source) {
        return Object.entries(section ?? {})
            .sort(([left], [right]) => left.localeCompare(right))
            .map(([packageName, version]) => ({
            package: packageName,
            version,
            type,
            source,
        }));
    }
    #lockfileVersion(lockfilePath) {
        const content = fs.readFileSync(lockfilePath, 'utf8').trim();
        if (content.length === 0) {
            return '0';
        }
        return String(content.length);
    }
}
