const { defineConfig } = require('cypress');

module.exports = defineConfig({
  e2e: {
    setupNodeEvents(on, config) {
      // implement node event listeners here
    },
    specPattern: 'cypress/e2e/**/*.cy.{js,jsx,ts,tsx}',
    baseUrl: 'http://localhost:5173', // Assuming your Vite dev server runs here
  },

  component: {
    devServer: {
      framework: 'vue',
      bundler: 'vite',
    },
    specPattern: 'src/**/*.cy.{js,jsx,ts,tsx}', // Or 'cypress/component/**/*.cy.{js,jsx,ts,tsx}'
    // setupNodeEvents(on, config) {
    //   // implement node event listeners here, if needed for component testing
    // },
  },
});
