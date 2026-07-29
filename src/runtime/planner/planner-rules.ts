export interface PlannerRule {
  readonly targetCapability: string;
  readonly requiredEvidenceKinds: string[];
  readonly producedEvidenceKinds: string[];
  readonly priority: number;
}

export const defaultPlannerRules: PlannerRule[] = [
  {
    targetCapability: 'ArchitectureAgent',
    requiredEvidenceKinds: [
      'metadata:repository',
      'framework:frontend',
      'framework:backend',
      'ast:class',
      'metadata:package-json'
    ],
    producedEvidenceKinds: [
      'ArchitectureDetected',
      'ModuleBoundaryDetected'
    ],
    priority: 10,
  }
];
