import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

import { ConfigLoader } from './config/config-loader.js';
import { EventBus } from './events/event-bus.js';
import { EvidenceGraph } from './graph/evidence-graph.js';
import { ProviderRegistry } from '../providers/provider-registry.js';
import { ToolRegistry } from '../tools/tool-registry.js';
import { ComponentRegistry } from './registry/component-registry.js';
import { CapabilityRegistry } from './registry/capability-registry.js';
import { OllamaProvider } from '../providers/adapters/ollama-provider.js';
import { RuntimeOrchestrator } from './integration/runtime-orchestrator.js';
import type { RuntimePipelineResult } from './integration/runtime-orchestrator.js';
import { RunManager } from './run-manager/run-manager.js';
import { PlannerRuntime } from './planner/planner-runtime.js';
import { ExecutionQueue } from './execution/execution-queue.js';
import { AgentRuntime } from './agents/agent-runtime.js';
import { AgentRegistry } from './registry/agent-registry.js';
import { ReviewerRuntime } from './reviewer/reviewer-runtime.js';
import { LifecycleManager } from './lifecycle/lifecycle-manager.js';
import { RuntimeKernel } from './kernel/runtime-kernel.js';
import { RepositoryScanner } from './extractors/repository-scanner.js';
import { PackageJsonExtractor } from './extractors/package-json-extractor.js';
import { TsConfigExtractor } from './extractors/tsconfig-extractor.js';
import { DockerfileExtractor } from './extractors/dockerfile-extractor.js';
import { ReadmeExtractor } from './extractors/readme-extractor.js';
import { TypeScriptAstExtractor } from './extractors/typescript-ast-extractor.js';
import { FrameworkDetector } from './extractors/framework-detector.js';
import { ArchitectureDetector } from './extractors/architecture-detector.js';
import { architectureAgentDefinition } from './agents/architecture-agent-definition.js';
import { dependencyAgentDefinition } from './agents/dependency-agent-definition.js';
import type { RunRecord } from './run-manager/run-record.js';
import type { GraphSnapshot } from './graph/graph-snapshot.js';

export interface AnalysisServiceOptions {
  readonly configPath?: string;
}

export interface AnalysisRunResult {
  readonly runId: string;
  readonly pipelineResult: RuntimePipelineResult;
  readonly graphSnapshot: GraphSnapshot;
}

/**
 * Application-level service that encapsulates the entire ArchMind runtime.
 *
 * Both the CLI and the HTTP server use this service to run analyses.
 * A single long-lived EvidenceGraph accumulates all run data with
 * run-scoped provenance. snapshot(runId) filters per-run views.
 */
export class AnalysisService {
  readonly #eventBus: EventBus;
  readonly #evidenceGraph: EvidenceGraph;
  readonly #providerRegistry: ProviderRegistry;
  readonly #toolRegistry: ToolRegistry;
  readonly #componentRegistry: ComponentRegistry;
  readonly #capabilityRegistry: CapabilityRegistry;
  readonly #agentRegistry: AgentRegistry;
  readonly #runManager: RunManager;
  readonly #orchestrator: RuntimeOrchestrator;
  #analyzing = false;

  constructor(options?: AnalysisServiceOptions) {
    const config = ConfigLoader.load(options?.configPath);

    this.#eventBus = new EventBus();
    this.#evidenceGraph = new EvidenceGraph();
    this.#providerRegistry = new ProviderRegistry();
    this.#toolRegistry = new ToolRegistry();
    this.#componentRegistry = new ComponentRegistry();
    this.#capabilityRegistry = new CapabilityRegistry({ componentRegistry: this.#componentRegistry });

    // Register provider
    this.#providerRegistry.register(new OllamaProvider());

    // Register agents
    this.#agentRegistry = new AgentRegistry();
    this.#agentRegistry.register('architecture-agent-1', architectureAgentDefinition);
    this.#agentRegistry.register('dependency-agent-1', dependencyAgentDefinition);

    // Register component descriptors
    this.#componentRegistry.register({
      id: 'architecture-agent-1',
      capability: 'ArchitectureAgent',
      version: '1.0.0',
      priority: 10,
      implementation: 'ignored',
      metadata: { name: 'ArchitectureAgent' },
    });

    this.#componentRegistry.register({
      id: 'dependency-agent-1',
      capability: 'DependencyAnalysis',
      version: '1.0.0',
      priority: 20,
      implementation: 'ignored',
      metadata: { name: 'DependencyAnalysisAgent' },
    });

    // Construct runtime services
    this.#runManager = new RunManager({
      eventBus: this.#eventBus,
      evidenceGraph: this.#evidenceGraph,
    });

    const plannerRuntime = new PlannerRuntime({
      evidenceGraph: this.#evidenceGraph,
      capabilityRegistry: this.#capabilityRegistry,
      eventBus: this.#eventBus,
    });

    const executionQueue = new ExecutionQueue({ eventBus: this.#eventBus });

    const agentRuntime = new AgentRuntime({
      evidenceGraph: this.#evidenceGraph,
      toolRegistry: this.#toolRegistry,
      providerRegistry: this.#providerRegistry,
    });

    const reviewerRuntime = new ReviewerRuntime({
      evidenceGraph: this.#evidenceGraph,
      eventBus: this.#eventBus,
    });

    this.#orchestrator = new RuntimeOrchestrator({
      runManager: this.#runManager,
      plannerRuntime,
      executionQueue,
      agentRuntime,
      capabilityRegistry: this.#capabilityRegistry,
      agentRegistry: this.#agentRegistry,
      reviewerRuntime,
      evidenceGraph: this.#evidenceGraph,
      eventBus: this.#eventBus,
    });

    // Boot the kernel
    const lifecycleManager = new LifecycleManager();
    const kernel = new RuntimeKernel({ lifecycleManager });
    kernel.boot();
  }

  /**
   * Run a full analysis pipeline on a local repository.
   *
   * The shared EvidenceGraph accumulates nodes/edges tagged with the
   * run's provenance. snapshot(runId) returns only that run's data.
   */
  async analyze(repositoryPath: string): Promise<AnalysisRunResult> {
    if (this.#analyzing) {
      throw new Error('An analysis is already in progress. Concurrent analysis is not supported.');
    }

    const targetPath = resolve(repositoryPath);
    if (!existsSync(targetPath)) {
      throw new Error(`The local repository path does not exist: ${targetPath}`);
    }

    this.#analyzing = true;

    try {
      const { runId } = this.#runManager.createRun();
      this.#runManager.resumeRun(runId);

      // Build scanner with all extractors
      const scanner = new RepositoryScanner();
      scanner.register(new PackageJsonExtractor());
      scanner.register(new TsConfigExtractor());
      scanner.register(new DockerfileExtractor());
      scanner.register(new ReadmeExtractor());
      scanner.register(new TypeScriptAstExtractor());
      scanner.register(new FrameworkDetector());
      scanner.register(new ArchitectureDetector());

      const scanResults = await scanner.scan(targetPath, runId);

      this.#evidenceGraph.apply({
        provenance: scanResults.provenance,
        nodes: scanResults.nodes,
        edges: scanResults.edges,
      });

      const pipelineResult = await this.#orchestrator.execute(runId);
      const graphSnapshot = this.#evidenceGraph.snapshot(runId);

      return Object.freeze({
        runId,
        pipelineResult,
        graphSnapshot,
      });
    } finally {
      this.#analyzing = false;
    }
  }

  /** Retrieve the graph snapshot for a specific run. */
  getGraph(runId: string): GraphSnapshot | undefined {
    if (!this.#runManager.hasRun(runId)) {
      return undefined;
    }
    return this.#evidenceGraph.snapshot(runId);
  }

  /** Retrieve the run record. */
  getRun(runId: string): RunRecord | undefined {
    return this.#runManager.getRun(runId);
  }

  /** List all known runs. */
  listRuns(): readonly RunRecord[] {
    return this.#runManager.listRuns();
  }

  /** The shared EvidenceGraph instance. Exposed for ReportGenerator compatibility. */
  get evidenceGraph(): EvidenceGraph {
    return this.#evidenceGraph;
  }

  /** Whether an analysis is currently running. */
  get analyzing(): boolean {
    return this.#analyzing;
  }
}
