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
        this.state = {
            loading: false,
            success: null
        };
    }

    handleChange(e){
        const { 0: file = null } = e.target.files || {};

        if (file) {
            file.filename = file.name;

            const formData = new FormData();
            formData.append("datafile", file);

            this.setState({ loading: true }, ()=>{
                const { context: { uuid }, onAddedFile } = this.props;

                const postURL = '/ingestion-submissions/' + uuid + '/submit_for_ingestion';
                console.log(`Attempting Ingestion. \n\nPosting to: ${postURL}`);

                const onErrorCallback = (response) => {
                    console.error("Submission Ingestion Error: ", response);
                    this.setState({ loading: false, success: false }, function(){
                        Alerts.queue(AttachmentInputController.ErrorObject);
                    });
                };

                const onSuccessCallback = (response) => {
                    console.log("response:", response);
                    this.setState({ loading: false, success: true }, function() {
                        onAddedFile(response);
                    });
                };

                ajax.postMultipartFormdata(postURL, formData, onErrorCallback, onSuccessCallback);
            });

        }
    }

    onFormSubmit() {
        e.preventDefault();
    }

    render(){
        const { children, ...passProps } = this.props;
        const { loading: loadingFileResult, success: postFileSuccess } = this.state;
        return (
            React.Children.map(children, (c) => React.cloneElement(c, { ...passProps, loadingFileResult, postFileSuccess, onFileInputChange: this.handleChange }))
        );
    }
}
