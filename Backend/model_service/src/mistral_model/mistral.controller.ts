import { mistralService } from './mistral.service';

export const mistralController = {
  async generateText(prompt: string): Promise<string> {
    return await mistralService.generateText(prompt);
  },
};
