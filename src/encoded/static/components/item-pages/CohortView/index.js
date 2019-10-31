'use strict';

import React from 'react';
import PropTypes from 'prop-types';
import memoize from 'memoize-one';
import _ from 'underscore';
import { DropdownButton, DropdownItem, Dropdown, Button } from 'react-bootstrap';

import { console, layout, ajax, object, navigate } from '@hms-dbmi-bgm/shared-portal-components/es/components/util';
import { Checkbox } from '@hms-dbmi-bgm/shared-portal-components/es/components/forms/components/Checkbox';
import { CollapsibleItemViewButtonToolbar } from './../components/CollapsibleItemViewButtonToolbar';
import { Alerts } from '@hms-dbmi-bgm/shared-portal-components/es/components/ui/Alerts';

import DefaultItemView from './../DefaultItemView';
import { PedigreeDetailPane } from './../components/PedigreeDetailPane';
import { store } from './../../../store';

import { buildPedigreeGraphData } from './../../viz/PedigreeViz';
import { CohortSummaryTable } from './CohortSummaryTable';
import { PedigreeTabViewBody, idToGraphIdentifier } from './PedigreeTabViewBody';
import { PedigreeFullScreenBtn } from './PedigreeFullScreenBtn';
import { parseFamilyIntoDataset, gatherPhenotypicFeatureItems } from './family-parsing';
import { AttachmentInputController, AttachmentInputMenuOption } from './attachment-input';
import { CohortStats } from './CohortStats';

export {
    CohortSummaryTable,
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
        this.memoized = {
            buildPedigreeGraphData: memoize(buildPedigreeGraphData),
            parseFamilyIntoDataset: memoize(parseFamilyIntoDataset),
            idToGraphIdentifier: memoize(idToGraphIdentifier)
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

    handleFamilySelect(key, callback){
        this.setState({ 'pedigreeFamiliesIdx' : parseInt(key) }, function(){
            if (typeof callback === "function") {
                callback();
            }
        });
    }

    getTabViewContents(){
        //const { context : { families = [] } } = this.props;
        const { pedigreeFamilies = [], pedigreeFamiliesIdx } = this.state;
        const familiesLen = pedigreeFamilies.length;

        let currFamily, graphData, idToGraphIdentifier;
        if (familiesLen > 0){
            currFamily = pedigreeFamilies[pedigreeFamiliesIdx];
            graphData = this.memoized.buildPedigreeGraphData(this.memoized.parseFamilyIntoDataset(currFamily));
            idToGraphIdentifier = this.memoized.idToGraphIdentifier(graphData.objectGraph);
        }

        const initTabs = [];

        initTabs.push(CohortSummaryTabView.getTabObject({
            ...this.props,
            ...this.state, // pedigreeFamilies & pedigreeFamiliesIdx
            currFamily,
            graphData,
            idToGraphIdentifier,
            onFamilySelect: this.handleFamilySelect
        }));

        if (familiesLen > 0) {
            // Remove this outer if condition if wanna show disabled '0 Pedigrees'
            initTabs.push(PedigreeTabView.getTabObject({
                ...this.props,
                ...this.state, // pedigreeFamilies & pedigreeFamiliesIdx
                currFamily,
                graphData,
                idToGraphIdentifier,
                onFamilySelect: this.handleFamilySelect
            }));
        }

        return initTabs.concat(this.getCommonTabs());
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

const CohortSummaryTabView = React.memo(function CohortSummaryTabView(props){
    const {
        pedigreeFamilies: families = [],
        pedigreeFamiliesIdx = 0,
        context: {
            cohort_phenotypic_features: cohortFeatures = { cohort_phenotypic_features: [] },
            description: cohortDescription = ""
        } = {},
        idToGraphIdentifier,
        onFamilySelect
    } = props;
    const familiesLen = families.length;

    function getNumberOfIndividuals(fams) {
        let count = 0;
        fams.forEach(function(fam){ count += fam.members.length; });
        return count;
    }

    function getCountIndividualsWSamples(fams) {
        let count = 0;
        fams.forEach(function(fam){
            fam.members.forEach(function(member){
                if (member.samples && member.samples.length > 0) {
                    count++;
                }
            });
        }); // todo: this is done in CohortSummaryTable --  maybe move it up and pass it down
        return count;
    }

    return (
        <div className="container-wide">
            <h3 className="tab-section-title">
                <span>Cohort Summary</span>
            </h3>
            <hr className="tab-section-title-horiz-divider"/>
            <div className="row mt-2">
                <div className="col-md-12">
                    <div className="card-group row">
                        <div className="col-12 col-lg-7 col-xl-8">
                            <CohortStats
                                description={cohortDescription}
                                numWithSamples={getCountIndividualsWSamples(families)}
                                cohortFeatures={cohortFeatures} numFamilies={familiesLen}
                                numIndividuals={getNumberOfIndividuals(families)} />
                        </div>
                        <div id="cohort-overview-ped-link" className="col-12 col-lg-5 col-xl-4">
                            <a href="#pedigree" className="card-img-top d-none d-lg-block" rel="noreferrer noopener">
                                {/*
                                <img src="https://via.placeholder.com/450x150.png?text=Insert+Pedigree+Graphic+Here" className="card-img-top"/>
                                */}
                                <div className="text-center h-100">
                                    <i className="icon icon-sitemap icon-4x fas" />
                                </div>
                            </a>
                            <a href="#pedigree" className="btn btn-primary btn-block mt-1" rel="noreferrer noopener">View Pedigree(s)</a>
                        </div>
                    </div>
                </div>
            </div>
            {
                families.map(function(family, idx){
                    const { original_pedigree: { display_title: pedFileName } = {} } = family;
                    const cls = "summary-table-container family-index-" + idx;
                    const onClick = function(evt){
                        onFamilySelect(idx, function(){
                            navigate("#pedigree", { skipRequest: true });
                        });
                    };
                    const isCurrentFamily = idx === pedigreeFamiliesIdx;
                    const tip = isCurrentFamily ?
                        "Currently-selected family in Pedigree Visualization"
                        : "Click to view this family in the Pedigree Visualization tab";
                    const title = (
                        <h4 data-family-index={idx} className="clickable" onClick={onClick} data-tip={tip}>
                            <i className="icon icon-fw icon-sitemap fas mr-1 small" />
                            Family { (idx + 1) }
                            { pedFileName ? <span className="text-300">{ " (" + pedFileName + ")" }</span> : null }
                        </h4>
                    );
                    return (
                        <div className={cls} key={idx} data-is-current-family={isCurrentFamily}>
                            { title }
                            <CohortSummaryTable {...family} {...{ idx, idToGraphIdentifier, isCurrentFamily }} />
                        </div>
                    );
                })
            }
        </div>
    );
});
CohortSummaryTabView.getTabObject = function(props){
    const { pedigreeFamilies: families = [] } = props;
    const familiesLen = families.length;
    return {
        'tab' : (
            <React.Fragment>
                <i className="icon icon-cogs fas icon-fw"/>
                <span>Cohort Summary</span>
            </React.Fragment>
        ),
        'key' : 'cohort-summary',
        'disabled' : familiesLen === 0,
        'content' : <CohortSummaryTabView {...props} />
    };
};


/**
 * TabView that shows Pedigree(s) of Cohort families.
 * Specific to CohortView.
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
        this.setState(({ selectedDiseases: prevSelectedDiseases }, { currFamily }) => {
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
            context, schemas, windowWidth, windowHeight, href, session, graphData,
            pedigreeFamilies: families, pedigreeFamiliesIdx, currFamily: currentFamily, onFamilySelect
        } = this.props;
        const { showAllDiseases, showAsDiseases, showOrderBasedName, selectedDiseases } = this.state;

        const availableDiseases = this.memoized.gatherPhenotypicFeatureItems(currentFamily);
        const visibleDiseases = !showAllDiseases && Array.isArray(selectedDiseases) ? selectedDiseases : undefined;

        const pedigreeTabViewBodyProps = {
            graphData, visibleDiseases, session, href,
            context, showOrderBasedName,
            windowWidth, windowHeight
        };

        console.log('DDD1', graphData, visibleDiseases, selectedDiseases, this.memoized.gatherPhenotypicFeatureItems(currentFamily));

        return (
            <div ref={this.tabViewRef}>
                <div className="container-wide">
                    <h3 className="tab-section-title">
                        <span>Pedigree</span>
                        <CollapsibleItemViewButtonToolbar windowWidth={windowWidth}>
                            {/* <ColorAllDiseasesCheckbox checked={showAllDiseases} onChange={this.handleToggleCheckbox} /> */}
                            <UniqueIdentifiersCheckbox checked={!showOrderBasedName} onChange={this.handleToggleCheckbox} />
                            <SelectDiseasesDropdown {...{ showAsDiseases, selectedDiseases, availableDiseases }}
                                onChange={this.handleToggleSelectedDisease} />
                            {/* <ShowAsDiseasesDropdown onSelect={this.handleChangeShowAsDiseases} {...{ showAllDiseases, showAsDiseases }}  /> */}
                            <FamilySelectionDropdown {...{ families, currentFamilyIdx: pedigreeFamiliesIdx }} onSelect={onFamilySelect} />
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