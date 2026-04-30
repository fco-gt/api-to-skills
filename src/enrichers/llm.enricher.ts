import Anthropic from '@anthropic-ai/sdk';
import type { RawEndpoint, EnrichedEndpoint } from '../types/index.js';
import { logger } from '../utils/logger.js';

const MODEL = 'claude-sonnet-4-20250514';

const SYSTEM_PROMPT = `You are an API documentation expert. Given an HTTP endpoint, you must return a JSON object with:
- semanticDescription: A clear description of what this endpoint does and WHEN an AI agent should use it.
- usageExample: A natural-language example of when and how an agent would call this endpoint.
- skillName: A short camelCase identifier for the skill this endpoint belongs to (e.g., "userManagement", "petCatalog").

Return ONLY valid JSON. No markdown, no explanations.`;

function buildUserPrompt(endpoint: RawEndpoint): string {
  const parts: string[] = [];
  parts.push(`Method: ${endpoint.method}`);
  parts.push(`Path: ${endpoint.path}`);
  if (endpoint.summary) parts.push(`Summary: ${endpoint.summary}`);
  if (endpoint.description) parts.push(`Description: ${endpoint.description}`);
  if (endpoint.tags?.length) parts.push(`Tags: ${endpoint.tags.join(', ')}`);
  if (endpoint.parameters.length) {
    parts.push('Parameters:');
    for (const p of endpoint.parameters) {
      parts.push(
        `  - ${p.name} (${p.in})${p.required ? ' [required]' : ''}: ${p.description ?? ''}`,
      );
    }
  }
  if (endpoint.requestBody) {
    parts.push(`Request body: ${endpoint.requestBody.description ?? 'No description'}`);
  }
  if (endpoint.responses.length) {
    parts.push('Responses:');
    for (const r of endpoint.responses.slice(0, 3)) {
      parts.push(`  - ${r.statusCode}: ${r.description}`);
    }
  }
  return parts.join('\n');
}

async function enrichSingle(client: Anthropic, endpoint: RawEndpoint): Promise<EnrichedEndpoint> {
  const prompt = buildUserPrompt(endpoint);

  const message = await client.messages.create({
    model: MODEL,
    max_tokens: 512,
    system: SYSTEM_PROMPT,
    messages: [{ role: 'user', content: prompt }],
  });

  const text = message.content
    .filter((block): block is { type: 'text'; text: string } => block.type === 'text')
    .map((block) => block.text)
    .join('\n')
    .trim();

  // Try to parse JSON from the response (might have markdown code fences)
  const cleaned = text
    .replace(/^```(?:json)?\n?/i, '')
    .replace(/\n?```$/i, '')
    .trim();

  try {
    const parsed = JSON.parse(cleaned) as {
      semanticDescription: string;
      usageExample: string;
      skillName: string;
    };
    return {
      ...endpoint,
      semanticDescription:
        parsed.semanticDescription || `Endpoint ${endpoint.method} ${endpoint.path}`,
      usageExample:
        parsed.usageExample ||
        `Call ${endpoint.method} ${endpoint.path} with the required parameters.`,
      skillName: parsed.skillName || 'defaultSkill',
    };
  } catch {
    logger.warn(
      `Failed to parse LLM response for ${endpoint.method} ${endpoint.path}, using defaults`,
    );
    return {
      ...endpoint,
      semanticDescription: `Endpoint ${endpoint.method} ${endpoint.path}. ${endpoint.summary || ''}`,
      usageExample: `Call ${endpoint.method} ${endpoint.path} with the required parameters.`,
      skillName: 'defaultSkill',
    };
  }
}

/**
 * Enrich endpoints using Claude LLM.
 * Falls back to basic enrichment if API key is not available.
 */
export async function enrichWithLlm(endpoints: RawEndpoint[]): Promise<EnrichedEndpoint[]> {
  const apiKey = process.env.ANTHROPIC_API_KEY;

  if (!apiKey) {
    logger.warn(
      'ANTHROPIC_API_KEY not set. Skipping LLM enrichment — endpoints will have default values.',
    );
    return endpoints.map((ep) => ({
      ...ep,
      semanticDescription: `Endpoint ${ep.method} ${ep.path}. ${ep.summary || ''}`,
      usageExample: `Call ${ep.method} ${ep.path} with the required parameters.`,
      skillName: ep.tags?.[0]?.replace(/\s+/g, '_') || 'defaultSkill',
    }));
  }

  const client = new Anthropic({ apiKey });
  const enriched: EnrichedEndpoint[] = [];

  for (let i = 0; i < endpoints.length; i++) {
    const ep = endpoints[i];
    logger.info(
      `Enriching [${String(i + 1)}/${String(endpoints.length)}]: ${ep.method} ${ep.path}...`,
    );
    try {
      const result = await enrichSingle(client, ep);
      enriched.push(result);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      logger.warn(`LLM error for ${ep.method} ${ep.path}: ${message}`);
      enriched.push({
        ...ep,
        semanticDescription: `Endpoint ${ep.method} ${ep.path}. ${ep.summary ?? ''}`,
        usageExample: `Call ${ep.method} ${ep.path} with the required parameters.`,
        skillName: ep.tags?.[0]?.replace(/\s+/g, '_') ?? 'defaultSkill',
      });
    }
  }

  return enriched;
}
