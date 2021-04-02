'use strict';

import React, { useMemo, useCallback, useEffect } from 'react';

import { console, ajax } from '@hms-dbmi-bgm/shared-portal-components/es/components/util';
import { DisplayTitleColumnWrapper } from '@hms-dbmi-bgm/shared-portal-components/es/components/browse/components/table-commons';
import { EmbeddedItemSearchTable } from '../components/EmbeddedItemSearchTable';
import { VariantSampleDisplayTitleColumn } from './../../browse/variantSampleColumnExtensionMap';

/* Used in FilteringTab */

/**
 * This table is wrapped by `SelectedItemsController` in FilteringTab which passes in selected items and methods to select/deselect, as well.
 * `SelectedItemsController` is originally used for selecting multiple items in new window, e.g. for HiGlass files selection. It has some methods which are unnecessary or unused.
 */
export function CaseViewEmbeddedVariantSampleSearchTable(props){
    const {
        // Get/reuse default colExtMap from EmbeddedItemSearchTable
        columnExtensionMap: originalColExtMap = EmbeddedItemSearchTable.defaultProps.columnExtensionMap,
        selectedItems,
        onSelectItem,
        onResetSelectedItems,
        savedVariantSampleIDMap = {},
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
                            <VariantSampleSelectionCheckbox {...{ selectedItems, onSelectItem, savedVariantSampleIDMap }} />
                            <VariantSampleDisplayTitleColumn />
                        </DisplayTitleColumnWrapper>
                    );
                }
            }
        };
    }, [ originalColExtMap, selectedItems, savedVariantSampleIDMap ]);

    return <EmbeddedItemSearchTable {...passProps} {...{ columnExtensionMap }} />;
}

/** Based mostly on SPC SelectionItemCheckbox w. minor alterations */
export const VariantSampleSelectionCheckbox = React.memo(function VariantSampleSelectionCheckbox(props){
    const { selectedItems, result, onSelectItem, savedVariantSampleIDMap } = props;
    const { "@id": resultID } = result;
    const isPrevSaved = savedVariantSampleIDMap[resultID];
    const isSelected = selectedItems.has(resultID);
    const isChecked = isPrevSaved || isSelected;

    const onChange = useCallback(function(e){
        return onSelectItem(result, true);
    }, [ onSelectItem, result ]);

    useEffect(function(){
        // Unselect this if for some reason has been previously selected.
        // (might occur if someone started selecting things before VariantSampleList?datastore=databse Item has finished loading)
        if (isSelected && isPrevSaved) {
            onSelectItem(result, true);
        }
    }, [ isSelected, isPrevSaved ]);

    return <input type="checkbox" checked={isChecked} onChange={onChange} disabled={isPrevSaved} className="mr-2" />;
});



// function SelectableTitle({ onSelectVariant, result, link }){
//     // DisplayTitleColumnWrapper passes own 'onClick' func as prop to this component which would navigate to Item URL; don't use it here; intercept and instead use onSelectVariant from FilteringTab (or wherever).
//     // `link` is also from DisplayTitleColumnWrapper; I think good to keep as it'll translate into <a href={link}> in DisplayTitleColumnDefault and this will still allow to right-click + open in new tab (may need event.preventDefault() and/or event.stopPropagation() present in onSelectVariant).
//     return <VSDisplayTitleColumnDefault {...{ result, link }} onClick={onSelectVariant} />;
// }
