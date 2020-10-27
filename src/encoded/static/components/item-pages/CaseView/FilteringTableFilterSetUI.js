'use strict';

import React, { useState, useMemo } from 'react';
import PropTypes from 'prop-types';
import _ from 'underscore';
import url from 'url';
import queryString from 'query-string';
import memoize from 'memoize-one';
import ReactTooltip from 'react-tooltip';

import Collapse from "react-bootstrap/esm/Collapse";

import { console, layout, navigate, ajax, itemUtil } from '@hms-dbmi-bgm/shared-portal-components/es/components/util';
import { Alerts } from '@hms-dbmi-bgm/shared-portal-components/es/components/ui/Alerts';
import { LocalizedTime } from '@hms-dbmi-bgm/shared-portal-components/es/components/ui/LocalizedTime';
import { getSchemaProperty } from '@hms-dbmi-bgm/shared-portal-components/es/components/util/schema-transforms';

import { EmbeddedItemSearchTable } from '../components/EmbeddedItemSearchTable';
import { DisplayTitleColumnWrapper, DisplayTitleColumnDefault } from '@hms-dbmi-bgm/shared-portal-components/es/components/browse/components/table-commons';
import { AboveTableControlsBase } from '@hms-dbmi-bgm/shared-portal-components/es/components/browse/components/above-table-controls/AboveTableControlsBase';
import { VirtualHrefController } from '@hms-dbmi-bgm/shared-portal-components/es/components/browse/components/VirtualHrefController';

import { get as getSchemas } from './../../util/Schemas';
import { Schemas } from '../../util';


/**
 * @todo Maybe will be renamed if resuable
 * @todo
 *      Maybe check if new caseItem.active_filterset then update state.lastSavedFilterSet via getDerivedStateFromProps or componentDidUpdate or something
 *      Not relevant for long time until/unless maybe entire Case gets refreshed re: websockets or something...
 */
export class FilteringTableFilterSetUI extends React.PureComponent {

    /**
     * @todo Move into own func?
     * @param {{ field, ... }[]} facets List of objects containing facet info from which we extract just certain non-dynamic fields into a cached dictionary of facet/field info.
     * @param {string[]} excludeFacets - List of field names to be excluded from this UI.
     * @returns {Object.<string, { field: string, title: string, description: string, grouping: string, order: number, aggregation_type: string, field_type: string, EXCLUDED: boolean }>} Dictionary of facet/field-info from schemas+response.
     */
    static buildFacetDictionary(facets = null, excludeFacets = null){
        if (!Array.isArray(facets)) return {};
        const excluded = {};
        if (Array.isArray(excludeFacets)) {
            excludeFacets.forEach(function(fieldName){
                excluded[fieldName] = true;
            });
        }

        const dict = {};
        facets.forEach(function(facetFields){
            const {
                field,
                title, description,
                grouping, order,
                aggregation_type, field_type
            } = facetFields;
            // We might get duplicate for some reason, leave first since more likely to have title.
            if (dict[field]) {
                return;
            }
            dict[field] = {
                field, title, description,
                grouping, order,
                aggregation_type, field_type,
                EXCLUDED: excluded[field] || false
            };
        });
        return dict;
    }

    static hasFilterSetChanged(savedFilterSet = null, currFilterSet = null) {
        if (!savedFilterSet && currFilterSet) {
            return true;
        }

        // Turns out this works good -
        return !_.isEqual(savedFilterSet, currFilterSet);
    }

    /**
     * Validation - find any duplicates.
     * Not super performant calculation but we only usually have < 10 blocks so should be ok.
     */
    static findDuplicateBlocks(filter_blocks){
        const duplicateQueryIndices = {};
        const duplicateNameIndices = {};

        filter_blocks.forEach(function({ name, query }, idx){
            var i;
            for (i = 0; i < idx; i++) {
                if (filter_blocks[i].name === name) {
                    duplicateNameIndices[idx] = i; // idx gets converted to str here, self-reminder to parseInt(key) out if need to compare against it.
                    break;
                }
            }
            for (i = 0; i < idx; i++) {
                if (_.isEqual(queryString.parse(filter_blocks[i].query), queryString.parse(query))) {
                    duplicateQueryIndices[idx] = i; // idx gets converted to str here, self-reminder to parseInt(key) out if need to compare against it.
                    break;
                }
            }
        });

        return { duplicateQueryIndices, duplicateNameIndices };
    }

    constructor(props){
        super(props);
        const { caseItem } = props;
        const { active_filterset = null } = caseItem;
        this.toggleOpen = _.throttle(this.toggleOpen.bind(this), 750);

        this.memoized = {
            buildFacetDictionary: memoize(FilteringTableFilterSetUI.buildFacetDictionary, function(newArgs, lastArgs){
                const [ nextFacets ] = newArgs;
                const [ lastFacets ] = lastArgs;
                // In this component we only want the titles and aggregation_types of facets, not their aggregations,
                // so we recalculate only if we never calculated them before.
                if (!lastFacets && nextFacets) {
                    return false;
                }
                return true;
            }),
            hasFilterSetChanged: memoize(FilteringTableFilterSetUI.hasFilterSetChanged),
            findDuplicateBlocks: memoize(FilteringTableFilterSetUI.findDuplicateBlocks)
        };

        this.state = {
            "bodyOpen": false,
            "bodyMounted": false, // Is set to true for 750ms after closing to help keep contents visible until collapsed.
            "lastSavedFilterSet" : active_filterset
        };
    }

    componentDidUpdate({ currFilterSet: pastFilterSet }){
        const { currFilterSet } = this.props;
        if (pastFilterSet !== currFilterSet) {
            ReactTooltip.rebuild();
        }
    }

    toggleOpen(evt){
        evt.stopPropagation();
        evt.preventDefault();
        this.setState(function({ bodyOpen: exstOpen, reallyOpen }){
            const bodyOpen = !exstOpen;
            return { bodyOpen, bodyMounted: true };
        }, () => {
            const { bodyOpen } = this.state;
            if (!bodyOpen) {
                setTimeout(()=>{
                    this.setState({ bodyMounted: false });
                }, 700);
            }
        });
    }


    render(){
        const {
            // From EmbeddedSearchView:
            context: searchContext, // Current Search Response (not that of this filterSet, necessarily)
            hiddenColumns, addHiddenColumn, removeHiddenColumn, columnDefinitions,

            // From FilteringTab:
            caseItem: {
                display_title: caseTitle = null,
            } = {},
            excludeFacets = [],

            // From FilterSetController:
            currFilterSet: filterSet = null,
            cachedCounts = {},
            addNewFilterBlock, selectedFilterBlockIdx, selectFilterBlockIdx, removeFilterBlockAtIdx, setNameOfFilterBlockAtIdx
        } = this.props;
        const { total: totalCount, facets = null } = searchContext || {};
        const {
            '@id': filterSetID,
            filter_blocks = [],
            error: fsError = null,
            title: fsTitle = null
        } = filterSet || {};
        const { bodyOpen, bodyMounted, lastSavedFilterSet } = this.state;

        // Only updates if facets is not null since we don't care about aggregated counts from search response.
        const facetDict = this.memoized.buildFacetDictionary(facets, excludeFacets);
        const hasFilterSetChanged = this.memoized.hasFilterSetChanged(lastSavedFilterSet, filterSet);
        const { duplicateQueryIndices, duplicateNameIndices } = this.memoized.findDuplicateBlocks(filter_blocks);

        // Too long:
        // const headerTitle = (
        //     fsTitle ? (caseTitle ? caseTitle + " - " : "") + fsTitle
        //         : null // Todo: some fallback maybe
        // );


        console.log(
            'FILTERSETUIPROPS',
            this.props,
            hasFilterSetChanged,
            cachedCounts
        );

        let body = null;
        if (bodyMounted) {
            const bodyProps = {
                filterSet, facetDict, excludeFacets, searchContext,
                addNewFilterBlock, selectedFilterBlockIdx, selectFilterBlockIdx, removeFilterBlockAtIdx, setNameOfFilterBlockAtIdx,
                cachedCounts, duplicateQueryIndices, duplicateNameIndices
            };
            body =  <FilterSetUIBlocks {...bodyProps} />;
        }

        return (
            // TODO Refactor/simplify AboveTableControlsBase to not need nor use `panelMap` (needless complexity / never had use for it)
            <div className="above-variantsample-table-ui">
                <div className="filterset-outer-container rounded">
                    <FilterSetUIHeader {...{ filterSet, bodyOpen }} toggleOpen={this.toggleOpen} />
                    <Collapse in={bodyOpen}>
                        <div className="filterset-blocks-container">
                            { body }
                        </div>
                    </Collapse>
                </div>
                <AboveTableControlsBase {...{ hiddenColumns, addHiddenColumn, removeHiddenColumn, columnDefinitions }}
                    panelMap={AboveTableControlsBase.getCustomColumnSelectorPanelMapDefinition(this.props)}>
                    <h4 className="text-400 col my-0">
                        <span className="text-600">{ totalCount }</span> Variant Matches
                    </h4>
                </AboveTableControlsBase>
            </div>
        );
    }

}

function FilterSetUIHeader({ filterSet, toggleOpen, bodyOpen }){
    const {
        '@id': filterSetID,
        error: fsError = null,
        title: fsTitle = null,
        display_title: fsDisplayTitle = null
    } = filterSet || {};

    let title = fsTitle || fsDisplayTitle;

    if (fsError && !filterSetID) {
        // No view permission
        return (
            <div className="px-3 py-3">
                <h4 className="text-400 my-0">
                    <span>Error: <em>{ fsError }</em></span>
                </h4>
            </div>
        );
    }

    if (!filterSet) {
        // Might not be an issue if later in FilterSetController we init a temp empty 1.
        // Update: Currently not an issue, will remove soon/later..
        title = <em>Not Yet Created</em>;
    }

    return (
        <div className="row align-items-center px-3 py-3">
            <div className="col">
                <h4 className="text-400 clickable my-0" onClick={toggleOpen}>
                    <i className={"small icon icon-fw fas mr-07 icon-" + (bodyOpen ? "minus" : "plus")} />
                    { title }
                </h4>
            </div>
            <div className="col-auto">
                if edit permission(?): [ Save Button etc. ] [ Sum Active(?) Filters ]
            </div>
        </div>
    );
}

/** Renders the Blocks */

const FilterSetUIBlocks = React.memo(function FilterSetUIBlocks(props){
    const {
        filterSet, facetDict,
        addNewFilterBlock, selectedFilterBlockIdx, selectFilterBlockIdx, removeFilterBlockAtIdx, setNameOfFilterBlockAtIdx,
        cachedCounts, duplicateQueryIndices, duplicateNameIndices } = props;
    const {
        "@id" : filterSetID,
        filter_blocks = []
    } = filterSet || {};

    if (filter_blocks.length === 0) {
        return (
            <div className="py-3 px-2">
                <h4>No Blocks Defined</h4>
            </div>
        );
    }

    function onAddBtnClick(e){
        e.stopPropagation();
        // Todo: consider passing in new filterblock definition
        // that has query set to current search URL (minus ~`hideFacets`?)
        addNewFilterBlock();
    }

    const commonProps = { facetDict, selectFilterBlockIdx, removeFilterBlockAtIdx, setNameOfFilterBlockAtIdx, duplicateQueryIndices, duplicateNameIndices, cachedCounts };

    return (
        <div className="blocks-container px-3 pb-16">
            { filter_blocks.map(function(fb, index){
                const selected = selectedFilterBlockIdx !== null && selectedFilterBlockIdx === index;
                return <FilterBlock {...commonProps} filterBlock={fb} index={index} key={index} selected={selected} />;
            }) }
            <button type="button" className="btn btn-primary-dark" onClick={onAddBtnClick}>Add New Filter Block</button>
        </div>
    );
});


const FilterBlock = React.memo(function FilterBlock(props){
    const {
        index,
        filterBlock,
        filter_blocks,
        selected = false,
        // searchContext,
        removeFilterBlockAtIdx,
        setNameOfFilterBlockAtIdx,
        selectFilterBlockIdx,
        facetDict,
        duplicateQueryIndices,
        duplicateNameIndices,
        cachedCounts
    } = props;

    const {
        query: filterStrQuery,
        name: filterName
    } = filterBlock;

    const isDuplicateQuery = typeof duplicateQueryIndices[index] === "number";
    const isDuplicateName = typeof duplicateNameIndices[index] === "number";

    const [ isEditingTitle, setIsEditingTitle ] = useState(false);

    function onRemoveClick(e){
        e.stopPropagation();
        if (filterStrQuery && !isDuplicateQuery) {
            const confirmation = window.confirm("Are you sure you want to delete this filter block? It still has some values.");
            if (!confirmation) return false;
        }
        removeFilterBlockAtIdx(index);
    }

    function onSelectClick(e){
        e.stopPropagation();
        e.preventDefault();
        selectFilterBlockIdx(index);
    }


    let title = null;
    if (isEditingTitle) {
        title = (
            <form className="d-flex align-items-center mb-0" action="#case-info.filtering" onSubmit={function(e){
                e.stopPropagation();
                e.preventDefault();
                setIsEditingTitle(false);
                const formElem = e.target;
                const inputElem = formElem.children[0];
                setNameOfFilterBlockAtIdx(index, inputElem.value);
            }}>
                <input type="text" name="filterName" className="form-control" defaultValue={filterName} />
                <button type="reset" className="btn btn-sm btn-outline-dark ml-08" onClick={function(e){
                    e.stopPropagation();
                    e.preventDefault();
                    setIsEditingTitle(false);
                }}>
                    <i className="icon icon-fw icon-times fas" />
                </button>
                <button type="submit" className="btn btn-sm btn-outline-success ml-08"><i className="icon icon-fw icon-check fas" /></button>
            </form>
        );
    } else {
        const titleCls = isDuplicateName ? "text-danger"
            : !filterName ? "text-secondary"
                : "";

        title = (
            <React.Fragment>
                <i className="icon icon-times-circle fas mr-1 clickable" onClick={onRemoveClick} />
                <span className={titleCls} data-tip={isDuplicateName ? "Duplicate title of filter block #" + (duplicateNameIndices[index] + 1) : null}>
                    { filterName || <em>No Name</em> }
                </span>
                <i className="icon icon-pencil-alt fas ml-1 clickable" onClick={function(){ setIsEditingTitle(true); }} />
            </React.Fragment>
        );
    }

    return (
        <div className={"filterset-block clickable mb-16" + (selected ? " selected" : "") + (!isEditingTitle ? " clickable" : "")}
            onClick={!isEditingTitle ? onSelectClick : null} data-duplicate-query={isDuplicateQuery} data-tip={isDuplicateQuery ? "Duplicate query of filter block #" + (duplicateQueryIndices[index] + 1) : null}>
            <div className="row px-2 py-1 title-controls-row">
                <div className="col">
                    { title }
                </div>
                <div className="col-auto">
                    { cachedCounts[index] }
                </div>
            </div>
            <FieldBlocks {...{ filterBlock, facetDict }} />
        </div>
    );
});

const FieldBlocks = React.memo(function FieldBlocks({ filterBlock, facetDict }) {
    const { query: filterStrQuery } = filterBlock;

    // Taken from SPC/RangeFacet
    function formatRangeVal(field, rangeVal){
        const fieldFacet = facetDict[field];
        const { field_type } = fieldFacet;

        if (field_type === "date") {
            return <LocalizedTime timestamp={value} localize={false} />;
        }
        if (field_type === "number"){
            rangeVal = parseFloat(rangeVal);
        }

        let valToShow = Schemas.Term.toName(field, rangeVal, false);
        if (typeof valToShow === "number") {
            const absVal = Math.abs(valToShow);
            if (absVal.toString().length <= 7){
                // Else is too long and will go thru toPrecision or toExponential.
                if (absVal >= 1000) {
                    valToShow = decorateNumberWithCommas(valToShow);
                } else {
                    // keep valToShow
                }
            } else {
                valToShow = valToShow.toExponential(3);
            }
        } // else is assumed to be valid JSX already
        return valToShow;
    }

    const origQs = queryString.parse(filterStrQuery);
    const qs = {};
    Object.keys(origQs).forEach(function(k){

        // Standardize vals into arrays (w. len 1 if needed).
        let v = origQs[k];
        if (!Array.isArray(v)) {
            v = [v];
        }

        // Remove .from or .to if needed, confirm aggregation_type === stats, and transform/merge values
        let field = k;
        let removedRangeFacetAppendage = false;
        if (k.slice(-5) === ".from"){
            field = k.slice(0, -5);
            if (!facetDict[field] || typeof facetDict[field].aggregation_type !== "string"){
                field = k;
                console.error("Attempted to remove 'from' from field but couldn't succeed", field, facetDict);
            } else {
                removedRangeFacetAppendage = true;
                v = v.map(function(rangeVal, i){
                    return <span key={i}><i className="icon icon-fw icon-greater-than-equal fas"/>{ formatRangeVal(field, rangeVal) }</span>;
                });
            }

        } else if (k.slice(-3) === ".to") {
            field = k.slice(0, -3);
            if (!facetDict[field] || typeof facetDict[field].aggregation_type !== "string"){
                field = k;
                console.error("Attempted to remove 'to' from field but couldn't succeed", field, facetDict);
            } else {
                removedRangeFacetAppendage = true;
                v = v.map(function(rangeVal, i){
                    return <span key={i}><i className="icon icon-fw icon-less-than-equal fas"/>{ formatRangeVal(field, rangeVal) }</span>;
                });
            }
        }

        if (!removedRangeFacetAppendage) {
            // If not range facet, transform vals to proper names.
            v = v.map(function(termVal){
                return Schemas.Term.toName(field, termVal);
            });
        }

        // Merge, e.g. if a from and a to
        if (typeof qs[field] !== "undefined") {
            qs[field] = qs[field].concat(v);
        } else {
            qs[field] = v;
        }
    });

    const fields = Object.keys(qs);
    const blocks = fields.sort(function(fA, fB){
        // Sort keys by schema.facet.order, if any.
        const fsA = facetDict[fA];
        const fsB = facetDict[fB];
        if (fsA && !fsB) return -1;
        if (!fsA && fsB) return 1;
        if (!fsA && !fsB) return 0;
        return (fsA.order || 10000) - (fsB.order || 10000);
    }).map(function(field, index){
        return <FieldBlock terms={qs[field]} field={field} key={field} facetDict={facetDict} />;
    });

    return (
        <div className="d-flex flex-wrap filter-query-viz-blocks px-2">
            { blocks }
        </div>
    );
});

function FieldBlock({ field, terms, facetDict, index }){

    const fieldFacet = facetDict[field];
    const {
        title: facetTitle = null,
        description: facetDescription = null,
        aggregation_type = "terms"
    } = fieldFacet || {};


    // if (aggregation_type === "stats") {
    //     // TODO: Show single > or < or something.
    // }

    const fieldSchema = getSchemaProperty(field, Schemas.get(), "VariantSample");
    const {
        // Used primarily as fallback, we expect/hope for fieldFacet to be present/used primarily instead.
        title: fieldTitle = null,
        description: fieldDescription = null
    } = fieldSchema || {};

    const title = facetTitle || fieldTitle || field;

    const valueBlocks = terms.map(function(val, idx){
        return (
            <div className="value-block" key={idx}>
                { val }
            </div>
        );
    });

    return (
        <div className="field-block py-1">
            <div className="value-blocks d-flex flex-wrap">
                { valueBlocks }
            </div>
            <div className="field-name">
                <em>{ title }</em>
            </div>
        </div>
    );
}

/**
 * Meant to be used to wrap a FilteringTableFilterSetUI
 *
 * @todo
 * This will eventually replace some of logic in FilteringTab.js > FilteringTabSubtitle
 * While other stuff (calculation of if changed vs current search response filters etc)
 * will be in FilterSetUIBlocks or its children.
 */
export class FilterSetController extends React.PureComponent {

    static propTypes = {
        "initialFilterSetItem" : PropTypes.shape({
            "@id" : PropTypes.string, // Is required if originally existed, else free to be null.
            "uuid" : PropTypes.string, // Is required if originally existed, else free to be null.
            "title" : PropTypes.string.isRequired,
            "search_type" : PropTypes.oneOf(["VariantSample", "Variant", "Case"]),
            "filter_blocks" : PropTypes.arrayOf(PropTypes.shape({
                "query" : PropTypes.string,
                "name" : PropTypes.string.isRequired
            }))
        }),
        "children" : PropTypes.element.isRequired,
        "excludeFacets" : PropTypes.arrayOf(PropTypes.string),
        "context" : PropTypes.shape({
            "filters" : PropTypes.arrayOf(PropTypes.shape({
                "field" : PropTypes.string.isRequired,
                "term" : PropTypes.string.isRequired
            }))
        }),
        "searchHrefBase" : PropTypes.string.isRequired
    };

    static defaultProps = {
        "searchHrefBase" : "/search/?type=VariantSample&sort=date_created",
        "excludeFacets" : ["type"]
        // Might be needed for future for like 'create new' button, but likely to be defined elsewhere maybe (outside of this component)
        // "blankFilterSetItem" : {
        //     "title" : "New FilterSet",
        //     "search_type": "VariantSample",
        //     "filter_blocks" : [
        //         { "query" : "" }
        //     ]
        // }
    };

    /**
     * Update state.currFilterSet.filter_blocks[selectedFilterBlockIdx].query from search response if needed.
     *
     * @todo Maybe move to componentDidUpdate or something...
     */
    static getDerivedStateFromProps(props, state) {
        const { context: searchContext, excludeFacets } = props;
        const { currFilterSet, selectedFilterBlockIdx, isSettingFilterBlockIdx, cachedCounts: lastCachedCounts } = state;
        if (!searchContext){
            // Don't update from blank.
            return null;
        }
        if (selectedFilterBlockIdx === null || isSettingFilterBlockIdx){
            return null;
        }

        const { filters: ctxFilters = [], total: totalCount } = searchContext || {};

        // Get counts to show (todo: maybe prefetch these later on)
        const nextCachedCounts = { ...lastCachedCounts };
        nextCachedCounts[selectedFilterBlockIdx] = totalCount;

        const currFilterBlock = currFilterSet.filter_blocks[selectedFilterBlockIdx];
        const { query: filterStrQuery } = currFilterBlock;
        const filterBlockQuery = queryString.parse(filterStrQuery);

        const excludedFieldMap = {};
        if (Array.isArray(excludeFacets)) {
            excludeFacets.forEach(function(field){
                excludedFieldMap[field] = true;
            });
        }

        const searchFilters = ctxFilters.filter(function({ field, term }){
            let fieldName = field;
            if (field.slice(-1) === "!") fieldName = field.slice(0, -1);
            if (excludedFieldMap[fieldName]) return false;
            return true;
        });

        const extraCtxFilters = searchFilters.filter(function({ field, term }){
            if (filterBlockQuery[field]) {
                if (!Array.isArray(filterBlockQuery[field])) {
                    if (filterBlockQuery[field] === term) {
                        delete filterBlockQuery[field];
                        return false;
                    }
                } else {
                    for (var i = 0; i < filterBlockQuery[field].length; i++){
                        if (filterBlockQuery[field][i] === term){
                            filterBlockQuery[field].splice(i, 1);
                            if (filterBlockQuery[field].length === 1) {
                                filterBlockQuery[field] = filterBlockQuery[field][0];
                            }
                            return false;
                        }
                    }
                }
            }
            return true;
        });

        if (extraCtxFilters.length === 0 && Object.keys(filterBlockQuery).length === 0) {
            // No changes to query
            return { "cachedCounts": nextCachedCounts };
        }

        const searchFiltersQuery = {}; // = new URLSearchParams() - might be nice to use this but not 100% of browser/node/url-in-package-lock.json issues.
        searchFilters.forEach(function({ field, term }){
            if (Array.isArray(searchFiltersQuery[field])) {
                searchFiltersQuery[field].push(term);
            } else if (typeof searchFiltersQuery[field] !== "undefined") {
                searchFiltersQuery[field] = [ searchFiltersQuery[field], term ];
            } else {
                searchFiltersQuery[field] = term;
            }
        });
        const nextQuery = queryString.stringify(searchFiltersQuery).replaceAll("%20", "+");
        const nextCurrFilterSet = { ...currFilterSet };
        nextCurrFilterSet.filter_blocks = nextCurrFilterSet.filter_blocks.slice();
        nextCurrFilterSet.filter_blocks[selectedFilterBlockIdx] = {
            ...nextCurrFilterSet.filter_blocks[selectedFilterBlockIdx],
            "query" : nextQuery
        };


        return { "currFilterSet": nextCurrFilterSet, "cachedCounts": nextCachedCounts };
    }

    constructor(props) {
        super(props);
        this.addNewFilterBlock = _.throttle(this.addNewFilterBlock.bind(this), 750, { trailing: false });
        this.selectFilterBlockIdx = _.throttle(this.selectFilterBlockIdx.bind(this), 1500, { trailing: false });
        this.removeFilterBlockAtIdx = this.removeFilterBlockAtIdx.bind(this);
        this.setNameOfFilterBlockAtIdx = this.setNameOfFilterBlockAtIdx.bind(this);
        const { initialFilterSetItem } = this.props;
        const { "@id" : fsID } = initialFilterSetItem;

        this.state = {
            "currFilterSet" : { ...initialFilterSetItem },
            // todo: maybe change to allow multiple in future?
            "selectedFilterBlockIdx" : 0, // null,
            "isSettingFilterBlockIdx" : false,
            "cachedCounts" : {} // Using indices as keys here, but keeping as object (keys are strings)
            // "lastSavedFilterSet" : fsID ? initialFilterSetItem : null // might move elsewhere to like FilterSetUIBlocks
        };
    }

    // Maybe todo (depending on if can realistically occur): componentDidUpdate { if initialFilterSetItem changed, reset state }

    addNewFilterBlock(newFilterBlock = null, cb){
        this.setState(function({ currFilterSet: pastFS }){
            const { filter_blocks = [] } = pastFS;
            const nextFB = filter_blocks.slice();
            let { name, query } = newFilterBlock || {};
            if (!name) {
                // Generate new name
                const highestAutoCount = nextFB.reduce(function(m, { name = "" }){
                    const match = name.match(/^(New Filter Block )(\d+)/);
                    if (!match || !match[2]) return m;
                    return Math.max(m, parseInt(match[2]));
                }, 0);
                name = "New Filter Block " + (highestAutoCount + 1);
            }
            if (!query) {
                query = "";
            }
            nextFB.push({ name, query });
            return {
                "currFilterSet": {
                    ...pastFS,
                    "filter_blocks" : nextFB
                },
                "selectedFilterBlockIdx" : nextFB.length - 1
            };
        }, cb);
    }

    removeFilterBlockAtIdx(idx, cb){
        this.setState(function({ currFilterSet: pastFS, selectedFilterBlockIdx }){
            const { filter_blocks = [] } = pastFS;
            const nextFB = filter_blocks.slice();
            nextFB.splice(idx, 1);

            if (selectedFilterBlockIdx !== null) {
                // Unset or shift it down if needed
                if (selectedFilterBlockIdx === idx) {
                    selectedFilterBlockIdx = null;
                } else if (selectedFilterBlockIdx > idx) {
                    selectedFilterBlockIdx = selectedFilterBlockIdx - 1;
                }
            }
            return {
                "currFilterSet": {
                    ...pastFS,
                    "filter_blocks" : nextFB
                },
                selectedFilterBlockIdx
            };
        }, cb);
    }

    setNameOfFilterBlockAtIdx(idx, newName, cb){
        this.setState(function({ currFilterSet: pastFS }){
            const { filter_blocks = [] } = pastFS;
            const nextFB = filter_blocks.slice();
            const nextBlock = { ...nextFB[idx] };
            nextBlock.name = newName;
            nextFB[idx] = nextBlock;
            return {
                "currFilterSet": {
                    ...pastFS,
                    "filter_blocks" : nextFB
                }
            };
        }, cb);
    }

    selectFilterBlockIdx(index = null){
        this.setState(function({ selectedFilterBlockIdx: pastIdx, isSettingFilterBlockIdx }){
            if (isSettingFilterBlockIdx) return; // Another update in progress already.
            if (index !== null && pastIdx === index) {
                // Clear it.
                return {
                    "selectedFilterBlockIdx" : null,
                    "isSettingFilterBlockIdx" : false
                };
            }
            return {
                "selectedFilterBlockIdx" : index,
                "isSettingFilterBlockIdx" : true
            };
        }, () => {
            const { navigate: virtualNavigate, searchHrefBase, context: searchContext } = this.props; // props.navigate passed down in from SPC EmbeddedSearchView VirtualHrefController
            const { selectedFilterBlockIdx, currFilterSet } = this.state;
            if (selectedFilterBlockIdx === null) {
                // Didn't set an index - todo: use POST / combo search
                return;
            }

            const { "@id": currHref = null } = searchContext || {};
            const currFilterSetQuery = currFilterSet.filter_blocks[selectedFilterBlockIdx].query;
            const nextSearchHref = searchHrefBase + "&" + currFilterSetQuery;

            // Compares full hrefs, incl searchHrefBase params
            const haveSearchParamsChanged = !currHref || !_.isEqual(url.parse(nextSearchHref, true).query, url.parse(currHref, true).query);

            if (haveSearchParamsChanged) {
                virtualNavigate(nextSearchHref, null, (res)=>{
                    this.setState({ "isSettingFilterBlockIdx": false });
                });
            } else {
                this.setState({ "isSettingFilterBlockIdx": false });
            }
        });
    }

    render(){
        const {
            children,
            initialFilterSetItem,
            ...remainingProps
        } = this.props;
        const { currFilterSet, selectedFilterBlockIdx, cachedCounts, isSettingFilterBlockIdx } = this.state;
        const passProps = { // TODO
            ...remainingProps,
            currFilterSet,
            selectedFilterBlockIdx,
            isSettingFilterBlockIdx,
            cachedCounts,
            addNewFilterBlock: this.addNewFilterBlock,
            removeFilterBlockAtIdx: this.removeFilterBlockAtIdx,
            selectFilterBlockIdx: this.selectFilterBlockIdx,
            setNameOfFilterBlockAtIdx: this.setNameOfFilterBlockAtIdx
        };

        console.log('FilterSetController Props', this.props);

        return React.Children.map(children, (child)=>{
            if (!React.isValidElement(child)) { // String or something
                return child;
            }
            if (typeof child.type === "string") { // Normal element (a, div, etc)
                return child;
            }
            return React.cloneElement(child, passProps);
        });
    }

}
