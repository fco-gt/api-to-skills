import type { EnrichedEndpoint, ToolInputSchema } from '../types/index.js';

/** Build the input_schema for a single endpoint. */
function buildInputSchema(endpoint: EnrichedEndpoint): ToolInputSchema {
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

  // Add request body fields if available
  if (endpoint.requestBody?.content) {
    for (const [_ct, schema] of Object.entries(endpoint.requestBody.content)) {
      if (schema.schema?.properties) {
        for (const [key, val] of Object.entries(schema.schema.properties)) {
          if (!(key in properties)) {
            properties[key] = {
              type: (val as Record<string, unknown>).type ?? 'string',
              description: (val as Record<string, unknown>).description ?? key,
            };
          }
        }
        if (schema.schema.required && Array.isArray(schema.schema.required)) {
          for (const r of schema.schema.required as string[]) {
            if (!required.includes(r)) required.push(r);
          }
        }
      }
    }
  }

  // Fallback: add a body field
  if (Object.keys(properties).length === 0) {
    properties.body = {
      type: 'string',
      description: 'Request body or payload',
    };
  }

  return { type: 'object', properties, required };
}

/**
 * Generate the full content of a skill .ts file from enriched endpoints.
 * This is the canonical template used by the generator.
 */
export function generateSkillTemplate(
  skillName: string,
  description: string,
  endpoints: EnrichedEndpoint[],
): string {
  const tools = endpoints.map((ep) => ({
    name: `${ep.skillName}_${ep.method.toLowerCase()}_${ep.path.replace(/[^a-zA-Z0-9]/g, '_')}`,
    description: ep.semanticDescription,
    input_schema: buildInputSchema(ep),
  }));

  const toolsJson = JSON.stringify(tools, null, 2);

  return `// Auto-generated skill file — do not edit manually
// Generated at: ${new Date().toISOString()}
// Skill: ${skillName}

export const ${skillName}Skill = {
  name: "${skillName}",
  description: "${description.replace(/"/g, '\\"')}",
  version: "1.0.0",
  tools: ${toolsJson} as const,
} as const;
`;
}
