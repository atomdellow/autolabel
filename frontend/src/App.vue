<script setup>
import { computed } from 'vue';
import { useAuthStore } from './store/authStore';
import { useRouter, useRoute } from 'vue-router';
import NavigationBar from './components/NavigationBar.vue';

import './styles/app.css';

const authStore = useAuthStore();
const router = useRouter();
const route = useRoute();

const isAuthenticated = computed(() => authStore.isAuthenticated);
// Determine if we should show full width content (like for annotation editor)
const isFullWidth = computed(() => {
  return route.path.includes('/annotate');
});

const handleLogout = async () => {
  await authStore.logout();
  router.push('/login');
};
</script>

<template>
  <div id="app">
    <NavigationBar>
      <router-link to="/">Home</router-link> |
      <router-link to="/dashboard">Dashboard</router-link> |
      <router-link v-if="isAuthenticated" to="/training">Training</router-link> |
      <span v-if="!isAuthenticated">
        <router-link to="/login">Login</router-link> |
        <router-link to="/register">Register</router-link>
      </span>
      <span v-else>
        <button @click="handleLogout">Logout</button>
      </span>
    </NavigationBar>

    <main class="content-container" :class="{ 'full-width-content': isFullWidth, 'centered-content': !isFullWidth }">
      <router-view />
    </main>
  </div>
</template>


<style>
/* Styles moved to separate file: src/styles/app.css */
</style>

<style>
/* Styles moved to separate file: src/styles/app.css */
</style>
