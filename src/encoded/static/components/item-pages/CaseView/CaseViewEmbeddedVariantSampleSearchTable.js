'use strict';

import React, { useMemo } from 'react';

import { console, ajax } from '@hms-dbmi-bgm/shared-portal-components/es/components/util';
import { DisplayTitleColumnWrapper } from '@hms-dbmi-bgm/shared-portal-components/es/components/browse/components/table-commons';
import { EmbeddedItemSearchTable } from '../components/EmbeddedItemSearchTable';

/* Used in FilteringTab */

/**
 * Some hardcoded column definitions/overrides for non-title columns (excl. display_title, which is dynamic)
 * @todo Potentially move some/all of these definitions into EmbeddedItemSearchTable.defaultProps.columnExtensionMap
 */
export const variantSampleAdditionalColumnExtensionMap = {
    "DP" : { // Coverage, VAF column
        widthMap: { 'lg' : 140, 'md' : 120, 'sm' : 70 },
        render: function(result, props) {
            const { DP = null, AF = null } = result;
            const rows = [
                <span key="DP" data-tip="Coverage" className="d-block text-truncate">{DP || "-"}</span>,
                <span key="AF" data-tip="VAF" className="d-block text-truncate">{AF || "-"}</span>
            ];
            return <StackedRowColumn rowKey="Coverage, AF Row" className="text-center" {...{ rows }}/>;
        }
    },
    "associated_genotype_labels.proband_genotype_label" : { // Genotype column
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
            return <StackedRowColumn rowKey="genotype" className="text-center" {...{ rows }}/>;
        }
    },
    "variant.genes.genes_ensg.display_title": { // Gene Transcript column
        widthMap: { 'lg' : 155, 'md' : 140, 'sm' : 130 },
        render: function(result, props) {
            const { variant : { genes = [] } = {} } = result;

            const geneTitles = genes.map((geneItem) => {
                const { genes_ensg: { display_title = null } = {} } = geneItem || {};
                return display_title;
            });
            if (genes.length > 0) {
                const { genes_most_severe_transcript = null } = genes[0] || {};
                const rows = [
                    <span key="genes_ensg" className="font-italic d-block text-truncate">{ geneTitles.length > 1 ? geneTitles.join() : geneTitles } </span>,
                    <span data-tip="Most Severe Transcript" key="genes_severe_transcript" className="font-italic d-block text-truncate">{ genes_most_severe_transcript}</span>
                ];
                return <StackedRowColumn rowKey="genes_data" className="text-center" {...{ rows }} />;
            }
            return null;
        }
    },
    "variant.genes.genes_most_severe_hgvsc": { // Variant column
        noSort: true,
        widthMap: { 'lg' : 120, 'md' : 110, 'sm' : 95 },
        render: function(result, props) {
            const { variant : { genes : [firstGene = null] = [] } = {} } = result;
            const { genes_most_severe_hgvsc = null } = firstGene || {};

            if (firstGene && genes_most_severe_hgvsc) {
                return <GenesMostSevereHGVSCColumn hgvsc={genes_most_severe_hgvsc} />;
            }
            return null;
        }
    },
    "variant.genes.genes_most_severe_consequence.coding_effect": { // Coding Effect column
        widthMap: { 'lg' : 140, 'md' : 130, 'sm' : 120 },
        render: function(result, props) {
            const { variant : { genes : [firstGene = null] = [] } = {} } = result;
            const { genes_most_severe_consequence : { coding_effect = null } = {} } = firstGene || {};

            if (firstGene && coding_effect) {
                return <StackedRowColumn rowKey="genes_codingeffect" className="text-center text-truncate" rows={[coding_effect]} />;
            }
            return null;
        }
    },
    "variant.gnomad_af": { // Gnomad column
        widthMap: { 'lg' : 140, 'md' : 130, 'sm' : 120 },
        render: function(result, props){
            const { variant : { gnomad_af = null, max_pop_af_af_popmax = null } = {} } = result;
            const rows = [];

            if (!gnomad_af && !max_pop_af_af_popmax) {
                return null;
            }
            if (gnomad_af) {
                const gnomad_af_exp = gnomad_af ? gnomad_af.toExponential(3): null;
                rows.push(<div key="gnomad_af" className="d-block text-truncate"><span className="text-600">ALL: </span>{gnomad_af_exp || gnomad_af || "-"}</div>);
            }
            if (max_pop_af_af_popmax){
                const max_pop_af_af_popmax_exp = max_pop_af_af_popmax ? max_pop_af_af_popmax.toExponential(3): null;
                rows.push(<div key="gnomad_af_popmax" className="d-block text-truncate"><span className="text-600">MAX: </span>{max_pop_af_af_popmax_exp || max_pop_af_af_popmax || "-"}</div>);
            }
            return <StackedRowColumn rowKey="genes_gnomad" className="text-center" {...{ rows }}/>;
        }
    },
    "variant.cadd_phred": { // Predictors column (cadd_phred, spliceai, phylop100)
        render: function(result, props) {
            const { variant : { cadd_phred = null, spliceai_maxds = null, conservation_phylop100 = null } = {} } = result;
            const rows = [];

            if (!cadd_phred && !spliceai_maxds && !conservation_phylop100) {
                return null;
            }
            if (cadd_phred) {
                rows.push(<div key="cadd_phred" className="d-block text-truncate"><span className="text-600">Cadd Phred: </span>{cadd_phred || "-"}</div>);
            }
            if (spliceai_maxds) {
                rows.push(<div key="spliceai_maxds" className="d-block text-truncate"><span className="text-600">SpliceAI MaxDS: </span>{spliceai_maxds || "-"}</div>);
            }
            if (conservation_phylop100) {
                rows.push(<div key="phylop" className="d-block text-truncate"><span className="text-600">PhyloP 100: </span>{conservation_phylop100 || "-"}</div>);
            }
            return <StackedRowColumn rowKey="genes_predictors" className="text-center" {...{ rows }}/>;
        }
    }
};

/**
 * This table is wrapped by `SelectedItemsController` in FilteringTab which passes in selected items and methods to select/deselect, as well.
 * `SelectedItemsController` is originally used for selecting multiple items in new window, e.g. for HiGlass files selection. It has some methods which are unnecessary or unused.
 */
export function CaseViewEmbeddedVariantSampleSearchTable(props){
    const {
        columnExtensionMap: originalColExtMap = EmbeddedItemSearchTable.defaultProps.columnExtensionMap, // Get/reuse default colExtMap from EmbeddedItemSearchTable
        // onSelectVariant, // `onSelectVariant` theoretically passed down from FilteringTab or something; will perform AJAX request + update selected variantsample state.
        selectedItems,
        onSelectItem,
        onResetSelectedItems,
        ...passProps
    } = props;

    console.log("PASSPROPS", passProps);

    // Will use this method to inject modal open fx when Annotation/Interpretation spaces are moved to overlay
    // const onSelectVariant = function(e) {
    //     e.preventDefault();
    //     console.log("thing happened, e", e);
    // };

    const columnExtensionMap = useMemo(function() {
        // Generates new object `columnExtensionMap` only if `originalColExtMap` changes (if ever)
        return {
            // Copy in existing vals but overwrite display_title.render
            ...originalColExtMap,
            ...variantSampleAdditionalColumnExtensionMap,
            "display_title" : {
                ...originalColExtMap.display_title,
                widthMap: { 'lg' : 250, 'md' : 220, 'sm' : 200 },
                render: function(result, parentProps){
                    const { href, context, rowNumber, detailOpen, toggleDetailOpen } = parentProps;
                    return (
                        <DisplayTitleColumnWrapper {...{ result, href, context, rowNumber, detailOpen, toggleDetailOpen }}>
                            <SelectableTitle />
                        </DisplayTitleColumnWrapper>
                    );
                }
            }
        };
    }, [ originalColExtMap ]);

    return (
        <EmbeddedItemSearchTable {...passProps} {...{ columnExtensionMap }} />
    );
}



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

const GenesMostSevereHGVSCColumn = React.memo(function GenesMostSevereHGVSCColumn({ hgvsc }){
    // Memoized on the 1 prop it receives which is dependency for its calculation.
    const hgvscSplit = hgvsc.split(":");
    const pSplit = hgvscSplit[1].split(".");
    // Will add hgvsp when added in data/backend
    const rows = [
        <div className="text-truncate d-block" key="genes_severe_transcript">
            <span className="text-600">{ pSplit[0] }.</span>
            <span>{ pSplit[1] }</span>
        </div>
    ];
    return <StackedRowColumn className="text-center" {...{ rows }} />;
});

/** An edited version of SPC's DisplayTitleColumnDefault */
const VSDisplayTitleColumnDefault = React.memo(function VSDisplayTitleColumnDefault(props) {
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

function SelectableTitle({ onSelectVariant, result, link }){
    // DisplayTitleColumnWrapper passes own 'onClick' func as prop to this component which would navigate to Item URL; don't use it here; intercept and instead use onSelectVariant from FilteringTab (or wherever).
    // `link` is also from DisplayTitleColumnWrapper; I think good to keep as it'll translate into <a href={link}> in DisplayTitleColumnDefault and this will still allow to right-click + open in new tab (may need event.preventDefault() and/or event.stopPropagation() present in onSelectVariant).
    return <VSDisplayTitleColumnDefault {...{ result, link }} onClick={onSelectVariant} />;
}
