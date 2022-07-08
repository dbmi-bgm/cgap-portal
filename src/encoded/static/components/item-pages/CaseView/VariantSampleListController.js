'use strict';

import React, { useMemo } from 'react';
import queryString from 'query-string';
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
        this.updateVariantSampleListSort = this.updateVariantSampleListSort.bind(this);
        const { id: vslID } = props;
        this.state = {
            "fetchedVariantSampleListItem": null,
            "variantSampleListID": typeof vslID === "string" ? vslID : null,
            "isLoadingVariantSampleListItem": typeof vslID === "string" ? true : false,
            // `refreshCount` not necessary at all, just for potential internal debugging.
            "refreshCount": 0,
            "sortType": "Variant"
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

            if (!Array.isArray(resp)) {
                this.setState({ "isLoadingVariantSampleListItem": false }, function(){
                    setTimeout(ReactTooltip.rebuild, 50);
                });
                throw new Error(`Couldn't get VSL - malformed response, check if VSL with ID \`${variantSampleListID}\` exists.`);
            }

            const [ variantSampleListItem ] = resp;
            const { "@id": vslAtID } = variantSampleListItem || {}; // Is `null` if no view permissions for it.

            if (scopedRequest !== this.currentRequest) {
                // Request superseded, cancel it.
                return false;
            }

            if (!vslAtID) {
                this.setState({ "isLoadingVariantSampleListItem": false }, function(){
                    setTimeout(ReactTooltip.rebuild, 50);
                });
                throw new Error("Couldn't get VSL - check view permissions");
            }

            this.currentRequest = null;

            this.setState(function({ refreshCount: prevRefreshCount, fetchedVariantSampleListItem: prevItem }){
                const { "@id": prevAtID = null } = prevItem || {};
                const nextState = {
                    "fetchedVariantSampleListItem": variantSampleListItem,
                    "isLoadingVariantSampleListItem": false
                };
                console.log("new variant sample item, ", variantSampleListItem);
                if (prevAtID && vslAtID !== prevAtID) {
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
                    "fields": variantSampleListEmbeds
                })
            );
        });
    }

    /** Does NOT trigger a refresh, refresh must be triggered manually afterwards */
    updateVariantSampleListID(vslID, callback){
        this.setState({ "variantSampleListID": vslID }, callback);
    }

    /** For the short term: enum will consist of ["Variant", "Gene"] */
    updateVariantSampleListSort(newSort) {
        this.setState({ sortType: newSort });
    }

    render(){
        const { children, id: propVSLID, ...passProps } = this.props;
        const { fetchedVariantSampleListItem: variantSampleListItem, isLoadingVariantSampleListItem, sortType: vslSortType } = this.state;
        const { variant_samples = [], structural_variant_samples = [] } = variantSampleListItem || {};
        const childProps = {
            ...passProps,
            vslSortType,
            variantSampleListItem,
            isLoadingVariantSampleListItem,
            "savedVariantSampleIDMap": this.memoized.activeVariantSampleIDMap(variant_samples, structural_variant_samples),
            "updateVariantSampleListID": this.updateVariantSampleListID,
            "fetchVariantSampleListItem": this.fetchVariantSampleListItem,
            "updateVariantSampleListSort": this.updateVariantSampleListSort
        };
        return React.Children.map(children, function(child){
            if (!React.isValidElement(child) || typeof child.type === "string") {
                return child;
            }
            return React.cloneElement(child, childProps);
        });
    }

}







function commonVSEmbeds(prefix){
    return [
        prefix + ".filter_blocks_used",
        prefix + ".date_selected",
        prefix + ".selected_by.@id",
        prefix + ".selected_by.display_title",
        prefix + ".variant_sample_item.@id",
        prefix + ".variant_sample_item.@type",
        prefix + ".variant_sample_item.uuid",
        prefix + ".variant_sample_item.display_title",
        prefix + ".variant_sample_item.finding_table_tag",
        prefix + ".variant_sample_item.actions",
        prefix + ".variant_sample_item.date_created",
        prefix + ".variant_sample_item.last_modified.date_modified",
        prefix + ".variant_sample_item.last_modified.modified_by.@id",
        prefix + ".variant_sample_item.last_modified.modified_by.display_title",
        prefix + ".variant_sample_item.associated_genotype_labels.proband_genotype_label",
        prefix + ".variant_sample_item.associated_genotype_labels.mother_genotype_label",
        prefix + ".variant_sample_item.associated_genotype_labels.father_genotype_label",

        // Notes
        ...commonNoteEmbeds(prefix + ".variant_sample_item.interpretation"),
        prefix + ".variant_sample_item.interpretation.classification",
        ...commonNoteEmbeds(prefix + ".variant_sample_item.discovery_interpretation"),
        prefix + ".variant_sample_item.discovery_interpretation.gene_candidacy",
        prefix + ".variant_sample_item.discovery_interpretation.variant_candidacy",
        ...commonNoteEmbeds(prefix + ".variant_sample_item.variant_notes"),
        ...commonNoteEmbeds(prefix + ".variant_sample_item.gene_notes"),
    ];
}

function commonNoteEmbeds(prefix){
    return [
        prefix + ".@id",
        prefix + ".uuid",
        prefix + ".last_modified.date_modified",
        prefix + ".last_modified.modified_by.@id",
        prefix + ".last_modified.modified_by.display_title",
        prefix + ".status",
        prefix + ".is_saved_to_project",
        prefix + ".associated_items.item_type",
        prefix + ".associated_items.item_identifier",
        prefix + ".note_text"
    ];
}


export const variantSampleListEmbeds = [
    // Fields for list view (for InterpretationTab & CaseReviewTab)

    "@id",
    // All immediate fields off of "variant_samples" must be embedded, else they will be lost in subsequent PATCH requests.
    // This includes "filter_blocks_used", "date_selected", "variant_sample_item.@id", & "selected_by.@id"
    ...commonVSEmbeds("variant_samples"),
    ...commonVSEmbeds("structural_variant_samples"),

    "variant_samples.variant_sample_item.variant.uuid",
    "variant_samples.variant_sample_item.variant.@id",
    "variant_samples.variant_sample_item.variant.display_title",
    "variant_samples.variant_sample_item.variant.genes.genes_most_severe_gene.@id",
    "variant_samples.variant_sample_item.variant.genes.genes_most_severe_gene.uuid",
    "variant_samples.variant_sample_item.variant.genes.genes_most_severe_gene.display_title",
    "variant_samples.variant_sample_item.variant.genes.genes_most_severe_transcript",
    "variant_samples.variant_sample_item.variant.genes.genes_most_severe_hgvsc",
    "variant_samples.variant_sample_item.variant.genes.genes_most_severe_hgvsp",

    "structural_variant_samples.variant_sample_item.highlighted_genes.uuid",
    "structural_variant_samples.variant_sample_item.highlighted_genes.@id",
    "structural_variant_samples.variant_sample_item.highlighted_genes.display_title",
    "structural_variant_samples.variant_sample_item.highlighted_genes.ensgid",
    "structural_variant_samples.variant_sample_item.structural_variant.@id",
    "structural_variant_samples.variant_sample_item.structural_variant.uuid",
    "structural_variant_samples.variant_sample_item.structural_variant.display_title",
    "structural_variant_samples.variant_sample_item.structural_variant.END",
    "structural_variant_samples.variant_sample_item.structural_variant.START",
    "structural_variant_samples.variant_sample_item.structural_variant.CHROM",
    "structural_variant_samples.variant_sample_item.structural_variant.SV_TYPE",
    "structural_variant_samples.variant_sample_item.structural_variant.size_display",
    "structural_variant_samples.variant_sample_item.structural_variant.transcript.csq_gene.display_title",
    "structural_variant_samples.variant_sample_item.structural_variant.transcript.csq_gene.ensgid",
    "structural_variant_samples.variant_sample_item.structural_variant.transcript.csq_canonical",
    "structural_variant_samples.variant_sample_item.structural_variant.transcript.csq_consequence.display_title",
    "structural_variant_samples.variant_sample_item.structural_variant.transcript.csq_most_severe",
    "structural_variant_samples.variant_sample_item.structural_variant.transcript.csq_mane",
    "structural_variant_samples.variant_sample_item.structural_variant.transcript.csq_feature",

];

