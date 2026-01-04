import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  
  // Enable CORS with better configuration
  app.enableCors({
    origin: [
      process.env.FRONTEND_URL || 'http://localhost:3000',
      'http://localhost:3000',
      'http://localhost:3001',
    ],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Accept'],
  });
  
  const port = process.env.PORT || 4000;
  await app.listen(port);
  console.log(`\ud83d\ude80 Server running on http://localhost:${port}`);
  console.log(`\ud83c\udfaf Health check: http://localhost:${port}/health`);
}
bootstrap();
