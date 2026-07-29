import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { RepositoryScanner } from './repository-scanner.js';
import type {
  ConfigurationFileMetadata,
  DependencyMetadata,
  FrameworkMetadata,
  GitMetadata,
  LanguageMetadata,
  MetadataExtractionSummary,
  PackageManagerMetadata,
  RepositoryMetadata,
} from './metadata-types.js';
import type { MetadataResult } from './metadata-result.js';

export interface MetadataExtractorDependencies {
  readonly repositoryPath: string;
}

/**
 * Deterministic metadata extractor that collects repository-only signals without parsing source semantics.
 */
export class MetadataExtractor {
  readonly #repositoryPath: string;
  readonly #scanner: RepositoryScanner;

  constructor(dependencies: MetadataExtractorDependencies) {
    this.#repositoryPath = path.resolve(dependencies.repositoryPath);
    this.#scanner = new RepositoryScanner(this.#repositoryPath);
  }

  /** Extract deterministic repository metadata from the filesystem and package manifests. */
  extract(): MetadataResult {
    const repositoryScan = this.#scanner.scan();
    const packageJsonPath = this.#findFile(repositoryScan.files, 'package.json');
    const packageJson = packageJsonPath ? this.#readJson(path.join(this.#repositoryPath, packageJsonPath.relativePath)) : undefined;

    const summary: MetadataExtractionSummary = Object.freeze({
      repository: Object.freeze(this.#repositoryMetadata()),
      files: repositoryScan.files,
      directories: repositoryScan.directories,
      packageManagers: Object.freeze(this.#detectPackageManagers(repositoryScan.files)),
      languages: Object.freeze(this.#detectLanguages(repositoryScan.files)),
      configurationFiles: Object.freeze(this.#detectConfigurationFiles(repositoryScan.files)),
      frameworks: Object.freeze(this.#detectFrameworks(packageJson, repositoryScan.files)),
      dependencies: Object.freeze(this.#detectDependencies(packageJson)),
      git: Object.freeze(this.#detectGitMetadata()),
    });

    return Object.freeze({
      extractedAt: '2026-07-28T00:00:00.000Z',
      summary,
    });
  }

  #repositoryMetadata(): RepositoryMetadata {
    return {
      name: path.basename(this.#repositoryPath),
      rootPath: this.#repositoryPath,
      ...this.#detectGitMetadata(),
    };
  }

  #detectPackageManagers(files: readonly { readonly relativePath: string }[]): readonly PackageManagerMetadata[] {
    const candidates = [
      { name: 'package.json' as const, path: 'package.json' },
      { name: 'pnpm-lock' as const, path: 'pnpm-lock.yaml' },
      { name: 'yarn.lock' as const, path: 'yarn.lock' },
      { name: 'package-lock' as const, path: 'package-lock.json' },
    ];

    return candidates.filter((candidate) => files.some((file) => file.relativePath === candidate.path));
  }

  #detectLanguages(files: readonly { readonly relativePath: string }[]): readonly LanguageMetadata[] {
    const fileExtensions = new Set(files.map((file) => path.extname(file.relativePath).toLowerCase()));
    const languages: LanguageMetadata[] = [];

    if (fileExtensions.has('.ts') || fileExtensions.has('.tsx')) {
      languages.push({ name: 'TypeScript', evidence: ['.ts', '.tsx'] });
    }

    if (fileExtensions.has('.js') || fileExtensions.has('.jsx')) {
      languages.push({ name: 'JavaScript', evidence: ['.js', '.jsx'] });
    }

    if (fileExtensions.has('.py')) {
      languages.push({ name: 'Python', evidence: ['.py'] });
    }

    if (fileExtensions.has('.java')) {
      languages.push({ name: 'Java', evidence: ['.java'] });
    }

    if (fileExtensions.has('.go')) {
      languages.push({ name: 'Go', evidence: ['.go'] });
    }

    if (fileExtensions.has('.rs')) {
      languages.push({ name: 'Rust', evidence: ['.rs'] });
    }

    return languages.sort((left, right) => left.name.localeCompare(right.name));
  }

  #detectConfigurationFiles(files: readonly { readonly relativePath: string }[]): readonly ConfigurationFileMetadata[] {
    const knownFiles: Array<{ readonly name: ConfigurationFileMetadata['name']; readonly path: string }> = [
      { name: 'tsconfig', path: 'tsconfig.json' },
      { name: 'eslint', path: '.eslintrc.json' },
      { name: 'prettier', path: '.prettierrc' },
      { name: 'vite', path: 'vite.config.ts' },
      { name: 'webpack', path: 'webpack.config.js' },
      { name: 'docker', path: 'Dockerfile' },
      { name: 'docker-compose', path: 'docker-compose.yml' },
    ];

    return knownFiles.filter((candidate) => files.some((file) => file.relativePath === candidate.path));
  }

  #detectFrameworks(packageJson: unknown, files: readonly { readonly relativePath: string }[]): readonly FrameworkMetadata[] {
    const frameworkMetadata: FrameworkMetadata[] = [];
    const dependencyNames = this.#extractDependencyNames(packageJson);
    const hasFile = (needle: string) => files.some((file) => file.relativePath.includes(needle));

    if (dependencyNames.has('react') || hasFile('src/App.tsx') || hasFile('pages/')) {
      frameworkMetadata.push({ name: 'React', evidence: ['react dependency', 'tsx/pages structure'] });
    }

    if (dependencyNames.has('next') || hasFile('next.config')) {
      frameworkMetadata.push({ name: 'Next.js', evidence: ['next dependency', 'next.config file'] });
    }

    if (dependencyNames.has('express')) {
      frameworkMetadata.push({ name: 'Express', evidence: ['express dependency'] });
    }

    if (dependencyNames.has('@nestjs/core')) {
      frameworkMetadata.push({ name: 'NestJS', evidence: ['@nestjs/core dependency'] });
    }

    if (dependencyNames.has('vue')) {
      frameworkMetadata.push({ name: 'Vue', evidence: ['vue dependency'] });
    }

    if (dependencyNames.has('@angular/core')) {
      frameworkMetadata.push({ name: 'Angular', evidence: ['@angular/core dependency'] });
    }

    return frameworkMetadata.sort((left, right) => left.name.localeCompare(right.name));
  }

  #detectDependencies(packageJson: unknown): readonly DependencyMetadata[] {
    const dependencies = this.#extractDependencies(packageJson);
    return [...dependencies].sort((left, right) => left.packageName.localeCompare(right.packageName));
  }

  #detectGitMetadata(): GitMetadata {
    const branch = this.#tryGit(['branch', '--show-current']);
    const commitHash = this.#tryGit(['rev-parse', 'HEAD']);

    return {
      branch: branch || undefined,
      commitHash: commitHash || undefined,
    };
  }

  #extractDependencies(packageJson: unknown): readonly DependencyMetadata[] {
    const dependencyMap = this.#extractDependencyMap(packageJson);

    return [...dependencyMap.entries()].map(([packageName, version]) => ({ packageName, version }));
  }

  #extractDependencyNames(packageJson: unknown): Set<string> {
    return new Set(this.#extractDependencies(packageJson).map((dependency) => dependency.packageName));
  }

  #extractDependencyMap(packageJson: unknown): Map<string, string> {
    const dependencyMap = new Map<string, string>();

    if (!packageJson || typeof packageJson !== 'object') {
      return dependencyMap;
    }

    const manifest = packageJson as {
      readonly dependencies?: Record<string, string>;
      readonly devDependencies?: Record<string, string>;
      readonly peerDependencies?: Record<string, string>;
    };

    for (const section of [manifest.dependencies, manifest.devDependencies, manifest.peerDependencies]) {
      for (const [packageName, version] of Object.entries(section ?? {})) {
        dependencyMap.set(packageName, version);
      }
    }

    return dependencyMap;
  }

  #findFile(files: readonly { readonly relativePath: string }[], fileName: string): { readonly relativePath: string } | undefined {
    return files.find((file) => path.basename(file.relativePath) === fileName);
  }

  #readJson(filePath: string): unknown {
    return JSON.parse(fs.readFileSync(filePath, 'utf8')) as unknown;
  }

  #tryGit(args: readonly string[]): string {
    try {
      return execFileSync('git', args, { cwd: this.#repositoryPath, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
    } catch {
      return '';
    }
  }
}