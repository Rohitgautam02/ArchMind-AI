/**
 * ArchMind AI - Runtime Contracts
 * 
 * IMPORTANT NOTE: 
 * This file contains the architectural interface specifications designed during Milestone 3/4. 
 * It serves as the target blueprint for the event-driven metadata architecture.
 * 
 * In practice, concrete implementations in src/runtime/* may differ slightly as they evolved 
 * pragmatically (e.g., synchronous vs asynchronous, type naming differences). 
 * Where a concrete implementation diverges (e.g. ComponentRegistry, EventBus), the concrete 
 * implementation's types take precedence.
 */

export interface RuntimeMetadata {
  readonly runId: string;
  readonly tenantId?: string;
  readonly workspaceId: string;
  readonly timestamp: string;
  readonly version: string;
}

export interface Confidence {
  readonly score: number;
  readonly rationale?: string;
  readonly threshold?: number;
  readonly source: 'tool' | 'provider' | 'derived' | 'reviewer';
}

export interface Provenance {
  readonly sourceType: 'metadata' | 'tool' | 'provider' | 'review' | 'memory';
  readonly sourceId: string;
  readonly sourceVersion?: string;
  readonly createdAt: string;
  readonly runId: string;
  readonly external: boolean;
  readonly supportingEvidenceIds?: readonly string[];
}

export interface EvidenceNode {
  readonly id: string;
  readonly kind: string;
  readonly label: string;
  readonly value?: unknown;
  readonly confidence: Confidence;
  readonly provenance: readonly Provenance[];
}

export interface EvidenceEdge {
  readonly id: string;
  readonly from: string;
  readonly to: string;
  readonly relation: string;
  readonly confidence: Confidence;
  readonly provenance: readonly Provenance[];
}

export interface DerivedFact {
  readonly id: string;
  readonly statement: string;
  readonly confidence: Confidence;
  readonly evidenceIds: string[];
  readonly provenance: Provenance[];
}

export interface Conflict {
  readonly id: string;
  readonly subjectId: string;
  readonly summary: string;
  readonly severity: 'low' | 'medium' | 'high' | 'critical';
  readonly evidenceIds: string[];
  readonly provenance: Provenance[];
}

export interface Hypothesis {
  readonly id: string;
  readonly statement: string;
  readonly confidence: Confidence;
  readonly supportingEvidenceIds: string[];
  readonly missingEvidenceIds: string[];
}

export interface GraphUpdate {
  readonly nodes?: readonly EvidenceNode[];
  readonly edges?: readonly EvidenceEdge[];
  readonly derivedFacts?: readonly DerivedFact[];
  readonly conflicts?: readonly Conflict[];
  readonly hypotheses?: readonly Hypothesis[];
  readonly provenance: Provenance;
}

export interface GraphSnapshot {
  readonly runId: string;
  readonly nodes: readonly EvidenceNode[];
  readonly edges: readonly EvidenceEdge[];
  readonly derivedFacts: readonly DerivedFact[];
  readonly conflicts: readonly Conflict[];
  readonly hypotheses: readonly Hypothesis[];
  readonly createdAt: string;
}

export interface ToolDescriptor {
  readonly name: string;
  readonly version: string;
  readonly capability: string;
  readonly inputSchema: Record<string, unknown>;
  readonly outputSchema: Record<string, unknown>;
  readonly environment?: Readonly<Record<string, string>>;
}

export interface ToolInvocationResult<TOutput = unknown> {
  readonly toolName: string;
  readonly toolVersion: string;
  readonly success: boolean;
  readonly output?: TOutput;
  readonly confidence?: Confidence;
  readonly provenance: Provenance;
  readonly error?: RuntimeErrorShape;
}

export interface RuntimeErrorShape {
  readonly code: string;
  readonly message: string;
  readonly retryable: boolean;
  readonly details?: Record<string, unknown>;
}

export interface AgentMetadata {
  readonly name: string;
  readonly version: string;
  readonly role: string;
  readonly description: string;
}

export interface AgentCapability {
  readonly id: string;
  readonly description: string;
  readonly priority: number;
}

export interface AgentContract<TInput = unknown, TOutput = unknown> {
  readonly metadata: AgentMetadata;
  readonly capabilities: readonly AgentCapability[];
  readonly requiredEvidence: readonly string[];
  readonly producedEvidence: readonly string[];
  readonly supportedTools: readonly string[];
  readonly executionPriority: number;
  readonly timeoutMs: number;
  readonly retryPolicy: RetryPolicy;
  readonly inputSchema: Record<string, unknown>;
  readonly outputSchema: Record<string, unknown>;
  readonly validationRules: readonly ValidationRule[];
  readonly execute: AgentExecutor<TInput, TOutput>;
}

export interface ValidationRule {
  readonly id: string;
  readonly description: string;
  readonly severity: 'info' | 'warning' | 'error';
}

export interface RetryPolicy {
  readonly maxAttempts: number;
  readonly backoffMs: number;
  readonly retryableErrorCodes: readonly string[];
}

export interface PlannerInput {
  readonly metadata: RuntimeMetadata;
  readonly evidenceGraph: GraphSnapshot;
  readonly availableAgents: readonly AgentContract[];
  readonly availableTools: readonly ToolDescriptor[];
}

export interface PlannerDecision {
  readonly hypotheses: readonly Hypothesis[];
  readonly requiredAgents: readonly string[];
  readonly requiredTools: readonly string[];
  readonly needsAnotherPass: boolean;
  readonly confidence: Confidence;
  readonly rationale: string;
}

export interface PlannerRuntime {
  plan(input: PlannerInput): Promise<PlannerDecision>;
  revisePlan(input: PlannerInput): Promise<PlannerDecision>;
  recordDecision(runId: string, decision: PlannerDecision): Promise<void>;
}

export interface AgentExecutionContext {
  readonly metadata: RuntimeMetadata;
  readonly evidenceGraph: GraphSnapshot;
  readonly tools: readonly ToolDescriptor[];
  readonly provider: ProviderRequestContext;
}

export interface AgentExecutor<TInput = unknown, TOutput = unknown> {
  (input: TInput, context: AgentExecutionContext): Promise<TOutput>;
}

export interface AgentRuntime {
  execute<TInput, TOutput>(contract: AgentContract<TInput, TOutput>, input: TInput): Promise<AgentExecutionResult<TOutput>>;
  cancel(runId: string): Promise<void>;
}

export interface AgentExecutionResult<TOutput = unknown> {
  readonly output: TOutput;
  readonly confidence: Confidence;
  readonly evidence: GraphUpdate;
  readonly validation: readonly ValidationRule[];
  readonly provenance: Provenance[];
}

export interface QueueItem {
  readonly id: string;
  readonly agentName: string;
  readonly dependsOn: readonly string[];
  readonly priority: number;
}

export interface ExecutionQueue {
  enqueue(item: QueueItem): Promise<void>;
  dequeue(runId: string): Promise<QueueItem | undefined>;
  dispatch(runId: string): Promise<void>;
  cancel(runId: string): Promise<void>;
}

export type RuntimeEventType =
  | 'RunCreated'
  | 'RunResumed'
  | 'RunCancelled'
  | 'RunStarted'
  | 'PlannerStarted'
  | 'PlanCreated'
  | 'QueueStarted'
  | 'WorkQueued'
  | 'WorkDequeued'
  | 'QueueCompleted'
  | 'QueueCancelled'
  | 'HypothesisCreated'
  | 'EvidenceAdded'
  | 'ToolInvoked'
  | 'ToolCompleted'
  | 'AgentStarted'
  | 'AgentCompleted'
  | 'AgentFailed'
  | 'ReviewerRequested'
  | 'ReviewerRejected'
  | 'ReviewerReanalysisRequested'
  | 'ReviewerApproved'
  | 'ReportGenerated'
  | 'RunCompleted';

export interface RuntimeEvent<TType extends RuntimeEventType = RuntimeEventType, TPayload = unknown> {
  readonly type: TType;
  readonly metadata: RuntimeMetadata;
  readonly payload: TPayload;
  readonly emittedAt: string;
}

export type EventHandler<TType extends RuntimeEventType = RuntimeEventType> = (
  event: RuntimeEvent<TType>,
) => void | Promise<void>;

export interface EventBus {
  publish<TType extends RuntimeEventType, TPayload>(event: RuntimeEvent<TType, TPayload>): void;
  subscribe<TType extends RuntimeEventType>(type: TType, handler: EventHandler<TType>): () => void;
  unsubscribe<TType extends RuntimeEventType>(type: TType, handler: EventHandler<TType>): void;
  history(): readonly RuntimeEvent[];
  replay(runId: string): AsyncIterable<RuntimeEvent>;
  clear(): void;
}

export interface ToolRegistry {
  register(descriptor: ToolDescriptor): Promise<void>;
  discover(query?: ToolDiscoveryQuery): Promise<readonly ToolDescriptor[]>;
  resolve(name: string, version?: string): Promise<ToolDescriptor | undefined>;
}

export interface ToolDiscoveryQuery {
  readonly capability?: string;
  readonly version?: string;
  readonly environment?: Readonly<Record<string, string>>;
}

export interface ProviderRequestContext {
  readonly metadata: RuntimeMetadata;
  readonly schema: Record<string, unknown>;
  readonly streaming: boolean;
}

export interface ProviderResponseChunk {
  readonly provider: string;
  readonly content: string;
  readonly done: boolean;
  readonly emittedAt: string;
}

export interface ProviderResponse<TOutput = unknown> {
  readonly provider: string;
  readonly output: TOutput;
  readonly confidence: Confidence;
  readonly provenance: Provenance;
}

export interface ProviderAdapter {
  generate<TOutput = unknown>(context: ProviderRequestContext): Promise<ProviderResponse<TOutput>>;
  stream(context: ProviderRequestContext): AsyncIterable<ProviderResponseChunk>;
  healthCheck(): Promise<boolean>;
}

export interface ReviewerInput {
  readonly metadata: RuntimeMetadata;
  readonly evidenceGraph: GraphSnapshot;
  readonly agentResults: readonly AgentExecutionResult[];
  readonly plannerDecision: PlannerDecision;
}

export interface ReviewerDecision {
  readonly approved: boolean;
  readonly confidence: Confidence;
  readonly contradictions: readonly Conflict[];
  readonly missingEvidence: readonly string[];
  readonly reanalysisRequired: boolean;
  readonly rationale: string;
}

export interface ReviewerRuntime {
  review(input: ReviewerInput): Promise<ReviewerDecision>;
}

export interface RunMemorySnapshot {
  readonly runId: string;
  readonly summary: string;
  readonly deltas: readonly string[];
  readonly trendSignals: readonly string[];
  readonly decisionLog: readonly RuntimeEvent[];
}

export interface RunMemory {
  store(snapshot: RunMemorySnapshot): Promise<void>;
  load(runId: string): Promise<RunMemorySnapshot | undefined>;
  compare(currentRunId: string, previousRunId: string): Promise<readonly string[]>;
}

export interface AnalysisStateMachine {
  readonly state: RuntimeState;
  transition(next: RuntimeState): Promise<void>;
}

export type RuntimeState =
  | 'Idle'
  | 'Planning'
  | 'Evidence Collection'
  | 'Tool Execution'
  | 'Agent Execution'
  | 'Review'
  | 'Approved'
  | 'Report'
  | 'Completed';

export interface RuntimeKernelServices {
  readonly planner: PlannerRuntime;
  readonly agentRuntime: AgentRuntime;
  readonly executionQueue: ExecutionQueue;
  readonly eventBus: EventBus;
  readonly evidenceGraph: EvidenceGraphRuntime;
  readonly toolRegistry: ToolRegistry;
  readonly providerAdapter: ProviderAdapter;
  readonly reviewerRuntime: ReviewerRuntime;
  readonly runMemory: RunMemory;
}

export interface EvidenceGraphRuntime {
  apply(update: GraphUpdate): Promise<void>;
  merge(snapshot: GraphSnapshot): Promise<void>;
  resolveConflict(conflictId: string): Promise<void>;
  snapshot(runId: string): Promise<GraphSnapshot>;
}

export interface RuntimeBootstrapInput {
  readonly metadata: RuntimeMetadata;
  readonly configuration: RuntimeConfiguration;
  readonly policies: PolicyBundle;
  readonly components: ComponentRegistryManifest;
  readonly dependencies: RuntimeDependencyMap;
}

export interface RuntimeConfiguration {
  readonly environment: 'local' | 'hybrid' | 'remote';
  readonly mode: 'development' | 'test' | 'production';
  readonly maxConcurrentRuns: number;
  readonly enableReplay: boolean;
  readonly enableWarmup: boolean;
}

export interface RuntimeContext {
  readonly metadata: RuntimeMetadata;
  readonly eventBus: EventBus;
  readonly evidenceGraph: EvidenceGraphRuntime;
  readonly providers: ProviderRegistry;
  readonly tools: ToolRegistry;
  readonly policies: PolicyBundle;
  readonly memory: RunMemory;
  readonly configuration: RuntimeConfiguration;
  readonly componentRegistry: ComponentRegistry;
  readonly capabilityRegistry: CapabilityRegistry;
  readonly stateMachine: AnalysisStateMachine;
}

export type RegisteredComponentKind = 'agent' | 'provider' | 'tool' | 'policy' | 'reviewer' | 'planner';

export interface ComponentDescriptor {
  readonly kind: RegisteredComponentKind;
  readonly name: string;
  readonly version: string;
  readonly capabilities: readonly string[];
  readonly priority: number;
  readonly fallbackOf?: string;
  readonly metadata: Record<string, unknown>;
}

export interface ComponentRegistryManifest {
  readonly components: readonly ComponentDescriptor[];
}

export interface ComponentRegistry {
  register(component: ComponentDescriptor): Promise<void>;
  discover(query?: ComponentDiscoveryQuery): Promise<readonly ComponentDescriptor[]>;
  resolveCapability(capability: string, version?: string): Promise<ComponentDescriptor | undefined>;
}

export interface ComponentDiscoveryQuery {
  readonly kind?: RegisteredComponentKind;
  readonly capability?: string;
  readonly version?: string;
  readonly minimumPriority?: number;
}

export interface CapabilityRegistry {
  request(capability: string, options?: CapabilityRequestOptions): Promise<ComponentDescriptor | undefined>;
  list(capability?: string): Promise<readonly ComponentDescriptor[]>;
}

export interface CapabilityRequestOptions {
  readonly version?: string;
  readonly allowFallback?: boolean;
  readonly minimumPriority?: number;
  readonly preferredKinds?: readonly RegisteredComponentKind[];
}

export interface ProviderRegistry {
  register(provider: ProviderDescriptor): Promise<void>;
  discover(query?: ProviderDiscoveryQuery): Promise<readonly ProviderDescriptor[]>;
  resolve(name: string, version?: string): Promise<ProviderDescriptor | undefined>;
}

export interface ProviderDescriptor {
  readonly name: string;
  readonly version: string;
  readonly capabilities: readonly string[];
  readonly priority: number;
  readonly supportsStreaming: boolean;
  readonly supportsStructuredOutput: boolean;
}

export interface ProviderDiscoveryQuery {
  readonly capability?: string;
  readonly version?: string;
  readonly supportsStreaming?: boolean;
  readonly supportsStructuredOutput?: boolean;
}

export interface RuntimeDependencyMap {
  readonly [key: string]: unknown;
}

export interface PolicyBundle {
  readonly privacy: PrivacyPolicy;
  readonly retry: RuntimeRetryPolicy;
  readonly providerSelection: ProviderSelectionPolicy;
  readonly security: SecurityPolicy;
  readonly review: ReviewPolicy;
  readonly execution: ExecutionPolicy;
}

export interface BasePolicy {
  readonly name: string;
  readonly version: string;
  readonly description: string;
}

export interface PrivacyPolicy extends BasePolicy {
  readonly allowExternalCodeTransfer: boolean;
  readonly allowedDataClasses: readonly string[];
}

export interface RuntimeRetryPolicy extends BasePolicy {
  readonly maxAttempts: number;
  readonly backoffMs: number;
  readonly retryableErrorCodes: readonly string[];
}

export interface ProviderSelectionPolicy extends BasePolicy {
  readonly allowedProviders: readonly string[];
  readonly fallbackOrder: readonly string[];
}

export interface SecurityPolicy extends BasePolicy {
  readonly requireSanitizedMetadata: boolean;
  readonly blockUnsafeProviders: boolean;
}

export interface ReviewPolicy extends BasePolicy {
  readonly minimumConfidence: number;
  readonly requireEvidenceThreshold: number;
}

export interface ExecutionPolicy extends BasePolicy {
  readonly allowParallelExecution: boolean;
  readonly allowPartialSuccess: boolean;
  readonly maxConcurrentAgents: number;
}

/**
 * @deprecated Use the concrete RuntimeState enum in src/runtime/lifecycle/runtime-state.ts
 */
export type KernelLifecycleStateOld = 'Boot' | 'Initialize' | 'RegisterComponents' | 'WarmUp' | 'Ready' | 'Running' | 'Stopping' | 'Stopped';

export interface KernelLifecycleTransition {
  readonly from: KernelLifecycleStateOld;
  readonly to: KernelLifecycleStateOld;
  readonly reason: string;
  readonly recoverable: boolean;
}

export interface KernelLifecycle {
  readonly state: KernelLifecycleStateOld;
  readonly history: readonly KernelLifecycleTransition[];
}

export interface RuntimeKernelInput {
  readonly context: RuntimeContext;
  readonly kernelLifecycle: KernelLifecycle;
}

export interface RuntimeKernel {
  boot(input: RuntimeKernelInput): Promise<void>;
  initialize(input: RuntimeKernelInput): Promise<void>;
  registerComponents(input: RuntimeKernelInput): Promise<void>;
  warmUp(input: RuntimeKernelInput): Promise<void>;
  start(input: RuntimeKernelInput): Promise<void>;
  stop(input: RuntimeKernelInput): Promise<void>;
  restart(input: RuntimeKernelInput): Promise<void>;
}

export interface RunManagerInput {
  readonly context: RuntimeContext;
  readonly policyBundle: PolicyBundle;
}

export interface RunCreationRequest {
  readonly label?: string;
  readonly resumeFromRunId?: string;
  readonly metadata: RuntimeMetadata;
}

export interface RunManager {
  createRun(input: RunCreationRequest): Promise<RuntimeMetadata>;
  resumeRun(runId: string): Promise<RuntimeMetadata | undefined>;
  cancelRun(runId: string): Promise<void>;
  replayRun(runId: string): Promise<RunMemorySnapshot | undefined>;
}

export interface DependencyInjectionGraph {
  readonly root: string;
  readonly nodes: readonly DependencyInjectionNode[];
}

export interface DependencyInjectionNode {
  readonly id: string;
  readonly kind: RegisteredComponentKind | 'runtime' | 'memory' | 'state';
  readonly dependencies: readonly string[];
}

export interface DependencyInjectionPlan {
  readonly graph: DependencyInjectionGraph;
  readonly bootOrder: readonly string[];
}

export interface DependencyInjector {
  resolve<T>(token: string): T;
  register<T>(token: string, value: T): void;
  createPlan(context: RuntimeContext): DependencyInjectionPlan;
}

export type KernelLifecycleState = 'BOOTING' | 'INITIALIZING' | 'READY' | 'RUNNING' | 'STOPPING' | 'STOPPED' | 'FAILED';

export interface LifecycleTransition {
  readonly from: KernelLifecycleState;
  readonly to: KernelLifecycleState;
  readonly timestamp: string;
}

export interface LifecycleManagerContract {
  currentState(): KernelLifecycleState;
  canTransition(nextState: KernelLifecycleState): boolean;
  transition(nextState: KernelLifecycleState): void;
  history(): readonly LifecycleTransition[];
}

export interface RuntimeKernelDependencies {
  readonly lifecycleManager: LifecycleManagerContract;
}