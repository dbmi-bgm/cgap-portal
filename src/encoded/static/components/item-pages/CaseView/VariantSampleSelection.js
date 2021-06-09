'use strict';

import React, { useCallback, useMemo, useState } from 'react';
import queryString from 'query-string';
import moment from 'moment';
import DropdownButton from 'react-bootstrap/esm/DropdownButton';
import { LocalizedTime } from '@hms-dbmi-bgm/shared-portal-components/es/components/ui/LocalizedTime';
import { Checkbox } from '@hms-dbmi-bgm/shared-portal-components/es/components/forms/components/Checkbox';
import { variantSampleColumnExtensionMap, VariantSampleDisplayTitleColumn } from './../../browse/variantSampleColumnExtensionMap';


/**
 * @module
 * This file contains the VariantSampleSelection item, which is shared between InterpretationTab and Finalize Case tab.
 */


// Using integers here for faster comparisons.
export const parentTabTypes = {
    "INTERPRETATION": 1,
    "FINALIZECASE": 2
};


/**
 * Shows list of variant sample selections, or loading icon, depending on props.
 */
export const VariantSampleSelectionList = React.memo(function VariantSampleSelectionList (props) {
    const {
        variantSampleListItem,
        schemas,
        context,
        isLoadingVariantSampleListItem = false,
        parentTabType = parentTabTypes.INTERPRETATION
    } = props;
    const { variant_samples: vsSelections = [] } = variantSampleListItem || {};

    if (isLoadingVariantSampleListItem) {
        return (
            <h4 className="text-400 text-center text-muted">
                <i className="icon icon-spin icon-circle-notch icon-2x fas"/>
            </h4>
        );
    } else if (vsSelections.length === 0) {
        return (
            <h4 className="text-400">No selections added yet</h4>
        );
    } else {
        return vsSelections.map(function(selectionSubObject, idx){
            return (
                <VariantSampleSelection {...{ schemas, context, parentTabType }}
                    selection={selectionSubObject} key={idx} index={idx} />
            );
        });
    }
});


/**
 * For now, we just re-use the column render func from some VariantSample columns
 * as value 'cells' of this card.
 */
const {
    "variant.genes.genes_most_severe_gene.display_title": { render: geneTranscriptRenderFunc },
    "variant.genes.genes_most_severe_hgvsc": { render: variantRenderFunc },
    "associated_genotype_labels.proband_genotype_label": { render: genotypeLabelRenderFunc },
} = variantSampleColumnExtensionMap;

export const VariantSampleSelection = React.memo(function VariantSampleSelection(props){
    const {
        selection,  // VariantSample Item
        index,
        context,    // Case
        schemas,
        parentTabType = parentTabTypes.INTERPRETATION
    } = props;
    const { accession: caseAccession } = context; // `context` refers to our Case in here.
    const {
        date_selected,
        filter_blocks_request_at_time_of_selection,
        variant_sample_item
    } = selection;


    // TODO: Consider if should just re-use state.isExpanded for "Actions" btn, expanding to show a menu..
    const [ isExpanded, setIsExpanded ] = useState(false); // Can move this state up if have pagination or infinite scroll or something in future.
    const toggleIsExpanded = useCallback(function(e){
        e.stopPropagation();
        setIsExpanded(!isExpanded);
    }, [ isExpanded ]);

    const {
        "VariantSample": {
            columns: {
                "variant.genes.genes_most_severe_gene.display_title": {
                    title: geneTranscriptColTitle,
                    description: geneTranscriptColDescription
                } = {},
                "variant.genes.genes_most_severe_hgvsc": {
                    title: variantColTitle,
                    description: variantColDescription
                } = {},
                "associated_genotype_labels.proband_genotype_label": {
                    title: genotypeLabelColTitle,
                    description: genotypeLabelColDescription
                } = {}
            } = {}
        } = {}
    } = schemas || {};

    const { "@id": vsID, interpretation = null, discovery_interpretation = null } = variant_sample_item || {};
    const { classification: acmgClassification = null } = interpretation || {};
    const { gene_candidacy: geneCandidacy = null, variant_candidacy: variantCandidacy = null } = discovery_interpretation || {};
    return (
        <div className="card mb-1" key={index}>
            <div className="card-header">
                <div className="d-flex flex-column flex-lg-row align-items-lg-center">

                    <div className="flex-auto mb-08 mb-lg-0">
                        <VariantSampleDisplayTitleColumn result={variant_sample_item}
                            link={`${vsID}?showInterpretation=True&interpretationTab=1${caseAccession ? '&caseSource=' + caseAccession : ''}`} />
                    </div>

                    <div className="flex-grow-1 d-none d-lg-block px-2">&nbsp;</div>

                    <div className="flex-auto">

                        { parentTabType === parentTabTypes.FINALIZECASE ?
                            <button type="button" className="btn btn-sm btn-primary" onClick={toggleIsExpanded}>
                                <i className={"icon fas mr-07 icon-" + (!isExpanded ? "plus" : "minus")} />
                                { !isExpanded ? "Review Variant Notes & Classification" : "Hide Variant Notes & Classification" }
                            </button>
                            : null }

                        { parentTabType === parentTabTypes.INTERPRETATION ?
                            <DropdownButton size="sm" variant="light" className="d-inline-block ml-07" disabled title={
                                <React.Fragment>
                                    <i className="icon icon-bars fas mr-07"/>
                                    Actions
                                </React.Fragment>
                            }>
                                TODO
                            </DropdownButton>
                            : null }

                    </div>
                </div>
            </div>

            <div className="card-body pt-0 pb-08">
                <div className="row flex-column flex-sm-row">
                    <div className="col col-sm-4 col-lg-2 py-2">
                        <label className="mb-04 text-small" data-tip={geneTranscriptColDescription}>
                            { geneTranscriptColTitle || "Gene, Transcript" }
                        </label>
                        { geneTranscriptRenderFunc(variant_sample_item, { align: 'left', link: vsID + '?showInterpretation=True&annotationTab=0&interpretationTab=1' + (caseAccession ? '&caseSource=' + caseAccession : '') }) }
                    </div>
                    <div className="col col-sm-4 col-lg-2 py-2">
                        <label className="mb-04 text-small" data-tip={variantColDescription}>
                            { variantColTitle || "Variant" }
                        </label>
                        { variantRenderFunc(variant_sample_item, { align: 'left', link: vsID + '?showInterpretation=True&annotationTab=1' + (caseAccession ? '&caseSource=' + caseAccession : '') }) }
                    </div>
                    <div className="col col-sm-4 col-lg-3 py-2">
                        <label className="mb-04 text-small" data-tip={genotypeLabelColDescription}>
                            { genotypeLabelColTitle || "Genotype" }
                        </label>
                        { genotypeLabelRenderFunc(variant_sample_item, { align: 'left' }) }
                    </div>
                    <div className="col col-sm-4 col-lg-2 py-2">
                        <label className="mb-04 text-small">ACMG Classification</label>
                        { acmgClassification ?
                            <div className="w-100 text-left">
                                <i className="status-indicator-dot mr-1" data-status={acmgClassification}/>
                                {acmgClassification}
                            </div>
                            : <div className="w-100 text-left"><PlaceHolderStatusIndicator /></div> }
                    </div>
                    <div className="col col-sm-8 col-lg-3 py-2">
                        <label className="mb-04 text-small">Discovery</label>
                        <div className="w-100 text-left">
                            <span className="font-italic text-muted d-inline-block" style={{ width: "70px" }}>Gene: </span>
                            { geneCandidacy ?
                                <span className="text-left">
                                    <i className="status-indicator-dot mr-1" data-status={geneCandidacy}/>
                                    {geneCandidacy}
                                </span>
                                : <PlaceHolderStatusIndicator/> }
                        </div>
                        <div className="text-left">
                            <span className="font-italic text-muted d-inline-block" style={{ width: "70px" }}>Variant: </span>
                            { variantCandidacy ?
                                <span className="w-100 text-left">
                                    <i className="status-indicator-dot mr-1" data-status={variantCandidacy}/>
                                    {variantCandidacy}
                                </span>
                                : <PlaceHolderStatusIndicator/> }
                        </div>
                    </div>
                </div>
            </div>

            <div className="card-body border-top attribution-section pt-1 pb-08">
                <div className="d-flex align-items-center">
                    <div className="flex-auto text-small" data-tip="Date Selected">
                        <i className="icon icon-calendar far mr-07"/>
                        <LocalizedTime timestamp={date_selected} />
                    </div>
                </div>
            </div>

            { isExpanded ?
                <VariantSampleExpandedNotes variantSample={variant_sample_item} />
                : null }

        </div>
    );
});

const PlaceHolderStatusIndicator = React.memo(function PlaceHolderStatusIndicator(){
    return (
        <span className="text-left text-muted text-truncate">
            <i className="status-indicator-dot mr-1" data-status="Not Available" />
            Not Available
        </span>
    );
});


function VariantSampleExpandedNotes (props) {
    const { variantSample } = props;
    const {
        interpretation: clinicalInterpretationNote = null,
        discovery_interpretation: discoveryInterpretationNote = null,
        variant_notes: lastVariantNote = null, // = [],
        gene_notes: lastGeneNote = null, // = []
    } = variantSample;

    const {
        classification,
        note_text: clinicalNoteText
    } = clinicalInterpretationNote || {};
    const {
        variant_candidacy,
        gene_candidacy,
        note_text: discoveryNoteText
    } = discoveryInterpretationNote || {};

    // const lastVariantNote = variant_notes[variant_notes.length - 1] || null;
    // const lastGeneNote = gene_notes[gene_notes.length - 1] || null;

    const { note_text: lastVariantNoteText } = lastVariantNote || {};
    const { note_text: lastGeneNoteText } = lastGeneNote || {};

    const noVariantNotesSaved = lastVariantNote === null;
    const noGeneNotesSaved = lastGeneNote === null;
    const noDiscoveryNoteSaved = discoveryInterpretationNote === null;
    const noClinicalNoteSaved = clinicalInterpretationNote === null;

    return (
        <React.Fragment>
            <div className="card-body bg-light select-checkboxes-section border-top border-bottom">
                <Checkbox labelClassName="text-400 mb-08">
                    Send All Notes to Report
                </Checkbox>
                <Checkbox labelClassName="text-400 mb-0">
                    Send All Notes to KnowledgeBase
                </Checkbox>
            </div>
            <div className="card-body notes-section">
                <div className="row">
                    <div className="col-12 col-md-6 col-lg-3">
                        <h4 className="text-300">Variant Notes</h4>
                        <NoteCheckboxes />

                        { !noVariantNotesSaved ?
                            <div className="note-content-area d-flex flex-column">
                                <div className="note-text-content flex-grow-1">
                                    { lastVariantNoteText || <em>Note was left blank</em> }
                                </div>
                            </div>
                            : <div className="text-center pt-16 pb-0"><em>No Variant Notes Saved</em></div> }

                    </div>
                    <div className="col-12 col-md-6 col-lg-3 d-flex flex-column">
                        <h4 className="text-300">Gene Notes</h4>
                        <NoteCheckboxes />

                        { !noGeneNotesSaved ?
                            <div className="note-content-area d-flex flex-column">
                                <div className="note-text-content flex-grow-1">
                                    { lastGeneNoteText || <em>Note was left blank</em> }
                                </div>
                            </div>
                            : <div className="text-center pt-16 pb-0"><em>No Gene Notes Saved</em></div> }

                    </div>
                    <div className="col-12 col-md-6 col-lg-3">
                        <h4 className="text-300">ACMG Interpretation</h4>
                        <NoteCheckboxes />

                        { !noClinicalNoteSaved ?

                            <div className="note-content-area d-flex flex-column">
                                <div className="note-text-content flex-grow-1">
                                    { clinicalNoteText || <em>Note was left blank</em> }
                                </div>

                                <div className="clincical-classification mt-12 flex-grow-0">
                                    <label className="mb-0 mt-08">Classification</label>
                                    <div>
                                        { classification?
                                            <React.Fragment>
                                                <i className="status-indicator-dot ml-1 mr-1" data-status={classification} />{classification}
                                            </React.Fragment>
                                            : <em>None Defined</em> }
                                    </div>
                                </div>
                            </div>

                            : <div className="text-center pt-16 pb-0"><em>No Interpretation Note Saved</em></div> }

                    </div>
                    <div className="col-12 col-md-6 col-lg-3">
                        <h4 className="text-300">Gene Discovery</h4>
                        <NoteCheckboxes />

                        { !noDiscoveryNoteSaved ?

                            <div className="note-content-area d-flex flex-column">
                                <div className="note-text-content flex-grow-1">
                                    { discoveryNoteText || <em>Note was left blank</em> }
                                </div>

                                <div className="discovery-gene-candidacy mt-12 flex-grow-0">
                                    <label className="mb-0 mt-08">Gene Candidacy</label>
                                    <div>
                                        { gene_candidacy ?
                                            <React.Fragment>
                                                <i className="status-indicator-dot ml-1 mr-1" data-status={gene_candidacy} />{gene_candidacy}
                                            </React.Fragment>
                                            : <em>None Defined</em> }
                                    </div>
                                </div>

                                <div className="discovery-variant-candidacy flex-grow-0">
                                    <label className="mb-0 mt-08">Variant Candidacy</label>
                                    <div>
                                        { variant_candidacy ?
                                            <React.Fragment>
                                                <i className="status-indicator-dot ml-1 mr-1" data-status={variant_candidacy} />{variant_candidacy}
                                            </React.Fragment>
                                            : <em>None Defined</em> }
                                    </div>
                                </div>
                            </div>

                            : <div className="text-center pt-16 pb-0"><em>No Gene Discovery Note Saved</em></div> }

                    </div>
                </div>
            </div>
        </React.Fragment>
    );
}

const NoteCheckboxes = React.memo(function NoteCheckboxes ({ onReportChange, onKBChange, reportChecked, kbChecked }) {
    return (
        <div className="d-flex flex-column flex-xl-row text-small">
            <Checkbox className="flex-grow-1" labelClassName="text-400 mb-0" onChange={onReportChange} checked={reportChecked}>
                Send to Report
            </Checkbox>
            <Checkbox className="flex-grow-1" labelClassName="text-400 mb-0" onChange={onKBChange} checked={kbChecked}>
                Send to KnowledgeBase
            </Checkbox>
        </div>
    );
});



function ProjectWideSelectionsPanel () {

}

function ACMGClassificationSelections () {
    return (
        <div>
            <h4 className="text-600">ACMG Classification Selections</h4>
            <div className="row">
                <div className="col-12 col-lg-6">
                    <h5 className="text-400">Move to Report</h5>
                    <ACMGClassificationSelectionsCommonCheckboxList />
                </div>
                <div className="col-12 col-lg-6">
                    <h5 className="text-400">Send to KnowledgeBase</h5>
                    <ACMGClassificationSelectionsCommonCheckboxList />
                </div>
            </div>
        </div>
    );
}

function ACMGClassificationSelectionsCommonCheckboxList (props) {
    // TODO: Have a common onChange passed to all of these, using something from props (TBD) to decide its logic

    return (
        <div>
            <Checkbox>
                Pathogenic Variants
            </Checkbox>
            <Checkbox>
                Likely Pathogenic Variants
            </Checkbox>
            <Checkbox>
                VUS Variants
            </Checkbox>
            <Checkbox>
                Likely Benign Variants
            </Checkbox>
            <Checkbox>
                Benign Variants
            </Checkbox>
        </div>
    );
}

function VariantGeneSelections () {



    return (
        <div>
            <h4 className="text-600">ACMG Classification Selections</h4>
            <div className="row">
                <div className="col-12 col-lg-6">
                    <h5 className="text-400">Move to Report</h5>
                    <div>
                        <Checkbox>
                            Strong
                        </Checkbox>
                        <Checkbox>
                            Likely Pathogenic Variants
                        </Checkbox>
                        <Checkbox>
                            VUS Variants
                        </Checkbox>
                        <Checkbox>
                            Likely Benign Variants
                        </Checkbox>
                        <Checkbox>
                            Benign Variants
                        </Checkbox>
                    </div>
                </div>
                <div className="col-12 col-lg-6">
                    <h5 className="text-400">Send to KnowledgeBase</h5>
                </div>
            </div>
        </div>
    );
}