'use strict';

import React, { useState, useMemo } from 'react';
import _ from 'underscore';
import url from 'url';
import queryString from 'query-string';

import { console, layout, navigate, ajax } from '@hms-dbmi-bgm/shared-portal-components/es/components/util';
import { Alerts } from '@hms-dbmi-bgm/shared-portal-components/es/components/ui/Alerts';
import { LocalizedTime } from '@hms-dbmi-bgm/shared-portal-components/es/components/ui/LocalizedTime';

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
    const searchHrefAppend = (
        initial_search_href_filter_addon +
        (initial_search_href_filter_addon && currentActiveFilterAppend ? "&" + currentActiveFilterAppend : "")
    );

    const initialSearchHref = "/search/?type=VariantSample" + (searchHrefAppend ? "&" + searchHrefAppend : "");
    // Hide facets that are ones used to initially narrow down results to those related to this case.
    const hideFacets = !initial_search_href_filter_addon ? null : Object.keys(queryString.parse(initial_search_href_filter_addon));

    // This maxHeight is stylistic and dependent on our view design/style
    // wherein we have minHeight of tabs set to close to windowHeight in SCSS.
    // 405px offset likely would need to be changed if we change height of tab nav, tab title area, etc.
    // Overrides default 400px.
    const maxHeight = typeof windowHeight === "number" && windowHeight > 845 ? (windowHeight - 445) : undefined;

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
        active_filterset = null,
        project: {
            "@id" : caseProjectID
        },
        institution: {
            "@id" : caseInstitutionID
        }
    } = caseItem;
    const {
        "@id" : activeFilterSetID,
        display_title: activeFilterSetTitle,
        filter_blocks = []
    } = active_filterset || {};

    const currentActiveFilterAppend = (filter_blocks[0] || {}).query || "";

    const [ isLoading, setIsLoading ] = useState(false);
    // From `state.lastFilterSetSaved` we use only `date_created` so doesn't matter if frame=object vs frame=page for it.
    // `undefined` means not ever set or removed previously vs `null` means explicitly nothing set in current session.
    const [ lastFilterSetSaved, setLastFilterSetSaved ] = useState(active_filterset || undefined);

    const { differsFromCurrentFilterSet, filterSetQueryStr, saveNewFilterset, saveFilterBtnTip } = useMemo(function(){
        const { query: currentQuery } = url.parse(searchHref, false);
        const parsedCurrentQueryFiltered = filterQueryByQuery(currentQuery, "type=VariantSample&" + initial_search_href_filter_addon);
        const filterSetQueryStr = queryString.stringify(parsedCurrentQueryFiltered);
        const differsFromCurrentFilterSet = (
            (!active_filterset && filterSetQueryStr) ||
            (active_filterset && !filterSetQueryStr) ||
            (active_filterset && filterSetQueryStr && !_.isEqual(parsedCurrentQueryFiltered, queryString.parse(currentActiveFilterAppend)))
        );

        function saveNewFilterset(e){

            // Hmm maybe should redo as promises/use the promisequeue..

            function patchCaseItem(newFilterSetItem = null){
                const patchBody = {};
                if (newFilterSetItem) {
                    patchBody.active_filterset = newFilterSetItem.uuid;
                }
                console.log("Setting 'active_filterset'", patchBody, newFilterSetItem);
                ajax.load(caseAtID + (newFilterSetItem ? "" : "?delete_fields=active_filterset"), function(res){
                    console.info("PATCHed Case Item", res);
                    setIsLoading(false);
                    setLastFilterSetSaved(newFilterSetItem);
                }, "PATCH", function(err){
                    console.error("Error PATCHing Case", err);
                    Alerts.queue({
                        "title" : "Error PATCHing Case",
                        "message" : JSON.stringify(err),
                        "style" : "danger"
                    });
                    setIsLoading(false);
                }, JSON.stringify(patchBody));
            }

            function createFilterSet(callback){
                // TODO: Filter out initial_search_href_filter_addon
                // If no filter, skip and just set Case `active_filterset` field to none.
                const newFilterSetItem = {
                    "title": "FilterSet Created For Case " + caseAccession,
                    "search_type": "VariantSample",
                    "institution": caseInstitutionID,
                    "project": caseProjectID,
                    "created_in_case_accession": caseAccession,
                    "filter_blocks": [
                        {
                            "name": "Primary",
                            "query": filterSetQueryStr,
                            // "flags_applied" : "case:" + caseAccession ? idk
                        }
                    ]
                };
                ajax.load("/filter-sets/", function(res){
                    const { "@graph" : [ newFilterSetItem ] } = res;
                    callback(newFilterSetItem);
                }, "POST", function(err){
                    console.error("Error POSTing new FilterSet", err);
                    Alerts.queue({
                        "title" : "Error POSTing new FilterSet",
                        "message" : JSON.stringify(err),
                        "style" : "danger"
                    });
                    setIsLoading(false);
                }, JSON.stringify(newFilterSetItem));
            }

            setIsLoading(true);
            if (!filterSetQueryStr) { // Falsy, e.g. "".
                patchCaseItem(null);
            } else {
                createFilterSet(patchCaseItem);
            }
        }

        const saveFilterBtnTip = "<pre class='text-white mb-0'>" + JSON.stringify(parsedCurrentQueryFiltered, null, 4) + "</pre>";

        return { filterSetQueryStr, differsFromCurrentFilterSet, saveNewFilterset, saveFilterBtnTip };
    }, [ caseItem, searchHref ]);

    // console.log('TESTING', filterSetQueryStr, differsFromCurrentFilterSet);

    let btnPrepend = null;
    if (typeof lastFilterSetSaved !== "undefined") {
        if (lastFilterSetSaved === null) {
            btnPrepend = (
                <div className="input-group-prepend">
                    <div className="input-group-text">Removed</div>
                </div>
            );
        } else {
            // This will eventually likely be turned into tooltip or something on FilterSet blocks UI.
            const { display_title: fsTitle, date_created: fsCreated } = lastFilterSetSaved;
            btnPrepend = (
                <div className="input-group-prepend">
                    <div className="input-group-text" data-tip={fsTitle}>
                        Saved
                        &nbsp;<LocalizedTime timestamp={fsCreated} formatType="date-time-lg" />
                    </div>
                </div>
            );
        }
    }

    // We give the span here an 'id' here so later on it'd be easy to find using Cypress
    // or other testing framework.
    return (
        <div className="d-flex flex-column flex-lg-row mt-1 mb-2 align-items-start justify-content-between">
            <h5 className="text-300 mt-0 mb-0">
                <span id="filtering-variants-found" className="text-400 mr-05">{ totalCount || 0 }</span>
                Variants found
            </h5>
            <h5 className="text-300 mt-0 mb-0">
                <div className="btn-group" role="group" aria-label="FilterSet Controls">
                    { btnPrepend }
                    <button type="button" className="btn btn-primary" data-current-query={filterSetQueryStr} data-html
                        disabled={!differsFromCurrentFilterSet || isLoading} onClick={saveNewFilterset} data-tip={saveFilterBtnTip}>
                        { isLoading ?
                            <i className="icon icon-fw icon-spin icon-circle-notch fas mr-07" />
                            : <i className="icon icon-fw icon-save fas mr-07" /> }
                        { active_filterset && !filterSetQueryStr ?  "Save Filter Removal" : "Save Current Filter" }
                    </button>
                </div>
            </h5>
        </div>
    );
}
