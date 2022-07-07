import { cypressVisitHeaders } from './../support';


describe.skip('Post-Deployment Search View Tests', function () {

    context('/search/?type=Item', function () {

        before(function(){
            cy.visit('/search/', { headers: cypressVisitHeaders });
        });

        beforeEach(function(){
            // Ensure we preserve search session cookie for proper ordering.
            Cypress.Cookies.preserveOnce("searchSessionID");
        });

        it('Load as you scroll works for ?type=Item', function () {

            cy.location('search').should('include', 'type=Item');

            cy.searchPageTotalResultCount().then((totalCountExpected)=>{
                const intervalCount = Math.min(20, parseInt(totalCountExpected / 25));

                for (let interval = 0; interval < intervalCount; interval++){
                    cy.scrollToBottom().then(()=>{
                        cy.get('.search-results-container .search-result-row[data-row-number="' + (25 * (interval + 1)) + '"]').should('have.length', 1);
                    });
                }

            });

        });

    });

});
