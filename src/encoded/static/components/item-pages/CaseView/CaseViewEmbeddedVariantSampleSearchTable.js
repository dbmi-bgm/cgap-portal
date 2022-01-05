'use strict';

import React, { useMemo, useCallback, useEffect } from 'react';

import { console, ajax } from '@hms-dbmi-bgm/shared-portal-components/es/components/util';
import { DisplayTitleColumnWrapper } from '@hms-dbmi-bgm/shared-portal-components/es/components/browse/components/table-commons';
import { EmbeddedItemSearchTable } from '../components/EmbeddedItemSearchTable';
import { VariantSampleDisplayTitleColumn, VariantSampleDisplayTitleColumnSV } from './../../browse/variantSampleColumnExtensionMap';
import { StackedRowColumn } from '../../browse/variantSampleColumnExtensionMap';

/* Used in FilteringTab */

/**
 * This table is wrapped by `SelectedItemsController` in FilteringTab which passes in selected items and methods to select/deselect, as well.
 * `SelectedItemsController` is originally used for selecting multiple items in new window, e.g. for HiGlass files selection. It has some methods which are unnecessary or unused.
 */
export function CaseViewEmbeddedVariantSampleSearchTable(props){
    const {
        // Get/reuse default colExtMap from EmbeddedItemSearchTable
        columnExtensionMap: originalColExtMap = EmbeddedItemSearchTable.defaultProps.columnExtensionMap,
        selectedVariantSamples,
        onSelectVariantSample,
        savedVariantSampleIDMap = {},
        isLoadingVariantSampleListItem,
        // passProps includes e.g. addToBodyClassList, removeFromBodyClassList (used for FacetList / ExtendedDescriptionPopover)
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
                    const { href, context, rowNumber, detailOpen, toggleDetailOpen } = parentProps;
                    return (
                        <DisplayTitleColumnWrapper {...{ result, href, context, rowNumber, detailOpen, toggleDetailOpen }}>
                            <VariantSampleSelectionCheckbox {...{ selectedVariantSamples, onSelectVariantSample, savedVariantSampleIDMap, isLoadingVariantSampleListItem }} />
                            <VariantSampleDisplayTitleColumn />
                        </DisplayTitleColumnWrapper>
                    );
                }
            }
        };
    }, [ originalColExtMap, selectedVariantSamples, savedVariantSampleIDMap, isLoadingVariantSampleListItem ]);

    return <EmbeddedItemSearchTable {...passProps} {...{ columnExtensionMap }} />;
}

/**
 * @todo
 * Consider having this render out <CaseViewEmbeddedVariantSampleSearchTable ...props /> but just
 * have it add "structural_variant.transcript.csq_gene.display_title" & "structural_variant.size"
 * and let `VariantSampleDisplayTitleColumn` determine if it's a SV or SNV.
 * This would allow this CaseViewEmbeddedVariantSampleSearchTableSV to be less repetitive of `CaseViewEmbeddedVariantSampleSearchTable`
 */
export function CaseViewEmbeddedVariantSampleSearchTableSV(props) {
    const {
        // Get/reuse default colExtMap from EmbeddedItemSearchTable
        columnExtensionMap: originalColExtMap = EmbeddedItemSearchTable.defaultProps.columnExtensionMap,
        selectedVariantSamples,
        onSelectVariantSample,
        savedVariantSampleIDMap = {},
        isLoadingVariantSampleListItem,
        // passProps includes e.g. addToBodyClassList, removeFromBodyClassList (used for FacetList / ExtendedDescriptionPopover)
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
                    const { href, context, rowNumber, detailOpen, toggleDetailOpen } = parentProps;
                    return (
                        <DisplayTitleColumnWrapper {...{ result, href, context, rowNumber, detailOpen, toggleDetailOpen }}>
                            <VariantSampleSelectionCheckbox {...{ selectedVariantSamples, onSelectVariantSample, savedVariantSampleIDMap, isLoadingVariantSampleListItem }} />
                            <VariantSampleDisplayTitleColumnSV />
                        </DisplayTitleColumnWrapper>
                    );
                }
            },
            // TODO: Move these to variantSampleColumnExtensionMap so we don't create new functions every render (or change to isLoadingVariantSample, ...)
            "structural_variant.transcript.csq_gene.display_title": {
                "noSort": true, // not currently a useful or informative sort.
                "render": function(result, props) {
                    const { "@id": atID, structural_variant: { transcript: transcripts = [] } = {} } = result || {};
                    const path = atID + "?annotationTab=0";

                    const transcriptsDeduped = {};
                    transcripts.forEach((transcript) => {
                        const { csq_gene: { display_title = null } = {} } = transcript;
                        transcriptsDeduped[display_title] = true;
                    });
                    const genes = Object.keys(transcriptsDeduped);

                    if (genes.length <= 2) { // show comma separated
                        return <a href={path} target="_blank" rel="noreferrer">{genes.join(", ")}</a>;
                    }
                    // show first and last gene separated by "..." with first 10 available on hover
                    const lastItemIndex = genes.length >= 10 ? 10 : genes.length;
                    const tipGenes = genes.slice(0, lastItemIndex).join(", ");

                    return <a href={path} target="_blank" rel="noreferrer" data-tip={tipGenes}>{`${genes[0]}...${genes[genes.length-1]}`}</a> ;
                }
            },
            "structural_variant.gnomadg_af": {
                "render": function(result, props) {
                    const { structural_variant: { gnomadg_af = null, unrelated_count = null } = {} } = result || {};
                    const { align = 'left' } = props;

                    const rows = [
                        <div className="d-block text-truncate" key="gnomadAF"><span className="text-600">gnomAD: </span>{gnomadg_af !== null ? gnomadg_af: "-"}</div>,
                        <div className="d-block text-truncate" key="internal"><span className="text-600">Internal: </span>{unrelated_count !== null ? unrelated_count: "-"}</div>
                    ];
                    return <StackedRowColumn {...{ rows }} className={"text-truncate text-" + align} />;
                }
            },
            "structural_variant.size": {
                "render": function(result, props) {
                    const { structural_variant: { size_display = null } = {} } = result || {};
                    return size_display;
                }
            }
        };
    }, [ originalColExtMap /* , selectedVariantSamples, savedVariantSampleIDMap, isLoadingVariantSampleListItem */ ]);

    return <EmbeddedItemSearchTable {...passProps} {...{ columnExtensionMap }} />;
}



/** Based mostly on SPC SelectionItemCheckbox w. minor alterations */
export const VariantSampleSelectionCheckbox = React.memo(function VariantSampleSelectionCheckbox(props){
    const { selectedVariantSamples, result, onSelectVariantSample, savedVariantSampleIDMap, isLoadingVariantSampleListItem = false } = props;
    const { "@id": resultID } = result;
    const isPrevSaved = savedVariantSampleIDMap[resultID];
    const isSelected = selectedVariantSamples.has(resultID);
    const isChecked = isPrevSaved || isSelected;

    const onChange = useCallback(function(e){
        return onSelectVariantSample(result, true);
    }, [ onSelectVariantSample, result ]);

    return <input type="checkbox" checked={isChecked} onChange={onChange} disabled={isLoadingVariantSampleListItem || isPrevSaved} className="mr-2" />;
});
