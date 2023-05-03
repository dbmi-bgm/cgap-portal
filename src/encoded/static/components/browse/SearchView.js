'use strict';

import React from 'react';
import memoize from 'memoize-one';
import _ from 'underscore';

import { schemaTransforms, analytics } from '@hms-dbmi-bgm/shared-portal-components/es/components/util';
import { SearchView as CommonSearchView } from '@hms-dbmi-bgm/shared-portal-components/es/components/browse/SearchView';
import { DetailPaneStateCache } from '@hms-dbmi-bgm/shared-portal-components/es/components/browse/components/DetailPaneStateCache';
import { columnExtensionMap } from './columnExtensionMap';
import { CaseDetailPane } from './CaseDetailPane';
import { Schemas } from './../util';
import { PageTitleContainer, TitleAndSubtitleUnder, pageTitleViews, EditingItemPageTitle } from './../PageTitleSection';
import { AboveSearchViewOptions, AboveCaseSearchViewOptions, DashboardTitle, AboveTableControlsBaseCGAP } from './AboveTableControlsBaseCGAP';
import { getSchemaProperty } from '@hms-dbmi-bgm/shared-portal-components/es/components/util/schema-transforms';


export default function SearchView (props){
    const { context: { '@type': searchPageType = ["ItemSearchResults"] } } = props;
    const isCaseSearch = searchPageType[0] === 'CaseSearchResults';

    if (isCaseSearch) {
        return (
            <DetailPaneStateCache>
                <SearchViewBody {...props} {...{ isCaseSearch }} />
            </DetailPaneStateCache>
        );
    }

    return  <SearchViewBody {...props} />;
}


export class SearchViewBody extends React.PureComponent {

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
            return SearchViewBody.filterFacet(facet, currentAction);
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
            transformedFacets : memoize(SearchViewBody.transformedFacets),
            filteredFilters: memoize(SearchViewBody.filteredFilters),
            renderCaseDetailPane: memoize(this.renderCaseDetailPane.bind(this))
        };
    }

    renderCaseDetailPane(result, rowNumber, containerWidth, propsFromTable) {
        const { windowWidth, href, detailPaneStateCache, updateDetailPaneStateCache } = this.props;
        const passProps = { ...propsFromTable, result, windowWidth, href, detailPaneStateCache, updateDetailPaneStateCache, containerWidth, rowNumber };
        return <CaseDetailPane {...passProps} paddingWidth={57} />;
    }

    render(){
        const { isCaseSearch = false, context, currentAction, schemas } = this.props;

        const hideFacets = [];
        let projectSelectEnabled = false;
        let itemType;

        // Wait for schemas to load
        if (schemas) {
            itemType = schemaTransforms.getSchemaTypeFromSearchContext(context, schemas);
            if (!itemType) {
                // Pass "Item" for rendering as title
                itemType = "Item"; }
            else {
                // Determine whether project dropdown should be displayed
                const project = getSchemaProperty("project.display_title", schemas, itemType);
                console.log("project", project);

                if (project) {
                    hideFacets.push('project.display_title');
                    projectSelectEnabled = true;
                }
            }
        }

        // We don't need full screen btn on CGAP as already full width.
        const passProps = _.omit(this.props, 'isFullscreen', 'toggleFullScreen', 'isCaseSearch');

        //const filters = SearchView.filteredFilters(context.filters || []);
        const facets = this.memoized.transformedFacets(context, currentAction, schemas);
        const tableColumnClassName = "results-column col";
        const facetColumnClassName = "facets-column col-auto";

        let aboveTableComponent;
        let searchViewHeader = null;

        if (currentAction === "add" || currentAction === "selection" || currentAction === "multiselect") {
            aboveTableComponent = <AboveTableControlsBaseCGAP />;
        } else if (isCaseSearch) {
            aboveTableComponent = null;
            searchViewHeader = <AboveCaseSearchViewOptions {...passProps} {...{ projectSelectEnabled }}/>;
            hideFacets.concat(["report.uuid", "proband_case"]); // TODO: implement on SPC; Currently doesn't do anything
        } else {
            aboveTableComponent = null;
            searchViewHeader = <AboveSearchViewOptions {...passProps} {...{ itemType, projectSelectEnabled }} />;
        }

        return (
            <div className="search-page-outer-container" id="content">
                <CommonSearchView {...passProps}
                    {...{ columnExtensionMap, tableColumnClassName, facetColumnClassName, facets, aboveTableComponent, searchViewHeader, hideFacets }}
                    renderDetailPane={isCaseSearch ? this.memoized.renderCaseDetailPane : null} termTransformFxn={Schemas.Term.toName}
                    stickyFirstColumn={!!isCaseSearch}
                    separateSingleTermFacets={false} rowHeight={90} openRowHeight={90} />
            </div>
        );
    }
}



const SearchViewPageTitle = React.memo(function SearchViewPageTitle(props){
    const { context, schemas, currentAction, alerts } = props;

    if (currentAction === "add"){
        // Fallback unless any custom PageTitles registered for @type=<ItemType>SearchResults & currentAction=add
        return <EditingItemPageTitle {...{ context, schemas, currentAction, alerts }} />;
    }

    if (currentAction === "selection" || currentAction === "multiselect") {
        return (
            <PageTitleContainer alerts={alerts} className="container-wide">
                <TitleAndSubtitleUnder subtitle="Drag and drop Items from this view into other window(s).">
                    Selecting
                </TitleAndSubtitleUnder>
            </PageTitleContainer>
        );
    }

    const thisTypeTitle = schemaTransforms.getSchemaTypeFromSearchContext(context, schemas);

    return (
        <PageTitleContainer alerts={alerts} className="container-wide px-0">
            <DashboardTitle subtitle={thisTypeTitle}/>
        </PageTitleContainer>
    );
});

pageTitleViews.register(SearchViewPageTitle, "Search");
pageTitleViews.register(SearchViewPageTitle, "Search", "selection");
pageTitleViews.register(SearchViewPageTitle, "Search", "add");
