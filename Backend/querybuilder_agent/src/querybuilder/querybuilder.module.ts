import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { QueryBuilderService } from './services/query-builder.service';
import { DatabaseMetadataService } from './services/database-metadata.service';
import { DatabaseService } from './services/database.service';
import { QueryBuilderController } from './controllers/querybuilder.controller';
import { QueryValidatorService } from './services/query-validator.service';
import { QueryConfigService } from './services/query-config.service';
import { QueryExecutorService } from './services/query-executor.service';

@Module({
  imports: [
    ConfigModule.forRoot(),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => {
        // Vérifier que les variables d'environnement requises sont définies
        // Utiliser d'abord les variables PG_*, puis DB_* comme fallback
        const host = configService.get('PG_HOST') || configService.get('DB_HOST');
        const port = configService.get('PG_PORT') || configService.get('DB_PORT');
        const username = configService.get('PG_USERNAME') || configService.get('DB_USERNAME');
        const password = configService.get('PG_PASSWORD') || configService.get('DB_PASSWORD');
        const database = configService.get('PG_DATABASE') || configService.get('DB_NAME');
        
        if (!host || !port || !username || !password || !database) {
          console.warn('⚠️ Variables d\'environnement de base de données manquantes. Utilisez le fichier .env pour les définir.');
        }
        
        return {
          type: 'postgres',
          host: host || 'localhost',
          port: parseInt(port || '5432'),
          username: username || 'postgres',
          password: password || '', // Pas de mot de passe par défaut pour des raisons de sécurité
          database: database || 'postgres',
          autoLoadEntities: true,
          synchronize: false,
        };
      },
      inject: [ConfigService],
    }),
  ],
  controllers: [QueryBuilderController],
  providers: [
    DatabaseService,
    QueryValidatorService,
    QueryConfigService,
    QueryExecutorService,
    QueryBuilderService,
    DatabaseMetadataService,
  ],
  exports: [QueryBuilderService, DatabaseMetadataService],
})
export class QueryBuilderModule {}
