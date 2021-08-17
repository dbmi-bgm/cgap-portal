'use strict';

import React, { useMemo } from 'react';
import _ from 'underscore';

import { console, valueTransforms } from '@hms-dbmi-bgm/shared-portal-components/es/components/util';
import { EmbeddedItemSearchTable } from '../components/EmbeddedItemSearchTable';
import { AboveTableControlsBase } from '@hms-dbmi-bgm/shared-portal-components/es/components/browse/components/above-table-controls/AboveTableControlsBase';


export function CNVSVFilteringTab(props) {
    const {
        context = null,
        session = false,
        schemas,
        windowHeight,
    } = props;

    const {
        sv_initial_search_href_filter_addon = "",
        additional_variant_sample_facets = []
    } = context || {};

    const searchHrefBase = (
        "/search/?type=StructuralVariantSample"
        + (sv_initial_search_href_filter_addon ? "&" + sv_initial_search_href_filter_addon : "")
        + (additional_variant_sample_facets.length > 0 ? "&" + additional_variant_sample_facets.map(function(fac){ return "additional_facet=" + encodeURIComponent(fac); }).join("&") : "")
        + "&sort=date_created"
    );

    console.log("sv table searchHref:", searchHrefBase);

    // This maxHeight is stylistic and dependent on our view design/style
    // wherein we have minHeight of tabs set to close to windowHeight in SCSS.
    // 405px offset likely would need to be changed if we change height of tab nav, tab title area, etc.
    // Overrides default 400px.
    const maxHeight = typeof windowHeight === "number" && windowHeight > 845 ? (windowHeight - 445) : undefined;

    // Table re-initializes upon change of key so we use it refresh table based on session.
    const searchTableKey = "session:" + session;

    const tableProps = {
        maxHeight,
        session,
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

    const columnExtensionMap = useMemo(function() {
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
                    return <div className="text-left pl-25"><a href={atID}>{splitAnnotationID[1]}</a></div>;
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
            "structural_variant.transcript.csq_gene.display_title": {
                "render": function(result, props) {
                    const { "@id": atID, structural_variant: { transcript: transcripts = [] } = {} } = result;
                    const path = atID; // + "?annotationTab=0" // TODO: Needs to point to Gene tab when that is complete

                    const transcriptsDeduped = {};
                    transcripts.forEach((transcript) => {
                        const { csq_gene: { display_title = null } = {} } = transcript;
                        transcriptsDeduped[display_title] = true;
                    });
                    const genes = Object.keys(transcriptsDeduped);

                    if (genes.length <= 2) { // show comma separated
                        return <a href={path}>{genes.join(", ")}</a>;
                    } // show first and last gene separated by "..."
                    return <a href={path}>{`${genes[0]}...${genes[genes.length-1]}`}</a> ;
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

export const CNVSVEmbeddedTableHeader = React.memo(function CNVSVEmbeddedTableHeader(props){
    const { context, isFullscreen, windowWidth, toggleFullScreen, sortBy } = props;
    const { total: showTotalResults = 0 } = context || {};

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
        <AboveTableControlsBase {...{ isFullscreen, windowWidth, toggleFullScreen, sortBy, showMultiColumnSort: false }}
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