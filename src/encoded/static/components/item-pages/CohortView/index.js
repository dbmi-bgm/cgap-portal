'use strict';

import React from 'react';
import PropTypes from 'prop-types';
import memoize from 'memoize-one';
import _ from 'underscore';
import { DropdownButton, DropdownItem, Dropdown, Button } from 'react-bootstrap';

import { console, layout, ajax, object } from '@hms-dbmi-bgm/shared-portal-components/es/components/util';
import { Checkbox } from '@hms-dbmi-bgm/shared-portal-components/es/components/forms/components/Checkbox';
import { CollapsibleItemViewButtonToolbar } from './../components/CollapsibleItemViewButtonToolbar';
import { Alerts } from '@hms-dbmi-bgm/shared-portal-components/es/components/ui/Alerts';

import DefaultItemView from './../DefaultItemView';
import { PedigreeDetailPane } from './../components/PedigreeDetailPane';
import { store } from './../../../store';

import { ProcessingSummaryTable } from './ProcessingSummaryTable';
import { PedigreeTabViewBody } from './PedigreeTabViewBody';
import { PedigreeFullScreenBtn } from './PedigreeFullScreenBtn';
import { parseFamilyIntoDataset, gatherPhenotypicFeatureItems } from './family-parsing';
import { AttachmentInputController, AttachmentInputMenuOption } from './attachment-input';

export {
    ProcessingSummaryTable,
    PedigreeTabViewBody,
    PedigreeFullScreenBtn,
    parseFamilyIntoDataset
};


export default class CohortView extends DefaultItemView {

    static haveFullViewPermissionForFamily(family){
        const { original_pedigree = null, proband = null, members = [] } = family;
        if (original_pedigree && !object.isAnItem(original_pedigree)){
            // Tests for presence of display_title and @id, lack of which indicates lack of view permission.
            return false;
        }
        if (proband && !object.isAnItem(proband)){
            return false;
        }
        if (members.length === 0) {
            return false;
        }
        for (var i = 0; i < members.length; i++){
            if (!object.isAnItem(members[i])){
                return false;
            }
        }
        return true;
    }

    constructor(props){
        super(props);
        this.onAddedFamily = this.onAddedFamily.bind(this);
        this.handleFamilySelect = this.handleFamilySelect.bind(this);
        const pedigreeFamilies = (props.context.families || []).filter(CohortView.haveFullViewPermissionForFamily);
        const familiesLen = pedigreeFamilies.length;
        this.state = {
            ...this.state,
            pedigreeFamilies,
            pedigreeFamiliesIdx: familiesLen - 1
        };
    }

    componentDidUpdate(pastProps, pastState){
        const { context } = this.props;
        if (pastProps.context !== context){
            const pedigreeFamilies = (context.families || []).filter(CohortView.haveFullViewPermissionForFamily);
            const familiesLen = pedigreeFamilies.length;
            this.setState({
                pedigreeFamilies,
                pedigreeFamiliesIdx: familiesLen - 1
            });
        }
    }

    onAddedFamily(response){
        const { context, status, title } = response;
        if (!context || status !== "success") return;

        const { families = [] } = context || {};
        const familiesLen = families.length;
        const newestFamily = families[familiesLen - 1];

        if (!newestFamily) return;

        const {
            original_pedigree : {
                '@id' : pedigreeID,
                display_title: pedigreeTitle
            } = {},
            pedigree_source
        } = newestFamily;
        let message = null;

        if (pedigreeTitle && pedigreeID){
            message = (
                <React.Fragment>
                    <p className="mb-0">Added family from pedigree <a href={pedigreeID}>{ pedigreeTitle }</a>.</p>
                    { pedigree_source? <p className="mb-0 text-small">Source of pedigree: <em>{ pedigree_source }</em></p> : null }
                </React.Fragment>
            );
        }
        Alerts.queue({
            "title" : "Added family " + familiesLen,
            message,
            "style" : "success"
        });

        store.dispatch({ type: { context } });
    }

    handleFamilySelect(key){
        this.setState({ 'pedigreeFamiliesIdx' : parseInt(key) });
    }

    getTabViewContents(){
        const { context : { families = [] } } = this.props;
        const { pedigreeFamilies = [] } = this.state;
        const familiesLen = pedigreeFamilies.length;
        const initTabs = [];

        if (familiesLen > 0){
            // Remove this outer if condition if wanna show disabled '0 Pedigrees' tab instead

            initTabs.push(PedigreeTabView.getTabObject({
                ...this.props,
                ...this.state, // pedigreeFamilies & pedigreeFamiliesIdx
                handleFamilySelect: this.handleFamilySelect
            }));

        }

        if (familiesLen > 0){
            // Remove this outer if condition if wanna show disabled 'Pedigree Summary' tab instead

            initTabs.push(ProcessingSummaryTabView.getTabObject({
                ...this.props,
                ...this.state, // pedigreeFamilies & pedigreeFamiliesIdx
                handleFamilySelect: this.handleFamilySelect
            }));

        }

        return this.getCommonTabs().concat(initTabs);
    }

    /** Render additional item actions */
    additionalItemActionsContent(){
        const { context, href } = this.props;
        const hasEditPermission = _.find(context.actions || [], { 'name' : 'edit' });
        if (!hasEditPermission){
            return null;
        }
        return (
            <AttachmentInputController {...{ context, href }} onAddedFamily={this.onAddedFamily}>
                <AttachmentInputMenuOption />
            </AttachmentInputController>
        );
    }
}



const ProcessingSummaryTabView = React.memo(function ProcessingSummaryTabView(props){
    const { pedigreeFamilies: families = [] } = props;
    const familiesLen = families.length;
    return (
        <div className="container-wide">
            <h3 className="tab-section-title">
                <span>Processing Summary</span>
            </h3>
            <hr className="tab-section-title-horiz-divider"/>
            {
                families.map(function(family, idx){
                    const { original_pedigree: { display_title: pedFileName } = {} } = family;
                    const cls = "summary-table-container family-index-" + idx;
                    const title = familiesLen === 1 ? null : (
                        <h4>
                            { "Family " + (idx + 1) }
                            { pedFileName ? <span className="text-300">{ " (" + pedFileName + ")" }</span> : null }
                        </h4>
                    );
                    return (
                        <div className={cls} key={idx}>
                            { title }
                            <ProcessingSummaryTable {...family} idx={idx} />
                        </div>
                    );
                })
            }
        </div>
    );
});
ProcessingSummaryTabView.getTabObject = function(props){
    const { pedigreeFamilies: families = [] } = props;
    const familiesLen = families.length;
    return {
        'tab' : (
            <React.Fragment>
                <i className="icon icon-cogs fas icon-fw"/>
                <span>Processing Summary</span>
            </React.Fragment>
        ),
        'key' : 'processing-summary',
        'disabled' : familiesLen === 0,
        'content' : <ProcessingSummaryTabView {...props} />
    };
};


/**
 * TabView that shows Pedigree(s) of Cohort families.
 * Specific to CohortView.
 *
 * @todo Separate zoom logic into a ZoomController component.
 * @todo Create better zoom stuff/ui.
 */
class PedigreeTabView extends React.PureComponent {

    static getTabObject(props){
        const { pedigreeFamilies: families = [] } = props;
        const familiesLen = families.length;
        return {
            'tab' : (
                <React.Fragment>
                    <i className="icon icon-sitemap fas icon-fw"/>
                    <span>{ "" + familiesLen + " Pedigree" + (familiesLen > 1 ? "s" : "") }</span>
                </React.Fragment>
            ),
            'key' : 'pedigree',
            'disabled' : familiesLen === 0,
            'content' : <PedigreeTabView {...props} />
        };
    }

    static getPhenotypicFeatureStrings(cohort_phenotypic_features = []){
        const strings = [];
        cohort_phenotypic_features.forEach(function(feature){
            if (typeof feature === 'string') return feature;
            const { '@id' : featureID, display_title } = feature;
            if (!featureID) return;
            strings.push(display_title || featureID);
        });
        return strings;
    }

    constructor(props){
        super(props);
        this.handleToggleCheckbox = this.handleToggleCheckbox.bind(this);
        this.handleChangeShowAsDiseases = this.handleChangeShowAsDiseases.bind(this);
        this.handleToggleSelectedDisease = this.handleToggleSelectedDisease.bind(this);
        this.renderDetailPane = this.renderDetailPane.bind(this);

        this.memoized = {
            parseFamilyIntoDataset : memoize(parseFamilyIntoDataset),
            getPhenotypicFeatureStrings : memoize(PedigreeTabView.getPhenotypicFeatureStrings),
            gatherPhenotypicFeatureItems: memoize(gatherPhenotypicFeatureItems)
        };

        if (!(Array.isArray(props.context.families) && props.context.families.length > 0)){
            throw new Error("Expected props.context.families to be a non-empty Array.");
        }

        const { cohort_phenotypic_features = [] } = props.context;

        this.state = {
            showAllDiseases : false,
            showAsDiseases: "Phenotypic Features", // todo - enum
            showOrderBasedName: true,
            selectedDiseases: this.memoized.getPhenotypicFeatureStrings(cohort_phenotypic_features)
        };

        this.tabViewRef = React.createRef();
    }

    componentDidUpdate(pastProps){
        const { context: { cohort_phenotypic_features: currFeatures = [] } } = this.props;
        const { context: { cohort_phenotypic_features: prevFeatures = [] } } = pastProps;
        if (currFeatures !== prevFeatures){
            const isEqual = currFeatures.length === prevFeatures.length && (
                _.every(currFeatures, function(feature, idx){
                    return feature === prevFeatures[idx];
                })
            );
            if (!isEqual){
                this.setState({
                    selectedDiseases: this.memoized.getPhenotypicFeatureStrings(currFeatures)
                });
            }
        }
    }

    handleToggleCheckbox(evt){
        const name = evt.target.getAttribute("name");
        if (!name) return false;
        this.setState(function({ [name] : currState }){
            return { [name]: !currState };
        });
    }

    handleChangeShowAsDiseases(key, evt){
        const nextShowAllDiseases = key.slice(0,4) === "All ";
        let showAsDiseases;
        if (nextShowAllDiseases){ // = "All ..."
            showAsDiseases = key.slice(4);
        } else { // = "Cohort ..."
            showAsDiseases = key.slice(5);
        }
        this.setState({
            showAsDiseases,
            showAllDiseases: nextShowAllDiseases
        });
    }

    handleToggleSelectedDisease(evt, tt){
        const name = evt.target.getAttribute("name");
        if (!name) return;
        this.setState(({ selectedDiseases: prevSelectedDiseases }, { pedigreeFamilies = null, pedigreeFamiliesIdx }) => {
            const selDiseaseMap = {};
            prevSelectedDiseases.forEach(function(sd){
                selDiseaseMap[sd] = true;
            });
            if (selDiseaseMap[name]) { // Toggle
                delete selDiseaseMap[name];
            } else {
                selDiseaseMap[name] = true;
            }
            // We want order to be maintained
            const currFamily = pedigreeFamilies[pedigreeFamiliesIdx];
            const availableDiseases = this.memoized.gatherPhenotypicFeatureItems(currFamily);
            const selectedDiseases = availableDiseases.filter(function(ad){
                const { display_title: title } = ad;
                return selDiseaseMap[title] || false;
            }).map(function(ad){
                const { display_title: title } = ad;
                return title;
            });
            return { selectedDiseases };
        });
    }

    renderDetailPane(pedigreeVizProps){
        const { session, href, context } = this.props;
        return <PedigreeDetailPane {...pedigreeVizProps} {...{ session, href, context }} />;
    }

    render(){
        const {
            context, schemas, windowWidth, windowHeight, href, session,
            handleFamilySelect, pedigreeFamiliesIdx, pedigreeFamilies: families = []
        } = this.props;
        const { showAllDiseases, showAsDiseases, showOrderBasedName, selectedDiseases } = this.state;
        const { cohort_phenotypic_features = [] } = context;

        const currentFamily = families[pedigreeFamiliesIdx];

        //const phenotypicFeatureStrings = showAllDiseases ? null : this.memoized.getPhenotypicFeatureStrings(cohort_phenotypic_features);

        const dataset = this.memoized.parseFamilyIntoDataset(currentFamily);
        const visibleDiseases = !showAllDiseases && Array.isArray(selectedDiseases) ? selectedDiseases : undefined;

        const pedigreeTabViewBodyProps = {
            dataset, visibleDiseases, session, href,
            context, showOrderBasedName,
            windowWidth, windowHeight
        };

        console.log('DDD1', dataset, visibleDiseases, selectedDiseases, this.memoized.gatherPhenotypicFeatureItems(currentFamily));

        return (
            <div ref={this.tabViewRef}>
                <div className="container-wide">
                    <h3 className="tab-section-title">
                        <span>Pedigree</span>
                        <CollapsibleItemViewButtonToolbar windowWidth={windowWidth}>
                            {/* <ColorAllDiseasesCheckbox checked={showAllDiseases} onChange={this.handleToggleCheckbox} /> */}
                            <UniqueIdentifiersCheckbox checked={!showOrderBasedName} onChange={this.handleToggleCheckbox} />
                            <SelectDiseasesDropdown {...{ showAsDiseases, selectedDiseases }} onChange={this.handleToggleSelectedDisease}
                                availableDiseases={this.memoized.gatherPhenotypicFeatureItems(currentFamily)} />
                            {/* <ShowAsDiseasesDropdown onSelect={this.handleChangeShowAsDiseases} {...{ showAllDiseases, showAsDiseases }}  /> */}
                            <FamilySelectionDropdown {...{ families, currentFamilyIdx: pedigreeFamiliesIdx }} onSelect={handleFamilySelect} />
                            <PedigreeFullScreenBtn />
                        </CollapsibleItemViewButtonToolbar>
                    </h3>
                </div>
                <hr className="tab-section-title-horiz-divider"/>
                <PedigreeTabViewBody {...pedigreeTabViewBodyProps} />
            </div>
        );
    }
}

const SelectDiseasesDropdown = React.memo(function SelectDiseasesDropdown(props){
    const { availableDiseases = [], showAsDiseases, selectedDiseases = [], onChange } = props;
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
                Select { showAsDiseases }
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

const FamilySelectionDropdown = React.memo(function FamilySelectionDropdown(props){
    const { families, currentFamilyIdx = 0, onSelect } = props;
    if (families.length < 2) {
        return null;
    }
    const title = (
        <span>Family <strong>{currentFamilyIdx + 1}</strong></span>
    );
    return (
        <DropdownButton onSelect={onSelect} title={title} variant="outline-dark" className="ml-05" alignRight>
            {
                families.map(function(family, i){
                    const { original_pedigree: pf = null } = family;
                    const pedFileStr = pf && (" (" + pf.display_title + ")");
                    return (
                        <DropdownItem key={i} eventKey={i} active={i === currentFamilyIdx}>
                            Family {i + 1}{ pedFileStr }
                        </DropdownItem>
                    );
                })
            }
        </DropdownButton>
    );
});

/* DEPRECATED COMPONENTS */

// const ShowAsDiseasesDropdown = React.memo(function ShowAsDiseasesDropdown({ showAsDiseases, onSelect, showAllDiseases }){
//     const title = (showAllDiseases ? "All " : "Cohort ") + showAsDiseases;
//     return (
//         <DropdownButton className="ml-05" onSelect={onSelect} title={title} variant="outline-dark" alignRight>
//             <DropdownItem active={!showAllDiseases && showAsDiseases === "Phenotypic Features"} eventKey="Cohort Phenotypic Features">Cohort Phenotypic Features</DropdownItem>
//             <DropdownItem active={showAllDiseases && showAsDiseases === "Phenotypic Features"} eventKey="All Phenotypic Features">All Phenotypic Features</DropdownItem>
//             <DropdownItem active={!showAllDiseases && showAsDiseases === "Disorders"} disabled eventKey="Cohort Disorders">Cohort Disorders</DropdownItem>
//             <DropdownItem active={showAllDiseases && showAsDiseases === "Disorders"} disabled eventKey="All Disorders">All Disorders</DropdownItem>
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