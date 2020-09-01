
'use strict';

import React from 'react';
import { console, layout, ajax, object } from '@hms-dbmi-bgm/shared-portal-components/es/components/util';
import { Alerts } from '@hms-dbmi-bgm/shared-portal-components/es/components/ui/Alerts';
import { isServerSide } from '@hms-dbmi-bgm/shared-portal-components/es/components/util/misc';

export class PedigreeFullScreenBtn extends React.PureComponent {

    static getReqFullscreenFxn(){
        if (isServerSide()) { return null; }
        const pedigreeContainerElem = document.getElementById("pedigree-viz-container-cgap");
        if (!pedigreeContainerElem){
            throw new Error("Container element not found");
        }
        return (
            pedigreeContainerElem.requestFullscreen ||
            pedigreeContainerElem.msRequestFullscreen ||
            pedigreeContainerElem.mozRequestFullScreen ||
            pedigreeContainerElem.webkitRequestFullscreen ||
            null
        );
    }

    constructor(props){
        super(props);
        this.onClick = this.onClick.bind(this);
        this.state = {
            visible: false
        };
    }

    componentDidMount(){
        const fxn = PedigreeFullScreenBtn.getReqFullscreenFxn();
        if (typeof fxn === 'function') {
            this.setState({ visible: true });
        }
    }

    onClick(evt){
        if (isServerSide()) { return false; }
        const pedigreeContainerElem = document.getElementById("pedigree-viz-container-cgap");
        if (pedigreeContainerElem.requestFullscreen){
            pedigreeContainerElem.requestFullscreen();
        } else if (pedigreeContainerElem.msRequestFullscreen){
            pedigreeContainerElem.msRequestFullscreen();
        } else if (pedigreeContainerElem.mozRequestFullScreen){
            pedigreeContainerElem.mozRequestFullScreen();
        } else if (pedigreeContainerElem.webkitRequestFullscreen){
            pedigreeContainerElem.webkitRequestFullscreen();
        } else {
            console.error("Couldn't go full screen");
            Alerts.queue({
                'title' : "Couldn't go full screen",
                'style' : "danger"
            });
            this.setState({ visible: false });
        }
    }

    render(){
        const { visible } = this.state;
        if (!visible) return null;
        return (
            <button type="button" className="btn btn-outline-dark ml-05 d-none d-md-inline-block"
                onClick={this.onClick} data-tip="Maximize pedigree to take up full screen">
                <i className="icon icon-expand fas fw"/>
                <span className="d-md-inline d-lg-none ml-08">Full Screen</span>
            </button>
        );
    }
}