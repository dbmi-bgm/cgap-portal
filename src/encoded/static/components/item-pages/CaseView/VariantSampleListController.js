'use strict';

import React, { useMemo } from 'react';
import queryString from 'query-string';
import moment from 'moment';

import { console, ajax } from '@hms-dbmi-bgm/shared-portal-components/es/components/util';

/** Holds datastore=database representation of VariantSampleList Item */
export class VariantSampleListController extends React.PureComponent {

    static getDerivedStateFromProps(props, state) {
        if (props.id) {
            return { "variantSampleListID": props.id };
        }
        return null;
    }

    constructor(props){
        super(props);
        this.fetchVariantSampleListItem = this.fetchVariantSampleListItem.bind(this);
        this.updateVariantSampleListID = this.updateVariantSampleListID.bind(this);
        const { id: vslID } = props;
        this.state = {
            "variantSampleListItem": null,
            "variantSampleListID": typeof vslID === "string" ? vslID : null
        };
    }

    componentDidMount(){
        const { variantSampleListID } = this.state;
        if (variantSampleListID) {
            this.fetchVariantSampleListItem();
        }
    }

    componentDidUpdate(prevProps, prevState){
        const { variantSampleListID } = this.state;
        const { variantSampleListID: pastVSLID } = prevState;
        if (variantSampleListID !== pastVSLID) {
            if (!variantSampleListID) {
                this.setState({ "variantSampleListItem" : null });
            } else {
                this.fetchVariantSampleListItem();
            }
        }
    }

    fetchVariantSampleListItem(){
        const { variantSampleListID } = this.state;

        console.info("Fetching VariantSampleList ...");
        const callback = (resp) => {
            console.info("Fetched VariantSampleList", resp);
            const { "@id": vslID, error = null } = resp;
            if (!vslID) {
                throw new Error("Couldn't get VSL");
            }
            this.setState({ "variantSampleListItem": resp });
        };

        ajax.load(
            variantSampleListID + "?datastore=database",
            callback,
            "GET",
            callback
        );
    }

    updateVariantSampleListID(vslID){
        // componentDidUpdate will handle triggering fetch of Item.
        this.setState({ "variantSampleListID": vslID });
    }

    render(){
        const { children, id: propVSLID, ...passProps } = this.props;
        const { variantSampleListItem } = this.state;
        const childProps = {
            ...passProps,
            variantSampleListItem,
            "updateVariantSampleListID": this.updateVariantSampleListID
        };
        return React.Children.map(children, function(child){
            if (!React.isValidElement(child) || typeof child.type === "string") {
                return child;
            }
            return React.cloneElement(child, childProps);
        });
    }

}