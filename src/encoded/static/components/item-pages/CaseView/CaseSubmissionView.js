'use strict';

import React from 'react';
import PropTypes from 'prop-types';
import memoize from 'memoize-one';
import _ from 'underscore';
import ReactTooltip from 'react-tooltip';
import { DropdownButton, DropdownItem } from 'react-bootstrap';

import { console, ajax, JWT, navigate } from '@hms-dbmi-bgm/shared-portal-components/es/components/util';
import { Alerts } from '@hms-dbmi-bgm/shared-portal-components/es/components/ui/Alerts';
import { LinkToDropdown } from '@hms-dbmi-bgm/shared-portal-components/es/components/forms/components/LinkToDropdown';
import { AliasInputFieldValidated } from '@hms-dbmi-bgm/shared-portal-components/es/components/forms/components/submission-fields';

import { AttachmentInputController } from './attachment-input';

import { PageTitleContainer, OnlyTitle, TitleAndSubtitleUnder, pageTitleViews } from './../../PageTitleSection';
import { Schemas } from './../../util';



export default class CaseSubmissionView extends React.PureComponent {

    constructor(props){
        super(props);
        this.handleSelectPanel = this.handleSelectPanel.bind(this);
        this.handleLoadedUser = this.handleLoadedUser.bind(this);
        this.handleLoadedCase = this.handleLoadedCase.bind(this);
        this.handleComplete = this.handleComplete.bind(this);
        this.markCompleted = this.markCompleted.bind(this);
        this.state = {
            panelsComplete: [ false, false, false ],
            panelIdx: 0,
            caseItem: null,
            user: null
        };
    }

    componentDidUpdate(pastState){
        const { panelIdx } = this.state;
        if (panelIdx !== pastState.panelIdx){
            ReactTooltip.rebuild();
        }
    }

    handleSelectPanel(e){
        const elem = e.currentTarget;
        const panelIdx = parseInt(elem.getAttribute("data-for-panel")) - 1;
        if (isNaN(panelIdx)) {
            throw new Error("Expected number");
        }
        this.setState({ panelIdx });
    }

    handleLoadedUser(user){
        this.setState({ user });
    }

    handleLoadedCase(caseItem){
        if (!(caseItem && caseItem['@id'])){
            throw new Error("Expected Case Item");
        }
        this.setState(function({ panelsComplete: pastPanelsComplete }){
            let panelsComplete;
            if (pastPanelsComplete[0] === true){
                panelsComplete = pastPanelsComplete; // Don't change reference.
            } else {
                panelsComplete = pastPanelsComplete.slice(0);
                panelsComplete[0] = true;
            }
            return { caseItem, panelsComplete, panelIdx: 1 };
        });
    }

    handleComplete(e){
        const { caseItem } = this.state;
        const { '@id' : caseID } = caseItem || {};
        navigate(caseID);
    }

    markCompleted(panelIdx, setTo = true){
        this.setState(function({ panelsComplete: pastPanelsComplete }){
            let panelsComplete;
            if (pastPanelsComplete[panelIdx] === setTo){
                panelsComplete = pastPanelsComplete; // Don't change reference.
            } else {
                panelsComplete = pastPanelsComplete.slice(0);
                panelsComplete[panelIdx] = setTo;
            }
            return { panelsComplete };
        });
    }

    render(){
        const { panelIdx, panelsComplete, caseItem } = this.state;
        const userDetails = JWT.getUserDetails();
        const { '@id' : caseID, 'display_title': caseTitle } = caseItem || {};

        let caseLink = null;
        let finishBtn = null;
        if (caseID && caseTitle){
            caseLink = (
                <h5 className="info-area mb-1 text-400 mt-05">
                    <em className="ml-05">Saved as &bull; </em>
                    <a href={caseID} target="_blank" rel="noopener noreferrer"
                        data-tip="Item is saved in database; further edits will modify it.">
                        { caseTitle }
                    </a>
                    <i className="icon icon-external-link-alt fas text-smaller ml-05"/>
                </h5>
            );
            if (panelIdx !== 2){
                // Hide when on last panel since that has same button, but which also
                // performs a PATCH
                finishBtn = (
                    <div className="buttons-container finish-row text-right">
                        <button type="button" className="btn btn-outline-success" onClick={this.handleComplete}>
                            Finish & View Case
                        </button>
                    </div>
                );
            }
        }

        return (
            <div className="case-submission-view">

                <div className="container">

                    { caseLink }

                    <PanelSelectionMenu {...{ panelIdx, panelsComplete, caseItem }} onSelect={this.handleSelectPanel} />
                    <PanelOne {...this.props} {...this.state} userDetails={userDetails} markCompleted={this.markCompleted}
                        onLoadUser={this.handleLoadedUser} onSubmitCase={this.handleLoadedCase} />

                    <PanelTwo {...this.props} {...this.state} userDetails={userDetails} onLoadedCase={this.handleLoadedCase}
                        markCompleted={this.markCompleted} />

                    <PanelThree {...this.props} {...this.state} userDetails={userDetails} onLoadedCase={this.handleLoadedCase}
                        onComplete={this.handleComplete} markCompleted={this.markCompleted} />

                    { finishBtn }

                </div>
            </div>
        );
    }

}


function PanelSelectionMenu(props){
    const { onSelect, panelIdx, panelsComplete, caseItem } = props;
    const steps = [
        "Basic Information",
        "Import Pedigree(s)",
        "Optional Information"
    ];

    const renderedItems = steps.map(function(stepTitle, stepIdx){
        const stepNum = stepIdx + 1;
        const active = panelIdx === stepIdx;
        const disabled = stepIdx !== 0 && !caseItem; // Becomes undisabled after first panel completed.
        const completed = panelsComplete[stepIdx];
        const cls = (
            "panel-menu-item" +
            (active? " active" : "") +
            (disabled? " disabled" : "") +
            (completed? " completed" : "")
        );
        return (
            <div data-for-panel={stepNum} onClick={!disabled && onSelect} key={stepNum} className={cls}>
                <div className="row">
                    <div className="col-auto number-indicator">
                        <span>{ stepNum }</span>
                    </div>
                    <div className="col">
                        <span className="panel-title d-block small">Step { stepNum }</span>
                        <span>{ stepTitle }</span>
                    </div>
                </div>
            </div>
        );
    });

    return (
        <div className="panel-selection">
            { renderedItems }
        </div>
    );
}


class PanelOne extends React.PureComponent {

    static flatFieldsFromUser(user){
        const {
            institution = {},
            project = {},
            submits_for = []
        } = user || {};
        const initState = {
            "institutionID": institution['@id'] || null,
            "institutionTitle": institution.display_title || null,
            "projectID": project['@id'] || null,
            "projectTitle": project.display_title || null
        };
        if (!initState.institutionID){
            for (let i = 0; i < submits_for.length; i++){
                if (!submits_for[i]['@id']) continue;
                initState.institutionID = submits_for[i]['@id'] || null;
                initState.institutionTitle = submits_for[i].display_title || null;
                break;
            }
        }
        return initState;
    }

    static checkIfChanged(caseItem, title, institutionID, projectID){
        const {
            institution: { '@id' : caseInstitutionID = null } = {},
            project: { '@id' : caseProjectID = null } = {},
            display_title: caseTitle
        } = caseItem;
        return (institutionID !== caseInstitutionID) || (projectID !== caseProjectID) || (title !== caseTitle);
    }

    constructor(props){
        super(props);
        this.loadUser = this.loadUser.bind(this);
        this.handleChangeCaseTitle = this.handleChangeCaseTitle.bind(this);
        this.handleSelectInstitution = this.handleSelectInstitution.bind(this);
        this.handleSelectProject = this.handleSelectProject.bind(this);
        this.handleCreate = this.handleCreate.bind(this);
        this.state = {
            selectingField: null,
            caseTitle: "",
            error: null,
            isCreating: false,
            ...PanelOne.flatFieldsFromUser(props.user)
        };
        this.unsetSelectingField     = () => { this.setState({ selectingField: null }); };
        this.setSelectingInstitution = () => { this.setState({ selectingField: "institution" }); };
        this.setSelectingProject     = () => { this.setState({ selectingField: "project" }); };

        this.memoized = {
            checkIfChanged: PanelOne.checkIfChanged
        };

        this.caseTitleInputRef = React.createRef();
    }

    componentDidMount(){
        setTimeout(this.loadUser, 0);
    }

    componentDidUpdate(pastProps){
        const { caseItem = null, markCompleted, panelIdx, panelsComplete, user } = this.props;
        const { caseItem: pastCaseItem = null, panelIdx: pastPanelIdx, user: pastUser } = pastProps;

        if (user !== pastUser){
            this.setState(PanelOne.flatFieldsFromUser(user));
            this.caseTitleInputRef.current && this.caseTitleInputRef.current.focus();
            ReactTooltip.rebuild();
            return;
        }

        if (caseItem && caseItem !== pastCaseItem){
            const {
                institution: {
                    '@id' : institutionID = null,
                    display_title: institutionTitle = null
                } = {},
                project: {
                    '@id' : projectID = null,
                    display_title: projectTitle = null
                } = {}
            } = caseItem;
            this.setState({
                caseTitle: caseItem.title || "",
                institutionID, institutionTitle,
                projectID, projectTitle
            });
            return;
        }

        if (caseItem){
            const { institutionID, projectID, caseTitle: title } = this.state;
            const valuesDiffer = this.memoized.checkIfChanged(caseItem, title, institutionID, projectID);
            if (valuesDiffer && panelsComplete[0] === true){
                markCompleted(0, false);
            } else if (!valuesDiffer && panelIdx === 0 && panelsComplete[0] === false) {
                // We already completed POST; once case present, mark this complete also.
                markCompleted(0, true);
            }
        }

    }


    loadUser(){
        const { userDetails, panelIdx, onLoadUser } = this.props;
        const { uuid } = userDetails;
        ajax.load("/users/" + uuid + "/", (res)=>{
            if (!(res && res['@id'])) {
                throw new Error("Couldn't fetch user info, make sure you're logged in.");
            }
            onLoadUser(res);
        });
    }

    handleChangeCaseTitle(e){
        this.setState({ caseTitle: e.target.value });
    }

    handleSelectInstitution(institutionID, institutionJSON){
        const { display_title: institutionTitle = null } = institutionJSON;
        this.setState({ institutionID, institutionTitle });
    }

    handleSelectProject(projectID, projectJSON){
        const { display_title: projectTitle = null } = projectJSON;
        this.setState({ projectID, projectTitle });
    }

    handleCreate(e){
        const { onSubmitCase, caseItem } = this.props;
        const {
            caseTitle: title,
            institutionID: institution,
            projectID: project,
            isCreating = false
        } = this.state;

        e.preventDefault();
        e.stopPropagation();

        if (isCreating || !institution || !project || !title) return false;

        const cb = (res) => {
            this.setState({ isCreating: false });
            if (res.status && res.status !== 'success'){
                throw res;
            }
            const [ caseItemObject ] = res['@graph'];
            const { '@id' : caseID } = caseItemObject;

            // Load the @@embedded representation now
            this.request = ajax.load(caseID + "@@embedded", function(getReqRes){
                onSubmitCase(getReqRes);
            });
        };
        const fb = (res) => {
            this.setState({ isCreating: false });

            if (!res || Object.keys(res).length === 0){
                Alerts.queue({
                    'title' : "Submission Error",
                    'message': "Encountered unknown error, likely related to network connection. Please try again.",
                    'style': 'danger'
                });
                return;
            }

            const errorList = res.errors || [ res.detail ];

            errorList.forEach(function(err, i){
                let detail = (err && (err.description || err.detail || err)) || "Unknown Error";
                if (err && err.name){
                    detail += '. ' + err.name;
                }
                Alerts.queue({
                    'title' : "Validation error " + parseInt(i + 1),
                    'message': detail,
                    'style': 'danger'
                });
            });
        };

        const postData = { title, institution, project };

        this.setState({ isCreating: true }, ()=>{
            this.request = ajax.load(
                caseItem ? caseItem['@id'] : "/case/",
                cb,
                caseItem ? "PATCH" : "POST",
                fb,
                JSON.stringify(postData)
            );
        });
    }

    render(){
        const { userDetails, panelIdx, user, caseItem } = this.props;
        const {
            selectingField,
            institutionID, institutionTitle,
            projectID, projectTitle,
            caseTitle,
            isCreating = false
        } = this.state;

        if (panelIdx !== 0) {
            return null;
        }

        if (!user) {
            return (
                <div className="container text-center">
                    <i className="mt-4 mb-4 icon icon-circle-notch fas icon-spin text-larger mr-1 align-middle"/>
                    <h5 className="d-inline text-300 align-middle">Loading Information...</h5>
                </div>
            );
        }

        const valuesChanged = !caseItem || this.memoized.checkIfChanged(caseItem, caseTitle, institutionID, projectID);
        const createDisabled = (!valuesChanged || isCreating || !institutionID || !projectID || !caseTitle);

        return (
            <form className={"panel-form-container d-block" + (isCreating ? " is-creating" : "")} onSubmit={this.handleCreate}>
                <h4 className="text-300 mt-2">Required Fields</h4>

                <LinkToFieldSection onSelect={this.handleSelectInstitution} title="Institution"
                    type="Institution" selectedID={institutionID} selectedTitle={institutionTitle} />
                <LinkToFieldSection onSelect={this.handleSelectProject} title="Project"
                    type="Project" selectedID={projectID} selectedTitle={projectTitle} />
                <label className="field-section mt-2 d-block">
                    <span className="d-block mb-05">Case Title</span>
                    <input type="text" value={caseTitle} onChange={this.handleChangeCaseTitle}
                        className="form-control d-block" ref={this.caseTitleInputRef}/>
                </label>

                <hr className="mb-1"/>

                { valuesChanged ?
                    <div className="buttons-container text-right">
                        <button type="submit" className="btn btn-success"
                            disabled={createDisabled} onClick={this.handleCreate}>
                            { caseItem ? "Submit Changes" : "Create & Proceed" }
                        </button>
                    </div>
                    : null }

            </form>
        );
    }
}

class AliasInputFieldContainer extends React.PureComponent {
    constructor(props){
        super(props);
        this.onAliasChange = this.onAliasChange.bind(this);

    }

    onAliasChange(val){
        const { index, onAliasChange } = this.props;
        onAliasChange(val, index);
    }

    render(){
        const { value, user, ...passProps } = this.props;
        return (
            <div className="mb-1">
                <AliasInputFieldValidated {...passProps}
                    onAliasChange={this.onAliasChange}
                    currentSubmittingUser={user}
                    showErrorMsg value={value} />
            </div>
        );
    }

}


class PanelTwo extends React.PureComponent {

    constructor(props){
        super(props);
        this.onAddedFamily = this.onAddedFamily.bind(this);
    }

    componentDidUpdate(pastProps){
        const { caseItem, markCompleted, panelIdx } = this.props;
        const { families = [] } = caseItem || {};
        const { caseItem: pastCaseItem, panelIdx: pastPanelIdx } = pastProps;
        const { pastFamilies = [] } = pastCaseItem || {};
        if (caseItem !== pastCaseItem){
            ReactTooltip.rebuild();
        }

        if (panelIdx === 1 && pastFamilies.length !== families.length){
            // We already completed POST; once case present, mark this complete also.
            markCompleted(1);
        }
    }

    onAddedFamily(response){
        const { onLoadedCase } = this.props;
        const { context } = response;

        onLoadedCase(context);

        const { families = [] } = context || {};
        const familiesLen = families.length;
        const newestFamily = families[familiesLen - 1];
        const {
            original_pedigree : {
                '@id' : pedigreeID,
                display_title: pedigreeTitle
            } = {},
            pedigree_source = null
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
    }

    render(){
        const { user, caseItem, panelIdx, href } = this.props;

        if (panelIdx !== 1) {
            return null;
        }

        const {
            '@id' : caseID,
            families = []
        } = caseItem || {};

        const familiesLen = families.length;
        const familiesInfo = families.map(function(fam, idx){
            const {
                members = [],
                original_pedigree: { '@id' : pedID, display_title: pedTitle } = {}
            } = fam;
            return (
                <div className="family-info mt-1" key={idx}>
                    <h5 className="mb-0 text-600">Family { idx + 1 }</h5>
                    <div className="">&bull; { members.length } members</div>
                    { pedID && pedTitle ?
                        <div className="">&bull; Document - <a href={pedID} target="_blank" rel="noopener noreferrer">{ pedTitle }</a></div>
                        : null }
                </div>
            );
        });

        return (
            <div className="panel-form-container">
                <h4 className="text-300 mt-2">
                    { familiesLen } { familiesLen === 1 ? "Family" : "Families" } in Case
                </h4>
                { familiesInfo }
                <hr className="mb-1"/>
                <div className="field-section mt-2">
                    <label className="d-block mb-05">
                        Add Family
                        <i className="icon icon-info-circle fas icon-fw ml-05"
                            data-tip="Select & upload files generated in Proband and other pedigree software" />
                    </label>
                    <AttachmentInputController href={href} context={caseItem} onAddedFamily={this.onAddedFamily}>
                        <PedigreeAttachmentBtn/>
                    </AttachmentInputController>
                </div>
            </div>
        );
    }

}

function PedigreeAttachmentBtn(props){
    const { loadingPedigreeResult, onFileInputChange } = props;
    const icon = loadingPedigreeResult ? "circle-notch fas icon-spin align-baseline" : "upload fas";
    return (
        <label htmlFor="test_pedigree" disabled={loadingPedigreeResult}
            className={"btn btn-primary clickable" + (loadingPedigreeResult ? " disabled" : "")}>
            <input id="test_pedigree" type="file" onChange={!loadingPedigreeResult && onFileInputChange} className="d-none" accept="*/*" />
            <i className={"mr-08 icon icon-fw icon-" + icon}/>
            <span>Select Pedigree File...</span>
        </label>
    );
}

class PanelThree extends React.PureComponent {

    static checkIfChanged(caseItem, status, description, aliases = []){
        const { description: cDescription, aliases: cAliases = [], status: cStatus } = caseItem;
        const statusDiffers = cStatus !== status;
        if (statusDiffers) return true;
        const descDiffers = !(!description && !cDescription) && (
            (description && !cDescription) || (description && !cDescription) || description !== cDescription
        );
        if (descDiffers) return true;
        const aliasesDiffers = aliases.length !== cAliases.length || (aliases.length > 0 && !_.every(aliases, function(alias, idx){
            return alias === cAliases[idx];
        }));
        if (aliasesDiffers) return true;
        return false;
    }

    constructor(props){
        super(props);
        this.handleStatusChange = this.handleStatusChange.bind(this);
        this.handleAliasChange = this.handleAliasChange.bind(this);
        this.handleDescriptionChange = this.handleDescriptionChange.bind(this);
        this.handleSubmit = this.handleSubmit.bind(this);
        this.state = {
            isPatching: false,
            status: props.caseItem && props.caseItem.status,
            aliases: (props.caseItem && props.caseItem.aliases && props.caseItem.aliases.slice(0)) || [],
            description: (props.caseItem && props.caseItem.description) || ""
        };

        this.memoized = {
            checkIfChanged: memoize(PanelThree.checkIfChanged)
        };
    }

    componentDidUpdate(pastProps){
        const { caseItem = null, markCompleted, panelIdx, panelsComplete } = this.props;
        const { caseItem: pastCaseItem = null, panelIdx: pastPanelIdx } = pastProps;

        if (caseItem && caseItem !== pastCaseItem){
            this.setState({
                status: caseItem.status,
                aliases: (caseItem.aliases || []).slice(0),
                description: caseItem.description || "",
            });
            return;
        }

        if (caseItem){
            const { aliases, description, status } = this.state;
            const stateDiffersFromCase = this.memoized.checkIfChanged(caseItem, status, description, aliases);
            if (stateDiffersFromCase && panelsComplete[2] === true){
                markCompleted(2, false);
            } else if (!stateDiffersFromCase && panelIdx === 2 && panelsComplete[2] === false) {
                // We already completed POST; once case present, mark this complete also.
                markCompleted(2, true);
            }
        }

    }

    handleStatusChange(status){
        this.setState({ status });
    }

    handleAliasChange(nextAlias, aliasIdx){
        if (typeof aliasIdx === 'undefined'){
            // New alias
            this.setState(function({ aliases: pastAliases }){
                if (!nextAlias) return null;
                const aliases = pastAliases.slice();
                aliases.push(nextAlias);
                return { aliases };
            });
        } else {
            // We don't delete or splices aliases unless is last 1 being unset.
            this.setState(function({ aliases: pastAliases }){
                const aliases = pastAliases.slice();
                if (!nextAlias && aliases.length - 1 === aliasIdx){
                    aliases.splice(aliasIdx, 1);
                } else {
                    aliases[aliasIdx] = nextAlias || null;
                }
                return { aliases };
            });
        }
    }

    handleDescriptionChange(e){
        this.setState({ description: e.target.value });
    }

    handleSubmit(e){
        const { caseItem, onComplete } = this.props;
        const { description, aliases = [], state } = this.state;
        const { '@id' : caseID } = caseItem;
        const cb = (res) => {
            this.setState({ isPatching: false });
            if (res.status && res.status !== 'success'){
                throw res;
            }
            const [ caseItemObject ] = res['@graph'];
            onComplete(caseItemObject);
        };
        const fb = (res) => {
            this.setState({ isPatching: false });
            const errorList = res.errors || [ res.detail ];
            errorList.forEach(function(serverErr, i){
                let detail = serverErr.description || serverErr || "Unidentified error";
                if (serverErr.name){
                    detail += '. ' + serverErr.name;
                }
                Alerts.queue({
                    'title' : "Validation error " + parseInt(i + 1),
                    'message': detail,
                    'style': 'danger'
                });
            });
        };

        const postData = { state };
        if (description){
            postData.description = description;
        }
        const validAliases = aliases.filter(function(a){
            return a && a !== "ERROR";
        });
        if (validAliases.length > 0){
            postData.aliases = validAliases;
        }

        this.setState({ isPatching: true }, ()=>{
            this.request = ajax.load(caseID, cb, "PATCH", fb, JSON.stringify(postData));
        });
    }

    render(){
        const { panelIdx, schemas, caseItem, user } = this.props;
        const { status, description, aliases, isPatching } = this.state;

        if (panelIdx !== 2 || !schemas) {
            return null;
        }

        /** Aliases Field */
        const skipValidateAliases = (caseItem && caseItem.aliases) || [];
        const aliasFields = aliases.map((alias, aliasIdx) => {
            const rejectAliases = _.filter(aliases.slice(0, aliasIdx));
            return (
                <AliasInputFieldContainer onAliasChange={this.handleAliasChange} user={user} value={alias} showErrorMsg
                    index={aliasIdx} key={aliasIdx} skipValidateAliases={skipValidateAliases}
                    rejectAliases={rejectAliases} />
            );
        });
        aliasFields.push(
            <AliasInputFieldContainer onAliasChange={this.handleAliasChange} user={user} showErrorMsg
                key={aliases.length} rejectAliases={aliases} />
        );

        /** Status Field */
        const statusTitle = (
            <React.Fragment>
                <i className="item-status-indicator-dot mr-1" data-status={status}/>
                { Schemas.Term.toName("status", status) }
            </React.Fragment>
        );
        const statusFieldSchema = schemas['Case'].properties.status;
        const statusOpts = statusFieldSchema.enum.map(function(statusOpt){
            return (
                <DropdownItem key={statusOpt} eventKey={statusOpt}>
                    <i className="item-status-indicator-dot mr-1" data-status={statusOpt}/>
                    { Schemas.Term.toName("status", statusOpt) }
                </DropdownItem>
            );
        });

        const stateDiffersFromCase = this.memoized.checkIfChanged(caseItem, status, description, aliases);

        return (
            <div className={"panel-form-container" + (isPatching ? " is-creating" : "")}>
                <h4 className="text-300 mt-2">Optional Fields</h4>
                <label className="field-section mt-2 d-block">
                    <label className="d-block mb-05">Description</label>
                    <textarea value={description} onChange={this.handleDescriptionChange} className="form-control"
                        style={{ width: '100%' }}/>
                </label>
                <div className="field-section mt-2">
                    <label className="d-block mb-05">
                        Alias(es)
                        <i className="icon icon-info-circle fas icon-fw ml-05"
                            data-tip="Alternate identifiers that this Case can be reached by" />
                    </label>
                    { aliasFields }
                </div>
                <div className="field-section mt-2">
                    <label className="d-block mb-05">
                        Case Status
                    </label>
                    <DropdownButton title={statusTitle} variant="outline-dark"
                        onSelect={this.handleStatusChange}>
                        { statusOpts }
                    </DropdownButton>
                </div>
                <hr className="mb-1" />
                <div className="buttons-container text-right">
                    <button type="button" className={"btn btn-" + (stateDiffersFromCase ? "success" : "outline-success")}
                        disabled={isPatching} onClick={this.handleSubmit}>
                        Finish & View Case
                    </button>
                </div>
            </div>
        );
    }
}


const LinkToFieldSection = React.memo(function LinkToFieldSection(props){
    const { title, type, onSelect, selectedID, selectedTitle, variant = "primary" } = props;

    let showTitle;
    if (selectedTitle && selectedID){
        showTitle = <span className="text-600">{ selectedTitle }</span>;
    } else if (selectedID){
        showTitle = selectedID;
    } else {
        showTitle = <em>None Selected</em>;
    }

    return (
        <div className="field-section linkto-section mt-2 d-block">
            <label className="d-block mb-05">{ title }</label>
            <div className="row">
                <div className="col-auto">
                    <LinkToDropdown {...{ onSelect, selectedID, variant }} searchURL={"/search/?type=" + type} selectedTitle={showTitle} />
                </div>
                <div className="col">
                    <i className="icon icon-fw icon-link fas small mr-05"/>
                    <span className="text-monospace small">{ selectedID }</span> &bull;
                    <a href={selectedID} target="_blank" rel="noopener noreferrer" className="ml-05"
                        data-tip={"Open " + type + " in new window"}>
                        <i className="icon icon-fw icon-external-link-alt fas small"/>
                    </a>
                </div>
            </div>
        </div>
    );
});



const CaseSubmissionViewPageTitle = React.memo(function CaseSubmissionViewPageTitle({ context, href, schemas, currentAction, alerts }){
    return (
        <PageTitleContainer alerts={alerts} className="container">
            <OnlyTitle>
                New Case
            </OnlyTitle>
        </PageTitleContainer>
    );
});

pageTitleViews.register(CaseSubmissionViewPageTitle, "Case", "create");
pageTitleViews.register(CaseSubmissionViewPageTitle, "Case", "add");

