import { useEffect, useState } from "react";
import Input from "./Input";
import Message from "./Message";

function Messagerie() {
  const [response, setResponse] = useState<any>(null);

  useEffect(() => {
    console.log("Nouvelle réponse:", response);
  }, [response]);

  return (
    <div className="bg-gray-200 w-9.5/10 h-9.5/10 rounded-lg shadow-md flex flex-col items-center justify-start p-2">
      <div className="w-full h-9.5/10 overflow-y-auto">
        {response && <Message response={response} />}
      </div>
      <Input onResponse={setResponse} />
    </div>
  );
}

export default Messagerie;
