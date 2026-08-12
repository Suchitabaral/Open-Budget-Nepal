import assert from 'node:assert/strict';
import test from 'node:test';
import { openApiDocument } from './document';

test('OpenAPI document exposes only versioned implemented paths', () => {
  assert.equal(openApiDocument.openapi, '3.0.3');
  assert.equal(openApiDocument.servers[0].url, '/api/v1');
  assert.ok(openApiDocument.paths['/projects']);
  assert.ok(openApiDocument.paths['/watchdog/findings/{id}']);
  assert.equal(Object.keys(openApiDocument.paths).length, 19);
});
