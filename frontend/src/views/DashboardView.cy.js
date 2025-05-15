import { mount } from '@cypress/vue';
import DashboardView from './DashboardView.vue';
import { createPinia } from 'pinia';
import router from '../../router'; // Assuming your router is here

// Mock Pinia store
const pinia = createPinia();

// Mock projectStore
const mockProjectStore = {
  projects: [],
  loading: false,
  error: null,
  fetchProjects: cy.stub().resolves(),
  createProject: cy.stub().resolves({ _id: 'newProjectId' }),
};

// Mock authStore
const mockAuthStore = {
  user: { _id: 'userId', token: 'fake-token' },
  logout: cy.stub(),
};

describe('<DashboardView />', () => {
  beforeEach(() => {
    // Reset Pinia store mocks for each test
    mockProjectStore.projects = [];
    mockProjectStore.loading = false;
    mockProjectStore.error = null;
    mockProjectStore.fetchProjects.resetHistory();
    mockProjectStore.createProject.resetHistory();
    mockAuthStore.logout.resetHistory();

    // Mount the component with mocked stores and router
    mount(DashboardView, {
      global: {
        plugins: [pinia, router],
        stubs: {
          // Stub child components if they are complex or make their own API calls
          // Example: 'ProjectCard': true
        },
        mocks: {
          // Provide the mocked stores directly if not using Pinia's provide/inject for stores in components
          // This approach might be simpler if you are not deeply integrating Pinia's testing utilities
        },
        provide: { // This is a common way to provide Pinia stores in tests
          projectStore: () => mockProjectStore,
          authStore: () => mockAuthStore,
        }
      },
    });

    // Ensure router is ready before each test
    cy.wrap(router.isReady());
  });

  it('renders the dashboard title', () => {
    cy.contains('h1', 'Your Projects').should('be.visible');
  });

  it('displays a loading message when projects are being fetched', () => {
    mockProjectStore.loading = true;
    // Re-mount or trigger update if necessary, or ensure the component reacts to store changes
    // For simplicity, we'll assume the component re-renders or reacts if mounted with this state.
    // This might require a more sophisticated way to update the store state post-mount
    // or by directly setting the store state before mount if the component reads it on init.
    // Let's try re-mounting for this specific test case for clarity.
    mount(DashboardView, {
      global: {
        plugins: [pinia, router],
        provide: { projectStore: () => mockProjectStore, authStore: () => mockAuthStore }
      }
    });
    cy.contains('Loading projects...').should('be.visible');
    mockProjectStore.loading = false; // Reset for subsequent tests
  });

  it('displays a message when there are no projects', () => {
    mockProjectStore.projects = [];
    // Re-mount or trigger update
    mount(DashboardView, {
      global: {
        plugins: [pinia, router],
        provide: { projectStore: () => mockProjectStore, authStore: () => mockAuthStore }
      }
    });
    cy.contains('p', 'No projects yet. Create one to get started!').should('be.visible');
  });

  it('displays a list of projects', () => {
    mockProjectStore.projects = [
      { _id: '1', name: 'Project Alpha', description: 'Desc Alpha', classCount: 2, imageCount: 5, createdAt: new Date().toISOString() },
      { _id: '2', name: 'Project Beta', description: 'Desc Beta', classCount: 3, imageCount: 10, createdAt: new Date().toISOString() },
    ];
    // Re-mount or trigger update
    mount(DashboardView, {
      global: {
        plugins: [pinia, router],
        provide: { projectStore: () => mockProjectStore, authStore: () => mockAuthStore }
      }
    });
    cy.get('.project-card').should('have.length', 2);
    cy.contains('.project-card', 'Project Alpha').should('be.visible');
    cy.contains('.project-card', 'Project Beta').should('be.visible');
  });

  it('calls fetchProjects on mounted', () => {
    // The initial mount in beforeEach already calls this
    expect(mockProjectStore.fetchProjects).to.have.been.called;
  });

  it('shows the create project modal when "Create New Project" button is clicked', () => {
    cy.contains('button', 'Create New Project').click();
    cy.get('.modal-content').should('be.visible'); // Assuming modal has this class
    cy.contains('h2', 'Create New Project').should('be.visible');
  });

  it('can create a new project through the modal', () => {
    cy.contains('button', 'Create New Project').click();
    cy.get('input[placeholder="Project Name"]').type('New Test Project');
    cy.get('textarea[placeholder="Project Description"]').type('A description for the new test project.');
    cy.contains('button', 'Create Project').click();
    expect(mockProjectStore.createProject).to.have.been.calledWith({
      name: 'New Test Project',
      description: 'A description for the new test project.',
    });
    // Optionally, check if modal closes or a success message appears
  });

  it('navigates to project detail view when a project card is clicked', () => {
    mockProjectStore.projects = [
      { _id: '1', name: 'Project Alpha', description: 'Desc Alpha', classCount: 2, imageCount: 5, createdAt: new Date().toISOString() },
    ];
    // Re-mount or trigger update
    mount(DashboardView, {
      global: {
        plugins: [pinia, router],
        provide: { projectStore: () => mockProjectStore, authStore: () => mockAuthStore }
      }
    });
    cy.spy(router, 'push').as('routerPush');
    cy.contains('.project-card', 'Project Alpha').click(); // Assuming the card itself is clickable
    // Or, if there's a specific button/link within the card:
    // cy.contains('.project-card', 'Project Alpha').find('button[aria-label="View project"]').click();
    expect('@routerPush').to.have.been.calledWith({ name: 'ProjectDetail', params: { projectId: '1' } });
  });

  it('calls logout method from authStore when logout button is clicked', () => {
    cy.contains('button', 'Logout').click();
    expect(mockAuthStore.logout).to.have.been.called;
  });

  it('displays an error message if fetching projects fails', () => {
    mockProjectStore.error = 'Failed to fetch projects';
    // Re-mount or trigger update
    mount(DashboardView, {
      global: {
        plugins: [pinia, router],
        provide: { projectStore: () => mockProjectStore, authStore: () => mockAuthStore }
      }
    });
    cy.contains('.error-message', 'Failed to fetch projects').should('be.visible'); // Assuming an element with class 'error-message'
    mockProjectStore.error = null; // Reset for other tests
  });

});

// Note:
// 1. The Pinia store setup here is a simplified mock. For more complex scenarios,
//    you might use `createTestingPinia` from `@pinia/testing` or a more robust mocking strategy.
// 2. The `provide` option is used to make the mocked stores available to the component.
//    Ensure your component uses `inject` to get these stores or accesses them via `useProjectStore()`.
//    If `useProjectStore()` is called directly within the component's setup, Cypress needs to
//    intercept or mock that. The `provide` approach is generally cleaner for component tests.
// 3. Router interactions like `router.push` are spied on. Ensure your component uses the router correctly.
// 4. Child components (`ProjectCard`) might need to be stubbed if they are complex or have their own side effects.
//    Add them to `global.stubs` if needed: `stubs: { 'ProjectCard': true }`.
// 5. The modal interaction tests assume specific class names or text for modal elements. Adjust as necessary.
// 6. For reactivity with Pinia stores, sometimes you might need to explicitly trigger updates or re-mount
//    the component if the store state changes *after* the initial mount and the component doesn't
//    automatically pick up the change in the test environment as it would in a live app.
//    The repeated `mount` calls in some tests are a way to ensure the component initializes with the desired store state.
//    A more advanced setup might involve directly manipulating the store instance that the component uses.
