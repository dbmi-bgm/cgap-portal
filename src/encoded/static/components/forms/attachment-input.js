'use strict';

import React from 'react';
import url from 'url';
import { console, layout, ajax, object, memoizedUrlParse } from '@hms-dbmi-bgm/shared-portal-components/es/components/util';
import { Alerts } from '@hms-dbmi-bgm/shared-portal-components/es/components/ui/Alerts';


/** Used for uploading Excel data. Draft & subject to change. */
export class AttachmentInputController extends React.PureComponent {

    static ErrorObject = {
        "title" : "Error parsing file",
        "message" : "Check your file and try again.",
        "style" : "danger"
    };

    constructor(props){
        super(props);
        this.handleChange = this.handleChange.bind(this);
        // this.onFormSubmit = this.onFormSubmit.bind(this);
        this.state = {
            loading: false
        };
    }

    handleChange(e){
        const file = e.target.files[0];
        file.filename = file.name;

        const formData = new FormData();
        formData._boundary = "---------ArbitraryBoundary38839293dfsdfiso";
        console.log("file.get('_boundary')", formData.get("_boundary"));
        formData.append("datafile", file);
        console.log("file.get('datafile')", formData.get('datafile'));

        console.log("context", this.props.context);
        this.setState({ loading: true }, ()=>{

            // const attachment_props = {};
            // const { datafile = {} } = attachment_props;
            const { context: { uuid }, href } = this.props;

            // datafile.type = file.type;
            // datafile.filename = file.name;
            // if (file.size) {
            //     datafile.size = file.size;
            // }
            // const fileReader = new window.FileReader();
            // fileReader.readAsText(file);
            // fileReader.onloadend = (e) => {
            //     console.log("e.target.result", e.target.result);
            //     if (e.target.result) {
            //          attachment_props.href = e.target.result;
            const postURL = '/ingestion-submissions/' + uuid + '/submit_for_ingestion';
            console.log(`Attempting Ingestion. \n\nPatching to: ${postURL}`);
            ajax.promise(
                postURL,
                'POST',
                { "Content-Type" : `multipart/form-data; boundary-${formData._boundary}` },
                formData,
                false,
                true
                // JSON.stringify(attachment_props)
            ).then((data) => {
                // TODO test if anything else wrong with response and throw if so.
                if (!data || data.status === "error"){
                    throw data;
                }
                console.log(" got dataaaa", data);
                return data;
            }).then((data)=>{
                this.setState({ loading: false });
                console.log("got some data", data);
                return data;
            }).catch((data)=>{
                this.setState({ loading: false }, function(){
                    Alerts.queue(AttachmentInputController.ErrorObject);
                });
                console.error("Submission Ingestion Error: ", data);
            });
            //      } else {
            //          console.error("Submission Ingestion Error: Loading file contents into FileReader failed.");
            //          this.setState({ loading: false }, function(){
            //              Alerts.queue(AttachmentInputController.ErrorObject);
            //          });
            //          return;
            //      }
            // };
        });
    }

    // onFormSubmit() {
    //     e.preventDefault();
    // }

    render(){
        const { children, ...passProps } = this.props;
        const { loading: loadingPostSubmissionResult } = this.state;
        return (
            React.Children.map(children, (c) => React.cloneElement(c, { ...passProps, loadingPostSubmissionResult, onFileInputChange: this.handleChange }))
        );
    }
}
