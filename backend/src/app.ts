import cors from 'cors';
import express, { type Express, type NextFunction, type Request, type Response } from 'express';
import swaggerUi from 'swagger-ui-express';
import apiRouter from './routes';
import { openApiDocument } from './infrastructure/openapi/document';
import { HttpError } from './shared/http';
import contractorDirectoryRouter from './features/contractors/routes';
import watchdogRouter from './features/watchdog/routes';
import publicApiRouter from './features/public-api/routes';

export function createApp(): Express {
  const app = express();
  const nodeEnv = process.env.NODE_ENV ?? 'development';
  const allowedOrigins = (process.env.FRONTEND_URLS ?? process.env.FRONTEND_URL ?? '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

  app.disable('x-powered-by');
  const developmentOrigins = ['http://localhost:5173', 'http://127.0.0.1:5173'];
  const corsOrigins = allowedOrigins.length ? allowedOrigins : (nodeEnv === 'development' ? developmentOrigins : []);
  app.use(cors({
    origin(origin, callback) {
      if (!origin || corsOrigins.includes(origin)) return callback(null, true);
      return callback(new HttpError(403, 'Origin is not allowed by CORS policy.'));
    },
    credentials: true,
  }));
  app.use(express.json({ limit: '2mb' }));
  app.use(express.urlencoded({ extended: true }));
  app.get('/api/openapi.json', (_req, res) => res.json(openApiDocument));
  app.get('/api/docs.json', (_req, res) => res.redirect(308, '/api/openapi.json'));
  app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(openApiDocument));
  app.get('/', (_req, res) => res.json({
    name: 'Open Budget Nepal API',
    version: '1.0.0',
    health: '/api/v1/health',
    documentation: '/api/docs',
  }));
  app.use('/api/v1', publicApiRouter);
  app.use('/api/contractor-directory', contractorDirectoryRouter);
  app.use('/api/suspicious-activities', watchdogRouter);
  app.use('/api', apiRouter);
  app.use((req: Request, res: Response) => {
    res.status(404).json({ error: { code: 'NOT_FOUND', message: 'The requested resource was not found.', details: [] } });
  });
  app.use((error: Error, _req: Request, res: Response, _next: NextFunction) => {
    const statusCode = error instanceof HttpError ? error.statusCode : 500;
    if (statusCode >= 500) console.error(error);
    const code = statusCode === 400 ? 'INVALID_QUERY' : statusCode === 403 ? 'FORBIDDEN' : statusCode === 404 ? 'NOT_FOUND' : 'INTERNAL_ERROR';
    res.status(statusCode).json({ error: { code, message: statusCode >= 500 ? 'An unexpected server error occurred.' : error.message, details: [] } });
  });
  return app;
}
