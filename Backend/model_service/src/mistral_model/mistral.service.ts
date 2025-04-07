export const mistralService = {
  async generateText(prompt: string) {
    const response = await fetch('https://api.mistral.ai/v1/generate', {
      method: 'POST',
      body: JSON.stringify({ prompt }),
    });
  },
};
