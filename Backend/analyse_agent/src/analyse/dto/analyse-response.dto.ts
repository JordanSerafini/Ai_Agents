import {
  ValidateString,
  ValidateArray,
  ValidateObject,
  ValidateDate,
  ValidateNestedObject,
  ValidateNestedArray,
  TransformType,
} from './decorators';
import { PrioriteType } from '../interfaces/analyse.interface';

class IntentionConfigDto {
  @ValidateString()
  nom!: string;

  @ValidateString()
  description!: string;

  @ValidateString()
  confiance!: number;
}

class IntentionPrincipaleDto {
  @ValidateString()
  nom!: string;

  @ValidateString()
  confiance!: number;

  @ValidateString()
  description!: string;
}

export class AnalyseResponseDto {
  @ValidateString()
  demandeId!: string;

  @ValidateObject()
  @ValidateNestedObject()
  @TransformType(() => IntentionPrincipaleDto)
  intentionPrincipale!: IntentionPrincipaleDto;

  @ValidateArray()
  @ValidateNestedArray()
  @TransformType(() => IntentionConfigDto)
  sousIntentions!: IntentionConfigDto[];

  @ValidateArray()
  @ValidateString({ each: true })
  entites!: string[];

  @ValidateString()
  niveauUrgence!: PrioriteType;

  @ValidateArray()
  @ValidateString({ each: true })
  contraintes!: string[];

  @ValidateString()
  contexte!: string;

  @ValidateDate()
  @TransformType(() => Date)
  timestamp!: Date;
}
