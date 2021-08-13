'use strict';

import React, { useState, useMemo, useCallback } from 'react';
import _ from 'underscore';

import { console, ajax, valueTransforms } from '@hms-dbmi-bgm/shared-portal-components/es/components/util';
import { DisplayTitleColumnWrapper } from '@hms-dbmi-bgm/shared-portal-components/es/components/browse/components/table-commons';
import { EmbeddedItemSearchTable } from '../components/EmbeddedItemSearchTable';
import { StackedRowColumn } from '../../browse/variantSampleColumnExtensionMap';
import { AboveTableControlsBase } from '@hms-dbmi-bgm/shared-portal-components/es/components/browse/components/above-table-controls/AboveTableControlsBase';


export function CNVSVFilteringTab(props) {
    const {
        context = null,
        session = false,
        schemas,
        windowHeight,
    } = props;

    const {
        accession: caseAccession,
        sv_initial_search_href_filter_addon = "",
        additional_variant_sample_facets = [] // TODO: needs updates to calc property + schemas to not break searches
    } = context || {};

    const searchHrefBase = (
        "/search/?type=StructuralVariantSample"
        + (sv_initial_search_href_filter_addon ? "&" + sv_initial_search_href_filter_addon : "")
        // + (additional_variant_sample_facets.length > 0 ? "&" + additional_variant_sample_facets.map(function(fac){ return "additional_facet=" + encodeURIComponent(fac); }).join("&") : "")
        + "&sort=date_created"
    );

    console.log("searchHrefBase", searchHrefBase);

    // This maxHeight is stylistic and dependent on our view design/style
    // wherein we have minHeight of tabs set to close to windowHeight in SCSS.
    // 405px offset likely would need to be changed if we change height of tab nav, tab title area, etc.
    // Overrides default 400px.
    const maxHeight = typeof windowHeight === "number" && windowHeight > 845 ? (windowHeight - 445) : undefined;

    // Table re-initializes upon change of key so we use it refresh table based on session.
    const searchTableKey = "session:" + session;

    const tableProps = {
        // hideFacets,
        maxHeight,
        session,
        // embeddedTableHeader,
        "key": searchTableKey,
        searchHref: searchHrefBase
    };

    const aboveTableComponent = (<CNVSVEmbeddedTableHeader {...{ href: searchHrefBase, session }}/>);

    return (
        <div>
            <CaseViewEmbeddedStructuralVariantSearchTable {...tableProps} embeddedTableHeader={aboveTableComponent}/>
        </div>);
}


function CaseViewEmbeddedStructuralVariantSearchTable(props) {
    const {
        // Get/reuse default colExtMap from EmbeddedItemSearchTable
        columnExtensionMap: originalColExtMap = EmbeddedItemSearchTable.defaultProps.columnExtensionMap,
        ...passProps
    } = props;

    const columnExtensionMap = useMemo(function() { // TODO: move this into its own colextmap file if it gets longer; see about sharing info between multiple
        return {
            ...originalColExtMap,
            "display_title" : {
                // Preserve existing 'display_title' extension properties but overwrite render, minColumnWidth..
                ...originalColExtMap.display_title,
                "widthMap": { 'lg' : 250, 'md' : 220, 'sm' : 200 },
                "minColumnWidth" : (originalColExtMap.display_title.minColumnWidth || 100) + 20,
                "render": function(result, parentProps){
                    // const { href, context, rowNumber, detailOpen, toggleDetailOpen } = parentProps;
                    const { "@id": atID, structural_variant = null } = result;
                    const { display_title = "", annotation_id = "" } = structural_variant || {};

                    // annotationID structured like <type>_chr...etc; need just the part after underscore
                    const splitAnnotationID = (annotation_id || display_title).split("_");
                    return <a href={atID} target="_blank" rel="noreferrer">{splitAnnotationID[1]}</a>;
                }
            },
            // 'bam_snapshot': { // Note: not going to be added until a few versions from now; this may need updates specific to SVs when finally implemented
            //     "noSort": true,
            //     "widthMap": { 'lg' : 150, 'md' : 150, 'sm' : 150 },
            //     "render": function(result, props) {
            //         const { bam_snapshot = null, "@id": atID } = result;
            //         if (bam_snapshot) {
            //             return (
            //                 <div className="mx-auto text-truncate">
            //                     <a target="_blank" rel="noreferrer" href={atID} data-html>
            //                         SV Browser <i className="ml-07 icon-sm icon fas icon-external-link-alt"></i>
            //                     </a>
            //                 </div>
            //             );
            //         }
            //         return null;
            //     }
            // },
            "structural_variant.transcript.csq_gene.display_title": { // TODO: Needs to point to Gene tab when that is complete
                "render": function(result, props) {
                    const { "@id": atID, structural_variant: { transcript = [] } = {} } = result;
                    console.log("transcript", transcript);
                    const path = atID; // + "?annotationTab=0"
                    if (transcript.length < 2) {
                        return <a href={path}>{transcript.map((t) => t.csq_gene.display_title)}</a>;
                    } // show first and last gene separated by "..."
                    return <a href={path}>{`${transcript[0].csq_gene.display_title}...${transcript[transcript.length-1].csq_gene.display_title}`}</a> ;
                }
            },
            "structural_variant.size": {
                "render": function(result, props) {
                    const { structural_variant: { size = null } = {} } = result;

                    if (size === null) { return size; }
                    return valueTransforms.bytesToLargerUnit(size);
                }
            }
        };
    }, [ originalColExtMap ]);

    return <EmbeddedItemSearchTable {...passProps} {...{ columnExtensionMap }} />;
}

/** This left section for Search should be made prettier, either kept in 4DN or re-used. */
export const CNVSVEmbeddedTableHeader = React.memo(function CNVSVEmbeddedTableHeader(props){
    const { context, currentAction, topLeftChildren, isFullscreen, windowWidth, toggleFullScreen, sortBy } = props;
    const { total: showTotalResults = 0 } = context || {};

    // Case if on SearchView
    let total = null;
    if (typeof showTotalResults === 'number') {
        total = (
            <div className="d-inline-block">
                <span className="text-600" id="results-count">
                    { showTotalResults }
                </span>
            </div>
        );
    }

    return (
        // TODO refactor out panelMap stuff.
        <AboveTableControlsBase {...{ isFullscreen, windowWidth,toggleFullScreen, sortBy }}
            panelMap={AboveTableControlsBase.getCustomColumnSelectorPanelMapDefinition(props)}>
            { total ?
                <h4 className="col my-0">
                    <strong className="mr-1">{ total }</strong>
                    <span className="text-400">
                        CNV / SV Variant Matches
                    </span>
                </h4>: null }
        </AboveTableControlsBase>
    );
});