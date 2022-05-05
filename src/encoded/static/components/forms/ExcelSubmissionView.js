'use strict';

import React, { useState, useEffect, useRef } from 'react';
import PropTypes from 'prop-types';
import memoize from 'memoize-one';
import _ from 'underscore';
import ReactTooltip from 'react-tooltip';

import Dropdown from 'react-bootstrap/esm/Dropdown';
import DropdownButton from 'react-bootstrap/esm/DropdownButton';
import DropdownItem from 'react-bootstrap/esm/DropdownItem';

import { console, ajax, JWT, navigate, object, memoizedUrlParse } from '@hms-dbmi-bgm/shared-portal-components/es/components/util';
import { PartialList } from '@hms-dbmi-bgm/shared-portal-components/es/components/ui/PartialList';

import { AttachmentInputController } from './attachment-input';

import { PageTitleContainer, OnlyTitle, pageTitleViews } from '../PageTitleSection';



export default class ExcelSubmissionView extends React.PureComponent {

    constructor(props){
        super(props);
        this.handleSelectPanel = this.handleSelectPanel.bind(this);
        this.handleLoadedUser = this.handleLoadedUser.bind(this);
        this.handleLoadedIngestionSubmission = this.handleLoadedIngestionSubmission.bind(this);
        this.handleComplete = this.handleComplete.bind(this);
        this.markCompleted = this.markCompleted.bind(this);
        this.clearAllAlerts = this.clearAllAlerts.bind(this);
        this.closeAlert = this.closeAlert.bind(this);
        this.pushNewAlert = this.pushNewAlert.bind(this);

        this.state = {
            panelsComplete: [ false, false, false ],
            panelIdx: 0,
            submissionItem: null,
            user: null,
            localAlerts: []
        };
        // console.log('excelsubmissionview props', props);
    }

    componentDidUpdate(pastState){
        const { panelIdx } = this.state;
        if (panelIdx !== pastState.panelIdx){
            ReactTooltip.rebuild();
        }
    }

    componentWillUnmount() {
        const { setIsSubmitting } = this.props;
        setIsSubmitting(false); // remove user prompt on navigation, if hasn't been already
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
        const { setIsSubmitting } = this.props;
        this.setState({ user });
        setIsSubmitting(true); // prompt user on attempt to navigate away
        // note, this is handled here instead of in componentWillMount (for example) to ensure
        // href is fully updated/context fully changed before triggering
    }

    handleLoadedIngestionSubmission(submissionItem){
        if (!(submissionItem && submissionItem['@id'])){
            throw new Error("Expected IngestionSubmission Item");
        }

        this.clearAllAlerts();
        this.setState(({ panelsComplete: pastPanelsComplete }) => {
            let panelsComplete;
            if (pastPanelsComplete[0] !== true){ // ensure step is completed, move to next

                panelsComplete = pastPanelsComplete.slice(0);
                panelsComplete[0] = true;
                return { submissionItem, panelsComplete, panelIdx: 1 };
            } else { // if updating w/status of new ingestion submission
                const {
                    processing_status: { state, outcome, progress },
                    additional_data: { validation_output = [] }
                } = submissionItem;

                if (state === "done" && outcome !== "success") {
                    this.pushNewAlert({
                        "title": "Something went wrong while processing this file...",
                        "message": <ul>{validation_output.map((item) => <li key={item}>{item}</li>)}</ul>,
                        "style": "danger",
                    });
                } else {
                    this.pushNewAlert({
                        "title": "All items validated successfully.",
                        "message": <ul>{validation_output.map((item) => <li key={item}>{item}</li>)}</ul>,
                        "style": "success",
                    });
                }
                return { submissionItem };
            }
        });
    }

    handleComplete(e){
        const { submissionItem: { uuid, ingestion_type: ingestionType, additional_data = null } = {} } = this.state;
        const {
            result: {
                genelist = '/search/?type=GeneList',
                patch: { family = null } = {}
            } = {}
        } = additional_data || {};
        const { target: { value = null } = {} } = e;
        const { 0: familyAtID = null } = Object.keys(family || {}) || [];

        switch(ingestionType) {
            case "metadata_bundle":
                navigate(`/search/?type=Case&ingestion_ids=${uuid}&proband_case=true`);
                break;
            case "genelist":
                navigate(genelist);
                break;
            case "family_history":
                if (value === "View Family Info") {
                    navigate(familyAtID || "/?type=Family&sort=-date_created");
                } else if (value === "View Related Cases") {
                    navigate(`/search/?type=Case&sample_processing.families.ingestion_ids=${uuid}&proband_case=true`);
                }
                break;
            default:
                break;
        }
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

    pushNewAlert(alert) {
        const { localAlerts = [] } = this.state;
        const newAlertState = [...localAlerts, alert];

        this.setState({ localAlerts: newAlertState });
    }

    closeAlert(i) {
        const { localAlerts = [] } = this.state;
        const newAlertState = [];
        localAlerts.forEach((alert, j) => { if (i !== j) newAlertState.push(alert); });

        this.setState({ localAlerts: newAlertState });
    }

    clearAllAlerts(callback) {
        this.setState({ localAlerts: [] }, callback);
    }

    render(){
        const { panelIdx, panelsComplete, submissionItem, localAlerts = [] } = this.state;
        const userDetails = JWT.getUserDetails();
        const {
            '@id' : submissionID,
            'display_title': submissionTitle,
            processing_status: { state, outcome } = {}
        } = submissionItem || {};
        const { setIsSubmitting } = this.props;

        let submissionLink = null;
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
        }

        return (
            <div className="ingestion-submission-view">
                <div className="container">

                    { submissionLink }

                    <LocalAlertsContainer {...{ localAlerts }} closeAlert={this.closeAlert} />

                    <PanelSelectionMenu {...{ panelIdx, panelsComplete, submissionItem }} onSelect={this.handleSelectPanel} />

                    <PanelOne {...this.props} {...this.state} {...{ setIsSubmitting, userDetails }} markCompleted={this.markCompleted} onLoadUser={this.handleLoadedUser}
                        onSubmitIngestionSubmission={this.handleLoadedIngestionSubmission} pushNewAlert={this.pushNewAlert} clearAllAlerts={this.clearAllAlerts} />

                    <PanelTwo {...this.props} {...this.state} {...{ setIsSubmitting, userDetails }} onLoadedIngestionSubmission={this.handleLoadedIngestionSubmission}
                        markCompleted={this.markCompleted} handleComplete={this.handleComplete} pushNewAlert={this.pushNewAlert} clearAllAlerts={this.clearAllAlerts}/>

                    {/* <PanelThree {...this.props} {...this.state} userDetails={userDetails} onLoadedIngestionSubmission={this.handleLoadedIngestionSubmission}
                        onComplete={this.handleComplete} markCompleted={this.markCompleted} /> */}

                </div>
            </div>
        );
    }

}


const LocalAlertsContainer = function LocalAlertsContainer(props) {
    const { localAlerts, closeAlert } = props;

    return (
        <div className="mt-2">
            { localAlerts.map((alert, i) => {
                const { message = null, title, style, noCloseButton } = alert;
                return (
                    <div key={title} className={"alert alert-dismissable alert-" + (style || 'danger') + (noCloseButton === true ? ' no-close-button' : '')}>
                        { noCloseButton !== true ?
                            <button type="button" className="close" onClick={() => closeAlert(i)}>
                                <span aria-hidden="true">×</span>
                                <span className="sr-only">Close alert</span>
                            </button>
                            : null }
                        <h4 className={"alert-heading mt-0" + (message ? " mb-05" : " mb-0")}>{ title }</h4>
                        {message && <div className="mb-0">{message}</div>}
                    </div>
                );
            })}
        </div>
    );
};

function PanelSelectionMenu(props){
    const { onSelect, panelIdx, panelsComplete, submissionItem } = props;
    const steps = [
        "Basic Information",
        "Upload Files"
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
            <div data-for-panel={stepNum} onClick={!disabled && !completed && onSelect ? onSelect : undefined} key={stepNum} className={cls}>
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

    static projectFromUser(user){
        const {
            project_roles: { 0: { project = {} } = {} } = {}
        } = user || {};
        const initState = {
            "projectID": project['@id'] || null,
            "projectTitle": project.display_title || null
        };
        return initState;
    }

    static projectRolesToListofProjects(project_roles){
        const projects = [];
        const projectsSeen = {};

        // Filter out any roles from same projects
        project_roles.forEach((role) => {
            const { project: { "@id": atID, display_title } = {} } = role;
            if (!projectsSeen[atID]) {
                projects.push({ atID, display_title });
                projectsSeen[atID] = true;
            }
        });

        return projects;
    }

    // TODO: Delete probably -- hard sequence from step 1 -> 2 -> 3... no more going back and updating
    static checkIfChanged(submissionItem, projectID){
        const {
            project: { '@id' : submissionProjectID = null } = {},
            display_title: submissionTitle
        } = submissionItem;
        return (projectID !== submissionProjectID);
    }

    constructor(props){
        super(props);
        this.loadUser = this.loadUser.bind(this);
        this.handleSelectProject = this.handleSelectProject.bind(this);
        this.handleCreate = this.handleCreate.bind(this);
        this.handleSelectSubmissionType = this.handleSelectSubmissionType.bind(this);

        const { href } = props;
        const { query: { submissionType = null } = {} } = memoizedUrlParse(href);

        this.state = {
            selectingField: null,
            submissionType: { "Accessioning":1, "Gene List":1, "Family History":1 }[submissionType] ? submissionType : null,
            error: null,
            isCreating: false,
            ...PanelOne.projectFromUser(props.user)
        };
        this.unsetSelectingField     = () => { this.setState({ selectingField: null }); };
        this.setSelectingProject     = () => { this.setState({ selectingField: "project" }); };

        this.memoized = {
            checkIfChanged: PanelOne.checkIfChanged
        };
    }

    componentDidMount(){
        setTimeout(this.loadUser, 0);
    }

    componentDidUpdate(pastProps){
        const { submissionItem = null, markCompleted, panelIdx, panelsComplete, user = null } = this.props;
        const { submissionItem: pastIngestionSubmissionItem = null, panelIdx: pastPanelIdx, user: pastUser } = pastProps;

        if (user !== pastUser){
            this.setState(PanelOne.projectFromUser(user));
            ReactTooltip.rebuild();
            return;
        }

        if (submissionItem && submissionItem !== pastIngestionSubmissionItem){
            const {
                project: {
                    '@id' : projectID = null,
                    display_title: projectTitle = null
                } = {}
            } = submissionItem;
            this.setState({
                projectID, projectTitle
            });
            return;
        }

        if (submissionItem){
            const { projectID } = this.state;
            const valuesDiffer = this.memoized.checkIfChanged(submissionItem, projectID);
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

    handleSelectSubmissionType(eventKey) {
        const { submissionType } = this.state;
        if (eventKey !== submissionType) {
            this.setState({ submissionType: eventKey });
        }
    }

    handleSelectProject(projectID){
        const { user: { project_roles = [] } = {} } = this.props;

        let projectTitle = projectID;
        for (let i = 0; i < project_roles.length; i++) {
            const { project: { "@id": atID = null, display_title = null } = {} } = project_roles[i];
            if (atID === projectID) {
                projectTitle = display_title;
            }
        }

        this.setState({ projectID, projectTitle });
    }

    handleCreate(e){
        const { onSubmitIngestionSubmission, submissionItem, user = null, pushNewAlert, clearAllAlerts } = this.props;
        const {
            projectID: project,
            isCreating = false,
            submissionType = null
        } = this.state;

        const { user_institution: { "@id": institution = null } = {} } = user || {};

        e.preventDefault();
        e.stopPropagation();
        clearAllAlerts();

        if (isCreating || !institution || !project ) return false;

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
                pushNewAlert({
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
                pushNewAlert({
                    'title' : "Validation error " + parseInt(i + 1),
                    'message': detail,
                    'style': 'danger'
                });
            });
        };

        const ingestionTypeToSubmissionTypeMap = { "Accessioning" : "metadata_bundle", "Gene List": "genelist", "Family History": "family_history" };

        const postData = {
            institution, project, processing_status: { state: "created" },
            ingestion_type: submissionType ? ingestionTypeToSubmissionTypeMap[submissionType] : "metadata_bundle"
        };

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
            projectID, projectTitle,
            submissionType,
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

        const { project_roles = [], user_institution: { "@id": institutionID, display_title: institutionTitle } = {} } = user;

        const valuesChanged = !submissionItem || this.memoized.checkIfChanged(submissionItem, institutionID, projectID);
        const createDisabled = (!valuesChanged || isCreating || !institutionID || !projectID );

        const projectList = PanelOne.projectRolesToListofProjects(project_roles);

        return (
            <form className={"panel-form-container d-block" + (isCreating ? " is-creating" : "")} onSubmit={this.handleCreate}>
                <h4 className="text-300 mt-2">Required Fields = <span className="text-danger">*</span></h4>
                <div className="field-section linkto-section mt-2 d-block">
                    <label className="d-block mb-05">Institution</label>
                    <div className="row">
                        <div className="col-auto">{ institutionTitle }</div>
                        <div className="col">
                            <i className="icon icon-fw icon-link fas small mr-05"/>
                            <span className="text-monospace small">{ institutionID }</span> &bull;
                            <a href={institutionID} target="_blank" rel="noopener noreferrer" className="ml-05"
                                data-tip="Open Institution in new window">
                                <i className="icon icon-fw icon-external-link-alt fas small"/>
                            </a>
                        </div>
                    </div>
                </div>
                <LinkToFieldSection onSelect={this.handleSelectProject} title="Project" required options={projectList}
                    type="Project" selectedID={projectID} selectedTitle={projectTitle} searchAsYouType />
                <div className="field-section linkto-section mt-2 d-block">
                    <label className="d-block mb-05">Submission Type</label>
                    <div className="row">
                        <div className="col-auto">
                            <DropdownButton
                                variant="primary text-600 text-capitalize"
                                title={submissionType || "Accessioning"}
                                id="submission-type"
                                onSelect={this.handleSelectSubmissionType}>
                                <Dropdown.Item eventKey="Accessioning">Accessioning</Dropdown.Item>
                                <Dropdown.Item eventKey="Family History">Family History</Dropdown.Item>
                                <Dropdown.Item eventKey="Gene List">Gene List</Dropdown.Item>
                            </DropdownButton>
                        </div>
                    </div>
                </div>

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


class PanelTwo extends React.PureComponent {

    constructor(props){
        super(props);
        this.onAddedFile = this.onAddedFile.bind(this);
        this.setStatusIdx = this.setStatusIdx.bind(this);
        this.state = {
            statusIdx: 0 // 0 = attaching file, 1 = polling for status, 2 = ready to view
        };
    }

    componentDidUpdate(pastProps){
        const { submissionItem, markCompleted, panelIdx } = this.props;
        const { statusIdx } = this.state;
        const { submissionItem: pastIngestionSubmissionItem } = pastProps;
        if (submissionItem !== pastIngestionSubmissionItem){
            ReactTooltip.rebuild();
        }

        if (panelIdx === 1 && statusIdx === 2){
            // We already completed POST; once submission present, mark this complete also.
            markCompleted(1);
        }
    }

    setStatusIdx(idx) {
        this.setState({ statusIdx: idx });
    }

    onAddedFile(response){
        const { pushNewAlert } = this.props;
        const json = JSON.parse(response);
        const { filename, submission_uri } = json;
        // console.log("json", json);

        let message = null;
        if (submission_uri) {
            message = (
                <React.Fragment>
                    <p className="mb-0"><strong>Keep this window open</strong> for updates on file processing status. Note: this may take a while.</p>
                </React.Fragment>
            );
        }
        pushNewAlert({
            "title" : "File Ingestion (" + filename + ") processing...",
            message,
            "style" : "warning",
        });

        // Wait a few seconds before setting new status
        setTimeout(this.setState({ statusIdx: 1 }), 200);
    }

    render(){
        const { user, submissionItem, panelIdx, href, onLoadedIngestionSubmission, setIsSubmitting, handleComplete, pushNewAlert, clearAllAlerts } = this.props;
        const { statusIdx } = this.state;

        const {
            '@id': atID,
            uuid,
            additional_data: { result: { aliases = {} } = {}, post_output = [] } = {},
            ingestion_type: ingestionType = null
        } = submissionItem || {};

        if (panelIdx !== 1) {
            return null;
        }

        let panelContents;
        if (statusIdx === 0) {
            panelContents = (
                <React.Fragment>
                    <h4 className="text-300 mt-2">
                        Attach a file to this IngestionSubmission
                    </h4>
                    <div className="mt-1">
                        {/*TODO: update this with family history links */}
                        { ingestionType === "genelist" ?
                            <>Click <a href="/help/submission/gene-lists" target="_blank" rel="noreferrer">here</a> for more on how to format your genelist submission document.</>
                            : <>Click <a href="/help/submission/accessioning" target="_blank" rel="noreferrer">here</a> for more on how to format your accession submission document.</>}
                    </div>
                    <hr className="mb-1"/>
                    <div className="field-section mt-2">
                        <label className="d-block mb-03">
                            Submit Data
                            {/* <i className="icon icon-info-circle fas icon-fw ml-05" // Needs to be updated
                                data-tip="Select & upload files generated in Proband and other pedigree software" /> */}
                        </label>
                        <AttachmentInputController {...{ ingestionType, href, clearAllAlerts }} context={submissionItem} onAddedFile={this.onAddedFile}>
                            <ExcelSubmissionFileAttachmentBtn/>
                        </AttachmentInputController>
                    </div>
                </React.Fragment>
            );
        } else if (statusIdx === 1) {
            panelContents = <Poller context={submissionItem} setStatusIdx={this.setStatusIdx} {...{ onLoadedIngestionSubmission, setIsSubmitting, pushNewAlert, clearAllAlerts }}/>;
        } else {
            panelContents = (
                <React.Fragment>
                    <div className="d-flex">
                        <div className="col">
                            <h4 className="text-300 mt-2">Successfully processed file.</h4>
                            { ingestionType === "genelist" ?
                                <>
                                    <span className="text-300 text-large">
                                        Variants should begin updating shortly, but may take a few hours depending on server load.
                                    </span>
                                </>
                                : <span className="mb-0 text-small">To view full details of this Ingestion Submission, click <em><a href={atID} target="_blank" rel="noreferrer">here</a></em>.</span>}
                            { ingestionType === "metadata_bundle" || ingestionType === "family_history" ? <div className="text-small mt-05"><span className="mr-1 text-600" data-tip="Use this ID to upload fastq files in SubmitCGAP.">Ingestion Submission UUID:</span> <object.CopyWrapper className="d-inline text-monospace" value={uuid} key="copy-uuid" data-tip="Click to copy">{ uuid }</object.CopyWrapper> </div>: null}
                        </div>
                        <div className="align-self-end">
                            { ingestionType === "metadata_bundle" || ingestionType === "genelist" ?
                                <button type="button" className="btn btn-success" onClick={handleComplete}>
                                    {ingestionType === "metadata_bundle" ? "View New Cases" : "View Gene List" }
                                </button> :
                                <>
                                    <button type="button" className="btn btn-success" onClick={handleComplete} value="View Family Info">View Family Info</button>
                                    <button type="button" className="btn btn-success ml-05" onClick={handleComplete} value="View Related Cases">View Related Cases</button>
                                </>}
                        </div>
                    </div>
                    { ingestionType === "genelist" ? null : (
                        <>
                            <hr/>
                            <span className="pl-1">Results:</span>
                            <CreatedItemsTable aliasToAtIDMap={aliases} />
                        </>)}
                </React.Fragment>
            );
        }

        return (
            <div className="panel-form-container">
                { panelContents }
            </div>
        );
    }

}

function CreatedItemsTable(props) {
    const { aliasToAtIDMap = {} } = props;
    const aliases = Object.keys(aliasToAtIDMap).sort();

    const persistent = aliases.map((alias) => {
        const atID = aliasToAtIDMap[alias];
        const atIDSplit = atID.split("/");
        const { 1: itemType, 2: accession = null } = atIDSplit || [];

        if (itemType === "sample-processings" || itemType === "reports") {
            return null; // skip if no accession
        }
        const label = (
            <React.Fragment>
                <a className="text-600" href={atID} target="_blank" rel="noreferrer">{alias}</a>
                <i className="icon icon-external-link-alt fas text-smaller ml-05"></i>
            </React.Fragment>
        );

        const value = (
            <object.CopyWrapper className="d-inline text-monospace" value={accession} key="copy-accession">{ accession }</object.CopyWrapper>
        );

        return <PartialList.Row {...{ label, value }} key={alias} colSm="7" colMd="7" colLg="7" className="pb-1" />;
    });
    return <PartialList {...{ persistent }} className="pl-1 pt-1"/>;
}

// Custom React Hook by Dan Abramov https://overreacted.io/making-setinterval-declarative-with-react-hooks/
function useInterval(callback, delay) {
    const savedCallback = useRef();

    // Remember the latest callback.
    useEffect(() => {
        savedCallback.current = callback;
    }, [callback]);

    // Set up the interval.
    useEffect(() => {
        function tick() {
            savedCallback.current();
        }
        if (delay !== null) {
            const id = setInterval(tick, delay);
            return () => clearInterval(id);
        }
    }, [delay]);
}

/**
 * Note: by default Poller now uses datastore=database calls - this is to avoid bugs related to the late indexing of updated submissions
 * and should not cause performance issues since there are limited items embedded onto ingestion submission items.
 */
function Poller(props){
    const { context = null, setStatusIdx, onLoadedIngestionSubmission, setIsSubmitting, pushNewAlert, clearAllAlerts } = props;
    const { uuid } = context || {};
    const getURL = "/ingestion-submissions/" + uuid + "/?frame=object&datastore=database";

    const timeStarted = new Date(Date.now());
    const [ lastUpdated, setLastUpdated ] = useState(timeStarted.toLocaleTimeString('en-US'));

    // console.log("context", context);
    useInterval(() => {
        ajax.promise(getURL, "GET")
            .then((response)=> {
                // console.log("response", response);
                const {
                    processing_status : { outcome, state, progress } = {},
                    validation_errors = [],
                    errors = []
                } = response || {};

                // TODO: Add an additional check for bad status codes, etc?
                if (validation_errors.length > 0) {
                    console.error(validation_errors);
                    throw new Error("Did not pass server-side validation...");

                } else if (errors.length > 0) {
                    console.error(errors);
                    throw new Error("Something went wrong while processing...");

                } else {
                    if (state === "done") {
                        switch(outcome) {
                            case "success":
                                // Upload global item
                                onLoadedIngestionSubmission(response);
                                setStatusIdx(2); // Quit polling; allow to proceed to finalization
                                setIsSubmitting(false);
                                break;
                            case "error":
                            case "failure":
                                onLoadedIngestionSubmission(response);
                                setStatusIdx(0);
                                break;
                            case "unknown":
                            default: // Shouldn't happen; outcome should only be unknown if state is not done
                                throw new Error("Something went wrong while processing...");
                        }
                    }  else {
                        // update "last checked" status
                        const timeUpdated = new Date(Date.now());
                        setLastUpdated(timeUpdated.toLocaleTimeString('en-US'));
                        // continue checking until complete; log any progress data to console (not useful, typically)
                        console.log("Progress: ", progress);
                    }
                }
            })
            .catch((error)=> {
                clearAllAlerts();
                if (typeof error === "string") {
                    pushNewAlert({ "title": error, style: "danger" });
                } else {
                    console.error(error);
                    pushNewAlert({ "title": "An unknown error occurred. Consult an administrator or try again later.", style: "danger" });
                }
                setStatusIdx(0); // Re-enable file upload.
            });
    }, 15000);

    return (
        <React.Fragment>
            <div className="mt-2 text-center d-flex flex-column align-items-center justify-content-center">
                <span><i className="icon icon-sync icon-spin fas" />&nbsp; Processing...</span>
                <span className="text-small text-secondary">Last update at: { lastUpdated }</span>
            </div>
        </React.Fragment>
    );
}

function ExcelSubmissionFileAttachmentBtn(props) {
    const { ingestionType, ...passProps } = props;

    let acceptedTypes, acceptedTypesDisplay, uploadType;

    switch(ingestionType) {
        case "genelist":
            acceptedTypes = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, .txt";
            acceptedTypesDisplay = ".xlsx, .txt";
            uploadType = "Gene List";
            break;
        case "metadata_bundle":
            acceptedTypes = ".csv, .tsv, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
            acceptedTypesDisplay = ".csv, .tsv, .xlsx";
            uploadType = "Case";
            break;
        case "family_history":
            acceptedTypes = ".csv, .tsv, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
            acceptedTypesDisplay = ".csv, .tsv, .xlsx";
            uploadType = "Family History";
            break;
    }

    const selectTitle = "Select " + uploadType + " file(s)...";
    const uploadTitle = "Upload " + uploadType;
    const instructionsNode = <div className="text-small font-italic ml-02 mb-1">Accepted file types: { acceptedTypesDisplay }</div>;

    return <FileAttachmentBtn {...passProps} {...{ selectTitle, uploadTitle, instructionsNode, acceptedTypes }}/>;
}

function FileAttachmentBtn(props){
    const {
        selectTitle = "Select file...",
        uploadTitle = "Upload File",
        acceptedTypes = ".csv, .tsv, .txt",
        instructionsNode = null,
        file = null,
        loadingFileResult,
        postFileSuccess,
        onFileInputChange,
        onClearFile,
        onFormSubmit
    } = props;

    const icon = loadingFileResult ? "circle-notch fas icon-spin align-baseline" : "upload fas";

    if (!file) {
        return (
            <React.Fragment>
                { instructionsNode }
                <div className="input-group">
                    <div className="input-group-prepend">
                        <span className="input-group-text pr-5" id="inputGroupFileAddon01">
                            { selectTitle }
                        </span>
                    </div>
                    <div className="input-group-append">
                        <label htmlFor="test_file" disabled={loadingFileResult || postFileSuccess === true }
                            className={"mb-0 btn btn-primary " + (loadingFileResult || postFileSuccess ? " disabled unclickable" : " clickable")}>
                            <input id="test_file" type="file" onChange={!loadingFileResult && onFileInputChange ? onFileInputChange: undefined} className="d-none"
                                disabled={loadingFileResult || postFileSuccess === true}
                                accept={acceptedTypes} />
                            Browse
                        </label>
                    </div>
                </div>
            </React.Fragment>
        );
    }

    const { name: filename } = file || {};

    const clearBtnDisabled = loadingFileResult || postFileSuccess === true;
    return (
        <React.Fragment>
            {instructionsNode}
            <div className="input-group">
                <div className="input-group-prepend mw-50" style={{ maxWidth: "50%" }}>
                    <div className="input-group-text w-100" id="inputGroupFileAddon01">
                        <span className="text-truncate">{ filename }</span>
                        <label htmlFor="test_file" disabled={loadingFileResult || postFileSuccess }
                            className={"mb-0 py-0 btn btn-link " + (loadingFileResult || postFileSuccess ? " disabled unclickable" : " clickable")}>
                            <input id="test_file" type="file" onChange={!loadingFileResult && onFileInputChange ? onFileInputChange: undefined} className="d-none"
                                disabled={loadingFileResult || postFileSuccess === true}
                                accept={acceptedTypes} />
                            Replace
                        </label>
                        { onClearFile && <i className={`${clearBtnDisabled ? "" : "clickable"} icon fas icon-times icon-fw mx-2`} onClick={clearBtnDisabled ? undefined : onClearFile} />}
                    </div>
                </div>
                <div className="input-group-append">
                    <button type="button" className="btn btn-success" onClick={onFormSubmit} disabled={loadingFileResult || postFileSuccess === true}>
                        <i className={"mr-08 icon icon-fw fas icon-" + icon} />
                        {uploadTitle}
                    </button>
                </div>
            </div>
            { !loadingFileResult && postFileSuccess ? <span className="ml-1 text-success">Success! <i className="icon icon-check fas"></i></span> : null}
            { !loadingFileResult && postFileSuccess === false ? <span className="ml-1 text-danger">Failure! <i className="icon icon-times-circle fas"></i></span> : null}
        </React.Fragment>
    );
}
FileAttachmentBtn.propTypes = {
    selectTitle: PropTypes.string, // Placeholder text for upload area
    uploadTitle: PropTypes.string, // Upload/Submit button text
    acceptedTypes: PropTypes.string, // Comma deliniated string of MIME-types to accept
    instructionsNode: PropTypes.node, // Anything for rendering above the input (useful for instructions like max file size, file types in human readable, etc.)
    file: PropTypes.shape({ // File data for currently selected file, if available
        name: PropTypes.string,
    }),
    loadingFileResult: PropTypes.bool, // file is currently in the process of being uploaded/submitted
    postFileSuccess: PropTypes.bool, // file submission succeeded?
    onFileInputChange: PropTypes.func.isRequired, // defines what happens when a file is selected/browsed
    onClearFile: PropTypes.func, // defines what happens when a file is deleted/unselected
    onFormSubmit: PropTypes.func.isRequired // defines what happens when a file is uploaded/submitted
};



/**
 * TODO: May shift PanelTwo functionality to be validation-focused and then have PanelThree be final submission in future.
 */
// class PanelThree extends React.PureComponent { }


/**
 * TODO: Maybe replace with SearchAsYouTypeAjax from SPC.
 */
const LinkToFieldSection = React.memo(function LinkToFieldSection(props){
    const { options, title, type, onSelect, selectedID, selectedTitle, variant = "primary", required } = props;

    let showTitle;
    if (selectedTitle && selectedID){
        showTitle = selectedTitle;
    } else if (selectedID){
        showTitle = selectedID;
    } else {
        showTitle = "None Selected";
    }

    return (
        <div className="field-section linkto-section mt-2 d-block">
            <label className="d-block mb-05">{ title } {required ? <span className="text-danger">*</span>: null}</label>
            <div className="row">
                <div className="col-auto">
                    <ProjectDrop {...{ options, onSelect, selectedID, selectedTitle, variant }} selectedTitle={showTitle} />
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

const ProjectDrop = (props) => {
    const { selectedID, options = [], selectedTitle, onSelect, variant, disabled = false, cls } = props;

    const renderedOptions = options.map(function(project){
        const { display_title, atID : projectID } = project;
        return (
            <DropdownItem className="selectable-item-option" key={projectID} eventKey={projectID}
                active={selectedID === projectID}>
                <div className="row">
                    <div className="col">
                        <span className="text-600 d-block">{ display_title }</span>
                    </div>
                    <div className="col-auto d-none d-md-inline-block">
                        <i className="icon icon-fw icon-link fas small mr-05"/>
                        <span className="text-monospace small">{ projectID }</span>
                    </div>
                </div>
            </DropdownItem>
        );
    });

    const className = "linkto-dropdown text-600" + (cls ? " " + cls : "");
    const title = <span className="text-600">{selectedTitle}</span> || "Select...";
    const isDisabled = options.length <= 1 || disabled;

    let tooltip = null;
    if (options.length === 1 && options[0] && selectedTitle === options[0].display_title) {
        tooltip = "Only project available for current user is currently selected";
    } else if (options.length === 0) {
        tooltip = "No options available";
    }

    return (
        <DropdownButton {...{ variant, title, className }} disabled={isDisabled} data-tip={tooltip} onSelect={onSelect}>
            { renderedOptions }
        </DropdownButton>
    );
};


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
