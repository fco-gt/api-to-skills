// ── Core domain types ──────────────────────────────────────────────────────

export interface Parameter {
  name: string;
  in: 'path' | 'query' | 'header' | 'cookie';
  required?: boolean;
  description?: string;
  schema?: Record<string, unknown>;
}

export interface RequestBody {
  description?: string;
  required?: boolean;
  content?: Record<string, { schema?: Record<string, unknown> }>;
}

export interface ResponseDefinition {
  statusCode: string;
  description: string;
  content?: Record<string, { schema?: Record<string, unknown> }>;
}

/** Raw endpoint extracted from any input source. */
export interface RawEndpoint {
  method: string;
  path: string;
  summary?: string;
  description?: string;
  parameters: Parameter[];
  requestBody?: RequestBody;
  responses: ResponseDefinition[];
  tags?: string[];
}

/** Endpoint after LLM semantic enrichment. */
export interface EnrichedEndpoint extends RawEndpoint {
  semanticDescription: string;
  usageExample: string;
  skillName: string;
}

/** Final skill file structure written to disk. */
export interface SkillFile {
  name: string;
  description: string;
  version: string;
  endpoints: EnrichedEndpoint[];
  generatedAt: string;
}

/** Result returned by any ingestor. */
export interface IngestorResult {
  source: string;
  endpoints: RawEndpoint[];
  metadata: Record<string, unknown>;
}

// ── Tool definition compatible with Anthropic Claude tool use ──────────────

export interface ToolInputSchema {
  type: 'object';
  properties: Record<string, unknown>;
  required: string[];
}

export interface ToolDefinition {
  name: string;
  description: string;
  input_schema: ToolInputSchema;
}

// ── CLI options ────────────────────────────────────────────────────────────

export interface CliOptions {
  input: string;
  output: string;
  format?: 'openapi' | 'url' | 'markdown';
  enrich: boolean;
  dryRun: boolean;
}
