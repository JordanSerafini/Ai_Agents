import { url } from "../../config/url";

export const chatbot = {
    analyze: async (question: string) => {
        const response = await fetch(`${url.local}${url.endpoints.analyse}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ question }),
        });
        return response.json();
    }
}
