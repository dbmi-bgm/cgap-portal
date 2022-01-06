'use strict';

import React, { useState } from 'react';
import _ from 'underscore';

import { console, ajax } from '@hms-dbmi-bgm/shared-portal-components/es/components/util';
import { Alerts } from '@hms-dbmi-bgm/shared-portal-components/es/components/ui/Alerts';



export function AddToVariantSampleListButton(props){
    const {
        selectedVariantSamples,
        onResetSelectedVariantSamples,
        variantSampleListItem = null,
        updateVariantSampleListID,
        caseItem = null,
        filterSet,
        selectedFilterBlockIndices = {},
        fetchVariantSampleListItem,
        isLoadingVariantSampleListItem = false,
        searchType = "VariantSample"
    } = props;

    const {
        "@id": caseAtID,
        project: { "@id": caseProjectID } = {},
        institution: { "@id" : caseInstitutionID } = {},
        accession: caseAccession = null
    } = caseItem;

    const [ isPatchingVSL, setIsPatchingVSL ] = useState(false);

    if (searchType === "StructuralVariantSample") {
        return null; // TODO: actually make add to VSL work with Structural Variant Samples.
    }

    /** PATCH or create new VariantSampleList w. additions */

    if (isLoadingVariantSampleListItem) {
        return (
            <button type="button" className="btn btn-primary" disabled>
                <span className="d-flex align-items-center">
                    <i className="icon icon-circle-notch icon-spin fas mr-1"/>
                    Loading most recent selections...
                </span>
            </button>
        );
    } else if (isPatchingVSL) {
        return (
            <button type="button" className="btn btn-primary" disabled>
                <span className="d-flex align-items-center">
                    <i className="icon icon-circle-notch icon-spin fas mr-1"/>
                    Saving selections...
                </span>
            </button>
        );
    } else if (selectedVariantSamples.size === 0) {
        return (
            <button type="button" className="btn btn-primary" disabled>
                <span>
                    No Sample Variants selected
                </span>
            </button>
        );
    } else {

        const onButtonClick = function(){

            if (!filterSet) {
                throw new Error("Expected some filterSet to be present");
            }

            setIsPatchingVSL(true);

            /** Adds/transforms props.selectedVariantSamples to param `variantSampleSelectionsList` */
            function addToSelectionsList(variantSampleSelectionsList){

                let filterBlocksRequestData = _.pick(filterSet, "filter_blocks", "flags", "uuid");

                // Only keep filter_blocks which were used in this query --
                filterBlocksRequestData.filter_blocks = filterBlocksRequestData.filter_blocks.filter(function(fb, fbIdx){
                    return selectedFilterBlockIndices[fbIdx];
                });

                // Convert to string (avoid needing to add to schema for now)
                filterBlocksRequestData = JSON.stringify(filterBlocksRequestData);

                // selectedVariantSamples is type (literal) Map, so param signature is `value, key, map`.
                // These are sorted in order of insertion/selection.
                // See https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Map/forEach
                selectedVariantSamples.forEach(function(variantSampleItem, variantSampleAtID){
                    variantSampleSelectionsList.push({
                        "variant_sample_item": variantSampleAtID, // Will become linkTo (embedded),
                        "filter_blocks_request_at_time_of_selection": filterBlocksRequestData
                        // The below 2 fields are filled in on backend (configured via `serverDefaults` in Item schema for these fields)
                        // "selected_by",
                        // "date_selected"
                    });
                });
            }

            let requestPromiseChain;


            if (!variantSampleListItem) {
                // Create new Item, then PATCH its @id to `Case.variant_sample_list_id` field.
                const createVSLPayload = {
                    "variant_samples": [],
                    "institution": caseInstitutionID,
                    "project": caseProjectID,
                    "status": "current"
                };

                if (caseAccession) {
                    createVSLPayload.created_for_case = caseAccession;
                }

                addToSelectionsList(createVSLPayload.variant_samples);

                requestPromiseChain = ajax.promise("/variant-sample-lists/", "POST", {}, JSON.stringify(createVSLPayload))
                    .then(function(respVSL){
                        console.log('VSL POST response', respVSL);
                        const {
                            "@graph": [{
                                "@id": vslAtID
                            }],
                            error: vslError
                        } = respVSL;

                        if (vslError || !vslAtID) {
                            throw new Error("Didn't succeed in creating new VSL Item");
                        }

                        updateVariantSampleListID(vslAtID, function(){
                            // Wait to reset selected items until after loading updated VSL so that checkboxes still appear checked during VSL PATCH+GET request.
                            fetchVariantSampleListItem(onResetSelectedVariantSamples);
                        });

                        // PATCH Case w. variant_sample_list_id
                        return ajax.promise(caseAtID, "PATCH", {}, JSON.stringify({ "variant_sample_list_id": vslAtID }));
                    }).then(function(respCase){
                        console.log('Case PATCH response from after VSL POST', respCase);
                        const {
                            "@graph": [{
                                "@id": respCaseAtID
                            }],
                            error: caseError
                        } = respCase;
                        if (caseError || !respCaseAtID) {
                            throw new Error("Didn't succeed in PATCHing Case Item");
                        }
                        console.info("Updated Case.variant_sample_list_id", respCase);
                        // TODO Maybe local-patch in-redux-store Case with new last_modified + variant_sample_list_id stuff? Idk.
                    });

            } else {
                // patch existing
                const {
                    "@id": vslAtID,
                    variant_samples: existingVariantSampleSelections = []
                } = variantSampleListItem;

                // Need to convert embedded linkTos into just @ids before PATCHing -
                const variantSamplesPatchList = existingVariantSampleSelections.map(function(existingSelection){
                    const { variant_sample_item: { "@id": vsItemID } } = existingSelection;
                    if (!vsItemID) {
                        throw new Error("Expected all variant samples to have an ID -- likely a view permissions issue.");
                    }
                    return {
                        ...existingSelection,
                        "variant_sample_item": vsItemID
                    };
                });

                // Add in new selections
                addToSelectionsList(variantSamplesPatchList);

                requestPromiseChain = ajax.promise(vslAtID, "PATCH", {}, JSON.stringify({ "variant_samples": variantSamplesPatchList }) )
                    .then(function(respVSL){
                        console.log('VSL PATCH response', respVSL);
                        const {
                            "@graph": [{
                                "@id": vslAtID
                            }],
                            error: vslError
                        } = respVSL;

                        if (vslError || !vslAtID) {
                            throw new Error("Didn't succeed in patching VSL Item");
                        }

                        // Wait to reset selected items until after loading updated VSL so that checkboxes still appear checked during VSL PATCH+GET request.
                        fetchVariantSampleListItem(onResetSelectedVariantSamples);

                    });

                // We shouldn't have any duplicates since prev-selected VSes should appear as checked+disabled in table.
                // But maybe should still check to be safer (todo later)
            }


            // Show any errors using an alert and unset isPatchingVSL state on completion.
            requestPromiseChain.catch(function(error){
                // TODO: add analytics exception event for this
                console.error(error);
                Alerts.queue({
                    "title" : "Error PATCHing or POSTing VariantSampleList",
                    "message" : JSON.stringify(error),
                    "style" : "danger"
                });
            }).finally(function(){
                setIsPatchingVSL(false);
            });

        };

        return (
            <button type="button" className="btn btn-primary" onClick={onButtonClick}>
                <span>
                    Add <strong>{ selectedVariantSamples.size }</strong> selected Sample Variants to Interpretation
                </span>
            </button>
        );
    }
}
