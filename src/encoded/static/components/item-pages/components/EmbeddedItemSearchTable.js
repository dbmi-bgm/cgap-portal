'use strict';

import React, { useMemo } from 'react';
import PropTypes from 'prop-types';
import _ from 'underscore';
import url from 'url';
import memoize from 'memoize-one';
import queryString from 'querystring';
import { get as getSchemas, Term } from './../../util/Schemas';
import { object, ajax, layout, isServerSide, schemaTransforms, memoizedUrlParse } from '@hms-dbmi-bgm/shared-portal-components/es/components/util';
import { columnExtensionMap as columnExtensionMapCGAP } from './../../browse/columnExtensionMap';
import { CaseDetailPane } from './../../browse/CaseDetailPane';

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
        searchHref,
        aboveTableComponent,
        aboveFacetListComponent,
        filterFacetFxn, hideFacets,
        filterColumnFxn, hideColumns,
        renderDetailPane,
        onClearFiltersVirtual,
        isClearFiltersBtnVisible,
        onLoad,
        rowHeight = 90 // Keep in sync w CSS
    } = props;

    if (typeof searchHref !== "string") {
        throw new Error("Expected a string 'searchHref'");
    }

    const schemas = propSchemas || getSchemas() || null; // We might not have this e.g. in placeholders in StaticSections
    const embeddedTableHeader = propEmbeddedTableHeader || title; // Receives props from VirtualHrefController state

    const passProps = {
        facets, columns, columnExtensionMap, searchHref, session,
        schemas, renderDetailPane, defaultOpenIndices, maxHeight,
        rowHeight, onClearFiltersVirtual, isClearFiltersBtnVisible,
        aboveTableComponent, aboveFacetListComponent,
        embeddedTableHeader, embeddedTableFooter,
        // TODO: belowTableComponent, belowFacetListComponent,
        filterFacetFxn, hideFacets,
        filterColumnFxn, hideColumns,
        onLoad,
        termTransformFxn: Term.toName,
        separateSingleTermFacets: false,
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

export function EmbeddedCaseSearchTable (props){
    const renderDetailPane = useMemo(function(){
        return function renderCaseDetailPane(result, rowNumber, containerWidth, propsFromTable){
            return <CaseDetailPane {...{ result, containerWidth, rowNumber }} paddingWidth={57} />;
        };
    }, []);
    return (
        <EmbeddedItemSearchTable {...props} renderDetailPane={renderDetailPane} />
    );
}
