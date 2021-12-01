'use strict';

import React, { useCallback } from 'react';
import PropTypes from 'prop-types';
import _ from 'underscore';
import { get as getSchemas, Term } from './../../util/Schemas';
import { console } from '@hms-dbmi-bgm/shared-portal-components/es/components/util';
import { columnExtensionMap as columnExtensionMapCGAP } from './../../browse/columnExtensionMap';
import { CaseDetailPane } from './../../browse/CaseDetailPane';
import { DetailPaneStateCache } from '@hms-dbmi-bgm/shared-portal-components/es/components/browse/components/DetailPaneStateCache';
import { EmbeddedSearchView } from '@hms-dbmi-bgm/shared-portal-components/es/components/browse/EmbeddedSearchView';


export function EmbeddedItemSearchTable (props){
    const {
        embeddedTableHeader: propEmbeddedTableHeader,
        embeddedTableFooter,
        /** @deprecated in favor of embeddedTableHeader */
        title,
        children,
        facets,
        session, schemas: propSchemas,
        defaultOpenIndices, maxHeight,
        columns, columnExtensionMap,
        // May not be present which prevents VirtualHrefController from navigating upon mount. Useful if want to init with filterSet search or in other place.
        searchHref,
        aboveTableComponent,
        aboveFacetListComponent,
        filterFacetFxn, hideFacets,
        filterColumnFxn, hideColumns,
        renderDetailPane,
        onClearFiltersVirtual,
        isClearFiltersBtnVisible,
        onLoad,
        rowHeight = 90, // Keep in sync w CSS
        openRowHeight = 90,
        tableColumnClassName: propTableColumnClassName,
        facetColumnClassName: propFacetColumnClassName,
        // Used for FacetList / ExtendedDescriptionPopover:
        addToBodyClassList, removeFromBodyClassList
    } = props;

    const schemas = propSchemas || getSchemas() || null; // We might not have this e.g. in placeholders in StaticSections
    const embeddedTableHeader = propEmbeddedTableHeader || title; // Receives props from VirtualHrefController state

    // Unless otherwise defined, set defaults for these classNames (for CGAP) to be `col-auto` + `col`.
    // TODO: Move 'facets-column' and 'results-column' to always be added to these columns in SPC.
    const facetColumnClassName = facets === null ? null
        : propFacetColumnClassName || "facets-column col-auto";

    const tableColumnClassName = facets === null ? undefined // undefined will be overriden by "col-12" or similar.
        : propTableColumnClassName || "results-column col";

    const passProps = {
        facets, columns, columnExtensionMap, searchHref, session,
        schemas, renderDetailPane, defaultOpenIndices, maxHeight,
        rowHeight, openRowHeight,
        onClearFiltersVirtual, isClearFiltersBtnVisible,
        aboveTableComponent, aboveFacetListComponent,
        embeddedTableHeader, embeddedTableFooter,
        addToBodyClassList, removeFromBodyClassList,
        // TODO: belowTableComponent, belowFacetListComponent,
        filterFacetFxn, hideFacets,
        filterColumnFxn, hideColumns,
        onLoad,
        facetColumnClassName, tableColumnClassName,
        "termTransformFxn": Term.toName,
        "separateSingleTermFacets": false,
        "allowPostRequest": true
    };

    return (
        <div className="embedded-search-view-outer-container">
            <EmbeddedSearchView {...passProps} />
            { children }
        </div>
    );
}
EmbeddedItemSearchTable.defaultProps = {
    "columnExtensionMap": columnExtensionMapCGAP,
    "facets" : undefined // Default to those from search response.
};


/**
 * @todo Eventually maybe add UI controls for selecting columns and other things into here.
 */
export const SearchTableTitle = React.memo(function (props) {
    const {
        totalCount,
        href: currentSearchHref,
        externalSearchLinkVisible = true,
        title: propTitle,
        titleSuffix,
        headerElement = 'h3'
    } = props;

    const title = (propTitle && typeof propTitle === 'string') ? propTitle : 'Item';
    const linkText = currentSearchHref && typeof currentSearchHref === 'string' && currentSearchHref.indexOf('/browse/') > -1 ?
        'Open In Browse View' : 'Open In Search View';

    return React.createElement(
        headerElement || 'h3',
        { className: 'tab-section-title' },
        (
            <React.Fragment>
                <span>
                    {typeof totalCount === "number" ? <span className="text-500">{totalCount + " "}</span> : null}
                    {title + (typeof totalCount === "number" && totalCount !== 1 ? "s" : "")}
                    {titleSuffix && typeof titleSuffix === "string" && titleSuffix.length > 0 ? <span className="text-500">{" - " + titleSuffix}</span> : null}
                </span>
                {
                    externalSearchLinkVisible && currentSearchHref ?
                        (
                            <a href={currentSearchHref} className="btn btn-primary pull-right" style={{ marginTop: '-10px' }} data-tip="Run embedded search query in Browse/Search View">
                                <i className="icon icon-fw fas icon-external-link-alt mr-07 align-baseline"></i>
                                {linkText}
                            </a>
                        ) : null
                }
            </React.Fragment>
        ));
});
SearchTableTitle.propTypes = {
    totalCount: PropTypes.number,
    href: PropTypes.string,
    externalSearchLinkVisible: PropTypes.bool,
    title: PropTypes.string,
    titleSuffix: PropTypes.string,
    headerElement: PropTypes.oneOf(['h1', 'h2', 'h3', 'h4', 'h5', 'h6']).isRequired,
};


export function EmbeddedCaseSearchTable (props) {
    return (
        <DetailPaneStateCache>
            <EmbeddedCaseSearchTableDetailPaneProvider {...props} />
        </DetailPaneStateCache>
    );
}

export function EmbeddedCaseSearchTableDetailPaneProvider (props) {
    const {
        detailPaneStateCache,       // Passed from DetailPaneStateCache
        updateDetailPaneStateCache, // Passed from DetailPaneStateCache
        ...passProps
    } = props;

    const renderDetailPane = useCallback(function(result, rowNumber, containerWidth, propsFromTable){
        return <CaseDetailPane { ...propsFromTable } {...{ result, containerWidth, rowNumber, detailPaneStateCache, updateDetailPaneStateCache }} paddingWidth={57} />;
    }, [ detailPaneStateCache ]);

    return <EmbeddedItemSearchTable {...passProps} renderDetailPane={renderDetailPane} />;
}
