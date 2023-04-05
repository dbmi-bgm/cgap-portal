'use strict';

import React, { useContext } from 'react';
import { Accordion, AccordionContext, useAccordionToggle } from 'react-bootstrap';

import { decorateNumberWithCommas } from '@hms-dbmi-bgm/shared-portal-components/es/components/util/value-transforms';

import { CaseSummaryTable } from './CaseSummaryTable';
import { flagToBootstrapClass, generateRelationshipMapping, mapLongFormSexToLetter, sortAndAddRolePropsToQCMs } from '../../util/item';
import QuickPopover from '../components/QuickPopover';
import { QCMFlag } from '../components/QCM';


export const BioinformaticsTab = React.memo(function BioinformaticsTab(props) {
    const {
        context,
        idToGraphIdentifier,
        canonicalFamily
    } = props;
    const {
        sample_processing: sampleProcessing = null,
        sample: caseSample = null,
        vcf_file: vcf = null,
        individual: { sex: submittedSex = null, ancestry: submittedAncestry = [] } = {},
    } = context;
    const { "@id": vcfAtId = null } = vcf || {};

    const {
        // original_pedigree: { display_title: pedFileName } = {},
        display_title: familyDisplayTitle,
        relationships = []
    } = canonicalFamily;

    const title = (
        <h4 data-family-index={0} className="my-0 d-inline-block w-100">
            <span className="text-400">{familyDisplayTitle}</span>
            {/* { pedFileName ? <span className="text-300">{ " (" + pedFileName + ")" }</span> : null } */}
            <a href={vcfAtId + "#provenance"} className="btn btn-sm btn-primary pull-right d-flex align-items-center"
                data-tip="Click to view the provenance graph for the most up-to-date annotated VCF"
                disabled={(!vcfAtId)}>
                <i className="icon icon-fw icon-sitemap icon-rotate-90 fas mr-08 small" />
                <span className="mr-03">View</span><span className="text-600">Provenance Graph</span>
            </a>
        </h4>
    );

    // Create a mapping of individuals to relationship and sex
    const relationshipMapping = generateRelationshipMapping(relationships);

    return (
        <React.Fragment>
            <h1><span className="text-300">Bioinformatics Analysis</span></h1>
            {/* TODO: See if there's any desire to include QC statuses here (BAM, SNV, SV, etc.)
            <div className="tab-inner-container clearfix font-italic qc-status">
                <span className="text-600">Current Status:</span><span className="text-success"> PASS <i className="icon icon-check fas"></i></span>
                <span className="pull-right">3/28/20</span>
            </div> */}
            <div className="tab-inner-container card">
                <h4 className="card-header section-header py-3">Quality Control Metrics (QC)</h4>
                <BioinfoStats {...{ caseSample, canonicalFamily, sampleProcessing, submittedAncestry, submittedSex, idToGraphIdentifier, relationshipMapping }} />
            </div>
            <div className="tab-inner-container card">
                <h4 className="card-header section-header py-3">Multisample Analysis Table</h4>
                <div className="card-body family-index-0" data-is-current-family={true}>
                    {title}
                    <CaseSummaryTable family={canonicalFamily} sampleProcessing={[sampleProcessing]} isCurrentFamily={true} idx={0} {...{ idToGraphIdentifier, relationshipMapping }} />
                </div>
            </div>
        </React.Fragment>
    );
});

const bioinfoPopoverContent = {
    predictedSexAndAncestry: (
        <div>
            Sex and ancestry of each sample is predicted using the QC tool <a href="https://github.com/brentp/peddy" target="_blank" rel="noreferrer">peddy</a>.
            For more info see peddy’s <a href="https://peddy.readthedocs.io/en/latest/" target="_blank" rel="noreferrer">documentation</a>.
        </div>
    ),
    filteredSNVIndelVariants: (
        <div>
            During processing, <a href="https://cgap-pipeline-main.readthedocs.io/en/latest/Pipelines/Downstream/SNV_germline/Pages/SNV_germline-step-filtering.html" target="_blank" rel="noreferrer">hard filters are applied</a> to
            remove variants that will not be of interest. This lowers the number of variants returned from the millions to the thousands.
            Briefly, these filters include: (1) removing intergenic variants; (2) including some variants based on VEP, ClinVar, and SpliceAI
            annotations; (3) Removing variants with only intronic consequences; and (4) removing common variants based on gnomAD population allele
            frequency and a panel of unrelated samples.
        </div>
    ),
    filteredSVVariants: (
        <div>
            During processing, <a href="https://cgap-pipeline-main.readthedocs.io/en/latest/Pipelines/Downstream/SV_germline/Pages/SV_germline-step-part-3.html" target="_blank" rel="noreferrer">hard filters are applied</a> to
            remove structural variants (SVs) that will not be of interest. This limits the numbers and types of SVs returned from thousands
            to fewer than 500. Briefly, these filters include: (1) including SVs based on VEP annotations; (2) removing SVs with only intronic
            or intergenic consequences; (3) selecting SVs based on SV type (e.g., DEL and DUP); (3) removing common variants based on gnomAD-SV
            population allele frequency, and a panel of 20 unrelated samples; and (4) removing SVs over a certain size.
            <p>
                Note: SVs are only available for WGS samples.
            </p>
        </div>
    ),
    heterozygosity: (
        <div>
            The Heterozygosity/Homozygosity ratio is calculated by bcftools. Expected values are between 1.4 - 2.5; higher or lower values can indicate lower quality calls.
        </div>
    ),
    transTransRatio: (
        <div>
            The Transition/Transversion ratio is calculated by bcftools. Expected values are 1.8-2.1 overall for WGS, and 2.2-3.3 for WES. Values outside this range can indicate lower accuracy of calls.
        </div>
    ),
    coverage: (
        <div>
            Coverage is calculated by samtools. For WGS samples, expected values are
            &gt; 25X, and failures are &lt; 10X. For WES samples, expected values are
            &gt; 70X, and failures are &lt; 40X.
        </div>
    )
};



const BioinfoStats = React.memo(function BioinfoStats(props) {
    const { canonicalFamily, caseSample = null, sampleProcessing = null, idToGraphIdentifier, relationshipMapping } = props;

    return (<QCMAccordion {...{ sampleProcessing, canonicalFamily, relationshipMapping, idToGraphIdentifier }} />);
});

function BioinfoStatTable({ qualityControlMetrics }) {
    const {
        total_reads: reads = {},
        coverage = {},
        total_variants_called: totalSNVIndelVars = {},
        transition_transversion_ratio: transTransRatio = {},
        heterozygosity_ratio: heterozygosity = {},
        de_novo_fraction: deNovo = {},
        filtered_variants: filteredSNVIndelVariants = {},
        filtered_structural_variants: filteredSVVariants = {},
        predicted_sex: predictedSex = {},
        predicted_ancestry: predictedAncestry = {},
        sex: submittedSex = {},
        ancestry: { value: submittedAncestry = [] } = {}
    } = qualityControlMetrics;

    const fallbackElem = "-";

    return (
        <React.Fragment>
            <div className="row py-0">
                <BioinfoStatsEntry label="Total Number of Reads">
                    {reads.value ? decorateNumberWithCommas(+reads.value) : fallbackElem}
                </BioinfoStatsEntry>
                <BioinfoStatsEntry label="Coverage" popoverContent={bioinfoPopoverContent.coverage}>
                    {coverage.value || fallbackElem}
                    {(coverage.value && coverage.flag) && <i className={`icon icon-flag fas text-${flagToBootstrapClass(coverage.flag)} ml-05`} />}
                </BioinfoStatsEntry>
                <BioinfoStatsEntry label="Total Number of SNVs/Indels called">
                    {totalSNVIndelVars.value ? decorateNumberWithCommas(+totalSNVIndelVars.value) : fallbackElem}
                </BioinfoStatsEntry>
                <BioinfoStatsEntry label="Transition-Transversion ratio" popoverContent={bioinfoPopoverContent.transTransRatio}>
                    {transTransRatio.value || fallbackElem}
                    {(transTransRatio.value && transTransRatio.flag) && <i className={`icon icon-flag fas text-${flagToBootstrapClass(transTransRatio.flag)} ml-05`} />}
                </BioinfoStatsEntry>
            </div>
            <div className="row py-0">
                <BioinfoStatsEntry label="Submitted Sex" >
                    {submittedSex.value || fallbackElem}
                </BioinfoStatsEntry>
                <BioinfoStatsEntry label="Predicted Sex" popoverContent={bioinfoPopoverContent.predictedSexAndAncestry}>
                    {mapLongFormSexToLetter(predictedSex.value) || fallbackElem}&nbsp;
                    {!!predictedSex.link && <a href={predictedSex.link} target="_blank" rel="noreferrer" className="text-small">(see peddy QC report)</a>}
                    {predictedSex.flag && <i className={`icon icon-flag fas text-${flagToBootstrapClass(predictedSex.flag)} ml-02`} />}
                </BioinfoStatsEntry>
                <BioinfoStatsEntry label="Heterozygosity ratio" popoverContent={bioinfoPopoverContent.heterozygosity}>
                    {heterozygosity.value || fallbackElem}
                    {(heterozygosity.value && heterozygosity.flag) && <i className={`icon icon-flag fas text-${flagToBootstrapClass(heterozygosity.flag)} ml-05`} />}
                </BioinfoStatsEntry>
                <BioinfoStatsEntry label="SNVs/Indels After Hard Filters" popoverContent={bioinfoPopoverContent.filteredSNVIndelVariants}>
                    {filteredSNVIndelVariants.value ? decorateNumberWithCommas(+filteredSNVIndelVariants.value) : fallbackElem}
                </BioinfoStatsEntry>
            </div>
            <div className="row py-0">
                <BioinfoStatsEntry label="Submitted Ancestry" >
                    {submittedAncestry.length > 0 && submittedAncestry.join(", ") || "-"}
                </BioinfoStatsEntry>
                <BioinfoStatsEntry label="Predicted Ancestry" popoverContent={bioinfoPopoverContent.predictedSexAndAncestry}>
                    {predictedAncestry.value || fallbackElem}&nbsp;
                    {!!predictedAncestry.link && <a href={predictedAncestry.link} target="_blank" rel="noreferrer" className="text-small">(see peddy QC report)</a>}
                </BioinfoStatsEntry>
                <BioinfoStatsEntry label="SNV/Indel De novo Fraction">
                    {deNovo.value || fallbackElem}
                    {(deNovo.value && deNovo.flag) && <i className={`icon icon-flag fas text-${flagToBootstrapClass(deNovo.flag)} ml-05`} />}
                </BioinfoStatsEntry>
                <BioinfoStatsEntry label="Structural Variants After Hard Filters" popoverContent={bioinfoPopoverContent.filteredSVVariants}>
                    {filteredSVVariants.value ? decorateNumberWithCommas(+filteredSVVariants.value) : fallbackElem}
                </BioinfoStatsEntry>
            </div>
        </React.Fragment>
    );
}

function BioinfoStatsEntry({ tooltip, label, children, popoverContent = null }) {
    const id = "biostatsentry_" + label.split(" ").join("_");
    return (
        <div className="col-12 col-md-6 col-lg-3 col-xl-3 py-2">
            <div className="qc-summary">
                <label className="d-inline mb-0" htmlFor={id}>
                    {label}:
                    {!popoverContent && tooltip ?
                        <i className="icon icon-info-circle fas icon-fw ml-05"
                            data-tip={tooltip} data-place="right" />
                        : null}
                </label>
                {popoverContent ? <QuickPopover popID={label} tooltip={tooltip || "Click for more info"} className="p-0 ml-05">{popoverContent}</QuickPopover> : null}
                <div {...{ id }}>{children}</div>
            </div>
        </div>
    );
}

function QCMAccordion(props) {
    const {
        canonicalFamily = {},
        sampleProcessing = {},
        idToGraphIdentifier,
        relationshipMapping = {}
    } = props || {};

    const {
        quality_control_metrics = [],
    } = sampleProcessing;

    const qcmLen = quality_control_metrics.length;

    if (qcmLen === 0) {
        return <div className="m-4">No Quality Control Metrics Available</div>;
    }

    const sortedQCMs = sortAndAddRolePropsToQCMs(quality_control_metrics, relationshipMapping);

    return (
        <Accordion defaultActiveKey={sortedQCMs[0].atID} className="w-100">
            {sortedQCMs.map((qcm, i) => <QCMAccordionDrawer key={qcm.individual_accession} idx={i} {...{ idToGraphIdentifier, relationshipMapping, qcmLen }} qualityControlMetrics={qcm} />)}
        </Accordion>
    );
}


function QCMAccordionDrawer(props) {
    const { idToGraphIdentifier, qualityControlMetrics, idx, qcmLen } = props || {};
    const {
        atID,
        role,
        individual_id,
        individual_accession,
        warn = [],
        fail = [],
        sequencing_type: sequencingType,
        bam_sample_id: sampleID,
        specimen_type: specimenType
    } = qualityControlMetrics || {};

    const warnFlags = warn.map((flag) => <QCMFlag key={flag} type="warn" title={flag} />);
    const failFlags = fail.map((flag) => <QCMFlag key={flag} type="fail" title={flag} />);

    return (
        <div className={`card border-left-0 border-right-0 ${idx === 0 ? "border-top-0" : ""} ${idx === (qcmLen - 1) ? "border-bottom-0" : ""}`} key={atID}>
            <QCMAccordionToggle eventKey={atID} {...{ role, sequencingType, sampleID, specimenType }}>
                <div className="d-flex align-items-center justify-items-center ml-2 ml-sm-0">
                    {failFlags}
                    {warnFlags}
                </div>
            </QCMAccordionToggle>
            <Accordion.Collapse eventKey={atID}>
                <>
                    <div className="card-body d-flex align-items-center py-1 px-5" style={{
                        /** @TODO: Move these styles to SCSS */
                        backgroundColor: "#f4f4f4",
                        borderTop: "1px solid rgba(0, 0, 0, 0.08)",
                        borderBottom: "1px solid rgba(0, 0, 0, 0.08)"
                    }}>
                        <a href={atID} className="text-uppercase text-600 d-block text-small mr-2">{individual_id || individual_accession}</a>
                        <span className="gen-identifier text-600 text-serif text-small pt-03">{idToGraphIdentifier[atID]}</span>&nbsp;
                    </div>
                    <div className="card-body px-5">
                        <BioinfoStatTable {...{ qualityControlMetrics }} />
                    </div>
                </>
            </Accordion.Collapse>
        </div>
    );
}

function QCMAccordionToggle({ children, eventKey, callback, role, sequencingType, specimenType, sampleID }) {
    const activeEventKey = useContext(AccordionContext);

    const decoratedOnClick = useAccordionToggle(
        eventKey,
        () => callback && callback(eventKey),
    );

    const isCurrentEventKey = activeEventKey === eventKey;

    const icon = isCurrentEventKey ? "minus" : "plus";

    return (
        <div onClick={decoratedOnClick} className="card-header btn d-flex justify-content-between justify-items-center flex-column flex-sm-row">
            <div className="d-flex align-items-center justify-items-center">
                <i className={`icon icon-${icon} fas mr-1`} />
                <div className="d-flex flex-column flex-lg-row flex-xl-row justify-content-center text-left text-truncate text-600 text-capitalize text-larger pl-03">
                    {role ? `${role}:` : ""}
                    <div className="ml-lg-05 ml-xl-05 mr-05 text-400 text-capitalize d-inline-block text-truncate">
                        {specimenType && sequencingType ? `${specimenType} - ${sequencingType}` :
                            specimenType ? specimenType : sequencingType}
                    </div>
                    <div className="text-400 text-muted text-truncate d-inline-block">
                        {sampleID ? `(${sampleID})` : ""}
                    </div>
                </div>
            </div>
            {children}
        </div>
    );
}