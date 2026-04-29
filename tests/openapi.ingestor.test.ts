import { describe, it, expect } from 'vitest';
import { ingestOpenApi } from '../src/ingestors/openapi.ingestor.js';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

describe('openapi.ingestor', () => {
  it('should parse the Petstore fixture and extract at least 5 endpoints', async () => {
    const fixturePath = path.resolve(__dirname, '../fixtures/petstore.openapi.json');

    const result = await ingestOpenApi(fixturePath);

    expect(result.source).toBe(fixturePath);
    expect(result.endpoints.length).toBeGreaterThanOrEqual(5);
  });

  it('should have method, path, and summary for every endpoint', async () => {
    const fixturePath = path.resolve(__dirname, '../fixtures/petstore.openapi.json');

    const result = await ingestOpenApi(fixturePath);

    for (const ep of result.endpoints) {
      expect(ep.method).toBeDefined();
      expect(ep.method.length).toBeGreaterThan(0);
      expect(ep.path).toBeDefined();
      expect(ep.path.length).toBeGreaterThan(0);
      // summary may be undefined but if present it must be a string
      if (ep.summary !== undefined) {
        expect(typeof ep.summary).toBe('string');
      }
    }
  });

  it('should group endpoints by tags', async () => {
    const fixturePath = path.resolve(__dirname, '../fixtures/petstore.openapi.json');

    const result = await ingestOpenApi(fixturePath);

    const tags = new Set<string>();
    for (const ep of result.endpoints) {
      if (ep.tags) {
        for (const tag of ep.tags) {
          tags.add(tag);
        }
      }
    }

    expect(tags.size).toBeGreaterThanOrEqual(2);
    expect(tags.has('pet')).toBe(true);
  });

  it('should extract parameters for endpoints that have them', async () => {
    const fixturePath = path.resolve(__dirname, '../fixtures/petstore.openapi.json');

    const result = await ingestOpenApi(fixturePath);

    const withParams = result.endpoints.filter((ep) => ep.parameters.length > 0);
    expect(withParams.length).toBeGreaterThan(0);

    // Verify a specific endpoint: GET /pet/findByStatus
    const findByStatus = result.endpoints.find(
      (ep) => ep.method === 'GET' && ep.path === '/pet/findByStatus',
    );
    expect(findByStatus).toBeDefined();
    expect(findByStatus!.parameters.length).toBeGreaterThan(0);
    expect(findByStatus!.parameters[0].name).toBe('status');
  });
});
