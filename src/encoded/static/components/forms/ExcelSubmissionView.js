'use strict';

import React from 'react';
import ReactTooltip from 'react-tooltip';
import { Modal, InputGroup, DropdownButton, Dropdown, FormControl, Button } from 'react-bootstrap';
import PropTypes from 'prop-types';

import { JWT, ajax } from '@hms-dbmi-bgm/shared-portal-components/es/components/util';

export default class ExcelSubmissionView extends React.Component {

    constructor(props) {
        super(props);
        this.state = {
            user: null,
            fileName: null,
            panelsComplete: [ false, false, false ],
            panelIdx: 0
        };
        this.loadUser = this.loadUser.bind(this);
        this.handleSelectPanel = this.handleSelectPanel.bind(this);
        this.markCompleted = this.markCompleted.bind(this);
        console.log("excelsubmissionview props", props);
    }

    componentDidMount() {
        console.log("excelsubmissionview did mount, loading user");
        this.loadUser();
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

    loadUser(){
        const userDetails = JWT.getUserDetails();
        console.log("excelsubmissionview userDetails", userDetails);
        // const { panelIdx, onLoadUser } = this.props;
        const { uuid } = userDetails;
        ajax.load("/users/" + uuid + "/", (res)=>{
            if (!(res && res['@id'])) {
                throw new Error("Couldn't fetch user info, make sure you're logged in.");
            }
            console.log("results", res);
            this.setState({ user: res });
        });
    }

    render() {
        const { panelIdx, panelsComplete, caseItem, submissionType, fileName } = this.state;

        return (
            <div className="case-submission-view">
                <div className="container">
                    <h5 className="info-area mb-1 text-400 mt-05">
                        <em className="ml-05">Submitting for </em>
                        <a href="#" target="_blank" rel="noopener noreferrer"
                            data-tip="Item is saved in database; further edits will modify it.">
                            [Institution]
                        </a>
                        <i className="icon icon-external-link-alt fas text-smaller ml-05"/>
                    </h5>
                    <PanelStepMenu {...{ panelIdx, panelsComplete }} onSelect={this.handleSelectPanel}/>
                    <PanelOne />
                </div>
            </div>
        );
    }
}

function PanelStepMenu(props){
    const { onSelect, panelIdx, panelsComplete } = props;
    const steps = [
        "Basic Information",
        "Upload Submission",
        "Finalize and View Submission"
    ];

    const renderedItems = steps.map(function(stepTitle, stepIdx){
        const stepNum = stepIdx + 1;
        const active = panelIdx === stepIdx; // Only step enabled at any time is current one
        const completed = panelsComplete[stepIdx];
        const cls = (
            "panel-menu-item" +
            (active ? " active" : "") +
            (!active ? " disabled" : "") +
            (completed ? " completed" : "")
        );
        return (
            <div data-for-panel={stepNum} onClick={active && onSelect} key={stepNum} className={cls}>
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

    constructor(props) {
        super(props);

        this.state = {
            project: null,
            submissionType: null, // Accessioning, Family History, or Gene List
        };

        this.onSelectSubmissionType = this.onSelectSubmissionType.bind(this);
    }

    onSelectSubmissionType(eventKey) {
        const { submissionType } = this.state;
        if (eventKey !== submissionType) {
            this.setState({ "submissionType" : eventKey });
        }
    }

    onSelectProjectType(eventKey) {
        // Do we want to use SAYT for this?
    }

    validateProject() {
        // Is a project selected?

        // Check that user has edit permissions for the selected project
    }

    render () {
        const { submissionType, fileName } = this.state;
        return (
            <form className="panel-form-container d-block" onSubmit={null}>
                <h4 className="text-300 mt-2">Required Fields</h4>

                <div className="field-section linkto-section mt-2 d-block">
                    <label className="d-block mb-05">Project</label>
                    <div className="row align-items-center">
                        <div className="col-auto">
                            <div className="linkto-dropdown dropdown">
                                <button aria-haspopup="true" aria-expanded="false" type="button" className="dropdown-toggle btn btn-primary">
                                    <span className="text-600">CGAP Core</span>
                                </button>
                            </div>
                        </div>
                        <div className="col">
                            <i className="icon icon-fw icon-link fas small mr-05"></i>
                            <span className="text-monospace small">/projects/hms-dbmi/</span> •
                            <a target="_blank" rel="noopener noreferrer" className="ml-05" data-tip="Open Institution in new window" currentitem="false">
                                <i className="icon icon-fw icon-external-link-alt fas small"></i>
                            </a>
                        </div>
                    </div>
                </div>

                <div className="field-section linkto-section mt-2 d-block">
                    <label className="d-block mb-05">File Details</label>
                    <InputGroup className="mb-3">
                        <DropdownButton
                            as={InputGroup.Prepend}
                            variant="primary text-600"
                            title={submissionType}
                            id="input-group-dropdown-1"
                        >
                            <Dropdown.Item eventKey="Accessioning" onSelect={this.onSelectSubmissionType}>Accessioning</Dropdown.Item>
                            <Dropdown.Item eventKey="Family History" onSelect={this.onSelectSubmissionType}>Family History</Dropdown.Item>
                            <Dropdown.Item eventKey="Gene List" onSelect={this.onSelectSubmissionType}>Gene List</Dropdown.Item>
                        </DropdownButton>
                        <FormControl aria-describedby="basic-addon1" value={ fileName || "Upload from your computer..." }/>
                        <InputGroup.Append>
                            <Button variant="primary">Browse Files</Button>
                        </InputGroup.Append>
                    </InputGroup>
                </div>
                <hr className="mb-1"/>
                <div className="buttons-container text-right">
                    <button type="submit" className="btn btn-success" onClick={null}>
                        Submit File
                    </button>
                </div>
            </form>
        );
    }
}