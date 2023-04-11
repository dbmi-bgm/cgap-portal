// ***********************************************************
// This example support/index.js is processed and
// loaded automatically before your test files.
//
// This is a great place to put global configuration and
// behavior that modifies Cypress.
//
// You can change the location of this file or turn off
// automatically serving support files with the
// 'supportFile' configuration option.
//
// You can read more here:
// https://on.cypress.io/configuration
// ***********************************************************

// Import commands.js using ES2015 syntax:
import './commands';
// Tools for loading up database with for-Cypress inserts.
// import './post-inserts';

// Alternatively you can use CommonJS syntax:
// require('./commands')

/* ---- */

export const cypressVisitHeaders = {
    // This matches the Accept header that Chrome sends up.
    // By default, Cypress sends up "text/html, */*" which gets incorrectly negotiated to "*/*" --> "application/json" as seems
    // that request.accept.acceptable_offers() doesn't select most narrow content-type when multiple supplied unless proper 'q' values are included as well.
    Accept: 'text/html, application/xhtml+xml, application/xml;q=0.9, image/avif, image/webp, image/apng, */*;q=0.8, application/signed-exchange;v=b3;q=0.9',
};
