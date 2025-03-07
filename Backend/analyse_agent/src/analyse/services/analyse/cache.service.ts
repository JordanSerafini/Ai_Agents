import { Injectable, Logger } from '@nestjs/common';

interface CacheEntry {
  reponse: string;
  timestamp: number;
}

@Injectable()
export class CacheService {
  private readonly logger = new Logger(CacheService.name);
  private readonly responseCache: Map<string, CacheEntry> = new Map();
  private readonly cacheTTL: number = 3600000; // 1 heure en millisecondes

  /**
   * Génère une clé de cache à partir d'une question
   */
  getCacheKey(question: string): string {
    return question.trim().toLowerCase();
  }

  /**
   * Récupère une réponse du cache si elle existe et n'est pas expirée
   */
  getFromCache(question: string): string | null {
    const key = this.getCacheKey(question);
    const entry = this.responseCache.get(key);

    if (!entry) {
      return null;
    }

    const now = Date.now();
    if (now - entry.timestamp > this.cacheTTL) {
      // L'entrée est expirée, la supprimer du cache
      this.responseCache.delete(key);
      return null;
    }

    this.logger.log(
      `Réponse trouvée dans le cache pour la question: ${question}`,
    );
    return entry.reponse;
  }

  /**
   * Sauvegarde une réponse dans le cache
   */
  saveToCache(question: string, reponse: string): void {
    const key = this.getCacheKey(question);
    this.responseCache.set(key, {
      reponse,
      timestamp: Date.now(),
    });
    this.logger.log(`Réponse ajoutée au cache pour la question: ${question}`);
  }
}
