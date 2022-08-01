'use strict';

import React, { useState, useMemo, useCallback } from 'react';
import _ from 'underscore';
// import url from 'url';
import queryString from 'query-string';
import ReactTooltip from 'react-tooltip';
import OverlayTrigger from 'react-bootstrap/esm/OverlayTrigger';
import Popover from 'react-bootstrap/esm/Popover';
import DropdownButton from 'react-bootstrap/esm/DropdownButton';
import DropdownItem from 'react-bootstrap/esm/DropdownItem';

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
        selectedFilterBlockIdxList = [0],
        selectedFilterBlockIdxCount = 1,
        fetchVariantSampleListItem,
        isLoadingVariantSampleListItem = false,
        searchType = "VariantSample",
        haveCaseEditPermission = false,
        isEditDisabled = false,
        width
    } = props;

    const {
        "@id": caseAtID,
        project: { "@id": caseProjectID } = {},
        institution: { "@id" : caseInstitutionID } = {},
        accession: caseAccession = null,
        variant_sample_list_id: caseVSLAtID
    } = caseItem;

    const [ isPatchingVSL, setIsPatchingVSL ] = useState(false);

    const regularTitle = <React.Fragment><strong>{ selectedVariantSamples.size }</strong> selected variants</React.Fragment>;

    const style = useMemo(function(){
        if (typeof width !== "number") {
            return null;
        }
        return { width };
    }, [ width ]);

    /** PATCH or create new VariantSampleList w. additions */

    if (isLoadingVariantSampleListItem) {
        return (
            <button type="button" className="btn btn-primary" style={style} disabled>
                <span className="d-flex align-items-center">
                    <i className="icon icon-circle-notch icon-spin fas mr-1"/>
                    Loading selections...
                </span>
            </button>
        );
    } else if (isPatchingVSL) {
        return (
            <button type="button" className="btn btn-primary" style={style} disabled>
                <span className="d-flex align-items-center">
                    <i className="icon icon-circle-notch icon-spin fas mr-1"/>
                    Saving selections...
                </span>
            </button>
        );
    } else if (selectedVariantSamples.size === 0) {
        return (
            <button type="button" className="btn btn-primary" style={style} disabled>
                <span>
                    No selected variants
                </span>
            </button>
        );
    } else if (!haveCaseEditPermission) {
        // Primary button style; is possible this Case is public
        return (
            <button type="button" className="btn btn-primary text-truncate" style={style} disabled>
                <span data-tip="No edit permission.">
                    { regularTitle }
                </span>
            </button>
        );
    } else if (isEditDisabled || (!variantSampleListItem && caseVSLAtID)) {
        // Edit disabled for some reason other than lack of edit permission, perhaps an error in FilterSet. Prevent adding.
        // Also disable if no variantSampleListItem (and it not loading) yet an existing VSL is present.
        // Indicates lack of view permission for existing VSL (most likely no edit permission disabled for Case anyways, but permissions may change/differ in future)
        return (
            <button type="button" className="btn btn-danger text-truncate" style={style} disabled>
                <span data-tip="Check for any errors above such as a duplicate filter block name or a change to the contents of a filter block that has been used to add a sample already. Otherwise, check user permissions.">
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


            /** Adds/transforms props.selectedVariantSamples to param `variantSampleSelectionsList` */
            function addToSelectionsList(variantSampleSelectionsList){

                // selectedVariantSamples is type (literal) Map, so param signature is `value, key, map`.
                // These are sorted in order of insertion/selection.
                // See https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Map/forEach
                selectedVariantSamples.forEach(function(variantSampleItem, variantSampleAtID){
                    const { __matching_filter_block_names: matchingFilterBlockNamesForVS = [], uuid: vsUUID } = variantSampleItem;
                    const matchingFilterBlocksLen = matchingFilterBlockNamesForVS.length;
                    let filterBlocksUsed = null;
                    if (matchingFilterBlocksLen === 0) {
                        // Assumed to be only 1 FilterBlock selected
                        if (selectedFilterBlockIdxCount !== 1) {
                            throw new Error("Expected only 1 filter block to be used when no `__matching_filter_block_names` present in result.");
                        }
                        filterBlocksUsed = [ filterBlocks[ parseInt(selectedFilterBlockIdxList[0]) ] ];
                    } else {
                        // Compound search was performed, multiple selected filter blocks assumed.
                        // If `selectedFilterBlockIndicesLen` is 0, then all filter blocks are selected.
                        if (selectedFilterBlockIdxCount === 1) {
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
                        "variant_sample_item": vsUUID // Will become linkTo (embedded)
                        // The below 2 fields are filled in on backend (configured via `serverDefaults` in Item schema for these fields)
                        // "selected_by",
                        // "date_selected"
                    };
                    variantSampleSelectionsList.push(selection);
                });
            }

            let requestPromiseChain;


            if (!variantSampleListItem) {
                // Create new Item, then PATCH its @id to `Case.variant_sample_list_id` field.
                const createVSLPayload = {
                    "institution": caseInstitutionID,
                    "project": caseProjectID,
                    // "status": "current" - can't be POSTed due to restricted_fields permission, is set on back-end via schema 'default'.
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
                const { "@id": vslAtID } = variantSampleListItem;

                const payload = {};
                // Add in new selections to the existing ones
                if (searchType === "VariantSample") {
                    payload["variant_samples"] = [];
                    addToSelectionsList(payload["variant_samples"]);
                } else {
                    payload["structural_variant_samples"] = [];
                    addToSelectionsList(payload["structural_variant_samples"]);
                }

                console.log("payload", payload);

                requestPromiseChain = ajax.promise(vslAtID + "/@@add-selections", "PATCH", {}, JSON.stringify(payload))
                    .then(function(respVSL){
                        console.log('VSL PATCH response', respVSL);
                        const {
                            status,
                            error: vslError
                        } = respVSL;

                        if (status !== "success" || vslError) {
                            throw new Error("Didn't succeed in patching VSL Item; check permissions");
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
                    "message" : error.toString ? error.toString() : JSON.stringify(error),
                    "style" : "danger"
                });
            }).finally(function(){
                setIsPatchingVSL(false);
            });

        };

        return (
            <button type="button" className="btn btn-primary text-truncate" style={style} onClick={onButtonClick}>
                <span>
                    { regularTitle }
                </span>
            </button>
        );
    }
}

export function AddAllResultsToVariantSampleListButton (props) {
    const {
        selectedVariantSamples,
        onSelectVariantSample,
        onResetSelectedVariantSamples,
        totalCount: totalSearchResultsCount = 0,
        requestedCompoundFilterSet,
        savedVariantSampleIDMap
    } = props;

    const [ isLoading, setIsLoading ] = useState(false);

    // const totalSelectableCount = totalSearchResultsCount; // TODO: subtract already-in-VSL ones.
    const selectedCount = selectedVariantSamples.size;

    // const isAllSelected = selectedCount === totalSearchResultsCount && totalSearchResultsCount !== 0;

    /**
     * @todo
     * Currently we save @ids in SPC SelectedItemsController.
     * We could consider switching to UUIDs for performance (shorter strings).
     * But would require some edits on 4DN also.
     */
    const performSearchRequest = useCallback(function(){
        const { global_flags: origGlobalFlags = "" } = requestedCompoundFilterSet || {};
        const globalURLParams = queryString.parse(origGlobalFlags);
        delete globalURLParams.additional_facets;
        globalURLParams.field = "uuid";

        // TODO: Handle technical_review OR project_technical_review.
        // if (intKey === 1) {
        //     globalURLParams.technical_review.call ...
        // }

        // Compound Search endpoint supports only up to limit=1000 for time being.
        // However compound search itself supports limit=all if called with generator=true.
        // Can be changed later probably. Or keep the 1k limit b.c. realistically no one
        // is expected to add 1000 variants to interpretation.
        const compoundSearchRequest = {
            ...requestedCompoundFilterSet,
            "global_flags": queryString.stringify(globalURLParams),
            "limit": 1000
        };

        setIsLoading(true);

        ajax.promise("/compound_search", "POST", {}, JSON.stringify(compoundSearchRequest))
            .then(function(res){
                const { "@graph": resultList } = res || {};
                // Filter out already-in-interpretation variants
                const filteredResultList = resultList.filter(function({ "@id": resultAtID }){
                    return !savedVariantSampleIDMap[resultAtID];
                });
                onSelectVariantSample(filteredResultList, true);
                setIsLoading(false);
            });
    }, [ savedVariantSampleIDMap, requestedCompoundFilterSet ]);

    const onMenuOpen = useCallback(function(e){
        e.stopPropagation();
        setTimeout(ReactTooltip.rebuild, 300);
    });

    /** @param {string} eventKey - Param will be a string always */
    const onOptionSelect = useCallback(function(eventKey, e){
        e.stopPropagation();
        e.preventDefault();
        const intKey = parseInt(eventKey);
        switch (intKey) {
            case 0: // All
            case 1: // w. TechReviews
            case 2: // w. TechReviews excl Recurring Artifacts
                performSearchRequest(intKey);
                break;
            case 3: // Clear
                onResetSelectedVariantSamples();
                break;
        }
    }, [ performSearchRequest ]);

    // Compound Search endpoint supports only up to limit=1000 for time being. See notes above.
    const selectAllDisabled = totalSearchResultsCount > 1000;

    return (
        <DropdownButton className="d-inline-flex" variant="primary" title="Select..."
            disabled={isLoading || totalSearchResultsCount === 0} onClick={onMenuOpen} onSelect={onOptionSelect}>
            <DropdownItem eventKey={0} disabled={selectAllDisabled}>Select All Variants</DropdownItem>
            {/* TODO:
            <DropdownItem eventKey={1} disabled={selectAllDisabled} data-tip="Please wait for all recent Technical Review changes to be indexed (not pending) before selecting this option.">
                Select All Variants with a Technical Review
                <i className="icon icon-exclamation-triangle fas text-secondary ml-08 text-small" />
            </DropdownItem>
            <DropdownItem eventKey={2} disabled={selectAllDisabled} data-tip="Please wait for all recent Technical Review changes to be indexed (not pending) before selecting this option.">
                Select All Variants with a Technical Review, excluding Recurring Artifacts
                <i className="icon icon-exclamation-triangle fas text-secondary ml-08 text-small" />
            </DropdownItem>
            */}
            <DropdownItem eventKey={3} disabled={selectedCount === 0}>Clear Selections</DropdownItem>
        </DropdownButton>
    );
}
