<template>
  <div class="breadcrumb-nav">
    <slot></slot>
  </div>
</template>

<script setup>
// No props or other logic needed for this simple component
</script>

<style>
.breadcrumb-nav {
  padding: 10px 10px 10px 0;
  background-color: #f8f8f8;
  border-bottom: 1px solid #ddd;
  margin-bottom: 10px;
  width: 100%;
  box-sizing: border-box;
}

.breadcrumb-nav a {
  color: #3498db;
  text-decoration: none;
}

.breadcrumb-nav a:hover {
  text-decoration: underline;
}
</style>
