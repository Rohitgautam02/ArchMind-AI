import * as path from 'path';
import * as fs from 'fs/promises';
import ts from 'typescript';
import type { Extractor, ExtractorContext, ExtractorResult } from './extractor-contract.js';
import type { EvidenceNode, EvidenceEdge, Provenance } from '../contracts.js';

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

  async extract(context: ExtractorContext): Promise<ExtractorResult> {
    const srcPath = path.join(context.targetPath, 'src');
    const files = await this.#findTsFiles(srcPath);
    
    const nodes: EvidenceNode[] = [];
    const edges: EvidenceEdge[] = [];

    const provenance: Provenance = {
      sourceType: 'metadata',
      sourceId: this.id,
      createdAt: new Date().toISOString(),
      runId: context.runId,
      external: false,
    };

    for (const file of files) {
      const content = await fs.readFile(file, 'utf8');
      const sourceFile = ts.createSourceFile(
        file,
        content,
        ts.ScriptTarget.Latest,
        true
      );

      const relativePath = path.relative(context.targetPath, file);
      const fileNodeId = `${context.runId}:file:${relativePath}`;
      
      nodes.push(Object.freeze({
        id: fileNodeId,
        kind: 'ast:file',
        label: relativePath,
        confidence: { score: 1.0, source: 'tool' as const, rationale: 'File exists' },
        provenance: Object.freeze([provenance]),
      }));

      const visit = (node: ts.Node) => {
        if (ts.isClassDeclaration(node) && node.name) {
          const className = node.name.text;
          const classNodeId = `${context.runId}:class:${className}`;
          
          if (!nodes.some(n => n.id === classNodeId)) {
            nodes.push(Object.freeze({
              id: classNodeId,
              kind: 'ast:class',
              label: className,
              confidence: { score: 1.0, source: 'tool' as const, rationale: 'Parsed from AST' },
              provenance: Object.freeze([provenance]),
            }));
          }

          edges.push(Object.freeze({
            id: `${context.runId}:contains:${relativePath}:${className}`,
            from: fileNodeId,
            to: classNodeId,
            relation: 'contains',
            confidence: { score: 1.0, source: 'tool' as const, rationale: 'Class declared in file' },
            provenance: Object.freeze([provenance]),
          }));

          // Check for extends
          if (node.heritageClauses) {
            for (const clause of node.heritageClauses) {
              if (clause.token === ts.SyntaxKind.ExtendsKeyword) {
                for (const type of clause.types) {
                  if (ts.isIdentifier(type.expression)) {
                    const baseClassName = type.expression.text;
                    const baseClassNodeId = `${context.runId}:class:${baseClassName}`;
                    
                    edges.push(Object.freeze({
                      id: `${context.runId}:extends:${className}:${baseClassName}`,
                      from: classNodeId,
                      to: baseClassNodeId,
                      relation: 'extends',
                      confidence: { score: 1.0, source: 'tool' as const, rationale: 'Extends keyword found' },
                      provenance: Object.freeze([provenance]),
                    }));
                  }
                }
              }
            }
          }
        } else if (ts.isImportDeclaration(node)) {
          if (ts.isStringLiteral(node.moduleSpecifier)) {
            const moduleName = node.moduleSpecifier.text;
            const moduleNodeId = `${context.runId}:module:${moduleName}`;
            
            if (!nodes.some(n => n.id === moduleNodeId)) {
              nodes.push(Object.freeze({
                id: moduleNodeId,
                kind: 'ast:module',
                label: moduleName,
                confidence: { score: 1.0, source: 'tool' as const, rationale: 'Parsed from AST import' },
                provenance: Object.freeze([provenance]),
              }));
            }

            edges.push(Object.freeze({
              id: `${context.runId}:imports:${relativePath}:${moduleName}`,
              from: fileNodeId,
              to: moduleNodeId,
              relation: 'imports',
              confidence: { score: 1.0, source: 'tool' as const, rationale: 'Import declaration found' },
              provenance: Object.freeze([provenance]),
            }));
          }
        }
        ts.forEachChild(node, visit);
      };

      visit(sourceFile);
    }

    return {
      nodes,
      edges,
    };
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
