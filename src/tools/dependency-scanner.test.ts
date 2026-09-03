import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { MetadataExtractor } from '../metadata/metadata-extractor.js';
import { DependencyScanner, type DependencyRecord } from './dependency-scanner.js';
import type { EvidenceNode } from '../runtime/contracts.js';

describe('DependencyScanner', () => {
  it('extracts deterministic dependency records', () => {
    const repositoryPath = createRepository();
    const metadata = new MetadataExtractor({ repositoryPath }).extract();
    const scanner = new DependencyScanner();

    const result = scanner.execute(metadata);

    expect(result.output.dependencies.map((dependency) => dependency.package)).toEqual(['express', 'react', 'vitest']);
    expect(result.output.dependencies[0]?.source).toBe('package.json');
  });

  it('finds declared and imported runtime dependencies', () => {
    const result = DependencyScanner.analyzeUsage(
      [record('express', '^4.0.0', 'dependencies')],
      [moduleNode('module-express', 'express')],
    );

    expect(result.declaredAndImported).toMatchObject([{ package: 'express', dependencyType: 'dependencies' }]);
  });

  it('finds declared but not imported dependencies', () => {
    const result = DependencyScanner.analyzeUsage(
      [record('lodash', '^4.0.0', 'dependencies')],
      [],
    );

    expect(result.declaredButNotImported).toMatchObject([{ package: 'lodash', runtimeUnused: true }]);
  });

  it('finds imported but undeclared dependencies', () => {
    const result = DependencyScanner.analyzeUsage(
      [],
      [moduleNode('module-axios', 'axios')],
    );

    expect(result.importedButUndeclared).toEqual([{ package: 'axios', supportingEvidenceIds: ['module-axios'] }]);
  });

  it('normalizes scoped package subpaths', () => {
    const result = DependencyScanner.analyzeUsage(
      [record('@scope/pkg', '^1.0.0', 'dependencies')],
      [moduleNode('module-scoped', '@scope/pkg/subpath')],
    );

    expect(result.declaredAndImported[0]?.package).toBe('@scope/pkg');
  });

  it('ignores relative imports', () => {
    const result = DependencyScanner.analyzeUsage(
      [record('./local-module.js', 'workspace', 'dependencies')],
      [moduleNode('module-local', './local-module.js')],
    );

    expect(result.importedButUndeclared).toEqual([]);
  });

  it('ignores node built-ins', () => {
    const result = DependencyScanner.analyzeUsage(
      [],
      [moduleNode('module-fs', 'node:fs')],
    );

    expect(result.importedButUndeclared).toEqual([]);
  });

  it('preserves development dependency classification', () => {
    const result = DependencyScanner.analyzeUsage([record('vitest', '^2.0.0', 'devDependencies')], []);

    expect(result.declaredButNotImported[0]).toMatchObject({ dependencyType: 'devDependencies', runtimeUnused: false });
  });

  it('preserves peer dependency classification', () => {
    const result = DependencyScanner.analyzeUsage([record('react', '^18.0.0', 'peerDependencies')], []);

    expect(result.declaredButNotImported[0]?.dependencyType).toBe('peerDependencies');
  });

  it('preserves optional dependency classification', () => {
    const result = DependencyScanner.analyzeUsage([record('fsevents', '^2.0.0', 'optionalDependencies')], []);

    expect(result.declaredButNotImported[0]?.dependencyType).toBe('optionalDependencies');
  });

  it('returns stable output for identical input', () => {
    const dependencies = [record('lodash', '^4.0.0', 'dependencies'), record('express', '^4.0.0', 'dependencies')];
    const modules = [moduleNode('module-express', 'express')];

    expect(DependencyScanner.analyzeUsage(dependencies, modules)).toEqual(DependencyScanner.analyzeUsage(dependencies, modules));
  });

  it('parses npm lockfile v3 direct and transitive resolved versions', () => {
    const repositoryPath = createRepository({
      dependencies: { express: '^5.0.0' },
      lockfile: {
        lockfileVersion: 3,
        packages: {
          '': { dependencies: { express: '^5.0.0' } },
          'node_modules/express': { version: '5.0.0' },
          'node_modules/express/node_modules/accepts': { version: '2.0.0' },
        },
      },
    });
    const result = new DependencyScanner().execute(new MetadataExtractor({ repositoryPath }).extract());

    expect(result.output.lockfileDependencies).toEqual([
      expect.objectContaining({ package: 'express', resolvedVersion: '5.0.0', location: 'node_modules/express', isDirect: true, declaredVersion: '^5.0.0' }),
      expect.objectContaining({ package: 'accepts', resolvedVersion: '2.0.0', location: 'node_modules/express/node_modules/accepts', isDirect: false }),
    ]);
  });

  it('reports only packages with multiple resolved versions as duplicates', () => {
    const result = new DependencyScanner().execute(new MetadataExtractor({ repositoryPath: createRepository({
      dependencies: {},
      lockfile: {
        lockfileVersion: 3,
        packages: {
          '': {},
          'node_modules/lodash': { version: '4.17.21' },
          'node_modules/a/node_modules/lodash': { version: '4.17.15' },
          'node_modules/b/node_modules/lodash': { version: '4.17.10' },
          'node_modules/express': { version: '5.0.0' },
          'node_modules/react': { version: '18.0.0' },
        },
      },
    }) }).extract());

    expect(result.output.duplicateVersions).toEqual([expect.objectContaining({
      package: 'lodash',
      versions: ['4.17.10', '4.17.15', '4.17.21'],
    })]);
  });

  it('does not duplicate a package with one resolved version or different packages', () => {
    const result = new DependencyScanner().execute(new MetadataExtractor({ repositoryPath: createRepository({
      dependencies: {},
      lockfile: {
        lockfileVersion: 3,
        packages: {
          '': {},
          'node_modules/express': { version: '5.0.0' },
          'node_modules/react': { version: '18.0.0' },
        },
      },
    }) }).extract());

    expect(result.output.duplicateVersions).toEqual([]);
  });

  it('handles malformed npm lockfiles deterministically', () => {
    const repositoryPath = createRepository({ dependencies: { express: '^5.0.0' }, lockfile: '{malformed' });
    const metadata = new MetadataExtractor({ repositoryPath }).extract();
    const scanner = new DependencyScanner();

    expect(scanner.execute(metadata).output.lockfileDependencies).toEqual([]);
    expect(scanner.execute(metadata).output.duplicateVersions).toEqual([]);
  });

  it('produces stable lockfile analysis for identical input', () => {
    const repositoryPath = createRepository({
      dependencies: {},
      lockfile: { lockfileVersion: 3, packages: { '': {}, 'node_modules/lodash': { version: '4.17.21' } } },
    });
    const metadata = new MetadataExtractor({ repositoryPath }).extract();
    const scanner = new DependencyScanner();

    expect(scanner.execute(metadata).output).toEqual(scanner.execute(metadata).output);
  });
});

function record(packageName: string, version: string, section: DependencyRecord['section']): DependencyRecord {
  const type = section === 'dependencies' ? 'runtime' : section === 'devDependencies' ? 'development' : section === 'peerDependencies' ? 'peer' : 'optional';
  return { package: packageName, version, type, source: 'package.json', section };
}

function moduleNode(id: string, label: string): EvidenceNode {
  return {
    id,
    kind: 'ast:module',
    label,
    confidence: { score: 1, source: 'tool' },
    provenance: [],
  };
}

function createRepository(options: { dependencies?: Record<string, string>; lockfile?: unknown } = {}): string {
  const repositoryPath = fs.mkdtempSync(path.join(os.tmpdir(), 'archmind-deps-'));
  fs.writeFileSync(path.join(repositoryPath, 'package.json'), JSON.stringify({
    name: 'sample',
    dependencies: options.dependencies ?? { react: '^18.0.0', express: '^4.0.0' },
    devDependencies: { vitest: '^2.0.0' },
  }));
  if (options.lockfile !== undefined) {
    fs.writeFileSync(path.join(repositoryPath, 'package-lock.json'), typeof options.lockfile === 'string' ? options.lockfile : JSON.stringify(options.lockfile));
  }
  return repositoryPath;
}