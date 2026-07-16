import cors from 'cors';
import dotenv from 'dotenv';
import express, { type Express, type NextFunction, type Request, type Response } from 'express';
import swaggerUi from 'swagger-ui-express';
import apiRouter from './routes';
import { prisma } from './lib/prisma';
import { HttpError } from './utils/http';
import { openApiDocument } from './swagger';

dotenv.config();

const app: Express = express();
const PORT = Number(process.env.PORT ?? 3001);
const NODE_ENV = process.env.NODE_ENV ?? 'development';
const allowedOrigins = (process.env.FRONTEND_URLS ?? process.env.FRONTEND_URL ?? '')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

app.disable('x-powered-by');
app.use(cors({ origin: allowedOrigins.length ? allowedOrigins : true, credentials: true }));
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true }));
app.get('/api/docs.json', (_req: Request, res: Response) => {
  res.json(openApiDocument);
});
app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(openApiDocument));

app.get('/', (_req: Request, res: Response) => {
  res.json({
    name: 'Open Budget Nepal API',
    version: '1.0.0',
    seedSource: '/app/csv in Docker, or ../csv locally',
    endpoints: {
      health: '/api/health',
      seedSummary: '/api/seed-summary',
      nationalBudget: '/api/national-budget',
      fiscalTransfers: '/api/fiscal-transfers',
      subnationalFinance: '/api/subnational-finance',
      monthlyExecution: '/api/monthly-execution',
      localGranularData: '/api/local-granular-data',
      ministryAllocations: '/api/ministry-allocations',
      publicFinance: '/api/public-finance',
      economicIndicators: '/api/economic-indicators',
      localBudgets: '/api/local-budgets',
      provincialBudget: '/api/provincial-budget',
      gandakiProjects: '/api/gandaki-projects',
      contracts: '/api/contracts',
      contractors: '/api/contractors',
      contractorLocations: '/api/contractor-locations',
      suspiciousActivities: '/api/suspicious-activities',
      feedback: '/api/feedback',
      docs: '/api/docs',
      openapi: '/api/docs.json',
    },
  });
});

app.use('/api', apiRouter);

app.use((req: Request, res: Response) => {
  res.status(404).json({ error: 'Not Found', path: req.path, method: req.method });
});

app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  const statusCode = err instanceof HttpError ? err.statusCode : 500;
  if (statusCode >= 500) console.error(err);

  res.status(statusCode).json({
    error: statusCode >= 500 ? 'Internal Server Error' : err.message,
    message: NODE_ENV === 'development' ? err.message : undefined,
  });
});

const server = app.listen(PORT, () => {
  console.log(`Open Budget Nepal API running on http://localhost:${PORT}`);
  console.log(`Environment: ${NODE_ENV}`);
});

const shutdown = async () => {
  await prisma.$disconnect();
  server.close(() => process.exit(0));
};

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

export default app;
export { server };
