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
        const lockfileDependencies = this.#scanPackageLock(rootPath, dependencies);
        const duplicateVersions = DependencyScanner.findDuplicateVersions(lockfileDependencies);
        const output = freezeToolValue({
            dependencies,
            lockfileDependencies,
            duplicateVersions,
        });
        return freezeToolValue({
            toolId: this.metadata.id,
            toolName: this.metadata.name,
            capability: this.metadata.capability,
            version: this.metadata.version,
            output,
            evidence: {
                nodes: [
                    ...dependencies.map((dependency) => ({
                        id: `dependency:${dependency.package}:${dependency.source}`,
                        kind: 'dependency',
                        label: dependency.package,
                        value: dependency,
                        confidence: deterministicToolConfidence,
                        provenance: [],
                    })),
                    ...lockfileDependencies.map((dependency) => ({
                        id: `dependency:lockfile:${dependency.location}`,
                        kind: 'dependency:resolved',
                        label: dependency.package,
                        value: dependency,
                        confidence: deterministicToolConfidence,
                        provenance: [],
                    })),
                    ...duplicateVersions.map((duplicate) => ({
                        id: `dependency:duplicate:${duplicate.package}`,
                        kind: 'dependency:duplicate-version',
                        label: duplicate.package,
                        value: duplicate,
                        confidence: deterministicToolConfidence,
                        provenance: [],
                    })),
                ],
            },
        });
    }
    static findDuplicateVersions(records) {
        const grouped = new Map();
        for (const record of records) {
            const packageRecords = grouped.get(record.package) ?? [];
            grouped.set(record.package, [...packageRecords, record]);
        }
        const duplicates = [];
        for (const [packageName, packageRecords] of grouped.entries()) {
            const sortedRecords = [...packageRecords].sort((left, right) => left.location.localeCompare(right.location));
            const versions = [...new Set(sortedRecords.map((record) => record.resolvedVersion))].sort((left, right) => left.localeCompare(right));
            if (versions.length < 2) {
                continue;
            }
            duplicates.push({
                package: packageName,
                versions,
                locations: sortedRecords.map((record) => record.location),
                supportingEvidenceIds: sortedRecords.map((record) => `dependency:lockfile:${record.location}`),
            });
        }
        return duplicates.sort((left, right) => left.package.localeCompare(right.package));
    }
    static analyzeUsage(dependencies, moduleNodes) {
        const manifestDependencies = dependencies.filter((dependency) => dependency.source === 'package.json' && dependency.section);
        const importedPackages = new Map();
        for (const moduleNode of moduleNodes) {
            const packageRoot = normalizeExternalPackageRoot(moduleNode.label);
            if (!packageRoot) {
                continue;
            }
            const evidenceIds = importedPackages.get(packageRoot) ?? [];
            importedPackages.set(packageRoot, [...evidenceIds, moduleNode.id].sort((left, right) => left.localeCompare(right)));
        }
        const declaredPackages = new Set(manifestDependencies.map((dependency) => dependency.package));
        const declaredAndImported = [];
        const declaredButNotImported = [];
        for (const dependency of [...manifestDependencies].sort((left, right) => {
            const packageComparison = left.package.localeCompare(right.package);
            if (packageComparison !== 0) {
                return packageComparison;
            }
            return (left.section ?? '').localeCompare(right.section ?? '');
        })) {
            const section = dependency.section;
            if (!section) {
                continue;
            }
            const importedEvidenceIds = importedPackages.get(dependency.package) ?? [];
            const finding = {
                package: dependency.package,
                version: dependency.version,
                dependencyType: section,
                supportingEvidenceIds: dependency.supportingEvidenceIds ?? [],
                importedEvidenceIds,
                runtimeUnused: section === 'dependencies',
            };
            if (importedEvidenceIds.length > 0) {
                declaredAndImported.push({
                    ...finding,
                    supportingEvidenceIds: [...finding.supportingEvidenceIds, ...importedEvidenceIds],
                });
            }
            else {
                declaredButNotImported.push(finding);
            }
        }
        const importedButUndeclared = [...importedPackages.entries()]
            .filter(([packageName]) => !declaredPackages.has(packageName))
            .map(([packageName, supportingEvidenceIds]) => ({ package: packageName, supportingEvidenceIds }));
        return {
            declaredAndImported: Object.freeze(declaredAndImported),
            declaredButNotImported: Object.freeze(declaredButNotImported),
            importedButUndeclared: Object.freeze(importedButUndeclared),
        };
    }
    #scanDependencies(rootPath) {
        const manifestPath = path.join(rootPath, 'package.json');
        const dependencyRecords = [];
        if (fs.existsSync(manifestPath)) {
            const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
            dependencyRecords.push(...this.#fromSection(manifest.dependencies, 'runtime', 'package.json', 'dependencies'));
            dependencyRecords.push(...this.#fromSection(manifest.devDependencies, 'development', 'package.json', 'devDependencies'));
            dependencyRecords.push(...this.#fromSection(manifest.peerDependencies, 'peer', 'package.json', 'peerDependencies'));
            dependencyRecords.push(...this.#fromSection(manifest.optionalDependencies, 'optional', 'package.json', 'optionalDependencies'));
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
    #scanPackageLock(rootPath, dependencies) {
        const lockfilePath = path.join(rootPath, 'package-lock.json');
        if (!fs.existsSync(lockfilePath)) {
            return [];
        }
        try {
            const lockfile = JSON.parse(fs.readFileSync(lockfilePath, 'utf8'));
            if (lockfile.lockfileVersion !== 3 || !isRecord(lockfile.packages)) {
                return [];
            }
            const declarations = new Map(dependencies
                .filter((dependency) => dependency.source === 'package.json' && dependency.section)
                .map((dependency) => [dependency.package, { version: dependency.version, section: dependency.section }]));
            const records = [];
            for (const [location, packageValue] of Object.entries(lockfile.packages)) {
                if (location === '' || !isRecord(packageValue) || typeof packageValue.version !== 'string') {
                    continue;
                }
                const packageName = packageNameFromLocation(location);
                if (!packageName) {
                    continue;
                }
                const declaration = declarations.get(packageName);
                const evidenceId = `dependency:lockfile:${location}`;
                records.push({
                    package: packageName,
                    resolvedVersion: packageValue.version,
                    location,
                    isDirect: declaration !== undefined && location === `node_modules/${packageName}`,
                    declaredVersion: declaration?.version,
                    dependencyType: declaration?.section,
                    supportingEvidenceIds: [evidenceId],
                });
            }
            return records.sort((left, right) => left.location.localeCompare(right.location));
        }
        catch {
            return [];
        }
    }
    #fromSection(section, type, source, manifestSection) {
        return Object.entries(section ?? {})
            .sort(([left], [right]) => left.localeCompare(right))
            .map(([packageName, version]) => ({
            package: packageName,
            version,
            type,
            source,
            section: manifestSection,
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
export function normalizeExternalPackageRoot(moduleSpecifier) {
    if (moduleSpecifier.startsWith('.') || moduleSpecifier.startsWith('node:')) {
        return undefined;
    }
    const segments = moduleSpecifier.split('/');
    if (moduleSpecifier.startsWith('@')) {
        return segments.length >= 2 ? `${segments[0]}/${segments[1]}` : undefined;
    }
    return segments[0] || undefined;
}
function packageNameFromLocation(location) {
    const nodeModulesIndex = location.lastIndexOf('node_modules/');
    if (nodeModulesIndex < 0) {
        return undefined;
    }
    const packagePath = location.slice(nodeModulesIndex + 'node_modules/'.length);
    const segments = packagePath.split('/');
    if (segments[0]?.startsWith('@')) {
        return segments.length >= 2 ? `${segments[0]}/${segments[1]}` : undefined;
    }
    return segments[0] || undefined;
}
function isRecord(value) {
    return value !== null && typeof value === 'object' && !Array.isArray(value);
}
function isRecordOfStrings(value) {
    return isRecord(value) && Object.values(value).every((item) => typeof item === 'string');
}
