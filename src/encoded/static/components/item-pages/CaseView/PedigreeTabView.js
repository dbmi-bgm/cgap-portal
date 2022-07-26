'use strict';


import React, { useState, useMemo, useCallback } from 'react';
import PropTypes from 'prop-types';
import memoize from 'memoize-one';
import _ from 'underscore';
import DropdownButton from 'react-bootstrap/esm/DropdownButton';
import DropdownItem from 'react-bootstrap/esm/DropdownItem';

import { console } from '@hms-dbmi-bgm/shared-portal-components/es/components/util';
import { Checkbox } from '@hms-dbmi-bgm/shared-portal-components/es/components/forms/components/Checkbox';
import { CollapsibleItemViewButtonToolbar } from './../components/CollapsibleItemViewButtonToolbar';

import { PedigreeTabViewBody, PedigreeFullScreenBtn } from '../components/PedigreeTabViewBody';
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
function toggleSelectedDiseaseCallable(selectedDiseaseIdxMap, availableDiseases, setSelectedDiseaseIdxMap, diseaseStr){
    const nextMap = { ...selectedDiseaseIdxMap };
    if (nextMap[diseaseStr]) { // Toggle
        delete nextMap[diseaseStr];
    } else {
        const invertedDiseaseIdxMap = _.invert(nextMap);
        // Find lowest number not yet used (incl prev. deleted ones)
        for (var lowestUnusedIdx = 1; lowestUnusedIdx < 10000; lowestUnusedIdx++) {
            if (invertedDiseaseIdxMap[lowestUnusedIdx]) {
                continue;
            }
            break;
        }
        nextMap[diseaseStr] = lowestUnusedIdx;
    }

    setSelectedDiseaseIdxMap(nextMap);
}

/**
 * React hook to help get `selectedDiseases`/`visibleDiseases` to pass to PedigreeVizView.
 * Grabs phenotypic features from context and uses as initial `selectedDiseases`
 * state.
 *
 * `selectedDiseases` is an array whose order will determine its 'data-disease-index',
 * to which colors are mapped to in CSS stylesheet.
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
    const { family_phenotypic_features = [] } = currFamily || {};

    // Initially-visible things
    const { contextPhenotypicFeatureStrings, initialSelectedDiseaseIdxMap } = useMemo(function(){
        const contextPhenotypicFeatureStrings = getPhenotypicFeatureStrings(family_phenotypic_features);
        const initialSelectedDiseaseIdxMap = {};
        contextPhenotypicFeatureStrings.forEach(function(diseaseStr, idx){
            initialSelectedDiseaseIdxMap[diseaseStr] = idx + 1; // 1-based
        });
        return { contextPhenotypicFeatureStrings, initialSelectedDiseaseIdxMap };
    }, [ family_phenotypic_features ]);

    // Set as selectedDiseases/selectedDiseaseIdxMap
    // Possible TODO: Update this state if (from props) `family_phenotypic_features` changes?
    const [ selectedDiseaseIdxMap, setSelectedDiseaseIdxMap ] = useState(initialSelectedDiseaseIdxMap);

    // All diseases present in family
    const availableDiseases = useMemo(
        function(){
            const selectedDiseaseOrder = {};
            contextPhenotypicFeatureStrings.forEach(function(diseaseStr, idx){
                // Normally is 1-based ordering for these but doesn't matter here as just for sorting availableDiseases.
                selectedDiseaseOrder[diseaseStr] = idx;
            });

            return gatherPhenotypicFeatureItems(currFamily).sort(function({ display_title: titleA }, { display_title: titleB }){
                const a = selectedDiseaseOrder[titleA];
                const b = selectedDiseaseOrder[titleB];
                if (typeof a === "number" && typeof b !== "number") return -1;
                if (typeof a !== "number" && typeof b === "number") return 1;
                if (typeof a === "number" && typeof b === "number") return a - b;
                return 0;
            });
        },
        // Though this could change as selectedDiseases changes, we only care about "initial" order and don't want to re-sort each time
        // that selected diseases changes, just first time is rendered.
        [ currFamily, contextPhenotypicFeatureStrings ]
    );

    // `useCallback(fn, deps)` is equivalent to `useMemo(() => fn, deps)`
    // See https://reactjs.org/docs/hooks-reference.html#usecallback
    const onToggleSelectedDisease = useCallback(function(evt){
        const diseaseStr = evt.target.getAttribute("name");
        if (!diseaseStr) return;
        return toggleSelectedDiseaseCallable(selectedDiseaseIdxMap, availableDiseases, setSelectedDiseaseIdxMap, diseaseStr);
    }, [ selectedDiseaseIdxMap, availableDiseases, setSelectedDiseaseIdxMap ]);

    return {
        selectedDiseaseIdxMap,
        setSelectedDiseaseIdxMap, // Potentially exclude ?
        onToggleSelectedDisease,
        availableDiseases
    };
}


export const PedigreeTabViewOptionsController = React.memo(function PedigreeTabViewOptionsController(props){
    const { children, ...passProps } = props;
    const { currPedigreeFamily } = passProps;

    const [ showOrderBasedName, setShowOrderBasedName ] = useState(true);
    //const [ showAsDiseases, setShowAsDiseases ] = useState("Case Phenotypic Features");

    const onTogglePedigreeOptionCheckbox = useCallback(function(evt){
        const name = evt.target.getAttribute("name");
        if (!name) return false;
        if (name === "showOrderBasedName") {
            setShowOrderBasedName(function(currentShowOrderBasedName){
                return !currentShowOrderBasedName;
            });
        }
        return false;
    });

    const { selectedDiseaseIdxMap, availableDiseases, onToggleSelectedDisease } = usePhenotypicFeatureStrings(currPedigreeFamily);

    if (currPedigreeFamily) {
        const childProps = {
            ...props,
            availableDiseases,
            selectedDiseaseIdxMap,
            onToggleSelectedDisease,
            onTogglePedigreeOptionCheckbox,
            showOrderBasedName,
            // showAsDiseases,
            // setShowAsDiseases
        };
        return React.Children.map(children, function(child){
            return React.cloneElement(child, childProps);
        });
    }
    return children;
});


/**
 * TabView that shows Pedigree(s) of Case families.
 * Specific to CaseView.
 */
export const PedigreeTabView = React.memo(function PedigreeTabView(props){
    const {
        PedigreeVizLibrary,
        context, schemas, windowWidth, windowHeight, href, session, graphData,
        availableDiseases, selectedDiseaseIdxMap, onToggleSelectedDisease, onTogglePedigreeOptionCheckbox,
        showOrderBasedName,
        // showAsDiseases, setShowAsDiseases,
        familiesWithViewPermission,
        pedigreeFamiliesIdx,
        currPedigreeFamily,
        onFamilySelect,
        isActiveTab = false
    } = props;

    if (!currPedigreeFamily){
        throw new Error("Expected non-empty props.currPedigreeFamily.");
    }

    // if (!isActiveTab) {
    //     return null;
    // }

    const pedigreeTabViewBodyProps = {
        session, href, context, schemas,
        PedigreeVizLibrary,
        graphData,
        showOrderBasedName,
        windowWidth, windowHeight,
        selectedDiseaseIdxMap, availableDiseases, onToggleSelectedDisease
        /// "visibleDiseaseIdxMap": selectedDiseaseIdxMap
    };

    return (
        <div>
            <div className="container-wide">
                <h3 className="tab-section-title">
                    <span>Pedigree</span>
                    <CollapsibleItemViewButtonToolbar windowWidth={windowWidth}>
                        {/* <ColorAllDiseasesCheckbox checked={showAllDiseases} onChange={this.handleToggleCheckbox} /> */}
                        <UniqueIdentifiersCheckbox checked={!showOrderBasedName} onChange={onTogglePedigreeOptionCheckbox} />
                        {/* <SelectDiseasesDropdown {...{ selectedDiseaseIdxMap, availableDiseases, onToggleSelectedDisease }} /> */}
                        {/* <ShowAsDiseasesDropdown onSelect={setShowAsDiseases} showAsDiseases={showAsDiseases}  /> */}
                        <FamilySelectionDropdown {...{ familiesWithViewPermission, pedigreeFamiliesIdx }} onSelect={onFamilySelect} />
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
    const { currPedigreeFamily } = props;
    return {
        'tab' : (
            <React.Fragment>
                <i className="icon icon-sitemap fas icon-fw"/>
                <span>Pedigree</span>
            </React.Fragment>
        ),
        'key' : 'pedigree',
        'disabled' : !(currPedigreeFamily),
        'content' : <PedigreeTabView {...props} />
    };
};


const UniqueIdentifiersCheckbox = React.memo(function UniqueIdentifiersCheckbox({ checked, onChange }){
    return (
        <Checkbox {...{ checked, onChange }} className="checkbox-container" name="showOrderBasedName">
            <span className="align-middle">Unique Identifiers</span>
        </Checkbox>
    );
});



/* DEPRECATED COMPONENTS */

// const ShowAsDiseasesDropdown = React.memo(function ShowAsDiseasesDropdown({ showAsDiseases, onSelect }){
//     return (
//         <DropdownButton className="ml-05" onSelect={onSelect} title={showAsDiseases} variant="outline-dark" alignRight>
//             <DropdownItem active={showAsDiseases === "Case Phenotypic Features"} eventKey="Case Phenotypic Features">Case Phenotypic Features</DropdownItem>
//             <DropdownItem active={showAsDiseases === "All Phenotypic Features"} eventKey="All Phenotypic Features">All Phenotypic Features</DropdownItem>
//             <DropdownItem active={showAsDiseases === "Case Disorders"} disabled eventKey="Case Disorders">Case Disorders</DropdownItem>
//             <DropdownItem active={showAsDiseases === "All Disorders"} disabled eventKey="All Disorders">All Disorders</DropdownItem>
//         </DropdownButton>
//     );
// });


const FamilySelectionDropdown = React.memo(function FamilySelectionDropdown(props){
    const { familiesWithViewPermission, pedigreeFamiliesIdx = 0, onSelect } = props;
    if (familiesWithViewPermission.length < 2) {
        return null;
    }
    const title = (
        <span>Family <strong>{pedigreeFamiliesIdx + 1}</strong></span>
    );
    return (
        <DropdownButton onSelect={onSelect} title={title} variant="outline-dark" className="ml-05" alignRight>
            {
                familiesWithViewPermission.map(function(family, i){
                    const { original_pedigree: pf = null } = family;
                    const pedFileStr = pf && (" (" + pf.display_title + ")");
                    return (
                        <DropdownItem key={i} eventKey={i} active={i === pedigreeFamiliesIdx}>
                            Family {i + 1}{ pedFileStr }
                        </DropdownItem>
                    );
                })
            }
        </DropdownButton>
    );
});


// const ColorAllDiseasesCheckbox = React.memo(function ShowAllDiseasesCheckbox({ checked, onChange }){
//     return (
//         <Checkbox className="checkbox-container" name="showAllDiseases" checked={checked} onChange={onChange}>
//             Highlight All
//         </Checkbox>
//     );
// });
