import { json } from 'express';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    cors: true,
    bodyParser: false, // Required for Better Auth (raw body for auth routes)
  });
  // Parse JSON body only for non-auth routes (e.g. /maps) so POST /maps/autocomplete works
  app.use((req, res, next) => {
    if (req.originalUrl?.startsWith('/api/auth')) return next();
    return json()(req, res, next);
  });
  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
