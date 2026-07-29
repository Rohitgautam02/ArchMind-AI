# Provider Framework Specification

## Supported Providers

- Groq
- Ollama
- Future providers

## Provider Requirements

- Streaming responses
- Structured outputs
- Retry support
- Timeout support
- Circuit breaker support
- Rate limiting support

## Provider Adapter Rules

- The runtime must never depend on a provider-specific API shape.
- All providers must implement the same adapter interface.
- Provider output must be validated against the requested schema.
- Streaming output must be normalized into typed runtime events.

## Reliability Rules

- Retry only when the request is idempotent.
- Respect provider-specific rate limit windows.
- Open the circuit when repeated failures exceed policy thresholds.
- Prefer local fallback providers when policy allows.