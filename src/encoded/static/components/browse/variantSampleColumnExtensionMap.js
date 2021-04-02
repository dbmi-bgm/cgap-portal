'use strict';

import React from 'react';

/**
 * This gets merged into the columnExtensionMap.js.
 * This is present in separate file for modularity.
 * We may move this later to take effect only for type=VariantSample search tables.
 */



export const variantSampleColumnExtensionMap = {
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


/**************************************************
 *** Definitions for some table cell components ***
 **************************************************/

export function StackedRowColumn(props) {
    const { rows = [], className = null } = props;
    const cls = ("w-100" + (className ? " " + className : ""));
    return (
        <div className={cls} data-delay-show={750}>
            { rows }
        </div>
    );
}

/** An edited version of SPC's DisplayTitleColumnDefault */
export const VariantSampleDisplayTitleColumn = React.memo(function VariantSampleDisplayTitleColumn(props) {
    const { result = null, link, onClick, className = null } = props;
    const { variant = null } = result || {};
    const { display_title = null, ID = null } = variant;

    const cls = ("title-block" + (className ? " " + className : ""));
    const rows = [
        <span key="variant-title" className="d-block text-600 text-truncate">{display_title}</span>
    ];

    if (ID) {
        rows.push(<span key="dbsnp" className="font-italic">{ ID }</span>);
    }

    return (
        <a key="title" href={link || '#'} onClick={onClick} className="d-block text-truncate">
            <StackedRowColumn className={cls} {...{ rows }}  />
        </a>
    );
});

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

