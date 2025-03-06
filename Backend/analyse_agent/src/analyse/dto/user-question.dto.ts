/**
 * DTO pour les requêtes de questions utilisateur
 */
export class UserQuestionDto {
  /**
   * La question posée par l'utilisateur
   */
  question!: string;

  /**
   * Identifiant de l'utilisateur (optionnel)
   */
  userId?: string;

  /**
   * Indique si l'historique des conversations doit être utilisé
   */
  useHistory?: boolean;
}
