import { useState } from "react"

interface MessageProps {
    response: {
        data: any;
        type: 'list' | 'detail';
        humanResponse: string;
    };
}

function Message({ response }: MessageProps) {
    return (
        <div className="bg-white p-4 w-full rounded-lg shadow-md">
            <div className="text-gray-800">
                {response.humanResponse}
            </div>
        </div>
    )
}

export default Message