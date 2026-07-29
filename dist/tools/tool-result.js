export const deterministicToolConfidence = Object.freeze({
    score: 1,
    source: 'tool',
});
export function freezeToolValue(value) {
    return deepFreeze(structuredClone(value));
}
function deepFreeze(value) {
    if (value === null || typeof value !== 'object') {
        return value;
    }
    if (Object.isFrozen(value)) {
        return value;
    }
    for (const property of Object.keys(value)) {
        const nestedValue = value[property];
        if (nestedValue && typeof nestedValue === 'object') {
            deepFreeze(nestedValue);
        }
    }
    return Object.freeze(value);
}
