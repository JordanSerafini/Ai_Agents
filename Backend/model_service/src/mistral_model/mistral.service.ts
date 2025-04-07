export interface MistralResponse {
  text: string;
  [key: string]: any;
}

export const mistralService = {
  async generateText(prompt: string): Promise<MistralResponse> {
    const response = await fetch('https://api.mistral.ai/v1/generate', {
      method: 'POST',
      body: JSON.stringify({ prompt }),
    });

    if (!response.ok) {
      throw new Error(`Error from Mistral API: ${response.statusText}`);
    }

    const data = (await response.json()) as MistralResponse;
    return data;
  },
};
