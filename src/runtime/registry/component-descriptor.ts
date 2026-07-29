export type ComponentImplementationReference = unknown;

export interface ComponentDescriptor {
  readonly id: string;
  readonly capability: string;
  readonly version: string;
  readonly priority: number;
  readonly implementation: ComponentImplementationReference;
  readonly metadata: Readonly<Record<string, unknown>>;
}

export interface ComponentDescriptorInput {
  readonly id: string;
  readonly capability: string;
  readonly version: string;
  readonly priority: number;
  readonly implementation: ComponentImplementationReference;
  readonly metadata?: Readonly<Record<string, unknown>>;
}