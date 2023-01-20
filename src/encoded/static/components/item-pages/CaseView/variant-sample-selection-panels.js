'use strict';

import React, { useCallback, useMemo, useState } from 'react';
import DropdownButton from 'react-bootstrap/esm/DropdownButton';
import DropdownItem from 'react-bootstrap/esm/DropdownItem';
import _ from 'underscore';
import { Checkbox } from '@hms-dbmi-bgm/shared-portal-components/es/components/forms/components/Checkbox';



export const CaseSpecificSelectionsPanel = React.memo(function CaseSpecificSelectionsPanel (props) {
    const { className, ...passProps } = props;

    const panels = {
        ACMG: 1,
        GENEDISCOVERY: 2
    };
    const panelTitles = {
        [panels.ACMG]: "ACMG Classification Selections",
        [panels.GENEDISCOVERY]: "Gene Discovery Selections"
    };

    const [ isExpanded, setIsExpanded ] = useState(false);
    const [ showingPanel, setShowingPanel ] = useState(panels.ACMG);

    const toggleExpanded = useCallback(function(e){
        e.stopPropagation();
        setIsExpanded(function(currentIsExpanded){
            return !currentIsExpanded;
        });
    });

    const onSelectPanel = useCallback(function(eventKey, evt){
        evt.stopPropagation();
        setShowingPanel(parseInt(eventKey));
    });

    return (
        // Set tabIndex={0} to make element focusable/navigatable-to by non-mouse-cursor interactions such as the tab key.
        <div className={"card" + (className ? " " + className : "")}>
            <button type="button" className={"card-header btn py-3 bg-primary-dark" + (!isExpanded ? " rounded" : "")}
                onClick={toggleExpanded}>
                <h4 className="text-400 my-0 d-flex align-items-center text-white" >
                    <i className={"mr-15 icon fas icon-" + (isExpanded ? "minus" : "plus")}/>
                    <span>Case Specific Selections</span>
                </h4>
            </button>
            { isExpanded ?
                <React.Fragment>
                    <div className="card-body">
                        <div className="mb-08">
                            <DropdownButton variant="outline-dark" size="lg" onSelect={onSelectPanel}
                                title={panelTitles[showingPanel]}>
                                <DropdownItem eventKey={panels.ACMG} active={showingPanel === panels.ACMG}>
                                    { panelTitles[panels.ACMG] }
                                </DropdownItem>
                                <DropdownItem eventKey={panels.GENEDISCOVERY} active={showingPanel === panels.GENEDISCOVERY}>
                                    { panelTitles[panels.GENEDISCOVERY] }
                                </DropdownItem>
                            </DropdownButton>
                        </div>

                        { showingPanel === panels.ACMG ?
                            <ACMGClassificationSelections {...passProps} />
                            : showingPanel === panels.GENEDISCOVERY ?
                                <VariantGeneSelections {...passProps} />
                                : null
                        }

                    </div>
                    <div className="card-body border-top">
                        <NoteTypeSelections {...passProps} />
                    </div>
                </React.Fragment>
                : null }
        </div>
    );
});

export class NoteSubSelectionStateController extends React.PureComponent {
    constructor(props){
        super(props);

        this.toggleReportNoteSubselectionState = this.toggleNoteSubselectionState.bind(this, "reportNotesIncluded");
        this.toggleKBNoteSubselectionState = this.toggleNoteSubselectionState.bind(this, "kbNotesIncluded");

        this.state = {
            "reportNotesIncluded": {
                "variant_notes": true,
                "gene_notes": true,
                "interpretation": true,
                "discovery_interpretation": true
            },
            "kbNotesIncluded": {
                "variant_notes": true,
                "gene_notes": true,
                "interpretation": true,
                "discovery_interpretation": true
            }
        };
    }

    toggleNoteSubselectionState(storeType, notesName){
        return this.setState(function(prevState){
            const nextState = {
                ...prevState,
                [storeType]: {
                    ...prevState[storeType],
                    [notesName]: !prevState[storeType][notesName]
                }
            };
            return nextState;
        });
    }

    render(){
        const {
            props: { children, ...passProps },
            state,
            toggleReportNoteSubselectionState,
            toggleKBNoteSubselectionState
        } = this;
        const childProps = {
            ...passProps,
            ...state,
            toggleReportNoteSubselectionState,
            toggleKBNoteSubselectionState
        };
        return React.Children.map(children, (child)=>{
            if (!React.isValidElement(child)) {
                // String or something
                return child;
            }
            if (typeof child.type === "string") {
                // Normal element (a, div, etc)
                return child;
            } // Else is React component
            return React.cloneElement(child, childProps);
        });
    }
}


const ACMGClassificationSelections = React.memo(function ACMGClassificationSelections (props) {
    const {
        // From CaseReviewTab (& higher)
        variantSampleListItem,
        alreadyInProjectNotes,
        alreadyInReportNotes,
        // From NoteSubSelectionStateController
        reportNotesIncluded,
        kbNotesIncluded,
        // From CaseReviewSelectedNotesStore
        toggleSendToProjectStoreItems,
        toggleSendToReportStoreItems,
        sendToProjectStore,
        sendToReportStore
    } = props;
    return (
        <div className="row">
            <div className="col-12 col-lg-6">
                <h5 className="text-400 text-large">Move to Report</h5>
                <ACMGClassificationSelectionsCommonCheckboxList
                    variantSampleListItem={variantSampleListItem} store={sendToReportStore} toggleItems={toggleSendToReportStoreItems}
                    noteTypesIncluded={reportNotesIncluded} alreadySaved={alreadyInReportNotes} />
            </div>
            <div className="col-12 col-lg-6">
                <h5 className="text-400 text-large">Save to Project</h5>
                <ACMGClassificationSelectionsCommonCheckboxList
                    variantSampleListItem={variantSampleListItem} store={sendToProjectStore} toggleItems={toggleSendToProjectStoreItems}
                    noteTypesIncluded={kbNotesIncluded} alreadySaved={alreadyInProjectNotes} />
            </div>
        </div>
    );
});

function ACMGClassificationSelectionsCommonCheckboxList ({ store, toggleItems, variantSampleListItem, alreadySaved, noteTypesIncluded }) {
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

    const { checkboxStates, indeterminateStates, classificationCounts, activeSelectionsByClassification, inactiveSelectionsByClassification, ignoredCounts } = useMemo(function(){
        return getClassificationStates(
            pathogenicityEnums,
            variantSamplesWithInterpretationClassification,
            function(enumOption, vsSelection){
                const { variant_sample_item: { interpretation: { classification } } } = vsSelection;
                return classification === enumOption;
            },
            store,
            alreadySaved,
            noteTypesIncluded
        );
    }, [ variantSamplesWithInterpretationClassification, store, alreadySaved, noteTypesIncluded ]);

    const onChange = useCallback(function onChange (evt) {
        const eventKey = evt.target.getAttribute("data-key");
        const currentChecked = checkboxStates[eventKey]; // evt.target.checked;
        let objectsToToggle = null;
        if (currentChecked) {
            // Uncheck all activeClassifications notes.
            objectsToToggle = activeSelectionsByClassification[eventKey].reduce(function(m, { variant_sample_item }){
                // Don't pass in `noteTypesIncluded`, unselect all.
                return m.concat(getAllNotesFromVariantSample(variant_sample_item).map(function({ uuid }){ return uuid; }));
            }, []).map(function(noteUUID){
                return [ noteUUID, true ];
            });
        } else {
            objectsToToggle = inactiveSelectionsByClassification[eventKey].reduce(function(m, { variant_sample_item }){
                // Toggle only the yet-unselected note uuids, filtered by `noteTypesIncluded`.
                const noteUUIDsToSelect = getAllNotesFromVariantSample(variant_sample_item, noteTypesIncluded)
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
    }, [ checkboxStates, store, noteTypesIncluded ]); // If reference to checkboxStates changes, we assume same is true for the rest of its memoized return neighbors.

    const commonProps = { onChange, checkboxStates, classificationCounts, indeterminateStates, ignoredCounts };

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




const VariantGeneSelections = React.memo(function VariantGeneSelections (props) {
    const {
        // From CaseReviewTab (& higher)
        variantSampleListItem,
        alreadyInProjectNotes,
        alreadyInReportNotes,
        // From NoteSubSelectionStateController
        reportNotesIncluded,
        kbNotesIncluded,
        // From CaseReviewSelectedNotesStore
        toggleSendToProjectStoreItems,
        toggleSendToReportStoreItems,
        sendToProjectStore,
        sendToReportStore
    } = props;
    return (
        <div className="row">
            <div className="col-12 col-lg-6">
                <h5 className="text-400 text-large">Move to Report</h5>
                <VariantGeneSelectionsCommonCheckboxList
                    variantSampleListItem={variantSampleListItem} store={sendToReportStore} toggleItems={toggleSendToReportStoreItems}
                    noteTypesIncluded={reportNotesIncluded} alreadySaved={alreadyInReportNotes} />
            </div>
            <div className="col-12 col-lg-6">
                <h5 className="text-400 text-large">Save to Project</h5>
                <VariantGeneSelectionsCommonCheckboxList
                    variantSampleListItem={variantSampleListItem} store={sendToProjectStore} toggleItems={toggleSendToProjectStoreItems}
                    noteTypesIncluded={kbNotesIncluded} alreadySaved={alreadyInProjectNotes}/>
            </div>
        </div>
    );
});


function VariantGeneSelectionsCommonCheckboxList ({ store, toggleItems, variantSampleListItem, alreadySaved, noteTypesIncluded }) {
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
        inactiveSelectionsByClassification: geneInactiveSelectionsByClassification,
        ignoredCounts: geneIgnoredCountsByClassification
    } = useMemo(function(){
        return getClassificationStates(
            commonCandidacyEnums,
            variantSamplesWithGeneCandidacy,
            function(enumOption, vsSelection){
                const { variant_sample_item: { discovery_interpretation: { gene_candidacy } = {} } } = vsSelection;
                return gene_candidacy === enumOption;
            },
            store,
            alreadySaved,
            noteTypesIncluded
        );
    }, [ variantSamplesWithGeneCandidacy, store, alreadySaved, noteTypesIncluded ]);

    const {
        checkboxStates: variantCheckboxStates,
        indeterminateStates: variantIndeterminateStates,
        classificationCounts: variantClassificationCounts,
        activeSelectionsByClassification: variantActiveSelectionsByClassification,
        inactiveSelectionsByClassification: variantInactiveSelectionsByClassification,
        ignoredCounts: variantIgnoredCountsByClassification
    } = useMemo(function(){
        return getClassificationStates(
            commonCandidacyEnums,
            variantSamplesWithVariantCandidacy,
            function(enumOption, vsSelection){
                const { variant_sample_item: { discovery_interpretation: { variant_candidacy } = {} } } = vsSelection;
                return variant_candidacy === enumOption;
            },
            store,
            alreadySaved,
            noteTypesIncluded
        );
    }, [ variantSamplesWithVariantCandidacy, store, alreadySaved, noteTypesIncluded ]);

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
                const noteUUIDsToSelect = getAllNotesFromVariantSample(variant_sample_item, noteTypesIncluded)
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
    }, [ geneCheckboxStates, variantCheckboxStates, store, noteTypesIncluded ]); // If reference to checkboxStates changes, we assume same is true for the rest of its memoized return neighbors.

    const commonGeneCandidacyProps = {
        onChange, "data-candidacy-type": "gene", "checkboxStates": geneCheckboxStates,
        "indeterminateStates": geneIndeterminateStates, "classificationCounts": geneClassificationCounts,
        "ignoredCounts": geneIgnoredCountsByClassification
    };
    const commonVariantCandidacyProps = {
        onChange, "data-candidacy-type": "variant", "checkboxStates": variantCheckboxStates,
        "indeterminateStates": variantIndeterminateStates, "classificationCounts": variantClassificationCounts,
        "ignoredCounts": variantIgnoredCountsByClassification
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
        // From CaseReviewTab (& higher)
        variantSampleListItem,
        alreadyInProjectNotes,
        alreadyInReportNotes,
        // From NoteSubSelectionStateController
        reportNotesIncluded,
        kbNotesIncluded,
        toggleReportNoteSubselectionState,
        toggleKBNoteSubselectionState,
        // From CaseReviewSelectedNotesStore
        toggleSendToProjectStoreItems,
        toggleSendToReportStoreItems,
        sendToProjectStore,
        sendToReportStore
    } = props;
    return (
        <React.Fragment>
            <h4 className="text-400 mt-0 mb-08">Note Types</h4>
            <div className="row">
                <div className="col-12 col-lg-6">
                    <h5 className="text-400 text-large">Move to Report</h5>
                    <NoteTypeSelectionsCommonCheckboxList
                        {...{ variantSampleListItem }} alreadySaved={alreadyInReportNotes} store={sendToReportStore} toggleItems={toggleSendToReportStoreItems}
                        noteTypesIncludedState={reportNotesIncluded} toggleNoteTypesIncludedState={toggleReportNoteSubselectionState} />
                </div>
                <div className="col-12 col-lg-6">
                    <h5 className="text-400 text-large">Save to Project</h5>
                    <NoteTypeSelectionsCommonCheckboxList
                        {...{ variantSampleListItem }} alreadySaved={alreadyInProjectNotes} store={sendToProjectStore} toggleItems={toggleSendToProjectStoreItems}
                        noteTypesIncludedState={kbNotesIncluded} toggleNoteTypesIncludedState={toggleKBNoteSubselectionState} />
                </div>
            </div>
        </React.Fragment>
    );
}

/** Logic in here differs a bit from the other 2 panels as we have independent states for these boxes. */
function NoteTypeSelectionsCommonCheckboxList (props) {
    const { store, toggleItems, variantSampleListItem, alreadySaved, noteTypesIncludedState, toggleNoteTypesIncludedState } = props;
    const { variant_samples = [] } = variantSampleListItem || {};

    const noteTypes = [
        "variant_notes",
        "gene_notes",
        "interpretation",
        "discovery_interpretation"
    ];

    // Filters down to any VS samples which are currently selected.
    const variantSampleObjectsSelected = useMemo(function(){
        return variant_samples.filter(function({ variant_sample_item }){
            return _.any(
                getAllNotesFromVariantSample(variant_sample_item),
                function({ uuid }){ return store[uuid]; }
            );
        });
    }, [ variantSampleListItem, store ]);


    const {
        checkboxStates: calculatedSelections,
        indeterminateStates,
        classificationCounts,
        activeSelectionsByClassification,
        inactiveSelectionsByClassification,
        ignoredCounts
    } = useMemo(function(){
        return getClassificationStates(
            noteTypes,
            variantSampleObjectsSelected,
            function(enumOption, vsSelection){
                const { variant_sample_item: { [enumOption]: foundNote = null } } = vsSelection;
                return !!(foundNote);
            },
            store,
            alreadySaved
        );
    }, [ variantSampleObjectsSelected, store, alreadySaved ]);



    const onChange = function(evt){
        const eventKey = evt.target.getAttribute("data-key");
        const currentChecked = noteTypesIncludedState[eventKey];

        const noteUUIDsToToggle = [];

        const { variant_samples = [] } = variantSampleListItem;
        variant_samples.forEach(function({ variant_sample_item }){
            const note = variant_sample_item[eventKey];
            const { uuid: noteUUID } = note || {};
            if (!noteUUID) {
                return;
            }
            if (currentChecked && store[noteUUID]) {
                // Will uncheck and unselect any notes of this note type.
                noteUUIDsToToggle.push(noteUUID);
            } else if (!currentChecked && !store[noteUUID]) {
                // First check if any other notes from this VSL are selected, then select this note in also if true.

                const anyNotesInStore = _.any(
                    getAllNotesFromVariantSample(variant_sample_item),
                    function({ uuid }){ return store[uuid]; }
                );
                if (anyNotesInStore) {
                    noteUUIDsToToggle.push(noteUUID);
                }
            }
        });

        const noteSelectionObjects = noteUUIDsToToggle.map(function(uuid){
            return [ uuid, true ];
        });

        toggleItems(noteSelectionObjects, function(){
            toggleNoteTypesIncludedState(eventKey);
        });
    };

    const commonProps = {
        onChange,
        checkboxStates: noteTypesIncludedState,
        // indeterminateStates,
        classificationCounts,
        disableOnNoClassificationsCount: false
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
                Clinical Intepretation Notes
            </KeyedCheckbox>
            <KeyedCheckbox data-key="discovery_interpretation" {...commonProps}>
                Gene Discovery Notes
            </KeyedCheckbox>
        </div>
    );

}




/** Common re-usable components below **/


function KeyedCheckbox(props){
    const {
        children,
        "data-key": key,
        checkboxStates,
        indeterminateStates = {},
        classificationCounts,
        className,
        disabled: propDisabled,
        ignoredCounts = {},
        disableOnNoClassificationsCount = true,
        ...passProps
    } = props;
    const cls = "pb-02 pt-02" + (className ? " " + className : "");

    const checked = checkboxStates[key] || (disableOnNoClassificationsCount && classificationCounts[key] === 0 && ignoredCounts[key] > 0);
    const disabled = propDisabled || (disableOnNoClassificationsCount && classificationCounts[key] === 0);
    const countAddendum = classificationCounts && typeof classificationCounts[key] === "number" ? (
        <React.Fragment>
            &nbsp;
            <small className="text-secondary">({ classificationCounts[key] })</small>
        </React.Fragment>
    ) : null;

    // Set class="d-inline-block" and wrap in outer div because otherwise click area for check/uncheck-ing can be unexpectedly wide.
    return (
        <div className={cls}>
            <Checkbox {...passProps} data-key={key} checked={checked} className="d-inline-block"
                disabled={disabled} indeterminate={indeterminateStates[key]}>
                { children }
                { countAddendum }
            </Checkbox>
        </div>
    );
}

export function getAllNotesFromVariantSample(variantSampleItem, noteTypesIncluded = null) {
    const {
        interpretation = null,
        discovery_interpretation = null,
        gene_notes = null,
        variant_notes = null
    } = variantSampleItem;

    const notes = [];

    const include = noteTypesIncluded || {
        "variant_notes": true,
        "gene_notes": true,
        "interpretation": true,
        "discovery_interpretation": true
    };

    if (include.interpretation && interpretation !== null && interpretation.uuid) {
        notes.push(interpretation);
    }
    if (include.discovery_interpretation && discovery_interpretation !== null && discovery_interpretation.uuid) {
        notes.push(discovery_interpretation);
    }
    if (include.gene_notes && gene_notes !== null && gene_notes.uuid) {
        notes.push(gene_notes);
    }
    if (include.variant_notes && variant_notes !== null && variant_notes.uuid) {
        notes.push(variant_notes);
    }
    return notes;
}


function getClassificationStates(
    possibleEnums,
    viableVariantSampleSelections,
    isMatchingClassificationFxn,
    store,
    ignoreNoteUUIDs = {},
    noteTypesIncluded = null
){
    const checkboxStates = {};
    const indeterminateStates = {};
    const classificationCounts = {};
    const activeSelectionsByClassification = {};
    const inactiveSelectionsByClassification = {};
    const ignoredCounts = {};

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

            // TODO do intersection if Notes option(s) checked or unchecked.



            // Currently does intersection or skip if Note is in `alreadyInProjectNotes` -- TODO: exclude from inactiveSelectionsByClassification if all notes from VS are in alreadyInProjectNotes.



            const currentNotes = getAllNotesFromVariantSample(vsItem, noteTypesIncluded).filter(function({ uuid }){
                if (!ignoreNoteUUIDs[uuid]) {
                    return true;
                }
                ignoredCounts[enumOption] = ignoredCounts[enumOption] || 0;
                ignoredCounts[enumOption]++;
                return false;
            });

            if (currentNotes.length === 0) {
                return;
            }

            classificationCounts[enumOption]++;

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

    return {
        checkboxStates,
        indeterminateStates,
        classificationCounts,
        activeSelectionsByClassification,
        inactiveSelectionsByClassification,
        ignoredCounts
    };
}
