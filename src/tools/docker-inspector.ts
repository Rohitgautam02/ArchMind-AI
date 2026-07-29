import fs from 'node:fs';
import path from 'node:path';
import type { MetadataResult } from '../metadata/metadata-result.js';
import { deterministicToolConfidence, freezeToolValue, type ToolExecutionResult } from './tool-result.js';
import type { Tool } from './tool-contract.js';
import { validateAgainstSchema } from './tool-contract.js';
import type { ToolMetadata, ToolSchema } from './tool-metadata.js';

export interface DockerfileMetadata {
  readonly path: string;
  readonly baseImages: readonly string[];
  readonly exposedPorts: readonly string[];
  readonly instructions: readonly string[];
}

export interface DockerComposeMetadata {
  readonly path: string;
  readonly services: readonly string[];
}

export interface DockerInspectionResult {
  readonly dockerfiles: readonly DockerfileMetadata[];
  readonly composeFiles: readonly DockerComposeMetadata[];
}

const inputSchema: ToolSchema = Object.freeze({
  title: 'MetadataResult',
  description: 'Repository metadata used to find Docker manifests.',
  fields: Object.freeze({
    extractedAt: Object.freeze({ type: 'string', required: true }),
    summary: Object.freeze({ type: 'object', required: true }),
  }),
});

const outputSchema: ToolSchema = Object.freeze({
  title: 'DockerInspectionResult',
  description: 'Structured Docker metadata.',
  fields: Object.freeze({
    dockerfiles: Object.freeze({ type: 'array', required: true, itemType: 'object' }),
    composeFiles: Object.freeze({ type: 'array', required: true, itemType: 'object' }),
  }),
});

export class DockerInspector implements Tool<MetadataResult, DockerInspectionResult> {
  readonly metadata: ToolMetadata = Object.freeze({
    id: 'docker-inspector@1.0.0',
    name: 'docker-inspector',
    capability: 'docker.inspect',
    version: '1.0.0',
    inputSchema,
    outputSchema,
  });

  validate(input: unknown) {
    return validateAgainstSchema(input, this.metadata.inputSchema);
  }

  execute(input: MetadataResult): ToolExecutionResult<DockerInspectionResult> {
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

  #inspectDockerfiles(rootPath: string): readonly DockerfileMetadata[] {
    const files = ['Dockerfile', 'docker/Dockerfile']
      .map((relativePath) => path.join(rootPath, relativePath))
      .filter((absolutePath) => fs.existsSync(absolutePath));

    return files.map((absolutePath) => {
      const lines = fs.readFileSync(absolutePath, 'utf8').split(/\r?\n/);
      const baseImages = lines
        .map((line: string) => line.trim())
        .filter((line: string) => line.toUpperCase().startsWith('FROM '))
        .map((line: string) => line.slice(5).trim().split(/\s+/)[0] ?? '');
      const exposedPorts = lines
        .map((line: string) => line.trim())
        .filter((line: string) => line.toUpperCase().startsWith('EXPOSE '))
        .flatMap((line: string) => line.slice(7).trim().split(/\s+/))
        .filter(Boolean);

      return {
        path: path.relative(rootPath, absolutePath),
        baseImages: Object.freeze([...new Set(baseImages)].sort()),
        exposedPorts: Object.freeze([...new Set(exposedPorts)].sort()),
        instructions: Object.freeze(lines.map((line: string) => line.trim()).filter(Boolean)),
      };
    }).sort((left, right) => left.path.localeCompare(right.path));
  }

  #inspectComposeFiles(rootPath: string): readonly DockerComposeMetadata[] {
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

  #extractComposeServices(content: string): readonly string[] {
    const lines = content.split(/\r?\n/);
    const services: string[] = [];
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