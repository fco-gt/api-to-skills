import OpenAPIParser from '@readme/openapi-parser';
import type { OpenAPIV3 } from 'openapi-types';
import type {
  RawEndpoint,
  IngestorResult,
  Parameter,
  ResponseDefinition,
  RequestBody,
} from '../types/index.js';
import { validateEndpoints } from '../validators/endpoint.validation.js';

/**
 * Parse an OpenAPI/Swagger spec (JSON or YAML) and extract all endpoints.
 */
export async function ingestOpenApi(source: string): Promise<IngestorResult> {
  const api = (await OpenAPIParser.validate(source)) as OpenAPIV3.Document;

  const endpoints: RawEndpoint[] = [];
  const title = typeof api.info.title === 'string' ? api.info.title : 'Unknown API';

  for (const [path, pathItem] of Object.entries(api.paths)) {
    if (!pathItem) continue;

    const methods = ['get', 'post', 'put', 'patch', 'delete', 'head', 'options'] as const;

    for (const method of methods) {
      const operation = pathItem[method];
      if (!operation) continue;

      const parameters: Parameter[] = [];

      // Merge path-level and operation-level parameters
      const allParams = [...(pathItem.parameters ?? []), ...(operation.parameters ?? [])];

      for (const param of allParams) {
        // Handle $ref (OpenAPIParser resolves most, but be safe)
        if (typeof param === 'object' && 'name' in param && 'in' in param) {
          const p = param as unknown as Record<string, unknown>;
          parameters.push({
            name: typeof p.name === 'string' ? p.name : '',
            in: (typeof p.in === 'string' ? p.in : 'query') as unknown as Parameter['in'],
            required: Boolean(p.required),
            description: typeof p.description === 'string' ? p.description : '',
            schema:
              typeof p.schema === 'object' && p.schema !== null
                ? (p.schema as Record<string, unknown>)
                : undefined,
          });
        }
      }

      const requestBody: RequestBody | undefined = operation.requestBody
        ? (() => {
            const body = operation.requestBody as unknown as Record<string, unknown>;
            const content = body.content as
              | Record<string, { schema?: Record<string, unknown> }>
              | undefined;
            return {
              description: typeof body.description === 'string' ? body.description : '',
              required: Boolean(body.required),
              content,
            };
          })()
        : undefined;

      const responses: ResponseDefinition[] = [];
      for (const [status, resp] of Object.entries(operation.responses)) {
        const r = resp as unknown as Record<string, unknown>;
        const content = r.content as
          | Record<string, { schema?: Record<string, unknown> }>
          | undefined;
        responses.push({
          statusCode: status,
          description: typeof r.description === 'string' ? r.description : '',
          content,
        });
      }

      const tags = Array.isArray(operation.tags) ? operation.tags.map(String) : undefined;

      endpoints.push({
        method: method.toUpperCase(),
        path,
        summary: typeof operation.summary === 'string' ? operation.summary : undefined,
        description: typeof operation.description === 'string' ? operation.description : undefined,
        parameters,
        requestBody,
        responses,
        tags,
      });
    }
  }

  const valid = validateEndpoints(endpoints);

  return {
    source,
    endpoints: valid,
    metadata: {
      title,
      version: typeof api.info.version === 'string' ? api.info.version : 'unknown',
      totalEndpoints: valid.length,
    },
  };
}
