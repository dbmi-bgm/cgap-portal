'use strict';

import React, { useState, useEffect, useRef } from 'react';
import PropTypes from 'prop-types';
import memoize from 'memoize-one';
import _ from 'underscore';
import ReactTooltip from 'react-tooltip';

import Dropdown from 'react-bootstrap/esm/Dropdown';
import DropdownButton from 'react-bootstrap/esm/DropdownButton';
import DropdownItem from 'react-bootstrap/esm/DropdownItem';
import Collapse from 'react-bootstrap/esm/Collapse';

import { console, ajax, JWT, navigate } from '@hms-dbmi-bgm/shared-portal-components/es/components/util';
import { Alerts } from '@hms-dbmi-bgm/shared-portal-components/es/components/ui/Alerts';
import { LinkToDropdown } from '@hms-dbmi-bgm/shared-portal-components/es/components/forms/components/LinkToDropdown';
import { AliasInputFieldValidated } from '@hms-dbmi-bgm/shared-portal-components/es/components/forms/components/submission-fields';

import { AttachmentInputController } from './attachment-input';

import { PageTitleContainer, OnlyTitle, TitleAndSubtitleUnder, pageTitleViews } from '../PageTitleSection';
import { Schemas } from '../util';



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
        console.log('excelsubmissionview props', props);
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
        this.setState(function({ panelsComplete: pastPanelsComplete }){
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
                    Alerts.queue({
                        "title": "Something went wrong while processing this file...",
                        "message": <ul>{validation_output.map((item) => <li key="item">{item}</li>)}</ul>,
                        "style": "danger"
                    });
                }
                return { submissionItem };
            }
        });
    }

    handleComplete(e){
        const { submissionItem } = this.state;
        const { uuid } = submissionItem || {};
        navigate(`/search/?type=Case&ingestion_id=${uuid}`);
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
        const {
            '@id' : submissionID,
            'display_title': submissionTitle,
            processing_status: { state, outcome } = {}
        } = submissionItem || {};
        const { setIsSubmitting } = this.props;

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
            if (panelIdx !== 2 && state === "done" && outcome === "success"){
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

                    <PanelOne {...this.props} {...this.state} {...{ setIsSubmitting, userDetails }} markCompleted={this.markCompleted}
                        onLoadUser={this.handleLoadedUser} onSubmitIngestionSubmission={this.handleLoadedIngestionSubmission} />

                    <PanelTwo {...this.props} {...this.state} {...{ setIsSubmitting, userDetails }} onLoadedIngestionSubmission={this.handleLoadedIngestionSubmission}
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

    static flatFieldsFromUser(user){
        const {
            user_institution : institution = {},
            project = {},
        } = user || {};
        const initState = {
            "institutionID": institution['@id'] || null,
            "institutionTitle": institution.display_title || null,
            "projectID": project['@id'] || null,
            "projectTitle": project.display_title || null
        };
        return initState;
    }

    // TODO: Delete probably -- hard sequence from step 1 -> 2 -> 3... no more going back and updating
    static checkIfChanged(submissionItem, institutionID, projectID){
        const {
            institution: { '@id' : submissionInstitutionID = null } = {},
            project: { '@id' : submissionProjectID = null } = {},
            display_title: submissionTitle
        } = submissionItem;
        return (institutionID !== submissionInstitutionID) || (projectID !== submissionProjectID);
    }

    constructor(props){
        super(props);
        this.loadUser = this.loadUser.bind(this);
        this.handleSelectInstitution = this.handleSelectInstitution.bind(this);
        this.handleSelectProject = this.handleSelectProject.bind(this);
        this.handleCreate = this.handleCreate.bind(this);
        this.handleSelectSubmissionType = this.handleSelectSubmissionType.bind(this);

        this.state = {
            selectingField: null,
            submissionType: null,
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
    }

    componentDidMount(){
        setTimeout(this.loadUser, 0);
    }

    componentDidUpdate(pastProps){
        const { submissionItem = null, markCompleted, panelIdx, panelsComplete, user } = this.props;
        const { submissionItem: pastIngestionSubmissionItem = null, panelIdx: pastPanelIdx, user: pastUser } = pastProps;

        if (user !== pastUser){
            this.setState(PanelOne.flatFieldsFromUser(user));
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
                institutionID, institutionTitle,
                projectID, projectTitle
            });
            return;
        }

        if (submissionItem){
            const { institutionID, projectID } = this.state;
            const valuesDiffer = this.memoized.checkIfChanged(submissionItem, institutionID, projectID);
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
            institutionID: institution,
            projectID: project,
            isCreating = false
        } = this.state;

        e.preventDefault();
        e.stopPropagation();

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

        const postData = { institution, project, ingestion_type: "metadata_bundle", processing_status: { state: "created" } };

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
            institutionID, institutionTitle,
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

        const valuesChanged = !submissionItem || this.memoized.checkIfChanged(submissionItem, institutionID, projectID);
        const createDisabled = (!valuesChanged || isCreating || !institutionID || !projectID );

        return (
            <form className={"panel-form-container d-block" + (isCreating ? " is-creating" : "")} onSubmit={this.handleCreate}>
                <h4 className="text-300 mt-2">Required Fields = <span className="text-danger">*</span></h4>
                {/** Maybe replace with SAYTAJAX? */}
                <LinkToFieldSection onSelect={this.handleSelectInstitution} title="Institution" required
                    type="Institution" selectedID={institutionID} selectedTitle={institutionTitle} searchAsYouType/>
                <LinkToFieldSection onSelect={this.handleSelectProject} title="Project" required
                    type="Project" selectedID={projectID} selectedTitle={projectTitle} searchAsYouType />
                <div className="field-section linkto-section mt-2 d-block">
                    <label className="d-block mb-05">Submission Type</label>
                    <div className="row">
                        <div className="col-auto">
                            <DropdownButton
                                variant="primary text-600 text-capitalize"
                                title={submissionType || "Accessioning"}
                                id="submission-type"
                            >
                                <Dropdown.Item eventKey="Accessioning" onSelect={this.handleSelectSubmissionType}>Accessioning</Dropdown.Item>
                                <Dropdown.Item disabled class="unclickable" eventKey="Family History" onSelect={this.handleSelectSubmissionType}>Family History (coming soon)</Dropdown.Item>
                                <Dropdown.Item disabled class="unclickable" eventKey="Gene List" onSelect={this.handleSelectSubmissionType}>Gene List (coming soon)</Dropdown.Item>
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

// class AliasInputFieldContainer extends React.PureComponent {
//     constructor(props){
//         super(props);
//         this.onAliasChange = this.onAliasChange.bind(this);

//     }

//     onAliasChange(val){
//         const { index, onAliasChange } = this.props;
//         onAliasChange(val, index);
//     }

//     render(){
//         const { value, user, ...passProps } = this.props;
//         return (
//             <div className="mb-1">
//                 <AliasInputFieldValidated {...passProps}
//                     onAliasChange={this.onAliasChange}
//                     currentSubmittingUser={user}
//                     showErrorMsg value={value} />
//             </div>
//         );
//     }

// }


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
        const json = JSON.parse(response);
        const { filename, submission_uri } = json;
        console.log("json", json);

        let message = null;
        if (submission_uri) {
            message = (
                <React.Fragment>
                    <p className="mb-0">Keep this window open for updates on file processing status. Note: this may take a while.</p>
                    {/* <p className="mb-0 text-small">To check status of file processing manually, click <em><a href={submission_uri} target="_blank" rel="noreferrer">here</a></em>.</p> */}
                </React.Fragment>
            );
        }
        Alerts.queue({
            "title" : "Uploaded file (" + filename + ") successfully!",
            message ,
            "style" : "success"
        });

        // Wait a few seconds before setting new status
        setTimeout(this.setState({ statusIdx: 1 }), 200);
    }

    render(){
        const { user, submissionItem, panelIdx, href, onLoadedIngestionSubmission, setIsSubmitting } = this.props;
        const { statusIdx } = this.state;

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
                        Click <a href="https://hms-dbmi.atlassian.net/browse/C4-505" target="_blank" rel="noreferrer">here</a> for more on how to format your document.
                    </div>
                    <hr className="mb-1"/>
                    <div className="field-section mt-2">
                        <label className="d-block mb-05">
                            Submit Data
                            <i className="icon icon-info-circle fas icon-fw ml-05"
                                data-tip="Select & upload files generated in Proband and other pedigree software" />
                        </label>
                        <AttachmentInputController href={href} context={submissionItem} onAddedFile={this.onAddedFile}>
                            <FileAttachmentBtn/>
                        </AttachmentInputController>
                    </div>
                </React.Fragment>
            );
        } else if (statusIdx === 1) {
            panelContents = <Poller context={submissionItem} setStatusIdx={this.setStatusIdx} {...{ onLoadedIngestionSubmission, setIsSubmitting }}/>;
        } else {
            panelContents = <h4 className="text-300 mt-2">Successfully processed file. Ready to view results.</h4>;
        }

        return (
            <div className="panel-form-container">
                { panelContents }
            </div>
        );
    }

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

function Poller(props){
    const { context = null, setStatusIdx, onLoadedIngestionSubmission, setIsSubmitting } = props;
    const { uuid } = context || {};
    const getURL = "/ingestion-submissions/" + uuid;

    const timeStarted = new Date(Date.now());
    const [ lastUpdated, setLastUpdated ] = useState(timeStarted.toLocaleTimeString('en-US'));

    // console.log("context", context);
    useInterval(() => {
        console.log("Checking if processing status is updated.");
        ajax.promise(getURL, "GET")
            .then((response)=> {
                console.log("response", response);
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
                if (typeof error === "string") {
                    Alerts.queue({ "title": error, style: "danger" });
                } else {
                    console.error(error);
                    Alerts.queue({ "title": "An unknown error occurred. See console for more details.", style: "danger" });
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

function FileAttachmentBtn(props){
    const { loadingFileResult, postFileSuccess, onFileInputChange } = props;
    const icon = loadingFileResult ? "circle-notch fas icon-spin align-baseline" : "upload fas";
    return (
        <React.Fragment>
            <label htmlFor="test_file" disabled={loadingFileResult || postFileSuccess }
                className={"btn btn-primary " + (loadingFileResult || postFileSuccess ? " disabled unclickable" : " clickable")}>
                <input id="test_file" type="file" onChange={!loadingFileResult && onFileInputChange ? onFileInputChange: undefined} className="d-none"
                    disabled={loadingFileResult || postFileSuccess === true}
                    accept=".csv, .tsv, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, application/vnd.ms-excel" />
                <i className={"mr-08 icon icon-fw icon-" + icon} />
                <span>Select Excel File...</span>
            </label>
            { !loadingFileResult && postFileSuccess ? <span className="ml-1 text-success">Success! <i className="icon icon-check fas"></i></span> : null}
            { !loadingFileResult && postFileSuccess === false ? <span className="ml-1 text-danger">Failure! <i className="icon icon-times-circle fas"></i></span> : null}
        </React.Fragment>
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
    const { title, type, onSelect, selectedID, selectedTitle, variant = "primary", required, searchAsYouType } = props;

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
            <label className="d-block mb-05">{ title } {required ? <span className="text-danger">*</span>: null}</label>
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
