'use strict';


import React, { useState, useMemo, useCallback } from 'react';
import PropTypes from 'prop-types';
import memoize from 'memoize-one';
import _ from 'underscore';

import DropdownButton from 'react-bootstrap/esm/DropdownButton';
import DropdownItem from 'react-bootstrap/esm/DropdownItem';
import Dropdown from 'react-bootstrap/esm/Dropdown';
import Button from 'react-bootstrap/esm/Button'; // todo refactor out into plain <button> if this file still supported

import { console } from '@hms-dbmi-bgm/shared-portal-components/es/components/util';
import { Checkbox } from '@hms-dbmi-bgm/shared-portal-components/es/components/forms/components/Checkbox';
import { CollapsibleItemViewButtonToolbar } from './../components/CollapsibleItemViewButtonToolbar';

import { PedigreeTabViewBody } from './PedigreeTabViewBody';
import { PedigreeFullScreenBtn } from './PedigreeFullScreenBtn';
import { gatherPhenotypicFeatureItems, getPhenotypicFeatureStrings } from './family-parsing';

/**
 * Hooks for PedigreeTabView & related.
 *
 * @module
 */


/**
 * Reusable logic for toggling disease as part of a React hook.
 * We might make multiple versions of `usePhenotypicFeatureStrings`,
 * some which might use disorders instead of phenotypic strings,
 * for example.
 */
function toggleSelectedDiseaseCallable(selectedDiseases, availableDiseases, setSelectedDiseases, diseaseStr){
    const selDiseaseMap = {};
    selectedDiseases.forEach(function(sd){
        selDiseaseMap[sd] = true;
    });
    if (selDiseaseMap[diseaseStr]) { // Toggle
        delete selDiseaseMap[diseaseStr];
    } else {
        selDiseaseMap[diseaseStr] = true;
    }
    // We want order to be maintained
    const nextSelectedDiseases = availableDiseases.filter(function(ad){
        const { display_title: title } = ad;
        return selDiseaseMap[title] || false;
    }).map(function(ad){
        const { display_title: title } = ad;
        return title;
    });
    setSelectedDiseases(nextSelectedDiseases);
}

/**
 * React hook to help get `selectedDiseases`/`visibleDiseases` to pass to PedigreeVizView.
 * Grabs phenotypic features from context and uses as initial `selectedDiseases`
 * state.
 *
 * @todo (lower priority) React hook or functional equivalent of:
 *     ```
 *     componentDidUpdate(pastProps){
 *         const { context: { case_phenotypic_features: currFeatures = [] } } = this.props;
 *         const { context: { case_phenotypic_features: prevFeatures = [] } } = pastProps;
 *         if (currFeatures !== prevFeatures){
 *             const isEqual = currFeatures.length === prevFeatures.length && (
 *                 _.every(currFeatures, function(feature, idx){
 *                     return feature === prevFeatures[idx];
 *                 })
 *             );
 *             if (!isEqual){
 *                 this.setState({
 *                     selectedDiseases: this.memoized.getPhenotypicFeatureStrings(currFeatures)
 *                 });
 *             }
 *         }
 *     }
 *     ```
 *     Worst case scenario can refactor back to Class component...
 */
export function usePhenotypicFeatureStrings(currFamily){
    const { family_phenotypic_features } = currFamily;
    const contextPhenotypicFeatureStrings = useMemo(function(){
        return getPhenotypicFeatureStrings(family_phenotypic_features);
    }, [ family_phenotypic_features ]);
    const [ selectedDiseases, setSelectedDiseases ] = useState(contextPhenotypicFeatureStrings);
    const availableDiseases = useMemo(
        function(){
            return gatherPhenotypicFeatureItems(currFamily);
        },
        [ currFamily ]
    );
    const onToggleSelectedDisease = useCallback( // `useMemo` & `useCallback` hooks are almost equivalent exc. for param signatures
        function(evt){
            const diseaseStr = evt.target.getAttribute("name");
            if (!diseaseStr) return;
            return toggleSelectedDiseaseCallable(selectedDiseases, availableDiseases, setSelectedDiseases, diseaseStr);
        },
        [ selectedDiseases, availableDiseases, setSelectedDiseases ]
    );
    return {
        selectedDiseases,
        setSelectedDiseases, // Potentially exclude ?
        onToggleSelectedDisease,
        availableDiseases
    };
}


export const PedigreeTabViewOptionsController = React.memo(function PedigreeTabViewOptionsController(props){
    const { children, ...passProps } = props;
    const { currFamily: currentFamily } = passProps;

    const [ showOrderBasedName, setShowOrderBasedName ] = useState(true);
    //const [ showAsDiseases, setShowAsDiseases ] = useState("Case Phenotypic Features");

    function onTogglePedigreeOptionCheckbox(evt){
        const name = evt.target.getAttribute("name");
        if (!name) return false;
        if (name === "showOrderBasedName") {
            setShowOrderBasedName(!showOrderBasedName);
        }
        return false;
    }

    const { selectedDiseases, availableDiseases, onToggleSelectedDisease } = usePhenotypicFeatureStrings(currentFamily);
    const childProps = {
        ...props,
        availableDiseases,
        selectedDiseases,
        onToggleSelectedDisease,
        onTogglePedigreeOptionCheckbox,
        showOrderBasedName,
        // showAsDiseases,
        // setShowAsDiseases
    };
    return React.Children.map(children, function(child){
        return React.cloneElement(child, childProps);
    });
});


/**
 * TabView that shows Pedigree(s) of Case families.
 * Specific to CaseView.
 */
export const PedigreeTabView = React.memo(function PedigreeTabView(props){
    const {
        context, schemas, windowWidth, windowHeight, href, session, graphData,
        availableDiseases, selectedDiseases, onToggleSelectedDisease, onTogglePedigreeOptionCheckbox,
        showOrderBasedName,
        // showAsDiseases, setShowAsDiseases,
        // pedigreeFamilies: families,
        // pedigreeFamiliesIdx,
        currFamily: currentFamily,
        // onFamilySelect
    } = props;

    if (!currentFamily){
        throw new Error("Expected non-empty props.currentFamily.");
    }

    const pedigreeTabViewBodyProps = {
        graphData, session, href,
        context, showOrderBasedName,
        windowWidth, windowHeight,
        visibleDiseases: selectedDiseases
    };

    return (
        <div>
            <div className="container-wide">
                <h3 className="tab-section-title">
                    <span>Pedigree</span>
                    <CollapsibleItemViewButtonToolbar windowWidth={windowWidth}>
                        {/* <ColorAllDiseasesCheckbox checked={showAllDiseases} onChange={this.handleToggleCheckbox} /> */}
                        <UniqueIdentifiersCheckbox checked={!showOrderBasedName} onChange={onTogglePedigreeOptionCheckbox} />
                        <SelectDiseasesDropdown {...{ selectedDiseases, availableDiseases }} onChange={onToggleSelectedDisease} />
                        {/* <ShowAsDiseasesDropdown onSelect={setShowAsDiseases} showAsDiseases={showAsDiseases}  /> */}
                        {/* <FamilySelectionDropdown {...{ families, currentFamilyIdx: pedigreeFamiliesIdx }} onSelect={onFamilySelect} /> */}
                        <PedigreeFullScreenBtn />
                    </CollapsibleItemViewButtonToolbar>
                </h3>
            </div>
            <hr className="tab-section-title-horiz-divider"/>
            <PedigreeTabViewBody {...pedigreeTabViewBodyProps} />
        </div>
    );
});
PedigreeTabView.getTabObject = function(props){
    const { currFamily } = props;
    return {
        'tab' : (
            <React.Fragment>
                <i className="icon icon-sitemap fas icon-fw"/>
                <span>Pedigree</span>
            </React.Fragment>
        ),
        'key' : 'pedigree',
        'disabled' : !(currFamily),
        'content' : <PedigreeTabView {...props} />
    };
};

const SelectDiseasesDropdown = React.memo(function SelectDiseasesDropdown(props){
    const {
        availableDiseases = [],
        selectedDiseases = [],
        onChange,
        title = "Select Case Phenotypic Features",
    } = props;
    if (availableDiseases.length === 0) {
        return null;
    }
    const selectedMap = {};
    selectedDiseases.forEach(function(sD){
        selectedMap[sD] = true;
    });
    let diseaseIndexCounter = 0;
    const optionItems = availableDiseases.map(function(aD){
        const { display_title: title, '@id' : id } = aD;
        const checked = selectedMap[title];
        let diseaseIndex; // undefined
        if (checked){
            diseaseIndexCounter++;
            diseaseIndex = diseaseIndexCounter;
        }
        return (
            <div className="disease-option" key={id}>
                <Checkbox checked={checked}
                    onChange={onChange} name={title}
                    className="text-400">
                    <span className="align-middle text-400">{ title }</span>
                </Checkbox>
                <div className="disease-color-patch" data-disease-index={diseaseIndex}>
                    <span>{ diseaseIndex }</span>
                </div>
            </div>
        );
    });
    return (
        <Dropdown alignRight>
            <Dropdown.Toggle as={Button} variant="outline-dark">
                { title }
            </Dropdown.Toggle>
            <Dropdown.Menu>
                { optionItems }
            </Dropdown.Menu>
        </Dropdown>
    );
});

const UniqueIdentifiersCheckbox = React.memo(function UniqueIdentifiersCheckbox({ checked, onChange }){
    return (
        <Checkbox {...{ checked, onChange }} className="checkbox-container" name="showOrderBasedName">
            <span className="align-middle">Unique Identifiers</span>
        </Checkbox>
    );
});



/* DEPRECATED COMPONENTS */

const ShowAsDiseasesDropdown = React.memo(function ShowAsDiseasesDropdown({ showAsDiseases, onSelect }){
    return (
        <DropdownButton className="ml-05" onSelect={onSelect} title={showAsDiseases} variant="outline-dark" alignRight>
            <DropdownItem active={showAsDiseases === "Case Phenotypic Features"} eventKey="Case Phenotypic Features">Case Phenotypic Features</DropdownItem>
            <DropdownItem active={showAsDiseases === "All Phenotypic Features"} eventKey="All Phenotypic Features">All Phenotypic Features</DropdownItem>
            <DropdownItem active={showAsDiseases === "Case Disorders"} disabled eventKey="Case Disorders">Case Disorders</DropdownItem>
            <DropdownItem active={showAsDiseases === "All Disorders"} disabled eventKey="All Disorders">All Disorders</DropdownItem>
        </DropdownButton>
    );
});


// const FamilySelectionDropdown = React.memo(function FamilySelectionDropdown(props){
//     const { families, currentFamilyIdx = 0, onSelect } = props;
//     if (families.length < 2) {
//         return null;
//     }
//     const title = (
//         <span>Family <strong>{currentFamilyIdx + 1}</strong></span>
//     );
//     return (
//         <DropdownButton onSelect={onSelect} title={title} variant="outline-dark" className="ml-05" alignRight>
//             {
//                 families.map(function(family, i){
//                     const { original_pedigree: pf = null } = family;
//                     const pedFileStr = pf && (" (" + pf.display_title + ")");
//                     return (
//                         <DropdownItem key={i} eventKey={i} active={i === currentFamilyIdx}>
//                             Family {i + 1}{ pedFileStr }
//                         </DropdownItem>
//                     );
//                 })
//             }
//         </DropdownButton>
//     );
// });


// const ColorAllDiseasesCheckbox = React.memo(function ShowAllDiseasesCheckbox({ checked, onChange }){
//     return (
//         <Checkbox className="checkbox-container" name="showAllDiseases" checked={checked} onChange={onChange}>
//             Highlight All
//         </Checkbox>
//     );
// });
