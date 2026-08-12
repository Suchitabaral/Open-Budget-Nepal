import { DEFAULT_LIMIT, MAX_LIMIT, PUBLIC_RATE_LIMIT } from '../../features/public-api/http';

type Endpoint = { path: string; tag: string; summary: string; detail?: boolean; parameters?: string[] };

// Public route catalog is the documentation source of truth. Keep each entry beside
// the route surface, and use shared component schemas for response details.
const endpoints: Endpoint[] = [
  { path: '/health', tag: 'System', summary: 'Check API and database health' },
  { path: '/meta/fiscal-years', tag: 'Metadata', summary: 'List fiscal years represented in public datasets' },
  { path: '/meta/provinces', tag: 'Geography', summary: 'List Nepal provinces' },
  { path: '/meta/districts', tag: 'Geography', summary: 'List districts', parameters: ['provinceId'] },
  { path: '/meta/municipalities', tag: 'Geography', summary: 'List local levels', parameters: ['provinceId', 'districtId'] },
  { path: '/meta/procurement-categories', tag: 'Metadata', summary: 'List procurement categories present in contract records' },
  { path: '/budgets', tag: 'Budgets', summary: 'List federal budget records', parameters: ['fiscalYear', 'governmentLevel', 'ministry', 'page', 'limit'] },
  { path: '/budgets/{id}', tag: 'Budgets', summary: 'Get a federal budget record', detail: true },
  { path: '/projects', tag: 'Projects', summary: 'List distinct project/program records', parameters: ['q', 'fiscalYear', 'provinceId', 'municipalityId', 'page', 'limit', 'projectSort'] },
  { path: '/projects/{id}', tag: 'Projects', summary: 'Get a project/program record', detail: true },
  { path: '/contractors', tag: 'Contractors', summary: 'List factual contractor records', parameters: ['q', 'pan', 'contractorType', 'page', 'limit', 'nameSort'] },
  { path: '/contractors/{id}', tag: 'Contractors', summary: 'Get a factual contractor profile', detail: true },
  { path: '/contractors/{id}/contracts', tag: 'Contractors', summary: 'List contracts linked to a contractor', parameters: ['page', 'limit'] },
  { path: '/contracts', tag: 'Contracts', summary: 'List awarded contracts', parameters: ['q', 'fiscalYear', 'contractorId', 'projectId', 'procurementCategory', 'page', 'limit', 'contractSort'] },
  { path: '/contracts/{id}', tag: 'Contracts', summary: 'Get an awarded contract', detail: true },
  { path: '/procurements', tag: 'Procurement', summary: 'List procurement-classified awarded records', parameters: ['q', 'fiscalYear', 'contractorId', 'projectId', 'procurementCategory', 'page', 'limit', 'contractSort'] },
  { path: '/procurements/{id}', tag: 'Procurement', summary: 'Get a procurement-classified awarded record', detail: true },
  { path: '/watchdog/findings', tag: 'Watchdog', summary: 'List deterministic rule-based Watchdog findings', parameters: ['rule', 'severity', 'fiscalYear', 'contractorId', 'page', 'limit'] },
  { path: '/watchdog/findings/{id}', tag: 'Watchdog', summary: 'Get a Watchdog finding and its evidence', detail: true },
];

const parameters: Record<string, object> = {
  id: { name: 'id', in: 'path', required: true, schema: { type: 'string' }, description: 'Resource identifier.' },
  page: { name: 'page', in: 'query', schema: { type: 'integer', minimum: 1, default: 1 } },
  limit: { name: 'limit', in: 'query', schema: { type: 'integer', minimum: 1, maximum: MAX_LIMIT, default: DEFAULT_LIMIT } },
  q: { name: 'q', in: 'query', schema: { type: 'string', maxLength: 200 }, description: 'Case-insensitive text search.' },
  fiscalYear: { name: 'fiscalYear', in: 'query', schema: { type: 'string', example: '2081/82' } },
  governmentLevel: { name: 'governmentLevel', in: 'query', schema: { type: 'string', enum: ['federal'] }, description: 'Only normalized federal rows are available at this endpoint.' },
  ministry: { name: 'ministry', in: 'query', schema: { type: 'string' }, description: 'Search the available budget classification label.' },
  provinceId: { name: 'provinceId', in: 'query', schema: { type: 'string' } },
  districtId: { name: 'districtId', in: 'query', schema: { type: 'string' } },
  municipalityId: { name: 'municipalityId', in: 'query', schema: { type: 'string' } },
  pan: { name: 'pan', in: 'query', schema: { type: 'string' }, description: 'Exact PAN value, handled as a string.' },
  contractorType: { name: 'contractorType', in: 'query', schema: { type: 'string' } },
  contractorId: { name: 'contractorId', in: 'query', schema: { type: 'integer', minimum: 1 } },
  projectId: { name: 'projectId', in: 'query', schema: { type: 'integer', minimum: 1 } },
  procurementCategory: { name: 'procurementCategory', in: 'query', schema: { type: 'string' } },
  rule: { name: 'rule', in: 'query', schema: { type: 'string', enum: ['SEVERE_DELAY', 'COST_OVERRUN', 'HIGH_CONCENTRATION'] } },
  severity: { name: 'severity', in: 'query', schema: { type: 'string', enum: ['High', 'Medium'] } },
  projectSort: { name: 'sort', in: 'query', schema: { type: 'string', enum: ['name_asc', 'name_desc', 'budget_asc', 'budget_desc'], default: 'name_asc' } },
  nameSort: { name: 'sort', in: 'query', schema: { type: 'string', enum: ['name_asc', 'name_desc'], default: 'name_asc' } },
  contractSort: { name: 'sort', in: 'query', schema: { type: 'string', enum: ['name_asc', 'name_desc', 'amount_asc', 'amount_desc', 'date_asc', 'date_desc'], default: 'date_desc' } },
};

const publicPaths = Object.fromEntries(endpoints.map(endpoint => [endpoint.path, {
  get: {
    tags: [endpoint.tag],
    summary: endpoint.summary,
    operationId: `get${endpoint.path.replace(/[{}]/g, '').split('/').filter(Boolean).map(part => part[0].toUpperCase() + part.slice(1)).join('')}`,
    parameters: [
      ...(endpoint.path.includes('{id}') ? [parameters.id] : []),
      ...(endpoint.parameters ?? []).map(name => parameters[name]),
    ],
    responses: {
      '200': { description: 'Successful response.', content: { 'application/json': { schema: { $ref: endpoint.detail || !endpoint.parameters?.includes('page') ? '#/components/schemas/DetailResponse' : '#/components/schemas/CollectionResponse' } } } },
      '400': { $ref: '#/components/responses/InvalidQuery' },
      '404': { $ref: '#/components/responses/NotFound' },
      '429': { $ref: '#/components/responses/RateLimited' },
      '500': { $ref: '#/components/responses/InternalError' },
    },
  },
}]));

export const openApiDocument = {
  openapi: '3.0.3',
  info: {
    title: 'Open Budget Nepal Public API', version: '1.0.0',
    description: `Public, read-only access to available Nepal budget, project, procurement, contractor, contract and Watchdog data. No authentication is currently required. Monetary values are decimal strings in NPR. The runtime limit is ${PUBLIC_RATE_LIMIT} requests per minute per client IP.`,
  },
  servers: [{ url: '/api/v1', description: 'Version 1 public API' }],
  tags: ['Budgets', 'Projects', 'Contractors', 'Procurement', 'Contracts', 'Watchdog', 'Geography', 'Metadata', 'System'].map(name => ({ name })),
  paths: publicPaths,
  components: {
    schemas: {
      Pagination: { type: 'object', required: ['page', 'limit', 'total', 'totalPages'], properties: { page: { type: 'integer', example: 1 }, limit: { type: 'integer', example: 25 }, total: { type: 'integer', example: 0 }, totalPages: { type: 'integer', example: 0 } } },
      CollectionResponse: { type: 'object', required: ['data', 'pagination', 'meta'], properties: { data: { type: 'array', items: { type: 'object', additionalProperties: true } }, pagination: { $ref: '#/components/schemas/Pagination' }, meta: { type: 'object', additionalProperties: true } } },
      DetailResponse: { type: 'object', required: ['data'], properties: { data: { nullable: true, oneOf: [{ type: 'object', additionalProperties: true }, { type: 'array', items: {} }] } } },
      Error: { type: 'object', required: ['error'], properties: { error: { type: 'object', required: ['code', 'message', 'details'], properties: { code: { type: 'string', example: 'INVALID_QUERY' }, message: { type: 'string' }, details: { type: 'array', items: {} } } } } },
    },
    responses: {
      InvalidQuery: { description: 'The supplied query or path parameters are invalid.', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
      NotFound: { description: 'The requested resource was not found.', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
      RateLimited: { description: 'Public API request limit exceeded.', headers: { 'Retry-After': { schema: { type: 'integer' } }, 'RateLimit-Limit': { schema: { type: 'integer' } }, 'RateLimit-Remaining': { schema: { type: 'integer' } } }, content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
      InternalError: { description: 'Unexpected server error. Internal details are not exposed.', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
    },
  },
};
