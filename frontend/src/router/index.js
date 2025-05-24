import { createRouter, createWebHistory } from 'vue-router';
import { useAuthStore } from '../store/authStore';
import HomeView from '../views/HomeView.vue'; // Eager load HomeView for initial display

const routes = [
  {
    path: '/',
    name: 'Home',
    component: HomeView,
  },
  {
    path: '/login',
    name: 'Login',
    component: () => import('../views/LoginView.vue'),
    meta: { requiresGuest: true },
  },
  {
    path: '/register',
    name: 'Register',
    component: () => import('../views/RegisterView.vue'),
    meta: { requiresGuest: true },
  },
  {
    path: '/dashboard',
    name: 'Dashboard',
    component: () => import('../views/DashboardView.vue'),
    meta: { requiresAuth: true },
  },
  {
    path: '/project/:projectId',
    name: 'ProjectDetail',
    component: () => import('../views/ProjectDetailView.vue'),
    meta: { requiresAuth: true },
    props: true,
  },  {
    path: '/project/:projectId/image/:imageId/annotate',
    name: 'AnnotationEditor',
    component: () => import(/* webpackChunkName: "annotation-editor" */ '../views/AnnotationEditor/index.vue'),
    meta: { requiresAuth: true },
    props: true,
  },
  {
    path: '/training',
    name: 'Training',
    component: () => import(/* webpackChunkName: "training" */ '../views/TrainingView.vue'),
    meta: { requiresAuth: true },
  },
];

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes,
});

router.beforeEach((to, from, next) => {
  const authStore = useAuthStore(); // Get auth store inside the guard
  const isAuthenticated = authStore.isAuthenticated;

  if (to.meta.requiresAuth && !isAuthenticated) {
    next({ name: 'Login' });
  } else if (to.meta.requiresGuest && isAuthenticated) {
    next({ name: 'Dashboard' });
  } else {
    next();
  }
});

export default router;
