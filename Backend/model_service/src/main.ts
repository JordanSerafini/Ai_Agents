import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.enableCors(); // Activer CORS pour les requêtes cross-origin
  await app.listen(process.env.PORT || 3001);
  console.log(
    `Service de modèle démarré sur le port ${process.env.PORT || 3001}`,
  );
}
void bootstrap();
