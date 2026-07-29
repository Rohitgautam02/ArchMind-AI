import { ZodError } from 'zod';
import { zodToJsonSchema } from 'zod-to-json-schema';
export class AgentRuntime {
    #evidenceGraph;
    #toolRegistry;
    #providerRegistry;
    constructor(dependencies) {
        this.#evidenceGraph = dependencies.evidenceGraph;
        this.#toolRegistry = dependencies.toolRegistry;
        this.#providerRegistry = dependencies.providerRegistry;
    }
    async execute(input) {
        const context = {
            runId: input.runId,
            workItem: input.workItem,
            graphSnapshot: this.#evidenceGraph.snapshot(input.runId),
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
            let resultObject;
            if (sufficient) {
                // Just bypass LLM and map tool results
                resultObject = {};
            }
            else {
                const systemPrompt = input.agentDefinition.buildSystemPrompt(context, toolResults);
                const userPrompt = input.agentDefinition.buildUserPrompt(context, toolResults);
                const provider = this.#providerRegistry.resolve(); // use default
                const jsonSchema = zodToJsonSchema(input.agentDefinition.outputSchema, 'OutputSchema');
                const expectedSchema = jsonSchema.definitions?.['OutputSchema'] ?? jsonSchema;
                const response = await provider.invoke({
                    model: provider.defaultModel,
                    systemPrompt,
                    userPrompt,
                    expectedSchema: expectedSchema,
                });
                resultObject = input.agentDefinition.outputSchema.parse(response.result);
            }
            // Output mapping
            const agentOutput = input.agentDefinition.mapToEvidence(resultObject, context, toolResults);
            const provenance = {
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
        }
        catch (error) {
            return {
                runId: input.runId,
                workItemId: input.workItem.id,
                agentId: input.agentId,
                status: 'failure',
                evidenceIds: [],
                error: error instanceof ZodError
                    ? `ValidationError: ${error.errors.map((e) => `${e.path.join('.')}: ${e.message}`).join(', ')}`
                    : (error instanceof Error ? error.message : String(error)),
            };
        }
    }
}
