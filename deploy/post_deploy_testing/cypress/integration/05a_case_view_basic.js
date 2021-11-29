import { cypressVisitHeaders } from './../support';


describe('Case View - Initial', function () {

    before(function(){
        cy.visit("/", { headers: cypressVisitHeaders }).loginCGAP().end();
    });

    beforeEach(function(){
        // See https://docs.cypress.io/api/cypress-api/cookies#Preserve-Once
        Cypress.Cookies.preserveOnce('jwtToken', 'searchSessionID');
    });

    /**
     * The Case that we're testing or its features may change in future, so keeping relatively vague for time being.
     * @todo - Once big enough, split up into multiple files (keeping a common naming, like 05b, 05c, or similar) to parallelize.
     */

    it('CGAP Core project "GAPCAJQ1L99X" exists; search result clickable', function(){

        cy.visit(
            "/search/?proband_case=true&project.display_title=CGAP+Core&type=Case&accession=GAPCAJQ1L99X",
            { headers: cypressVisitHeaders }
        )
            .get(".search-result-row").should('have.length.greaterThan', 0)
            .first().within(function($rowElem){
                return cy.get(".search-result-column-block[data-field=\"display_title\"] .adv-block-link").click();
            });
    });

    context("Top area", function(){

        it("Has panels for patient info and family info with phenotypic features", function(){
            cy.get(".col-stats #case-stats > div:first-child .card-header").contains("Patient Info").end()
                .get(".col-stats #case-stats > div:first-child .card-footer > div a.badge").should('have.length', 1)
                .get(".col-stats #case-stats > div:last-child .card-header").contains("Family Info").end()
                .get(".col-stats #case-stats > div:last-child .card-footer > div a.badge").should('have.length', 4);
        });

        it("Has pedigree with some nodes present", function(){
            cy.get(".pedigree-vis-heading button.view-pedigree-btn").should("have.text", "View").end()
                .get("svg.pedigree-viz-shapes-layer.shapes-layer g.individuals-bg-shape-layer > g").should('have.length', 13);
        });

    });


    context("Tabs area", function(){

        it("Have 5 tabs, with first being active by default", function(){
            cy.get(".tab-router .dot-tab-nav-list .arrow-tab").should("have.length", 5)
                .eq(0)
                .should("have.text", "Accessioning")
                .should("have.class", "active").end()
                // `id="case-info.accessioning"`; NOT class="accessioning"
                .get("#case-info\\.accessioning > h1").contains("Accessioning Report and History");
        });

        it("Click 2nd tab, see QC metrics", function(){
            cy.get(".tab-router .dot-tab-nav-list .arrow-tab")
                .eq(1)
                .should("have.text", "Bioinformatics")
                .click()
                .should("have.class", "active").end()
                .get("#case-info\\.bioinformatics > h1").contains("Bioinformatics Analysis").end()
                .get("#case-info\\.bioinformatics .tab-inner-container.card:first-of-type .card-body .qc-summary")
                .should("have.length", 12)
                .eq(0).should("have.text", "Total Number of Reads:466,477,333")
                .get("#case-info\\.bioinformatics .tab-inner-container.card:first-of-type .card-body .qc-summary")
                .eq(1).should("have.text", "Coverage:47.2X");
        });

        it("Click 3rd tab, see FSUI & Filtering Table", function(){
            /** Todo - more in-depth testing, maybe in sep file. */
            cy.get(".tab-router .dot-tab-nav-list .arrow-tab")
                .eq(2)
                .should("have.text", "Filtering")
                .click()
                .should("have.class", "active").end()
                .get("#case-info\\.filtering h1").contains("Variant Filtering and Technical Review").end()
                .get("#case-info\\.filtering .above-variantsample-table-ui .blocks-container .filterset-block").should("have.length.greaterThan", 0);
        });

        it("Wait for VSL to load, click 4th tab, see >0 VariantSampleList Item contents", function(){
            /** Todo - more in-depth testing, maybe in sep file. */
            cy.get(".tab-router .dot-tab-nav-list .arrow-tab")
                .eq(3)
                .should("have.text", "Interpretation")
                // Wait to become not disabled first (-- VSL item is loading --)
                .should("not.have.class", "disabled")
                .click()
                .should("have.class", "active").end()
                .get("#case-info\\.interpretation div.card").should("have.length.greaterThan", 0);
        });

    });

});

