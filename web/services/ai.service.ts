import httpClient from "../core/httpClient";
import { Message } from "./chat.service";

export interface AIMessage {
    id: string;
    role: 'user' | 'assistant';
    content: string;
    createdAt: Date;
    chatId: string;
}

export class AIService {
    async generateMessagesStream(
        dto: { messages: Message[]; chatId: string; userId: string },
        onToken: (token: string, type?: string) => void,
        onComplete: (fullMessage: Message) => void,
        onError: (error: Error) => void
    ): Promise<() => void> {
        const baseURL = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:4000";
        const abortController = new AbortController();
        let eventSource: EventSource | null = null;

        (async () => {
            try {
                console.log('🚀 Initializing stream with messages:', dto.messages.length);
                console.log('📤 Sending init request to /ai/message-stream/init');
                
                const initResponse = await httpClient.post<{ streamId: string }>(
                    '/ai/message-stream/init',
                    {
                        messages: dto.messages.map(msg => ({
                            ...msg,
                            createdAt: msg.createdAt instanceof Date 
                                ? msg.createdAt.toISOString() 
                                : msg.createdAt,
                        })),
                        chatId: dto.chatId,
                        userId: dto.userId,
                    }
                );

                console.log('📥 Init response received:', initResponse.data);
                const { streamId } = initResponse.data;
                console.log('✅ Stream initialized with streamId:', streamId);

                const url = `${baseURL}/ai/message-stream/${streamId}`;
                console.log('🔗 Connecting to SSE:', url);

                eventSource = new EventSource(url);

                let buffer = '';

                eventSource.onopen = () => {
                    console.log('✅ SSE connection opened');
                };

                eventSource.onmessage = (event) => {
                    try {
                        if (event.data) {
                            const data = JSON.parse(event.data);
                            
                            if (data.token) {
                                onToken(data.token, data.type);
                            }
                        }
                    } catch (e) {
                        console.error('❌ Error parsing SSE data:', e, 'Raw data:', event.data);
                    }
                };

                eventSource.addEventListener('done', (event) => {
                    try {
                        const data = JSON.parse(event.data);
                        console.log('✅ Stream completed with message ID:', data.id);
                        
                        const fullMessage: Message = {
                            id: data.id,
                            chatId: dto.chatId,
                            role: 'assistant',
                            content: '',
                            createdAt: new Date().toISOString(),
                        };
                        
                        eventSource?.close();
                        onComplete(fullMessage);
                    } catch (e) {
                        console.error('❌ Error parsing done event:', e);
                        onError(new Error('Failed to parse completion event'));
                    }
                });

                eventSource.onerror = (error) => {
                    console.error('❌ EventSource error:', error);
                    console.error('EventSource readyState:', eventSource?.readyState);
                    
                    // Always close and error out - don't let EventSource auto-reconnect
                    eventSource?.close();
                    onError(new Error('Stream connection failed or closed'));
                };

                abortController.signal.addEventListener('abort', () => {
                    eventSource?.close();
                });
            } catch (error: any) {
                console.error('❌ Error initializing stream:', error);
                eventSource?.close();
                onError(new Error(error.response?.data?.message || error.message || 'Failed to initialize stream'));
            }
        })();

        return () => {
            abortController.abort();
            eventSource?.close();
        };
    }
}

export default new AIService();

