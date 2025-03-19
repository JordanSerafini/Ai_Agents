import { Injectable, Logger } from '@nestjs/common';
import { HfInference } from '@huggingface/inference';
import { ConfigService } from '@nestjs/config';
import { getAnalysisPrompt, Service } from './prompt';

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
  // Champs spécifiques pour workflow
  action?: string;
  entities?: string[];
  parameters?: string[];
}

@Injectable()
export class HuggingFaceService {
  private model: HfInference;
  private readonly logger = new Logger(HuggingFaceService.name);
  private readonly modelName = 'mistralai/Mistral-7B-Instruct-v0.2';

  constructor(private configService: ConfigService) {
    const token = this.configService.get<string>('HUGGIN_FACE_TOKEN');
    this.logger.log(
      `Initialisation HuggingFace avec token: ${token ? 'présent' : 'manquant'}`,
    );

    if (!token) {
      throw new Error('HUGGIN_FACE_TOKEN non défini');
    }

    this.model = new HfInference(token);
  }

  /**
   * Analyse une question pour déterminer l'agent approprié et reformuler si nécessaire
   * @param question La question à analyser
   * @returns Un objet contenant les informations d'analyse complètes
   */
  async analyseQuestion(question: string): Promise<AnalysisResult> {
    try {
      const prompt = getAnalysisPrompt(question);

      const response = await this.model.textGeneration({
        model: this.modelName,
        inputs: prompt,
        parameters: {
          max_new_tokens: 1024,
          temperature: 0.1,
          top_p: 0.95,
        },
      });

      const result = response.generated_text || '';
      this.logger.debug(
        `Réponse reçue du modèle (${result.length} caractères)`,
      );

      // Essayer d'extraire le JSON de la réponse
      const jsonContent = this.extractJsonFromText(result);

      if (jsonContent) {
        try {
          const parsedJson = JSON.parse(jsonContent);
          this.logger.debug('JSON extrait avec succès');

          const agent =
            (parsedJson['Agent']?.toLowerCase() as Service) || 'querybuilder';

          // Créer l'objet de retour de base
          const analysisResult: AnalysisResult = {
            question: parsedJson['Question originale'] || question,
            questionReformulated: parsedJson['Question reformulée'] || question,
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
            analysisResult.parameters =
              parsedJson['Paramètres nécessaires'] || [];
          }

          return analysisResult;
        } catch (jsonError) {
          this.logger.error(
            `Erreur lors du parsing JSON: ${jsonError.message}`,
          );
        }
      }

      // Fallback sur l'extraction ligne par ligne si JSON pas trouvé ou invalide
      const lines = result.split('\n');
      let extractedQuestion = question;
      let extractedReformulation = question;
      let extractedAgent = 'querybuilder';

      // Pour le débogage - supprimer les logs ligne par ligne
      this.logger.debug(
        "JSON non trouvé, tentative d'extraction ligne par ligne",
      );

      // Parcourir les lignes pour trouver les informations
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();

        // Gérer les formats de réponse possibles
        if (line.startsWith('Question originale:')) {
          extractedQuestion = line
            .substring('Question originale:'.length)
            .trim();
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

          if (this.isValidService(agentValue.toLowerCase())) {
            extractedAgent = agentValue.toLowerCase();
          } else {
            this.logger.warn(
              `Agent invalide: ${agentValue}, utilisation par défaut`,
            );
          }
        } else if (line.includes('Agent:')) {
          // Format alternatif avec liste numérotée
          const colonIndex = line.indexOf(':');
          if (colonIndex > 0) {
            const agentValue = line.substring(colonIndex + 1).trim();

            if (this.isValidService(agentValue.toLowerCase())) {
              extractedAgent = agentValue.toLowerCase();
            }
          }
        } else if (line.match(/^III+\.\s+Agent:/i)) {
          // Format avec numérotation romaine (III. Agent:)
          const colonIndex = line.indexOf(':');
          if (colonIndex > 0) {
            const agentValue = line.substring(colonIndex + 1).trim();

            if (this.isValidService(agentValue.toLowerCase())) {
              extractedAgent = agentValue.toLowerCase();
            }
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
    } catch (error) {
      this.logger.error(
        `Erreur lors de l'analyse de la question: ${error.message}`,
        error.stack,
      );

      // Retourner une réponse par défaut en cas d'erreur
      return {
        question: question,
        questionReformulated: question,
        agent: 'querybuilder',
      };
    }
  }

  /**
   * Vérifie si un service est valide
   * @param service Le service à vérifier
   * @returns true si le service est valide, false sinon
   */
  private isValidService(service: string): service is Service {
    return (['querybuilder', 'workflow'] as string[]).includes(service);
  }

  /**
   * Nettoie les guillemets au début et à la fin d'une chaîne
   * @param value Chaîne à nettoyer
   * @returns Chaîne sans guillemets externes
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
   * @param text Texte contenant potentiellement du JSON
   * @returns String JSON ou null si rien n'est trouvé
   */
  private extractJsonFromText(text: string): string | null {
    // Rechercher le contenu entre les marqueurs ```json et ```
    // Mais on veut éviter de prendre les exemples dans le prompt
    const responseText = text.split('[/INST]</s>')[1] || text;
    this.logger.debug(
      'Texte de réponse isolé: ' + responseText.substring(0, 100) + '...',
    );

    // Rechercher le JSON dans la partie réponse uniquement
    const jsonPattern = /```json\s*({[\s\S]*?})\s*```/m;
    const match = responseText.match(jsonPattern);

    if (match && match[1]) {
      return match[1].trim();
    }

    // Essayer une autre approche si nécessaire
    const openBraceIdx = responseText.indexOf('{');
    const closeBraceIdx = responseText.lastIndexOf('}');

    if (
      openBraceIdx !== -1 &&
      closeBraceIdx !== -1 &&
      openBraceIdx < closeBraceIdx
    ) {
      const jsonCandidate = responseText.substring(
        openBraceIdx,
        closeBraceIdx + 1,
      );
      try {
        // Vérifier si c'est du JSON valide
        JSON.parse(jsonCandidate);
        return jsonCandidate;
      } catch (e) {
        this.logger.debug('JSON candidat invalide:', jsonCandidate);
        console.log(e);
        return null;
      }
    }

    return null;
  }

  /**
   * Génère une requête SQL complète à partir des éléments d'analyse
   * @param tables Les tables concernées par la requête
   * @param fields Les champs à afficher
   * @param conditions Les conditions et filtres
   * @returns Une requête SQL complète
   */
  private generateSqlQuery(
    tables: string[],
    fields: string[] = [],
    conditions: string = '',
  ): string {
    // Utiliser un champ par défaut si aucun champ n'est spécifié
    const selectFields = fields.length > 0 ? fields.join(', ') : '*';

    // Extraire les différentes parties des conditions
    const joinConditions: string[] = [];
    let whereConditions = '';
    let groupByClause = '';
    let orderByClause = '';
    let limitClause = '';

    // Traiter les conditions pour extraire les différentes clauses
    if (conditions && conditions.trim() !== '') {
      const conditionsUpper = conditions.toUpperCase();

      // Extraire les jointures des conditions (si présentes)
      const joinMatches = conditions.match(/JOIN\s+\w+\s+ON\s+[^,;]+/gi) || [];
      joinMatches.forEach((joinClause) => {
        joinConditions.push(joinClause);
      });

      // Extraire la clause WHERE
      const whereStart = conditionsUpper.indexOf('WHERE');
      if (whereStart !== -1) {
        let whereEnd = conditions.length;

        // Chercher les autres clauses après WHERE
        const groupByStart = conditionsUpper.indexOf('GROUP BY');
        const orderByStart = conditionsUpper.indexOf('ORDER BY');
        const limitStart = conditionsUpper.indexOf('LIMIT');

        // Déterminer où se termine la clause WHERE
        if (
          groupByStart !== -1 &&
          (whereEnd > groupByStart || whereEnd === conditions.length)
        )
          whereEnd = groupByStart;
        if (
          orderByStart !== -1 &&
          (whereEnd > orderByStart || whereEnd === conditions.length)
        )
          whereEnd = orderByStart;
        if (
          limitStart !== -1 &&
          (whereEnd > limitStart || whereEnd === conditions.length)
        )
          whereEnd = limitStart;

        whereConditions = conditions.substring(whereStart + 5, whereEnd).trim();
      } else {
        // Si pas de WHERE explicite, prendre tout ce qui n'est pas un JOIN comme condition WHERE
        let nonJoinCondition = conditions;
        joinMatches.forEach((joinClause) => {
          nonJoinCondition = nonJoinCondition.replace(joinClause, '');
        });
        nonJoinCondition = nonJoinCondition.trim();

        // Si après avoir retiré les JOINs il reste quelque chose, c'est une condition WHERE
        if (
          nonJoinCondition &&
          !nonJoinCondition.toUpperCase().startsWith('GROUP BY') &&
          !nonJoinCondition.toUpperCase().startsWith('ORDER BY') &&
          !nonJoinCondition.toUpperCase().startsWith('LIMIT')
        ) {
          whereConditions = nonJoinCondition;
        }
      }

      // Extraire GROUP BY
      const groupByStart = conditionsUpper.indexOf('GROUP BY');
      if (groupByStart !== -1) {
        let groupByEnd = conditions.length;

        const orderByStart = conditionsUpper.indexOf('ORDER BY');
        const limitStart = conditionsUpper.indexOf('LIMIT');

        if (
          orderByStart !== -1 &&
          (groupByEnd > orderByStart || groupByEnd === conditions.length)
        )
          groupByEnd = orderByStart;
        if (
          limitStart !== -1 &&
          (groupByEnd > limitStart || groupByEnd === conditions.length)
        )
          groupByEnd = limitStart;

        groupByClause = conditions.substring(groupByStart, groupByEnd).trim();
      }

      // Extraire ORDER BY
      const orderByStart = conditionsUpper.indexOf('ORDER BY');
      if (orderByStart !== -1) {
        let orderByEnd = conditions.length;

        const limitStart = conditionsUpper.indexOf('LIMIT');
        if (
          limitStart !== -1 &&
          (orderByEnd > limitStart || orderByEnd === conditions.length)
        )
          orderByEnd = limitStart;

        orderByClause = conditions.substring(orderByStart, orderByEnd).trim();
      }

      // Extraire LIMIT
      const limitStart = conditionsUpper.indexOf('LIMIT');
      if (limitStart !== -1) {
        limitClause = conditions.substring(limitStart).trim();
      }
    }

    // Si nous avons des agrégations dans les champs (SUM, AVG, etc) mais pas de GROUP BY,
    // essayer d'ajouter un GROUP BY automatique avec les champs non agrégés
    if (
      groupByClause === '' &&
      fields.some((field) => /SUM\(|AVG\(|COUNT\(|MIN\(|MAX\(/i.test(field))
    ) {
      const nonAggregatedFields = fields.filter(
        (field) => !/SUM\(|AVG\(|COUNT\(|MIN\(|MAX\(/i.test(field),
      );

      if (nonAggregatedFields.length > 0) {
        groupByClause = `GROUP BY ${nonAggregatedFields.join(', ')}`;
      }
    }

    // Créer un ensemble des tables déjà jointes pour éviter les doublons
    const joinedTables = new Set<string>();
    tables.forEach((table) => joinedTables.add(table));

    // Ajouter les tables des conditions JOIN
    joinConditions.forEach((joinClause) => {
      const tableMatch = joinClause.match(/JOIN\s+(\w+)/i);
      if (tableMatch && tableMatch[1]) {
        joinedTables.add(tableMatch[1]);
      }
    });

    // Si nous avons plus d'une table, nous devons ajouter des relations de jointure
    if (tables.length > 1 || joinConditions.length > 0) {
      // Construire la requête avec des JOINs appropriés
      const primaryTable = tables[0]; // La première table est considérée comme principale

      // Commencer la requête avec la table principale
      let query = `SELECT ${selectFields} FROM ${primaryTable}`;

      // Ajouter d'abord les jointures explicites des conditions
      joinConditions.forEach((joinClause) => {
        query += ` ${joinClause}`;
      });

      // Puis ajouter les jointures pour les tables restantes si elles ne sont pas déjà jointes
      for (let i = 1; i < tables.length; i++) {
        const secondaryTable = tables[i];

        // Vérifier si cette table est déjà jointe
        if (
          !this.isTableAlreadyJoined(query, secondaryTable) &&
          !joinConditions.some((jc) => jc.includes(` ${secondaryTable} `))
        ) {
          // Déterminer la relation appropriée entre les tables
          const joinClause = this.determineJoinClause(
            primaryTable,
            secondaryTable,
          );

          if (joinClause) {
            query += ` ${joinClause}`;
          } else {
            // Si aucune relation directe n'est trouvée, utiliser CROSS JOIN avec avertissement
            this.logger.warn(
              `Aucune relation connue entre ${primaryTable} et ${secondaryTable}, utilisation de CROSS JOIN`,
            );
            query += ` CROSS JOIN ${secondaryTable}`;
          }
        }
      }

      // Ajouter les conditions si elles existent
      if (whereConditions && whereConditions.trim() !== '') {
        // Si la condition ne commence pas par WHERE, l'ajouter
        if (!whereConditions.trim().toUpperCase().startsWith('WHERE')) {
          query += ' WHERE ';
        } else {
          query += ' ';
        }
        query += whereConditions;
      }

      // Ajouter GROUP BY, ORDER BY et LIMIT si nécessaires
      if (groupByClause) {
        query += ` ${groupByClause}`;
      }
      if (orderByClause) {
        query += ` ${orderByClause}`;
      }
      if (limitClause) {
        query += ` ${limitClause}`;
      }

      return query;
    } else {
      // Traitement simple pour une seule table
      let query = `SELECT ${selectFields} FROM ${tables.join(', ')}`;

      // Ajouter les conditions si elles existent
      if (whereConditions && whereConditions.trim() !== '') {
        // Si la condition ne commence pas par WHERE, l'ajouter
        if (!whereConditions.trim().toUpperCase().startsWith('WHERE')) {
          query += ' WHERE ';
        } else {
          query += ' ';
        }
        query += whereConditions;
      }

      return query;
    }
  }

  /**
   * Détermine la clause JOIN appropriée entre deux tables
   * @param primaryTable La table principale
   * @param secondaryTable La table secondaire
   * @returns Une clause JOIN complète ou null si aucune relation n'est trouvée
   */
  private determineJoinClause(
    primaryTable: string,
    secondaryTable: string,
  ): string | null {
    // Définir les relations connues entre les tables
    const tableRelations: Record<string, Record<string, string>> = {
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

    // Vérifier si nous avons une relation directe
    if (
      tableRelations[primaryTable] &&
      tableRelations[primaryTable][secondaryTable]
    ) {
      return tableRelations[primaryTable][secondaryTable];
    }

    // Vérifier la relation inverse et l'adapter si nécessaire
    if (
      tableRelations[secondaryTable] &&
      tableRelations[secondaryTable][primaryTable]
    ) {
      // Extraire la relation inverse et l'adapter pour notre ordre de tables
      const inverseRelation = tableRelations[secondaryTable][primaryTable];
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
   * @param text Le texte à vérifier
   * @param keywords Liste des mots-clés à rechercher
   * @returns true si l'un des mots-clés est trouvé, false sinon
   */
  private containsAny(text: string, keywords: string[]): boolean {
    if (!text) return false;
    const lowerText = text.toLowerCase();
    return keywords.some((keyword) =>
      lowerText.includes(keyword.toLowerCase()),
    );
  }

  /**
   * Déterminer la condition temporelle basée sur la question
   */
  private determineTimeCondition(lowerQuestion: string): string {
    if (lowerQuestion.includes('demain')) {
      return "DATE(timesheet_entries.date) = CURRENT_DATE + INTERVAL '1 day'";
    } else if (this.containsAny(lowerQuestion, ['aujourd', 'ce jour'])) {
      return 'DATE(timesheet_entries.date) = CURRENT_DATE';
    } else if (
      this.containsAny(lowerQuestion, [
        'semaine prochaine',
        'prochaine semaine',
      ])
    ) {
      return "DATE(timesheet_entries.date) BETWEEN (CURRENT_DATE + INTERVAL '1 week') AND (CURRENT_DATE + INTERVAL '2 weeks - 1 day')";
    } else if (this.containsAny(lowerQuestion, ['cette semaine', 'semaine'])) {
      return "DATE(timesheet_entries.date) BETWEEN date_trunc('week', CURRENT_DATE) AND (date_trunc('week', CURRENT_DATE) + INTERVAL '6 days')";
    } else if (this.containsAny(lowerQuestion, ['mois prochain'])) {
      return "DATE(timesheet_entries.date) BETWEEN date_trunc('month', CURRENT_DATE + INTERVAL '1 month') AND (date_trunc('month', CURRENT_DATE + INTERVAL '1 month') + INTERVAL '1 month - 1 day')";
    } else if (
      this.containsAny(lowerQuestion, [
        'ce mois',
        'mois en cours',
        'mois actuel',
        'mois ci',
      ])
    ) {
      return "DATE(timesheet_entries.date) BETWEEN date_trunc('month', CURRENT_DATE) AND (date_trunc('month', CURRENT_DATE) + INTERVAL '1 month - 1 day')";
    }

    return '';
  }

  /**
   * Analyze a question to determine the appropriate availability query
   */
  private determineAvailabilityQuery(lowerQuestion: string): {
    tables: string[];
    fields: string[];
    conditions: string;
  } {
    const tables = ['staff'];
    const fields = [
      'staff.firstname',
      'staff.lastname',
      'staff.email',
      'staff.phone',
    ];
    let conditions = 'WHERE staff.is_active = true';
    let timePeriod = '';

    // Déterminer la période
    if (lowerQuestion.includes('demain')) {
      timePeriod = "timesheet_entries.date = CURRENT_DATE + INTERVAL '1 day'";
      tables.push('timesheet_entries');
    } else if (this.containsAny(lowerQuestion, ['aujourd', 'ce jour'])) {
      timePeriod = 'timesheet_entries.date = CURRENT_DATE';
      tables.push('timesheet_entries');
    } else if (
      this.containsAny(lowerQuestion, [
        'semaine prochaine',
        'prochaine semaine',
      ])
    ) {
      timePeriod =
        "timesheet_entries.date BETWEEN date_trunc('week', CURRENT_DATE + INTERVAL '1 week')::date AND (date_trunc('week', CURRENT_DATE + INTERVAL '1 week')::date + INTERVAL '6 days')";
      tables.push('timesheet_entries');
    } else if (this.containsAny(lowerQuestion, ['cette semaine', 'semaine'])) {
      timePeriod =
        "timesheet_entries.date BETWEEN date_trunc('week', CURRENT_DATE)::date AND (date_trunc('week', CURRENT_DATE)::date + INTERVAL '6 days')";
      tables.push('timesheet_entries');
    } else if (this.containsAny(lowerQuestion, ['mois prochain'])) {
      timePeriod =
        "EXTRACT(MONTH FROM timesheet_entries.date) = EXTRACT(MONTH FROM CURRENT_DATE + INTERVAL '1 month') AND EXTRACT(YEAR FROM timesheet_entries.date) = EXTRACT(YEAR FROM CURRENT_DATE + INTERVAL '1 month')";
      tables.push('timesheet_entries');
    } else if (
      this.containsAny(lowerQuestion, [
        'ce mois',
        'mois en cours',
        'mois actuel',
        'mois ci',
      ])
    ) {
      timePeriod =
        'EXTRACT(MONTH FROM timesheet_entries.date) = EXTRACT(MONTH FROM CURRENT_DATE) AND EXTRACT(YEAR FROM timesheet_entries.date) = EXTRACT(YEAR FROM CURRENT_DATE)';
      tables.push('timesheet_entries');
    }

    // Si on a une période de temps, construire la requête de disponibilité
    if (timePeriod) {
      // Utiliser LEFT JOIN pour trouver les membres du staff sans entrées de planning
      conditions = `WHERE staff.is_active = true AND NOT EXISTS (SELECT 1 FROM timesheet_entries WHERE timesheet_entries.staff_id = staff.id AND ${timePeriod})`;

      // Retirer timesheet_entries des tables pour utiliser un subquery NOT EXISTS
      if (tables.includes('timesheet_entries')) {
        tables.splice(tables.indexOf('timesheet_entries'), 1);
      }
    }

    return { tables, fields, conditions };
  }

  /**
   * Analyse les mots-clés de la question pour déterminer la configuration de requête
   */
  private analyzeQuestionKeywords(lowerQuestion: string): {
    tables: string[];
    fields: string[];
    conditions: string;
  } | null {
    // Structure pour stocker le résultat
    const result: {
      tables: string[];
      fields: string[];
      conditions: string;
    } = {
      tables: [],
      fields: [],
      conditions: '',
    };

    // Déterminer les entités concernées (tables)
    if (this.containsAny(lowerQuestion, ['facture', 'invoice', 'paiement'])) {
      result.tables = ['invoices', 'ref_status'];

      if (this.containsAny(lowerQuestion, ['total', 'montant', 'somme'])) {
        result.fields = ['SUM(invoices.total_ttc) as montant_total'];

        if (
          this.containsAny(lowerQuestion, ['attente', 'en cours', 'non payé'])
        ) {
          result.conditions =
            "ref_status.code = 'en_attente' AND ref_status.entity_type = 'invoice'";
        }
      } else {
        result.fields = [
          'invoices.id',
          'invoices.reference',
          'invoices.issue_date',
          'invoices.total_ttc',
          'ref_status.name as status',
        ];
      }
    } else if (this.containsAny(lowerQuestion, ['dispo', 'disponible'])) {
      // Pour les questions de disponibilité, utiliser une logique spécifique
      const availabilityQuery = this.determineAvailabilityQuery(lowerQuestion);
      result.tables = availabilityQuery.tables;
      result.fields = availabilityQuery.fields;
      result.conditions = availabilityQuery.conditions;
    } else if (
      this.containsAny(lowerQuestion, [
        'travail',
        'personnel',
        'staff',
        'employé',
      ])
    ) {
      result.tables = ['staff', 'timesheet_entries'];
      result.fields = [
        'DISTINCT staff.id',
        'staff.firstname',
        'staff.lastname',
        'staff.role',
      ];

      // Déterminer la période temporelle pour les timesheet_entries
      if (
        this.containsAny(lowerQuestion, [
          'mois courant',
          'ce mois',
          'mois en cours',
          'mois actuel',
        ])
      ) {
        result.conditions =
          'WHERE staff.is_active = true AND EXISTS (SELECT 1 FROM timesheet_entries WHERE timesheet_entries.staff_id = staff.id AND EXTRACT(MONTH FROM timesheet_entries.date) = EXTRACT(MONTH FROM CURRENT_DATE) AND EXTRACT(YEAR FROM timesheet_entries.date) = EXTRACT(YEAR FROM CURRENT_DATE))';
      } else if (
        this.containsAny(lowerQuestion, ['semaine', 'cette semaine'])
      ) {
        result.conditions =
          "WHERE staff.is_active = true AND EXISTS (SELECT 1 FROM timesheet_entries WHERE timesheet_entries.staff_id = staff.id AND timesheet_entries.date BETWEEN date_trunc('week', CURRENT_DATE)::date AND (date_trunc('week', CURRENT_DATE)::date + INTERVAL '6 days'))";
      } else if (this.containsAny(lowerQuestion, ['aujourd', 'ce jour'])) {
        result.conditions =
          'WHERE staff.is_active = true AND EXISTS (SELECT 1 FROM timesheet_entries WHERE timesheet_entries.staff_id = staff.id AND timesheet_entries.date = CURRENT_DATE)';
      } else if (this.containsAny(lowerQuestion, ['demain'])) {
        result.conditions =
          "WHERE staff.is_active = true AND EXISTS (SELECT 1 FROM timesheet_entries WHERE timesheet_entries.staff_id = staff.id AND timesheet_entries.date = CURRENT_DATE + INTERVAL '1 day')";
      } else {
        result.conditions = 'WHERE staff.is_active = true';
      }
    } else if (this.containsAny(lowerQuestion, ['projet', 'chantier'])) {
      result.tables = ['projects', 'clients', 'ref_status'];
      result.fields = [
        'projects.id',
        'projects.name',
        'projects.start_date',
        'projects.end_date',
        "clients.firstname || ' ' || clients.lastname as client_name",
        'ref_status.name as status',
      ];

      // Conditions basées sur l'état du projet
      if (this.containsAny(lowerQuestion, ['en cours', 'actif', 'actuel'])) {
        result.conditions =
          "ref_status.code = 'en_cours' AND ref_status.entity_type = 'project'";
      }
    } else if (this.containsAny(lowerQuestion, ['client', 'customer'])) {
      result.tables = ['clients', 'addresses'];
      result.fields = [
        'clients.id',
        'clients.firstname',
        'clients.lastname',
        'clients.email',
        'clients.phone',
        'addresses.city',
      ];

      if (this.containsAny(lowerQuestion, ['récent', 'nouveau', 'dernier'])) {
        result.fields.push('clients.created_at');
        result.conditions = 'ORDER BY clients.created_at DESC LIMIT 10';
      }
    }

    return result.tables.length > 0 ? result : null;
  }

  /**
   * Vérifie si une table est déjà jointe dans une requête
   * @param query La requête SQL
   * @param tableName Le nom de la table à vérifier
   * @returns true si la table est déjà jointe, false sinon
   */
  private isTableAlreadyJoined(query: string, tableName: string): boolean {
    const lowerQuery = query.toLowerCase();
    const lowerTableName = tableName.toLowerCase();
    return lowerQuery.includes(` ${lowerTableName} `);
  }
}
