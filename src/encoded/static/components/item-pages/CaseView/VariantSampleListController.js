'use strict';

import React, { useMemo } from 'react';
import queryString from 'query-string';
import moment from 'moment';
import memoize from "memoize-one";

import { console, ajax } from '@hms-dbmi-bgm/shared-portal-components/es/components/util';

/**
 * Holds datastore=database representation of VariantSampleList Item
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

    /** Fetches datastore=database representation of 'state.variantSampleListID'*/
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
            const [ variantSampleListItem ] = resp;
            const { "@id": vslID, error = null } = variantSampleListItem;

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
                    variantSampleListItem,
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
                "/embed",
                vslFetchCallback,
                "POST",
                vslFetchCallback,
                JSON.stringify({
                    "ids": [ variantSampleListID ],
                    "fields": [

                        // Fields for list view (for InterpretationTab & CaseReviewTab)

                        "@id",
                        "variant_samples.date_selected",
                        // For future:
                        // "variant_samples.filter_blocks_request_at_time_of_selection",
                        // "variant_samples.selected_by.@id",
                        // "variant_samples.selected_by.display_title",
                        "variant_samples.variant_sample_item.@id",
                        "variant_samples.variant_sample_item.display_title",
                        "variant_samples.variant_sample_item.variant.@id",
                        "variant_samples.variant_sample_item.variant.display_title",
                        "variant_samples.variant_sample_item.variant.genes.genes_most_severe_gene.@id",
                        "variant_samples.variant_sample_item.variant.genes.genes_most_severe_gene.display_title",
                        "variant_samples.variant_sample_item.variant.genes.genes_most_severe_transcript",
                        "variant_samples.variant_sample_item.variant.genes.genes_most_severe_hgvsc",
                        "variant_samples.variant_sample_item.variant.genes.genes_most_severe_hgvsp",
                        "variant_samples.variant_sample_item.associated_genotype_labels.proband_genotype_label",
                        "variant_samples.variant_sample_item.associated_genotype_labels.mother_genotype_label",
                        "variant_samples.variant_sample_item.associated_genotype_labels.father_genotype_label",

                        // VariantSampleItem Notes (for CaseReviewTab)
                        ...variantSampleListItemNoteEmbeds
                    ]
                })
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

/**
 * List of Note item fields to embed from VariantSampleList Items.
 * To be used as a part of `fields` /embed payload(s).
 */
export const variantSampleListItemNoteEmbeds = [
    "variant_samples.variant_sample_item.interpretation.@id",
    "variant_samples.variant_sample_item.interpretation.uuid",
    "variant_samples.variant_sample_item.interpretation.note_text",
    "variant_samples.variant_sample_item.interpretation.status",
    "variant_samples.variant_sample_item.interpretation.classification",

    "variant_samples.variant_sample_item.discovery_interpretation.@id",
    "variant_samples.variant_sample_item.discovery_interpretation.uuid",
    "variant_samples.variant_sample_item.discovery_interpretation.note_text",
    "variant_samples.variant_sample_item.discovery_interpretation.status",
    "variant_samples.variant_sample_item.discovery_interpretation.gene_candidacy",
    "variant_samples.variant_sample_item.discovery_interpretation.variant_candidacy",

    "variant_samples.variant_sample_item.variant_notes.@id",
    "variant_samples.variant_sample_item.variant_notes.uuid",
    "variant_samples.variant_sample_item.variant_notes.note_text",
    "variant_samples.variant_sample_item.variant_notes.status",

    "variant_samples.variant_sample_item.gene_notes.@id",
    "variant_samples.variant_sample_item.gene_notes.uuid",
    "variant_samples.variant_sample_item.gene_notes.note_text",
    "variant_samples.variant_sample_item.gene_notes.status",
];
