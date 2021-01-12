'use strict';

import React from 'react';
import ReactTooltip from 'react-tooltip';
import { Modal, InputGroup, DropdownButton, Dropdown, FormControl, Button } from 'react-bootstrap';
import PropTypes from 'prop-types';

import { DragAndDropFileUploadController } from '@hms-dbmi-bgm/shared-portal-components/es/components/forms/components/DragAndDropUpload';

class ServerSentEventListener extends React.Component {
    constructor(props){
        super(props);
        this.onEvent = this.onEvent.bind(this);
        this.state = { "serverSentEvents" : [] };
        this.evtSource = null;
    }
    componentDidMount(){
        const { eventUrl } = this.props;
        if (!eventUrl) {
            console.warn("No event URL supplied");
            return;
        }
        this.evtSource = new EventSource(eventUrl);
        this.evtSource.onmessage = this.onEvent;
    }
    componentWillUmmount(){
        // TODO: Close connection on this.evtSource somehow?
        this.evtSource = null;
    }
    componentDidUpdate(pastProps){
        const { eventUrl: pastUrl } = pastProps;
        const { eventUrl } = this.props;
        if (eventUrl !== pastUrl){
            if (this.evtSource || pastUrl) {
                // TODO: Close connection on existing this.evtSource somehow?
            }
            this.evtSource = new EventSource(eventUrl);
            this.evtSource.onmessage = this.onEvent;
        }
    }
    onEvent(event){
        this.setState(function({ serverSentEvents: prevEvents }){
            const serverSentEvents = prevEvents.slice();
            serverSentEvents.push(event);
            // Only keep latest ~100 events re: memory considerations (?)
            if (serverSentEvents.length > 100) {
                serverSentEvents.shift();
            }
            return { serverSentEvents };
        });
    }
    render(){
        const { children, eventUrl, ...remainingProps } = this.props;
        const { serverSentEvents } = this.state;
        return React.Children.map(children, function(child){
            if (!React.isValidElement(child) || typeof child.type === "string"){
                return child;
            }
            return React.cloneElement(child, { ...remainingProps, serverSentEvents });
        });
    }
}
ServerSentEventListener.propTypes = {
    eventUrl : PropTypes.string.isRequired
};

export default class ExcelSubmissionView extends React.Component {

    constructor(props) {
        super(props);
        this.state = {
            submissionType: "Accessioning", // Accessioning, Family History, or Gene List
            fileName: null
        };
        this.onSelectSubmissionType = this.onSelectSubmissionType.bind(this);
    }
    // componentDidUpdate(pastProps){
    //     const { serverSentEvents, onCompleted } = this.props;
    //     if (serverSentEvents !== pastProps.serverSentEvents) {
    //         const sseLen = serverSentEvents.length;
    //         const lastEvent = serverSentEvents[sseLen - 1];
    //         const eventData = JSON.parse(lastEvent.data);
    //         const { messageType, status, newItem } = eventData; // example fields
    //         if (messageType === "submission processing" && status === "completed") {
    //             // Do stuff, close Modal, etc. idk.
    //             Alerts.queue({ title: 'Finished upload', message: <span><a href={newItem['@id']}>View newly created { newItem.display_title }</a></span> });
    //             if (typeof onCompleted === "function"){
    //                 onCompleted(eventData); // Idk what param ideally should be here.
    //             }
    //         }
    //     }
    // }

    onSelectSubmissionType(eventKey) {
        if (eventKey !== this.state.submissionType) {
            this.setState({ submissionType: eventKey });
        }
    }

    render() {
        const { submissionType, fileName } = this.state;
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
                    <hr />
                    <p>
                        Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.
                    </p>
                    <form className="panel-form-container d-block is-creating" onSubmit={null}>
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
                </div>
            </div>
        );
    }
}

function ExcelSubmissionButton () { // On 2nd thought, might be better as class instd of func so can _.throttle(this.setIsSubmissionModalOpen, 500) (unsure if needed)
    const [ isSubmissionModalOpen, setIsSubmissionModalOpen ] = useState(false);
    const [ eventUrl, setEventUrl ] = useState(null);
    // Alternatively could render out something else using ReactDOM.createPortal & props.overlaysContainer or something.
    return (
        <React.Fragment>
            <button onClick={function(){ setIsSubmissionModalOpen(!isSubmissionModalOpen); }}>Upload</button>
            { isSubmissionModalOpen ?
                <Modal.Body>
                    <ServerSentEventListener eventUrl={eventUrl}>
                        <ExcelSubmissionView
                            onStart={function(submissionHTTPPostResponse){ setEventUrl(`/submission_upload_status/${submissionHTTPPostResponse.upload_identifier}/`); }}
                            onCompleted={function(finishEventData){ setIsSubmissionModalOpen(false); }}
                        />
                    </ServerSentEventListener>
                </Modal.Body>
                : null }
        </React.Fragment>
    );
}