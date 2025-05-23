import { createApp } from 'vue';
import { createPinia } from 'pinia'; // Import Pinia
import App from './App.vue';
import router from './router'; // Import router configuration
// import './style.css';
// import './styles/override.css'; // Override conflicting styles

// Import Toast Notification
import Toast from 'vue-toastification';
import 'vue-toastification/dist/index.css'; // Import the styles

// Toast notification options
const toastOptions = {
    // You can set your default options here
    position: 'top-right',
    timeout: 5000,
    closeOnClick: true,
    pauseOnFocusLoss: true,
    pauseOnHover: true,
    draggable: true,
    draggablePercent: 0.6,
    showCloseButtonOnHover: false,
    hideProgressBar: false,
    closeButton: 'button',
    icon: true,
    rtl: false
};

const app = createApp(App);

app.use(createPinia()); // Use Pinia
app.use(router); // Use Vue Router
app.use(Toast, toastOptions); // Use Toast notification

app.mount('#app');
