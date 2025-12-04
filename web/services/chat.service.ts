import httpClient from "../core/httpClient";

export interface Chat {
	id: string;
	createdAt: string;
	title: string;
	userId: string;
	visibility?: 'public' | 'private';
}

export interface Message {
	id: string;
	chatId: string;
	role: string;
	content: any;
	createdAt: string;
}

export class ChatService {
	async createChat(data: { title: string; userId: string; chatId?: string }): Promise<Chat> {
		const response = await httpClient.post<Chat>('/chat', data);
		return response.data;
	}

	async getAllChatsForUser(userId: string): Promise<Chat[]> {
		const response = await httpClient.get<Chat[]>(`/chat/user/${userId}`);
		return response.data;
	}

	async getChatById(chatId: string): Promise<Chat> {
		const response = await httpClient.get<Chat>(`/chat/${chatId}`);
		return response.data;
	}

	async deleteChat(chatId: string): Promise<{ message: string; deleted?: boolean }> {
		const response = await httpClient.delete<{ message: string; deleted?: boolean }>(`/chat/${chatId}`);
		return response.data;
	}

	async saveMessages(messages: Message[]): Promise<any> {
		const response = await httpClient.post('/chat/messages', { messages });
		return response.data;
	}

	async getMessagesInChat(chatId: string): Promise<Message[]> {
		const response = await httpClient.get<Message[]>(`/chat/${chatId}/messages`);
		return response.data;
	}

	async deleteMessagesInChat(chatId: string): Promise<{ message: string }> {
		const response = await httpClient.delete<{ message: string }>(`/chat/${chatId}/messages`);
		return response.data;
	}
}

export default ChatService

