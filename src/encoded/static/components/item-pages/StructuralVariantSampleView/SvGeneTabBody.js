'use strict';

import React, { useCallback } from 'react';

import { SvGeneDetailPane } from './SvDetailPanes';
import { EmbeddedItemSearchTable } from '../components/EmbeddedItemSearchTable';


export class SvGeneTabBody extends React.Component {

    render() {
        const { // TODO: Will need to expand colExtMap for this in future versions
            columnExtensionMap:  originalColExtMap = EmbeddedItemSearchTable.defaultProps.columnExtensionMap,
            active = false,
            context,
            ...passProps
        } = this.props;

        const { structural_variant: { transcript = [] } = {} } = context;

        const transcriptsDeduped = {};
        transcript.forEach((t) => {
            const { csq_gene: { ensgid = null } = {} } = t;
            transcriptsDeduped[ensgid] = true;
        });
        const genes = Object.keys(transcriptsDeduped);

        let searchHref = "/search/?type=Gene";
        genes.forEach((gene) => {
            searchHref += ("&ensgid=" + gene);
        });

        return (
            <div className={`gene-tab-body card-body ${!active ? "d-none": ""}`}>
                <div className="row flex-column flex-lg-row">
                    <div className="inner-card-section col pb-2 pb-lg-0">
                        <div className="info-header-title">
                            <h4>Gene List</h4>
                        </div>
                        <div className="info-body">
                            <EmbeddedItemSearchTable {...passProps} facets={null} {...{ searchHref }}
                                renderDetailPane={(result, rowNumber, containerWidth, propsFromTable) => <SvGeneDetailPane {...{ result, rowNumber, containerWidth, context }} {...propsFromTable} />}/>
                        </div>
                    </div>
                </div>
            </div>
        );
    }
}