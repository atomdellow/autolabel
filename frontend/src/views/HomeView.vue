<template>
  <div>
    <h1>Home View</h1>
    <p>Welcome to AutoLabel!</p>
    <router-link to="/login">Login</router-link> |
    <router-link to="/register">Register</router-link> |
    <router-link to="/dashboard">Dashboard (Protected)</router-link>
  </div>
</template>

<script>
export default {
  name: 'HomeView',
};
</script>

<style scoped>
/* Add styles here */
</style>
