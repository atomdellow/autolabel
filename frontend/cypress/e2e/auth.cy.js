describe('Authentication Flows', () => {
  const uniqueUsername = `testuser_${Date.now()}`;
  const password = 'password123';

  beforeEach(() => {
    // Clear local storage to ensure a clean state for each test
    cy.clearLocalStorage();
    // Visit the home page, which should redirect to login if not authenticated
    cy.visit('http://localhost:5173/');
  });

  it('should redirect to login page if not authenticated', () => {
    cy.url().should('include', '/login');
  });

  it('should allow a user to register', () => {
    cy.visit('http://localhost:5173/register');
    cy.get('input[name="username"]').type(uniqueUsername);
    cy.get('input[name="password"]').type(password);
    cy.get('button[type="submit"]').click();
    // After registration, user should be redirected to login or dashboard
    // Assuming redirection to login, then user logs in
    cy.url().should('include', '/login'); 
    cy.get('input[name="username"]').type(uniqueUsername);
    cy.get('input[name="password"]').type(password);
    cy.get('button[type="submit"]').click();
    cy.url().should('include', '/dashboard');
    cy.window().its('localStorage.token').should('exist');
  });

  it('should prevent registration with an existing username', () => {
    // First, register a user
    const existingUsername = `existinguser_${Date.now()}`;
    cy.request('POST', 'http://localhost:5000/api/auth/register', {
      username: existingUsername,
      password: password,
    }).then((response) => {
      expect(response.status).to.eq(201);
    });

    // Attempt to register again with the same username
    cy.visit('http://localhost:5173/register');
    cy.get('input[name="username"]').type(existingUsername);
    cy.get('input[name="password"]').type('anotherpassword');
    cy.get('button[type="submit"]').click();
    
    // Check for an error message (exact message depends on implementation)
    cy.get('.error-message').should('be.visible'); // Adjust selector as needed
    cy.url().should('include', '/register');
  });

  it('should allow a registered user to login', () => {
    // Register user first (if not using a pre-existing user for tests)
    const loginUser = `loginuser_${Date.now()}`;
    cy.request('POST', 'http://localhost:5000/api/auth/register', {
        username: loginUser,
        password: password,
    });

    cy.visit('http://localhost:5173/login');
    cy.get('input[name="username"]').type(loginUser);
    cy.get('input[name="password"]').type(password);
    cy.get('button[type="submit"]').click();
    cy.url().should('include', '/dashboard');
    cy.window().its('localStorage.token').should('exist');
  });

  it('should prevent login with incorrect credentials', () => {
    cy.visit('http://localhost:5173/login');
    cy.get('input[name="username"]').type('nonexistentuser');
    cy.get('input[name="password"]').type('wrongpassword');
    cy.get('button[type="submit"]').click();
    
    // Check for an error message
    cy.get('.error-message').should('be.visible'); // Adjust selector as needed
    cy.url().should('include', '/login');
    cy.window().its('localStorage.token').should('not.exist');
  });

  it('should allow a logged-in user to logout', () => {
    // Register and login user first
    const logoutUser = `logoutuser_${Date.now()}`;
    cy.request('POST', 'http://localhost:5000/api/auth/register', {
        username: logoutUser,
        password: password,
    });
    cy.visit('http://localhost:5173/login');
    cy.get('input[name="username"]').type(logoutUser);
    cy.get('input[name="password"]').type(password);
    cy.get('button[type="submit"]').click();
    cy.url().should('include', '/dashboard');

    // Find and click the logout button (adjust selector as needed)
    cy.get('button#logout-button').click(); // Assuming a logout button with id="logout-button"
    
    cy.url().should('include', '/login');
    cy.window().its('localStorage.token').should('not.exist');
  });

  // Basic navigation test for authenticated user
  it('should allow authenticated user to visit dashboard', () => {
    // Register and login user
    const authNavUser = `authnavuser_${Date.now()}`;
    cy.request('POST', 'http://localhost:5000/api/auth/register', {
        username: authNavUser,
        password: password,
    });
    cy.visit('http://localhost:5173/login');
    cy.get('input[name="username"]').type(authNavUser);
    cy.get('input[name="password"]').type(password);
    cy.get('button[type="submit"]').click();
    cy.url().should('include', '/dashboard');

    // Attempt to visit dashboard again
    cy.visit('http://localhost:5173/dashboard');
    cy.url().should('include', '/dashboard');
  });

  // Basic navigation test for unauthenticated user
  it('should redirect unauthenticated user from dashboard to login', () => {
    cy.visit('http://localhost:5173/dashboard');
    cy.url().should('include', '/login');
  });
});
