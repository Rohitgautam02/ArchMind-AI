# Tool Framework Specification

## Deterministic Tool Model

Tools are local, deterministic, and schema-driven helpers that produce evidence before an LLM is invoked.

## Required Tool Interfaces

- MetadataParser
- DependencyScanner
- DockerInspector
- PolicyChecker
- ReadmeAnalyzer
- Future MCP Tools

## Registration Model

- Tools register themselves through declarative metadata.
- Registration must include name, version, capability tags, input schema, output schema, and execution environment requirements.
- The registry must support multiple implementations of the same capability.

## Discovery Model

- Agents ask the registry for tools by capability, version, and environment compatibility.
- The planner may inspect available tools when deciding how to gather evidence.
- Discovery must be deterministic and side-effect free.

## Versioning Model

- Semantic versioning is required for tool contracts.
- Major versions may break schemas.
- Minor versions must remain backward compatible.
- Patch versions must not change public schema shape.

## MCP Readiness

- Future MCP tools must be adapter-compatible with the same registry contract.
- The tool registry must not care whether a tool is internal or MCP-backed as long as the contract is satisfied.