import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.enableCors();
  await app.listen(process.env.PORT || 3003);
  console.log(`Service RAG démarré sur le port ${process.env.PORT || 3003}`);
}
void bootstrap();
