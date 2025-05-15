import { defineStore } from 'pinia';
import { loginUser, registerUser } from '../services/authService';
import { useRouter } from 'vue-router';

export const useAuthStore = defineStore('auth', {
  state: () => {
    let storedUser = null;
    const userString = localStorage.getItem('user');
    if (userString && userString !== 'undefined' && userString !== 'null') {
      try {
        storedUser = JSON.parse(userString);
      } catch (e) {
        console.error('Failed to parse user from localStorage:', e, 'Value was:', userString);
        localStorage.removeItem('user'); // Clear invalid entry
      }
    } else if (userString === 'undefined' || userString === 'null') {
      localStorage.removeItem('user'); // Clear 'undefined' or 'null' string literal
    }

    return {
      user: storedUser,
      token: localStorage.getItem('userToken') || null,
      error: null,
      loading: false,
    };
  },
  getters: {
    isAuthenticated: (state) => !!state.token,
    currentUser: (state) => state.user,
    authError: (state) => state.error,
    isLoading: (state) => state.loading,
  },
  actions: {
    async login(credentials) {
      this.loading = true;
      this.error = null;
      try {
        const data = await loginUser(credentials);
        this.token = data.token;
        this.user = data.user;
        localStorage.setItem('userToken', data.token);
        localStorage.setItem('user', JSON.stringify(data.user));
        return true;
      } catch (error) {
        this.error = error.message || 'Login failed';
        return false;
      } finally {
        this.loading = false;
      }
    },
    async register(userData) {
      this.loading = true;
      this.error = null;
      try {
        const data = await registerUser(userData);
        this.token = data.token;
        this.user = data.user;
        localStorage.setItem('userToken', data.token);
        localStorage.setItem('user', JSON.stringify(data.user));
        return true;
      } catch (error) {
        this.error = error.message || 'Registration failed';
        return false;
      } finally {
        this.loading = false;
      }
    },
    logout() {
      this.user = null;
      this.token = null;
      localStorage.removeItem('userToken');
      localStorage.removeItem('user');
    },
    clearError() {
      this.error = null;
    }
  },
});
