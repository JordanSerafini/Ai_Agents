import { Injectable, Logger } from '@nestjs/common';

// Structure pour stocker l'historique des conversations
interface ConversationHistory {
  messages: Array<{
    role: 'user' | 'assistant' | 'system';
    content: string;
    timestamp: number;
  }>;
  lastInteraction: number;
}

@Injectable()
export class ConversationService {
  private readonly logger = new Logger(ConversationService.name);
  private readonly conversationHistories: Map<string, ConversationHistory> =
    new Map();
  private readonly historyTTL: number = 1800000; // 30 minutes en millisecondes
  private readonly maxHistoryLength: number = 10; // Nombre maximum de messages à conserver

  constructor() {
    // Nettoyer les historiques expirés toutes les 15 minutes
    setInterval(() => this.cleanupExpiredHistories(), 900000);
  }

  /**
   * Récupère l'historique de conversation d'un utilisateur
   */
  getConversationHistory(userId: string): ConversationHistory {
    let history = this.conversationHistories.get(userId);
    if (!history) {
      history = {
        messages: [],
        lastInteraction: Date.now(),
      };
      this.conversationHistories.set(userId, history);
    }
    history.lastInteraction = Date.now();
    return history;
  }

  /**
   * Ajoute un message à l'historique de conversation d'un utilisateur
   */
  addToConversationHistory(
    userId: string,
    role: 'user' | 'assistant' | 'system',
    content: string,
  ): ConversationHistory {
    const history = this.getConversationHistory(userId);
    history.messages.push({
      role,
      content,
      timestamp: Date.now(),
    });
    if (history.messages.length > this.maxHistoryLength) {
      history.messages.shift();
    }
    history.lastInteraction = Date.now();
    return history;
  }

  /**
   * Nettoie les historiques de conversation expirés
   */
  private cleanupExpiredHistories(): void {
    const now = Date.now();
    let expiredCount = 0;

    for (const [userId, history] of this.conversationHistories.entries()) {
      if (now - history.lastInteraction > this.historyTTL) {
        this.conversationHistories.delete(userId);
        expiredCount++;
      }
    }

    if (expiredCount > 0) {
      this.logger.log(
        `${expiredCount} historiques de conversation expirés ont été supprimés`,
      );
    }
  }
}
