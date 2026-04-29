import { z } from 'zod';
import type { RawEndpoint } from '../types/index.js';

const ParameterSchema = z.object({
  name: z.string().min(1),
  in: z.enum(['path', 'query', 'header', 'cookie']),
  required: z.boolean().optional(),
  description: z.string().optional(),
  schema: z.record(z.unknown()).optional(),
});

const ResponseSchema = z.object({
  statusCode: z.string().min(1),
  description: z.string().default(''),
  content: z.record(z.string(), z.object({
    schema: z.record(z.unknown()).optional(),
  })).optional(),
});

const RawEndpointSchema = z.object({
  method: z.string().min(1),
  path: z.string().min(1),
  summary: z.string().optional(),
  description: z.string().optional(),
  parameters: z.array(ParameterSchema).default([]),
  requestBody: z.object({
    description: z.string().optional(),
    required: z.boolean().optional(),
    content: z.record(z.string(), z.object({
      schema: z.record(z.unknown()).optional(),
    })).optional(),
  }).optional(),
  responses: z.array(ResponseSchema).default([]),
  tags: z.array(z.string()).optional(),
});

/** Validate a single RawEndpoint. Throws if invalid. */
export function validateEndpoint(endpoint: unknown): RawEndpoint {
  return RawEndpointSchema.parse(endpoint);
}

/** Validate an array of RawEndpoints, filtering out invalid ones. */
export function validateEndpoints(endpoints: unknown[]): RawEndpoint[] {
  const valid: RawEndpoint[] = [];
  for (const ep of endpoints) {
    try {
      valid.push(validateEndpoint(ep));
    } catch {
      // silently skip malformed endpoints
    }
  }
  return valid;
}
