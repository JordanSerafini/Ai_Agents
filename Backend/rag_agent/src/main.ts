import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { Logger } from '@nestjs/common';

async function bootstrap() {
  const logger = new Logger('Bootstrap');
  const app = await NestFactory.create(AppModule);
  
  // Activer CORS pour permettre les requêtes depuis d'autres domaines
  app.enableCors();
  
  const port = process.env.PORT ?? 3004;
  await app.listen(port);
  logger.log(`Application RAG Agent démarrée sur le port ${port}`);
}
bootstrap();
