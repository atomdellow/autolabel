// LoginView.cy.js
import { mount } from '@cypress/vue';
import LoginView from './LoginView.vue'; // Adjust path as necessary
import { createPinia } from 'pinia'; // If your component uses Pinia
import router from '../../router'; // If your component uses Vue Router

// Mock the auth store actions or state if needed for isolated testing
const mockAuthStore = {
  loginUser: cy.stub().as('loginUserAction'),
  // Add any state properties your component might read directly
  // e.g., isAuthenticated: false, error: null, loading: false
};

describe('<LoginView />', () => {
  let pinia;

  beforeEach(() => {
    // Create a new Pinia instance for each test
    pinia = createPinia();

    // You can provide a mock store to the component if it relies on Pinia
    // This example assumes LoginView might use an authStore
    // If your component doesn't use Pinia directly or you want to test with the real store,
    // you might need to set up the real store or provide global mocks differently.
    mount(LoginView, {
      global: {
        plugins: [pinia, router], // Add router if <router-link> or router-view is used
        stubs: {
          // Stub child components if they are complex and not the focus of this test
          // 'RouterLink': true // Example: if you have <router-link> and don't want to test its navigation
        },
        mocks: {
          // If you are using the options API and $store
          // $store: { modules: { auth: mockAuthStore } }
        },
        provide: {
          // If using Pinia composition API and useStore()
          // you might need to mock how useStore() resolves your store
          // This can be complex; often easier to test with a real store slice
          // or ensure your component receives all dependencies as props.
        }
      }
    });

    // It's good practice to wait for the router to be ready if you are testing navigation
    // or components that rely on router.isReady()
    // cy.wrap(router.isReady()); // Uncomment if needed
  });

  it('renders the login form', () => {
    cy.get('input[name="username"]').should('be.visible');
    cy.get('input[name="password"]').should('be.visible');
    cy.get('button[type="submit"]').should('be.visible').and('contain', 'Login');
  });

  it('allows typing into username and password fields', () => {
    const username = 'testuser';
    const password = 'password123';

    cy.get('input[name="username"]').type(username).should('have.value', username);
    cy.get('input[name="password"]').type(password).should('have.value', password);
  });

  it('displays an error message if login fails (mocked behavior)', () => {
    // This test requires mocking the authStore and its state
    // For a real component test, you would typically mount with a Pinia store
    // that has a mocked action or a specific state.

    // Example: If LoginView shows an error from a Pinia store (e.g., authStore.error)
    // You would need to set that state in your Pinia instance provided during mount.
    // For instance, if authStore is setup with Pinia:
    pinia.state.value.auth = { error: 'Invalid credentials', loading: false }; // Adjust based on your store structure

    // Re-mount or trigger an update if the component needs to re-render with new store state.
    // For simplicity, if the error is displayed reactively, this might not be needed,
    // or you might mount the component with this specific store state from the start for this test.
    mount(LoginView, {
        global: {
            plugins: [pinia, router]
        }
    });

    cy.get('.error-message').should('be.visible').and('contain', 'Invalid credentials'); // Adjust selector
  });

  // Example of testing form submission (requires Pinia store setup for actions)
  it('calls loginUser action on form submission', () => {
    const username = 'testuser';
    const password = 'password123';

    // Mount with a Pinia instance where you can spy on actions
    const testPinia = createPinia();
    const authStoreModule = {
      loginUser: cy.stub().as('loginUserActionSpy').resolves(), // Mock successful login
      // other state/getters/actions as needed by the component
      error: null,
      loading: false,
      isAuthenticated: false,
    };
    // Define the store within Pinia
    testPinia.use(() => ({ auth: authStoreModule })); 

    mount(LoginView, {
      global: {
        plugins: [testPinia, router]
      }
    });

    cy.get('input[name="username"]').type(username);
    cy.get('input[name="password"]').type(password);
    cy.get('button[type="submit"]').click();

    cy.get('@loginUserActionSpy').should('have.been.calledOnceWith', { username, password });
  });

});
