/**
 * Requêtes pour les paramètres système
 */
export const SETTINGS_QUERIES = {
  // Récupérer tous les paramètres
  GET_ALL: `
    SELECT * FROM system_settings
    ORDER BY key;
  `,

  // Récupérer un paramètre par sa clé
  GET_BY_KEY: `
    SELECT * FROM system_settings
    WHERE key = $1;
  `,

  // Récupérer plusieurs paramètres par leurs clés
  GET_BY_KEYS: `
    SELECT * FROM system_settings
    WHERE key = ANY($1::varchar[]);
  `,

  // Mettre à jour un paramètre
  UPDATE: `
    SELECT update_setting($1, $2::jsonb) as updated;
  `,

  // Ajouter un nouveau paramètre ou le mettre à jour s'il existe déjà
  ADD: `
    INSERT INTO system_settings (key, value, description, is_editable)
    VALUES ($1, $2::jsonb, $3, $4)
    ON CONFLICT (key) 
    DO UPDATE SET
      value = $2::jsonb,
      description = $3,
      is_editable = $4,
      updated_at = CURRENT_TIMESTAMP
    RETURNING key, value;
  `,

  // Récupérer les informations de l'entreprise
  GET_COMPANY_INFO: `
    SELECT value FROM system_settings
    WHERE key = 'company_info';
  `,

  // Récupérer les paramètres de l'IA
  GET_AI_SETTINGS: `
    SELECT value FROM system_settings
    WHERE key = 'ai_settings';
  `,

  // Récupérer les paramètres de facturation
  GET_INVOICE_SETTINGS: `
    SELECT value FROM system_settings
    WHERE key = 'invoice_settings';
  `,

  // Récupérer les paramètres de devis
  GET_QUOTATION_SETTINGS: `
    SELECT value FROM system_settings
    WHERE key = 'quotation_settings';
  `,

  // Récupérer les paramètres de notification
  GET_NOTIFICATION_SETTINGS: `
    SELECT value FROM system_settings
    WHERE key = 'notification_settings';
  `,

  // Récupérer les paramètres de sécurité
  GET_SECURITY_SETTINGS: `
    SELECT value FROM system_settings
    WHERE key = 'security_settings';
  `,

  // Récupérer la version du système
  GET_SYSTEM_VERSION: `
    SELECT value FROM system_settings
    WHERE key = 'system_version';
  `,

  // Incrémenter le numéro de facture
  INCREMENT_INVOICE_NUMBER: `
    UPDATE system_settings
    SET value = jsonb_set(value, '{next_invoice_number}', 
      (COALESCE((value->>'next_invoice_number')::integer, 1) + 1)::text::jsonb)
    WHERE key = 'invoice_settings' AND is_editable = true
    RETURNING value->>'next_invoice_number' as next_invoice_number;
  `,

  // Incrémenter le numéro de devis
  INCREMENT_QUOTATION_NUMBER: `
    UPDATE system_settings
    SET value = jsonb_set(value, '{next_quotation_number}', 
      (COALESCE((value->>'next_quotation_number')::integer, 1) + 1)::text::jsonb)
    WHERE key = 'quotation_settings' AND is_editable = true
    RETURNING value->>'next_quotation_number' as next_quotation_number;
  `,
};
