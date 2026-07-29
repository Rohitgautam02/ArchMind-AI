# Runtime Kernel Specification

## RuntimeKernel

### Responsibilities

- boot the system
- initialize all runtime dependencies
- register components
- orchestrate execution
- manage lifecycle transitions
- coordinate shutdown and recovery

### Lifecycle

1. boot
2. initialize
3. register dependencies
4. warm up runtime components
5. enter ready state
6. enter running state
7. coordinate stopping
8. finalize shutdown

### Public Methods

- `boot(context)`
- `initialize(context)`
- `registerComponents(context)`
- `warmUp(context)`
- `start(context)`
- `stop(context)`
- `restart(context)`

### Failure Cases

- invalid bootstrap configuration
- failed dependency registration
- warm-up failure
- unrecoverable component initialization failure
- shutdown interruption

### Retry Strategy

- retry component initialization only when dependencies are stable
- retry warm-up with bounded attempts
- restart from a clean boot when state cannot be trusted

## RunManager

### Responsibilities

- create runs
- resume runs
- cancel runs
- replay runs
- preserve run lineage

### Lifecycle

1. allocate run identity
2. persist initial run context
3. resume or create execution state
4. record cancellation or completion
5. expose replay data

### Public Methods

- `createRun(input)`
- `resumeRun(runId)`
- `cancelRun(runId)`
- `replayRun(runId)`

### Failure Cases

- missing run snapshot
- corrupted run state
- cancellation race
- replay gap

### Retry Strategy

- retry local persistence
- resume from last valid checkpoint
- mark run as degraded if replay cannot be fully reconstructed

## RuntimeContext

### Responsibilities

- provide all runtime dependencies in one typed boundary
- carry configuration, policies, memory, tools, providers, event bus, and evidence graph
- remain immutable to consumers

### Lifecycle

1. constructed by bootstrap layer
2. injected into kernel and managers
3. shared across runtime components
4. discarded or recreated on restart

### Public Methods

- `snapshot()`
- `fork()`

### Failure Cases

- missing dependency reference
- policy mismatch
- stale configuration

### Retry Strategy

- rebuild context from validated bootstrap inputs
- refuse partial context mutation
