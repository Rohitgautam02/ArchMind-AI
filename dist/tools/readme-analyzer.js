import fs from 'node:fs';
import path from 'node:path';
import { deterministicToolConfidence, freezeToolValue } from './tool-result.js';
import { validateAgainstSchema } from './tool-contract.js';
const inputSchema = Object.freeze({
    title: 'MetadataResult',
    description: 'Repository metadata used to locate README.md.',
    fields: Object.freeze({
        extractedAt: Object.freeze({ type: 'string', required: true }),
        summary: Object.freeze({ type: 'object', required: true }),
    }),
});
const outputSchema = Object.freeze({
    title: 'ReadmeAnalysisResult',
    description: 'Structured README analysis.',
    fields: Object.freeze({
        title: Object.freeze({ type: 'string', required: true }),
        sections: Object.freeze({ type: 'array', required: true, itemType: 'object' }),
        technologies: Object.freeze({ type: 'array', required: true, itemType: 'string' }),
        installationInstructions: Object.freeze({ type: 'array', required: true, itemType: 'string' }),
        usageSection: Object.freeze({ type: 'string', required: true }),
    }),
});
export class ReadmeAnalyzer {
    metadata = Object.freeze({
        id: 'readme-analyzer@1.0.0',
        name: 'readme-analyzer',
        capability: 'readme.analyze',
        version: '1.0.0',
        inputSchema,
        outputSchema,
    });
    validate(input) {
        return validateAgainstSchema(input, this.metadata.inputSchema);
    }
    execute(input) {
        const rootPath = input.summary.repository.rootPath;
        const readmePath = this.#findReadme(rootPath);
        const content = readmePath ? fs.readFileSync(readmePath, 'utf8') : '';
        const parsed = this.#parseReadme(content);
        const output = freezeToolValue(parsed);
        return freezeToolValue({
            toolId: this.metadata.id,
            toolName: this.metadata.name,
            capability: this.metadata.capability,
            version: this.metadata.version,
            output,
            evidence: {
                nodes: [
                    {
                        id: 'readme:title',
                        kind: 'readme',
                        label: parsed.title,
                        value: parsed,
                        confidence: deterministicToolConfidence,
                        provenance: [],
                    },
                ],
            },
        });
    }
    #findReadme(rootPath) {
        for (const fileName of ['README.md', 'readme.md', 'README.MD']) {
            const candidate = path.join(rootPath, fileName);
            if (fs.existsSync(candidate)) {
                return candidate;
            }
        }
        return undefined;
    }
    #parseReadme(content) {
        const lines = content.split(/\r?\n/);
        const title = this.#extractTitle(lines);
        const sections = this.#extractSections(lines);
        const technologies = this.#extractTechnologies(content);
        const installationInstructions = this.#extractInstallationInstructions(sections, content);
        const usageSection = this.#extractUsageSection(sections, content);
        return {
            title,
            sections,
            technologies,
            installationInstructions,
            usageSection,
        };
    }
    #extractTitle(lines) {
        const heading = lines.find((line) => /^#\s+/.test(line));
        return heading ? heading.replace(/^#\s+/, '').trim() : 'README';
    }
    #extractSections(lines) {
        const sections = [];
        let currentHeading = '';
        let currentLines = [];
        for (const line of lines) {
            const headingMatch = line.match(/^(#{2,3})\s+(.*)$/);
            if (headingMatch) {
                if (currentHeading) {
                    sections.push({ heading: currentHeading, content: currentLines.join('\n').trim() });
                }
                currentHeading = headingMatch[2].trim();
                currentLines = [];
                continue;
            }
            if (currentHeading) {
                currentLines.push(line);
            }
        }
        if (currentHeading) {
            sections.push({ heading: currentHeading, content: currentLines.join('\n').trim() });
        }
        return Object.freeze(sections.map((section) => ({ ...section })));
    }
    #extractTechnologies(content) {
        const candidates = ['TypeScript', 'JavaScript', 'Node.js', 'React', 'Next.js', 'Express', 'Vitest', 'Vite', 'Docker', 'PostgreSQL', 'Tailwind', 'NestJS'];
        const technologies = candidates.filter((candidate) => new RegExp(`\\b${candidate.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i').test(content));
        return Object.freeze([...new Set(technologies)].sort((left, right) => left.localeCompare(right)));
    }
    #extractInstallationInstructions(sections, content) {
        const installationSection = sections.find((section) => /installation/i.test(section.heading));
        const lines = (installationSection?.content ?? content)
            .split(/\r?\n/)
            .map((line) => line.trim())
            .filter((line) => /npm install|pnpm install|yarn install|bun install|pip install|cargo build/i.test(line));
        return Object.freeze([...new Set(lines)].sort((left, right) => left.localeCompare(right)));
    }
    #extractUsageSection(sections, content) {
        const usageSection = sections.find((section) => /usage|run|getting started/i.test(section.heading));
        if (usageSection) {
            return usageSection.content;
        }
        const commandLine = content
            .split(/\r?\n/)
            .map((line) => line.trim())
            .find((line) => /^npm run |^pnpm run |^yarn /.test(line));
        return commandLine ?? '';
    }
}
