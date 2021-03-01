'use strict';

import React, { useMemo, useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import _ from 'underscore';
import ReactTooltip from 'react-tooltip';
import Dropdown from 'react-bootstrap/esm/Dropdown';
import Button from 'react-bootstrap/esm/Button';
import ButtonGroup from 'react-bootstrap/esm/ButtonGroup';
import DropdownItem from 'react-bootstrap/esm/DropdownItem';
import { console, layout, ajax } from '@hms-dbmi-bgm/shared-portal-components/es/components/util';
import { Alerts } from '@hms-dbmi-bgm/shared-portal-components/es/components/ui/Alerts';

export class InterpretationSpaceController extends React.Component {
    constructor(props) {
        super(props);
        this.state = {
            currentTabIdx: 0,   // 0: Variant Notes, 1: Gene Notes, 2: Interpretation (Research/Discovery), 3: Interpretation (Clinical/ACMG)
            isFullScreen: false // TODO - currently unused
        };
        this.toggleFullScreen = this.toggleFullScreen.bind(this);
        this.switchToTab = this.switchToTab.bind(this);
    }

    toggleFullScreen() {
        // TODO
        const { isFullScreen } = this.state;
        console.log("is setting fullscreen", isFullScreen);
        this.setState({ isFullScreen: !isFullScreen });
    }

    switchToTab(idx) {
        const { currentTabIdx } = this.state;
        // TODO: may need some componentWillUnmount in panels to save unsaved items before dismount completes
        if (currentTabIdx !== idx) {
            console.log("is setting current tab to idx #", idx);
            this.setState({ currentTabIdx: idx });
        }
    }

    render() {
        const { isFullScreen, currentTabIdx } = this.state;

        // Temp until create separate unique versions of the panels for each tab
        const noteLabel = currentTabIdx === 0 ? "Variant Notes" : (currentTabIdx === 1 ? "Gene Notes" : "Interpretation Notes");

        return (
            <div className="card interpretation-space">
                <InterpretationHeader {...{ isFullScreen }} toggleFullScreen={this.toggleFullScreen}/>
                <div className="card-body">
                    <InterpretationTabs {...{ currentTabIdx }} switchToTab={this.switchToTab} />
                    <GenericInterpretationPanel {...{ noteLabel }} { ...this.props }/>
                </div>
            </div>
        );
    }
}

function InterpretationHeader(props) {
    const { toggleFullScreen, isFullScreen } = props;
    return (
        <div className="interpretation-header card-header d-flex align-items-center justify-content-between">
            <i className="icon icon-sort-amount-down fas"></i>
            Variant Interpretation
            <button type="button" className="btn btn-link" onClick={toggleFullScreen || undefined}>
                { isFullScreen ? <i className="icon icon-compress fas"></i> : <i className="icon icon-expand fas"></i> }
            </button>
        </div>
    );
}

function InterpretationTabs(props) {
    const { currentTabIdx, switchToTab } = props;

    const variantNotesActive = currentTabIdx === 0 ? true : false;
    const geneNotesActive = currentTabIdx === 1 ? true : false;
    const interpretationActive = currentTabIdx === 2 ? true : false;
    return (
        <ul className="p-1 d-flex align-items-center justify-content-between">
            <li className="interpretation-tab clickable" onClick={(e) => switchToTab(0)}
                data-active={variantNotesActive}>
                Variant Notes
            </li>
            <li className="interpretation-tab clickable" onClick={(e) => switchToTab(1)}
                data-active={geneNotesActive}>
                Gene Notes
            </li>
            <li className="interpretation-tab clickable" onClick={(e) => switchToTab(2)}
                data-active={interpretationActive}>
                Interpretation
            </li>
        </ul>
    );
}

class GenericInterpretationPanel extends React.Component {
    constructor(props) {
        super(props);
        this.state = { // Fields in form. Using snake casing to make it easier to add state data directly to post/patch request
            note_text: "",
            acmg_guidelines: [],            // TODO: Unused
            classification: null,           // TODO: Unused
            conclusion: "",                 // TODO: Unused
        };

        this.saveStateAsDraft = this.saveStateAsDraft.bind(this);
        this.saveStateToCase = this.saveStateToCase.bind(this);
        this.saveStateToKnowledgeBase = this.saveStateToKnowledgeBase.bind(this);
    }

    // For now using same update fxn for multiple text fields
    onTextChange(event, stateToChange) {
        const { value: newValue } = event.target || {};
        this.setState({ [stateToChange]: newValue });
    }

    saveStateAsDraft() {
        const { saveAsDraft } = this.props;
        saveAsDraft(this.state);
    }

    saveStateToCase() {
        const { saveToCase } = this.props;
        saveToCase(this.state);
    }

    saveStateToKnowledgeBase(){
        const { saveToKnowledgeBase } = this.props;
        saveToKnowledgeBase(this.state);
    }

    render() {
        const { isCurrent, isDraft, interpretationExists, interpretationChanged, noteLabel } = this.props;
        const { note_text: noteText } = this.state;

        return (
            <div className="interpretation-panel">
                <label className="w-100">
                    { noteLabel }
                </label>
                <textarea className="w-100" value={noteText} onChange={(e) => this.onTextChange(e, "note_text")}/>
                <GenericInterpretationSubmitButton {...{ isCurrent, isDraft, interpretationExists, interpretationChanged, noteLabel }}
                    saveAsDraft={this.saveStateAsDraft} saveToCase={this.saveStateAsDraft} saveToKnowledgeBase={this.saveStateToKnowledgeBase}
                />
            </div>
        );
    }
}

/**
 * Displays and handles different CTAs for various stages in the Interpretation Submission Process
 */
function GenericInterpretationSubmitButton(props) {
    const {
        isCurrent,                  // Has note been submitted to case; only cloning enabled -- can save to KB
        isDraft,                    // Has previous note been saved, but not submitted;
        interpretationExists,       // Is there text in the interpretation note space
        interpretationChanged,      // Has the text in the interpretation note space changed since last save
        saveAsDraft,                // Fx -- save as Draft
        saveToCase,                 // Fx -- save to Case (handles cloning in response to edits as well as first time additions)
        saveToKnowledgeBase,        // Fx -- save to KB
        cls
    } = props;

    const allButtonsDropsDisabled = !interpretationExists || !interpretationChanged;
    if (isCurrent || isDraft) {
        // If current: no saving as draft; already submitted to case -- save to knowledgebase
        // In draft status: allow saving to case, re-saving as draft, but no saving to knowledgebase
        return (
            <Dropdown as={ButtonGroup} className={cls}>
                <Button variant="primary btn-block" onClick={isCurrent ? saveToKnowledgeBase : saveToCase}
                    disabled={allButtonsDropsDisabled}
                >
                    { isCurrent ? "Save to Knowledge Base" : "Approve for Case" }
                </Button>
                <Dropdown.Toggle split variant="primary" id="dropdown-split-basic" disabled={allButtonsDropsDisabled} />
                <Dropdown.Menu>
                    { isDraft ? <Dropdown.Item onClick={saveAsDraft}>Save as Draft</Dropdown.Item> : null}
                    { isCurrent ? <Dropdown.Item onClick={saveToCase}>Clone to Case</Dropdown.Item> : null}
                </Dropdown.Menu>
            </Dropdown>);
    } else { // Brand new note; allow saving as draft or to case, but not knowledgebase
        return (
            <Dropdown as={ButtonGroup} className={cls}>
                <Button variant="primary btn-block" onClick={saveAsDraft}
                    disabled={allButtonsDropsDisabled}>
                    Save Draft
                </Button>
                <Dropdown.Toggle split variant="primary" id="dropdown-split-basic" disabled={allButtonsDropsDisabled} />
                <Dropdown.Menu>
                    <Dropdown.Item onClick={saveToCase} disabled={!interpretationExists || !interpretationChanged}>
                        Approve for Case
                    </Dropdown.Item>
                    <Dropdown.Item disabled>
                        Send to Knowledgebase
                    </Dropdown.Item>
                </Dropdown.Menu>
            </Dropdown>);
    }
}