import { cypressVisitHeaders } from './../support';


describe('Deployment/CI Search View Tests', function () {

    context('/search/?type=Item', function () {

        before(function(){
            cy.visit("/", { headers: cypressVisitHeaders }).loginCGAP().end();
        });

        beforeEach(function(){
            // See https://docs.cypress.io/api/cypress-api/cookies#Preserve-Once
            Cypress.Cookies.preserveOnce('jwtToken', 'searchSessionID');
        });

        it('Has at least 5 results for /search/?type=Item', function () {
            cy.visit("/search/", { headers: cypressVisitHeaders }).end()
                .location('search').should('include', 'type=Item').end()
                .get('.search-results-container .search-result-row').then(($searchResultElems)=>{
                    expect($searchResultElems.length).to.be.greaterThan(5);
                }).end()
                .searchPageTotalResultCount().should('be.greaterThan', 5);
        });

    });

    context('/search/?type=Page', function(){

        beforeEach(function(){
            // Ensure we preserve search session cookie for proper ordering.
            Cypress.Cookies.preserveOnce('jwtToken', 'searchSessionID');
        });

        it('Should redirect to /search/?type=Page correctly', function(){
            cy.visit('/pages', { headers: cypressVisitHeaders }).end() // We should get redirected to ?type=Page
                .location('search').should('include', 'type=Page').end()
                .location('pathname').should('include', '/search/');
        });

        it('Should have at least 2 results.', function(){
            cy.get('.search-results-container .search-result-row').then(($searchResultElems)=>{
                expect($searchResultElems.length).to.be.greaterThan(2);
            });
        });

    });

});
