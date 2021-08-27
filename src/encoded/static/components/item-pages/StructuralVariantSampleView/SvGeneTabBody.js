'use strict';

import React, { useCallback } from 'react';

import { SvGeneDetailPane } from './SvDetailPanes';
import { EmbeddedItemSearchTable } from '../components/EmbeddedItemSearchTable';


export class SvGeneTabBody extends React.Component {

    render() {
        const { // TODO: Will need to expand colExtMap for this in future versions
            columnExtensionMap:  originalColExtMap = EmbeddedItemSearchTable.defaultProps.columnExtensionMap,
            active = false,
            ...passProps
        } = this.props;
        return (
            <div className={`gene-tab-body card-body ${!active ? "d-none": ""}`}>
                <div className="row flex-column flex-lg-row">
                    <div className="inner-card-section col pb-2 pb-lg-0">
                        <div className="info-header-title">
                            <h4>Gene List</h4>
                        </div>
                        <div className="info-body">
                            <EmbeddedItemSearchTable {...passProps} facets={null} searchHref="/search/?type=Gene"
                                renderDetailPane={(result, rowNumber, containerWidth, propsFromTable) => <SvGeneDetailPane {...{ result, rowNumber, containerWidth }} {...propsFromTable} />}/>
                        </div>
                    </div>
                </div>
            </div>
        );
    }
}