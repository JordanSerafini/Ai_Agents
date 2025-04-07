import { mistralService } from './mistral.service';

export const mistralController = {
  async generateText(prompt: string) {
    return await mistralService.generateText(prompt);
  },
};
