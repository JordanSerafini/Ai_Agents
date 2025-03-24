import { useState } from "react"

interface MessageProps {
    response: {
        data: any;
        type: 'list' | 'detail';
        humanResponse: string;
    };
}

function Message({ response }: MessageProps) {
    const cleanResponse = response.humanResponse
        .replace(/^Tu es un assistant.*?français\./s, '')
        .replace(/^Voici les informations.*?naturelle\./s, '')
        .replace(/^Question :.*?naturelle\./s, '')
        .replace(/^Type de réponse :.*?naturelle\./s, '')
        .replace(/^Données :.*?naturelle\./s, '')
        .replace(/^IMPORTANT :.*?naturelle\./s, '')
        .replace(/^Instructions :.*?naturelle\./s, '')
        .replace(/^Réponse :.*?naturelle\./s, '')
        .trim();

    return (
        <div className="bg-white p-4 w-full rounded-lg shadow-md">
            <div className="text-gray-800 whitespace-pre-line">
                {cleanResponse}
            </div>
        </div>
    )
}

export default Message