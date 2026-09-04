#!/usr/bin/env node

import { parseArgs } from 'util';
import * as path from 'path';
import { AnalysisService } from '../runtime/analysis-service.js';
import { ReportGenerator } from '../runtime/reporting/report-generator.js';

async function main() {
  const { values, positionals } = parseArgs({
    args: process.argv.slice(2),
    options: {
      config: {
        type: 'string',
        short: 'c',
      },
      output: {
        type: 'string',
        short: 'o',
        default: 'archmind-report.md',
      }
    },
    allowPositionals: true,
  });

  const command = positionals[0];
  const targetPath = positionals[1] ? path.resolve(process.cwd(), positionals[1]) : process.cwd();

  if (command !== 'analyze') {
    console.error('Usage: archmind analyze <path> [--config <file>] [--output <file>]');
    process.exit(1);
  }

  try {
    const service = new AnalysisService({
      configPath: values.config as string | undefined,
    });

    console.log(`Scanning repository at ${targetPath}...`);

    const result = await service.analyze(targetPath);

    console.log('Analysis complete. Generating report...');
    const output = values.output as string;
    ReportGenerator.generate(service.evidenceGraph, output, result.runId);

    console.log(`Report generated at: ${path.resolve(process.cwd(), output)}`);
  } catch (error) {
    console.error('Fatal Error:', error);
    process.exit(1);
  }
}

main();
