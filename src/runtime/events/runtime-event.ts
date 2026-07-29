import type {
  RuntimeEvent as BaseRuntimeEvent,
  RuntimeEventType,
  RuntimeMetadata,
} from '../contracts.js';
import type { ExecutionPlan } from '../planner/execution-plan.js';

export interface RuntimeEventPayloadMap {
  RunCreated: {
    readonly runId: string;
    readonly metadata: RuntimeMetadata;
  };
  RunResumed: {
    readonly runId: string;
    readonly metadata: RuntimeMetadata;
  };
  RunCancelled: {
    readonly runId: string;
    readonly reason?: string;
    readonly metadata: RuntimeMetadata;
  };
  RunStarted: {
    readonly metadata: RuntimeMetadata;
  };
  PlannerStarted: {
    readonly runId: string;
    readonly metadata: RuntimeMetadata;
  };
  PlanCreated: {
    readonly runId: string;
    readonly executionPlan: ExecutionPlan;
    readonly metadata: RuntimeMetadata;
  };
  QueueStarted: {
    readonly runId: string;
    readonly metadata: RuntimeMetadata;
  };
  WorkQueued: {
    readonly runId: string;
    readonly workItemId: string;
    readonly capability: string;
    readonly metadata: RuntimeMetadata;
  };
  WorkDequeued: {
    readonly runId: string;
    readonly workItemId: string;
    readonly capability: string;
    readonly metadata: RuntimeMetadata;
  };
  QueueCompleted: {
    readonly runId: string;
    readonly metadata: RuntimeMetadata;
  };
  QueueCancelled: {
    readonly runId: string;
    readonly reason?: string;
    readonly metadata: RuntimeMetadata;
  };
  HypothesisCreated: {
    readonly hypothesisId: string;
    readonly statement: string;
    readonly confidence: number;
  };
  EvidenceAdded: {
    readonly evidenceIds: readonly string[];
  };
  ToolInvoked: {
    readonly toolName: string;
    readonly toolVersion: string;
  };
  ToolCompleted: {
    readonly toolName: string;
    readonly toolVersion: string;
    readonly success: boolean;
  };
  AgentStarted: {
    readonly agentName: string;
    readonly agentVersion: string;
  };
  AgentCompleted: {
    readonly agentName: string;
    readonly agentVersion: string;
  };
  AgentFailed: {
    readonly agentName: string;
    readonly agentVersion: string;
    readonly errorMessage: string;
  };
  ReviewerRequested: {
    readonly reviewer: string;
  };
  ReviewerRejected: {
    readonly reviewer: string;
    readonly reason: string;
  };
  ReviewerReanalysisRequested: {
    readonly reviewer: string;
    readonly reason: string;
  };
  ReviewerApproved: {
    readonly reviewer: string;
  };
  ReviewApproved: {
    readonly reviewer: string;
    readonly metadata: RuntimeMetadata;
  };
  AnalysisStateChanged: {
    readonly previous: string;
    readonly current: string;
    readonly reason?: string;
  };
  ReportGenerated: {
    readonly reportId: string;
  };
  RunCompleted: {
    readonly metadata: RuntimeMetadata;
  };
}

export type RuntimeEvent<TType extends RuntimeEventType = RuntimeEventType> = BaseRuntimeEvent<
  TType,
  RuntimeEventPayloadMap[TType]
>;

export type EventHandler<TType extends RuntimeEventType = RuntimeEventType> = (
  event: RuntimeEvent<TType>,
) => void | Promise<void>;

export interface EventBusHistoryRecord {
  readonly event: RuntimeEvent;
  readonly sequence: number;
}