import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5001/api';

const apiClient = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  // Add timeout to prevent long-hanging requests
  timeout: 30000, // 30 seconds timeout
});

apiClient.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('userToken');
    if (token) {
      config.headers['Authorization'] = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    console.error('API request interceptor error:', error);
    return Promise.reject(error);
  }
);

// Add response interceptor for common error handling
apiClient.interceptors.response.use(
  (response) => {
    return response;
  },
  (error) => {
    // Handle common connection errors
    if (!error.response) {
      if (error.code === 'ECONNABORTED') {
        console.error('Request timeout - server took too long to respond');
        error.friendlyMessage = 'The server took too long to respond. Please try again later.';
      } else if (error.code === 'ERR_NETWORK' || error.message.includes('Network Error')) {
        console.error('Network error - cannot connect to backend server');
        error.friendlyMessage = 'Cannot connect to the server. Please check if the backend server is running.';
      }
    } else if (error.response.status === 500) {
      console.error('Server error:', error.response.data);
      error.friendlyMessage = 'The server encountered an internal error. Please try again later.';
    }
    
    return Promise.reject(error);
  }
);

export default apiClient;
