'use strict';

import React, { useMemo, useCallback, useEffect } from 'react';

import { console, ajax } from '@hms-dbmi-bgm/shared-portal-components/es/components/util';
import { DisplayTitleColumnWrapper } from '@hms-dbmi-bgm/shared-portal-components/es/components/browse/components/table-commons';
import { EmbeddedItemSearchTable } from '../components/EmbeddedItemSearchTable';

/* Used in FilteringTab */

/**
 * Some hardcoded column definitions/overrides for non-title columns (excl. display_title, which is dynamic)
 * @todo Potentially move some/all of these definitions into EmbeddedItemSearchTable.defaultProps.columnExtensionMap
 */
export const variantSampleAdditionalColumnExtensionMap = {
    // "Coverage, VAF" column
    "DP" : {
        widthMap: { 'lg' : 140, 'md' : 120, 'sm' : 70 },
        render: function(result, props) {
            const { DP = null, AF = null } = result;
            const rows = [
                <span key="DP" data-tip="Coverage" className="d-block text-truncate">{DP || "-"}</span>,
                <span key="AF" data-tip="VAF" className="d-block text-truncate">{AF || "-"}</span>
            ];
            return <StackedRowColumn className="text-center" {...{ rows }}/>;
        }
    },
    // "Genotype" column I - numerical, e.g. 0/1
    "GT" : {
        widthMap: { 'lg' : 70, 'md' : 70, 'sm' : 60 }
    },
    // "Genotype" column II - genotype labels
    "associated_genotype_labels.proband_genotype_label" : {
        widthMap: { 'lg' : 240, 'md' : 230, 'sm' : 200 },
        render: function(result, props) {
            const { associated_genotype_labels : { proband_genotype_label = null, mother_genotype_label = null, father_genotype_label = null } = {} } = result;
            const rows = [];
            if (proband_genotype_label) {
                rows.push(<div key="proband_gt" className="d-block text-truncate"><span className="font-italic">Proband: </span>{proband_genotype_label}</div>);
            } else {
                return null;
            }
            if (mother_genotype_label) {
                rows.push(<div key="mother_gt" className="d-block text-truncate"><span className="font-italic">Mother: </span>{mother_genotype_label || "-"}</div>);
            }
            if (father_genotype_label) {
                rows.push(<div key="father_gt" className="d-block text-truncate"><span className="font-italic">Father: </span>{father_genotype_label || "-"}</div>);
            }
            return <StackedRowColumn className="text-center" {...{ rows }}/>;
        }
    },
    // "Gene, Transcript" column
    "variant.genes.genes_most_severe_gene.display_title": {
        // Also includes "variant.genes.genes_most_severe_transcript"
        widthMap: { 'lg' : 155, 'md' : 140, 'sm' : 130 },
        render: function(result, props) {
            const { variant : { genes = [] } = {} } = result;

            const geneTitles = genes.map((geneItem) => {
                const { genes_most_severe_gene: { display_title = null } = {} } = geneItem || {};
                return display_title;
            });
            if (genes.length > 0) {
                const { genes_most_severe_transcript = null } = genes[0] || {};
                const rows = [
                    <span key="genes_ensg" className="font-italic d-block text-truncate">{ geneTitles.length > 1 ? geneTitles.join() : geneTitles } </span>,
                    <span data-tip="Most Severe Transcript" key="genes_severe_transcript" className="font-italic d-block text-truncate">{ genes_most_severe_transcript}</span>
                ];
                return <StackedRowColumn className="text-center" {...{ rows }} />;
            }
            return null;
        }
    },
    // "Coding & Protein Sequence" col (existing 'Variant' column)
    "variant.genes.genes_most_severe_hgvsc": {
        // Also renders "variant.genes.genes_most_severe_hgvsp"
        widthMap: { 'lg' : 140, 'md' : 130, 'sm' : 120 },
        render: function(result, props) {
            const { variant : { genes : [ firstGene = null ] = [] } = {} } = result;
            const { genes_most_severe_hgvsc = null, genes_most_severe_hgvsp = null } = firstGene || {};

            if (!genes_most_severe_hgvsc && !genes_most_severe_hgvsp) {
                return null;
            }

            return <GenesMostSevereHGVSCColumn gene={firstGene} />;
        }
    },
    "variant.genes.genes_most_severe_consequence.coding_effect": { // Coding Effect column
        widthMap: { 'lg' : 140, 'md' : 130, 'sm' : 120 },
        render: function(result, props) {
            const { variant : { genes : [firstGene = null] = [] } = {} } = result;
            const { genes_most_severe_consequence : { coding_effect = null } = {} } = firstGene || {};

            if (firstGene && coding_effect) {
                return <StackedRowColumn className="text-center text-truncate" rows={[coding_effect]} />;
            }
            return null;
        }
    },
    "variant.csq_gnomadg_af": { // Gnomad column
        widthMap: { 'lg' : 140, 'md' : 130, 'sm' : 120 },
        render: function(result, props){
            const { variant : { csq_gnomadg_af = null, csq_gnomadg_af_popmax = null } = {} } = result;
            const rows = [];

            if (!csq_gnomadg_af && !csq_gnomadg_af_popmax) {
                return null;
            }
            if (csq_gnomadg_af) {
                const csq_gnomadg_af_exp = csq_gnomadg_af ? csq_gnomadg_af.toExponential(3): null;
                rows.push(<div key="csq_gnomadg_af" className="d-block text-truncate"><span className="text-600">ALL: </span>{csq_gnomadg_af_exp || csq_gnomadg_af || "-"}</div>);
            }
            if (csq_gnomadg_af_popmax){
                const csq_gnomadg_af_popmax_exp = csq_gnomadg_af_popmax ? csq_gnomadg_af_popmax.toExponential(3): null;
                rows.push(<div key="csq_gnomadg_af_popmax" className="d-block text-truncate"><span className="text-600">MAX: </span>{csq_gnomadg_af_popmax_exp || csq_gnomadg_af_popmax || "-"}</div>);
            }
            return <StackedRowColumn className="text-center" {...{ rows }}/>;
        }
    },
    "variant.csq_cadd_phred": { // Predictors column (csq_cadd_phred, spliceai, phylop100)
        render: function(result, props) {
            const { variant : { csq_cadd_phred = null, spliceaiMaxds = null, csq_phylop100way_vertebrate = null } = {} } = result;
            const rows = [];

            if (!csq_cadd_phred && !spliceaiMaxds && !csq_phylop100way_vertebrate) {
                return null;
            }
            if (csq_cadd_phred) {
                rows.push(<div key="csq_cadd_phred" className="d-block text-truncate"><span className="text-600">Cadd Phred: </span>{csq_cadd_phred || "-"}</div>);
            }
            if (spliceaiMaxds) {
                rows.push(<div key="spliceaiMaxds" className="d-block text-truncate"><span className="text-600">SpliceAI MaxDS: </span>{spliceaiMaxds || "-"}</div>);
            }
            if (csq_phylop100way_vertebrate) {
                rows.push(<div key="phylop" className="d-block text-truncate"><span className="text-600">PhyloP 100: </span>{csq_phylop100way_vertebrate || "-"}</div>);
            }
            return <StackedRowColumn className="text-center" {...{ rows }}/>;
        }
    }
};

/**
 * This table is wrapped by `SelectedItemsController` in FilteringTab which passes in selected items and methods to select/deselect, as well.
 * `SelectedItemsController` is originally used for selecting multiple items in new window, e.g. for HiGlass files selection. It has some methods which are unnecessary or unused.
 */
export function CaseViewEmbeddedVariantSampleSearchTable(props){
    const {
        // Get/reuse default colExtMap from EmbeddedItemSearchTable
        columnExtensionMap: originalColExtMap = EmbeddedItemSearchTable.defaultProps.columnExtensionMap,
        selectedItems,
        onSelectItem,
        onResetSelectedItems,
        savedVariantSampleIDMap = {},
        ...passProps
    } = props;

    const columnExtensionMap = useMemo(function() {
        return {
            ...originalColExtMap,
            ...variantSampleAdditionalColumnExtensionMap,
            "display_title" : {
                // Preserve existing 'display_title' extension properties but overwrite render, minColumnWidth..
                ...originalColExtMap.display_title,
                "widthMap": { 'lg' : 250, 'md' : 220, 'sm' : 200 },
                "minColumnWidth" : (originalColExtMap.display_title.minColumnWidth || 100) + 20,
                "render": function(result, parentProps){
                    const { href, context, rowNumber, detailOpen, toggleDetailOpen } = parentProps;
                    return (
                        <DisplayTitleColumnWrapper {...{ result, href, context, rowNumber, detailOpen, toggleDetailOpen }}>
                            <VariantSampleSelectionCheckbox {...{ selectedItems, onSelectItem, savedVariantSampleIDMap }} />
                            <VariantSampleDisplayTitleColumn />
                        </DisplayTitleColumnWrapper>
                    );
                }
            }
        };
    }, [ originalColExtMap, selectedItems, savedVariantSampleIDMap ]);

    return <EmbeddedItemSearchTable {...passProps} {...{ columnExtensionMap }} />;
}

/** Based mostly on SPC SelectionItemCheckbox w. minor alterations */
export const VariantSampleSelectionCheckbox = React.memo(function VariantSampleSelectionCheckbox(props){
    const { selectedItems, result, onSelectItem, savedVariantSampleIDMap } = props;
    const { "@id": resultID } = result;
    const isPrevSaved = savedVariantSampleIDMap[resultID];
    const isSelected = selectedItems.has(resultID);
    const isChecked = isPrevSaved || isSelected;

    const onChange = useCallback(function(e){
        return onSelectItem(result, true);
    }, [ onSelectItem, result ]);

    useEffect(function(){
        // Unselect this if for some reason has been previously selected.
        // (might occur if someone started selecting things before VariantSampleList?datastore=databse Item has finished loading)
        if (isSelected && isPrevSaved) {
            onSelectItem(result, true);
        }
    }, [ isSelected, isPrevSaved ]);

    return <input type="checkbox" checked={isChecked} onChange={onChange} disabled={isPrevSaved} className="mr-2" />;
});


/**************************************************
 *** Definitions for some table cell components ***
 **************************************************/

function StackedRowColumn(props) {
    const { rows = [], className = null } = props;
    const cls = ("w-100" + (className ? " " + className : ""));
    return (
        <div className={cls} data-delay-show={750}>
            { rows }
        </div>
    );
}

const GenesMostSevereHGVSCColumn = React.memo(function GenesMostSevereHGVSCColumn({ gene }){
    const {
        genes_most_severe_hgvsc = null,
        genes_most_severe_hgvsp = null
    } = gene || {};

    const rows = [];
    // Memoized on the 1 prop it receives which is dependency for its calculation.
    if (genes_most_severe_hgvsc) {
        const hgvscSplit = genes_most_severe_hgvsc.split(":");
        var scSplit = hgvscSplit[1].split(".");
        rows.push(
            <div className="text-truncate d-block" key="sc">
                <span className="text-600">{ scSplit[0] }.</span><span>{ scSplit[1] }</span>
            </div>);
    }

    if (genes_most_severe_hgvsp) {
        const hgvspSplit = genes_most_severe_hgvsp.split(":");
        var spSplit = hgvspSplit[1].split(".");
        rows.push(
            <div className="text-truncate d-block" key="sp">
                <span className="text-600">{ spSplit[0] }.</span><span>{ spSplit[1] }</span>
            </div>);
    }

    return <StackedRowColumn className="text-center" {...{ rows }} />;
});

/** An edited version of SPC's DisplayTitleColumnDefault */
export const VariantSampleDisplayTitleColumn = React.memo(function VariantSampleDisplayTitleColumn(props) {
    const { result = null, link, onClick, className = null } = props;
    const { variant = null } = result || {};
    const { display_title = null, dbsnp_rs_number = null } = variant;

    const cls = ("title-block" + (className ? " " + className : ""));
    const rows = [
        <span key="variant-title" className="d-block text-600 text-truncate">{display_title}</span>
    ];

    if (dbsnp_rs_number) {
        rows.push(<span key="dbsnp" className="font-italic">{dbsnp_rs_number}</span>);
    }

    return (
        <a key="title" href={link || '#'} onClick={onClick} className="d-block text-truncate">
            <StackedRowColumn className={cls} {...{ rows }}  />
        </a>
    );
});

// function SelectableTitle({ onSelectVariant, result, link }){
//     // DisplayTitleColumnWrapper passes own 'onClick' func as prop to this component which would navigate to Item URL; don't use it here; intercept and instead use onSelectVariant from FilteringTab (or wherever).
//     // `link` is also from DisplayTitleColumnWrapper; I think good to keep as it'll translate into <a href={link}> in DisplayTitleColumnDefault and this will still allow to right-click + open in new tab (may need event.preventDefault() and/or event.stopPropagation() present in onSelectVariant).
//     return <VSDisplayTitleColumnDefault {...{ result, link }} onClick={onSelectVariant} />;
// }
