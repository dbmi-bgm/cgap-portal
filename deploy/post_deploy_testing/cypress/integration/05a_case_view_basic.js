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


        // cy.loginCGAP().end()

        // cy.login4DN({ 'email' : 'ud4dntest@gmail.com', 'useEnvToken' : false }).end()
        //     .get('ul.navbar-acct li.user-account-item').should('have.class', 'is-logged-in').then((accountListItem)=>{
        //         expect(accountListItem.children('#user_account_nav_button').text()).to.contain('Frontend');
        //     }).end()
        //     .get("#user_account_nav_button").click().end()
        //     .get('ul.dropdown-menu[aria-labelledby="user_account_nav_button"]').contains('Profile').click().end()
        //     .get('.page-container .user-title-row-container h1.user-title').should('contain', "Frontend").end() // Test only for first name as we're editing last name & it may change re: delayed indexing, etc.
        //     .get('.page-container .access-keys-container h3').should('contain', "Access Keys").end()
        //     .get('.page-container .access-keys-container #add-access-key').scrollToCenterElement().click({ force : true }).wait(100).end()
        //     .get('.modal-body').should('contain', 'Access Key ID').should('contain', 'Secret Access Key').end()
        //     .get('.modal-body div.row:first-of-type code').invoke('text').then(function(accessKeyID){
        //         return cy.get('.fade.in.modal').click().wait(500).end()
        //             .get('.page-container .access-keys-container').should('contain', accessKeyID).end()
        //             .get('.page-container .access-keys-container .access-keys-table tr:last-child .access-key-buttons .btn-danger').click({ force : true }).end()
        //             .get('.page-container .access-keys-container').should('not.contain', accessKeyID);
        //     });

    });

    context("Top area", function(){

        it("Has panels for patient info and family info with phenotypic features", function(){
            cy.get(".col-stats #case-stats > div:first-child .card-header").contains("Patient Info: IND10254").end()
                .get(".col-stats #case-stats > div:first-child .card-footer > div a.badge").should('have.length', 1)
                .get(".col-stats #case-stats > div:last-child .card-header").contains("Family Info: GAPFA9X3A8LE").end()
                .get(".col-stats #case-stats > div:last-child .card-footer > div a.badge").should('have.length', 4);
        });

        it("Has pedigree with some nodes present", function(){
            cy.get(".pedigree-vis-heading button.view-pedigree-btn").should("have.text", "View Pedigree").end()
                .get("svg.pedigree-viz-shapes-layer.shapes-layer g.individuals-bg-shape-layer > g").should('have.length', 13);
        });

    });


    context("Tabs area", function(){

        it("Have 5 tabs, with first being active by default", function(){
            cy.get(".tab-router .dot-tab-nav-list .arrow-tab").should("have.length", 5)
                .eq(0).click()
                .should(function($arrowTab){
                    const className = $arrowTab[0].className;
                    expect(className).to.have.string(" active");
                    expect($arrowTab).to.have.text('Accessioning');
                }).end()
                // `id="case-info.accessioning"`; NOT class="accessioning"
                .get("#case-info\\.accessioning > h1").contains("Accessioning Report and History");
        });

        it("Click 2nd tab, see QC metrics", function(){
            cy.get(".tab-router .dot-tab-nav-list .arrow-tab")
                .eq(1).click()
                .should(function($arrowTab){
                    const className = $arrowTab[0].className;
                    expect(className).to.have.string(" active");
                    expect($arrowTab).to.have.text('Bioinformatics');
                }).end()
                .get("#case-info\\.bioinformatics > h1").contains("Bioinformatics Analysis").end()
                .get("#case-info\\.bioinformatics .tab-inner-container.card:first-of-type .card-body .qc-summary")
                .eq(0).contains("Total Number of Reads:466477333")
                .next().contains("Coverage:47.2X");
        });

        it("Click 3rd tab, see FSUI & Filtering Table", function(){
            /** Todo - more in-depth testing, maybe in sep file. */
            cy.get(".tab-router .dot-tab-nav-list .arrow-tab")
                .eq(2).click()
                .should(function($arrowTab){
                    const className = $arrowTab[0].className;
                    expect(className).to.have.string(" active");
                    expect($arrowTab).to.have.text('Filtering');
                }).end()
                .get("#case-info\\.filtering .embedded-search-container h1").contains("Variant Filtering and Technical Review").end()
                .get("#case-info\\.filtering .above-variantsample-table-ui .blocks-container .filterset-block").should("have.length.greaterThan", 0);
        });

        it("Wait for VSL to load, click 4th tab, see >0 VariantSampleList Item contents", function(){
            /** Todo - more in-depth testing, maybe in sep file. */
            cy.get(".tab-router .dot-tab-nav-list .arrow-tab")
                .eq(3)
                // Wait to become not disabled first (-- VSL item is loading --)
                .should(function($arrowTab){
                    const className = $arrowTab[0].className;
                    expect(className).to.not.have.string(" disabled");
                    expect($arrowTab).to.have.text('Interpretation');
                })
                .click()
                .should(function($arrowTab){
                    const className = $arrowTab[0].className;
                    expect(className).to.have.string(" active");
                }).end()
                .get("#case-info\\.interpretation div.card").should("have.length.greaterThan", 0);
        });

    });



    // });

});

