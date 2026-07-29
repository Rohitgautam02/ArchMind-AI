import fs from 'node:fs';
import path from 'node:path';
import { deterministicToolConfidence, freezeToolValue } from './tool-result.js';
import { validateAgainstSchema } from './tool-contract.js';
const inputSchema = Object.freeze({
    title: 'MetadataResult',
    description: 'Repository metadata used to find Docker manifests.',
    fields: Object.freeze({
        extractedAt: Object.freeze({ type: 'string', required: true }),
        summary: Object.freeze({ type: 'object', required: true }),
    }),
});
const outputSchema = Object.freeze({
    title: 'DockerInspectionResult',
    description: 'Structured Docker metadata.',
    fields: Object.freeze({
        dockerfiles: Object.freeze({ type: 'array', required: true, itemType: 'object' }),
        composeFiles: Object.freeze({ type: 'array', required: true, itemType: 'object' }),
    }),
});
export class DockerInspector {
    metadata = Object.freeze({
        id: 'docker-inspector@1.0.0',
        name: 'docker-inspector',
        capability: 'docker.inspect',
        version: '1.0.0',
        inputSchema,
        outputSchema,
    });
    validate(input) {
        return validateAgainstSchema(input, this.metadata.inputSchema);
    }
    execute(input) {
        const rootPath = input.summary.repository.rootPath;
        const dockerfiles = this.#inspectDockerfiles(rootPath);
        const composeFiles = this.#inspectComposeFiles(rootPath);
        const output = freezeToolValue({
            dockerfiles,
            composeFiles,
        });
        return freezeToolValue({
            toolId: this.metadata.id,
            toolName: this.metadata.name,
            capability: this.metadata.capability,
            version: this.metadata.version,
            output,
            evidence: {
                nodes: [
                    ...dockerfiles.map((dockerfile) => ({
                        id: `docker:file:${dockerfile.path}`,
                        kind: 'dockerfile',
                        label: path.basename(dockerfile.path),
                        value: dockerfile,
                        confidence: deterministicToolConfidence,
                        provenance: [],
                    })),
                    ...composeFiles.map((composeFile) => ({
                        id: `docker:compose:${composeFile.path}`,
                        kind: 'docker-compose',
                        label: path.basename(composeFile.path),
                        value: composeFile,
                        confidence: deterministicToolConfidence,
                        provenance: [],
                    })),
                ],
            },
        });
    }
    #inspectDockerfiles(rootPath) {
        const files = ['Dockerfile', 'docker/Dockerfile']
            .map((relativePath) => path.join(rootPath, relativePath))
            .filter((absolutePath) => fs.existsSync(absolutePath));
        return files.map((absolutePath) => {
            const lines = fs.readFileSync(absolutePath, 'utf8').split(/\r?\n/);
            const baseImages = lines
                .map((line) => line.trim())
                .filter((line) => line.toUpperCase().startsWith('FROM '))
                .map((line) => line.slice(5).trim().split(/\s+/)[0] ?? '');
            const exposedPorts = lines
                .map((line) => line.trim())
                .filter((line) => line.toUpperCase().startsWith('EXPOSE '))
                .flatMap((line) => line.slice(7).trim().split(/\s+/))
                .filter(Boolean);
            return {
                path: path.relative(rootPath, absolutePath),
                baseImages: Object.freeze([...new Set(baseImages)].sort()),
                exposedPorts: Object.freeze([...new Set(exposedPorts)].sort()),
                instructions: Object.freeze(lines.map((line) => line.trim()).filter(Boolean)),
            };
        }).sort((left, right) => left.path.localeCompare(right.path));
    }
    #inspectComposeFiles(rootPath) {
        const candidates = ['docker-compose.yml', 'docker-compose.yaml']
            .map((relativePath) => path.join(rootPath, relativePath))
            .filter((absolutePath) => fs.existsSync(absolutePath));
        return candidates.map((absolutePath) => {
            const content = fs.readFileSync(absolutePath, 'utf8');
            const services = this.#extractComposeServices(content);
            return {
                path: path.relative(rootPath, absolutePath),
                services,
            };
        }).sort((left, right) => left.path.localeCompare(right.path));
    }
    #extractComposeServices(content) {
        const lines = content.split(/\r?\n/);
        const services = [];
        let insideServices = false;
        let servicesIndent = 0;
        for (const line of lines) {
            if (!insideServices) {
                if (/^\s*services:\s*$/.test(line)) {
                    insideServices = true;
                }
                continue;
            }
            if (/^\S/.test(line)) {
                break;
            }
            const match = line.match(/^(\s+)([A-Za-z0-9._-]+):\s*$/);
            if (!match) {
                continue;
            }
            const indentation = match[1].length;
            if (services.length === 0) {
                servicesIndent = indentation;
            }
            if (indentation === servicesIndent) {
                services.push(match[2]);
            }
        }
        return Object.freeze([...new Set(services)].sort());
    }
}
