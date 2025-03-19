import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  console.log("Agent de filtrage d'emails démarré...");
  await app.listen(process.env.PORT ?? 3011);
}
bootstrap();
