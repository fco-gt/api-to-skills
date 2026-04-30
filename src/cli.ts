#!/usr/bin/env node

import { Command } from 'commander';
import ora from 'ora';
import chalk from 'chalk';
import dotenv from 'dotenv';
import path from 'node:path';
import type { EnrichedEndpoint, IngestorResult } from './types/index.js';
import { logger } from './utils/logger.js';
import { pathExists } from './utils/file.js';
import { ingestOpenApi, ingestUrl, ingestMarkdown } from './ingestors/index.js';
import { enrichWithLlm } from './enrichers/llm.enricher.js';
import { generateSkills } from './generators/skill.generator.js';

// Load .env if present
dotenv.config();

const program = new Command();

program
  .name('api-to-skill')
  .description('Convert APIs and documentation into AI agent skill files')
  .version('1.0.0');

program
  .command('generate')
  .description('Generate skill files from an API source')
  .requiredOption('--input <path|url>', 'Path to OpenAPI file, URL, or Markdown file')
  .option('--output <dir>', 'Output directory for skill files', './skills')
  .option(
    '--format <type>',
    'Input type: openapi, url, or markdown (autodetect if omitted)',
    undefined,
  )
  .option('--enrich', 'Enable LLM semantic enrichment (requires ANTHROPIC_API_KEY)', false)
  .option('--dry-run', 'Print output to console without writing files', false)
  .action(
    async (opts: {
      input: string;
      output: string;
      format?: string;
      enrich: boolean;
      dryRun: boolean;
    }) => {
      try {
        // ── Phase 1: Detect format ──────────────────────────────────────
        const spinner = ora('Detecting input format...').start();
        const format = opts.format ?? (await detectFormat(opts.input));
        spinner.succeed(`Format detected: ${chalk.bold(format)}`);

        // ── Phase 2: Ingest ─────────────────────────────────────────────
        const ingestSpinner = ora(`Ingesting ${format} source...`).start();
        const result: IngestorResult = await ingest(opts.input, format);
        ingestSpinner.succeed(
          `Ingested ${chalk.bold(String(result.endpoints.length))} endpoints from ${chalk.bold(result.source)}`,
        );

        if (result.endpoints.length === 0) {
          logger.warn('No endpoints found. Nothing to generate.');
          if (result.metadata.message && typeof result.metadata.message === 'string') {
            logger.info(`Hint: ${result.metadata.message}`);
          }
          process.exit(0);
        }

        // ── Phase 3: Enrich ─────────────────────────────────────────────
        let enriched: EnrichedEndpoint[];

        if (opts.enrich) {
          const enrichSpinner = ora('Enriching endpoints with Claude...').start();
          enriched = await enrichWithLlm(result.endpoints);
          enrichSpinner.succeed(`Enriched ${chalk.bold(String(enriched.length))} endpoints`);
        } else {
          enriched = result.endpoints.map((ep) => ({
            ...ep,
            semanticDescription: `${ep.method} ${ep.path}. ${ep.summary ?? ''}`,
            usageExample: `Call ${ep.method} ${ep.path} with the required parameters.`,
            skillName: ep.tags?.[0]?.replace(/\s+/g, '_') ?? 'defaultSkill',
          }));
        }

        // ── Phase 4: Generate ───────────────────────────────────────────
        if (opts.dryRun) {
          console.log('\n' + chalk.bold('═══ DRY RUN — would generate the following files ═══'));
          // Group for display
          const groups = new Map<string, EnrichedEndpoint[]>();
          for (const ep of enriched) {
            const key = ep.tags?.[0] ?? ep.skillName;
            if (!groups.has(key)) groups.set(key, []);
            const group = groups.get(key);
            if (group) group.push(ep);
          }
          for (const [group, eps] of groups) {
            console.log(
              chalk.cyan(
                `\n  📄 ${group}.skill.ts (${String(eps.length)} tool${eps.length > 1 ? 's' : ''})`,
              ),
            );
            for (const ep of eps) {
              console.log(
                `    ${chalk.yellow(ep.method)} ${ep.path} — ${ep.summary ?? ep.semanticDescription}`,
              );
            }
          }
          console.log('\n');
          logger.success(
            `Dry run complete. ${String(enriched.length)} endpoints across ${String(groups.size)} skill(s).`,
          );
          return;
        }

        const genSpinner = ora('Writing skill files...').start();
        const files = await generateSkills(enriched, opts.output);
        genSpinner.succeed(
          `Generated ${chalk.bold(String(files.length))} skill file(s) in ${chalk.bold(opts.output)}`,
        );

        // ── Summary ─────────────────────────────────────────────────────
        console.log('\n' + chalk.bold('═══ Summary ═══'));
        console.log(`  Endpoints processed: ${chalk.bold(String(enriched.length))}`);
        console.log(`  Skills generated:    ${chalk.bold(String(files.length))}`);
        console.log(`  Output directory:    ${chalk.bold(path.resolve(opts.output))}`);
        console.log('');
        logger.success('Done! Skills are ready for use with AI agents.');
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        logger.error(`Failed: ${message}`);
        process.exit(1);
      }
    },
  );

// ── Helpers ──────────────────────────────────────────────────────────────

async function detectFormat(input: string): Promise<'openapi' | 'url' | 'markdown'> {
  // If it looks like a URL
  if (input.startsWith('http://') || input.startsWith('https://')) {
    return 'url';
  }

  // Check if file exists
  const exists = await pathExists(input);
  if (!exists) {
    // Assume URL if not a file path
    if (input.includes('.')) {
      return 'openapi';
    }
    return 'url';
  }

  const lower = input.toLowerCase();
  if (lower.endsWith('.yaml') || lower.endsWith('.yml') || lower.endsWith('.json')) {
    return 'openapi';
  }
  if (lower.endsWith('.md') || lower.endsWith('.markdown')) {
    return 'markdown';
  }

  // Try to read and detect
  return 'openapi';
}

async function ingest(input: string, format: string): Promise<IngestorResult> {
  switch (format) {
    case 'openapi':
      return ingestOpenApi(input);
    case 'url':
      return ingestUrl(input);
    case 'markdown':
      return ingestMarkdown(input);
    default:
      throw new Error(`Unknown format: ${format}`);
  }
}

program.parse();
