import assert from 'node:assert/strict';
import test from 'node:test';
import { collection, enumValue, pagination } from './http';

test('pagination defaults and collection response are stable', () => {
  const parsed = pagination({});
  assert.deepEqual(parsed, { page: 1, limit: 25, skip: 0 });
  assert.deepEqual(collection([], 1, 25, 0), { data: [], pagination: { page: 1, limit: 25, total: 0, totalPages: 0 }, meta: {} });
});

test('pagination rejects an invalid query and caps supported page size', () => {
  assert.throws(() => pagination({ page: '0' }), /page must be between 1/);
  assert.throws(() => pagination({ limit: '101' }), /limit must be between 1 and 100/);
});

test('sorting is whitelist validated', () => {
  assert.equal(enumValue('name_asc', 'sort', ['name_asc', 'name_desc'] as const), 'name_asc');
  assert.throws(() => enumValue('DROP TABLE', 'sort', ['name_asc'] as const), /sort must be one of/);
});
