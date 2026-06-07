import express, {Express, NextFunction, Request, Response} from 'express';
import dotenv from 'dotenv';
import cors from 'cors';

dotenv.config();

const app: Express=express();
const PORT=process.env.PORT || 3000;
const NODE_ENV=process.env.NODE_ENV || 'development';

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({extended: true}));

app.get('/api/health', (req: Request, res: Response) => {
    res.json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        environment: NODE_ENV,
    });
});

app.get('/', (req: Request, res: Response) => {
    res.json({
        message: 'Open Budget Nepal - Backend API',
        version: '1.0.0',
        endpoints: {
            health: '/api/health',
        },
    });
});

app.use((req: Request, res: Response) => {
    res.status(404).json({
        error: '404 Not Found',
        path: req.path,
        method: req.method,
    });
});

app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
    console.error('Error:', err);
    res.status(500).json({
        error: 'Internal Server Error',
        message: NODE_ENV === 'development' ? err.message : 'Something went wrong',
    });
});

app.listen(PORT, () => {
    console.log(`\nServer running on http://localhost:${PORT}`);
    console.log(`Environment: ${NODE_ENV}`);
    console.log(`Database: ${process.env.DATABASE_URL ? 'Configured' : 'NOT configured'}`);
})

export default app;