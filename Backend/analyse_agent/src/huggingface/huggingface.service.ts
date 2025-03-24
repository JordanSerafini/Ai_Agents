import {
  Injectable,
  Logger,
  OnModuleInit,
  HttpException,
  HttpStatus,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { HfInference } from '@huggingface/inference';
import { ConfigService } from '@nestjs/config';
import { getAnalysisPrompt, Service } from './prompt';
import { RagService } from '../RAG/rag.service';

// Interface pour stocker les informations complètes de l'analyse
export interface AnalysisResult {
  question: string;
  questionReformulated: string;
  agent: Service;
  // Champs spécifiques pour querybuilder
  tables?: string[];
  conditions?: string;
  fields?: string[];
  operations?: string[];
  finalQuery?: string;
  data?: any[];  // Ajout du champ data pour stocker les résultats de la requête
  // Champs spécifiques pour workflow
  action?: string;
  entities?: string[];
  parameters?: string[];
}

/**
 * Définition des relations entre tables pour les jointures SQL
 */
interface TableRelations {
  [key: string]: {
    [key: string]: string;
  };
}

@Injectable()
export class HuggingFaceService implements OnModuleInit {
  private model!: HfInference;
  private readonly logger = new Logger(HuggingFaceService.name);
  private readonly modelName = 'mistralai/Mistral-7B-Instruct-v0.2';
  private isEnabled = true;

  // Définition des relations entre tables pour les jointures SQL
  private readonly tableRelations: TableRelations = {
    projects: {
      stages: 'JOIN stages ON projects.id = stages.project_id',
      clients: 'JOIN clients ON projects.client_id = clients.id',
      ref_status: 'JOIN ref_status ON projects.status = ref_status.id',
      quotations: 'JOIN quotations ON projects.id = quotations.project_id',
      invoices: 'JOIN invoices ON projects.id = invoices.project_id',
      addresses: 'JOIN addresses ON projects.address_id = addresses.id',
      timesheet_entries:
        'JOIN timesheet_entries ON projects.id = timesheet_entries.project_id',
    },
    clients: {
      projects: 'JOIN projects ON clients.id = projects.client_id',
      addresses: 'JOIN addresses ON clients.address_id = addresses.id',
    },
    quotations: {
      projects: 'JOIN projects ON quotations.project_id = projects.id',
      ref_quotation_status:
        'JOIN ref_quotation_status ON quotations.status = ref_quotation_status.id',
      quotation_products:
        'JOIN quotation_products ON quotations.id = quotation_products.quotation_id',
    },
    invoices: {
      projects: 'JOIN projects ON invoices.project_id = projects.id',
      ref_status: 'JOIN ref_status ON invoices.status = ref_status.id',
      payments: 'JOIN payments ON invoices.id = payments.invoice_id',
      invoice_items:
        'JOIN invoice_items ON invoices.id = invoice_items.invoice_id',
    },
    stages: {
      projects: 'JOIN projects ON stages.project_id = projects.id',
      ref_status: 'JOIN ref_status ON stages.status = ref_status.id',
    },
    staff: {
      timesheet_entries:
        'JOIN timesheet_entries ON staff.id = timesheet_entries.staff_id',
    },
    timesheet_entries: {
      staff: 'JOIN staff ON timesheet_entries.staff_id = staff.id',
      projects: 'JOIN projects ON timesheet_entries.project_id = projects.id',
    },
    ref_status: {
      projects: 'JOIN projects ON ref_status.id = projects.status',
      invoices: 'JOIN invoices ON ref_status.id = invoices.status',
      stages: 'JOIN stages ON ref_status.id = stages.status',
    },
    addresses: {
      clients: 'JOIN clients ON addresses.id = clients.address_id',
      projects: 'JOIN projects ON addresses.id = projects.address_id',
    },
  };

  // Dictionnaire pour normaliser les noms de tables
  private readonly tableNameMapping: Record<string, string> = {
    projet: 'projects',
    projets: 'projects',
    client: 'clients',
    devis: 'quotations',
    facture: 'invoices',
    factures: 'invoices',
    employé: 'staff',
    employés: 'staff',
    personnel: 'staff',
    adresse: 'addresses',
    adresses: 'addresses',
    étape: 'stages',
    étapes: 'stages',
    paiement: 'payments',
    paiements: 'payments',
    statut: 'ref_status',
    produit: 'quotation_products',
    produits: 'quotation_products',
  };

  constructor(
    private configService: ConfigService,
    @Inject(forwardRef(() => RagService))
    private ragService: RagService,
  ) {}

  async onModuleInit() {
    const token = this.configService.get<string>('HUGGING_FACE_TOKEN');
    this.logger.log(
      `Initialisation HuggingFace: ${token ? 'Token présent' : '⚠️ Token manquant'}`,
    );

    if (!token) {
      this.logger.warn('🚨 HUGGING_FACE_TOKEN manquant - Service désactivé');
      this.isEnabled = false;
      await Promise.resolve(); // Pour satisfaire require-await
      return;
    }

    try {
      this.model = new HfInference(token);
      this.logger.log('✅ Modèle Hugging Face initialisé avec succès');
    } catch (error) {
      this.logger.error(
        `❌ Erreur d'initialisation du modèle: ${error.message}`,
      );
      this.isEnabled = false;
    }
  }

  /**
   * Vérifie si des questions similaires existent dans les collections RAG
   * Cette méthode utilise le service RAG injecté pour chercher des questions similaires.
   */
  async checkSimilarQuestionsInRAG(question: string): Promise<{
    found: boolean;
    source?: string;
    result?: AnalysisResult;
    similarity?: number;
  }> {
    this.logger.log(`Vérification RAG pour question: "${question}"`);
    try {
      // Rechercher dans la collection user_prompts
      const userPromptResult = await this.ragService.findSimilarPrompt(
        'user_prompts',
        question,
        0.85,
      );
      if (userPromptResult.found && userPromptResult.metadata) {
        return {
          found: true,
          source: 'user_prompts',
          result: userPromptResult.metadata as AnalysisResult,
          similarity: userPromptResult.similarity,
        };
      }
      // Rechercher dans la collection sql_queries
      const sqlQueryResult = await this.ragService.findSimilarPrompt(
        'sql_queries',
        question,
        0.85,
      );
      if (sqlQueryResult.found && sqlQueryResult.metadata) {
        return {
          found: true,
          source: 'sql_queries',
          result: sqlQueryResult.metadata as AnalysisResult,
          similarity: sqlQueryResult.similarity,
        };
      }
    } catch (error) {
      this.logger.error(`Erreur lors de la vérification RAG: ${error.message}`);
    }
    return { found: false };
  }

  /**
   * Appelle le modèle Hugging Face avec le prompt fourni
   */
  private async callModel(prompt: string): Promise<string> {
    if (!this.isEnabled) {
      throw new HttpException(
        '🚫 Le service AI est désactivé.',
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }

    this.logger.debug(
      `📤 Envoi du prompt à Hugging Face: "${prompt.substring(0, 200)}..."`,
    );

    const modelCall = () =>
      this.model.textGeneration({
        model: this.modelName,
        inputs: prompt,
        parameters: {
          max_new_tokens: 1024,
          temperature: 0.1,
          top_p: 0.95,
        },
      });

    // Implémentation du retry
    const maxRetries = 2;
    const delayBetweenRetries = 1000;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const timeout = new Promise<any>((_, reject) =>
          setTimeout(
            () => reject(new Error('❌ Timeout API Hugging Face')),
            10000,
          ),
        );

        const response = await Promise.race([modelCall(), timeout]);
        if (!response?.generated_text) {
          throw new Error('⚠️ Réponse vide de Hugging Face');
        }

        this.logger.debug(
          `📥 Réponse Hugging Face: "${response.generated_text.substring(0, 200)}..."`,
        );
        return response.generated_text;
      } catch (error) {
        this.logger.warn(
          `⚠️ Tentative ${attempt}/${maxRetries} échouée: ${error.message}`,
        );

        if (error.message.includes('quota')) {
          this.logger.error('🚨 Quota API Hugging Face dépassé.');
          throw new HttpException(
            '⚠️ Quota dépassé sur Hugging Face, réessayez plus tard.',
            HttpStatus.TOO_MANY_REQUESTS,
          );
        }

        if (attempt === maxRetries) {
          this.logger.error(`❌ Échec total de Hugging Face: ${error.message}`);
          throw new HttpException(
            '🚫 Erreur API Hugging Face, service temporairement indisponible.',
            HttpStatus.SERVICE_UNAVAILABLE,
          );
        }

        // Attendre avant la prochaine tentative
        await new Promise((resolve) =>
          setTimeout(resolve, delayBetweenRetries),
        );
      }
    }

    throw new HttpException(
      '❌ Erreur inconnue API Hugging Face',
      HttpStatus.INTERNAL_SERVER_ERROR,
    );
  }

  /**
   * Sécurise les entrées utilisateur contre les injections
   */
  private sanitizeInput(input: string): string {
    if (!input) return '';
    return input
      .replace(/['"<>;]/g, '') // Évite les attaques XSS et SQL Injection
      .replace(/\s{2,}/g, ' ') // Supprime les espaces excessifs
      .trim(); // Supprime les espaces au début et à la fin
  }

  /**
   * Analyse une question pour déterminer l'agent approprié et reformuler si nécessaire
   */
  async analyseQuestion(question: string): Promise<AnalysisResult> {
    // Nettoyer l'entrée utilisateur
    const sanitizedQuestion = this.sanitizeInput(question);
    if (!sanitizedQuestion) {
      throw new HttpException(
        'La question est invalide après nettoyage.',
        HttpStatus.BAD_REQUEST,
      );
    }

    this.logger.log(`📢 Analyse de la question: "${sanitizedQuestion}"`);

    if (!this.isEnabled) {
      throw new HttpException(
        'Service Hugging Face désactivé (Token manquant).',
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }

    if (!sanitizedQuestion.trim().length) {
      throw new HttpException(
        '❌ La question est vide.',
        HttpStatus.BAD_REQUEST,
      );
    }

    if (sanitizedQuestion.length > 500) {
      throw new HttpException(
        '⛔ La question dépasse 500 caractères.',
        HttpStatus.BAD_REQUEST,
      );
    }

    if (/[;'"\\]/.test(sanitizedQuestion)) {
      throw new HttpException(
        '🚫 Caractères spéciaux interdits.',
        HttpStatus.BAD_REQUEST,
      );
    }

    try {
      // Vérifier d'abord dans les collections RAG si une question similaire existe
      const ragCheck = await this.checkSimilarQuestionsInRAG(sanitizedQuestion);

      if (ragCheck.found && ragCheck.result) {
        this.logger.log(
          `✅ Question similaire trouvée dans RAG (source: ${ragCheck.source}, similarité: ${ragCheck.similarity})`,
        );
        return ragCheck.result;
      }

      // Si aucune correspondance dans RAG, continuer avec l'analyse par le modèle
      const prompt = getAnalysisPrompt(sanitizedQuestion);
      const response = await this.callModel(prompt);

      if (!response) {
        throw new HttpException(
          "⚠️ Réponse vide de l'API Hugging Face.",
          HttpStatus.INTERNAL_SERVER_ERROR,
        );
      }

      const jsonContent = this.extractJsonFromText(response);
      return jsonContent
        ? this.parseJsonResponse(jsonContent, sanitizedQuestion)
        : this.parseTextResponse(response, sanitizedQuestion);
    } catch (error) {
      if (error instanceof HttpException) throw error;

      this.logger.error(
        `🔥 [analyseQuestion] Erreur API Hugging Face: ${error.message}`,
      );
      throw new HttpException(
        '⚠️ Erreur de communication avec Hugging Face.',
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }
  }

  /**
   * Parse la réponse JSON du modèle
   */
  private parseJsonResponse(
    jsonContent: string,
    originalQuestion: string,
  ): AnalysisResult {
    try {
      const parsedJson = JSON.parse(jsonContent);
      this.logger.debug('JSON extrait avec succès');

      if (!parsedJson['Agent']) {
        this.logger.warn('Agent non trouvé dans la réponse JSON');
      }

      const agent =
        (parsedJson['Agent']?.toLowerCase() as Service) || 'querybuilder';

      // Créer l'objet de retour de base
      const analysisResult: AnalysisResult = {
        question: parsedJson['Question originale'] || originalQuestion,
        questionReformulated:
          parsedJson['Question reformulée'] || originalQuestion,
        agent: agent,
      };

      // Ajouter les champs spécifiques en fonction du type d'agent
      if (agent === 'querybuilder') {
        const tables = parsedJson['Tables concernées'] || [];
        const fields = parsedJson['Champs à afficher'] || [];
        const conditions = parsedJson['Conditions et filtres'] || '';
        const operations = parsedJson['Opérations'] || [];

        analysisResult.tables = tables;
        analysisResult.fields = fields;
        analysisResult.conditions = conditions;
        analysisResult.operations = operations;

        // Générer la requête SQL complète
        if (tables.length > 0) {
          analysisResult.finalQuery = this.generateSqlQuery(
            tables,
            fields,
            conditions,
          );
        }
      } else if (agent === 'workflow') {
        analysisResult.action = parsedJson['Action à effectuer'] || '';
        analysisResult.entities = parsedJson['Entités concernées'] || [];
        analysisResult.parameters = parsedJson['Paramètres nécessaires'] || [];
      }

      return analysisResult;
    } catch (jsonError) {
      this.logger.error(`Erreur lors du parsing JSON: ${jsonError.message}`);
      return {
        question: originalQuestion,
        questionReformulated: originalQuestion,
        agent: 'querybuilder',
      };
    }
  }

  /**
   * Parse la réponse texte du modèle ligne par ligne
   */
  private parseTextResponse(
    responseText: string,
    originalQuestion: string,
  ): AnalysisResult {
    const lines = responseText.split('\n');
    let extractedQuestion = originalQuestion;
    let extractedReformulation = originalQuestion;
    let extractedAgent = 'querybuilder';

    this.logger.debug(
      "JSON non trouvé, tentative d'extraction ligne par ligne",
    );

    // Parcourir les lignes pour trouver les informations
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();

      // Gérer les formats de réponse possibles
      if (line.startsWith('Question originale:')) {
        extractedQuestion = line.substring('Question originale:'.length).trim();
      } else if (line.includes('Question originale:')) {
        // Format alternatif avec liste numérotée (1. Question originale:)
        const colonIndex = line.indexOf(':');
        if (colonIndex > 0) {
          extractedQuestion = line.substring(colonIndex + 1).trim();
        }
      } else if (line.match(/^I+\.\s+Question originale:/i)) {
        // Format avec numérotation romaine (I. Question originale:)
        const colonIndex = line.indexOf(':');
        if (colonIndex > 0) {
          extractedQuestion = line.substring(colonIndex + 1).trim();
        }
      } else if (line.startsWith('Question reformulée:')) {
        extractedReformulation = line
          .substring('Question reformulée:'.length)
          .trim();
      } else if (line.includes('Question reformulée:')) {
        // Format alternatif avec liste numérotée
        const colonIndex = line.indexOf(':');
        if (colonIndex > 0) {
          extractedReformulation = line.substring(colonIndex + 1).trim();
        }
      } else if (line.match(/^II+\.\s+Question reformulée:/i)) {
        // Format avec numérotation romaine (II. Question reformulée:)
        const colonIndex = line.indexOf(':');
        if (colonIndex > 0) {
          extractedReformulation = line.substring(colonIndex + 1).trim();
        }
      } else if (line.startsWith('Agent:')) {
        const agentValue = line.substring('Agent:'.length).trim();
        this.processAgentValue(agentValue, (value) => {
          extractedAgent = value;
        });
      } else if (line.includes('Agent:')) {
        // Format alternatif avec liste numérotée
        const colonIndex = line.indexOf(':');
        if (colonIndex > 0) {
          const agentValue = line.substring(colonIndex + 1).trim();
          this.processAgentValue(agentValue, (value) => {
            extractedAgent = value;
          });
        }
      } else if (line.match(/^III+\.\s+Agent:/i)) {
        // Format avec numérotation romaine (III. Agent:)
        const colonIndex = line.indexOf(':');
        if (colonIndex > 0) {
          const agentValue = line.substring(colonIndex + 1).trim();
          this.processAgentValue(agentValue, (value) => {
            extractedAgent = value;
          });
        }
      }
    }

    this.logger.debug(`Extraction finale - Question: "${extractedQuestion}"`);
    this.logger.debug(
      `Extraction finale - Reformulation: "${extractedReformulation}"`,
    );
    this.logger.debug(`Extraction finale - Agent: "${extractedAgent}"`);

    // Nettoyer les guillemets qui pourraient être présents dans les valeurs extraites
    extractedQuestion = this.cleanQuotes(extractedQuestion);
    extractedReformulation = this.cleanQuotes(extractedReformulation);

    return {
      question: extractedQuestion,
      questionReformulated: extractedReformulation,
      agent: extractedAgent as Service,
    };
  }

  /**
   * Traite la valeur d'agent extraite et applique le callback si valide
   */
  private processAgentValue(
    agentValue: string,
    callback: (value: string) => void,
  ): void {
    if (this.isValidService(agentValue.toLowerCase())) {
      callback(agentValue.toLowerCase());
    } else {
      this.logger.warn(`Agent invalide: ${agentValue}, utilisation par défaut`);
    }
  }

  /**
   * Vérifie si un service est valide
   */
  private isValidService(service: string): service is Service {
    return (['querybuilder', 'workflow'] as string[]).includes(service);
  }

  /**
   * Nettoie les guillemets au début et à la fin d'une chaîne
   */
  private cleanQuotes(value: string): string {
    if (!value) return value;

    // Supprimer les guillemets au début et à la fin
    let cleaned = value;

    // Vérifier si la chaîne commence et se termine par des guillemets
    if (
      (cleaned.startsWith('"') && cleaned.endsWith('"')) ||
      (cleaned.startsWith("'") && cleaned.endsWith("'"))
    ) {
      cleaned = cleaned.substring(1, cleaned.length - 1);
    }

    // Cas où il y aurait des guillemets doubles imbriqués
    if (
      (cleaned.startsWith('"') && cleaned.endsWith('"')) ||
      (cleaned.startsWith("'") && cleaned.endsWith("'"))
    ) {
      cleaned = cleaned.substring(1, cleaned.length - 1);
    }

    return cleaned;
  }

  /**
   * Extraire du JSON d'un texte brut
   */
  private extractJsonFromText(text: string): string | null {
    if (!text) return null;

    // Vérifier s'il y a un JSON dans la réponse avec un regex avancé
    const jsonMatch = text.match(/\{[\s\S]*?\}/m);
    if (!jsonMatch) return null;

    try {
      JSON.parse(jsonMatch[0]); // Vérifie si le JSON est valide
      return jsonMatch[0].trim();
    } catch (error) {
      this.logger.warn(
        '❌ JSON invalide détecté dans la réponse du modèle.',
        error,
      );
      return null;
    }
  }

  /**
   * Vérifie la validité des tables avant de générer une requête SQL
   */
  private validateTables(tables: string[]): boolean {
    if (!tables || tables.length === 0) return false;

    const tableExists = tables.every((table) => {
      return Object.keys(this.tableRelations).includes(table);
    });

    if (!tableExists) {
      this.logger.warn(`⚠️ Tables inconnues détectées: ${tables.join(', ')}`);
      return false;
    }

    return true;
  }

  /**
   * Génère la requête SQL à partir des paramètres extraits
   */
  private generateSqlQuery(
    tables: string[],
    fields: string[] = [],
    conditions: string = '',
  ): string {
    try {
      if (!tables || tables.length === 0) {
        return '';
      }

      // Normalisation et assainissement des tables
      const validTableNames = tables.map((t) =>
        this.sanitizeSqlIdentifier(this.normalizeTableName(t)),
      );

      // Vérification des tables
      if (!this.validateTables(validTableNames)) {
        throw new Error('❌ Tables inconnues, requête annulée.');
      }

      const primaryTable = validTableNames[0];

      // Nettoyage et assainissement des champs
      const validFields =
        fields && fields.length > 0
          ? fields.map((f) =>
              this.sanitizeSqlIdentifier(f.trim().replace(/['"]/g, '')),
            )
          : ['*'];

      // Construction de la clause SELECT
      let query = `SELECT ${validFields.join(', ')}`;

      // Construction de la clause FROM avec jointures si nécessaire
      query += ` FROM ${primaryTable}`;

      // Jointures pour tables supplémentaires
      if (validTableNames.length > 1) {
        query = this.addJoinsToQuery(query, primaryTable, validTableNames);
      }

      // Traiter les conditions
      const sanitizedConditions = this.sanitizeSqlConditions(conditions);
      query = this.addConditionsToQuery(query, sanitizedConditions);

      // Correction des cas particuliers
      query = this.correctStatusReferences(query);

      return query;
    } catch (error) {
      this.logger.error(`❌ Erreur génération SQL: ${error.message}`);
      return '';
    }
  }

  /**
   * Assainit un identifiant SQL pour prévenir les injections
   */
  private sanitizeSqlIdentifier(identifier: string): string {
    if (!identifier) return '';
    // Conserver uniquement les caractères alphanumériques, underscores et points
    return identifier.replace(/[^a-zA-Z0-9_.]/g, '');
  }

  /**
   * Assainit les conditions SQL pour prévenir les injections
   */
  private sanitizeSqlConditions(conditions: string): string {
    if (!conditions) return '';

    // Protection avancée contre les injections dans les conditions
    // 1. Supprimer les caractères potentiellement dangereux
    let sanitized = conditions.replace(/[;'\\]/g, '');

    // 2. Protection contre les attaques par commentaire
    sanitized = sanitized.replace(/--/g, '');
    sanitized = sanitized.replace(/\/\*/g, '');

    // 3. Protection contre les instructions DROP, DELETE, etc.
    const dangerousKeywords = [
      'DROP',
      'DELETE',
      'UPDATE',
      'INSERT',
      'ALTER',
      'TRUNCATE',
    ];
    dangerousKeywords.forEach((keyword) => {
      const regex = new RegExp(`\\b${keyword}\\b`, 'gi');
      sanitized = sanitized.replace(regex, '');
    });

    return sanitized;
  }

  /**
   * Ajoute les jointures à la requête SQL
   */
  private addJoinsToQuery(
    query: string,
    primaryTable: string,
    tables: string[],
  ): string {
    let updatedQuery = query;

    for (let i = 1; i < tables.length; i++) {
      const secondaryTable = tables[i];

      // Ne pas joindre une table déjà présente dans la requête
      if (this.isTableAlreadyJoined(updatedQuery, secondaryTable)) {
        continue;
      }

      const joinClause = this.determineJoinClause(primaryTable, secondaryTable);

      if (joinClause) {
        updatedQuery += ` ${joinClause}`;
      } else {
        // Fallback: jointure croisée si pas de relation connue
        updatedQuery += ` CROSS JOIN ${secondaryTable}`;
      }
    }

    return updatedQuery;
  }

  /**
   * Ajoute les conditions à la requête SQL
   */
  private addConditionsToQuery(query: string, conditions: string): string {
    let whereClause = this.normalizeConditions(conditions);

    if (whereClause && whereClause.trim() !== '') {
      if (!whereClause.trim().toUpperCase().startsWith('WHERE')) {
        whereClause = `WHERE ${whereClause}`;
      }
      return `${query} ${whereClause}`;
    }

    return query;
  }

  /**
   * Corrige les références aux statuts dans une requête SQL
   */
  private correctStatusReferences(query: string): string {
    if (!query) return query;

    // Correction pour quotations.status comparé directement à des valeurs de texte
    if (
      query.match(
        /status\s+IN\s*\(\s*(['"]en_attente['"]|['"]accepté['"]|['"]refusé['"])/i,
      )
    ) {
      this.logger.log(
        'Correction de référence directe aux statuts détectée (IN)',
      );

      return query.replace(
        /(\w+\.)?status\s+IN\s*\(\s*((['"][^'"]+['"](\s*,\s*['"][^'"]+['"])*)\s*)\)/gi,
        (match, table, statusList) => {
          const tablePrefix = table || '';
          return `${tablePrefix}status IN (SELECT id FROM ref_quotation_status WHERE code IN (${statusList}))`;
        },
      );
    }

    // Correction pour le cas d'égalité (status = 'en_attente')
    if (
      query.match(
        /status\s*=\s*(['"]en_attente['"]|['"]accepté['"]|['"]refusé['"])/i,
      )
    ) {
      this.logger.log(
        'Correction de référence directe aux statuts détectée (=)',
      );

      return query.replace(
        /(\w+\.)?status\s*=\s*(['"][^'"]+['"])/gi,
        (match, table, statusValue) => {
          const tablePrefix = table || '';
          return `${tablePrefix}status = (SELECT id FROM ref_quotation_status WHERE code = ${statusValue})`;
        },
      );
    }

    return query;
  }

  /**
   * Détermine la clause JOIN appropriée entre deux tables
   */
  private determineJoinClause(
    primaryTable: string,
    secondaryTable: string,
  ): string | null {
    // Vérifier si nous avons une relation directe
    if (
      this.tableRelations[primaryTable] &&
      this.tableRelations[primaryTable][secondaryTable]
    ) {
      return this.tableRelations[primaryTable][secondaryTable];
    }

    // Vérifier la relation inverse et l'adapter si nécessaire
    if (
      this.tableRelations[secondaryTable] &&
      this.tableRelations[secondaryTable][primaryTable]
    ) {
      // Extraire la relation inverse et l'adapter pour notre ordre de tables
      const inverseRelation = this.tableRelations[secondaryTable][primaryTable];
      // Remplacer "JOIN primaryTable ON" par "JOIN secondaryTable ON"
      return inverseRelation.replace(
        `JOIN ${primaryTable} ON`,
        `JOIN ${secondaryTable} ON`,
      );
    }

    return null;
  }

  /**
   * Vérifie si une chaîne contient l'un des mots-clés spécifiés
   */
  private containsAny(text: string, keywords: string[]): boolean {
    if (!text) return false;
    const lowerText = text.toLowerCase();
    return keywords.some((keyword) =>
      lowerText.includes(keyword.toLowerCase()),
    );
  }

  /**
   * Vérifie si une table est déjà jointe dans une requête
   */
  private isTableAlreadyJoined(query: string, tableName: string): boolean {
    const lowerQuery = query.toLowerCase();
    const lowerTableName = tableName.toLowerCase();
    return lowerQuery.includes(` ${lowerTableName} `);
  }

  /**
   * Normalise le nom d'une table
   */
  private normalizeTableName(tableName: string): string {
    if (!tableName) return '';

    const normalizedName = this.tableNameMapping[tableName.toLowerCase()];
    return normalizedName || tableName.toLowerCase();
  }

  /**
   * Normalise les conditions d'une requête
   */
  private normalizeConditions(conditions: string): string {
    if (!conditions) return '';

    // Supprimer les guillemets inutiles
    const normalizedConditions = conditions.replace(
      /(['"])([^'"]*)\1/g,
      (match, quote, content) => {
        // Si le contenu contient des espaces ou caractères spéciaux, garder les guillemets
        if (/\s|[(),=<>]/.test(content)) {
          return match;
        }
        return content;
      },
    );

    return normalizedConditions.trim();
  }
}
