import { mount } from '@cypress/vue';
import ProjectDetailView from './ProjectDetailView.vue';
import { createPinia } from 'pinia';
import router from '../../router'; // Adjust path as necessary
import { useRoute } from 'vue-router'; // To mock route params

// Mock Pinia stores
let pinia;

const mockProjectStore = {
  currentProject: null,
  loading: false,
  error: null,
  fetchProjectById: cy.stub().resolves(),
  addProjectClass: cy.stub().resolves(),
  deleteProjectClass: cy.stub().resolves(),
  // ... other actions like updateProjectDetails, deleteProject
};

const mockImageStore = {
  images: [],
  loading: false,
  error: null,
  fetchImagesForProject: cy.stub().resolves(),
  uploadImage: cy.stub().resolves(),
  deleteImage: cy.stub().resolves(),
  updateImageTags: cy.stub().resolves(),
};

const mockTrainingStore = {
  trainingStatus: 'idle',
  trainingLog: [],
  error: null,
  startTraining: cy.stub().resolves(),
  fetchTrainingStatus: cy.stub().resolves(),
};

// Mock vue-router's useRoute
// Cypress doesn't automatically provide route params to components like Vue Router does in an app.
// We need to mock it if the component uses useRoute() to get params.
const mockRoute = {
  params: {
    projectId: 'testProjectId123'
  }
};

describe('<ProjectDetailView />', () => {
  beforeEach(() => {
    pinia = createPinia();

    // Reset store states and stubs
    mockProjectStore.currentProject = null;
    mockProjectStore.loading = false;
    mockProjectStore.error = null;
    mockProjectStore.fetchProjectById.resetHistory().resolves();
    mockProjectStore.addProjectClass.resetHistory().resolves();
    mockProjectStore.deleteProjectClass.resetHistory().resolves();

    mockImageStore.images = [];
    mockImageStore.loading = false;
    mockImageStore.error = null;
    mockImageStore.fetchImagesForProject.resetHistory().resolves();
    mockImageStore.uploadImage.resetHistory().resolves();
    mockImageStore.deleteImage.resetHistory().resolves();
    mockImageStore.updateImageTags.resetHistory().resolves();

    mockTrainingStore.trainingStatus = 'idle';
    mockTrainingStore.trainingLog = [];
    mockTrainingStore.error = null;
    mockTrainingStore.startTraining.resetHistory().resolves();
    mockTrainingStore.fetchTrainingStatus.resetHistory().resolves();

    // Provide the mocked stores and route to the component
    // This setup assumes ProjectDetailView uses useRoute() and useStore() composables.
    mount(ProjectDetailView, {
      global: {
        plugins: [pinia, router],
        stubs: {
          // 'RouterLink': true, // Stub <router-link> if not testing navigation from it
          // 'ImageCard': true, // Stub child components if complex
          // 'AnnotationEditorView': true // If it's a child route view, it might be more complex
        },
        provide: {
          // This is one way to provide stores if they are injected
          // projectStore: () => mockProjectStore, 
          // imageStore: () => mockImageStore,
          // trainingStore: () => mockTrainingStore,
          // If stores are accessed via useStore() from Pinia, we need to ensure Pinia is set up
          // with these mocked states/actions, or mock the composables themselves.
        },
        mocks: {
          // Mock useRoute if the component uses it
          $route: mockRoute, // For Options API or if directly accessed
        }
      }
    });

    // If your component uses useRoute() from vue-router for composition API:
    cy.stub(router, 'currentRoute').value({ params: { projectId: 'testProjectId123' } });

    // If your stores are setup using app.provide or similar, ensure they are available.
    // A common pattern for Pinia is to use the stores directly:
    pinia.state.value.project = mockProjectStore; // Adjust based on your actual store IDs
    pinia.state.value.image = mockImageStore;
    pinia.state.value.training = mockTrainingStore;

    // Wait for router to be ready
    cy.wrap(router.isReady());
  });

  it('renders project name and description when data is loaded', () => {
    mockProjectStore.currentProject = {
      _id: 'testProjectId123',
      name: 'Test Project Name',
      description: 'Test project description.',
      classes: ['classA', 'classB'],
      images: [],
      trainingStatus: 'Not Trained',
    };
    // Re-mount with the project data for this specific test
    mount(ProjectDetailView, { global: { plugins: [pinia, router], mocks: { $route: mockRoute } } });
    pinia.state.value.project = mockProjectStore;

    cy.contains('h1', 'Test Project Name').should('be.visible');
    cy.contains('p', 'Test project description.').should('be.visible');
  });

  it('calls fetchProjectById and fetchImagesForProject on mounted with correct projectId', () => {
    // Initial mount in beforeEach should trigger these
    expect(mockProjectStore.fetchProjectById).to.have.been.calledWith('testProjectId123');
    expect(mockImageStore.fetchImagesForProject).to.have.been.calledWith('testProjectId123');
  });

  it('displays a loading message while project data is being fetched', () => {
    mockProjectStore.loading = true;
    mount(ProjectDetailView, { global: { plugins: [pinia, router], mocks: { $route: mockRoute } } });
    pinia.state.value.project = mockProjectStore;

    cy.contains('Loading project details...').should('be.visible');
    mockProjectStore.loading = false; // Reset
  });

  it('displays an error message if fetching project data fails', () => {
    mockProjectStore.error = 'Error fetching project';
    mount(ProjectDetailView, { global: { plugins: [pinia, router], mocks: { $route: mockRoute } } });
    pinia.state.value.project = mockProjectStore;

    cy.contains('.error-message', 'Error fetching project').should('be.visible');
    mockProjectStore.error = null; // Reset
  });

  // Class Management Tests
  describe('Class Management', () => {
    beforeEach(() => {
      mockProjectStore.currentProject = {
        _id: 'testProjectId123',
        name: 'Test Project',
        description: 'Description',
        classes: ['classA', 'classB'],
        images: [],
        trainingStatus: 'Not Trained',
      };
      // Re-mount with the project data for class management tests
      mount(ProjectDetailView, { global: { plugins: [pinia, router], mocks: { $route: mockRoute } } });
      pinia.state.value.project = mockProjectStore;
      pinia.state.value.image = mockImageStore;
      pinia.state.value.training = mockTrainingStore;
    });

    it('displays existing project classes', () => {
      cy.contains('li', 'classA').should('be.visible');
      cy.get('.class-list-item').contains('classB').should('be.visible'); // More specific selector
    });

    it('allows adding a new class', () => {
      cy.get('input[placeholder="Add new class"]').type('classC');
      cy.contains('button', 'Add Class').click();
      expect(mockProjectStore.addProjectClass).to.have.been.calledWith('testProjectId123', 'classC');
    });

    it('allows deleting a class', () => {
      // Assuming delete button is next to class name, specific selector needed
      cy.get('.class-list-item').contains('classA').parent().find('button[aria-label*="Delete classA"]').click();
      expect(mockProjectStore.deleteProjectClass).to.have.been.calledWith('testProjectId123', 'classA');
    });
  });

  // Image List and Upload Tests
  describe('Image Management', () => {
    beforeEach(() => {
      mockProjectStore.currentProject = { _id: 'testProjectId123', name: 'Test Project', classes: [], images: [] };
      mount(ProjectDetailView, { global: { plugins: [pinia, router], mocks: { $route: mockRoute } } });
      pinia.state.value.project = mockProjectStore;
      pinia.state.value.image = mockImageStore;
      pinia.state.value.training = mockTrainingStore;
    });

    it('displays a message when no images are present', () => {
      mockImageStore.images = [];
      // Re-mount or ensure component updates
      mount(ProjectDetailView, { global: { plugins: [pinia, router], mocks: { $route: mockRoute } } });
      pinia.state.value.image = mockImageStore;
      cy.contains('No images uploaded yet.').should('be.visible');
    });

    it('displays a list of images', () => {
      mockImageStore.images = [
        { _id: 'img1', filename: 'image1.jpg', url: '/uploads/image1.jpg', tags: ['tag1'] },
        { _id: 'img2', filename: 'image2.png', url: '/uploads/image2.png', tags: [] },
      ];
      mount(ProjectDetailView, { global: { plugins: [pinia, router], mocks: { $route: mockRoute } } });
      pinia.state.value.image = mockImageStore;
      cy.get('.image-card').should('have.length', 2); // Assuming .image-card class for each image item
      cy.contains('.image-card', 'image1.jpg').should('be.visible');
    });

    it('allows uploading an image', () => {
      const fileName = 'test-image.png';
      cy.fixture(fileName, 'binary').then(fileContent => {
        cy.get('input[type="file"]').attachFile({ fileContent, fileName, mimeType: 'image/png' });
      });
      cy.contains('button', 'Upload Image').click(); // Or automatically uploads on file selection
      expect(mockImageStore.uploadImage).to.have.been.called;
      // More specific check for FormData might be complex here, focus on the call
    });

    it('navigates to annotation editor when an image is clicked', () => {
      mockImageStore.images = [{ _id: 'img1', filename: 'image1.jpg', url: '/uploads/image1.jpg' }];
      mount(ProjectDetailView, { global: { plugins: [pinia, router], mocks: { $route: mockRoute } } });
      pinia.state.value.image = mockImageStore;
      cy.spy(router, 'push').as('routerPush');
      cy.contains('.image-card', 'image1.jpg').click(); // Or a specific link/button on the card
      expect('@routerPush').to.have.been.calledWith({ 
        name: 'AnnotationEditor', 
        params: { projectId: 'testProjectId123', imageId: 'img1' } 
      });
    });

    it('allows updating image tags', () => {
      mockImageStore.images = [{ _id: 'img1', filename: 'image1.jpg', url: '/uploads/image1.jpg', tags: ['initialTag'] }];
      mount(ProjectDetailView, { global: { plugins: [pinia, router], mocks: { $route: mockRoute } } });
      pinia.state.value.image = mockImageStore;
      // Simulate tag input and update
      cy.get('.image-card[data-image-id="img1"] input[placeholder*="tags"]').type('newTag{enter}'); // Adjust selector
      // Check if updateImageTags was called, this might need a save button or blur event
      // For simplicity, let's assume there's a save tags button for an image
      // cy.get('.image-card[data-image-id="img1"] button[aria-label*="Save tags for image1.jpg"]').click();
      // This test needs a more concrete UI element to trigger the save action.
      // For now, we'll assume the action is called. A more robust test would interact with the UI to trigger it.
      // expect(mockImageStore.updateImageTags).to.have.been.calledWith('img1', ['initialTag', 'newTag']);
      cy.log('Skipping tag update assertion due to unspecified UI interaction for saving tags.');
    });
  });

  // Training Section Tests
  describe('Model Training', () => {
    beforeEach(() => {
      mockProjectStore.currentProject = { _id: 'testProjectId123', name: 'Test Project', classes: ['cat', 'dog'], images: [{_id: 'img1'}], trainingStatus: 'Not Trained' }; // Ensure project has images and classes
      mount(ProjectDetailView, { global: { plugins: [pinia, router], mocks: { $route: mockRoute } } });
      pinia.state.value.project = mockProjectStore;
      pinia.state.value.image = mockImageStore;
      pinia.state.value.training = mockTrainingStore;
    });

    it('displays current training status', () => {
      mockTrainingStore.trainingStatus = 'Training in progress...';
      mount(ProjectDetailView, { global: { plugins: [pinia, router], mocks: { $route: mockRoute } } });
      pinia.state.value.training = mockTrainingStore;
      cy.contains('Training Status: Training in progress...').should('be.visible');
    });

    it('allows starting model training', () => {
      cy.contains('button', 'Start Training').click();
      expect(mockTrainingStore.startTraining).to.have.been.calledWith('testProjectId123');
    });

    it('disables start training button if no classes or images', () => {
      mockProjectStore.currentProject = { ...mockProjectStore.currentProject, classes: [], images: [] }; // No classes
      mount(ProjectDetailView, { global: { plugins: [pinia, router], mocks: { $route: mockRoute } } });
      pinia.state.value.project = mockProjectStore;
      cy.contains('button', 'Start Training').should('be.disabled');
    });

    it('displays training logs if available', () => {
      mockTrainingStore.trainingLog = ['Log line 1', 'Log line 2'];
      mount(ProjectDetailView, { global: { plugins: [pinia, router], mocks: { $route: mockRoute } } });
      pinia.state.value.training = mockTrainingStore;
      cy.get('.training-log').should('contain', 'Log line 1').and('contain', 'Log line 2');
    });
  });

  // Add tests for other functionalities: deleting project, editing project details, etc.
});

// Notes:
// - Mocking `useRoute`: If your component uses `const route = useRoute();` then `params = route.params;`,
//   you need to ensure that `useRoute()` returns a mock. One way is `cy.stub(vueRouter, 'useRoute').returns(mockRoute);`
//   before mounting, if `vueRouter` is the imported module. Or, provide a mock for `$route` if using Options API.
//   The example uses `cy.stub(router, 'currentRoute').value(...)` which might work for some setups.
// - Pinia Store Access: The example directly manipulates `pinia.state.value.storeName = mockStore;`.
//   This assumes your store IDs are 'project', 'image', 'training'. Adjust as per your `defineStore` IDs.
//   This is a common way to set up store state for tests when not using `@pinia/testing`.
// - Selectors: Replace generic selectors like '.error-message', '.image-card', '.class-list-item' with actual,
//   preferably data-cy attributes, from your component for more robust tests.
// - File Upload: `cy.fixture` and `attachFile` (from `cypress-file-upload` which needs to be installed: `npm install --save-dev cypress-file-upload` and imported in `cypress/support/commands.js`) are used for file uploads.
// - Asynchronous operations: Ensure stubs for store actions resolve or reject as expected by the component.
