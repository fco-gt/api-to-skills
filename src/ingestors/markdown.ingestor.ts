import { marked } from 'marked';
import type { Tokens } from 'marked';
import type { RawEndpoint, IngestorResult } from '../types/index.js';
import { readFile } from '../utils/file.js';

// Regex to match lines like: GET /api/users, POST /v2/items, DELETE /resource/{id}
const ENDPOINT_REGEX = /^(GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS)\s+(\/\S+)/i;

/**
 * Parse a Markdown file and extract HTTP endpoint patterns.
 * Looks for code blocks and headings that describe API endpoints.
 */
export async function ingestMarkdown(source: string): Promise<IngestorResult> {
  const content = await readFile(source);
  const endpoints: RawEndpoint[] = [];

  // Parse markdown to tokens
  const tokens = marked.lexer(content);

  // Extract from code blocks and paragraphs
  for (const token of tokens) {
    if (token.type === 'code') {
      const codeToken = token as Tokens.Code;
      endpoints.push(...extractEndpointsFromText(codeToken.text, codeToken.lang ?? ''));
    } else if (token.type === 'heading') {
      const headingToken = token as Tokens.Heading;
      const text = headingToken.text;
      const match = text.match(ENDPOINT_REGEX);
      if (match) {
        endpoints.push({
          method: match[1].toUpperCase(),
          path: match[2],
          summary: text.replace(match[0], '').trim() || undefined,
          parameters: [],
          responses: [],
        });
      }
    } else if (token.type === 'paragraph') {
      const paraToken = token as Tokens.Paragraph;
      const lines = paraToken.text.split('\n');
      for (const line of lines) {
        const match = line.match(ENDPOINT_REGEX);
        if (match) {
          endpoints.push({
            method: match[1].toUpperCase(),
            path: match[2],
            summary: line.replace(match[0], '').trim() || undefined,
            parameters: [],
            responses: [],
          });
        }
      }
    }
  }

  // Also scan raw text for endpoint patterns (catches inline mentions)
  const rawEndpoints = extractEndpointsFromText(content, '');
  // Merge, avoiding duplicates
  const existing = new Set(endpoints.map((e) => `${e.method} ${e.path}`));
  for (const ep of rawEndpoints) {
    const key = `${ep.method} ${ep.path}`;
    if (!existing.has(key)) {
      endpoints.push(ep);
      existing.add(key);
    }
  }

  return {
    source,
    endpoints,
    metadata: {
      format: 'markdown',
      totalEndpoints: endpoints.length,
    },
  };
}

function extractEndpointsFromText(text: string, _lang: string): RawEndpoint[] {
  const endpoints: RawEndpoint[] = [];
  const lines = text.split('\n');

  for (const line of lines) {
    const trimmed = line.trim();
    const match = trimmed.match(ENDPOINT_REGEX);
    if (match) {
      endpoints.push({
        method: match[1].toUpperCase(),
        path: match[2],
        summary: trimmed.replace(match[0], '').trim() || undefined,
        parameters: [],
        responses: [],
      });
    }
  }

  return endpoints;
}
