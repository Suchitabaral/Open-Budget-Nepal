import dotenv from 'dotenv';
dotenv.config();

import { createApp } from './app';
import { prisma } from './infrastructure/database/prisma';

const port = Number(process.env.PORT ?? 3001);
const app = createApp();
const server = app.listen(port, () => {
  console.log(`Open Budget Nepal API running on http://localhost:${port}`);
});

async function shutdown() {
  await prisma.$disconnect();
  server.close(() => process.exit(0));
}

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

export { app, server };
