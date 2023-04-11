const { defineConfig } = require('cypress');

module.exports = defineConfig({
    projectId: '9hf9k3',
    defaultCommandTimeout: 60000,
    pageLoadTimeout: 120000,
    requestTimeout: 40000,
    responseTimeout: 120000,
    blockHosts: 'www.google-analytics.com',
    e2e: {
        baseUrl: 'https://cgap-mgb.hms.harvard.edu/',
        specPattern: './cypress/e2e/*.cy.js',
        setupNodeEvents(on, config) {
            // implement node event listeners here
        },
    },
});
