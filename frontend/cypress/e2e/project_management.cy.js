describe('Project Management Flows', () => {
  const uniqueUser = `projecttestuser_${Date.now()}`;
  const password = 'password123';
  let authToken = null;

  before(() => {
    // Register user once for all project tests
    cy.request('POST', 'http://localhost:5000/api/auth/register', {
      username: uniqueUser,
      password: password,
    }).then(() => {
      // Login to get token
      cy.request('POST', 'http://localhost:5000/api/auth/login', {
        username: uniqueUser,
        password: password,
      }).then((response) => {
        authToken = response.body.token;
      });
    });
  });

  beforeEach(() => {
    // Set token in local storage before each test
    if (authToken) {
      localStorage.setItem('token', authToken);
    }
    cy.visit('http://localhost:5173/dashboard'); // Assuming login redirects here or this is the main page
  });

  it('should allow a user to create a new project', () => {
    const projectName = `New Test Project ${Date.now()}`;
    const projectDescription = 'A description for the new test project.';

    cy.get('button#create-project-btn').click(); // Assuming a button to open create project modal/form
    cy.get('input[name="projectName"]').type(projectName);
    cy.get('textarea[name="projectDescription"]').type(projectDescription);
    cy.get('button[type="submit"]#submit-create-project-btn').click(); // Assuming submit button in the form

    cy.contains(projectName).should('be.visible');
    // Optionally, verify the project appears in the project list on the dashboard
  });

  it('should display created projects on the dashboard', () => {
    const projectName = `Dashboard View Project ${Date.now()}`;
    // Create a project via API for this test to ensure it exists
    cy.request({
      method: 'POST',
      url: 'http://localhost:5000/api/projects',
      headers: { Authorization: `Bearer ${authToken}` },
      body: { name: projectName, description: 'Test project for dashboard view' },
    });

    cy.visit('http://localhost:5173/dashboard');
    cy.contains(projectName).should('be.visible');
  });

  it('should allow a user to navigate to project details page', () => {
    const projectName = `Project Details Nav ${Date.now()}`;
    cy.request({
      method: 'POST',
      url: 'http://localhost:5000/api/projects',
      headers: { Authorization: `Bearer ${authToken}` },
      body: { name: projectName, description: 'Test project for navigation' },
    }).then((response) => {
      const projectId = response.body._id;
      cy.visit('http://localhost:5173/dashboard');
      cy.contains(projectName).click(); // Assuming clicking project name navigates
      cy.url().should('include', `/project/${projectId}`);
      cy.contains(projectName).should('be.visible');
      cy.contains('Test project for navigation').should('be.visible');
    });
  });

  it('should allow a user to update project name and description', () => {
    const projectName = `Updateable Project ${Date.now()}`;
    const updatedProjectName = `Updated Project Name ${Date.now()}`;
    const projectDescription = 'Initial description.';
    const updatedProjectDescription = 'Updated project description.';

    cy.request({
      method: 'POST',
      url: 'http://localhost:5000/api/projects',
      headers: { Authorization: `Bearer ${authToken}` },
      body: { name: projectName, description: projectDescription },
    }).then((response) => {
      const projectId = response.body._id;
      cy.visit(`/project/${projectId}`);

      // Click edit button, fill form, and submit
      cy.get('button#edit-project-details-btn').click(); 
      cy.get('input[name="editProjectName"]').clear().type(updatedProjectName);
      cy.get('textarea[name="editProjectDescription"]').clear().type(updatedProjectDescription);
      cy.get('button#submit-edit-project-btn').click();

      cy.contains(updatedProjectName).should('be.visible');
      cy.contains(updatedProjectDescription).should('be.visible');
    });
  });

  it('should allow a user to add a new class to a project', () => {
    const projectName = `Project With Classes ${Date.now()}`;
    const className = 'TestClass1';

    cy.request({
      method: 'POST',
      url: 'http://localhost:5000/api/projects',
      headers: { Authorization: `Bearer ${authToken}` },
      body: { name: projectName, description: 'Project for testing classes' },
    }).then((response) => {
      const projectId = response.body._id;
      cy.visit(`/project/${projectId}`);

      // UI for adding a class
      cy.get('button#manage-classes-btn').click(); // Or similar to open class management
      cy.get('input[name="newClassName"]').type(className);
      cy.get('button#add-class-btn').click();

      cy.contains(className).should('be.visible'); // Check if class is listed
      // Optionally, check if the class color is also displayed if that's part of the UI
    });
  });

  it('should prevent adding a duplicate class name to a project', () => {
    const projectName = `Project Duplicate Class ${Date.now()}`;
    const className = 'UniqueClass';

    cy.request({
      method: 'POST',
      url: 'http://localhost:5000/api/projects',
      headers: { Authorization: `Bearer ${authToken}` },
      body: { name: projectName, description: 'Project for duplicate class test' },
    }).then((response) => {
      const projectId = response.body._id;
      // Add class via API first
      cy.request({
        method: 'PUT',
        url: `http://localhost:5000/api/projects/${projectId}/classes`,
        headers: { Authorization: `Bearer ${authToken}` },
        body: { className: className },
      });

      cy.visit(`/project/${projectId}`);
      cy.get('button#manage-classes-btn').click();
      cy.get('input[name="newClassName"]').type(className); // Try to add same class again
      cy.get('button#add-class-btn').click();

      cy.get('.error-message-class').should('be.visible').and('contain', 'Class name already exists'); // Adjust selector and message
    });
  });

  it('should allow a user to delete a project', () => {
    const projectName = `Deletable Project ${Date.now()}`;
    cy.request({
      method: 'POST',
      url: 'http://localhost:5000/api/projects',
      headers: { Authorization: `Bearer ${authToken}` },
      body: { name: projectName, description: 'Project to be deleted' },
    }).then((response) => {
      const projectId = response.body._id;
      cy.visit('http://localhost:5173/dashboard');
      cy.contains(projectName).should('be.visible');

      // Find the delete button for the specific project and click it
      // This might involve finding the project row/card and then a delete button within it
      cy.contains('.project-card', projectName).find('button.delete-project-btn').click(); // Adjust selectors
      
      // Confirm deletion if there's a confirmation dialog
      // cy.get('button#confirm-delete-btn').click();

      cy.contains(projectName).should('not.exist');
      cy.request({ 
        method: 'GET', 
        url: `http://localhost:5000/api/projects/${projectId}`, 
        headers: { Authorization: `Bearer ${authToken}` },
        failOnStatusCode: false // Important: expect a 404
      }).then(getResp => {
        expect(getResp.status).to.eq(404);
      });
    });
  });
});
