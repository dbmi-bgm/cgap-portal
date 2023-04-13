import React, { useContext } from 'react';
import { Accordion, AccordionContext, useAccordionToggle } from 'react-bootstrap';

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
                {/* <div className="card-body">
                    / / TODO: Bioinfo Stats Table goes here
                </div> */}
            </div>
            <div className="tab-inner-container card">
                <h4 className="card-header section-header py-3">Analysis Generated Files</h4>
                <div className="card-body">
                    / / TODO: Files and Provenance Links Table goes here
                </div>
            </div>
        </React.Fragment>
    );
});

const SomaticBioinfoStats = React.memo(function BioinfoStats({ context }) {
    const { samples = [] } = context;

    return (<SQCMAccordion {...{ samples }} />);
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
                    {(coverage.value && coverage.flag) && <i className={`icon icon-flag fas text-${flagToBootstrapClass(coverage.flag)} ml-05`} />}
                </BioinfoStatsEntry>
                <BioinfoStatsEntry label="Mean Insert Length">
                    {fallbackElem}
                </BioinfoStatsEntry>
                <BioinfoStatsEntry/>
            </div>
        </React.Fragment>
    );
}


function SQCMAccordion({ samples = [] }) {

    if (samples.length === 0) {
        return <div className="m-4">No Samples Available</div>;
    }

    return (
        <Accordion defaultActiveKey={samples[0]["@id"]} className="w-100">
            {samples.map((sample, i) => <SQCMAccordionDrawer key={sample["@id"]} idx={i} qcmLen={samples.length} {...{ sample }} />)}
        </Accordion>
    );
}


function SQCMAccordionDrawer(props) {
    const { sample, idx, qcmLen } = props || {};
    const {
        "@id": sampleAtID,
        tissue_type: tissueType,
        individual: { "@id": atID, display_title: individual_id, accession: individual_accession } = {},
        warn = [],
        fail = [],
        sequencing_type: sequencingType,
        bam_sample_id: sampleID,
        specimen_type: specimenType
    } = sample || {};

    const warnFlags = warn.map((flag) => <QCMFlag key={flag} type="warn" title={flag} />);
    const failFlags = fail.map((flag) => <QCMFlag key={flag} type="fail" title={flag} />);

    return (
        <div className={`card border-left-0 border-right-0 ${idx === 0 ? "border-top-0" : ""} ${idx === (qcmLen - 1) ? "border-bottom-0" : ""}`} key={atID}>
            <SQCMAccordionToggle eventKey={sampleAtID} {...{ tissueType, sequencingType, sampleID, specimenType }}>
                <div className="d-flex align-items-center justify-items-center ml-2 ml-sm-0">
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
                        <a href={atID} className="text-uppercase text-600 d-block text-small mr-2">{individual_id || individual_accession}</a>
                    </div>
                    <div className="card-body px-5">
                        <SomaticBioinfoStatTable {...{ sample }}/>
                    </div>
                </>
            </Accordion.Collapse>
        </div>
    );
}

function SQCMAccordionToggle({ children, eventKey, callback, tissueType, sequencingType, specimenType, sampleID }) {
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
                    {tissueType ? `${tissueType}:` : ""}
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