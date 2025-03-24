import { url } from "../../url";

export const chatbot = {
    analyze: async (question: string) => {
        const response = await fetch(`${url.local}/analyse/question`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ question }),
        });
        return response.json();
    }
}
