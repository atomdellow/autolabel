describe('Image Management in Project', () => {
  const uniqueUser = `imgtestuser_${Date.now()}`;
  const password = 'password123';
  let authToken = null;
  let projectId = null;
  const projectName = `ProjectForImages_${Date.now()}`;

  before(() => {
    // Register user
    cy.request('POST', 'http://localhost:5000/api/auth/register', {
      username: uniqueUser,
      password: password,
    }).then(() => {
      // Login to get token
      cy.request('POST', 'http://localhost:5000/api/auth/login', {
        username: uniqueUser,
        password: password,
      }).then((loginResponse) => {
        authToken = loginResponse.body.token;
        // Create a project for image tests
        cy.request({
          method: 'POST',
          url: 'http://localhost:5000/api/projects',
          headers: { Authorization: `Bearer ${authToken}` },
          body: { name: projectName, description: 'Test project for image management' },
        }).then((projectResponse) => {
          projectId = projectResponse.body._id;
        });
      });
    });
  });

  beforeEach(() => {
    if (authToken) {
      localStorage.setItem('token', authToken);
    }
    // Visit the specific project page
    cy.visit(`http://localhost:5173/project/${projectId}`);
  });

  it('should allow a user to upload an image to a project', () => {
    cy.get('input[type="file"]#imageUpload').selectFile('cypress/fixtures/test_image.jpg', { force: true }); // Ensure you have a test_image.jpg in fixtures
    cy.get('button#submit-upload-btn').click();

    // Check for the image name or a success message
    cy.contains('test_image.jpg').should('be.visible'); 
    // Optionally, verify image count increases or specific image details appear
  });

  it('should display uploaded images in the project details view', () => {
    // Upload an image via API first to ensure it's there for display test
    const formData = new FormData();
    cy.fixture('test_image_display.jpg', 'binary').then(fileContent => {
      const blob = Cypress.Blob.binaryStringToBlob(fileContent, 'image/jpeg');
      formData.append('image', blob, 'test_image_display.jpg');
      formData.append('width', '640'); // Example width
      formData.append('height', '480'); // Example height

      cy.request({
        method: 'POST',
        url: `http://localhost:5000/api/images/project/${projectId}/upload`,
        headers: {
          Authorization: `Bearer ${authToken}`,
          'Content-Type': 'multipart/form-data' 
        },
        body: formData,
      }).then(() => {
        cy.reload(); // Reload to see the newly uploaded image
        cy.contains('test_image_display.jpg').should('be.visible');
      });
    });
  });

  it('should allow a user to add tags to an image', () => {
    // Assuming an image is already uploaded (e.g., from previous test or setup)
    // Or upload one specifically for this test
    const imageName = `tagging_test_${Date.now()}.jpg`;
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
        const imageId = uploadResponse.body.image._id;
        cy.reload();
        cy.contains(imageName).parents('.image-card').within(() => { // Adjust selector for image card
          cy.get('button.edit-tags-btn').click(); // Button to open tag editor
          cy.get('input.tag-input-field').type('tag1, tag2{enter}'); // Input tags
          cy.get('button.save-tags-btn').click(); // Save tags
          cy.contains('tag1').should('be.visible');
          cy.contains('tag2').should('be.visible');
        });
        // Verify tags were saved by checking the API response or re-fetching image details
        cy.request({
            method: 'GET',
            url: `http://localhost:5000/api/images/${imageId}`,
            headers: { Authorization: `Bearer ${authToken}` }
        }).then(imageDetails => {
            expect(imageDetails.body.tags).to.include.members(['tag1', 'tag2']);
        });
      });
    });
  });

  it('should allow a user to navigate to the annotation editor for an image', () => {
    // Assuming an image is uploaded
    const imageName = `annotate_nav_test_${Date.now()}.jpg`;
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
        const imageId = uploadResponse.body.image._id;
        cy.reload();
        cy.contains(imageName).parents('.image-card').find('a.annotate-link').click(); // Link/Button to annotate
        cy.url().should('include', `/project/${projectId}/image/${imageId}/annotate`);
        cy.get('canvas').should('be.visible'); // Check for canvas in annotation editor
      });
    });
  });

  it('should allow a user to delete an image from a project', () => {
    const imageName = `deletable_image_${Date.now()}.jpg`;
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
        const imageId = uploadResponse.body.image._id;
        cy.reload();
        cy.contains(imageName).should('be.visible');
        cy.contains(imageName).parents('.image-card').find('button.delete-image-btn').click();
        // Handle confirmation dialog if any
        // cy.get('button#confirm-delete-image-btn').click();
        cy.contains(imageName).should('not.exist');

        // Verify by trying to fetch the image via API (should 404)
        cy.request({
            method: 'GET',
            url: `http://localhost:5000/api/images/${imageId}`,
            headers: { Authorization: `Bearer ${authToken}` },
            failOnStatusCode: false
        }).then(resp => {
            expect(resp.status).to.eq(404);
        });
      });
    });
  });

  // Helper to create a fixture if it doesn't exist
  // This is more of a setup task, ideally fixtures are pre-existing
  // For simplicity, we assume test_image.jpg and test_image_display.jpg exist in cypress/fixtures
});
