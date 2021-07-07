'use strict';

import React, { useCallback, useMemo, useState } from 'react';
import _ from 'underscore';
import { Checkbox } from '@hms-dbmi-bgm/shared-portal-components/es/components/forms/components/Checkbox';



export function CaseSpecificSelectionsPanel (props) {
    const [ isExpanded, setIsExpanded ] = useState(false);
    const toggleExpanded = useCallback(function(e){
        e.stopPropagation();
        setIsExpanded(!isExpanded);
    }, [ isExpanded ]);

    // state for Notes section will be here.

    // We might calculate state for all checkboxes here as may need to infer state from others for intersections.



    return (
        <div className="card mb-24">
            <div className={"card-header py-3 bg-primary-dark" + (!isExpanded ? " rounded" : "")}>
                <h4 className="text-400 my-0 d-flex align-items-center clickable text-white" onClick={toggleExpanded}>
                    <i className={"mr-1 icon fas icon-" + (isExpanded ? "minus" : "plus")}/>
                    <span>Case Specific Selections</span>
                </h4>
            </div>
            { isExpanded ?
                <React.Fragment>
                    <div className="card-body">
                        <ACMGClassificationSelections {...props} />
                    </div>
                    <div className="card-body border-top">
                        <VariantGeneSelections {...props} />
                    </div>
                    <div className="card-body border-top">
                        <NoteTypeSelections {...props} />
                    </div>
                </React.Fragment>
                : null }
        </div>
    );
}

function ACMGClassificationSelections (props) {
    const {
        // From FinalizeCaseTab (& higher)
        variantSampleListItem,
        alreadyInProjectNotes,
        // From FinalizeCaseDataStore
        toggleSendToKnowledgeBaseStoreItems,
        toggleSendToReportStoreItems,
        sendToKnowledgeBaseStore,
        sendToReportStore
    } = props;
    return (
        <React.Fragment>
            <h4 className="text-400 mt-0 8">ACMG Classification Selections</h4>
            <div className="row">
                <div className="col-12 col-lg-6">
                    <h5 className="text-400 text-large">Move to Report</h5>
                    <ACMGClassificationSelectionsCommonCheckboxList variantSampleListItem={variantSampleListItem} store={sendToReportStore} toggleItems={toggleSendToReportStoreItems} />
                </div>
                <div className="col-12 col-lg-6">
                    <h5 className="text-400 text-large">Send to KnowledgeBase</h5>
                    <ACMGClassificationSelectionsCommonCheckboxList alreadyInProjectNotes={alreadyInProjectNotes} variantSampleListItem={variantSampleListItem} store={sendToKnowledgeBaseStore} toggleItems={toggleSendToKnowledgeBaseStoreItems} />
                </div>
            </div>
        </React.Fragment>
    );
}

function ACMGClassificationSelectionsCommonCheckboxList ({ store, toggleItems, variantSampleListItem, alreadyInProjectNotes }) {
    const { variant_samples = [] } = variantSampleListItem || {};

    const pathogenicityEnums = [
        "Pathogenic",
        "Likely pathogenic",
        "Uncertain significance",
        "Likely benign",
        "Benign"
    ];

    const variantSamplesWithInterpretationClassification = useMemo(function(){
        // Ignore VSes with no interpretation.classification saved
        return variant_samples.filter(function(vsSelection){
            const { variant_sample_item: { interpretation: { classification } = {} } } = vsSelection;
            return typeof classification === "string";
        });
    }, [ variant_samples ]);

    const { checkboxStates, indeterminateStates, classificationCounts, activeSelectionsByClassification, inactiveSelectionsByClassification } = useMemo(function(){
        return getClassificationStates(
            pathogenicityEnums,
            variantSamplesWithInterpretationClassification,
            function(enumOption, vsSelection){
                const { variant_sample_item: { interpretation: { classification } } } = vsSelection;
                return classification === enumOption;
            },
            store,
            alreadyInProjectNotes
        );
    }, [ variantSamplesWithInterpretationClassification, store, alreadyInProjectNotes ]);

    const onChange = useCallback(function onChange (evt) {
        const eventKey = evt.target.getAttribute("data-key");
        const currentChecked = checkboxStates[eventKey]; // evt.target.checked;
        let objectsToToggle = null;
        if (currentChecked) {
            // Uncheck all activeClassifications notes.
            objectsToToggle = activeSelectionsByClassification[eventKey].reduce(function(m, { variant_sample_item }){
                return m.concat(getAllNotesFromVariantSample(variant_sample_item).map(function({ uuid }){ return uuid; }));
            }, []).map(function(noteUUID){
                return [ noteUUID, true ];
            });
        } else {
            objectsToToggle = inactiveSelectionsByClassification[eventKey].reduce(function(m, { variant_sample_item }){
                // Toggle only the yet-unselected note uuids.
                const noteUUIDsToSelect = getAllNotesFromVariantSample(variant_sample_item)
                    .map(function({ uuid }){ return uuid; })
                    .filter(function(noteUUID){
                        return !store[noteUUID];
                    });
                return m.concat(noteUUIDsToSelect);
            }, []).map(function(noteUUID){
                return [ noteUUID, true ];
            });
        }
        toggleItems(objectsToToggle);
    }, [ checkboxStates ]); // If reference to checkboxStates changes, we assume same is true for the rest of its memoized return neighbors.

    const commonProps = { onChange, checkboxStates, classificationCounts, indeterminateStates };

    return (
        <div className="px-2">
            <KeyedCheckbox data-key="Pathogenic" {...commonProps}>
                Pathogenic Variants
            </KeyedCheckbox>
            <KeyedCheckbox data-key="Likely pathogenic" {...commonProps}>
                Likely Pathogenic Variants
            </KeyedCheckbox>
            <KeyedCheckbox data-key="Uncertain significance" {...commonProps}>
                VUS Variants
            </KeyedCheckbox>
            <KeyedCheckbox data-key="Likely benign" {...commonProps}>
                Likely Benign Variants
            </KeyedCheckbox>
            <KeyedCheckbox data-key="Benign" {...commonProps}>
                Benign Variants
            </KeyedCheckbox>
        </div>
    );
}




function VariantGeneSelections (props) {
    const {
        // From FinalizeCaseTab (& higher)
        variantSampleListItem,
        alreadyInProjectNotes,
        // From FinalizeCaseDataStore
        toggleSendToKnowledgeBaseStoreItems,
        toggleSendToReportStoreItems,
        sendToKnowledgeBaseStore,
        sendToReportStore
    } = props;
    return (
        <React.Fragment>
            <h4 className="text-400 mt-0 mb-08">Variant / Gene Selections</h4>
            <div className="row">
                <div className="col-12 col-lg-6">
                    <h5 className="text-400 text-large">Move to Report</h5>
                    <VariantGeneSelectionsCommonCheckboxList variantSampleListItem={variantSampleListItem} store={sendToReportStore} toggleItems={toggleSendToReportStoreItems} />
                </div>
                <div className="col-12 col-lg-6">
                    <h5 className="text-400 text-large">Send to KnowledgeBase</h5>
                    <VariantGeneSelectionsCommonCheckboxList {...{ alreadyInProjectNotes, variantSampleListItem }} store={sendToKnowledgeBaseStore} toggleItems={toggleSendToKnowledgeBaseStoreItems} />
                </div>
            </div>
        </React.Fragment>
    );
}


function VariantGeneSelectionsCommonCheckboxList ({ store, toggleItems, variantSampleListItem, alreadyInProjectNotes }) {
    const { variant_samples = [] } = variantSampleListItem || {};

    // These are currently same between gene and variant.
    const commonCandidacyEnums = [
        "Strong candidate",
        "Moderate candidate",
        "Weak candidate",
        "Not a candidate"
    ];

    const variantSamplesWithGeneCandidacy = useMemo(function(){
        // Ignore VSes with no discoveryInterpretationNote saved
        return variant_samples.filter(function(vsSelection){
            const { variant_sample_item: { discovery_interpretation: { gene_candidacy } = {} } } = vsSelection;
            return typeof gene_candidacy === "string";
        });
    }, [ variant_samples ]);

    const variantSamplesWithVariantCandidacy = useMemo(function(){
        // Ignore VSes with no discoveryInterpretationNote saved
        return variant_samples.filter(function(vsSelection){
            const { variant_sample_item: { discovery_interpretation: { variant_candidacy } = {} } } = vsSelection;
            return typeof variant_candidacy === "string";
        });
    }, [ variant_samples ]);

    const {
        checkboxStates: geneCheckboxStates,
        indeterminateStates: geneIndeterminateStates,
        classificationCounts: geneClassificationCounts,
        activeSelectionsByClassification: geneActiveSelectionsByClassification,
        inactiveSelectionsByClassification: geneInactiveSelectionsByClassification
    } = useMemo(function(){
        return getClassificationStates(
            commonCandidacyEnums,
            variantSamplesWithGeneCandidacy,
            function(enumOption, vsSelection){
                const { variant_sample_item: { discovery_interpretation: { gene_candidacy } = {} } } = vsSelection;
                return gene_candidacy === enumOption;
            },
            store,
            alreadyInProjectNotes
        );
    }, [ variantSamplesWithGeneCandidacy, store, alreadyInProjectNotes ]);

    const {
        checkboxStates: variantCheckboxStates,
        indeterminateStates: variantIndeterminateStates,
        classificationCounts: variantClassificationCounts,
        activeSelectionsByClassification: variantActiveSelectionsByClassification,
        inactiveSelectionsByClassification: variantInactiveSelectionsByClassification
    } = useMemo(function(){
        return getClassificationStates(
            commonCandidacyEnums,
            variantSamplesWithVariantCandidacy,
            function(enumOption, vsSelection){
                const { variant_sample_item: { discovery_interpretation: { variant_candidacy } = {} } } = vsSelection;
                return variant_candidacy === enumOption;
            },
            store,
            alreadyInProjectNotes
        );
    }, [ variantSamplesWithVariantCandidacy, store, alreadyInProjectNotes ]);

    const onChange = useCallback(function onChange (evt) {
        const eventKey = evt.target.getAttribute("data-key");
        const candidacyType = evt.target.getAttribute("data-candidacy-type");

        let checkboxStates, activeSelectionsByClassification, inactiveSelectionsByClassification;
        if (candidacyType === "gene") {
            checkboxStates = geneCheckboxStates;
            activeSelectionsByClassification = geneActiveSelectionsByClassification;
            inactiveSelectionsByClassification = geneInactiveSelectionsByClassification;
        } else {
            checkboxStates = variantCheckboxStates;
            activeSelectionsByClassification = variantActiveSelectionsByClassification;
            inactiveSelectionsByClassification = variantInactiveSelectionsByClassification;
        }
        const currentChecked = checkboxStates[eventKey]; // evt.target.checked;
        console.log("EVT", evt, currentChecked, eventKey);
        let objectsToToggle = null;
        if (currentChecked) {
            // Uncheck all activeClassifications notes.
            objectsToToggle = activeSelectionsByClassification[eventKey].reduce(function(m, { variant_sample_item }){
                return m.concat(getAllNotesFromVariantSample(variant_sample_item).map(function({ uuid }){ return uuid; }));
            }, []).map(function(noteUUID){
                return [ noteUUID, true ];
            });
        } else {
            objectsToToggle = inactiveSelectionsByClassification[eventKey].reduce(function(m, { variant_sample_item }){
                // Toggle only the yet-unselected note uuids.
                const noteUUIDsToSelect = getAllNotesFromVariantSample(variant_sample_item)
                    .map(function({ uuid }){ return uuid; })
                    .filter(function(noteUUID){
                        return !store[noteUUID];
                    });
                return m.concat(noteUUIDsToSelect);
            }, []).map(function(noteUUID){
                return [ noteUUID, true ];
            });
        }
        toggleItems(objectsToToggle);
    }, [ geneCheckboxStates, variantCheckboxStates ]); // If reference to checkboxStates changes, we assume same is true for the rest of its memoized return neighbors.

    const commonGeneCandidacyProps = {
        onChange, "data-candidacy-type": "gene", "checkboxStates": geneCheckboxStates,
        "indeterminateStates": geneIndeterminateStates, "classificationCounts": geneClassificationCounts
    };
    const commonVariantCandidacyProps = {
        onChange, "data-candidacy-type": "variant", "checkboxStates": variantCheckboxStates,
        "indeterminateStates": variantIndeterminateStates, "classificationCounts": variantClassificationCounts
    };

    return (
        <div className="px-2">
            <KeyedCheckbox data-key="Strong candidate" {...commonGeneCandidacyProps}>
                Strong Candidate Genes
            </KeyedCheckbox>
            <KeyedCheckbox data-key="Moderate candidate" {...commonGeneCandidacyProps}>
                Moderate Candidate Genes
            </KeyedCheckbox>
            <KeyedCheckbox data-key="Weak candidate" {...commonGeneCandidacyProps}>
                Weak Candidate Genes
            </KeyedCheckbox>
            {/*
            <KeyedCheckbox data-key="Not a candidate" {...commonProps}>
                Not Candidate Genes
            </KeyedCheckbox>
            */}

            <br/>

            <KeyedCheckbox data-key="Strong candidate" {...commonVariantCandidacyProps}>
                Strong Candidate Variants
            </KeyedCheckbox>
            <KeyedCheckbox data-key="Moderate candidate" {...commonVariantCandidacyProps}>
                Moderate Candidate Variants
            </KeyedCheckbox>
            <KeyedCheckbox data-key="Weak candidate" {...commonVariantCandidacyProps}>
                Weak Candidate Variants
            </KeyedCheckbox>
        </div>
    );
}


function NoteTypeSelections (props) {
    const {
        // From FinalizeCaseTab (& higher)
        variantSampleListItem,
        // From FinalizeCaseDataStore
        toggleSendToKnowledgeBaseStoreItems,
        toggleSendToReportStoreItems,
        sendToKnowledgeBaseStore,
        sendToReportStore
    } = props;
    return (
        <React.Fragment>
            <h4 className="text-400 mt-0 mb-08">Notes</h4>
            <div className="row">
                <div className="col-12 col-lg-6">
                    <h5 className="text-400 text-large">Move to Report</h5>
                    <NoteTypeSelectionsCommonCheckboxList variantSampleListItem={variantSampleListItem} store={sendToReportStore} toggleItems={toggleSendToReportStoreItems} />
                </div>
                <div className="col-12 col-lg-6">
                    <h5 className="text-400 text-large">Send to KnowledgeBase</h5>
                    <NoteTypeSelectionsCommonCheckboxList variantSampleListItem={variantSampleListItem} store={sendToKnowledgeBaseStore} toggleItems={toggleSendToKnowledgeBaseStoreItems} />
                </div>
            </div>
        </React.Fragment>
    );
}

function NoteTypeSelectionsCommonCheckboxList ({ store, toggleItems, variantSampleListItem }) {
    const { variant_samples = [] } = variantSampleListItem || {};

    const noteTypes = [
        "variant_notes",
        "gene_notes",
        "interpretation",
        "discovery_interpretation"
    ];


    const { checkboxStates, indeterminateStates, classificationCounts, activeSelectionsByClassification, inactiveSelectionsByClassification } = useMemo(function(){
        return getClassificationStates(
            noteTypes,
            variant_samples,
            function(enumOption, vsSelection){
                const { variant_sample_item: { [enumOption]: foundNote = null } } = vsSelection;
                return !!(foundNote);
            },
            store
        );
    }, [ variant_samples, store ]);



    const onChange = function(e){
        console.log('EE');
    };

    const commonProps = {
        onChange,
        checkboxStates,
        indeterminateStates,
        classificationCounts
    };

    return (
        <div className="px-2">
            <KeyedCheckbox data-key="variant_notes" {...commonProps}>
                Variant Notes
            </KeyedCheckbox>
            <KeyedCheckbox data-key="gene_notes" {...commonProps}>
                Gene Notes
            </KeyedCheckbox>
            <KeyedCheckbox data-key="interpretation" {...commonProps}>
                Clinicial Intepretation Notes
            </KeyedCheckbox>
            <KeyedCheckbox data-key="discovery_interpretation" {...commonProps}>
                Gene Discovery Notes
            </KeyedCheckbox>
        </div>
    );

}




/** Common re-usable components below **/


function KeyedCheckbox({ children, "data-key": key, checkboxStates, indeterminateStates, classificationCounts, className, disabled, ...passProps }){
    const cls = "pb-02 pt-02" + (className ? " " + className : "");
    return (
        <Checkbox {...passProps} data-key={key} checked={checkboxStates[key]} className={cls}
            disabled={disabled || classificationCounts[key] === 0} indeterminate={indeterminateStates[key]}>
            { children }
            &nbsp;
            <small className="text-secondary">({ classificationCounts[key] })</small>
        </Checkbox>
    );
}

export function getAllNotesFromVariantSample(variantSampleItem) {
    const {
        interpretation = null,
        discovery_interpretation = null,
        gene_notes = null,
        variant_notes = null
    } = variantSampleItem;
    const notes = [];
    if (interpretation !== null && interpretation.uuid) {
        notes.push(interpretation);
    }
    if (discovery_interpretation !== null && discovery_interpretation.uuid) {
        notes.push(discovery_interpretation);
    }
    if (gene_notes !== null && gene_notes.uuid) {
        notes.push(gene_notes);
    }
    if (variant_notes !== null && variant_notes.uuid) {
        notes.push(variant_notes);
    }
    return notes;
}


function getClassificationStates(possibleEnums, viableVariantSampleSelections, isMatchingClassificationFxn, store, ignoreNoteUUIDs = {}){
    const checkboxStates = {};
    const indeterminateStates = {};
    const classificationCounts = {};
    const activeSelectionsByClassification = {};
    const inactiveSelectionsByClassification = {};

    possibleEnums.forEach(function(k){
        checkboxStates[k] = true;
        indeterminateStates[k] = false;
        classificationCounts[k] = 0;
        activeSelectionsByClassification[k] = [];
        inactiveSelectionsByClassification[k] = [];
    });

    viableVariantSampleSelections.forEach(function(vsSelection){
        const { variant_sample_item: vsItem } = vsSelection;
        possibleEnums.forEach(function(enumOption){

            if (!isMatchingClassificationFxn(enumOption, vsSelection)) {
                return;
            }

            classificationCounts[enumOption]++;

            // TODO do intersection if Notes option(s) checked or unchecked.

            // Currently does intersection or skip if Note is in `alreadyInProjectNotes` -- TODO: exclude from inactiveSelectionsByClassification if all notes from VS are in alreadyInProjectNotes.

            const currentNotes = getAllNotesFromVariantSample(vsItem).filter(function({ uuid }){
                return !ignoreNoteUUIDs[uuid];
            });

            const isSelected = _.every(currentNotes, function({ uuid }){ return store[uuid]; });

            if (isSelected) {
                activeSelectionsByClassification[enumOption].push(vsSelection);
                indeterminateStates[enumOption] = true;
            } else {
                inactiveSelectionsByClassification[enumOption].push(vsSelection);
                checkboxStates[enumOption] = false;
            }

        });
    });

    // Uncheck any checkboxes where classificaton count is 0.
    // Un-indeterminate any checkboxes where is checked.
    possibleEnums.forEach(function(k){
        if (classificationCounts[k] === 0) {
            checkboxStates[k] = false;
        }
        if (checkboxStates[k] === true) {
            indeterminateStates[k] = false;
        }
    });

    return { checkboxStates, indeterminateStates, classificationCounts, activeSelectionsByClassification, inactiveSelectionsByClassification };
}
