'use strict';

import React, { useMemo, useCallback } from 'react';
import queryString from 'query-string';

import { console, ajax } from '@hms-dbmi-bgm/shared-portal-components/es/components/util';
import { VirtualHrefController } from '@hms-dbmi-bgm/shared-portal-components/es/components/browse/components/VirtualHrefController';

import { FilteringTableFilterSetUI } from './FilteringTableFilterSetUI';
import { FilterSetController } from './FilteringTableFilterSetUI/FilterSetController';
import { SaveFilterSetButtonController } from './FilteringTableFilterSetUI/SaveFilterSetButton';
import { SaveFilterSetPresetButtonController } from './FilteringTableFilterSetUI/SaveFilterSetPresetButton';
import { CaseViewEmbeddedVariantSampleSearchTable } from './CaseViewEmbeddedVariantSampleSearchTable';
import { Alerts } from '@hms-dbmi-bgm/shared-portal-components/es/components/ui/Alerts';




export const FilteringTab = React.memo(function FilteringTab(props) {
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
        variantSampleListItem,      // Passed in from VariantSampleListController (index.js, wraps `CaseInfoTabView` via its `getTabObject`)
        updateVariantSampleListID,  // Passed in from VariantSampleListController
        savedVariantSampleIDMap,    // Passed in from VariantSampleListController
        fetchVariantSampleListItem, // Passed in from VariantSampleListController
        isLoadingVariantSampleListItem, // Passed in from VariantSampleListController
        setIsSubmitting,            // Passed in from App
        addToBodyClassList,         // Passed in from App
        removeFromBodyClassList     // Passed in from App
    } = props;

    const {
        accession: caseAccession,
        initial_search_href_filter_addon = "",
        active_filterset = null,
        additional_variant_sample_facets = []
    } = context || {};

    const { "@id" : activeFilterSetID = null } = active_filterset || {};

    const searchHrefBase = (
        "/search/?type=VariantSample"
        + (initial_search_href_filter_addon ? "&" + initial_search_href_filter_addon : "")
        + (additional_variant_sample_facets.length > 0 ? "&" + additional_variant_sample_facets.map(function(fac){ return "additional_facet=" + encodeURIComponent(fac); }).join("&") : "")
        + "&sort=date_created"
    );

    // DEPRECATED - we no longer have filter_blocks present initially.
    // const currentActiveFilterAppend = (filter_blocks[0] || {}).query || "";
    // const searchHrefWithCurrentFilter = searchHrefBase + (currentActiveFilterAppend ? "&" + currentActiveFilterAppend : "");

    // Hide facets that are ones used to initially narrow down results to those related to this case.
    const { hideFacets, onClearFiltersVirtual, isClearFiltersBtnVisible, blankFilterSetItem } = useMemo(function(){

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

        let hideFacets = ["type", "validation_errors.name"];
        if (initial_search_href_filter_addon) {
            hideFacets = hideFacets.concat(Object.keys(queryString.parse(initial_search_href_filter_addon)));
        }

        const blankFilterSetItem = {
            "title" : "FilterSet for Case " + caseAccession,
            "created_in_case_accession" : caseAccession,
            "search_type": "VariantSample",
            "filter_blocks" : [
                {
                    "name" : "Filter Block 1",
                    "query" : ""
                }
            ]
        };

        // IMPORTANT:
        // We preserve this, but we DO NOT utilize it in FilterSetController at moment
        // because FilterSet Presets may be re-used for many different Cases.
        // TODO: maybe remove
        if (initial_search_href_filter_addon) {
            blankFilterSetItem.flags = [
                {
                    "name" : "Case:" + caseAccession,
                    "query" : initial_search_href_filter_addon
                }
            ];
        }

        return { hideFacets, onClearFiltersVirtual, isClearFiltersBtnVisible, blankFilterSetItem };
    }, [ context ]);

    // We include the button for moving stuff to interpretation tab inside FilteringTableFilterSetUI, so pass in selectedVariantSamples there.
    const fsuiProps = {
        schemas, session,
        variantSampleListItem,
        updateVariantSampleListID,
        fetchVariantSampleListItem,
        isLoadingVariantSampleListItem,
        selectedVariantSamples,
        // setIsSubmitting,
        // "caseItem": context
    };

    const embeddedTableHeaderBody = (
        <SaveFilterSetButtonController caseItem={context} setIsSubmitting={setIsSubmitting}>
            <SaveFilterSetPresetButtonController>
                <FilteringTableFilterSetUI {...fsuiProps} />
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
        <ajax.FetchedItem atId={activeFilterSetID} fetchedItemPropName="initialFilterSetItem" isFetchingItemPropName="isFetchingInitialFilterSetItem"
            onFail={onFailInitialFilterSetItemLoad}>
            <FilterSetController {...{ searchHrefBase, onResetSelectedVariantSamples }} excludeFacets={hideFacets}>
                { embeddedTableHeaderBody }
            </FilterSetController>
        </ajax.FetchedItem>
    ) : (
        // Possible to-do, depending on data-model future requirements for FilterSet Item (holding off for now):
        // could pass in props.search_type and use initialFilterSetItem.flags[0] instead of using searchHrefBase.
        <FilterSetController {...{ searchHrefBase, onResetSelectedVariantSamples }} excludeFacets={hideFacets} initialFilterSetItem={blankFilterSetItem}>
            { embeddedTableHeaderBody }
        </FilterSetController>
    );


    // This maxHeight is stylistic and dependent on our view design/style
    // wherein we have minHeight of tabs set to close to windowHeight in SCSS.
    // 405px offset likely would need to be changed if we change height of tab nav, tab title area, etc.
    // Overrides default 400px.
    const maxHeight = typeof windowHeight === "number" && windowHeight > 845 ? (windowHeight - 445) : undefined;

    // Table re-initializes upon change of key so we use it refresh table based on session.
    const searchTableKey = "session:" + session;

    const tableProps = {
        hideFacets, maxHeight, session, onClearFiltersVirtual, isClearFiltersBtnVisible, embeddedTableHeader,
        addToBodyClassList, removeFromBodyClassList,
        selectedVariantSamples, onSelectVariantSample,
        savedVariantSampleIDMap, // <- Will be used to make selected+disabled checkboxes
        isLoadingVariantSampleListItem, // <- Used to disable checkboxes if VSL still loading
        "key": searchTableKey
    };

    return <CaseViewEmbeddedVariantSampleSearchTable {...tableProps} />;
});
