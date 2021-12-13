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
            const { align = "left" } = props;
            const { associated_genotype_labels : { proband_genotype_label = null, mother_genotype_label = null, father_genotype_label = null } = {} } = result;
            const rows = [];
            if (proband_genotype_label) {
                rows.push(
                    // rows.push(<div key="proband_gt" className="d-block text-truncate"><span className="font-italic">Proband: </span>{proband_genotype_label}</div>);
                    <div key="proband_gt" className="d-block text-truncate">
                        <i className="icon icon-user icon-fw fas mr-04" data-tip="Proband Genotype"/>
                        { proband_genotype_label }
                    </div>
                );
            } else {
                return null;
            }
            if (mother_genotype_label) {
                // rows.push(<div key="mother_gt" className="d-block text-truncate"><span className="font-italic">Mother: </span>{mother_genotype_label || "-"}</div>);
                rows.push(
                    <div key="mother_gt" className="d-block text-truncate">
                        <i className="text-small icon icon-circle icon-fw far mr-04" data-tip="Mother Genotype"/>
                        { mother_genotype_label || "-" }
                    </div>
                );
            }
            if (father_genotype_label) {
                // rows.push(<div key="father_gt" className="d-block text-truncate"><span className="font-italic">Father: </span>{father_genotype_label || "-"}</div>);
                rows.push(
                    <div key="father_gt" className="d-block text-truncate">
                        <i className="text-small icon icon-square icon-fw far mr-04" data-tip="Father Genotype"/>
                        { father_genotype_label || "-" }
                    </div>
                );
            }
            return <StackedRowColumn className={"text-" + align} {...{ rows }}/>;
        }
    },
    // "Gene, Transcript" column
    "variant.genes.genes_most_severe_gene.display_title": {
        // Also includes "variant.genes.genes_most_severe_transcript"
        // TODO: Update with onclick to handle google analytics tracking
        widthMap: { 'lg' : 155, 'md' : 140, 'sm' : 130 },
        render: function(result, props) {
            const { "@id" : atID = null, variant : { genes = [] } = {} } = result;
            const { link = null, align = "center" } = props;

            const geneTitles = genes.map((geneItem) => {
                const { genes_most_severe_gene: { display_title = null } = {} } = geneItem || {};
                return display_title;
            });
            if (genes.length > 0) {
                const { genes_most_severe_transcript = null } = genes[0] || {};
                const rows = [
                    <span key="genes_ensg" className="d-block text-truncate">{ geneTitles.length > 1 ? geneTitles.join() : geneTitles } </span>,
                    <span data-tip="Most Severe Transcript" key="genes_severe_transcript" className="font-italic d-block text-truncate text-small">{ genes_most_severe_transcript}</span>
                ];
                return (
                    <a href={link ? link : atID ? atID + '?annotationTab=0' : "#"}>
                        <StackedRowColumn className={"text-" + align} {...{ rows }} />
                    </a>
                );
            }
            return null;
        }
    },
    // "Coding & Protein Sequence" col (existing 'Variant' column)
    "variant.genes.genes_most_severe_hgvsc": {
        // Also renders "variant.genes.genes_most_severe_hgvsp"
        // TODO: Update with onclick to handle google analytics tracking
        widthMap: { 'lg' : 140, 'md' : 130, 'sm' : 120 },
        render: function(result, props) {
            const { link = null, align = "center" } = props;
            const { "@id" : atID = null, variant : { genes : [ firstGene = null ] = [] } = {} } = result;
            const { genes_most_severe_hgvsc = null, genes_most_severe_hgvsp = null } = firstGene || {};

            if (!genes_most_severe_hgvsc && !genes_most_severe_hgvsp) {
                return null;
            }

            return (
                <a href={link ? link : (atID ? atID + '?annotationTab=1' : "#")}>
                    <GenesMostSevereHGVSCColumn gene={firstGene} {...{ align }} />
                </a>
            );
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
    },
    'bam_snapshot': {
        "noSort": true,
        "widthMap": { 'lg' : 60, 'md' : 60, 'sm' : 60 },
        "colTitle": <i className="icon icon-fw icon-image fas" />,
        "render": function(result, props) {
            const { bam_snapshot = null, uuid = null } = result;
            if (bam_snapshot) {
                return (
                    <div className="mx-auto text-truncate">
                        <a target="_blank" className="btn btn-outline-dark btn-sm" rel="noreferrer"
                            href={`/${uuid}/@@download`} data-html data-tip="View BAM Snapshot <i class='ml-07 icon-sm icon fas icon-external-link-alt'></i>">
                            <i className="icon icon-fw icon-image fas" />
                        </a>
                    </div>
                );
            }
            return null;
        }
    }
};

export const structuralVariantSampleColumnExtensionMap = {
    // Worst Transcript col
    "structural_variant.worst_transcript": {
        /** TODO: Update worst consequence with data from SV col ext map once highlighted gene functionality is added to interpretation space */
        render: (result, props) => <div className="text-muted text-small">Highlighted Gene <br/>Not Selected</div>,
    },
    // Gene, Transcript col
    "structural_variant.transcript": {
        render: (result, props) => {
            const { "@id": atID, structural_variant: { transcript: transcripts = [] } = {} } = result || {};
            const { align = "left" } = props || {};

            const path = atID + "?annotationTab=0";

            const transcriptsDeduped = {};
            transcripts.forEach((transcript) => {
                const { csq_gene: { display_title = null } = {} } = transcript;
                transcriptsDeduped[display_title] = true;
            });
            const genes = Object.keys(transcriptsDeduped);

            const rows = [];

            if (genes.length <= 2) { // show comma separated
                rows.push(
                    <div className="text-small">
                        <span className="text-muted">List:&nbsp;</span>
                        <a href={path} target="_blank" rel="noreferrer">{genes.join(", ")}</a>
                    </div>);
            } else {
                // show first and last gene separated by "..." with first 10 available on hover in first row
                const lastItemIndex = genes.length >= 10 ? 10 : genes.length;
                const tipGenes = genes.slice(0, lastItemIndex).join(", ");
                rows.push(
                    <div className="text-small">
                        <span className="text-muted">List:</span>
                        <a href={path} target="_blank" rel="noreferrer" data-tip={tipGenes}>{`${genes[0]}...${genes[genes.length-1]}`}</a>
                    </div>);
            }

            rows.push(
                <div className="text-muted">
                    <i className="icon icon-star fas" />:&nbsp;
                    <span className="text-small">Not Selected</span>
                </div>);

            return (<div className="w-100"><StackedRowColumn className={"text-" + align} {...{ rows }} /></div>);
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
    const { display_title = null, ID = null } = variant || {};

    const cls = ("title-block" + (className ? " " + className : ""));
    const rows = [
        <span key={0} className="d-block text-600 text-truncate">
            { display_title }
        </span>
    ];

    if (ID) {
        rows.push(<span key={1} className="font-italic">{ ID }</span>);
    }

    return (
        <a key="title" href={link || '#'} onClick={onClick} className="d-block text-truncate">
            <StackedRowColumn className={cls} {...{ rows }}  />
        </a>
    );
});

/** An edited version of SPC's DisplayTitleColumnDefault, used in CaseViewEmbeddedVariantSampleSearchTableSV */
export const VariantSampleDisplayTitleColumnSV = React.memo(function VariantSampleDisplayTitleColumn(props) {
    const { result = null, link, onClick, className = null } = props;
    const {
        "@id": atID,
        structural_variant: {
            display_title = "",
            annotation_id = ""
        } = {}
    } = result || {};

    const cls = ("title-block" + (className ? " " + className : ""));

    // annotationID structured like <type>_chr...etc; need just the part after underscore
    const [ , splitAnnotationIDSuffix ] = (annotation_id || display_title).split("_");

    const rows = [
        <span key={0} className="d-block text-600 text-truncate">{ splitAnnotationIDSuffix }</span>
    ];

    // TODO setup the analytics tracking in place of having `onClick` do it, or have props.onClick
    // (defined in SPC's basicColumnExtensionMap>DisplayTitleColumnWrapper) handle target="_blank".

    return (
        <a key="title" href={link || atID} target="_blank" rel="noopener noreferrer" className="d-block text-truncate">
            <StackedRowColumn className={cls} {...{ rows }}  />
        </a>
    );
});

const GenesMostSevereHGVSCColumn = React.memo(function GenesMostSevereHGVSCColumn({ gene, align = "center" }){
    const {
        genes_most_severe_hgvsc = null,
        genes_most_severe_hgvsp = null
    } = gene || {};

    const rows = [];
    // Memoized on the 1 prop it receives which is dependency for its calculation.
    if (genes_most_severe_hgvsc) {
        const hgvscSplit = genes_most_severe_hgvsc.split(":");
        const scSplit = hgvscSplit[1].split(".");
        rows.push(
            <div className="text-truncate d-block" key="sc">
                <span className="text-600">{ scSplit[0] }.</span><span>{ scSplit[1] }</span>
            </div>
        );
    }

    if (genes_most_severe_hgvsp) {
        const hgvspSplit = genes_most_severe_hgvsp.split(":");
        const spSplit = hgvspSplit[1].split(".");
        rows.push(
            <div className="text-truncate d-block" key="sp">
                <span className="text-600">{ spSplit[0] }.</span><span>{ spSplit[1] }</span>
            </div>
        );
    }

    return <StackedRowColumn className={"text-" + align} {...{ rows }} />;
});

