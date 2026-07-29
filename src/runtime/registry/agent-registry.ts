import type { AgentDefinition } from '../agents/agent-runtime.js';

export class AgentRegistry {
  readonly #agents = new Map<string, AgentDefinition<unknown>>();

  register<T>(id: string, definition: AgentDefinition<T>): void {
    if (this.#agents.has(id)) {
      throw new Error(`Agent definition already registered for id: ${id}`);
    }

    this.#agents.set(id, definition as AgentDefinition<unknown>);
  }

  resolve(id: string): AgentDefinition<unknown> {
    const definition = this.#agents.get(id);

    if (!definition) {
      throw new Error(`Agent definition not found for id: ${id}`);
    }

    return definition;
  }
}
