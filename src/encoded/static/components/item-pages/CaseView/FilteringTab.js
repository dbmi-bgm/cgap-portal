'use strict';

import React, { useMemo, useCallback, useState, useRef } from 'react';
import _ from 'underscore';
import queryString from 'query-string';

import { Alerts } from '@hms-dbmi-bgm/shared-portal-components/es/components/ui/Alerts';
import { console, ajax } from '@hms-dbmi-bgm/shared-portal-components/es/components/util';
import { VirtualHrefController } from '@hms-dbmi-bgm/shared-portal-components/es/components/browse/components/VirtualHrefController';
import { SelectedItemsController } from '@hms-dbmi-bgm/shared-portal-components/es/components/browse/components/SelectedItemsController';

import { FilteringTableFilterSetUI } from './FilteringTableFilterSetUI';
import { FilterSetController } from './FilteringTableFilterSetUI/FilterSetController';
import { SaveFilterSetButtonController } from './FilteringTableFilterSetUI/SaveFilterSetButton';
import { SaveFilterSetPresetButtonController } from './FilteringTableFilterSetUI/SaveFilterSetPresetButton';
import { CaseViewEmbeddedVariantSampleSearchTable, CaseViewEmbeddedVariantSampleSearchTableSV } from './CaseViewEmbeddedVariantSampleSearchTable';
import { TechnicalReviewController } from './TechnicalReviewColumn';




const filteringTabViews = {
    // Numbers are cast to string when used as object keys.
    "0": {
        name: "SNV",
        searchType: "VariantSample"
    },
    "1": {
        name: "CNV / SV",
        searchType: "StructuralVariantSample"
    }
};

/**
 * Handles tab switching between the SNV and CNV/SV tabs.
 */
export function FilteringTab(props) {
    const {
        context, windowHeight, session, schemas, isActiveDotRouterTab,
        haveCaseEditPermission, setIsSubmitting, variantSampleListItem, updateVariantSampleListID,
        fetchVariantSampleListItem, isLoadingVariantSampleListItem,
        savedVariantSampleIDMap
    } = props;

    const {
        initial_search_href_filter_addon: snvFilterHrefAddon = null,
        sv_initial_search_href_filter_addon: svFilterHrefAddon = null
    } = context;

    const defaultTabIdx = (!snvFilterHrefAddon && svFilterHrefAddon) ? 1 : 0;
    const [ currViewIdx, setCurrViewIdx ] = useState(defaultTabIdx);

    const commonProps = {
        context, windowHeight, session, schemas, isActiveDotRouterTab,
        haveCaseEditPermission, setIsSubmitting, variantSampleListItem, updateVariantSampleListID,
        fetchVariantSampleListItem, isLoadingVariantSampleListItem,
        savedVariantSampleIDMap
    };

    return (
        <React.Fragment>
            <div className="row flex-column-reverse flex-md-row align-items-center">
                <h1 className="col my-0 text-300">
                    Variant Filtering and Technical Review
                    {/*<i className="icon icon-arrow-right fas icon-xs mx-3"/>*/}
                    &nbsp;&ndash;&nbsp;
                    <span className="text-400">{ filteringTabViews[currViewIdx].name }</span>
                </h1>
                <div className="col-12 col-md-auto my-3 my-md-n3">
                    <FilteringTabTableToggle {...{ currViewIdx, setCurrViewIdx, context }}/>
                </div>
            </div>
            <div id="snv-filtering" className={"mt-36" + (currViewIdx === 0 ? "" : " d-none")}>
                <TechnicalReviewController>
                    <SelectedItemsController isMultiselect>
                        <SNVFilteringTabBody {...commonProps} />
                    </SelectedItemsController>
                </TechnicalReviewController>
            </div>
            <div id="cnvsv-filtering" className={"mt-36" + (currViewIdx === 1 ? "" : " d-none")}>
                <TechnicalReviewController>
                    <SelectedItemsController isMultiselect>
                        <CNVFilteringTabBody {...commonProps} />
                    </SelectedItemsController>
                </TechnicalReviewController>
            </div>
        </React.Fragment>
    );
}


const FilteringTabTableToggle = React.memo(function FilteringTabTableToggle(props) {
    const { context, currViewIdx, setCurrViewIdx } = props;
    const {
        initial_search_href_filter_addon: snvFilterHrefAddon = "",
        sv_initial_search_href_filter_addon: svFilterHrefAddon = "",
        sample_processing: {
            analysis_type = ""
        } = {}
    } = context;

    const onClickSNV = useCallback(function(e){
        setCurrViewIdx(0);
    });

    const onClickCNV = useCallback(function(e){
        setCurrViewIdx(1);
    });

    const options = useMemo(function(){

        // End up getting a list of non-case-specific variants (with duplicates from multiple cases)
        // if these searchHrefAddons aren't present, so important to disable the tab in those instances
        const snvDisabled = !snvFilterHrefAddon;
        const cnvDisabled = !svFilterHrefAddon;

        let cnvTip = null;
        if (analysis_type.startsWith("WES")) {
            cnvTip = "SV/CNV is currently available for only germline WGS data. Additional pipelines are under development.";
        }
        return [
            {
                "onClick": onClickSNV,
                "disabled": snvDisabled,
                "title": <span>{ filteringTabViews["0"].name } Filtering</span>,
            },
            {
                "onClick": onClickCNV,
                "disabled": cnvDisabled,
                "title": <span>{ filteringTabViews["1"].name } Filtering</span>,
                "dataTip": cnvTip
            }
        ];
    }, [ context ]);

    return <InnerTabToggle options={options} activeIdx={currViewIdx} />;
});

/** Pulled out into own component so can style/adjust-if-needed together w. Case Review Tab */
export function InnerTabToggle(props) {
    const {
        activeIdx = 0,
        options = [],
        cardCls = "py-2 px-1 d-flex d-md-inline-flex flex-row",
        btnCls = "px-md-4 px-lg-5"
    } = props;

    const renderedOptions = options.map(function(opt, optIdx){
        const { title, disabled, onClick, dataTip } = opt;
        return (
            <div className="px-1 flex-grow-1" data-tip={dataTip} key={optIdx}>
                <button type="button" {...{ onClick, disabled }} aria-pressed={activeIdx === optIdx}
                    className={"btn btn-" + (activeIdx === optIdx ? "primary-dark active pe-none" : "link") + " " + btnCls}>
                    { title }
                </button>
            </div>
        );
    });
    return (
        <div className={"card " + cardCls}>
            { renderedOptions }
        </div>
    );
}

function createBlankFilterSetItem(searchType, caseAccession){
    return {
        "title" : "FilterSet for Case " + caseAccession,
        "created_in_case_accession" : caseAccession,
        "search_type": searchType,
        "filter_blocks" : [
            {
                "name" : "Filter Block 1",
                "query" : ""
            }
        ],
        // Any FilterSet saved to Case should have "current" or "in review" by default so others in Project can see/edit it as well.
        // It may make sense to upgrade to status=shared or similar for public/knowledgebase data, though.
        // But not any lower than "current", "in review", or "shared to project"
        "status": "current"
    };
}

function SNVFilteringTabBody(props){
    const { context } = props; // context passed in from App (== Case Item)
    const { "0" : { searchType } } = filteringTabViews;

    const { searchHrefBase, blankFilterSetItem, hideFacets } = useMemo(function(){
        const { initial_search_href_filter_addon = "", accession: caseAccession } = context || {};
        const searchHrefBase = (
            "/search/?type=" + searchType
            + (initial_search_href_filter_addon ? "&" + initial_search_href_filter_addon : "")
        );

        const blankFilterSetItem = createBlankFilterSetItem(searchType, caseAccession);

        let hideFacets = ["type", "validation_errors.name"];

        // IMPORTANT:
        // We preserve `blankFilterSetItem.flags`, but we DO NOT utilize it
        // in FilterSetController at moment because FilterSet Presets may be
        // re-used for many different Cases.
        // TODO: maybe remove

        if (initial_search_href_filter_addon) {
            hideFacets = hideFacets.concat(Object.keys(queryString.parse(initial_search_href_filter_addon)));
            blankFilterSetItem.flags = [
                {
                    "name" : "Case:" + caseAccession,
                    "query" : initial_search_href_filter_addon
                }
            ];
        }
        return { searchHrefBase, blankFilterSetItem, hideFacets };
    }, [ context ]); // Don't memoize on `searchType`; it never changes.

    return (
        // TODO: Maybe rename `activeFilterSetFieldName` to `caseActiveFilterSetFieldName`.. idk.
        <FilteringTabBody {...props} {...{ searchHrefBase, hideFacets, blankFilterSetItem, searchType }}
            activeFilterSetFieldName="active_filterset">
            <CaseViewEmbeddedVariantSampleSearchTable />
        </FilteringTabBody>
    );
}

function CNVFilteringTabBody(props){
    const { context } = props; // context passed in from App (== Case Item)
    const { "1" : { searchType } } = filteringTabViews;

    const { searchHrefBase, blankFilterSetItem, hideFacets } = useMemo(function(){
        const { sv_initial_search_href_filter_addon = "", accession: caseAccession } = context || {};
        const searchHrefBase = (
            "/search/?type=" + searchType
            + (sv_initial_search_href_filter_addon ? "&" + sv_initial_search_href_filter_addon : "")
        );

        const blankFilterSetItem = createBlankFilterSetItem(searchType, caseAccession);

        let hideFacets = ["type", "validation_errors.name"];

        // IMPORTANT:
        // We preserve `blankFilterSetItem.flags`, but we DO NOT utilize it
        // in FilterSetController at moment because FilterSet Presets may be
        // re-used for many different Cases.
        // TODO: maybe remove

        if (sv_initial_search_href_filter_addon) {
            hideFacets = hideFacets.concat(Object.keys(queryString.parse(sv_initial_search_href_filter_addon)));
            blankFilterSetItem.flags = [
                {
                    "name" : "Case:" + caseAccession,
                    "query" : sv_initial_search_href_filter_addon
                }
            ];
        }
        return { searchHrefBase, blankFilterSetItem, hideFacets };
    }, [ context ]); // Don't memoize on `searchType`; it never changes.

    return (
        <FilteringTabBody {...props} {...{ searchHrefBase, hideFacets, blankFilterSetItem, searchType }}
            activeFilterSetFieldName="active_filterset_sv">
            <CaseViewEmbeddedVariantSampleSearchTableSV />
        </FilteringTabBody>
    );
}


function FilteringTabBody(props) {
    const {
        context = null,             // Passed in from App (== Case Item)
        session = false,            // Passed in from App (todo: figure out permissions; might some Cases be publicly accessible, e.g. as demos?)
        schemas,                    // Passed in from App
        windowHeight,               // Passed in from App
        windowWidth,                // Passed in from App
        onCancelSelection,          // Not used -- passed in from SelectedItemsController and would close window.
        onCompleteSelection,        // Not used -- passed in from SelectedItemsController and would send selected items back to parent window.
        selectedItems: selectedVariantSamples,                  // passed in from SelectedItemsController
        onSelectItem: onSelectVariantSample,                    // passed in from SelectedItemsController
        onResetSelectedItems: onResetSelectedVariantSamples,    // passed in from SelectedItemsController
        lastSavedTechnicalReview,           // passed in from TechnicalReviewController
        cacheSavedTechnicalReviewForVSUUID, // passed in from TechnicalReviewController
        unsavedTechnicalReviewNoteTexts,    // passed in from TechnicalReviewController
        cacheUnsavedTechnicalReviewNoteTextForVSUUID, // passed in from TechnicalReviewController
        resetLastSavedTechnicalReview, // passed in from TechnicalReviewController
        variantSampleListItem,      // Passed in from VariantSampleListController (index.js, wraps `CaseInfoTabView` via its `getTabObject`)
        updateVariantSampleListID,  // Passed in from VariantSampleListController
        savedVariantSampleIDMap,    // Passed in from VariantSampleListController
        fetchVariantSampleListItem, // Passed in from VariantSampleListController
        isLoadingVariantSampleListItem, // Passed in from VariantSampleListController
        setIsSubmitting,            // Passed in from App
        addToBodyClassList,         // Passed in from App
        removeFromBodyClassList,    // Passed in from App
        searchHrefBase: parentSearchHrefBase,   // Passed in from SNVFilteringTabBody or CNVFilteringTabBody
        children,                               // Passed in from SNVFilteringTabBody or CNVFilteringTabBody
        hideFacets,                             // Passed in from SNVFilteringTabBody or CNVFilteringTabBody
        blankFilterSetItem,                     // Passed in from SNVFilteringTabBody or CNVFilteringTabBody
        activeFilterSetFieldName,               // Passed in from SNVFilteringTabBody or CNVFilteringTabBody
        searchType,                             // Passed in from SNVFilteringTabBody or CNVFilteringTabBody
        haveCaseEditPermission = false,         // Passed in from CaseView/CaseInfoTabView
        isActiveDotRouterTab = false            // Passed in from CaseView/DotRouter
    } = props;

    // TODO:
    // `additional_variant_sample_facets` IS POSSIBLY ONLY APPLICABLE ONLY TO
    // SNV VariantSamples. We probably need to create+use different
    // one for CNV/SV?
    const {
        additional_variant_sample_facets = [],
        [activeFilterSetFieldName]: { "@id": activeFilterSetID = null } = {}
    } = context || {};

    const searchHrefBase = (
        parentSearchHrefBase
        + (additional_variant_sample_facets.length > 0 ? "&" + additional_variant_sample_facets.map(function(fac){ return "additional_facet=" + encodeURIComponent(fac); }).join("&") : "")
        + "&sort=date_created"
    );

    // DEPRECATED - we no longer have filter_blocks present initially.
    // const currentActiveFilterAppend = (filter_blocks[0] || {}).query || "";
    // const searchHrefWithCurrentFilter = searchHrefBase + (currentActiveFilterAppend ? "&" + currentActiveFilterAppend : "");

    // Hide facets that are ones used to initially narrow down results to those related to this case.
    const { onClearFiltersVirtual, isClearFiltersBtnVisible } = useMemo(function(){

        const onClearFiltersVirtual = function(virtualNavigateFxn, callback) {
            // By default, EmbeddedSearchItemView will reset to props.searchHref.
            // We override with searchHrefBase.
            return virtualNavigateFxn(searchHrefBase, {}, callback);
        };

        const isClearFiltersBtnVisible = function(virtualHref){
            // Re-use same algo for determining if is visible, but compare virtualhref
            // against searchHrefBase (without the current filter(s)) rather than
            // `props.searchHref` which contains the current filters.
            return VirtualHrefController.isClearFiltersBtnVisible(virtualHref, searchHrefBase);
        };

        return { onClearFiltersVirtual, isClearFiltersBtnVisible };
    }, [ context ]);

    const filterSetControllerRef = useRef(null);

    // We include the button for moving stuff to interpretation tab inside FilteringTableFilterSetUI, so pass in selectedVariantSamples there.
    const fsuiProps = {
        schemas, session,
        variantSampleListItem,
        updateVariantSampleListID,
        fetchVariantSampleListItem,
        isLoadingVariantSampleListItem,
        selectedVariantSamples,
        isActiveDotRouterTab,
        lastSavedTechnicalReview,
        // haveCaseEditPermission,
        // setIsSubmitting,
        // "caseItem": context
    };

    const fsControllerProps = {
        searchHrefBase, searchType,
        onResetSelectedVariantSamples,
        resetLastSavedTechnicalReview,
        "excludeFacets": hideFacets,
        "ref": filterSetControllerRef
    };

    const embeddedTableHeaderBody = (
        <SaveFilterSetButtonController {...{ setIsSubmitting, activeFilterSetFieldName, haveCaseEditPermission }} caseItem={context}>
            <SaveFilterSetPresetButtonController>
                <FilteringTableFilterSetUI {...fsuiProps} {...{ searchType }} />
            </SaveFilterSetPresetButtonController>
        </SaveFilterSetButtonController>
    );

    const onFailInitialFilterSetItemLoad = useCallback(function(){
        if (session) {
            // todo add sentry.io call here.
            Alerts.queue({
                "title": "FilterSet not loaded",
                "message": `Couldn't load the existing saved FilterSet selections Item "${activeFilterSetID}", check permissions.`,
                "style" : "warning",
                "navigationDissappearThreshold": 1
            });
        }
        // Else nothing -- is expected; perhaps user got logged out during
        // navigation or loading something else and hasn't refreshed page yet.
    }, [ session ]);

    // Load initial filter set Item via AJAX to ensure we get all @@embedded/calculated fields
    // regardless of how much Case embeds.
    const embeddedTableHeader = activeFilterSetID ? (
        <ajax.FetchedItem atId={activeFilterSetID + "?datastore=database"} fetchedItemPropName="initialFilterSetItem" isFetchingItemPropName="isFetchingInitialFilterSetItem"
            onFail={onFailInitialFilterSetItemLoad}>
            <FilterSetController {...fsControllerProps}>
                { embeddedTableHeaderBody }
            </FilterSetController>
        </ajax.FetchedItem>
    ) : (
        // Possible to-do, depending on data-model future requirements for FilterSet Item could use initialFilterSetItem.flags[0] instead of using searchHrefBase.
        <FilterSetController {...fsControllerProps} initialFilterSetItem={blankFilterSetItem}>
            { embeddedTableHeaderBody }
        </FilterSetController>
    );

    // Not an ideal practice/pattern, avoid if possible:
    const { current: filterSetControllerInstance } = filterSetControllerRef;
    const currFilterSet = filterSetControllerInstance ? filterSetControllerInstance.state.currFilterSet : null;


    // This maxHeight is stylistic and dependent on our view design/style
    // wherein we have minHeight of tabs set to close to windowHeight in SCSS.
    const maxHeight = typeof windowHeight === "number" && windowHeight > 845 ? (windowHeight - 142) : undefined;

    // Table re-initializes upon change of key so we use it refresh table based on session.
    const searchTableKey = "session:" + session;

    const tableProps = {
        hideFacets, maxHeight, session, onClearFiltersVirtual, isClearFiltersBtnVisible, embeddedTableHeader,
        addToBodyClassList, removeFromBodyClassList,
        selectedVariantSamples, onSelectVariantSample,
        savedVariantSampleIDMap,            // <- Will be used to make selected+disabled checkboxes
        isLoadingVariantSampleListItem,     // <- Used to disable checkboxes if VSL still loading
        currFilterSet,                      // <- Used for Matching Filter Block Indices column
        lastSavedTechnicalReview,           // <- Used for TechnicalReviewColumn
        cacheSavedTechnicalReviewForVSUUID, // <- Used for TechnicalReviewColumn
        unsavedTechnicalReviewNoteTexts,    // <- Used for TechnicalReviewColumn
        cacheUnsavedTechnicalReviewNoteTextForVSUUID, // <- Used for TechnicalReviewColumn
        haveCaseEditPermission,             // <- Used for TechnicalReviewColumn
        "key": searchTableKey
    };

    if (Array.isArray(children)) {
        throw new Error("Expected single React Component (EmbeddedSearchView or a composed component eventually returning EmbeddedSearchView)");
    }

    return React.cloneElement(children, tableProps);
}

