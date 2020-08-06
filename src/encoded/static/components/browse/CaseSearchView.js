'use strict';

import React from 'react';
import memoize from 'memoize-one';
import _ from 'underscore';

import DropdownButton from 'react-bootstrap/esm/DropdownButton';
import Modal from 'react-bootstrap/esm/Modal';
import DropdownItem from 'react-bootstrap/esm/DropdownItem';
import { itemUtil } from '@hms-dbmi-bgm/shared-portal-components/es/components/util/object';
import { SearchView as CommonSearchView } from '@hms-dbmi-bgm/shared-portal-components/es/components/browse/SearchView';
import { console, ajax, navigate, object, schemaTransforms } from '@hms-dbmi-bgm/shared-portal-components/es/components/util';
import { Alerts } from '@hms-dbmi-bgm/shared-portal-components/es/components/ui/Alerts';
import { PageTitleContainer, OnlyTitle, TitleAndSubtitleUnder, pageTitleViews } from './../PageTitleSection';
import { basicColumnExtensionMap,
    DisplayTitleColumnWrapper,
    DisplayTitleColumnDefault,
    DisplayTitleColumnUser } from '@hms-dbmi-bgm/shared-portal-components/es/components/browse/components/table-commons';

import { LocalizedTime, formatPublicationDate } from '@hms-dbmi-bgm/shared-portal-components/es/components/ui/LocalizedTime';

import { columnExtensionMap } from './columnExtensionMap';
import { Schemas } from './../util';

import { transformedFacets } from './SearchView';



/**
 * Should move this to CGAP at some point probably
 */
export const DisplayTitleColumnIndividual = React.memo(function DisplayTitleIndividualDefault({ result, link, onClick }) {
    const { display_title, status, individual_id, date_created } = result;

    return (
        <div key="title-container" className="title-block d-flex flex-column" data-tip={tooltip} data-delay-show={750}>
            <div>
                <span className="col-topleft mr-05 text-mono" style={{ fontSize: "13px" }}>
                    { display_title }
                </span>
                <i className="item-status-indicator-dot mr-07" data-status={status}/>
            </div>
            <span className="d-block col-main text-center text-600 text-uppercase" style={{ fontSize: "20px" }}>
                { individual_id }
            </span>
            <span className="d-block col-date text-center">
                <span className="mr-05">Accessioned:</span>
                <LocalizedTime timestamp={date_created} formatType="date-sm" />
            </span>
        </div>
    );
});


const caseColExtensionMap = _.extend({}, columnExtensionMap, {
    'display_title' : {
        'title' : "Title",
        'widthMap' : { 'lg' : 280, 'md' : 250, 'sm' : 200 },
        'minColumnWidth' : 90,
        'order' : -100,
        'render' : function renderDisplayTitleColumn(result, parentProps){
            console.log("display_title renderDisplayTitleColumn", result);
            const { href, context, rowNumber, detailOpen, toggleDetailOpen } = parentProps;
            const { '@type' : itemTypeList = ["Item"] } = result;
            let renderElem;
            if (itemTypeList[0] === "User") {
                renderElem = <DisplayTitleColumnUser {...{ result }}/>;
            } else if (itemTypeList[0] === "Case") {
                renderElem = <DisplayTitleColumnIndividual {...{ result }}/>;
            } else {
                renderElem = <DisplayTitleColumnDefault {...{ result }}/>;
            }
            return (
                <DisplayTitleColumnWrapper {...{ result, href, context, rowNumber, detailOpen, toggleDetailOpen }}>
                    { renderElem }
                </DisplayTitleColumnWrapper>
            );
        }
    },
});

export class CaseSearchView extends React.PureComponent {

    /**
     * Function which is passed into a `.filter()` call to
     * filter context.facets down, usually in response to frontend-state.
     *
     * Currently is meant to filter out type facet if we're in selection mode,
     * as well as some fields from embedded 'experiment_set' which might
     * give unexpected results.
     *
     * @todo Potentially get rid of this and do on backend.
     *
     * @param {{ field: string }} facet - Object representing a facet.
     * @returns {boolean} Whether to keep or discard facet.
     */
    static filterFacet(facet, currentAction){
        // Set in backend or schema for facets which are under development or similar.
        if (facet.hide_from_view) return false;

        // Remove the @type facet while in selection mode.
        if (facet.field === 'type' && currentAction === 'selection') return false;

        return true;
    }

    /** Filter the `@type` facet options down to abstract types only (if none selected) for Search. */
    static transformedFacets(context, currentAction, schemas){

        // Clone/filter list of facets.
        // We may filter out type facet completely at this step,
        // in which case we can return out of func early.
        const facets = context.facets.filter(function(facet){
            return CaseSearchView.filterFacet(facet, currentAction);
        });

        // Find facet for '@type'
        const searchItemTypes = schemaTransforms.getAllSchemaTypesFromSearchContext(context); // "Item" is excluded

        if (searchItemTypes.length > 0) {
            console.info("A (non-'Item') type filter is present. Will skip filtering Item types in Facet.");
            // Keep all terms/leaf-types - backend should already filter down to only valid sub-types through
            // nature of search itself.

            if (searchItemTypes.length > 1) {
                const errMsg = "More than one \"type\" filter is selected. This is intended to not occur, at least as a consequence of interacting with the UI. Perhaps have entered multiple types into URL.";
                analytics.exception("CGAP SearchView - " + errMsg);
                console.warn(errMsg);
            }

            return facets;
        }

        const typeFacetIndex = _.findIndex(facets, { 'field' : 'type' });
        if (typeFacetIndex === -1) {
            console.error("Could not get type facet, though some filter for it is present.");
            return facets; // Facet not present, return.
        }

        // Avoid modifying in place.
        facets[typeFacetIndex] = _.clone(facets[typeFacetIndex]);

        // Show only base types for when itemTypesInSearch.length === 0 (aka 'type=Item').
        facets[typeFacetIndex].terms = _.filter(facets[typeFacetIndex].terms, function(itemType){
            const parentType = schemaTransforms.getAbstractTypeForType(itemType.key, schemas);
            return !parentType || (parentType === itemType.key);
        });

        return facets;
    }

    /** Not currently used. */
    static filteredFilters(filters){
        const typeFilterCount = filters.reduce(function(m, { field }){
            if (field === "type") return m + 1;
            return m;
        }, 0);
        return filters.filter(function({ field, term }){
            if (field === "type") {
                if (term === "Item") {
                    return false;
                }
                if (typeFilterCount === 1) {
                    return false;
                }
            }
            return true;
        });
    }

    constructor(props){
        super(props);
        this.memoized = {
            transformedFacets : memoize(CaseSearchView.transformedFacets),
            filteredFilters: memoize(CaseSearchView.filteredFilters)
        };
    }

    render() {
        // const { isFullscreen, href, context, currentAction, session, schemas } = this.props;
        const passProps = _.omit(this.props, 'isFullscreen', 'toggleFullScreen');
        const { context, currentAction, schemas } = passProps;

        const facets = this.memoized.transformedFacets(context, currentAction, schemas);
        const tableColumnClassName = "results-column col";
        const facetColumnClassName = "facets-column col-auto";
        // let createNewVisible = false;
        // // don't show during submission search "selecting existing"
        // if (context && Array.isArray(context.actions) && !currentAction) {
        //     const addAction = _.findWhere(context.actions, { 'name': 'add' });
        //     if (addAction && typeof addAction.href === 'string') {
        //         createNewVisible = true;
        //     }
        // }
        console.log("facets, ", facets);
        return (
            <div className="container" id="content">
                This is the CaseSearchView
                <CommonSearchView {...this.props} {...{ tableColumnClassName, facetColumnClassName, facets }}
                    termTransformFxn={Schemas.Term.toName} columnExtensionMap={caseColExtensionMap} />
            </div>
        );
    }
}

pageTitleViews.register(CaseSearchView, "CaseSearchResults");