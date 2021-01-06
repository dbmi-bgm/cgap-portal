'use strict';

import React from 'react';
import ReactTooltip from 'react-tooltip';
import Modal from 'react-bootstrap';
import PropTypes from 'prop-types';

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

export class ExcelSubmissionView extends React.Component {
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

    render() {
        return (
            <div>
                Test
                {/* <ExcelSubmissionButton></ExcelSubmissionButton> */}
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