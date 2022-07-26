'use strict';

import React from 'react';
import ReactTooltip from 'react-tooltip';
import Modal from 'react-bootstrap/esm/Modal';
import { ajax, console } from '@hms-dbmi-bgm/shared-portal-components/es/components/util';
import { Alerts } from '@hms-dbmi-bgm/shared-portal-components/es/components/ui/Alerts';


export class PatchItemsProgress extends React.PureComponent {

    constructor(props){
        super(props);
        this.patchItemsProcess = this.patchItemsProcess.bind(this);
        this.patchItems = this.patchItems.bind(this);
        this.onReset = this.onReset.bind(this);

        this.state = {
            "isPatching": false,
            "patchingPercentageComplete": 0,
            "patchErrors": []
        };

    }

    patchItemsProcess(patchPayloads, onComplete, opts) {
        const { parallelize = true } = opts || {};
        const patchQ = [ ...patchPayloads ];

        const patchesToComplete = patchQ.length;
        let countCompleted = 0;

        const checkIfCompleted = () => {
            // Check if all requests have completed, and call `onComplete` if so.
            if (patchesToComplete === countCompleted) {
                onComplete({ countCompleted, patchErrors });
            } else {
                const patchingPercentageComplete = patchesToComplete === 0 ? 0 : countCompleted / patchesToComplete;
                this.setState({ patchingPercentageComplete });
            }
        };

        const patchErrors = [];

        function performRequest([ patchURL, itemPatchPayload ]) {
            return ajax.promise(patchURL, "PATCH", {}, JSON.stringify(itemPatchPayload))
                .then(function(response){
                    const { status } = response;
                    if (status !== "success") {
                        throw response;
                    }
                }).catch(function(error){
                    // TODO display this in UI later perhaps.
                    patchErrors.push(error);
                    console.error("PatchItemsProgress AJAX error", error);
                }).finally(function(){
                    countCompleted++;
                    checkIfCompleted();
                    if (patchQ.length > 0) {
                        if (!parallelize && patchErrors.length > 0) {
                            // If not parellelized, stop on first error.
                            onComplete({ countCompleted, patchErrors });
                        } else {
                            // Kick off another request
                            performRequest(patchQ.shift());
                        }
                    }
                });
        }

        // Niche case - if nothing to PATCH
        checkIfCompleted();

        // Browser can't send more than 6 reqs anyway, so limit concurrent reqs to 5.
        // As each requests ends it'll start another as long as there's more things to PATCH.
        const countConcurrent = Math.min(parallelize ? 5 : 1, patchesToComplete);
        for (var i = 0; i < countConcurrent; i++) {
            performRequest(patchQ.shift());
        }
    }

    patchItems(patchPayloads, callback = null, opts = {}){

        this.setState({ "isPatching": true, "patchingPercentageComplete": 0 }, () => {
            setTimeout(ReactTooltip.hide, 50); // Hide still-present tooltips, if any (i.e. button that was clicked)
            console.log("Generated PATCH '../@@update-project-notes/' payloads - ", patchPayloads);
            this.patchItemsProcess(patchPayloads, ({ countCompleted, patchErrors }) => {
                console.info("Patching Completed, count Items PATCHed -", countCompleted);
                this.setState({
                    "isPatching": true,
                    "patchingPercentageComplete": 1,
                    patchErrors
                }, () => {
                    if (typeof callback === "function") {
                        callback(countCompleted, patchErrors);
                    }
                });
            }, opts);

        });
    }

    onReset(){
        const { patchingPercentageComplete } = this.state;
        if (patchingPercentageComplete !== 1) {
            // Not allowed until PATCHes completed (or timed out / failed / etc).
            return false;
        }
        this.setState({
            "isPatching": false,
            "patchingPercentageComplete": 0,
            "patchErrors": []
        });
    }

    render(){
        const { children, modalOnCompleteJSX, ...passProps } = this.props;
        const { isPatching, patchingPercentageComplete, patchErrors } = this.state;

        const childProps = {
            ...passProps,
            isPatching,
            "patchItems": this.patchItems
        };

        const adjustedChildren = React.Children.map(children, (child)=>{
            if (!React.isValidElement(child)) {
                // String or something
                return child;
            }
            if (typeof child.type === "string") {
                // Normal element (a, div, etc)
                return child;
            } // Else is React component
            return React.cloneElement(child, childProps);
        });

        return (
            <React.Fragment>
                { adjustedChildren }
                { isPatching ?
                    <ProgressModal {...{ isPatching, patchingPercentageComplete, patchErrors, modalOnCompleteJSX }} onHide={this.onReset} />
                    : null }
            </React.Fragment>
        );
    }

}


/**
 * Can be re-used for PATCHing multiple items.
 * @todo Move to SPC or utils directory along with PatchItemsProgress
 */
export const ProgressModal = React.memo(function ProgressModal (props) {
    const { isPatching, patchingPercentageComplete, onHide, patchErrors, modalOnCompleteJSX } = props;

    const percentCompleteFormatted = Math.round(patchingPercentageComplete * 1000) / 10;
    const finished = patchingPercentageComplete === 1;
    const errorsLen = patchErrors.length;

    let body;
    if (errorsLen > 0){
        body = (
            <h5 className="my-0 text-danger">{ errorsLen } errors</h5>
        );
    } else if (finished) {
        body = "Done";
    } else if (isPatching) {
        body = "Updating...";
    }

    return (
        <Modal show onHide={onHide}>
            <Modal.Header closeButton={finished}>
                <Modal.Title>{ finished ? "Update Complete" : "Please wait..." }</Modal.Title>
            </Modal.Header>
            <Modal.Body>
                <p className="text-center mb-1">{ body }</p>
                <div className="progress">
                    <div className="progress-bar" role="progressbar" style={{ "width": percentCompleteFormatted + "%" }}
                        aria-valuenow={percentCompleteFormatted} aria-valuemin="0" aria-valuemax="100"/>
                </div>
                { finished ? modalOnCompleteJSX : null }
                { finished ?
                    <button type="button" className="mt-24 btn btn-block btn-primary" onClick={onHide}>
                        Close
                    </button>
                    : null }
            </Modal.Body>
        </Modal>
    );
});
