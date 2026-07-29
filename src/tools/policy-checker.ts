import type { MetadataResult } from '../metadata/metadata-result.js';
import { deterministicToolConfidence, freezeToolValue, type ToolExecutionResult } from './tool-result.js';
import type { Tool } from './tool-contract.js';
import { validateAgainstSchema } from './tool-contract.js';
import type { ToolMetadata, ToolSchema } from './tool-metadata.js';

export type PolicySeverity = 'info' | 'warning' | 'error';

export interface PolicyFinding {
  readonly rule: string;
  readonly severity: PolicySeverity;
  readonly passed: boolean;
  readonly message: string;
}

export interface PolicyCheckResult {
  readonly compliant: boolean;
  readonly findings: readonly PolicyFinding[];
}

const inputSchema: ToolSchema = Object.freeze({
  title: 'MetadataResult',
  description: 'Repository metadata used for policy validation.',
  fields: Object.freeze({
    extractedAt: Object.freeze({ type: 'string', required: true }),
    summary: Object.freeze({ type: 'object', required: true }),
  }),
});

const outputSchema: ToolSchema = Object.freeze({
  title: 'PolicyCheckResult',
  description: 'Structured policy findings.',
  fields: Object.freeze({
    compliant: Object.freeze({ type: 'boolean', required: true }),
    findings: Object.freeze({ type: 'array', required: true, itemType: 'object' }),
  }),
});

export class PolicyChecker implements Tool<MetadataResult, PolicyCheckResult> {
  readonly metadata: ToolMetadata = Object.freeze({
    id: 'policy-checker@1.0.0',
    name: 'policy-checker',
    capability: 'policy.check',
    version: '1.0.0',
    inputSchema,
    outputSchema,
  });

  validate(input: unknown) {
    return validateAgainstSchema(input, this.metadata.inputSchema);
  }

  execute(input: MetadataResult): ToolExecutionResult<PolicyCheckResult> {
    const findings: PolicyFinding[] = [];
    const summary = input.summary;

    findings.push(this.#finding('metadata-exists', 'info', true, 'Repository metadata exists.'));
    findings.push(this.#finding('repository-root-valid', 'error', summary.repository.rootPath.length > 0, 'Repository root path is valid.'));
    findings.push(this.#finding('readme-present', 'warning', summary.files.some((file) => /(^|\/)README\.md$/i.test(file.relativePath)), 'README.md is present.'));
    findings.push(this.#finding('package-manager-present', 'warning', summary.packageManagers.length > 0, 'Package manager metadata is present.'));

    const unsupportedLanguage = summary.languages.find((language) => ['Java', 'Go', 'Rust'].includes(language.name));
    findings.push(this.#finding('unsupported-language', 'warning', unsupportedLanguage === undefined, unsupportedLanguage ? `Unsupported language detected: ${unsupportedLanguage.name}.` : 'No unsupported languages detected.'));

    const compliant = findings.every((finding) => finding.severity !== 'error' || finding.passed);

    const output = freezeToolValue({
      compliant,
      findings: [...findings].sort((left, right) => left.rule.localeCompare(right.rule)),
    });

    return freezeToolValue({
      toolId: this.metadata.id,
      toolName: this.metadata.name,
      capability: this.metadata.capability,
      version: this.metadata.version,
      output,
      evidence: {
        nodes: output.findings.map((finding) => ({
          id: `policy:${finding.rule}`,
          kind: 'policy-finding',
          label: finding.rule,
          value: finding,
          confidence: deterministicToolConfidence,
          provenance: [],
        })),
      },
    });
  }

  #finding(rule: string, severity: PolicySeverity, passed: boolean, message: string): PolicyFinding {
    return {
      rule,
      severity,
      passed,
      message,
    };
  }
}