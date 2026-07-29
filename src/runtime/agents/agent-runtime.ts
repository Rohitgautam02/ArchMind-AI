import { z, ZodError } from 'zod';
import type { ToolExecutionResult } from '../../tools/tool-result.js';
import type { ProviderRegistry } from '../../providers/provider-registry.js';
import type { ToolRegistry } from '../../tools/tool-registry.js';
import type { EvidenceGraph } from '../graph/evidence-graph.js';
import type { QueueItem } from '../execution/queue-item.js';
import type { EvidenceNode, GraphSnapshot, Provenance } from '../contracts.js';
import { deterministicToolConfidence } from '../../tools/tool-result.js';
import { zodToJsonSchema } from 'zod-to-json-schema';

export interface AgentContext {
  readonly runId: string;
  readonly workItem: QueueItem;
  readonly graphSnapshot: GraphSnapshot;
  readonly tools: ToolRegistry;
  readonly providers: ProviderRegistry;
}

export interface AgentOutput<TOutput = unknown> {
  readonly confidence: number;
  readonly generatedEvidenceLabels: readonly string[];
  readonly nodes: readonly EvidenceNode[];
}

export interface AgentDefinition<TOutput = unknown> {
  readonly outputSchema: z.ZodType<TOutput>;
  readonly requiredEvidence: readonly string[];
  readonly producedEvidence: readonly string[];

  invokeTools?(context: AgentContext): Promise<readonly ToolExecutionResult[]>;
  isDeterministicEvidenceSufficient?(context: AgentContext, toolResults: readonly ToolExecutionResult[]): boolean;
  buildSystemPrompt(context: AgentContext, toolResults: readonly ToolExecutionResult[]): string;
  buildUserPrompt(context: AgentContext, toolResults: readonly ToolExecutionResult[]): string;
  mapToEvidence(result: TOutput, context: AgentContext, toolResults: readonly ToolExecutionResult[]): AgentOutput<TOutput>;
}

export interface AgentRuntimeDependencies {
  readonly evidenceGraph: EvidenceGraph;
  readonly toolRegistry: ToolRegistry;
  readonly providerRegistry: ProviderRegistry;
}

export interface AgentExecutionInput<TOutput = unknown> {
  readonly runId: string;
  readonly workItem: QueueItem;
  readonly agentDefinition: AgentDefinition<TOutput>;
  readonly agentId: string;
  readonly agentVersion: string;
}

export interface AgentExecutionResult {
  readonly runId: string;
  readonly workItemId: string;
  readonly agentId: string;
  readonly status: 'success' | 'failure';
  readonly evidenceIds: readonly string[];
  readonly error?: string;
  readonly confidence?: number;
  readonly generatedEvidenceLabels?: readonly string[];
}

export class AgentRuntime {
  readonly #evidenceGraph: EvidenceGraph;
  readonly #toolRegistry: ToolRegistry;
  readonly #providerRegistry: ProviderRegistry;

  constructor(dependencies: AgentRuntimeDependencies) {
    this.#evidenceGraph = dependencies.evidenceGraph;
    this.#toolRegistry = dependencies.toolRegistry;
    this.#providerRegistry = dependencies.providerRegistry;
  }

  async execute<TOutput>(input: AgentExecutionInput<TOutput>): Promise<AgentExecutionResult> {
    const context: AgentContext = {
      runId: input.runId,
      workItem: input.workItem,
      graphSnapshot: this.#evidenceGraph.snapshot(input.runId) as any,
      tools: this.#toolRegistry,
      providers: this.#providerRegistry,
    };

    try {
      const toolResults = input.agentDefinition.invokeTools
        ? await input.agentDefinition.invokeTools(context)
        : [];

      const sufficient = input.agentDefinition.isDeterministicEvidenceSufficient
        ? input.agentDefinition.isDeterministicEvidenceSufficient(context, toolResults)
        : false;

      let resultObject: TOutput;

      if (sufficient) {
        // Just bypass LLM and map tool results
        resultObject = {} as TOutput; 
      } else {
        const systemPrompt = input.agentDefinition.buildSystemPrompt(context, toolResults);
        const userPrompt = input.agentDefinition.buildUserPrompt(context, toolResults);
        const provider = this.#providerRegistry.resolve(); // use default

        const jsonSchema = zodToJsonSchema(input.agentDefinition.outputSchema as any, 'OutputSchema');
        const expectedSchema = (jsonSchema as any).definitions?.['OutputSchema'] ?? jsonSchema;

        const response = await provider.invoke({
          model: provider.defaultModel,
          systemPrompt,
          userPrompt,
          expectedSchema: expectedSchema as any,
        });

        resultObject = input.agentDefinition.outputSchema.parse(response.result);
      }

      // Output mapping
      const agentOutput = input.agentDefinition.mapToEvidence(resultObject, context, toolResults);

      const provenance: Provenance = {
        sourceType: 'provider',
        sourceId: input.agentId,
        sourceVersion: input.agentVersion,
        createdAt: new Date().toISOString(),
        runId: input.runId,
        external: false,
      };

      const nodesWithProvenance = agentOutput.nodes.map(node => ({
        ...node,
        provenance: [provenance],
      }));

      this.#evidenceGraph.apply({
        provenance,
        nodes: nodesWithProvenance,
      });

      return {
        runId: input.runId,
        workItemId: input.workItem.id,
        agentId: input.agentId,
        status: 'success',
        evidenceIds: nodesWithProvenance.map(n => n.id),
        confidence: agentOutput.confidence,
        generatedEvidenceLabels: agentOutput.generatedEvidenceLabels,
      };
    } catch (error) {
      return {
        runId: input.runId,
        workItemId: input.workItem.id,
        agentId: input.agentId,
        status: 'failure',
        evidenceIds: [],
        error: error instanceof ZodError 
          ? `ValidationError: ${(error as any).errors.map((e: any) => `${e.path.join('.')}: ${e.message}`).join(', ')}` 
          : (error instanceof Error ? error.message : String(error)),
      };
    }
  }
}
