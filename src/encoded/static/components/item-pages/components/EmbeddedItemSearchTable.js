'use strict';

import React from 'react';
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






export class EmbeddedItemSearchTable extends React.PureComponent {

    static defaultProps = {
        "columnExtensionMap": columnExtensionMapCGAP,
        "facets" : undefined // Default to those from search response.
    };

    constructor(props){
        super(props);
        this.getCountCallback = this.getCountCallback.bind(this);
        this.getCorrectDetailPane = this.getCorrectDetailPane.bind(this);
        this.state = { totalCount: null };
    }

    getCountCallback(resp){
        const { onLoad } = this.props;
        if (resp && typeof resp.total === 'number'){
            this.setState({ 'totalCount' : resp.total });
        }
        if (typeof onLoad === "function") {
            onLoad(resp);
        }
    }

    getCorrectDetailPane() {
        const { renderDetailPane, context = null } = this.props;
        const { '@type' : [ itemType = 'Item'] = [] } = context || {};
        const isCaseSearch = itemType === 'Case' ? true : false;

        if (isCaseSearch) {
            return function renderCaseDetailPane(result, rowNumber, containerWidth, propsFromTable) {
                const passProps = _.pick(this.props, 'windowWidth', 'href');
                return (
                    <CaseDetailPane
                        {...{ passProps, propsFromTable, result, containerWidth, rowNumber }} paddingWidth={57}
                    />
                );
            }.bind(this);
        }
        return renderDetailPane;
    }

    render(){
        const {
            title,
            children,
            facets,
            session, schemas: propSchemas,
            defaultOpenIndices, maxHeight,
            columns, columnExtensionMap,
            searchHref,
            filterFacetFxn, hideFacets,
            filterColumnFxn, hideColumns,
        } = this.props;
        const { totalCount } = this.state;

        if (typeof searchHref !== "string") {
            throw new Error("Expected a string 'searchHref'");
        }

        const schemas = propSchemas || getSchemas() || null; // We might not have this e.g. in placeholders in StaticSections

        const renderDetailPane = this.getCorrectDetailPane();

        const passProps = {
            facets, columns, columnExtensionMap, searchHref, session,
            schemas, renderDetailPane, defaultOpenIndices, maxHeight,
            filterFacetFxn, hideFacets,
            filterColumnFxn, hideColumns,
            onLoad: this.getCountCallback,
            termTransformFxn: Term.toName
        };

        const showTitle = !title ? null
            : React.isValidElement(title) ? (
                typeof title.type === "string" ? title
                    : React.cloneElement(title, { totalCount })
            ) : title;

        const showChildren = React.isValidElement(children) && typeof children.type !== "string" ?
            React.cloneElement(children, { totalCount }) : children;

        return (
            <div className="embedded-search-view-outer-container">
                { showTitle }
                <EmbeddedSearchView {...passProps}/>
                { showChildren }
            </div>
        );
    }
}
