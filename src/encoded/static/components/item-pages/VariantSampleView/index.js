'use strict';

import React from 'react';
import PropTypes from 'prop-types';
import _ from 'underscore';
import { console, layout, ajax } from '@hms-dbmi-bgm/shared-portal-components/es/components/util';

import DefaultItemView from '../DefaultItemView';
import { VariantSampleOverview } from './VariantSampleOverview';
import { Alerts } from '@hms-dbmi-bgm/shared-portal-components/es/components/ui/Alerts';


export default class VariantSampleView extends DefaultItemView {

    getTabViewContents(){
        const initTabs = [];
        //initTabs.push(PedigreeTabView.getTabObject(this.props));
        //return this.getCommonTabs().concat(initTabs);
        initTabs.push(OverviewTabView.getTabObject(this.props));
        return initTabs.concat(this.getCommonTabs());
    }

}

/**
 * OverviewTabView pulls in the most recent version of the VariantSample via the embed api; this "new context"
 * is passed into VariantSampleOverview and is used to determine whether or not to render InterpretationSpace.
 * This way, InterpretationSpace is always initialized with the most recent version of context.
 *
 * Note: Currently, this "newContext" is not used for annotation space at all, but since Variants and Genes are
 * updated infrequently; this information is far less likely to be "stale" than the notes needed for Interpretation.
 */
class OverviewTabView extends React.Component {

    static getTabObject(props) {
        return {
            'tab' : (
                <React.Fragment>
                    <i className="icon icon-eye-dropper fas icon-fw"/>
                    <span>Overview</span>
                </React.Fragment>
            ),
            'key' : 'overview',
            'content' : <OverviewTabView {...props} />
        };
    }

    constructor(props) {
        super(props);

        this.state = {
            newestVariantSample: null,
            newVSLoading: true,
        };

        this.loadNewestNotesFromVS = this.loadNewestNotesFromVS.bind(this);
    }

    componentDidMount() {
        this.loadNewestNotesFromVS();
    }

    /**
     * Currently this only pulls updated notes; may be possible ot expand to also pull newest fields for annotation
     * space, however due to the infrequency of anticipated updates there, this hasn't been implemented.
     */
    loadNewestNotesFromVS() {
        const { context: { uuid = null } = {} } = this.props;
        // Do AJAX request to get new variant sample w/only relevant notes
        // Using embed API instead of datastore=database in order to prevent gene-list related slowdown and to target request

        const vsFetchCallback = (resp) => {
            const { 0: { "@id": atID = null } = {} } = resp;
            console.log("pulling new notes from VS", resp);

            if (!atID) {
                Alerts.queue({
                    title: "Error: Some information may be out of date.",
                    style: "warning",
                    message: "Could not retrieve the most recent version of this variant and its notes due to a server error. Please try refreshing the page in a few minutes."
                });
            }

            this.setState({ newVSLoading: false, newestVariantSample: resp[0] });
        };

        ajax.load(
            '/embed',
            vsFetchCallback,
            "POST",
            vsFetchCallback,
            JSON.stringify({
                "ids": [ uuid ],
                "fields": [
                    "@id",
                    "institution.@id",
                    "project.@id",

                    // Variant and Gene Notes
                    "gene_notes.@id",
                    "gene_notes.uuid",
                    "gene_notes.status",
                    "gene_notes.approved_by.display_title",
                    "gene_notes.note_text",
                    "gene_notes.approved_date",
                    "gene_notes.last_modified.date_modified",
                    "gene_notes.last_modified.modified_by.display_title",
                    "gene_notes.principles_allowed",
                    "gene_notes.institution.@id",
                    "gene_notes.project.@id",
                    "variant_notes.@id",
                    "variant_notes.status",
                    "variant_notes.approved_by.display_title",
                    "variant_notes.note_text",
                    "variant_notes.approved_date",
                    "variant_notes.last_modified.date_modified",
                    "variant_notes.last_modified.modified_by.display_title",
                    "variant_notes.principles_allowed",
                    "variant_notes.institution.@id",
                    "variant_notes.project.@id",

                    // Interpretation Notes
                    "interpretation.@id",
                    "interpretation.uuid",
                    "interpretation.status",
                    "interpretation.note_text",
                    "interpretation.conclusion",
                    "interpretation.classification",
                    "interpretation.acmg_rules_invoked",
                    "interpretation.approved_date",
                    "interpretation.approved_by.display_title",
                    "interpretation.last_modified.date_modified",
                    "interpretation.last_modified.modified_by.display_title",
                    "interpretation.principles_allowed",
                    "interpretation.institution.@id",
                    "interpretation.project.@id",

                    // Discovery Notes
                    "discovery_interpretation.uuid",
                    "discovery_interpretation.@id",
                    "discovery_interpretation.status",
                    "discovery_interpretation.note_text",
                    "discovery_interpretation.variant_candidacy",
                    "discovery_interpretation.gene_candidacy",
                    "discovery_interpretation.approved_date",
                    "discovery_interpretation.approved_by.display_title",
                    "discovery_interpretation.last_modified.date_modified",
                    "discovery_interpretation.last_modified.modified_by.display_title",
                    "discovery_interpretation.principles_allowed",
                    "discovery_interpretation.institution.@id",
                    "discovery_interpretation.project.@id",
                ]
            })
        );
    }

    render() {
        const { newestVariantSample = null, newVSLoading } = this.state;
        return (
            <div>
                <h3 className="tab-section-title container-wide">
                    Annotation Space
                </h3>
                <hr className="tab-section-title-horiz-divider"/>
                <div className="container-wide bg-light py-3 mh-inner-tab-height-full">
                    <VariantSampleOverview {...this.props} newContext={newestVariantSample} {...{ newVSLoading }} />
                </div>
            </div>
        );
    }
}
