'use strict';

import React from 'react';
import DropdownButton from 'react-bootstrap/esm/DropdownButton';
import DropdownItem from 'react-bootstrap/esm/DropdownItem';

import { Checkbox } from '@hms-dbmi-bgm/shared-portal-components/es/components/forms/components/Checkbox';
import { CollapsibleItemViewButtonToolbar } from './../CollapsibleItemViewButtonToolbar';

export const WorkflowGraphSectionControls = React.memo(function WorkflowGraphSectionControls(props){
    const {
        showReferenceFiles, showParameters, showIndirectFiles,
        onToggleReferenceFiles, onToggleShowParameters, onToggleIndirectFiles,
        windowWidth,
        rowSpacingType, onRowSpacingTypeSelect,
        includeAllRunsInSteps, toggleAllRuns, isLoadingGraphSteps
    } = props;
    return (
        <CollapsibleItemViewButtonToolbar windowWidth={windowWidth}>
            <ShowAllRunsCheckbox checked={includeAllRunsInSteps} onChange={toggleAllRuns} disabled={isLoadingGraphSteps} />
            { typeof showReferenceFiles === "boolean" ?
                <ReferenceFilesCheckbox checked={showReferenceFiles} onChange={onToggleReferenceFiles} />
                : null }
            { typeof showParameters === "boolean" ?
                <ParametersFileCheckbox checked={showParameters} onChange={onToggleShowParameters} />
                : null }
            { typeof showIndirectFiles === "boolean" ?
                <IndirectFilesCheckbox checked={showIndirectFiles} onChange={onToggleIndirectFiles} />
                : null }
            {/* <IndirectFilesCheckbox checked={showIndirectFiles} onChange={onParsingOptChange} /> */}
            <RowSpacingTypeSelect rowSpacingType={rowSpacingType} onSelect={onRowSpacingTypeSelect} />
        </CollapsibleItemViewButtonToolbar>
    );
});

function RowSpacingTypeSelect(props){
    const { rowSpacingType, onSelect } = props;
    const titleMap = {
        "compact" : "Centered",
        "stacked" : "Stacked",
        "wide" : "Spread"
    };
    return (
        <DropdownButton onSelect={onSelect} title={titleMap[rowSpacingType]} variant="outline-dark" alignRight>
            <DropdownItem active={rowSpacingType === "compact"} eventKey="compact">Centered</DropdownItem>
            <DropdownItem active={rowSpacingType === "stacked"} eventKey="stacked">Stacked</DropdownItem>
            <DropdownItem active={rowSpacingType === "wide"} eventKey="wide">Spread</DropdownItem>
        </DropdownButton>
    );
}

function ReferenceFilesCheckbox({ checked, onChange, disabled }){
    if (typeof onChange !== 'function') return null;
    if (typeof checked === 'undefined') return null;
    return (
        <Checkbox checked={checked} onChange={onChange} disabled={disabled || checked === null}
            className="checkbox-container for-state-showReferenceFiles" name="showReferenceFiles">
            Reference Files
        </Checkbox>
    );
}


function IndirectFilesCheckbox({ checked, onChange, disabled }){
    if (typeof onChange !== 'function') return null;
    if (typeof checked === 'undefined') return null;
    return (
        <Checkbox checked={checked} onChange={onChange} disabled={disabled || checked === null}
            className="checkbox-container for-state-showIndirectFiles" name="showIndirectFiles">
            Indirect Files
        </Checkbox>
    );
}


function ShowAllRunsCheckbox({ checked, onChange, disabled }){
    if (typeof onChange !== 'function') return null;
    if (typeof checked === 'undefined') return null;
    return (
        <Checkbox checked={checked || checked === null} onChange={onChange} disabled={disabled || checked === null}
            className="checkbox-container for-state-allRuns" name="allRuns">
            All Runs
        </Checkbox>
    );
}

function ParametersFileCheckbox({ checked, onChange, disabled }) {
    if (typeof onChange !== 'function') return null;
    if (typeof checked === 'undefined') return null;
    return (
        <Checkbox checked={checked} onChange={onChange} disabled={disabled || checked === null}
            className="checkbox-container for-state-showParameters" name="showParameters">
            Parameters
        </Checkbox>
    );
}
