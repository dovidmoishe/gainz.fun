import axios from "axios"

const httpClient = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:4000",
  timeout: 10000,
    headers: {  
    "Content-Type": "application/json",
    },
})

// Add response interceptor for debugging
httpClient.interceptors.response.use(
  (response) => {
    console.log('API Response:', response.config.url, response.data)
    return response
  },
  (error) => {
    console.error('API Error:', error.config?.url, error.response?.data || error.message)
    return Promise.reject(error)
  }
)

export default httpClient