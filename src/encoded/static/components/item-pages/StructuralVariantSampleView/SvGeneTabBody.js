'use strict';

import React, { useCallback, useMemo } from 'react';

import { SvGeneDetailPane } from './SvDetailPanes';
import { EmbeddedItemSearchTable } from '../components/EmbeddedItemSearchTable';


export function SvGeneTabBody (props){

    const {
        columnExtensionMap:  originalColExtMap = EmbeddedItemSearchTable.defaultProps.columnExtensionMap,
        active = false,
        context,
        ...passProps
    } = props;

    const columnExtensionMap = useMemo(function(){
        return {
            ...originalColExtMap,
            "spos": {
                "render": function(result, parentProps){
                    const { spos, epos } = result || {};
                    return <div className="text-center w-100">{spos} - <br/>{epos}</div>;
                }
            },
        };
    });

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
                        <EmbeddedItemSearchTable {...passProps} facets={null} {...{ searchHref, columnExtensionMap }} columns={geneTableColumns}
                            renderDetailPane={(result, rowNumber, containerWidth, propsFromTable) => <SvGeneDetailPane {...{ result, rowNumber, containerWidth, context }} {...propsFromTable} />}/>
                    </div>
                </div>
            </div>
        </div>
    );
}

const geneTableColumns = {
    "display_title": {
        "title": "Gene, Transcript",
        "order": 1,
        "sort_fields": [
            {
                "field": "display_title",
                "title": "Gene"
            }
        ]
    },
    "spos": {
        "title": "Location",
        "order": 2,
        "sort_fields": [
            {
                "field": "spos",
                "title": "Start Position"
            },
            {
                "field": "epos",
                "title": "End Position"
            }
        ]
    },
};