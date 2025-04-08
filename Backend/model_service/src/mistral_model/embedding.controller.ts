import { Body, Controller, Post } from '@nestjs/common';
import { mistralService } from './mistral.service';

@Controller('embedding')
export class EmbeddingController {
  // Dimension de l'embedding - correspondant à Mistral-7B
  private readonly EMBEDDING_DIM = 4096;

  @Post()
  async generateEmbedding(@Body() body: { text: string }) {
    try {
      // Nettoyage et préparation du texte
      const cleanText = body.text.trim().replace(/\n+/g, ' ').slice(0, 8000);

      // Prompt structuré pour demander un embedding à Mistral
      const prompt = `
Tu es un service d'embedding vectoriel haute qualité.
Ta tâche est de transformer le texte fourni en un vecteur d'embedding de dimension ${this.EMBEDDING_DIM}.
Réponds UNIQUEMENT avec un tableau JSON de ${this.EMBEDDING_DIM} nombres flottants sans aucun autre texte.
Assure-toi que les valeurs du vecteur capturent la sémantique du texte et couvrent bien l'espace vectoriel.

Texte à transformer en embedding: "${cleanText}"

Embedding (tableau de ${this.EMBEDDING_DIM} valeurs):
`;

      const response = await mistralService.generateText(prompt);

      // Tentative d'extraction du tableau JSON
      try {
        // Recherche du tableau dans la réponse
        const matches = response.match(
          /\[\s*-?\d+(\.\d+)?(,\s*-?\d+(\.\d+)?)*\s*\]/,
        );

        if (matches && matches[0]) {
          try {
            const embeddingArray = JSON.parse(matches[0]);

            // Vérifier que c'est bien un tableau avec le bon nombre d'éléments
            if (Array.isArray(embeddingArray) && embeddingArray.length > 0) {
              // Si l'embedding n'a pas la dimension attendue, on le redimensionne
              if (embeddingArray.length !== this.EMBEDDING_DIM) {
                console.warn(
                  `L'embedding a une dimension de ${embeddingArray.length}, redimensionnement à ${this.EMBEDDING_DIM}`,
                );
                return {
                  embedding: this.resizeEmbedding(
                    embeddingArray,
                    this.EMBEDDING_DIM,
                  ),
                  original_size: embeddingArray.length,
                };
              }

              return { embedding: embeddingArray };
            }
          } catch (parseError) {
            console.error('Erreur de parsing JSON:', parseError);
          }
        }

        // Fallback: générer un embedding avec la bonne dimension
        console.warn(
          "Génération d'un embedding de secours - Réponse du modèle:",
          response,
        );
        const fallbackEmbedding = this.generateFallbackEmbedding(cleanText);
        return {
          embedding: fallbackEmbedding,
          warning:
            'Embedding généré de manière déterministe à partir du texte (fallback)',
        };
      } catch (error) {
        console.error("Erreur lors du traitement de l'embedding:", error);
        const fallbackEmbedding = this.generateFallbackEmbedding(cleanText);
        return {
          embedding: fallbackEmbedding,
          warning:
            'Embedding généré de manière déterministe à partir du texte (fallback après erreur)',
        };
      }
    } catch (error) {
      console.error("Erreur lors de la génération de l'embedding:", error);
      throw error;
    }
  }

  // Méthode pour redimensionner un embedding à la taille souhaitée
  private resizeEmbedding(embedding: number[], targetSize: number): number[] {
    if (embedding.length === targetSize) {
      return embedding;
    }

    const result = new Array(targetSize).fill(0);

    if (embedding.length > targetSize) {
      // Réduction: moyenne des valeurs sur des segments
      const ratio = embedding.length / targetSize;
      for (let i = 0; i < targetSize; i++) {
        const start = Math.floor(i * ratio);
        const end = Math.floor((i + 1) * ratio);
        let sum = 0;

        for (let j = start; j < end; j++) {
          sum += embedding[j];
        }

        result[i] = sum / (end - start);
      }
    } else {
      // Extension: interpolation linéaire
      const ratio = (embedding.length - 1) / (targetSize - 1);

      for (let i = 0; i < targetSize; i++) {
        const position = i * ratio;
        const index = Math.floor(position);
        const fraction = position - index;

        if (index + 1 < embedding.length) {
          result[i] =
            embedding[index] * (1 - fraction) + embedding[index + 1] * fraction;
        } else {
          result[i] = embedding[index];
        }
      }
    }

    // Normalisation
    const norm = Math.sqrt(result.reduce((sum, val) => sum + val * val, 0));
    return norm > 0 ? result.map((val) => val / norm) : result;
  }

  // Génère un embedding de secours basé sur un hachage du texte
  private generateFallbackEmbedding(text: string): number[] {
    // Utiliser une méthode déterministe basée sur le texte
    const embedding = new Array(this.EMBEDDING_DIM).fill(0);

    // Crée un embedding pseudo-aléatoire mais déterministe basé sur le texte
    for (let i = 0; i < text.length; i++) {
      const charCode = text.charCodeAt(i);
      const position = (charCode * 11) % this.EMBEDDING_DIM;
      embedding[position] += charCode * 0.01;
    }

    // Ajouter de la variance pour toutes les dimensions
    for (let i = 0; i < this.EMBEDDING_DIM; i++) {
      embedding[i] += (i * 0.001) % 1;
    }

    // Normalisation
    const norm = Math.sqrt(embedding.reduce((sum, val) => sum + val * val, 0));
    return norm > 0 ? embedding.map((val) => val / norm) : embedding;
  }
}
