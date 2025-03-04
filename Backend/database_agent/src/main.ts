import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { Logger } from '@nestjs/common';

async function bootstrap() {
  const logger = new Logger('Bootstrap');
  const app = await NestFactory.create(AppModule);
  
  // Activer CORS
  app.enableCors();
  
  // Préfixe global pour les routes API
  app.setGlobalPrefix('api');
  
  const port = process.env.PORT || 3002;
  await app.listen(port);
  
  logger.log(`Database agent is running on port ${port}`);
  logger.log(`Environment: ${process.env.NODE_ENV}`);
}
bootstrap();
