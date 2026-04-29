import type { IngestorResult } from "../types/index.js";
import { ingestOpenApi } from "./openapi.ingestor.js";
import { logger } from "../utils/logger.js";

const SPEC_PATHS = [
  "/openapi.json",
  "/swagger.json",
  "/api-docs",
  "/api-docs.json",
];

/**
 * Attempt to discover an OpenAPI spec from a base URL.
 * Tries common spec paths and delegates to the OpenAPI ingestor if found.
 */
export async function ingestUrl(baseUrl: string): Promise<IngestorResult> {
  const normalized = baseUrl.replace(/\/+$/, "");

  // If the URL already is a spec URL, try it directly
  const looksLikeSpec = /\.(json|yaml|yml)$/.test(new URL(normalized).pathname);
  if (looksLikeSpec) {
    try {
      logger.info(`URL looks like a direct spec, trying ${normalized}...`);
      return await ingestOpenApi(normalized);
    } catch {
      logger.warn(
        `Could not parse ${normalized} as OpenAPI spec, falling back to discovery...`,
      );
    }
  }

  // Origin discovery
  const origin = new URL(normalized).origin;
  for (const specPath of SPEC_PATHS) {
    const url = `${origin}${specPath}`;
    try {
      logger.info(`Trying spec at ${url}...`);
      const response = await fetch(url, { signal: AbortSignal.timeout(5000) });
      if (response.ok) {
        logger.success(`Found OpenAPI spec at ${url}`);
        return ingestOpenApi(url);
      }
    } catch {
      // Continue trying next path
    }
  }

  // No spec found — return a minimal result indicating manual enrichment needed
  logger.warn(
    `No OpenAPI spec found at common paths for ${baseUrl}. ` +
      "The URL ingestor requires a discoverable spec. " +
      "Consider downloading the spec manually and using --format openapi.",
  );

  return {
    source: baseUrl,
    endpoints: [],
    metadata: {
      discovered: false,
      triedPaths: SPEC_PATHS.map((p) => `${normalized}${p}`),
      message: "No spec found at common discovery paths",
    },
  };
}
