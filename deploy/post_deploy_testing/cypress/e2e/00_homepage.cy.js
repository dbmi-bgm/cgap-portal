import { cypressVisitHeaders } from './../support';

describe('Home Page', function () {

    it('Has correct title', function () {

        cy.visit('/', { headers: cypressVisitHeaders }).end()
            .title().should('include', 'Computational Genome Analysis Platform').end()
            .get('#top-nav .navbar-title').should('have.text', 'CGAP').end();

    });

});

