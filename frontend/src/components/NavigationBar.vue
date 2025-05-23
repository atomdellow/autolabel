<!-- NavigationBar.vue -->
<template>
  <nav class="nav-content">
    <slot></slot>
  </nav>
</template>

<style scoped>
.nav-content {
  width: 100%;
  background-color: #fff;
  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
  padding: 10px 20px;
  box-sizing: border-box;
  height: 100px; /* fixed height, adjust as needed */
  display: flex;
  align-items: center;
  justify-content: center;
}
</style>
