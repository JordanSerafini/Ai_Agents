export interface MistralResponse {
  text: string;
  [key: string]: any;
}

export interface ModelResponse {
  choices?: Array<{
    message?: {
      content: string;
    };
  }>;
  response?: string;
  error?: string;
}

export const mistralService = {
  async generateText(prompt: string): Promise<string> {
    try {
      const modelUrl = process.env.MODEL_URL;
      if (!modelUrl) {
        throw new Error('MODEL_URL environment variable is not set');
      }

      const response = await fetch(`${modelUrl}/v1/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messages: [{ role: 'user', content: prompt }],
          max_tokens: -1,
          temperature: 0.2,
        }),
      });

      if (!response.ok) {
        throw new Error(`Model API responded with status: ${response.status}`);
      }

      const data = (await response.json()) as ModelResponse;

      if (data.error) {
        throw new Error(`Model API error: ${data.error}`);
      }

      if (
        data.choices &&
        data.choices.length > 0 &&
        data.choices[0].message?.content
      ) {
        return data.choices[0].message.content;
      }

      if (data.response) {
        return data.response;
      }

      throw new Error('Invalid response format from model API');
    } catch (error) {
      console.error('Error calling model:', error);
      throw error;
    }
  },
};
