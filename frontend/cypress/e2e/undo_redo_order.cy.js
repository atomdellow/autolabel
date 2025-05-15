/**
 * Test cases for verifying the order of undo and redo operations in the Annotation Editor
 */

describe('Annotation Editor Undo/Redo Order Tests', () => {
  beforeEach(() => {
    // Visit the annotation editor page - replace this URL with the actual route to your annotation editor
    cy.visit('/annotation-editor/1234');

    // Wait for the editor to load
    cy.get('canvas', { timeout: 10000 }).should('be.visible');
    
    // Mock the annotation store if needed
    cy.window().then(win => {
      win.mockUndoRedoTest = true; // Flag for test mode
    });
  });

  it('should undo annotations in reverse order of creation (newest first)', () => {
    // Create multiple annotations
    
    // Create first annotation (rectangle)
    cy.get('button:contains("Rectangle")').click();
    cy.get('canvas').trigger('mousedown', { clientX: 100, clientY: 100 })
      .trigger('mousemove', { clientX: 200, clientY: 200 })
      .trigger('mouseup');
    cy.get('input[placeholder="Enter class name"]').type('Rectangle1');
    cy.get('button:contains("Save")').click();
    cy.wait(500); // Wait for annotation to be saved

    // Create second annotation
    cy.get('button:contains("Rectangle")').click();
    cy.get('canvas').trigger('mousedown', { clientX: 300, clientY: 100 })
      .trigger('mousemove', { clientX: 400, clientY: 200 })
      .trigger('mouseup');
    cy.get('input[placeholder="Enter class name"]').type('Rectangle2');
    cy.get('button:contains("Save")').click();
    cy.wait(500); // Wait for annotation to be saved

    // Create third annotation
    cy.get('button:contains("Rectangle")').click();
    cy.get('canvas').trigger('mousedown', { clientX: 500, clientY: 100 })
      .trigger('mousemove', { clientX: 600, clientY: 200 })
      .trigger('mouseup');
    cy.get('input[placeholder="Enter class name"]').type('Rectangle3');
    cy.get('button:contains("Save")').click();
    cy.wait(500); // Wait for annotation to be saved

    // Verify all 3 rectangles are visible in the annotations list
    cy.get('.annotation-list-item').should('have.length', 3);
    
    // Undo the last action (should remove Rectangle3)
    cy.get('button:contains("Undo")').click();
    cy.wait(500);
    
    // Verify Rectangle3 is gone but 1 and 2 remain
    cy.get('.annotation-list-item').should('have.length', 2);
    cy.get('.annotation-list-item:contains("Rectangle3")').should('not.exist');
    cy.get('.annotation-list-item:contains("Rectangle2")').should('exist');
    cy.get('.annotation-list-item:contains("Rectangle1")').should('exist');
    
    // Undo again (should remove Rectangle2)
    cy.get('button:contains("Undo")').click();
    cy.wait(500);
    
    // Verify Rectangle2 is now gone but 1 remains
    cy.get('.annotation-list-item').should('have.length', 1);
    cy.get('.annotation-list-item:contains("Rectangle2")').should('not.exist');
    cy.get('.annotation-list-item:contains("Rectangle1")').should('exist');
    
    // Undo one more time (should remove Rectangle1)
    cy.get('button:contains("Undo")').click();
    cy.wait(500);
    
    // Verify all rectangles are gone
    cy.get('.annotation-list-item').should('have.length', 0);
  });

  it('should redo annotations in the correct order (reverse of undo)', () => {
    // Create multiple annotations, then undo all, then redo
    
    // Create all 3 rectangles as in the previous test
    cy.get('button:contains("Rectangle")').click();
    cy.get('canvas').trigger('mousedown', { clientX: 100, clientY: 100 })
      .trigger('mousemove', { clientX: 200, clientY: 200 })
      .trigger('mouseup');
    cy.get('input[placeholder="Enter class name"]').type('Rectangle1');
    cy.get('button:contains("Save")').click();
    cy.wait(500);

    cy.get('button:contains("Rectangle")').click();
    cy.get('canvas').trigger('mousedown', { clientX: 300, clientY: 100 })
      .trigger('mousemove', { clientX: 400, clientY: 200 })
      .trigger('mouseup');
    cy.get('input[placeholder="Enter class name"]').type('Rectangle2');
    cy.get('button:contains("Save")').click();
    cy.wait(500);

    cy.get('button:contains("Rectangle")').click();
    cy.get('canvas').trigger('mousedown', { clientX: 500, clientY: 100 })
      .trigger('mousemove', { clientX: 600, clientY: 200 })
      .trigger('mouseup');
    cy.get('input[placeholder="Enter class name"]').type('Rectangle3');
    cy.get('button:contains("Save")').click();
    cy.wait(500);
    
    // Undo all three actions
    cy.get('button:contains("Undo")').click();
    cy.wait(500);
    cy.get('button:contains("Undo")').click();
    cy.wait(500);
    cy.get('button:contains("Undo")').click();
    cy.wait(500);
    
    // Verify all annotations are gone
    cy.get('.annotation-list-item').should('have.length', 0);
    
    // Now redo in reverse order
    cy.get('button:contains("Redo")').click();
    cy.wait(500);
    
    // Verify Rectangle1 is back
    cy.get('.annotation-list-item').should('have.length', 1);
    cy.get('.annotation-list-item:contains("Rectangle1")').should('exist');
    
    // Redo again
    cy.get('button:contains("Redo")').click();
    cy.wait(500);
    
    // Verify Rectangle2 is back
    cy.get('.annotation-list-item').should('have.length', 2);
    cy.get('.annotation-list-item:contains("Rectangle2")').should('exist');
    
    // Redo one more time
    cy.get('button:contains("Redo")').click();
    cy.wait(500);
    
    // Verify all rectangles are back
    cy.get('.annotation-list-item').should('have.length', 3);
    cy.get('.annotation-list-item:contains("Rectangle3")').should('exist');
  });

  it('should maintain the correct undo order when rapid actions are performed', () => {
    // Create three annotations in rapid succession
    
    // Create first annotation
    cy.get('button:contains("Rectangle")').click();
    cy.get('canvas').trigger('mousedown', { clientX: 100, clientY: 100 })
      .trigger('mousemove', { clientX: 200, clientY: 200 })
      .trigger('mouseup');
    cy.get('input[placeholder="Enter class name"]').type('RapidRectangle1');
    cy.get('button:contains("Save")').click();
    
    // Create second annotation immediately
    cy.get('button:contains("Rectangle")').click();
    cy.get('canvas').trigger('mousedown', { clientX: 300, clientY: 100 })
      .trigger('mousemove', { clientX: 400, clientY: 200 })
      .trigger('mouseup');
    cy.get('input[placeholder="Enter class name"]').type('RapidRectangle2');
    cy.get('button:contains("Save")').click();
    
    // Create third annotation immediately
    cy.get('button:contains("Rectangle")').click();
    cy.get('canvas').trigger('mousedown', { clientX: 500, clientY: 100 })
      .trigger('mousemove', { clientX: 600, clientY: 200 })
      .trigger('mouseup');
    cy.get('input[placeholder="Enter class name"]').type('RapidRectangle3');
    cy.get('button:contains("Save")').click();
    
    // Wait for all annotations to be saved
    cy.wait(1000);
    
    // Verify all 3 rectangles are visible
    cy.get('.annotation-list-item').should('have.length', 3);
    
    // Undo the last action (should remove RapidRectangle3)
    cy.get('button:contains("Undo")').click();
    cy.wait(500);
    
    // Verify RapidRectangle3 is gone but 1 and 2 remain
    cy.get('.annotation-list-item').should('have.length', 2);
    cy.get('.annotation-list-item:contains("RapidRectangle3")').should('not.exist');
    cy.get('.annotation-list-item:contains("RapidRectangle2")').should('exist');
    cy.get('.annotation-list-item:contains("RapidRectangle1")').should('exist');
    
    // Undo again (should remove RapidRectangle2)
    cy.get('button:contains("Undo")').click();
    cy.wait(500);
    
    // Verify RapidRectangle2 is now gone but 1 remains
    cy.get('.annotation-list-item').should('have.length', 1);
    cy.get('.annotation-list-item:contains("RapidRectangle2")').should('not.exist');
    cy.get('.annotation-list-item:contains("RapidRectangle1")').should('exist');
  });
});
