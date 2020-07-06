'use strict';

import React from 'react';
import url from 'url';
import { console, layout, ajax, object, memoizedUrlParse } from '@hms-dbmi-bgm/shared-portal-components/es/components/util';
import { Alerts } from '@hms-dbmi-bgm/shared-portal-components/es/components/ui/Alerts';


/** Used for uploading Pedigree data. Draft & subject to change. */
export class AttachmentInputController extends React.PureComponent {

    static ErrorObject = {
        "title" : "Error parsing pedigree file",
        "message" : "Check your file and try again.",
        "style" : "danger"
    };

    constructor(props){
        super(props);
        this.handleChange = this.handleChange.bind(this);
        this.state = {
            loading: false
        };
    }

    handleChange(e){
        const file = e.target.files[0];
        this.setState({ loading: true }, ()=>{
            const attachment_props = {};
            const { context: { uuid: case_uuid }, href, onAddedFamily } = this.props;
            const { host } = memoizedUrlParse(href);
            let config_uri;
            if (host.indexOf('localhost') > -1){
                config_uri = 'development.ini';
            } else {
                config_uri = 'production.ini';
            }
            attachment_props.type = file.type;
            attachment_props.download = file.name;
            if (file.size) {
                attachment_props.size = file.size;
            }
            const fileReader = new window.FileReader();
            fileReader.readAsText(file);
            fileReader.onloadend = (e) => {
                if (e.target.result) {
                    attachment_props.href = e.target.result;
                    ajax.promise(
                        '/' + case_uuid + '/process-pedigree?config_uri=' + config_uri,
                        'PATCH',
                        {},
                        JSON.stringify(attachment_props)
                    ).then((data) => {
                        // TODO test if anything else wrong with response and throw if so.
                        if (!data || data.status === "error"){
                            throw data;
                        }
                        return data;
                    }).then((data)=>{
                        onAddedFamily(data);
                        this.setState({ loading: false });
                        return data;
                    }).catch((data)=>{
                        this.setState({ loading: false }, function(){
                            Alerts.queue(AttachmentInputController.ErrorObject);
                        });
                        console.error(data);
                    });
                } else {
                    this.setState({ loading: false }, function(){
                        Alerts.queue(AttachmentInputController.ErrorObject);
                    });
                    return;
                }
            };
        });
    }

    render(){
        const { children, ...passProps } = this.props;
        const { loading: loadingPedigreeResult } = this.state;
        return React.Children.map(children, (c) =>
            React.cloneElement(c, { ...passProps, loadingPedigreeResult, onFileInputChange: this.handleChange })
        );
    }
}

export const AttachmentInputMenuOption = React.memo(function AttachmentInputMenuOption(props){
    const { loadingPedigreeResult, onFileInputChange } = props;
    const icon = loadingPedigreeResult ? "circle-notch fas icon-spin" : "upload fas";
    return (
        <label className={"menu-option text-400" + (loadingPedigreeResult ? ' disabled' : ' clickable')}>
            <input id="test_pedigree" type="file" onChange={onFileInputChange} className="d-none" accept="*/*" />
            <div className="row">
                <div className="col-auto icon-container">
                    <i className={"icon icon-fw icon-" + icon}/>
                </div>
                <div className="col title-col">
                    <h5>Add Family</h5>
                    <span className="description">Upload a new pedigree file.</span>
                </div>
            </div>
        </label>
    );
});
