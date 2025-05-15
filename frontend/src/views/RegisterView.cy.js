// RegisterView.cy.js
import { mount } from '@cypress/vue';
import RegisterView from './RegisterView.vue'; // Adjust path as necessary
import { createPinia } from 'pinia';
import router from '../../router'; // If your component uses Vue Router

// Mock the auth store actions or state if needed
const mockAuthStore = {
  registerUser: cy.stub().as('registerUserAction'),
  // error: null, loading: false etc.
};

describe('<RegisterView />', () => {
  let pinia;

  beforeEach(() => {
    pinia = createPinia();
    // Setup a mock auth store module if the component depends on it
    // This is a simplified example. You might need to define the store more completely.
    pinia.use(() => ({ 
      auth: { 
        registerUser: mockAuthStore.registerUser,
        error: null,
        loading: false,
        // ... other state/getters needed by RegisterView
      }
    }));

    mount(RegisterView, {
      global: {
        plugins: [pinia, router],
        stubs: {
          // 'RouterLink': true
        }
      }
    });
  });

  it('renders the registration form', () => {
    cy.get('input[name="username"]').should('be.visible');
    cy.get('input[name="password"]').should('be.visible');
    // cy.get('input[name="confirmPassword"]').should('be.visible'); // If you have a confirm password field
    cy.get('button[type="submit"]').should('be.visible').and('contain', 'Register');
  });

  it('allows typing into username and password fields', () => {
    const username = 'newuser';
    const password = 'securepassword123';

    cy.get('input[name="username"]').type(username).should('have.value', username);
    cy.get('input[name="password"]').type(password).should('have.value', password);
  });

  it('calls registerUser action on form submission', () => {
    const username = 'newuser';
    const password = 'securepassword123';

    cy.get('input[name="username"]').type(username);
    cy.get('input[name="password"]').type(password);
    cy.get('button[type="submit"]').click();

    cy.get('@registerUserAction').should('have.been.calledOnceWith', { username, password });
  });

  it('displays an error message if registration fails (mocked behavior)', () => {
    // Remount with a Pinia instance where the auth store has an error
    const errorPinia = createPinia();
    errorPinia.use(() => ({ 
      auth: { 
        registerUser: cy.stub().rejects(new Error('Registration failed')), // Or set error state
        error: 'Username already exists', // Example error message
        loading: false,
      }
    }));

    mount(RegisterView, {
        global: {
            plugins: [errorPinia, router]
        }
    });

    cy.get('.error-message').should('be.visible').and('contain', 'Username already exists'); // Adjust selector
  });

  // Add more tests: e.g., password confirmation validation, link to login page
});
