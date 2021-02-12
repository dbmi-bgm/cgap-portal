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
            loading: false,
            success: null,

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

                var xhr = new XMLHttpRequest();
                xhr.open("POST", postURL, true);

                xhr.onreadystatechange = function() { // Call a function when the state changes.
                    if (xhr.readyState !== 4) return;
                    if (xhr.readyState === xhr.DONE && xhr.status === 200) {
                        // Request finished. Do processing here.
                        console.log("response:", xhr.response);
                        onAddedFile(xhr.response);
                        this.setState({ loading: false, success: true });
                    } else {
                        this.setState({ loading: false, success: false }, function(){
                            Alerts.queue(AttachmentInputController.ErrorObject);
                        });
                        console.error("Submission Ingestion Error: ", this.response);
                    }
                }.bind(this);

                xhr.send(formData);
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
