import { cypressVisitHeaders } from './../support';


function onSupersededAjaxRequestHandler(err, runnable){
    // When we click on things like "Add New Filter Block",
    // we might cancel previous search requests, which may
    // emit error like "Did not get back a search response, request was potentially aborted."
    if (err.message.includes('Did not get back a search response, request was potentially aborted.')) {
        Cypress.log({
            "name": "Information about request",
            "displayName": "INFO",
            "message": "An app AJAX request was aborted or superseded"
        });
        return false;
    }
    // Don't do anything == fail the test
}


describe('Case View - FSUI', function () {

    before(function(){
        cy.visit("/", { headers: cypressVisitHeaders })
            .loginCGAP()
            .end();
    });

    beforeEach(function(){
        // See https://docs.cypress.io/api/cypress-api/cookies#Preserve-Once
        Cypress.Cookies.preserveOnce('jwtToken', 'searchSessionID');
    });

    let countFBInitial = null;

    it("We should be on right tab upon page initialization/login", function(){
        cy.visit("/cases/GAPCAJQ1L99X/#case-info.filtering", { headers: cypressVisitHeaders })
            .get(".tab-router .dot-tab-nav-list .arrow-tab")
            .eq(2)
            .should("have.class", "active")
            .should("have.text", "Filtering").end()
            .get("#case-info\\.filtering .above-variantsample-table-ui .filter-set-ui-header h4").should("not.have.text", "Loading Filter Set").end()
            .get("#case-info\\.filtering .above-variantsample-table-ui .blocks-container .filterset-block").should("have.length.greaterThan", 0).then(function($fsBlocks){
                countFBInitial = $fsBlocks.length;
                Cypress.log({
                    "name": "Get count of initial filter blocks",
                    "displayName": "# blocks",
                    "message": countFBInitial
                });
            });
    });


    it("Save buttons disabled initially", function(){
        cy.get(".above-variantsample-table-ui .filter-set-ui-header button:first-child").should(function($btn){
            expect($btn).to.have.text('Save Case FilterSet');
            expect($btn).to.have.attr('disabled');
        }).end()
            .get(".above-variantsample-table-ui .filter-set-ui-header button:last-child").should(function($btn){
                expect($btn).to.have.text('Save as Preset');
                expect($btn).to.have.attr('disabled');
            });
    });

    it("Add Filter Block button creates new empty block", function(){

        // New FB block created+selected may cancel an existing search request for previous filterset block selection
        cy.once('uncaught:exception', onSupersededAjaxRequestHandler).end()
            .get("#case-info\\.filtering #snv-filtering").within(function(){
                cy.get(".above-variantsample-table-ui div[aria-label=\"Creation Controls\"] button:first-child")
                    .should("have.text", "Add Filter Block").click().end()
                    .get(".above-variantsample-table-ui .filterset-blocks-container")
                    .should("have.attr", "data-all-selected", "false").end()
                    .get(".above-variantsample-table-ui .filterset-blocks-container .blocks-container .filterset-block").should("have.length", countFBInitial + 1)
                    .eq(-1)
                    .should("have.class", "selected").within(function($fb){
                        // Wait until is finished loading (else next test may fail)
                        return cy.get("i.icon").should("have.class", "icon-times-circle");
                    })
                    .contains("No Filters Selected").end();
            });
    });

    it("Selecting term from FacetList adds to the new filter block", function(){

        cy.once('uncaught:exception', onSupersededAjaxRequestHandler).end()
            .get("#case-info\\.filtering  #snv-filtering").within(function(){
                // Open "Genotype" grouping facet -- allow this to fail as `Proband Genotype` might be ungrouped
                //.get(".facets-column > .facets-container > .facets-body div.facet[data-group=\"Genotype\"] .facet-title")
                // Open "Proband Genotype" field facet
                cy.get(".facets-column > .facets-container > .facets-body div.facet[data-field=\"associated_genotype_labels.proband_genotype_label\"] .facet-title")
                    .click()
                    .get(".facets-column > .facets-container > .facets-body div.facet[data-field=\"associated_genotype_labels.proband_genotype_label\"] .facet-list-element[data-key=\"Heterozygous\"]")
                    .should("not.have.class", "selected")
                    .click()
                    // Get it again, else might be referring to non-existing/unmounted elem as term changes locations.
                    .get(".facets-column > .facets-container > .facets-body div.facet[data-field=\"associated_genotype_labels.proband_genotype_label\"] .facet-list-element[data-key=\"Heterozygous\"]")
                    .should("have.class", "selected").end()
                    .get(".filterset-blocks-container .blocks-container .filterset-block:last-child .field-block").should("have.length", 1)
                    .within(function($fb){
                        cy.get(".field-name").should("have.text", "Proband Genotype").end()
                            .get(".value-blocks .value-block")
                            .should("have.text", "Heterozygous");
                    });
            });

    });

    // TODO: Test RangeFacets

    // TODO: Test Presets (after UX feedback)


});
