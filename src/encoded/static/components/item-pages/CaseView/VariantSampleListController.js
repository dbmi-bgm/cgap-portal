'use strict';

import React, { useMemo } from 'react';
import queryString from 'query-string';
import moment from 'moment';
import ReactTooltip from 'react-tooltip';
import memoize from "memoize-one";

import { console, ajax, memoizedUrlParse, WindowEventDelegator } from '@hms-dbmi-bgm/shared-portal-components/es/components/util';

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
    static activeVariantSampleIDMap(variant_samples, structural_variant_samples){
        const retDict = {};
        function addToRetDict(vsSelection){
            const { variant_sample_item: { "@id": vsAtID = null } } = vsSelection;
            if (!vsAtID) {
                return; // perhaps no view permission
            }
            retDict[vsAtID] = true;
        }
        variant_samples.forEach(addToRetDict);
        structural_variant_samples.forEach(addToRetDict);
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
        this.windowMessageEventListener = this.windowMessageEventListener.bind(this);
        const { id: vslID } = props;
        this.state = {
            "fetchedVariantSampleListItem": null,
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
        // Add window message event listener
        WindowEventDelegator.addHandler("message", this.windowMessageEventListener);
    }

    componentWillUnmount(){
        // Remove window message event listener
        WindowEventDelegator.removeHandler("message", this.windowMessageEventListener);
    }

    windowMessageEventListener(event){
        const { href } = this.props;
        const { origin, data: { action } = {} } = event || {};

        const { protocol, host } = memoizedUrlParse(href) || {};
        const hrefOrigin = protocol + '//' + host;
        if (origin !== hrefOrigin) {
            return false;
        }

        // TODO check if origin matches our href domain/origin.
        if (action === "refresh-variant-sample-list") {
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

            this.setState(function({ refreshCount: prevRefreshCount, fetchedVariantSampleListItem: prevItem }){
                const { "@id": prevAtID = null } = prevItem || {};
                const nextState = {
                    "fetchedVariantSampleListItem": variantSampleListItem,
                    "isLoadingVariantSampleListItem": false
                };
                if (prevAtID && vslID !== prevAtID) {
                    nextState.refreshCount = prevRefreshCount + 1;
                }
                return nextState;
            }, function(){
                setTimeout(ReactTooltip.rebuild, 50);
                if (typeof fnCallback === "function") {
                    fnCallback();
                }
            });

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
                        // All immediate fields off of "variant_samples" must be embedded, else they will be lost in subsequent PATCH requests.
                        // This includes "filter_blocks_used", "date_selected", "variant_sample_item.@id", & "selected_by.@id"
                        "variant_samples.filter_blocks_used",
                        "variant_samples.date_selected",
                        "variant_samples.selected_by.@id",
                        "variant_samples.selected_by.display_title",
                        "variant_samples.variant_sample_item.@id",
                        "variant_samples.variant_sample_item.uuid",
                        "variant_samples.variant_sample_item.display_title",
                        "variant_samples.variant_sample_item.finding_table_tag",
                        "variant_samples.variant_sample_item.actions",
                        "variant_samples.variant_sample_item.associated_genotype_labels.proband_genotype_label",
                        "variant_samples.variant_sample_item.associated_genotype_labels.mother_genotype_label",
                        "variant_samples.variant_sample_item.associated_genotype_labels.father_genotype_label",

                        "variant_samples.variant_sample_item.variant.@id",
                        "variant_samples.variant_sample_item.variant.display_title",
                        "variant_samples.variant_sample_item.variant.genes.genes_most_severe_gene.@id",
                        "variant_samples.variant_sample_item.variant.genes.genes_most_severe_gene.display_title",
                        "variant_samples.variant_sample_item.variant.genes.genes_most_severe_transcript",
                        "variant_samples.variant_sample_item.variant.genes.genes_most_severe_hgvsc",
                        "variant_samples.variant_sample_item.variant.genes.genes_most_severe_hgvsp",

                        // structural variant sample embeds (TODO: add more as needed)
                        "structural_variant_samples.filter_blocks_used",
                        "structural_variant_samples.date_selected",
                        "structural_variant_samples.selected_by.@id",
                        "structural_variant_samples.selected_by.display_title",
                        "structural_variant_samples.variant_sample_item.@id",
                        "structural_variant_samples.variant_sample_item.uuid",
                        "structural_variant_samples.variant_sample_item.display_title",
                        "structural_variant_samples.variant_sample_item.finding_table_tag",
                        "structural_variant_samples.variant_sample_item.actions",
                        "structural_variant_samples.variant_sample_item.structural_variant.@id",
                        "structural_variant_samples.variant_sample_item.structural_variant.display_title",
                        "structural_variant_samples.variant_sample_item.structural_variant.END",
                        "structural_variant_samples.variant_sample_item.structural_variant.START",
                        "structural_variant_samples.variant_sample_item.structural_variant.CHROM",
                        "structural_variant_samples.variant_sample_item.structural_variant.SV_TYPE",
                        "structural_variant_samples.variant_sample_item.structural_variant.size_display",
                        "structural_variant_samples.variant_sample_item.structural_variant.transcript.csq_gene.display_title",
                        "structural_variant_samples.variant_sample_item.associated_genotype_labels.proband_genotype_label",
                        "structural_variant_samples.variant_sample_item.associated_genotype_labels.mother_genotype_label",
                        "structural_variant_samples.variant_sample_item.associated_genotype_labels.father_genotype_label",

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
        const { fetchedVariantSampleListItem: variantSampleListItem, isLoadingVariantSampleListItem } = this.state;
        const { variant_samples = [], structural_variant_samples = [] } = variantSampleListItem || {};
        const childProps = {
            ...passProps,
            variantSampleListItem,
            isLoadingVariantSampleListItem,
            "savedVariantSampleIDMap": this.memoized.activeVariantSampleIDMap(variant_samples, structural_variant_samples),
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



function commonNoteEmbedFields(prefix){
    return [
        prefix + ".@id",
        prefix + ".uuid",
        prefix + ".last_modified.date_modified",
        prefix + ".status",
        prefix + ".associated_items.item_type",
        prefix + ".associated_items.item_identifier",
        prefix + ".note_text"
    ];
}

/**
 * List of Note item fields to embed from VariantSampleList Items.
 * To be used as a part of `fields` /embed payload(s).
 */
export const variantSampleListItemNoteEmbeds = [
    ...commonNoteEmbedFields("variant_samples.variant_sample_item.interpretation"),
    "variant_samples.variant_sample_item.interpretation.classification",

    ...commonNoteEmbedFields("variant_samples.variant_sample_item.discovery_interpretation"),
    "variant_samples.variant_sample_item.discovery_interpretation.gene_candidacy",
    "variant_samples.variant_sample_item.discovery_interpretation.variant_candidacy",

    ...commonNoteEmbedFields("variant_samples.variant_sample_item.variant_notes"),

    ...commonNoteEmbedFields("variant_samples.variant_sample_item.gene_notes"),
];
