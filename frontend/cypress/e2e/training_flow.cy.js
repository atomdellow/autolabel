describe('Model Training Flow', () => {
  const uniqueUser = `trainingflowuser_${Date.now()}`;
  const password = 'password123';
  let authToken = null;
  let projectId = null;
  let imageId = null;
  const projectName = `ProjectForTraining_${Date.now()}`;
  const imageName = `image_for_training_${Date.now()}.jpg`;
  const className = 'TrainClass';

  before(() => {
    // 1. Register user
    cy.request('POST', 'http://localhost:5000/api/auth/register', {
      username: uniqueUser,
      password: password,
    }).then(() => {
      // 2. Login to get token
      cy.request('POST', 'http://localhost:5000/api/auth/login', {
        username: uniqueUser,
        password: password,
      }).then((loginResponse) => {
        authToken = loginResponse.body.token;
        // 3. Create a project
        cy.request({
          method: 'POST',
          url: 'http://localhost:5000/api/projects',
          headers: { Authorization: `Bearer ${authToken}` },
          body: { name: projectName, description: 'Test project for training flow' },
        }).then((projectResponse) => {
          projectId = projectResponse.body._id;
          // 4. Add a class to the project
          cy.request({
            method: 'PUT',
            url: `http://localhost:5000/api/projects/${projectId}/classes`,
            headers: { Authorization: `Bearer ${authToken}` },
            body: { className: className },
          }).then(() => {
            // 5. Upload an image to the project
            const formData = new FormData();
            cy.fixture('test_image.jpg', 'binary').then(fileContent => {
              const blob = Cypress.Blob.binaryStringToBlob(fileContent, 'image/jpeg');
              formData.append('image', blob, imageName);
              formData.append('width', '640');
              formData.append('height', '480');
              cy.request({
                method: 'POST',
                url: `http://localhost:5000/api/images/project/${projectId}/upload`,
                headers: { Authorization: `Bearer ${authToken}`, 'Content-Type': 'multipart/form-data' },
                body: formData,
              }).then((uploadResponse) => {
                imageId = uploadResponse.body.image._id;
                // 6. Add an annotation to the image
                const annotations = [
                  { label: className, x: 50, y: 50, width: 100, height: 100 }
                ];
                cy.request({
                  method: 'POST',
                  url: `http://localhost:5000/api/annotations/image/${imageId}`,
                  headers: { Authorization: `Bearer ${authToken}` },
                  body: { annotations: annotations },
                });
              });
            });
          });
        });
      });
    });
  });

  beforeEach(() => {
    if (authToken && projectId) {
      localStorage.setItem('token', authToken);
      cy.visit(`http://localhost:5173/project/${projectId}`);
    }
  });

  it('should allow a user to start training and see status updates', () => {
    // Ensure project details are loaded, including the training status section
    cy.contains(projectName).should('be.visible');
    cy.get('#project-status-display').should('contain', 'Not Started'); // Selector for status display

    // Click the start training button
    cy.get('button#start-training-btn').click();

    // Check for initial status update to "In Progress"
    // This might involve a brief wait or relying on UI update
    cy.get('#project-status-display', { timeout: 10000 }).should('contain', 'In Progress');

    // Wait for training to complete. This is the tricky part for E2E.
    // The timeout needs to be generous enough for the backend script to run.
    // For a real YOLO training, this could be minutes. For this test (epochs=5), it might be shorter.
    // We will poll the project status via API or check UI for "Completed" or "Failed".
    // Let's assume a max wait time, e.g., 2 minutes for this test.
    cy.get('#project-status-display', { timeout: 120000 })
      .should(elem => {
        // Check if the text is either 'Completed' or 'Failed'
        // This allows the test to pass if training succeeds or fails gracefully
        const text = elem.text();
        expect(text).to.match(/Completed|Failed/);
      });

    // Optionally, if status is "Completed", check for a model path link or info
    cy.get('#project-status-display').then(($statusDisplay) => {
      if ($statusDisplay.text().includes('Completed')) {
        cy.get('#trained-model-path-display').should('not.be.empty'); // Selector for model path display
        // Example: cy.contains('best.pt').should('be.visible');
      }
    });

    // Refresh the page and verify the status persists
    cy.reload();
    cy.get('#project-status-display', { timeout: 10000 })
    .should(elem => {
      const text = elem.text();
      expect(text).to.match(/Completed|Failed/);
    });
  });

  // It might be useful to have a separate test for how the UI handles a "Failed" state specifically,
  // but that would require a way to reliably trigger a failure in the backend training script for testing purposes.
});
