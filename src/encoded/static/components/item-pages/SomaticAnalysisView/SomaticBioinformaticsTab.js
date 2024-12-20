import React, { useContext } from 'react';
import { Accordion, AccordionContext, useAccordionButton } from 'react-bootstrap';

import { decorateNumberWithCommas } from '@hms-dbmi-bgm/shared-portal-components/es/components/util/value-transforms';

import { BioinfoStatsEntry, QCMFlag } from '../components/QCM';

export const SomaticBioinformaticsTab = React.memo(function SomaticBioinformaticsTab(props) {
    const {
        context,
        href
    } = props;

    return (
        <React.Fragment>
            <h1 className="text-300">Bioinformatics Analysis</h1>
            <div className="tab-inner-container card">
                <h4 className="card-header section-header py-3">Sample Quality Control Metrics (QC)</h4>
                <SomaticBioinfoStats {...{ context }} />
            </div>
            {/* <div className="tab-inner-container card">
                <h4 className="card-header section-header py-3">Analysis Generated Files</h4>
                <div className="card-body">
                    / / TODO: Files and Provenance Links Table goes here
                </div>
            </div> */}
        </React.Fragment>
    );
});

const SomaticBioinfoStats = React.memo(function BioinfoStats({ context }) {
    const { samples = [], individual = {} } = context;

    return (<SQCMAccordion {...{ samples, individual }} />);
});


function SomaticBioinfoStatTable({ sample }) {
    const {
        total_reads: reads = {},
        coverage = {},
        total_variants_called: totalSNVIndelVars = {},
    } = sample;

    const fallbackElem = "-";

    return (
        <React.Fragment>
            <div className="row py-0">
                <BioinfoStatsEntry label="Total Number of Reads">
                    {reads.value ? decorateNumberWithCommas(+reads.value) : fallbackElem}
                </BioinfoStatsEntry>
                <BioinfoStatsEntry label="Coverage" popoverContent="">
                    {coverage.value || fallbackElem}
                    {(coverage.value && coverage.flag) && <i className={`icon icon-flag fas text-${flagToBootstrapClass(coverage.flag)} ms-05`} />}
                </BioinfoStatsEntry>
                <BioinfoStatsEntry label="Mean Insert Length">
                    {fallbackElem}
                </BioinfoStatsEntry>
                <BioinfoStatsEntry/>
            </div>
        </React.Fragment>
    );
}


function SQCMAccordion({ samples = [], individual = {} }) {

    if (samples.length === 0) {
        return <div className="m-4">No Samples Available</div>;
    }

    return (
        <Accordion defaultActiveKey={samples[0]["@id"]} className="w-100">
            {samples.map((sample, i) => <SQCMAccordionDrawer key={sample["@id"]} idx={i} qcmLen={samples.length} {...{ sample, individual }} />)}
        </Accordion>
    );
}


function SQCMAccordionDrawer(props) {
    const { sample, individual, idx, qcmLen } = props || {};
    const {
        "@id": sampleAtID,
        tissue_type: tissueType,
        warn = [],
        fail = [],
        sequencing_type: sequencingType,
        bam_sample_id: sampleID,
        specimen_type: specimenType
    } = sample || {};
    const {
        "@id": atID, display_title: individual_id, accession: individual_accession
    } = individual || {};

    const warnFlags = warn.map((flag) => <QCMFlag key={flag} type="warn" title={flag} />);
    const failFlags = fail.map((flag) => <QCMFlag key={flag} type="fail" title={flag} />);

    return (
        <div className={`card border-start-0 border-end-0 ${idx === 0 ? "border-top-0" : ""} ${idx === (qcmLen - 1) ? "border-bottom-0" : ""}`} key={atID}>
            <SQCMAccordionToggle eventKey={sampleAtID} {...{ tissueType, sequencingType, sampleID, specimenType }}>
                <div className="d-flex align-items-center justify-items-center ms-2 ms-sm-0">
                    {failFlags}
                    {warnFlags}
                </div>
            </SQCMAccordionToggle>
            <Accordion.Collapse eventKey={sampleAtID}>
                <>
                    <div className="card-body d-flex align-items-center py-1 px-5" style={{
                        /** @TODO: Move these styles to SCSS */
                        backgroundColor: "#f4f4f4",
                        borderTop: "1px solid rgba(0, 0, 0, 0.08)",
                        borderBottom: "1px solid rgba(0, 0, 0, 0.08)"
                    }}>
                        <a href={atID} className="text-uppercase text-600 d-block text-small me-2 link-underline-hover">{individual_id || individual_accession}</a>
                    </div>
                    <div className="card-body px-5">
                        <SomaticBioinfoStatTable {...{ sample, individual }}/>
                    </div>
                </>
            </Accordion.Collapse>
        </div>
    );
}

function SQCMAccordionToggle({ children, eventKey, callback, tissueType, sequencingType, specimenType, sampleID }) {
    const { activeEventKey } = useContext(AccordionContext);

    const decoratedOnClick = useAccordionButton(
        eventKey,
        () => callback && callback(eventKey),
    );

    const isCurrentEventKey = activeEventKey === eventKey;

    const icon = isCurrentEventKey ? "minus" : "plus";

    return (
        <div onClick={decoratedOnClick} className="card-header btn d-flex justify-content-between justify-items-center flex-column flex-sm-row">
            <div className="d-flex align-items-center justify-items-center">
                <i className={`icon icon-${icon} fas me-1`} />
                <div className="d-flex flex-column flex-lg-row flex-xl-row justify-content-center text-start text-truncate text-600 text-capitalize text-larger ps-03">
                    {tissueType ? `${tissueType}:` : ""}
                    <div className="ms-lg-05 ms-xl-05 me-05 text-400 text-capitalize d-inline-block text-truncate">
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