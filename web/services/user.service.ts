import httpClient from "../core/httpClient";

export interface User {
    id: string; 
    name: string;
    publicKey: string;
}

export class UserService {
    async createUser(userData: { id: string; name: string; publicKey: string }): Promise<User> {
        const response = await httpClient.post<User>('/user', userData);
        return response.data;
    }
    async getUserById(id: string): Promise<User> {
        const response = await httpClient.get<User>(`/user/${id}`);
        return response.data;
    }
    async getUserByPublicKey(publicKey: string): Promise<User> {
        const response = await httpClient.get<User>(`/user/public/${publicKey}`);
        return response.data;
    }   
    async getUserByName(name: string): Promise<User> {
        const response = await httpClient.get<User>(`/user/name/${name}`);
        return response.data;
    }   
}