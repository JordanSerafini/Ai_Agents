import { useState } from "react";
import { chatbot } from "../../utils/functions/chatbot/chatbot.function";

interface InputProps {
    onResponse: (response: any) => void;
}

function Input({ onResponse }: InputProps) {
    const [question, setQuestion] = useState("");
    const [error, setError] = useState<string | null>(null);

    const handleSubmit = async (e: React.MouseEvent<HTMLButtonElement>) => {
        e.preventDefault();
        console.log("Début de l'envoi de la question:", question);
        
        try {
            const data = await chatbot.analyze(question);
            console.log("Réponse reçue:", data);
            onResponse(data);
        } catch (error) {
            console.error("Erreur lors de l'appel API:", error);
            setError("Erreur lors de l'envoi de la question");
        }
    }

    return (
        <div className="flex flex-col gap-4">
            <div className="flex gap-2">
                <input 
                    type="text" 
                    value={question} 
                    onChange={(e) => setQuestion(e.target.value)}
                    className="flex-1 p-2 border rounded"
                    placeholder="Posez votre question..."
                />
                <button 
                    onClick={handleSubmit}
                    className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
                >
                    Envoyer
                </button>
            </div>
            {error && <div className="text-red-500">{error}</div>}
        </div>
    )
}

export default Input