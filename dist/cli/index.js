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
import { dependencyAgentDefinition } from '../runtime/agents/dependency-agent-definition.js';
import { ReportGenerator } from '../runtime/reporting/report-generator.js';
import { LifecycleManager } from '../runtime/lifecycle/lifecycle-manager.js';
import { RepositoryScanner } from '../runtime/extractors/repository-scanner.js';
import { PackageJsonExtractor } from '../runtime/extractors/package-json-extractor.js';
import { TsConfigExtractor } from '../runtime/extractors/tsconfig-extractor.js';
import { DockerfileExtractor } from '../runtime/extractors/dockerfile-extractor.js';
import { ReadmeExtractor } from '../runtime/extractors/readme-extractor.js';
import { TypeScriptAstExtractor } from '../runtime/extractors/typescript-ast-extractor.js';
import { FrameworkDetector } from '../runtime/extractors/framework-detector.js';
import { ArchitectureDetector } from '../runtime/extractors/architecture-detector.js';
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
        agentRegistry.register('dependency-agent-1', dependencyAgentDefinition);
        componentRegistry.register({
            id: 'architecture-agent-1',
            capability: 'ArchitectureAgent',
            version: '1.0.0',
            priority: 10,
            implementation: 'ignored',
            metadata: { name: 'ArchitectureAgent' },
        });
        componentRegistry.register({
            id: 'dependency-agent-1',
            capability: 'DependencyAnalysis',
            version: '1.0.0',
            priority: 20,
            implementation: 'ignored',
            metadata: { name: 'DependencyAnalysisAgent' },
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
        const { runId } = runManager.createRun();
        runManager.resumeRun(runId);
        const scanner = new RepositoryScanner();
        scanner.register(new PackageJsonExtractor());
        scanner.register(new TsConfigExtractor());
        scanner.register(new DockerfileExtractor());
        scanner.register(new ReadmeExtractor());
        scanner.register(new TypeScriptAstExtractor());
        scanner.register(new FrameworkDetector());
        scanner.register(new ArchitectureDetector());
        console.log(`Scanning repository at ${targetPath}...`);
        const scanResults = await scanner.scan(targetPath, runId);
        evidenceGraph.apply({
            provenance: scanResults.provenance,
            nodes: scanResults.nodes,
            edges: scanResults.edges,
        });
        console.log('Graph populated. Executing RuntimeOrchestrator...');
        const result = await orchestrator.execute(runId);
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
