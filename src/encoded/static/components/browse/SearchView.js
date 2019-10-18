'use strict';

import React from 'react';
import memoize from 'memoize-one';
import _ from 'underscore';
import url from 'url';

import { getAbstractTypeForType, getSchemaTypeFromSearchContext } from '@hms-dbmi-bgm/shared-portal-components/es/components/util/schema-transforms';
import { SearchView as CommonSearchView } from '@hms-dbmi-bgm/shared-portal-components/es/components/browse/SearchView';
import { columnExtensionMap } from './columnExtensionMap';
import { Schemas } from './../util';
import { TitleAndSubtitleBeside, PageTitleContainer, TitleAndSubtitleUnder, pageTitleViews, EditingItemPageTitle } from './../PageTitleSection';
import { getSubmissionItemTypes } from './../forms/CGAPSubmissionView';


export default class SearchView extends React.PureComponent {

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
    static filterFacet(facet, currentAction, session){
        // Set in backend or schema for facets which are under development or similar.
        if (facet.hide_from_view) return false;

        // Remove the @type facet while in selection mode.
        if (facet.field === 'type' && currentAction === 'selection') return false;

        // Most of these would only appear if manually entered into browser URL.
        if (facet.field.indexOf('experiments.experiment_sets.') > -1) return false;
        if (facet.field === 'experiment_sets.@type') return false;
        if (facet.field === 'experiment_sets.experimentset_type') return false;

        return true;
    }

    static transformedFacets = memoize(function(href, context, currentAction, session, schemas){

        // Clone/filter list of facets.
        // We may filter out type facet completely at this step,
        // in which case we can return out of func early.
        const facets = _.filter(
            context.facets,
            function(facet){ return SearchView.filterFacet(facet, currentAction, session); }
        );

        // Find facet for '@type'
        const typeFacetIndex = _.findIndex(facets, { 'field' : 'type' });

        if (typeFacetIndex === -1) {
            return facets; // Facet not present, return.
        }

        const hrefQuery = url.parse(href, true).query;
        if (typeof hrefQuery.type === 'string') hrefQuery.type = [hrefQuery.type];

        const itemTypesInSearch = _.without(hrefQuery.type, 'Item');

        if (itemTypesInSearch.length > 0){
            // Keep all terms/leaf-types - backend should already filter down to only valid sub-types through
            // nature of search itself.
            return facets;
        }

        // Avoid modifying in place.
        facets[typeFacetIndex] = _.clone(facets[typeFacetIndex]);

        // Show only base types for when itemTypesInSearch.length === 0 (aka 'type=Item').
        facets[typeFacetIndex].terms = _.filter(facets[typeFacetIndex].terms, function(itemType){
            const parentType = getAbstractTypeForType(itemType.key, schemas);
            return !parentType || parentType === itemType.key;
        });

        return facets;
    });

    /** Filter the `@type` facet options down to abstract types only (if none selected) for Search. */
    transformedFacets(){
        const { href, context, currentAction, session, schemas } = this.props;
        return SearchView.transformedFacets(href, context, currentAction, session, schemas);
    }

    render(){
        // We don't need full screen btn on CGAP as already full width.
        const passProps = _.omit(this.props, 'isFullscreen', 'toggleFullScreen');
        const facets = this.transformedFacets();
        const tableColumnClassName = "results-column col";
        const facetColumnClassName = "facets-column col-auto";
        return (
            <div className="container-wide search-page-outer-container" id="content">
                <CommonSearchView {...passProps} {...{ columnExtensionMap, tableColumnClassName, facetColumnClassName, facets }}
                    termTransformFxn={Schemas.Term.toName} separateSingleTermFacets={false} />
            </div>
        );
    }
}



const SearchViewPageTitle = React.memo(function SearchViewPageTitle(props){
    const { context, href, schemas, currentAction, alerts } = props;

    if (currentAction === "add"){
        // See if any custom PageTitles registered for ItemType/add
        const itemTypes = getSubmissionItemTypes(context, href);
        const FoundTitleComponent = pageTitleViews.lookup({ "@type" : itemTypes }, "add");
        if (FoundTitleComponent){
            return <FoundTitleComponent {...props} />;
        } else {
            return <EditingItemPageTitle {...{ context, schemas, currentAction, alerts }} />;
        }
    }

    if (currentAction === "selection" || currentAction === "multiselect") {
        return (
            <PageTitleContainer alerts={alerts}>
                <TitleAndSubtitleUnder subtitle="Drag and drop Items from this view into other window(s).">
                    Selecting
                </TitleAndSubtitleUnder>
            </PageTitleContainer>
        );
    }

    const thisTypeTitle = getSchemaTypeFromSearchContext(context, schemas);
    const subtitle = thisTypeTitle ? (
        <span><small className="text-300">for</small> { thisTypeTitle }</span>
    ) : null;

    return (
        <PageTitleContainer alerts={alerts} className="container-wide">
            <TitleAndSubtitleBeside subtitle={subtitle}>
                Search
            </TitleAndSubtitleBeside>
        </PageTitleContainer>
    );
});

pageTitleViews.register(SearchViewPageTitle, "Search");
pageTitleViews.register(SearchViewPageTitle, "Search", "selection");
pageTitleViews.register(SearchViewPageTitle, "Search", "add");
