'use strict';

import React, { useState } from 'react';
import _ from 'underscore';

import { console, ajax, object } from '@hms-dbmi-bgm/shared-portal-components/es/components/util';
import { Alerts } from '@hms-dbmi-bgm/shared-portal-components/es/components/ui/Alerts';



export function AddToVariantSampleListButton(props){
    const {
        selectedVariantSamples,
        onResetSelectedVariantSamples,
        variantSampleListItem = null,
        updateVariantSampleListID,
        caseItem = null,
        filterSet,
        intersectFilterBlocks = false,
        selectedFilterBlockIndices = {},
        fetchVariantSampleListItem,
        isLoadingVariantSampleListItem = false,
        searchType = "VariantSample",
        haveEditPermission = true,
        isEditDisabled = false
    } = props;

    const {
        "@id": caseAtID,
        project: { "@id": caseProjectID } = {},
        institution: { "@id" : caseInstitutionID } = {},
        accession: caseAccession = null
    } = caseItem;

    const [ isPatchingVSL, setIsPatchingVSL ] = useState(false);

    const mapSearchTypeToDisplay = { VariantSample: "Variant Sample", StructuralVariantSample: "Structural Variant Sample" };

    const regularTitle = <React.Fragment>Add <strong>{ selectedVariantSamples.size }</strong> selected { mapSearchTypeToDisplay[searchType] } to Interpretation</React.Fragment>;

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
                    No {mapSearchTypeToDisplay[searchType]}s selected
                </span>
            </button>
        );
    } else if (!haveEditPermission) {
        // Primary button style; is possible this Case is public
        return (
            <button type="button" className="btn btn-primary" disabled data-tip="No edit permission.">
                <span>
                    { regularTitle }
                </span>
            </button>
        );
    } else if (isEditDisabled) {
        // Edit disabled for some reason other than lack of edit permission, perhaps an error in FilterSet. Prevent adding.
        return (
            <button type="button" className="btn btn-danger" disabled data-tip="Check for any errors above such as duplicate filter block name or changing contents of a filter block that's been used to add a sample already. Otherwise, check user permssions.">
                <span>
                    { regularTitle }
                </span>
            </button>
        );
    } else {

        const onButtonClick = function(){

            if (!filterSet) {
                throw new Error("Expected some filterSet to be present");
            }

            setIsPatchingVSL(true);

            // Used to help generate 'filter_blocks_used' (common to all selections made in this interaction)
            const { filter_blocks: filterBlocks } = filterSet;
            const selectedFilterBlockIdxList = Object.keys(selectedFilterBlockIndices);
            const selectedFilterBlockIndicesLen = selectedFilterBlockIdxList.length;


            /** Adds/transforms props.selectedVariantSamples to param `variantSampleSelectionsList` */
            function addToSelectionsList(variantSampleSelectionsList){

                // selectedVariantSamples is type (literal) Map, so param signature is `value, key, map`.
                // These are sorted in order of insertion/selection.
                // See https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Map/forEach
                selectedVariantSamples.forEach(function(variantSampleItem, variantSampleAtID){
                    const { __matching_filter_block_names: matchingFilterBlockNamesForVS = [] } = variantSampleItem;
                    const matchingFilterBlocksLen = matchingFilterBlockNamesForVS.length;
                    let filterBlocksUsed = null;
                    if (matchingFilterBlocksLen === 0) {
                        // Assumed to be only 1 FilterBlock selected
                        if (selectedFilterBlockIndicesLen !== 1) {
                            throw new Error("Expected only 1 filter block to be used when no `__matching_filter_block_names` present in result.");
                        }
                        filterBlocksUsed = [ filterBlocks[ parseInt(selectedFilterBlockIdxList[0]) ] ];
                    } else {
                        // Compound search was performed, multiple selected filter blocks assumed.
                        // If `selectedFilterBlockIndicesLen` is 0, then all filter blocks are selected.
                        if (selectedFilterBlockIndicesLen === 1) {
                            throw new Error("Expected multiple filter blocks to be selected when `__matching_filter_block_names` is present in result.");
                        }
                        const matchingFilterBlocksDict = object.listToObj(matchingFilterBlockNamesForVS);
                        filterBlocksUsed = filterBlocks.filter(function(fb, fbIdx){
                            return matchingFilterBlocksDict[fbIdx] || false;
                        });
                    }

                    const selection = {
                        "filter_blocks_used": {
                            "filter_blocks": filterBlocksUsed,
                            "intersect_selected_blocks": intersectFilterBlocks
                        },
                        "variant_sample_item": variantSampleAtID // Will become linkTo (embedded)
                        // The below 2 fields are filled in on backend (configured via `serverDefaults` in Item schema for these fields)
                        // "selected_by",
                        // "date_selected"
                    };
                    variantSampleSelectionsList.push(selection);
                });
            }

            /** Convert embedded linkTos into just `@id` strings before PATCHing */
            function createSelectionListPayload(existingSelections){
                // Need to convert embedded linkTos into just @ids before PATCHing -
                return existingSelections.map(function(existingSelection){
                    const {
                        variant_sample_item: { "@id": vsItemID },
                        selected_by: { "@id": selectedByItemID }
                    } = existingSelection;
                    if (!vsItemID) {
                        throw new Error("Expected all variant samples to have an ID -- likely a view permissions issue.");
                    }
                    console.log("FFF", selectedByItemID);
                    return {
                        ...existingSelection,
                        "variant_sample_item": vsItemID,
                        "selected_by": selectedByItemID
                    };
                });
            }

            let requestPromiseChain;


            if (!variantSampleListItem) {
                // Create new Item, then PATCH its @id to `Case.variant_sample_list_id` field.
                const createVSLPayload = {
                    "institution": caseInstitutionID,
                    "project": caseProjectID,
                    "status": "current"
                };

                if (searchType === "VariantSample") {
                    createVSLPayload["variant_samples"] = [];
                    addToSelectionsList(createVSLPayload.variant_samples);
                } else {
                    createVSLPayload["structural_variant_samples"] = [];
                    addToSelectionsList(createVSLPayload.structural_variant_samples);
                }

                if (caseAccession) {
                    createVSLPayload.created_for_case = caseAccession;
                }

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
                const {
                    "@id": vslAtID,
                    variant_samples: existingVariantSampleSelections = [],
                    structural_variant_samples: existingStructuralVariantSampleSelections = []
                } = variantSampleListItem;

                const payload = {};
                // patch existing
                // Need to convert embedded linkTos into just @ids before PATCHing -
                if (searchType === "VariantSample") {
                    payload["variant_samples"] = createSelectionListPayload(existingVariantSampleSelections);
                    // Add in new selections to the existing ones
                    addToSelectionsList(payload["variant_samples"]);
                } else {
                    payload["structural_variant_samples"] = createSelectionListPayload(existingStructuralVariantSampleSelections);
                    // Add in new selections to the existing ones
                    addToSelectionsList(payload["structural_variant_samples"]);
                }

                console.log("payload", payload);

                requestPromiseChain = ajax.promise(vslAtID, "PATCH", {}, JSON.stringify(payload))
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
                    { regularTitle }
                </span>
            </button>
        );
    }
}
