'use strict';

import React, { useCallback } from 'react';
import PropTypes from 'prop-types';
import _ from 'underscore';
import { get as getSchemas, Term } from './../../util/Schemas';
import { object, ajax, layout, isServerSide, schemaTransforms, memoizedUrlParse } from '@hms-dbmi-bgm/shared-portal-components/es/components/util';
import { columnExtensionMap as columnExtensionMapCGAP } from './../../browse/columnExtensionMap';
import { CaseDetailPane } from './../../browse/CaseDetailPane';
import { DetailPaneStateCache } from '@hms-dbmi-bgm/shared-portal-components/es/components/browse/components/DetailPaneStateCache';

import { EmbeddedSearchView } from '@hms-dbmi-bgm/shared-portal-components/es/components/browse/EmbeddedSearchView';
//import { transformedFacets } from './../../../browse/SearchView';





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
        facetColumnClassName: propFacetColumnClassName
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
