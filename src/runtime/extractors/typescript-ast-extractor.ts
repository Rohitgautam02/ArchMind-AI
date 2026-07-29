import * as path from 'path';
import * as fs from 'fs/promises';
import ts from 'typescript';
import type { Extractor, ExtractorContext } from './extractor-contract.js';
import type { EvidenceNode, Provenance } from '../contracts.js';

export class TypeScriptAstExtractor implements Extractor {
  readonly id = 'TypeScriptAstExtractor';

  async canHandle(context: ExtractorContext): Promise<boolean> {
    try {
      const srcPath = path.join(context.targetPath, 'src');
      const stat = await fs.stat(srcPath);
      return stat.isDirectory();
    } catch {
      return false;
    }
  }

  async extract(context: ExtractorContext): Promise<EvidenceNode[]> {
    const srcPath = path.join(context.targetPath, 'src');
    const files = await this.#findTsFiles(srcPath);
    
    const classes: string[] = [];
    const interfaces: string[] = [];
    const functions: string[] = [];
    const imports: string[] = [];

    for (const file of files) {
      const content = await fs.readFile(file, 'utf8');
      const sourceFile = ts.createSourceFile(
        file,
        content,
        ts.ScriptTarget.Latest,
        true
      );

      const visit = (node: ts.Node) => {
        if (ts.isClassDeclaration(node) && node.name) {
          classes.push(node.name.text);
        } else if (ts.isInterfaceDeclaration(node) && node.name) {
          interfaces.push(node.name.text);
        } else if (ts.isFunctionDeclaration(node) && node.name) {
          functions.push(node.name.text);
        } else if (ts.isImportDeclaration(node)) {
          if (ts.isStringLiteral(node.moduleSpecifier)) {
            imports.push(node.moduleSpecifier.text);
          }
        }
        ts.forEachChild(node, visit);
      };

      visit(sourceFile);
    }

    const provenance: Provenance = {
      sourceType: 'metadata',
      sourceId: this.id,
      createdAt: new Date().toISOString(),
      runId: context.runId,
      external: false,
    };

    return [
      Object.freeze({
        id: `${context.runId}:ast:typescript`,
        kind: 'ast:typescript',
        label: 'TypeScript AST Analysis',
        value: {
          classes: Array.from(new Set(classes)),
          interfaces: Array.from(new Set(interfaces)),
          functions: Array.from(new Set(functions)),
          imports: Array.from(new Set(imports)),
        },
        confidence: { score: 1.0, source: 'tool' as const, rationale: 'Parsed directly from TypeScript AST' },
        provenance: Object.freeze([provenance]),
      })
    ];
  }

  async #findTsFiles(dir: string): Promise<string[]> {
    const results: string[] = [];
    try {
      const entries = await fs.readdir(dir, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          results.push(...(await this.#findTsFiles(fullPath)));
        } else if (entry.isFile() && fullPath.endsWith('.ts') && !fullPath.endsWith('.d.ts')) {
          results.push(fullPath);
        }
      }
    } catch {
      // Ignore errors reading directories
    }
    return results;
  }
}
