export interface RepositoryMetadata {
  readonly name: string;
  readonly rootPath: string;
  readonly branch?: string;
  readonly commitHash?: string;
}

export interface FileMetadata {
  readonly relativePath: string;
  readonly extension: string;
  readonly size: number;
}

export interface DirectoryMetadata {
  readonly relativePath: string;
  readonly depth: number;
}

export interface PackageManagerMetadata {
  readonly name: 'package.json' | 'pnpm-lock' | 'yarn.lock' | 'package-lock';
  readonly path: string;
}

export type LanguageName = 'TypeScript' | 'JavaScript' | 'Python' | 'Java' | 'Go' | 'Rust';

export interface LanguageMetadata {
  readonly name: LanguageName;
  readonly evidence: readonly string[];
}

export interface ConfigurationFileMetadata {
  readonly name:
    | 'tsconfig'
    | 'eslint'
    | 'prettier'
    | 'vite'
    | 'webpack'
    | 'docker'
    | 'docker-compose';
  readonly path: string;
}

export type FrameworkName = 'React' | 'Next.js' | 'Express' | 'NestJS' | 'Vue' | 'Angular';

export interface FrameworkMetadata {
  readonly name: FrameworkName;
  readonly evidence: readonly string[];
}

export interface DependencyMetadata {
  readonly packageName: string;
  readonly version: string;
}

export interface GitMetadata {
  readonly branch?: string;
  readonly commitHash?: string;
}

export interface MetadataExtractionSummary {
  readonly repository: RepositoryMetadata;
  readonly files: readonly FileMetadata[];
  readonly directories: readonly DirectoryMetadata[];
  readonly packageManagers: readonly PackageManagerMetadata[];
  readonly languages: readonly LanguageMetadata[];
  readonly configurationFiles: readonly ConfigurationFileMetadata[];
  readonly frameworks: readonly FrameworkMetadata[];
  readonly dependencies: readonly DependencyMetadata[];
  readonly git: GitMetadata;
}