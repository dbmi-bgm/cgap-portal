'use strict';

import React, { useMemo } from 'react';
import queryString from 'query-string';
import moment from 'moment';

import { console, ajax, JWT } from '@hms-dbmi-bgm/shared-portal-components/es/components/util';
import { VirtualHrefController } from '@hms-dbmi-bgm/shared-portal-components/es/components/browse/components/VirtualHrefController';

import { FilteringTableFilterSetUI, FilterSetController } from './FilteringTableFilterSetUI';
import { CaseViewEmbeddedVariantSampleSearchTable } from './CaseViewEmbeddedVariantSampleSearchTable';


/**
 * @todo maybe reuse somewhere
 * // This... more or less should handle "NOT" (!=), where the "!" will be last char of field.
 *
 * @param {*} query1  Query to filter
 * @param {*} query2  Query to filter by
 */
export function filterQueryByQuery(query1, query2){
    if (typeof query1 === "string") {
        query1 = queryString.parse(query1);
    }
    if (typeof query2 === "string") {
        query2 = queryString.parse(query2);
    }

    const filterByDict = Object.keys(query2).reduce(function(m, field){
        m[field] = m[field] || {};
        if (Array.isArray(query2[field])){
            query2[field].forEach(function(v){
                m[field][v] = true;
            });
        } else {
            m[field][query2[field]] = true;
        }
        return m;
    }, { "type" : { "VariantSample" : true } });

    const queryFiltered = Object.keys(query1).reduce(function(m, field){
        const val = query1[field];

        if (typeof filterByDict[field] === "undefined") {
            m[field] = val;
            return m; // include it
        }

        if (!Array.isArray(val)) {
            if (filterByDict[field][val]) {
                return m; // Exclude/skip it.
            }
            m[field] = val;
            return m;
        }

        const nextArr = val.filter(function(v){
            return !filterByDict[field][v];
        });
        if (nextArr.length === 0) {
            // do nothing
        } else if (nextArr.length === 1) {
            // eslint-disable-next-line prefer-destructuring
            m[field] = nextArr[0];
        } else {
            m[field] = nextArr;
        }
        return m;

    }, {});

    return queryFiltered;
}


export const FilteringTab = React.memo(function FilteringTab(props) {
    const {
        context = null,
        windowHeight,
        session = false,
        schemas,
        onCancelSelection,      // Not used -- passed in from SelectedItemsController and would close window.
        onCompleteSelection,    // Not used -- passed in from SelectedItemsController and would send selected items back to parent window.
        selectedItems,          // passed in from SelectedItemsController
        onSelectItem,           // passed in from SelectedItemsController
        onResetSelectedItems,   // passed in from SelectedItemsController
        variantSampleListItem,  // Passed in from VariantSampleListController (index.js, wraps `CaseInfoTabView` via its `getTabObject`)
        updateVariantSampleListID // ^
    } = props;
    const {
        accession: caseAccession,
        initial_search_href_filter_addon = "",
        active_filterset = null,
        additional_variant_sample_facets = []
    } = context || {};

    const {  "@id" : activeFilterSetID = null } = active_filterset || {};

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

    // We include the button for moving stuff to interpretation tab inside FilteringTableFilterSetUI, so pass in selectedItems there.
    const fsuiProps = {
        schemas,
        variantSampleListItem, updateVariantSampleListID,
        selectedItems,
        "caseItem": context
    };

    // Load initial filter set Item via AJAX to ensure we get all @@embedded/calculated fields
    // regardless of how much Case embeds.
    const embeddedTableHeader = activeFilterSetID ? (
        <ajax.FetchedItem atId={activeFilterSetID} fetchedItemPropName="initialFilterSetItem" isFetchingItemPropName="isFetchingInitialFilterSetItem">
            <FilterSetController {...{ searchHrefBase, onResetSelectedItems }} excludeFacets={hideFacets}>
                <FilteringTableFilterSetUI {...fsuiProps} />
            </FilterSetController>
        </ajax.FetchedItem>
    ) : (
        // Possible to-do, depending on data-model future requirements for FilterSet Item (holding off for now):
        // could pass in props.search_type and use initialFilterSetItem.flags[0] instead of using searchHrefBase.
        <FilterSetController {...{ searchHrefBase, onResetSelectedItems }} excludeFacets={hideFacets} initialFilterSetItem={blankFilterSetItem}>
            <FilteringTableFilterSetUI {...fsuiProps} />
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
        selectedItems, onSelectItem, onResetSelectedItems,
        "key": searchTableKey
    };

    return <CaseViewEmbeddedVariantSampleSearchTable {...tableProps} />;
});





// export class SelectedVariantSamplesController extends React.PureComponent {

//     constructor(props){
//         super(props);
//         this.state = {
//             /** This Map will be keyed by VariantSample `@id` and contain as values objects which match schema of `VariantSampleListItem.variant_samples` */
//             "selectedVariantSamples" : new Map()
//         };
//     }

//     // loadVariantSampleListItem(){
//     //     const { variantSampleListItemUUID = null } = this.props;
//     //     if (!variantSampleListItemUUID) return false;

//     //     const requestHref = "/variant-sample-list-items/" + variantSampleListItemUUID;

//     //     const onLoad = (res) => {
//     //         const { "@id": itemID } = res;
//     //         if (!itemID) {
//     //             throw new Error("Couldn't load " + requestHref);
//     //         }
//     //     };

//     //     ajax.load(requestHref, onLoad, "GET", onLoad);
//     // }

//     onResetSelectedVariantSamples(existingVariantSampleSelections = []){
//         this.setState({ "selectedVariantSamples": new Map(existingVariantSampleSelections) });
//     }

//     onSelectVariantSample(variantSample, filterSet){
//         this.setState(function({ selectedVariantSamples: existingSelection }){
//             const selectedVariantSamples = new Map(existingSelection); // Clone so we save new reference.
//             const { "@id": vsID } = variantSample;
//             if (!vsID) throw new Error("Expected VariantSample to have an @id");
//             if (selectedVariantSamples.has(vsID)) {
//                 selectedVariantSamples.delete(vsID);
//             } else {
//                 const { uuid: userid } = JWT.getUserDetails() || {};
//                 selectedVariantSamples.set(vsID, {
//                     // We need to remember to convert this to UUID or @id before POSTing or PATCHing
//                     "variant_sample_item": variantSample,
//                     "filter_blocks_request_at_time_of_selection": JSON.stringify(filterSet),
//                     "date_selected": moment.utc().toISOString(), // May need to be adjusted a little bit here or before patch (i.e. trim off trailing 'Z'?)
//                     userid
//                 });
//             }
//         });
//     }

//     render(){
//         const { children } = this.props;
//         const { selectedVariantSamples } = this.state;

//         // Somewhere down in the hierarchy of these components we'll likely
//         // have a button that POSTs or PATCHes selectedVariantSamples inside a VSListItem
//         const childProps = {
//             selectedVariantSamples,
//             "onResetSelectedVariantSamples": this.onResetSelectedVariantSamples,
//             "onSelectVariantSample": this.onSelectVariantSample
//         };

//         return React.Children.map(children, function(child){
//             if (!React.isValidElement(child)) return child;
//             // TODO if not valid component return child;
//             return React.cloneElement(child, childProps);
//         });
//     }

// }
