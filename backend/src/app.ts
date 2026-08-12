import cors from 'cors';
import express, { type Express, type NextFunction, type Request, type Response } from 'express';
import swaggerUi from 'swagger-ui-express';
import apiRouter from './routes';
import { openApiDocument } from './infrastructure/openapi/document';
import { HttpError } from './shared/http';
import contractorDirectoryRouter from './features/contractors/routes';
import watchdogRouter from './features/watchdog/routes';

export function createApp(): Express {
  const app = express();
  const nodeEnv = process.env.NODE_ENV ?? 'development';
  const allowedOrigins = (process.env.FRONTEND_URLS ?? process.env.FRONTEND_URL ?? '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

  app.disable('x-powered-by');
  app.use(cors({ origin: allowedOrigins.length ? allowedOrigins : true, credentials: true }));
  app.use(express.json({ limit: '2mb' }));
  app.use(express.urlencoded({ extended: true }));
  app.get('/api/docs.json', (_req, res) => res.json(openApiDocument));
  app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(openApiDocument));
  app.get('/', (_req, res) => res.json({
    name: 'Open Budget Nepal API',
    version: '1.0.0',
    health: '/api/health',
    documentation: '/api/docs',
  }));
  app.use('/api/contractor-directory', contractorDirectoryRouter);
  app.use('/api/suspicious-activities', watchdogRouter);
  app.use('/api', apiRouter);
  app.use((req: Request, res: Response) => {
    res.status(404).json({ error: 'Not Found', path: req.path, method: req.method });
  });
  app.use((error: Error, _req: Request, res: Response, _next: NextFunction) => {
    const statusCode = error instanceof HttpError ? error.statusCode : 500;
    if (statusCode >= 500) console.error(error);
    res.status(statusCode).json({
      error: statusCode >= 500 ? 'Internal Server Error' : error.message,
      message: nodeEnv === 'development' ? error.message : undefined,
    });
  });
  return app;
}
