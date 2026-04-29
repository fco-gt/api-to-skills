import type { EnrichedEndpoint, ToolDefinition, ToolInputSchema } from '../types/index.js';
import { writeFile, sanitizeFilename, ensureDir } from '../utils/file.js';
import path from 'node:path';

/** Generate the Anthropic-compatible tool definition for an endpoint. */
function endpointToTool(endpoint: EnrichedEndpoint): ToolDefinition {
  const properties: Record<string, unknown> = {};
  const required: string[] = [];

  for (const param of endpoint.parameters) {
    if (param.in === 'path' || param.in === 'query') {
      properties[param.name] = {
        type: param.schema?.type ?? 'string',
        description: param.description ?? `${param.name} parameter`,
      };
      if (param.required) {
        required.push(param.name);
      }
    }
  }

  if (endpoint.requestBody?.content) {
    for (const [_contentType, schema] of Object.entries(endpoint.requestBody.content)) {
      if (schema.schema?.properties) {
        for (const [key, value] of Object.entries(schema.schema.properties)) {
          properties[key] = {
            type: (value as Record<string, unknown>).type ?? 'string',
            description: (value as Record<string, unknown>).description ?? key,
          };
        }
        if (schema.schema.required && Array.isArray(schema.schema.required)) {
          required.push(...(schema.schema.required as string[]));
        }
      }
    }
  }

  // If no properties inferred, add a generic body field
  if (Object.keys(properties).length === 0) {
    properties.url = {
      type: 'string',
      description: `Full URL for ${endpoint.method} ${endpoint.path}`,
    };
  }

  const inputSchema: ToolInputSchema = {
    type: 'object',
    properties,
    required: [...new Set(required)],
  };

  return {
    name: endpoint.skillName
      ? `${endpoint.skillName}_${endpoint.method.toLowerCase()}_${endpoint.path.replace(/[^a-zA-Z0-9]/g, '_')}`
      : `${endpoint.method.toLowerCase()}_${endpoint.path.replace(/[^a-zA-Z0-9]/g, '_')}`,
    description: endpoint.semanticDescription || `${endpoint.method} ${endpoint.path}`,
    input_schema: inputSchema,
  };
}

/** Group endpoints by tag or skill name. */
function groupEndpoints(endpoints: EnrichedEndpoint[]): Map<string, EnrichedEndpoint[]> {
  const groups = new Map<string, EnrichedEndpoint[]>();

  for (const ep of endpoints) {
    // Prefer tags, fall back to skillName
    const groupKey = ep.tags?.[0] ?? ep.skillName ?? 'untagged';
    if (!groups.has(groupKey)) {
      groups.set(groupKey, []);
    }
    groups.get(groupKey)!.push(ep);
  }

  return groups;
}

/** Generate the content of a single skill file. */
export function generateSkillFile(endpoints: EnrichedEndpoint[], groupName: string): string {
  const tools: ToolDefinition[] = endpoints.map(endpointToTool);
  const skillNameCamel = sanitizeFilename(groupName).replace(/^_+|_+$/g, '');

  const toolsJson = JSON.stringify(tools, null, 2);

  return `// Auto-generated skill file — do not edit manually
// Generated at: ${new Date().toISOString()}
// Group: ${groupName}
// Endpoints: ${endpoints.length}

import type { ToolDefinition } from '../types/index.js';

export const ${skillNameCamel}Skill = {
  name: "${groupName}",
  description: "${endpoints[0]?.semanticDescription?.replace(/"/g, '\\"') ?? `Skill for ${groupName}`} — ${endpoints.length} tool(s)",
  version: "1.0.0",
  tools: ${toolsJson} as unknown as ToolDefinition[],
} as const;
`;
}

/**
 * Generate skill files from enriched endpoints.
 * Writes one .ts file per group to the output directory.
 * Returns the number of files written.
 */
export async function generateSkills(
  endpoints: EnrichedEndpoint[],
  outputDir: string,
): Promise<string[]> {
  await ensureDir(outputDir);
  const groups = groupEndpoints(endpoints);
  const written: string[] = [];

  for (const [groupName, groupEndpoints] of groups) {
    const filename = `${sanitizeFilename(groupName)}.skill.ts`;
    const filePath = path.join(outputDir, filename);
    const content = generateSkillFile(groupEndpoints, groupName);
    await writeFile(filePath, content);
    written.push(filePath);
  }

  return written;
}
