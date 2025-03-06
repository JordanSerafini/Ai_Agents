export enum PrioriteType {
  URGENT = 'URGENT',
  NORMAL = 'NORMAL',
  BASSE = 'BASSE',
}

class IntentionConfigDto {
  nom!: string;
  description!: string;
  confiance!: number;
}

class IntentionPrincipaleDto {
  nom!: string;
  confiance!: number;
  description!: string;
}

export class AnalyseResponseDto {
  demandeId!: string;
  intentionPrincipale!: IntentionPrincipaleDto;
  sousIntentions!: IntentionConfigDto[];
  entites!: string[];
  niveauUrgence!: PrioriteType;
  contraintes!: string[];
  contexte!: string;
  timestamp!: Date;
  questionCorrigee!: string;
}
