'use strict';

import React, { useState, useMemo } from 'react';
import _ from 'underscore';
import url from 'url';
import queryString from 'query-string';

import { console, layout, navigate, ajax } from '@hms-dbmi-bgm/shared-portal-components/es/components/util';

import { EmbeddedItemSearchTable } from '../components/EmbeddedItemSearchTable';



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
    const { context = null, windowHeight, session = false } = props;
    const {
        display_title: caseDisplayTitle,
        initial_search_href_filter_addon = "",
        active_filterset: {
            "@id" : activeFilterSetID,
            display_title: activeFilterSetTitle,
            filter_blocks = []
        } = {}
    } = context || {};

    // TODO POST request w multiple of these filter_blocks, for now just first 1 is populated and used.
    const currentActiveFilterAppend = (filter_blocks[0] || {}).query || "";
    const searchHrefAppend = initial_search_href_filter_addon + currentActiveFilterAppend;
    const initialSearchHref = "/search/?type=VariantSample" + (searchHrefAppend ? "&" + searchHrefAppend : "");
    // Hide facets that are ones used to initially narrow down results to those related to this case.
    const hideFacets = !initial_search_href_filter_addon ? null : Object.keys(queryString.parse(initial_search_href_filter_addon));

    // This maxHeight is stylistic and dependent on our view design/style
    // wherein we have minHeight of tabs set to close to windowHeight in SCSS.
    // 405px offset likely would need to be changed if we change height of tab nav, tab title area, etc.
    // Overrides default 400px.
    const maxHeight = typeof windowHeight === "number" && windowHeight > 800 ? (windowHeight - 435) : undefined;

    return (
        <React.Fragment>
            <h1 className="mb-0 mt-0">
                { caseDisplayTitle }: <span className="text-300">Variant Filtering and Technical Review</span>
            </h1>
            <EmbeddedItemSearchTable { ...{ hideFacets, maxHeight, session }} searchHref={initialSearchHref} title={
                <FilteringTabSubtitle caseItem={context} />
            } key={"session:" + session} />
        </React.Fragment>
    );
});

/** Inherits props from EmbeddedItemSearchTable -> EmbeddedSearchView -> VirtualHrefController */
export function FilteringTabSubtitle(props){
    const {
        totalCount,
        context: searchContext,
        href: searchHref,
        caseItem
    } = props;
    const {
        "@id" : caseAtID,
        accession: caseAccession = null,
        initial_search_href_filter_addon = "",
        active_filterset = null
    } = caseItem;
    const {
        "@id" : activeFilterSetID,
        display_title: activeFilterSetTitle,
        filter_blocks = []
    } = active_filterset || {};

    const currentActiveFilterAppend = (filter_blocks[0] || {}).query || "";

    const [ isLoading, setIsLoading ] = useState(false);

    const { differsFromCurrentFilterSet, filterSetQueryStr, saveNewFilterset } = useMemo(function(){
        const { query: currentQuery } = url.parse(searchHref, false);
        const parsedCurrentQueryFiltered = filterQueryByQuery("type=VariantSample&" + currentQuery, initial_search_href_filter_addon);
        const filterSetQueryStr = queryString.stringify(parsedCurrentQueryFiltered);
        const differsFromCurrentFilterSet = (
            (!active_filterset && filterSetQueryStr) ||
            (filterSetQueryStr && active_filterset && _.isEqual(parsedCurrentQueryFiltered, queryString.parse(currentActiveFilterAppend)))
        );

        function saveNewFilterset(e){

            // Hmm maybe should redo as promises/use the promisequeue..

            function patchCaseItem(filterSetItemCreated = null){
                console.log("Setting 'active_filterset'", filterSetItemCreated);
                const patchBody = {};
                if (filterSetItemCreated) {
                    patchBody.active_filterset = filterSetItemCreated.uuid;
                }
                ajax.load(caseAtID + (filterSetItemCreated ? "" : "?delete_fields=active_filterset"), function(res){
                    console.info("PATCHed Case Item", res);
                    setIsLoading(false);
                }, "PATCH", function(err){
                    console.error("Error POSTing new FilterSet", err);
                    setIsLoading(false);
                }, JSON.stringify(patchBody));
            }

            function createFilterSet(callback){
                // TODO: Filter out initial_search_href_filter_addon
                // If no filter, skip and just set Case `active_filterset` field to none.
                const newFilterSetItem = {
                    "title" : "FilterSet Created For Case " + caseAccession,
                    "search_type" : "VariantSample",
                    "filter_blocks" : [
                        {
                            "name" : "Primary",
                            "query" : filterSetQueryStr,
                            // "flags_applied" : "case:" + caseAccession ? idk
                        }
                    ]
                };
                setIsLoading(true);
                ajax.load("/filter-sets/", callback, "POST", function(err){
                    console.error("Error POSTing new FilterSet", err);
                    setIsLoading(false);
                }, JSON.stringify(newFilterSetItem));
            }

            if (!filterSetQueryStr) { // Falsy, e.g. "".
                patchCaseItem(null);
            } else {
                createFilterSet(patchCaseItem);
            }
        }

        // Probably temporary; relying on order of filters being same (might not be true)
        //const saveFilterSetButtonDisabled = filterSetQueryStr ===

        return { filterSetQueryStr, differsFromCurrentFilterSet, saveNewFilterset };
    }, [ caseItem, searchHref ]);

    // We give the span here an 'id' here so later on it'd be easy to find using Cypress
    // or other testing framework.
    return (
        <React.Fragment>
            <div className="d-flex flex-column flex-lg-row mb-2 align-items-start align-items-lg-center justify-content-between">
                <h5 className="text-300 mt-0 mb-0">
                    <span id="filtering-variants-found" className="text-400 mr-05">{ totalCount || 0 }</span>
                    Variants found
                </h5>
                <h5 className="text-300 mt-0 mb-0">
                    {/* <div className="btn-group" role="group" aria-label="Basic example"> */}
                    <button type="button" className="btn btn-primary" data-current-query={filterSetQueryStr}
                        disabled={!differsFromCurrentFilterSet} onClick={saveNewFilterset}>
                        { isLoading ? <i className="icon icon-spin icon-circle-notch fas mr-07" /> : null }
                        Save Current Filter
                    </button>
                    <a href={searchHref} className="btn btn-primary ml-05" data-tip="Advanced Search">
                        <i className="icon icon-search fas"/>
                    </a>
                    {/* </div> */}
                </h5>
            </div>
        </React.Fragment>
    );
}
