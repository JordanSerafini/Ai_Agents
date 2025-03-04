import { IsString, IsOptional, IsObject, IsDate } from 'class-validator';
import { ContexteUtilisateur } from '../interfaces/analyse.interface';

export class AnalyseRequestDto {
  @IsString()
  id!: string;

  @IsString()
  texte!: string;

  @IsOptional()
  @IsString()
  contexte?: string;

  @IsObject()
  utilisateur!: ContexteUtilisateur;

  @IsOptional()
  @IsDate()
  timestamp?: Date;
} 