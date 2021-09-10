'use strict';

import React, { useCallback, useMemo } from 'react';

import { SvGeneDetailPane } from './SvDetailPanes';
import { EmbeddedItemSearchTable } from '../components/EmbeddedItemSearchTable';
import { DisplayTitleColumnWrapper } from '@hms-dbmi-bgm/shared-portal-components/es/components/browse/components/table-commons';
import { StackedRowColumn } from '../../browse/variantSampleColumnExtensionMap';

export function SvGeneTabBody (props){

    const {
        columnExtensionMap:  originalColExtMap = EmbeddedItemSearchTable.defaultProps.columnExtensionMap,
        active = false,
        context,
        ...passProps
    } = props;

    const { structural_variant: { transcript = [] } = {} } = context;

    const columnExtensionMap = useMemo(function(){
        return {
            ...originalColExtMap,
            "display_title": {
                render: function(result, props) {
                    const { "@id" : atID = null, display_title, ensgid: thisGene } = result;
                    const { link = null, align = "left", href, context, rowNumber, detailOpen, toggleDetailOpen } = props;

                    const rows = [
                        <span key="gene" className="d-block text-truncate">{ display_title } </span>
                    ];

                    // Filter out transcripts that are not for the current gene
                    const filteredTranscripts = transcript.filter((t) => {
                        const {
                            csq_gene: { ensgid = "" } = {},
                        } = t;
                        return ensgid === thisGene;
                    });

                    // Displaying the first transcript. (same displayed under consequence)
                    if (filteredTranscripts.length > 0) {
                        const [ { csq_mane = null, csq_feature = null } = {} ] = filteredTranscripts;
                        const transcriptDisplay = csq_mane || csq_feature;
                        rows.push(<span key="transcript" className="font-italic d-block text-truncate text-small">{ transcriptDisplay } </span>);
                    }

                    return (
                        <DisplayTitleColumnWrapper {...{ result, href, context, rowNumber, detailOpen, toggleDetailOpen }}>
                            <a href={link || atID || "#"}>
                                <StackedRowColumn className={"text-" + align} {...{ rows }} />
                            </a>
                        </DisplayTitleColumnWrapper>
                    );
                }
            },
            "spos": {
                "render": function(result, parentProps){
                    const { spos, epos } = result || {};
                    return <div className="text-center w-100">{spos} - <br/>{epos}</div>;
                }
            },
            "consequence": {
                "render": function(result, parentProps){
                    const { ensgid: thisGene } = result || {};

                    // Filter out transcripts that are not for the current gene
                    const filteredTranscripts = transcript.filter((t) => {
                        const {
                            csq_gene: { ensgid = "" } = {},
                        } = t;
                        return ensgid === thisGene;
                    });

                    // Displaying the first consequence that matches the gene. (same displayed under Transcript)
                    if (filteredTranscripts.length > 0) {
                        const [ { csq_consequence: [{ display_title = null } = {}] = [] } = {} ] = filteredTranscripts;
                        return <div className="text-center w-100">{display_title}</div>;
                    }
                    return null;
                }
            },
        };
    });

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
    "consequence": {
        "title": "Consequence",
        "noSort": true,
        "order": 3
    },
    "oe_lof": {
        "title": "o/e (LoF)",
        "order": 4
    }
};