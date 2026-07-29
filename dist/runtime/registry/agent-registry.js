export class AgentRegistry {
    #agents = new Map();
    register(id, definition) {
        if (this.#agents.has(id)) {
            throw new Error(`Agent definition already registered for id: ${id}`);
        }
        this.#agents.set(id, definition);
    }
    resolve(id) {
        const definition = this.#agents.get(id);
        if (!definition) {
            throw new Error(`Agent definition not found for id: ${id}`);
        }
        return definition;
    }
}
