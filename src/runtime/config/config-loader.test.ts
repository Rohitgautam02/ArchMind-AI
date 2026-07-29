import { describe, expect, it, vi, afterEach } from 'vitest';
import { ConfigLoader } from './config-loader.js';
import * as fs from 'fs';
import { defaultRuntimeConfig } from './runtime-config.js';

vi.mock('fs');

describe('ConfigLoader', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('returns default config if no file exists', () => {
    vi.spyOn(fs, 'existsSync').mockReturnValue(false);
    
    const config = ConfigLoader.load();
    expect(config).toEqual(defaultRuntimeConfig);
  });

  it('merges user config from archmind.config.json', () => {
    vi.spyOn(fs, 'existsSync').mockReturnValue(true);
    vi.spyOn(fs, 'readFileSync').mockReturnValue(JSON.stringify({
      timeouts: {
        providerTimeoutMs: 12345
      }
    }));
    
    const config = ConfigLoader.load();
    expect(config.timeouts.providerTimeoutMs).toBe(12345);
    expect(config.timeouts.agentTimeoutMs).toBe(defaultRuntimeConfig.timeouts.agentTimeoutMs);
    expect(config.reviewer.minimumConfidenceThreshold).toBe(defaultRuntimeConfig.reviewer.minimumConfidenceThreshold);
  });

  it('throws if custom config path is not found', () => {
    vi.spyOn(fs, 'existsSync').mockReturnValue(false);
    
    expect(() => ConfigLoader.load('missing.json')).toThrow(/Configuration file not found/);
  });

  it('throws on invalid json', () => {
    vi.spyOn(fs, 'existsSync').mockReturnValue(true);
    vi.spyOn(fs, 'readFileSync').mockReturnValue('{ invalid json');
    
    expect(() => ConfigLoader.load()).toThrow(/Failed to load configuration/);
  });
});
