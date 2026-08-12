type JsonObject = Record<string, unknown>;

const successResponse = (description: string): JsonObject => ({
  description,
  content: {
    'application/json': {
      schema: {
        type: 'array',
        items: { type: 'object', additionalProperties: true },
      },
    },
  },
});

const limitParameter: JsonObject = {
  name: 'limit',
  in: 'query',
  required: false,
  schema: { type: 'integer', minimum: 1, maximum: 1000, default: 100 },
  description: 'Maximum number of records to return.',
};

export const openApiDocument = {
  openapi: '3.0.3',
  info: {
    title: 'Open Budget Nepal API',
    version: '1.0.0',
    description: 'Public API for budget, finance, contract watchdog, and feedback data.',
  },
  servers: [
    {
      url: '/api',
      description: 'Current API server',
    },
  ],
  tags: [
    { name: 'System' },
    { name: 'Budget' },
    { name: 'Subnational' },
    { name: 'Contracts' },
    { name: 'Watchdog' },
    { name: 'Feedback' },
  ],
  paths: {
    '/health': {
      get: {
        tags: ['System'],
        summary: 'Check API and database health',
        responses: {
          '200': {
            description: 'Backend and database are reachable.',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    status: { type: 'string', example: 'ok' },
                    database: { type: 'string', example: 'connected' },
                    timestamp: { type: 'string', format: 'date-time' },
                  },
                },
              },
            },
          },
        },
      },
    },
    '/seed-summary': {
      get: {
        tags: ['System'],
        summary: 'Get seeded row counts by dataset',
        responses: {
          '200': {
            description: 'Seeded table counts.',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  additionalProperties: { type: 'integer' },
                },
              },
            },
          },
        },
      },
    },
    '/national-budget': {
      get: { tags: ['Budget'], summary: 'List national budget summary rows', responses: { '200': successResponse('National budget rows.') } },
    },
    '/fiscal-transfers': {
      get: { tags: ['Budget'], summary: 'List fiscal transfers', responses: { '200': successResponse('Fiscal transfer rows.') } },
    },
    '/ministry-allocations': {
      get: { tags: ['Budget'], summary: 'List ministry allocations', responses: { '200': successResponse('Ministry allocation rows.') } },
    },
    '/public-finance': {
      get: { tags: ['Budget'], summary: 'List public finance balance sheet rows', responses: { '200': successResponse('Public finance rows.') } },
    },
    '/economic-indicators': {
      get: { tags: ['Budget'], summary: 'List economic indicators', responses: { '200': successResponse('Economic indicator rows.') } },
    },
    '/subnational-finance': {
      get: { tags: ['Subnational'], summary: 'List subnational finance rows', responses: { '200': successResponse('Subnational finance rows.') } },
    },
    '/monthly-execution': {
      get: { tags: ['Subnational'], summary: 'List monthly execution rows', responses: { '200': successResponse('Monthly execution rows.') } },
    },
    '/local-granular-data': {
      get: {
        tags: ['Subnational'],
        summary: 'List local granular project and ward records',
        parameters: [limitParameter],
        responses: { '200': successResponse('Local granular rows.') },
      },
    },
    '/local-budgets': {
      get: {
        tags: ['Subnational'],
        summary: 'List local budget rows',
        parameters: [
          limitParameter,
          {
            name: 'name',
            in: 'query',
            required: false,
            schema: { type: 'string' },
            description: 'Case-insensitive local level name search.',
          },
        ],
        responses: { '200': successResponse('Local budget rows.') },
      },
    },
    '/provincial-budget': {
      get: { tags: ['Subnational'], summary: 'List provincial budget rows', responses: { '200': successResponse('Provincial budget rows.') } },
    },
    '/gandaki-projects': {
      get: {
        tags: ['Subnational'],
        summary: 'List Gandaki project budget rows',
        parameters: [limitParameter],
        responses: { '200': successResponse('Gandaki project rows.') },
      },
    },
    '/contracts': {
      get: {
        tags: ['Contracts'],
        summary: 'List contracts with contractors and milestones',
        parameters: [limitParameter],
        responses: { '200': successResponse('Contract rows.') },
      },
    },
    '/contractors': {
      get: {
        tags: ['Contracts'],
        summary: 'List contractors with linked contracts',
        parameters: [limitParameter],
        responses: { '200': successResponse('Contractor rows.') },
      },
    },
    '/contractor-locations': {
      get: {
        tags: ['Contracts'],
        summary: 'List contractor location rows',
        parameters: [limitParameter],
        responses: { '200': successResponse('Contractor location rows.') },
      },
    },
    '/suspicious-activities': {
      get: {
        tags: ['Watchdog'],
        summary: 'Evaluate deterministic procurement watchdog rules',
        responses: {
          '200': {
            description: 'Rule findings and exact severity counts.',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['findings', 'summary', 'evaluatedAt'],
                  properties: {
                    findings: {
                      type: 'array',
                      items: { $ref: '#/components/schemas/WatchdogFinding' },
                    },
                    summary: {
                      type: 'object',
                      required: ['total', 'high', 'medium'],
                      properties: {
                        total: { type: 'integer' },
                        high: { type: 'integer' },
                        medium: { type: 'integer' },
                      },
                    },
                    evaluatedAt: { type: 'string', format: 'date-time' },
                  },
                },
              },
            },
          },
        },
      },
    },
    '/feedback': {
      get: {
        tags: ['Feedback'],
        summary: 'List submitted user feedback',
        parameters: [
          {
            ...limitParameter,
            schema: { type: 'integer', minimum: 1, maximum: 500, default: 100 },
          },
        ],
        responses: { '200': successResponse('Feedback rows.') },
      },
      post: {
        tags: ['Feedback'],
        summary: 'Submit watchdog or project feedback',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/FeedbackInput' },
            },
          },
        },
        responses: {
          '201': {
            description: 'Feedback created.',
            content: {
              'application/json': {
                schema: { type: 'object', additionalProperties: true },
              },
            },
          },
          '400': { description: 'Feedback comment is required.' },
        },
      },
    },
  },
  components: {
    schemas: {
      WatchdogFinding: {
        type: 'object',
        required: ['id', 'ruleId', 'ruleLabel', 'severity', 'riskScore', 'contractor', 'project', 'details', 'evaluatedAt'],
        properties: {
          id: { type: 'string', example: 'SEVERE_DELAY-contract-42' },
          ruleId: { type: 'string', enum: ['SEVERE_DELAY', 'COST_OVERRUN', 'HIGH_CONCENTRATION'] },
          ruleLabel: { type: 'string', enum: ['Severe Delay', 'Cost Overrun', 'High Concentration'] },
          severity: { type: 'string', enum: ['High', 'Medium'] },
          riskScore: { type: 'integer', minimum: 40, maximum: 100, description: 'Deterministic magnitude score calculated from the rule evidence; not a probability or confidence score.' },
          scoreMethod: { type: 'string', description: 'Plain-language formula used for this finding.' },
          scoreFactors: { type: 'array', items: { type: 'object', properties: { label: { type: 'string' }, value: { type: 'string' }, points: { type: 'integer' } } } },
          dataQualityNotes: { type: 'array', items: { type: 'string' } },
          contractor: { type: 'string' },
          project: { type: 'string' },
          details: { type: 'string' },
          contractId: { type: 'integer' },
          contractorId: { type: 'integer' },
          contractCode: { type: 'string' },
          contractStatus: { type: 'string' },
          fiscalYear: { type: 'string' },
          municipality: { type: 'string' },
          evaluatedAt: { type: 'string', format: 'date-time' },
        },
      },
      FeedbackInput: {
        type: 'object',
        required: ['comment'],
        properties: {
          userName: { type: 'string', example: 'Ansarul Haq' },
          userEmail: { type: 'string', format: 'email', example: 'ansarul@example.com' },
          feedbackType: { type: 'string', example: 'watchdog' },
          contractorId: { type: 'integer', nullable: true },
          contractId: { type: 'integer', nullable: true },
          projectId: { type: 'integer', nullable: true },
          comment: { type: 'string', example: 'This contract needs manual review.' },
          rating: { type: 'integer', minimum: 1, maximum: 5, example: 4 },
          photoUrl: { type: 'string', nullable: true },
          issue: { type: 'object', additionalProperties: true },
        },
      },
    },
  },
} satisfies JsonObject;
