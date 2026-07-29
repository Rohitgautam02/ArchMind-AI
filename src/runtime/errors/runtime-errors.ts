export class ArchMindError extends Error {
  constructor(message: string, public readonly metadata?: Record<string, unknown>) {
    super(message);
    this.name = this.constructor.name;
    Error.captureStackTrace(this, this.constructor);
  }
}

export class ProviderError extends ArchMindError {}
export class ToolExecutionError extends ArchMindError {}
export class ValidationError extends ArchMindError {}
export class PlannerError extends ArchMindError {}
export class ReviewerError extends ArchMindError {}
export class RuntimeError extends ArchMindError {}
