describe('Annotation Editor Functionality', () => {
  const uniqueUser = `annotateuser_${Date.now()}`;
  const password = 'password123';
  let authToken = null;
  let projectId = null;
  let imageId = null;
  const projectName = `ProjectForAnnotation_${Date.now()}`;
  const imageName = `image_for_annotation_${Date.now()}.jpg`;

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
        // Create a project
        cy.request({
          method: 'POST',
          url: 'http://localhost:5000/api/projects',
          headers: { Authorization: `Bearer ${authToken}` },
          body: { name: projectName, description: 'Test project for annotation' },
        }).then((projectResponse) => {
          projectId = projectResponse.body._id;
          // Add a class to the project
          cy.request({
            method: 'PUT',
            url: `http://localhost:5000/api/projects/${projectId}/classes`,
            headers: { Authorization: `Bearer ${authToken}` },
            body: { className: 'TestClassA' },
          });
          cy.request({
            method: 'PUT',
            url: `http://localhost:5000/api/projects/${projectId}/classes`,
            headers: { Authorization: `Bearer ${authToken}` },
            body: { className: 'TestClassB' },
          });

          // Upload an image to the project
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
            });
          });
        });
      });
    });
  });

  beforeEach(() => {
    if (authToken && projectId && imageId) {
      localStorage.setItem('token', authToken);
      cy.visit(`http://localhost:5173/project/${projectId}/image/${imageId}/annotate`);
    }
    cy.get('#annotation-canvas').should('be.visible'); // Ensure canvas is loaded
  });

  it('should load the image and annotation tools', () => {
    cy.get('#annotation-canvas').should('be.visible');
    cy.get('button#tool-rectangle').should('be.visible');
    // cy.get('button#tool-polygon').should('be.visible'); // If polygon tool exists
    cy.get('select#class-selector').should('be.visible');
    cy.get('button#save-annotations-btn').should('be.visible');
  });

  it('should allow selecting a class for annotation', () => {
    cy.get('select#class-selector').select('TestClassA');
    cy.get('select#class-selector').should('have.value', 'TestClassA');
    cy.get('select#class-selector').select('TestClassB');
    cy.get('select#class-selector').should('have.value', 'TestClassB');
  });

  it('should allow drawing a rectangle annotation', () => {
    cy.get('select#class-selector').select('TestClassA');
    cy.get('button#tool-rectangle').click();
    cy.get('#annotation-canvas')
      .trigger('mousedown', { clientX: 100, clientY: 100, button: 0 })
      .trigger('mousemove', { clientX: 200, clientY: 150 })
      .trigger('mouseup', { button: 0 });
    
    // Check if an annotation appears in a list or visually (more complex)
    // For now, we'll assume the action completes and try to save
    cy.get('#save-annotations-btn').click();
    cy.contains('Annotations saved successfully').should('be.visible'); // Or some other success indicator

    // Verify by fetching annotations
    cy.request({
        method: 'GET',
        url: `http://localhost:5000/api/annotations/image/${imageId}`,
        headers: { Authorization: `Bearer ${authToken}` }
    }).then(response => {
        expect(response.body.annotations).to.have.lengthOf.at.least(1);
        const ann = response.body.annotations[0];
        expect(ann.label).to.equal('TestClassA');
        // Add more specific coordinate checks if possible, though they can be tricky with canvas
    });
  });

  it('should allow undo and redo of an annotation', () => {
    cy.get('select#class-selector').select('TestClassB');
    cy.get('button#tool-rectangle').click();
    cy.get('#annotation-canvas')
      .trigger('mousedown', { clientX: 150, clientY: 150, button: 0 })
      .trigger('mousemove', { clientX: 250, clientY: 200 })
      .trigger('mouseup', { button: 0 });

    // Assuming one annotation is drawn
    // Check initial state (e.g., count annotations if displayed, or rely on save)

    cy.get('button#undo-btn').click();
    // Verify annotation is removed (visually or by checking a list if available)
    // For now, save and check count
    cy.get('#save-annotations-btn').click();
    cy.contains('Annotations saved successfully').should('be.visible');
    cy.request({
        method: 'GET',
        url: `http://localhost:5000/api/annotations/image/${imageId}`,
        headers: { Authorization: `Bearer ${authToken}` }
    }).then(response => {
        // This will depend on whether the previous test's annotation persists or is cleared
        // Assuming it persists, and this one was undone.
        const previousTestAnnotationCount = 1; // From the 'should allow drawing a rectangle' test
        expect(response.body.annotations).to.have.lengthOf(previousTestAnnotationCount); 
    });

    cy.get('button#redo-btn').click();
    // Verify annotation is restored
    cy.get('#save-annotations-btn').click();
    cy.contains('Annotations saved successfully').should('be.visible');
    cy.request({
        method: 'GET',
        url: `http://localhost:5000/api/annotations/image/${imageId}`,
        headers: { Authorization: `Bearer ${authToken}` }
    }).then(response => {
        expect(response.body.annotations).to.have.lengthOf(previousTestAnnotationCount + 1);
        const lastAnn = response.body.annotations.pop();
        expect(lastAnn.label).to.equal('TestClassB');
    });
  });

  it('should save multiple annotations', () => {
    // Clear existing annotations for a clean test (if API supports it, or re-upload image)
    // For now, we assume annotations from previous tests might exist or are overwritten by a full save.
    // Best practice: ensure clean state for each test or test deletion.

    cy.get('select#class-selector').select('TestClassA');
    cy.get('button#tool-rectangle').click();
    cy.get('#annotation-canvas')
      .trigger('mousedown', { clientX: 50, clientY: 50, button: 0 })
      .trigger('mousemove', { clientX: 100, clientY: 80 })
      .trigger('mouseup', { button: 0 });

    cy.get('select#class-selector').select('TestClassB');
    cy.get('button#tool-rectangle').click(); // Re-select tool if needed after class change
    cy.get('#annotation-canvas')
      .trigger('mousedown', { clientX: 300, clientY: 300, button: 0 })
      .trigger('mousemove', { clientX: 350, clientY: 330 })
      .trigger('mouseup', { button: 0 });

    cy.get('#save-annotations-btn').click();
    cy.contains('Annotations saved successfully').should('be.visible');

    cy.request({
        method: 'GET',
        url: `http://localhost:5000/api/annotations/image/${imageId}`,
        headers: { Authorization: `Bearer ${authToken}` }
    }).then(response => {
        // This count depends on whether previous tests cleared annotations or if save overwrites.
        // Assuming save overwrites or this is the first annotation test run in isolation.
        // If 'undo/redo' ran, it left 2 annotations. This test adds 2 more.
        // The backend setAnnotationsForImage replaces all annotations.
        expect(response.body.annotations).to.have.lengthOf(2);
        const labels = response.body.annotations.map(a => a.label);
        expect(labels).to.include.members(['TestClassA', 'TestClassB']);
    });
  });

  // Add tests for other tools (polygon, etc.) if implemented
  // Add tests for deleting specific annotations from the UI if implemented
});
