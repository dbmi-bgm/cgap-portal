'use strict';

import React from 'react';
import PropTypes from 'prop-types';
import memoize from 'memoize-one';
import _ from 'underscore';
import ReactTooltip from 'react-tooltip';

import Dropdown from 'react-bootstrap/esm/Dropdown';
import DropdownButton from 'react-bootstrap/esm/DropdownButton';
import DropdownItem from 'react-bootstrap/esm/DropdownItem';

import { console, ajax, JWT, navigate } from '@hms-dbmi-bgm/shared-portal-components/es/components/util';
import { Alerts } from '@hms-dbmi-bgm/shared-portal-components/es/components/ui/Alerts';
import { LinkToDropdown } from '@hms-dbmi-bgm/shared-portal-components/es/components/forms/components/LinkToDropdown';
import { AliasInputFieldValidated } from '@hms-dbmi-bgm/shared-portal-components/es/components/forms/components/submission-fields';

import { AttachmentInputController } from './attachment-input';

import { PageTitleContainer, OnlyTitle, TitleAndSubtitleUnder, pageTitleViews } from '../PageTitleSection';
import { Schemas } from '../util';


// NOT CURRENTLY USED, MAY BE REINTRODUCED IN FUTURE


export default class ExcelSubmissionView extends React.PureComponent {

    constructor(props){
        super(props);
        this.handleSelectPanel = this.handleSelectPanel.bind(this);
        this.handleLoadedUser = this.handleLoadedUser.bind(this);
        this.handleLoadedIngestionSubmission = this.handleLoadedIngestionSubmission.bind(this);
        this.handleComplete = this.handleComplete.bind(this);
        this.markCompleted = this.markCompleted.bind(this);
        this.state = {
            panelsComplete: [ false, false, false ],
            panelIdx: 0,
            submissionItem: null,
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

    handleLoadedIngestionSubmission(submissionItem){
        if (!(submissionItem && submissionItem['@id'])){
            throw new Error("Expected IngestionSubmission Item");
        }
        this.setState(function({ panelsComplete: pastPanelsComplete }){
            let panelsComplete;
            if (pastPanelsComplete[0] !== true){ // ensure step is completed, move to next
                panelsComplete = pastPanelsComplete.slice(0);
                panelsComplete[0] = true;
            }
            return { submissionItem, panelsComplete, panelIdx: 1 };
        });
    }

    handleComplete(e){
        const { submissionItem } = this.state;
        const { '@id' : submissionID } = submissionItem || {};
        navigate(submissionID);
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
        const { panelIdx, panelsComplete, submissionItem } = this.state;
        const userDetails = JWT.getUserDetails();
        const { '@id' : submissionID, 'display_title': submissionTitle } = submissionItem || {};

        let submissionLink = null;
        let finishBtn = null;
        if (submissionID && submissionTitle){
            submissionLink = (
                <h5 className="info-area mb-1 text-400 mt-05">
                    <em className="ml-05">Saved as &bull; </em>
                    <a href={submissionID} target="_blank" rel="noopener noreferrer"
                        data-tip="Item is saved in database; further edits will modify it.">
                        { submissionTitle }
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
                            Finish & View IngestionSubmission
                        </button>
                    </div>
                );
            }
        }

        return (
            <div className="ingestion-submission-view">

                <div className="container">

                    { submissionLink }

                    <PanelSelectionMenu {...{ panelIdx, panelsComplete, submissionItem }} onSelect={this.handleSelectPanel} />

                    <PanelOne {...this.props} {...this.state} userDetails={userDetails} markCompleted={this.markCompleted}
                        onLoadUser={this.handleLoadedUser} onSubmitIngestionSubmission={this.handleLoadedIngestionSubmission} />

                    <PanelTwo {...this.props} {...this.state} userDetails={userDetails} onLoadedIngestionSubmission={this.handleLoadedIngestionSubmission}
                        markCompleted={this.markCompleted} />

                    <PanelThree {...this.props} {...this.state} userDetails={userDetails} onLoadedIngestionSubmission={this.handleLoadedIngestionSubmission}
                        onComplete={this.handleComplete} markCompleted={this.markCompleted} />

                    { finishBtn }

                </div>
            </div>
        );
    }

}


function PanelSelectionMenu(props){
    const { onSelect, panelIdx, panelsComplete, submissionItem } = props;
    const steps = [
        "Basic Information",
        "Upload Files",
        "Finalize and View"
    ];

    const renderedItems = steps.map(function(stepTitle, stepIdx){
        const stepNum = stepIdx + 1;
        const active = panelIdx === stepIdx;
        const completed = panelsComplete[stepIdx];
        const disabled = !active && !completed; // Hard sequence... cannot go back to previous steps
        const cls = (
            "panel-menu-item" +
            (active? " active" : "") +
            (disabled? " disabled" : "") +
            (completed? " completed" : "")
        );
        return (
            <div data-for-panel={stepNum} onClick={!disabled && !completed && onSelect} key={stepNum} className={cls}>
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

// NOT CURRENTLY USED, MAY BE REINTRODUCED IN FUTURE
class PanelOne extends React.PureComponent {

    // OUTDATED - WE NOW HAVE PROJECT_ROLES
    static flatFieldsFromUser(user){
        const {
            institution = {},
            project = {},
            submits_for = [] // OUTDATED - WE NOW HAVE PROJECT_ROLES
        } = user || {};
        const initState = {
            "institutionID": institution['@id'] || null,
            "institutionTitle": institution.display_title || null,
            "projectID": project['@id'] || null,
            "projectTitle": project.display_title || null
        };
        if (!initState.institutionID){
            for (let i = 0; i < submits_for.length; i++){                           // OUTDATED - WE NOW HAVE PROJECT_ROLES
                if (!submits_for[i]['@id']) continue;                               // OUTDATED - WE NOW HAVE PROJECT_ROLES
                initState.institutionID = submits_for[i]['@id'] || null;            // OUTDATED - WE NOW HAVE PROJECT_ROLES
                initState.institutionTitle = submits_for[i].display_title || null;  // OUTDATED - WE NOW HAVE PROJECT_ROLES
                break;
            }
        }
        return initState;
    }

    static checkIfChanged(submissionItem, title, institutionID, projectID){
        const {
            institution: { '@id' : submissionInstitutionID = null } = {},
            project: { '@id' : submissionProjectID = null } = {},
            display_title: submissionTitle
        } = submissionItem;
        return (institutionID !== submissionInstitutionID) || (projectID !== submissionProjectID) || (title !== submissionTitle);
    }

    constructor(props){
        super(props);
        this.loadUser = this.loadUser.bind(this);
        this.handleChangeIngestionSubmissionTitle = this.handleChangeIngestionSubmissionTitle.bind(this);
        this.handleSelectInstitution = this.handleSelectInstitution.bind(this);
        this.handleSelectProject = this.handleSelectProject.bind(this);
        this.handleCreate = this.handleCreate.bind(this);
        this.handleSelectIngestionType = this.handleSelectIngestionType.bind(this);

        this.state = {
            selectingField: null,
            submissionTitle: "",
            ingestionType: null,
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

        this.submissionTitleInputRef = React.createRef();
    }

    componentDidMount(){
        setTimeout(this.loadUser, 0);
    }

    componentDidUpdate(pastProps){
        const { submissionItem = null, markCompleted, panelIdx, panelsComplete, user } = this.props;
        const { submissionItem: pastIngestionSubmissionItem = null, panelIdx: pastPanelIdx, user: pastUser } = pastProps;

        if (user !== pastUser){
            this.setState(PanelOne.flatFieldsFromUser(user));
            this.submissionTitleInputRef.current && this.submissionTitleInputRef.current.focus();
            ReactTooltip.rebuild();
            return;
        }

        if (submissionItem && submissionItem !== pastIngestionSubmissionItem){
            const {
                institution: {
                    '@id' : institutionID = null,
                    display_title: institutionTitle = null
                } = {},
                project: {
                    '@id' : projectID = null,
                    display_title: projectTitle = null
                } = {}
            } = submissionItem;
            this.setState({
                submissionTitle: submissionItem.title || "",
                institutionID, institutionTitle,
                projectID, projectTitle
            });
            return;
        }

        if (submissionItem){
            const { institutionID, projectID, submissionTitle: title } = this.state;
            const valuesDiffer = this.memoized.checkIfChanged(submissionItem, title, institutionID, projectID);
            if (!valuesDiffer && panelIdx === 0 && panelsComplete[0] === false) {
                // We already completed POST; once submission present, mark this complete also.
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

    handleChangeIngestionSubmissionTitle(e){
        this.setState({ submissionTitle: e.target.value });
    }

    handleSelectIngestionType(eventKey) {
        const { ingestionType } = this.state;
        if (eventKey !== ingestionType) {
            this.setState({ ingestionType: eventKey });
        }
    }

    handleSelectInstitution(institutionJSON, institutionID){
        const { display_title: institutionTitle = null } = institutionJSON;
        this.setState({ institutionID, institutionTitle });
    }

    handleSelectProject(projectJSON, projectID){
        const { display_title: projectTitle = null } = projectJSON;
        this.setState({ projectID, projectTitle });
    }

    handleCreate(e){
        const { onSubmitIngestionSubmission, submissionItem } = this.props;
        const {
            submissionTitle: title,
            institutionID: institution,
            projectID: project,
            ingestionType,
            isCreating = false
        } = this.state;

        e.preventDefault();
        e.stopPropagation();

        if (isCreating || !institution || !project || !title || !ingestionType) return false;

        const cb = (res) => {
            this.setState({ isCreating: false });
            if (res.status && res.status !== 'success'){
                throw res;
            }
            const [ submissionItemObject ] = res['@graph'];
            const { '@id' : submissionID } = submissionItemObject;

            // Load the @@embedded representation now
            this.request = ajax.load(submissionID + "@@embedded", function(getReqRes){
                onSubmitIngestionSubmission(getReqRes);
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

        const postData = { submission_id: title, institution, project, ingestion_type: ingestionType, processing_status: { state: "created" } };

        this.setState({ isCreating: true }, ()=>{
            this.request = ajax.load(
                submissionItem ? submissionItem['@id'] : "/IngestionSubmission/",
                cb,
                submissionItem ? "PATCH" : "POST",
                fb,
                JSON.stringify(postData)
            );
        });
    }

    render(){
        const { userDetails, panelIdx, user, submissionItem } = this.props;
        const {
            selectingField,
            institutionID, institutionTitle,
            projectID, projectTitle,
            submissionTitle,
            ingestionType,
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

        const valuesChanged = !submissionItem || this.memoized.checkIfChanged(submissionItem, submissionTitle, institutionID, projectID);
        const createDisabled = (!valuesChanged || isCreating || !institutionID || !projectID || !submissionTitle);

        return (
            <form className={"panel-form-container d-block" + (isCreating ? " is-creating" : "")} onSubmit={this.handleCreate}>
                <h4 className="text-300 mt-2">Required Fields</h4>

                <LinkToFieldSection onSelect={this.handleSelectInstitution} title="Institution"
                    type="Institution" selectedID={institutionID} selectedTitle={institutionTitle} searchAsYouType/>
                <LinkToFieldSection onSelect={this.handleSelectProject} title="Project"
                    type="Project" selectedID={projectID} selectedTitle={projectTitle} searchAsYouType />
                <label className="field-section mt-2 d-block">
                    <span className="d-block mb-05">Ingestion Type</span>
                    <DropdownButton
                        variant="primary text-600"
                        title={ingestionType || "None Selected"}
                        id="ingestion-type"
                    >
                        <Dropdown.Item eventKey="metadata_bundle" onSelect={this.handleSelectIngestionType}>Metadata Bundle</Dropdown.Item>
                        <Dropdown.Item eventKey="vcf" onSelect={this.handleSelectIngestionType}>VCF</Dropdown.Item>
                        {/* <Dropdown.Item eventKey="Gene List" onSelect={this.handleSelectIngestionType}>Gene List</Dropdown.Item> */}
                    </DropdownButton>
                </label>
                <label className="field-section mt-2 d-block">
                    <span className="d-block mb-05">IngestionSubmission Title</span>
                    <input type="text" value={submissionTitle} onChange={this.handleChangeIngestionSubmissionTitle}
                        className="form-control d-block" ref={this.submissionTitleInputRef}/>
                </label>

                <hr className="mb-1"/>

                { valuesChanged ?
                    <div className="buttons-container text-right">
                        <button type="submit" className="btn btn-success"
                            disabled={createDisabled} onClick={this.handleCreate}>
                            { submissionItem ? "Submit Changes" : "Create & Proceed" }
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
        const { submissionItem, markCompleted, panelIdx } = this.props;
        const { families = [] } = submissionItem || {};
        const { submissionItem: pastIngestionSubmissionItem, panelIdx: pastPanelIdx } = pastProps;
        const { pastFamilies = [] } = pastIngestionSubmissionItem || {};
        if (submissionItem !== pastIngestionSubmissionItem){
            ReactTooltip.rebuild();
        }

        if (panelIdx === 1 && pastFamilies.length !== families.length){
            // We already completed POST; once submission present, mark this complete also.
            markCompleted(1);
        }
    }

    onAddedFamily(response){
        const { onLoadedIngestionSubmission } = this.props;
        const { context } = response;

        onLoadedIngestionSubmission(context);

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
        const { user, submissionItem, panelIdx, href } = this.props;

        if (panelIdx !== 1) {
            return null;
        }

        return (
            <div className="panel-form-container">
                <h4 className="text-300 mt-2">
                    Attach a file to this IngestionSubmission
                </h4>
                <div className="mt-1">
                    Click <a href="https://hms-dbmi.atlassian.net/browse/C4-505" target="_blank" rel="noreferrer">here</a> for more on how to format your document.
                </div>
                <hr className="mb-1"/>
                <div className="field-section mt-2">
                    <label className="d-block mb-05">
                        Submit Data
                        <i className="icon icon-info-circle fas icon-fw ml-05"
                            data-tip="Select & upload files generated in Proband and other pedigree software" />
                    </label>
                    <AttachmentInputController href={href} context={submissionItem} onAddedFamily={this.onAddedFamily}>
                        <FileAttachmentBtn/>
                    </AttachmentInputController>
                </div>
            </div>
        );
    }

}

function FileAttachmentBtn(props){
    const { loadingFileResult, onFileInputChange } = props;
    const icon = loadingFileResult ? "circle-notch fas icon-spin align-baseline" : "upload fas";
    return (
        <label htmlFor="test_file" disabled={loadingFileResult}
            className={"btn btn-primary clickable" + (loadingFileResult ? " disabled" : "")}>
            <input id="test_file" type="file" onChange={!loadingFileResult && onFileInputChange} className="d-none"
                accept=".csv, .tsv, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, application/vnd.ms-excel" />
            <i className={"mr-08 icon icon-fw icon-" + icon}/>
            <span>Select Excel File...</span>
        </label>
    );
}

class PanelThree extends React.PureComponent {

    static checkIfChanged(submissionItem, status, description, aliases = []){
        const { description: cDescription, aliases: cAliases = [], status: cStatus } = submissionItem;
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
            status: props.submissionItem && props.submissionItem.status,
            aliases: (props.submissionItem && props.submissionItem.aliases && props.submissionItem.aliases.slice(0)) || [],
            description: (props.submissionItem && props.submissionItem.description) || ""
        };

        this.memoized = {
            checkIfChanged: memoize(PanelThree.checkIfChanged)
        };
    }

    componentDidUpdate(pastProps){
        const { submissionItem = null, markCompleted, panelIdx, panelsComplete } = this.props;
        const { submissionItem: pastIngestionSubmissionItem = null, panelIdx: pastPanelIdx } = pastProps;

        if (submissionItem && submissionItem !== pastIngestionSubmissionItem){
            this.setState({
                status: submissionItem.status,
                aliases: (submissionItem.aliases || []).slice(0),
                description: submissionItem.description || "",
            });
            return;
        }

        if (submissionItem){
            const { aliases, description, status } = this.state;
            const stateDiffersFromIngestionSubmission = this.memoized.checkIfChanged(submissionItem, status, description, aliases);
            if (stateDiffersFromIngestionSubmission && panelsComplete[2] === true){
                markCompleted(2, false);
            } else if (!stateDiffersFromIngestionSubmission && panelIdx === 2 && panelsComplete[2] === false) {
                // We already completed POST; once submission present, mark this complete also.
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
        const { submissionItem, onComplete } = this.props;
        const { description, aliases = [], state } = this.state;
        const { '@id' : submissionID } = submissionItem;
        const cb = (res) => {
            this.setState({ isPatching: false });
            if (res.status && res.status !== 'success'){
                throw res;
            }
            const [ submissionItemObject ] = res['@graph'];
            onComplete(submissionItemObject);
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
            this.request = ajax.load(submissionID, cb, "PATCH", fb, JSON.stringify(postData));
        });
    }

    render(){
        const { panelIdx, schemas, submissionItem, user } = this.props;
        const { status, description, aliases, isPatching } = this.state;

        if (panelIdx !== 2 || !schemas) {
            return null;
        }

        /** Aliases Field */
        const skipValidateAliases = (submissionItem && submissionItem.aliases) || [];
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
                <i className="status-indicator-dot mr-1" data-status={status}/>
                { Schemas.Term.toName("status", status) }
            </React.Fragment>
        );
        const statusFieldSchema = schemas['IngestionSubmission'].properties.status;
        const statusOpts = statusFieldSchema.enum.map(function(statusOpt){
            return (
                <DropdownItem key={statusOpt} eventKey={statusOpt}>
                    <i className="status-indicator-dot mr-1" data-status={statusOpt}/>
                    { Schemas.Term.toName("status", statusOpt) }
                </DropdownItem>
            );
        });

        const stateDiffersFromIngestionSubmission = this.memoized.checkIfChanged(submissionItem, status, description, aliases);

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
                            data-tip="Alternate identifiers that this IngestionSubmission can be reached by" />
                    </label>
                    { aliasFields }
                </div>
                <div className="field-section mt-2">
                    <label className="d-block mb-05">
                        IngestionSubmission Status
                    </label>
                    <DropdownButton title={statusTitle} variant="outline-dark"
                        onSelect={this.handleStatusChange}>
                        { statusOpts }
                    </DropdownButton>
                </div>
                <hr className="mb-1" />
                <div className="buttons-container text-right">
                    <button type="button" className={"btn btn-" + (stateDiffersFromIngestionSubmission ? "success" : "outline-success")}
                        disabled={isPatching} onClick={this.handleSubmit}>
                        Finish & View IngestionSubmission
                    </button>
                </div>
            </div>
        );
    }
}


const LinkToFieldSection = React.memo(function LinkToFieldSection(props){
    const { title, type, onSelect, selectedID, selectedTitle, variant = "primary", searchAsYouType } = props;

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
                    <LinkToDropdown {...{ onSelect, selectedID, variant, searchAsYouType }} searchURL={"/search/?type=" + type} selectedTitle={showTitle} />
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



const ExcelSubmissionViewPageTitle = React.memo(function ExcelSubmissionViewPageTitle({ context, href, schemas, currentAction, alerts }){
    return (
        <PageTitleContainer alerts={alerts} className="container">
            <OnlyTitle>
                New IngestionSubmission
            </OnlyTitle>
        </PageTitleContainer>
    );
});

pageTitleViews.register(ExcelSubmissionViewPageTitle, "IngestionSubmission", "create");
pageTitleViews.register(ExcelSubmissionViewPageTitle, "IngestionSubmissionSearchResults", "add");
