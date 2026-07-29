export class ProviderRegistry {
    #providers = new Map();
    #defaultProvider;
    register(provider, isDefault = false) {
        if (this.#providers.has(provider.name)) {
            throw new Error(`Provider ${provider.name} is already registered.`);
        }
        this.#providers.set(provider.name, provider);
        if (isDefault || !this.#defaultProvider) {
            this.#defaultProvider = provider.name;
        }
    }
    resolve(name) {
        const targetName = name ?? this.#defaultProvider;
        if (!targetName) {
            throw new Error('No providers registered.');
        }
        const provider = this.#providers.get(targetName);
        if (!provider) {
            throw new Error(`Provider ${targetName} is not registered.`);
        }
        return provider;
    }
    list() {
        return [...this.#providers.keys()].sort((left, right) => left.localeCompare(right));
    }
}
