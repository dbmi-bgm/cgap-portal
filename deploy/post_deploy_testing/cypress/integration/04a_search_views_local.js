import { cypressVisitHeaders } from './../support';


describe('Deployment/CI Search View Tests', function () {

    context('/search/?type=Item', function () {

        before(function(){ // beforeAll
            cy.visit('/search/', { headers: cypressVisitHeaders });
        });

        it('Has at least 10 results for /search/?type=Item', function () {
            cy.location('search').should('include', 'type=Item').end()
                .get('.search-results-container .search-result-row').then(($searchResultElems)=>{
                    expect($searchResultElems.length).to.be.greaterThan(10);
                }).end()
                .searchPageTotalResultCount().should('be.greaterThan', 10);
        });

    });

    context('/search/?type=Page', function(){

        before(function(){ // beforeAll
            cy.visit('/pages', { headers: cypressVisitHeaders }); // We should get redirected to ?type=Page
        });

        beforeEach(function(){
            // Ensure we preserve search session cookie for proper ordering.
            Cypress.Cookies.preserveOnce("searchSessionID");
        });

        it('Should redirect to /search/?type=Page correctly', function(){
            cy.location('search').should('include', 'type=Page').end()
                .location('pathname').should('include', '/search/');
        });

        it('Should have at least 2 results.', function(){
            cy.get('.search-results-container .search-result-row').then(($searchResultElems)=>{
                expect($searchResultElems.length).to.be.greaterThan(2);
            });
        });

    });

});
