'use strict';

import React, { useCallback, useMemo } from 'react';

import { IconCheckbox } from '../../forms/IconCheckbox';
import { SvGeneDetailPane } from './SvDetailPanes';
import { EmbeddedItemSearchTable } from '../components/EmbeddedItemSearchTable';
import { DisplayTitleColumnWrapper } from '@hms-dbmi-bgm/shared-portal-components/es/components/browse/components/table-commons';
import { StackedRowColumn } from '../../browse/variantSampleColumnExtensionMap';
import { getInitialTranscriptIndex } from '../VariantSampleView/AnnotationSections';

export function SvGeneTabBody (props){

    const {
        columnExtensionMap:  originalColExtMap = EmbeddedItemSearchTable.defaultProps.columnExtensionMap,
        selectedGenes,
        onSelectGene,
        savedVariantSampleIDMap = {},
        isLoadingVariantSampleListItem,
        active = false,
        context,
        showInterpretation,
        ...passProps
    } = props;

    const { structural_variant: { transcript = [] } = {} } = context;

    const columnExtensionMap = useMemo(function(){
        return {
            ...originalColExtMap,
            "display_title": {
                "widthMap": { 'lg' : 250, 'md' : 220, 'sm' : 200 },
                "render": function(result, props) {
                    const { href, context, rowNumber, detailOpen, toggleDetailOpen } = props;
                    return (
                        <SVGeneDisplayTitleColumnWrapper {...{ result, href, context, rowNumber, detailOpen, toggleDetailOpen,
                            selectedGenes, onSelectGene, savedVariantSampleIDMap, isLoadingVariantSampleListItem, showInterpretation }}>
                            <SVGeneDisplayTitleColumn {...{ transcript }} />
                        </SVGeneDisplayTitleColumnWrapper>
                    );
                }
            },
            "spos": {
                "render": function(result, parentProps){
                    const { start_display, end_display } = result || {};
                    return <div className="text-center w-100 text-truncate">{start_display} - <br/>{end_display}</div>;
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
                        return <div className="text-center w-100 text-truncate">{display_title}</div>;
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
                        <EmbeddedItemSearchTable {...passProps} facets={null} {...{ searchHref, columnExtensionMap }} columns={geneTableColumns} selectedItems={selectedGenes} isMultiSelect={false} currentAction="selection"
                            maxHeight={1400} renderDetailPane={(result, rowNumber, containerWidth, propsFromTable) => <SvGeneDetailPane {...{ result, rowNumber, containerWidth, context }} {...propsFromTable} />}/>
                    </div>
                </div>
            </div>
        </div>
    );
}

function SVGeneDisplayTitleColumnWrapper(props) {
    const {
        result, href, context, rowNumber, detailOpen, toggleDetailOpen,
        selectedGenes, onSelectGene, savedVariantSampleIDMap, isLoadingVariantSampleListItem,
        children, showInterpretation
    } = props;

    let highlightedSelector = null;
    if (selectedGenes && onSelectGene && showInterpretation) { //savedVariantSampleIDMap
        highlightedSelector = <HighlightedGeneSelector {...{ selectedGenes, onSelectGene, savedVariantSampleIDMap, isLoadingVariantSampleListItem }} />;
    }

    return (
        <DisplayTitleColumnWrapper {...{ result, href, context, rowNumber, detailOpen, toggleDetailOpen }}>
            { highlightedSelector } { children }
        </DisplayTitleColumnWrapper>
    );
}

const SVGeneDisplayTitleColumn = React.memo(function SVGeneDispalyTitleColumn(props) {
    const { transcript, result = null, link = null, align = "left", href, context, rowNumber, detailOpen, toggleDetailOpen } = props;
    const { "@id" : atID = null, display_title, ensgid: thisGene } = result || {};

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

    // Displaying the canonical transcript; and if no canon available, the first transcript/same displayed under worst consequence
    if (filteredTranscripts.length > 0) {
        const transcriptIndex = getInitialTranscriptIndex(filteredTranscripts);
        const { csq_mane = null, csq_feature = null } = filteredTranscripts[transcriptIndex || 0];
        const transcriptDisplay = csq_mane || csq_feature;
        rows.push(<span key="transcript" className="font-italic d-block text-small">{ transcriptDisplay } </span>);
    }

    return (
        <a href={link || atID || "#"} className="text-truncate">
            <StackedRowColumn className={"text-" + align} {...{ rows }} />
        </a>
    );
});

export const HighlightedGeneSelector = React.memo(function HighlightedGeneSelector(props){
    const { selectedGenes, result, onSelectGene, savedVariantSampleIDMap, isLoadingVariantSampleListItem = false } = props;
    const { "@id": resultID } = result;
    const isPrevSaved = savedVariantSampleIDMap[resultID];
    const isSelected = selectedGenes.has(resultID);
    const isChecked = isPrevSaved || isSelected;
    console.log("isPrevSaved, isSelected", isPrevSaved, isSelected);

    const onChange = useCallback(function(e){
        console.log("clicking onSelectGene, ", result);
        return onSelectGene(result, false, false);
    }, [ onSelectGene, result ]);

    // return <input type="checkbox" cls="m-0 mr-2" checked={isChecked} onChange={onChange} disabled={isLoadingVariantSampleListItem || isPrevSaved} />;
    return <IconCheckbox className="my-0 mr-2" iconOn="star fas" iconOff="star far" checked={isChecked} onChange={onChange} disabled={isLoadingVariantSampleListItem || isPrevSaved} />;
});

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
        "title": "Worst Consequence",
        "noSort": true,
        "order": 3
    },
    "oe_lof": {
        "title": "o/e (LoF)",
        "order": 4
    }
};
