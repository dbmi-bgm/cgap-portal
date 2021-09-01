'use strict';

import React from 'react';
import { EmbeddedItemSearchTable } from '../components/EmbeddedItemSearchTable';


export default class SvGeneTabBody extends React.Component {

    render() {
        const { // TODO: Will need to expand colExtMap for this in future versions
            columnExtensionMap:  originalColExtMap = EmbeddedItemSearchTable.defaultProps.columnExtensionMap,
            ...passProps
        } = this.props;
        return (
            <div className="variant-tab-body card-body">
                <div className="row flex-column flex-lg-row">
                    <div className="inner-card-section col pb-2 pb-lg-0">
                        <div className="info-header-title">
                            <h4>Gene List</h4>
                        </div>
                        <div className="info-body">
                            <EmbeddedItemSearchTable {...passProps} facets={null} searchHref="/search/?type=Gene"/>
                        </div>
                    </div>
                </div>
            </div>
        );
    }
}