'use strict';

import React from 'react';
import PropTypes from 'prop-types';
import memoize from 'memoize-one';
import url from 'url';
import _ from 'underscore';
import { console, searchFilters, isSelectAction, memoizedUrlParse } from '@hms-dbmi-bgm/shared-portal-components/es/components/util';
import { navigate } from './../../util';


/**
 * @todo if needed later (sync w. 4DN) -
 * getDropdownTitleText, onChangeSearchItemType, onToggleVisibility, ...
 */
export class SearchBar extends React.PureComponent{

    static renderHiddenInputsForURIQuery(query){
        return _.flatten(_.map(
            _.pairs(query),
            function(qp){
                if (Array.isArray(qp[1])){
                    return _.map(qp[1], function(queryValue, idx){
                        return <input key={qp[0] + '.' + idx} type="hidden" name={qp[0]} value={queryValue} />;
                    });
                } else {
                    return <input key={qp[0]} type="hidden" name={qp[0]} value={qp[1]} />;
                }
            }
        ));
    }

    static hasInput(typedSearchQuery){
        return (typedSearchQuery && typeof typedSearchQuery === 'string' && typedSearchQuery.length > 0) || false;
    }

    // This used to accept searchItemType (current) also; unsure if it was useful..
    static deriveSearchItemTypeFromContextType(atType = ["Item"]) {
        if (atType.indexOf("Search") > -1) {
            return "within";
        }
        return "all";
    }

    static buildURIQuery(searchItemType, currentAction, hrefParts = {}){
        const query = {};
        if (searchItemType === 'within' || isSelectAction(currentAction)) {  // Preserve filters, incl type facet.
            _.extend(query,
                _.omit(hrefParts.query || {}, 'q')  // Remove 'q' as is provided via the <input name="q" .../> element.
            );
        } else if (searchItemType === 'all') {      // Don't preserve _any_ filters (expsettype=replicates, type=expset, etc.) - reinit with type=Item
            _.extend(query, { 'type': 'Item' });
        } else {
            throw new Error("No valid searchItemType provided");
        }
        return query;
    }

    constructor(props){
        super(props);
        this.onSearchInputChange    = this.onSearchInputChange.bind(this);
        this.onResetSearch          = this.onResetSearch.bind(this);
        this.onSearchInputBlur      = this.onSearchInputBlur.bind(this);

        let initialQuery = '';
        if (props.href){
            initialQuery = searchFilters.searchQueryStringFromHref(props.href) || '';
        }

        this.memoized = {
            buildURIQuery: memoize(SearchBar.buildURIQuery),
            deriveSearchItemTypeFromContextType: memoize(SearchBar.deriveSearchItemTypeFromContextType)
        };

        this.state = {
            //'isVisible'         : false, // Not used atm
            'searchItemType'    : this.memoized.deriveSearchItemTypeFromContextType(props.context['@type']), // Not used atm - theoreitcally later could have "cohorts", "all", "individual", ...
            'typedSearchQuery'  : initialQuery
        };

    }

    componentDidUpdate(pastProps) {
        const { href, currentAction, context } = this.props;
        const { href: pastHref } = pastProps;

        if (pastHref !== href) {
            this.setState(({ isVisible, searchItemType })=>{
                const typedSearchQuery = searchFilters.searchQueryStringFromHref(href) || '';
                return {
                    // We don't want to hide if was already open.
                    //isVisible : isSelectAction(currentAction) || isVisible || SearchBar.hasInput(typedSearchQuery) || false,
                    typedSearchQuery,
                    searchItemType: this.memoized.deriveSearchItemTypeFromContextType(context['@type'])
                };
            });
        }
    }

    getCurrentResultsSearchQuery(hrefParts){
        if (!hrefParts){
            hrefParts = url.parse(this.props.href, true);
        }
        return (hrefParts && hrefParts.query && hrefParts.query.q) || null;
    }

    onSearchInputChange(e){
        const newValue = e.target.value;
        const state = { 'typedSearchQuery' : newValue };
        if (!SearchBar.hasInput(newValue) && this.props.currentAction !== 'selection') {
            state.searchAllItems = false;
        }
        this.setState(state);
    }

    onSearchInputBlur(e){
        const lastQuery = searchFilters.searchQueryStringFromHref(this.props.href);
        if (SearchBar.hasInput(lastQuery) && !SearchBar.hasInput(this.state.typedSearchQuery)) {
            this.setState({ 'typedSearchQuery' : lastQuery });
        }
    }

    onResetSearch (e){
        var hrefParts = url.parse(this.props.href, true);
        if (typeof hrefParts.search === 'string'){
            delete hrefParts.query['q'];
            delete hrefParts.search;
        }
        this.setState(
            { 'searchAllItems' : false, 'typedSearchQuery' : '' },
            navigate.bind(navigate, url.format(hrefParts))
        );
    }

    /*
    selectItemTypeDropdown(visible = false){
        const { currentAction } = this.props;
        const { searchAllItems } = this.state;
        if (isSelectAction(currentAction)) return null;
        return (
            <Fade in={visible} appear>
                <DropdownButton id="search-item-type-selector" bsSize="sm" pullRight
                    onSelect={(eventKey, evt)=>{ this.toggleSearchAllItems(eventKey === 'all' ? true : false); }}
                    title={searchAllItems ? 'All Items' : 'Experiment Sets'}>
                    <DropdownItem eventKey="sets" data-key="sets" active={!searchAllItems}>
                        Experiment Sets
                    </DropdownItem>
                    <DropdownItem eventKey="all" data-key="all" active={searchAllItems}>
                        All Items (advanced)
                    </DropdownItem>
                </DropdownButton>
            </Fade>
        );
    }
    */

    render() {
        const { href, currentAction } = this.props;
        const { typedSearchQuery, searchItemType, isVisible = true } = this.state;

        const hrefParts = memoizedUrlParse(href);

        const searchQueryFromHref = (hrefParts && hrefParts.query && hrefParts.query.q) || '';
        const searchTypeFromHref = (hrefParts && hrefParts.query && hrefParts.query.type) || '';
        const showingCurrentQuery = (searchQueryFromHref && searchQueryFromHref === typedSearchQuery) && (
            (searchTypeFromHref === 'Item' && searchItemType === 'all') || searchItemType === 'within'
        );
        const searchBoxHasInput = SearchBar.hasInput(typedSearchQuery);
        const query = this.memoized.buildURIQuery(searchItemType, currentAction, hrefParts);
        const formClasses = [
            'form-inline',
            'navbar-search-form-container',
            searchQueryFromHref && 'has-query',
            searchBoxHasInput && 'has-input',
            isVisible && "form-is-visible"
        ];

        return ( // Form submission gets serialized and AJAXed via onSubmit handlers in App.js
            <form className={_.filter(formClasses).join(' ')} action="/search/" method="GET">
                <input className="form-control search-query" id="navbar-search" type="search" placeholder="Search"
                    name="q" value={typedSearchQuery} onChange={this.onSearchInputChange} key="search-input" onBlur={this.onSearchInputBlur} />
                { showingCurrentQuery ? <i className="reset-button icon icon-times fas" onClick={this.onResetSearch}/> : null }
                { showingCurrentQuery ? null : (
                    <button type="submit" className="search-icon-button">
                        <i className="icon icon-fw icon-search fas"/>
                    </button>
                ) }
                { SearchBar.renderHiddenInputsForURIQuery(query) }
            </form>
        );
    }
}

