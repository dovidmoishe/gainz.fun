import httpClient from "../core/httpClient";

export interface AIMessage {
    id?: string;
    role: 'user' | 'assistant';
    content: string;
    createdAt?: Date;
    chatId?: string;
}

export class AIService {
    async streamResponse(
        messages: AIMessage[],
        chatId: string,
        userId: string,
        onToken: (token: string) => void,
        onComplete: () => void,
        onError: (error: Error) => void,
        userPublicKey?: string,
        walletId?: string
    ): Promise<void> {
        try {
            const baseURL = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:3000";
            const response = await fetch(`${baseURL}/ai/stream`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    messages,
                    chatId,
                    userId,
                    userPublicKey,
                    walletId,
                }),
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const reader = response.body?.getReader();
            const decoder = new TextDecoder();

            if (!reader) {
                throw new Error('No response body');
            }

            let buffer = '';

            while (true) {
                const { done, value } = await reader.read();
                
                if (done) {
                    onComplete();
                    break;
                }

                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split('\n');
                buffer = lines.pop() || ''; // Keep incomplete line in buffer

                for (const line of lines) {
                    if (line.startsWith('data: ')) {
                        try {
                            // Parse the JSON string that was stringified by the backend
                            const jsonString = line.slice(6);
                            const data = JSON.parse(jsonString);
                            
                            // Handle content tokens
                            if (data.data?.token && data.data.type === 'content') {
                                onToken(data.data.token);
                            }
                            // Handle function results
                            if (data.data?.token && data.data.type === 'function_result') {
                                onToken(data.data.token);
                            }
                        } catch (e) {
                            // Ignore parse errors for incomplete JSON
                        }
                    }
                }
            }
        } catch (error) {
            onError(error as Error);
        }
    }
}

export default new AIService();

