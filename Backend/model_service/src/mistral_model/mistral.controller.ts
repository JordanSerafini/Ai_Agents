import { mistralService, MistralResponse } from './mistral.service';

export const mistralController = {
  async generateText(prompt: string): Promise<MistralResponse> {
    return await mistralService.generateText(prompt);
  },
};
