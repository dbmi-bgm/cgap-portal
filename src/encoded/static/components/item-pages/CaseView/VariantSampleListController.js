'use strict';

import React, { useMemo } from 'react';
import queryString from 'query-string';
import moment from 'moment';
import memoize from "memoize-one";

import { console, ajax } from '@hms-dbmi-bgm/shared-portal-components/es/components/util';

/**
 * Holds embedded representation of VariantSampleList Item
 * Gets refreshed after saving/moving VariantSamples to InterpretationTab
 * and upon mount.
 */
export class VariantSampleListController extends React.PureComponent {

    /**
     * Returns all variant_samples' `@ids` as JS object keys for filtering.
     * @todo Once flags of some kinds are available, filter out "deleted" VS samples.
     */
    static activeVariantSampleIDMap(variant_samples){
        const retDict = {};
        variant_samples.forEach(function(vsSelection){
            const { variant_sample_item: { "@id": vsAtID = null } } = vsSelection;
            if (!vsAtID) {
                return; // perhaps no view permission
            }
            retDict[vsAtID] = true;
        });
        return retDict;
    }

    static getDerivedStateFromProps(props, state) {
        const { id: vslID } = props;
        if (vslID) {
            // If supplied via props, always set to props.id and prevent
            // from ever changing.
            // Else rely on `updateVariantSampleListID` to set it (when it comes in as not present from Case initially).
            return { "variantSampleListID": vslID };
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
            "variantSampleListID": typeof vslID === "string" ? vslID : null,
            "isLoadingVariantSampleListItem": typeof vslID === "string" ? true : false,
            // `refreshCount` not necessary at all, just for potential internal debugging.
            "refreshCount": 0
        };

        this.memoized = {
            activeVariantSampleIDMap: memoize(VariantSampleListController.activeVariantSampleIDMap)
        };

        this.currentRequest = null;
    }

    componentDidMount(){
        const { variantSampleListID } = this.state;
        if (variantSampleListID) {
            this.fetchVariantSampleListItem();
        }
    }

    /** Fetches `@@embedded` representation of 'state.variantSampleListID' from embed api */
    fetchVariantSampleListItem(fnCallback = null){
        const { variantSampleListID } = this.state;

        if (this.currentRequest) {
            // Abort is additional signal for browser to cancel request,
            // not to be relied on in JS logic
            // (instead safest to make sure scopedRequest === this.currentRequest)
            this.currentRequest.abort();
        }

        let scopedRequest = null;

        console.info("Fetching VariantSampleList ...");
        const vslFetchCallback = (resp) => {
            console.info("Fetched VariantSampleList", resp);
            const { 0: { "@id": vslID, error = null } = {} } = resp;

            if (scopedRequest !== this.currentRequest) {
                // Request superseded, cancel it.
                return false;
            }

            if (!vslID) {
                throw new Error("Couldn't get VSL");
            }


            this.currentRequest = null;

            this.setState(function({ refreshCount: prevRefreshCount, variantSampleListItem: prevItem }){
                const { "@id": prevAtID = null } = prevItem || {};
                const nextState = {
                    "variantSampleListItem": resp[0],
                    "isLoadingVariantSampleListItem": false
                };
                if (prevAtID && vslID !== prevAtID) {
                    nextState.refreshCount = prevRefreshCount + 1;
                }
                return nextState;
            }, fnCallback);

        };

        // Using embed API instead of datastore=database in order to prevent gene-list related slowdown
        this.setState({ "isLoadingVariantSampleListItem": true }, () => {
            scopedRequest = this.currentRequest = ajax.load(
                '/embed',
                vslFetchCallback,
                "POST",
                vslFetchCallback,
                JSON.stringify({ ids: [variantSampleListID] })
            );
        });
    }

    /** Does NOT trigger a refresh, refresh must be triggered manually afterwards */
    updateVariantSampleListID(vslID, callback){
        this.setState({ "variantSampleListID": vslID }, callback);
    }

    render(){
        const { children, id: propVSLID, ...passProps } = this.props;
        const { variantSampleListItem, isLoadingVariantSampleListItem } = this.state;
        const { variant_samples = [] } = variantSampleListItem || {};
        const childProps = {
            ...passProps,
            variantSampleListItem,
            isLoadingVariantSampleListItem,
            "savedVariantSampleIDMap": this.memoized.activeVariantSampleIDMap(variant_samples),
            "updateVariantSampleListID": this.updateVariantSampleListID,
            "fetchVariantSampleListItem": this.fetchVariantSampleListItem
        };
        return React.Children.map(children, function(child){
            if (!React.isValidElement(child) || typeof child.type === "string") {
                return child;
            }
            return React.cloneElement(child, childProps);
        });
    }

}