#!/usr/bin/env node
import { parseArgs } from 'util';
import * as path from 'path';
import { ConfigLoader } from '../runtime/config/config-loader.js';
import { RuntimeKernel } from '../runtime/kernel/runtime-kernel.js';
import { EventBus } from '../runtime/events/event-bus.js';
import { EvidenceGraph } from '../runtime/graph/evidence-graph.js';
import { ProviderRegistry } from '../providers/provider-registry.js';
import { ToolRegistry } from '../tools/tool-registry.js';
import { PolicyChecker } from '../tools/policy-checker.js';
import { AnalysisStateMachine } from '../runtime/state/analysis-state-machine.js';
import { ComponentRegistry } from '../runtime/registry/component-registry.js';
import { CapabilityRegistry } from '../runtime/registry/capability-registry.js';
import { OllamaProvider } from '../providers/adapters/ollama-provider.js';
import { RuntimeOrchestrator } from '../runtime/integration/runtime-orchestrator.js';
import { RunManager } from '../runtime/run-manager/run-manager.js';
import { PlannerRuntime } from '../runtime/planner/planner-runtime.js';
import { ExecutionQueue } from '../runtime/execution/execution-queue.js';
import { AgentRuntime } from '../runtime/agents/agent-runtime.js';
import { AgentRegistry } from '../runtime/registry/agent-registry.js';
import { ReviewerRuntime } from '../runtime/reviewer/reviewer-runtime.js';
import { StructuredLogger } from '../runtime/logging/structured-logger.js';
import { architectureAgentDefinition } from '../runtime/agents/architecture-agent-definition.js';
import { ReportGenerator } from '../runtime/reporting/report-generator.js';
import { LifecycleManager } from '../runtime/lifecycle/lifecycle-manager.js';
async function main() {
    const { values, positionals } = parseArgs({
        args: process.argv.slice(2),
        options: {
            config: {
                type: 'string',
                short: 'c',
            },
            output: {
                type: 'string',
                short: 'o',
                default: 'archmind-report.md',
            }
        },
        allowPositionals: true,
    });
    const command = positionals[0];
    const targetPath = positionals[1] ? path.resolve(process.cwd(), positionals[1]) : process.cwd();
    if (command !== 'analyze') {
        console.error('Usage: archmind analyze <path> [--config <file>] [--output <file>]');
        process.exit(1);
    }
    try {
        const config = ConfigLoader.load(values.config);
        const eventBus = new EventBus();
        const evidenceGraph = new EvidenceGraph();
        const providerRegistry = new ProviderRegistry();
        const toolRegistry = new ToolRegistry();
        const policyChecker = new PolicyChecker();
        const memory = new Map();
        const componentRegistry = new ComponentRegistry();
        const capabilityRegistry = new CapabilityRegistry({ componentRegistry });
        const stateMachine = new AnalysisStateMachine({ eventBus });
        const logger = new StructuredLogger({ eventBus });
        logger.start();
        // Register basic Ollama provider
        providerRegistry.register(new OllamaProvider());
        const agentRegistry = new AgentRegistry();
        agentRegistry.register('architecture-agent-1', architectureAgentDefinition);
        componentRegistry.register({
            id: 'architecture-agent-1',
            capability: 'ArchitectureAgent',
            version: '1.0.0',
            priority: 10,
            implementation: 'ignored',
            metadata: { name: 'ArchitectureAgent' },
        });
        const runManager = new RunManager({ eventBus, evidenceGraph });
        const plannerRuntime = new PlannerRuntime({ evidenceGraph, capabilityRegistry, eventBus });
        const executionQueue = new ExecutionQueue({ eventBus });
        const agentRuntime = new AgentRuntime({ evidenceGraph, toolRegistry, providerRegistry });
        const reviewerRuntime = new ReviewerRuntime({ evidenceGraph, eventBus });
        const orchestrator = new RuntimeOrchestrator({
            runManager,
            plannerRuntime,
            executionQueue,
            agentRuntime,
            capabilityRegistry,
            agentRegistry,
            reviewerRuntime,
            evidenceGraph,
            eventBus,
        });
        const lifecycleManager = new LifecycleManager();
        const kernel = new RuntimeKernel({
            lifecycleManager,
        });
        kernel.boot();
        // In a full implementation, a MetadataExtractor would run here.
        // We will manually inject the repository metadata node for now to trigger the ArchitectureAgent.
        evidenceGraph.apply({
            provenance: {
                sourceType: 'metadata',
                sourceId: 'cli',
                sourceVersion: '0.1.0',
                createdAt: new Date().toISOString(),
                runId: 'system',
                external: false,
            },
            nodes: [
                {
                    id: 'repo-1',
                    kind: 'metadata:repository',
                    label: targetPath,
                    confidence: { score: 1.0, source: 'tool' },
                    provenance: [],
                }
            ]
        });
        // We manually resume the run because createRun doesn't start it, and orchestrator creates a new run inside execute().
        // Wait, RuntimeOrchestrator.execute() creates a new run internally!
        // So we shouldn't create a run above, we need to pass the repo data into the orchestrator or graph directly and let orchestrator pick it up.
        // Actually, orchestrator in execute() currently does:
        // const { runId } = this.#runManager.createRun();
        // this.#runManager.resumeRun(runId);
        // So we need to inject the repository node during the run, or change the orchestrator to take a runId.
        // Let's modify orchestrator to take a workspace context or pre-populate the graph.
        // For this CLI script, we will just patch the orchestrator's #metadata function if needed, or better, 
        // we'll run orchestrator.execute() and since planner looks at the whole evidence graph, we just need the repo node in there globally (runId doesn't matter for the initial node if it's attached to the system run).
        // We will let execute() run.
        console.log(`Starting analysis on ${targetPath}...`);
        const result = await orchestrator.execute();
        console.log('Analysis complete. Generating report...');
        const output = values.output;
        ReportGenerator.generate(evidenceGraph, output, result.runId);
        console.log(`Report generated at: ${path.resolve(process.cwd(), output)}`);
    }
    catch (error) {
        console.error('Fatal Error:', error);
        process.exit(1);
    }
}
main();
