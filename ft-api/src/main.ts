import { type NextFunction, type Request, type Response, json } from 'express';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';

async function bootstrap() {
  const allowedOrigins = [
    'http://localhost:5173',
    'http://localhost:5174',
    'http://localhost:3000',
    ...(process.env.CORS_ORIGINS?.split(',').map((o) => o.trim()) || []),
  ].filter(Boolean);

  const app = await NestFactory.create(AppModule, {
    cors: {
      origin: (origin, callback) => {
        if (!origin || allowedOrigins.includes(origin)) {
          callback(null, true);
        } else {
          callback(new Error('Not allowed by CORS'));
        }
      },
      credentials: true,
    },
    bodyParser: false, // Required for Better Auth (raw body for auth routes)
  });
  // Parse JSON body only for non-auth routes (e.g. /maps) so POST /maps/autocomplete works
  app.use((req: Request, res: Response, next: NextFunction) => {
    if (req.originalUrl?.startsWith('/api/auth')) return next();
    return json()(req, res, next);
  });
  await app.listen(process.env.PORT ?? 3000);
}
void bootstrap();
