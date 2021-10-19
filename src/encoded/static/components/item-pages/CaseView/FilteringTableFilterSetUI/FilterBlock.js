'use strict';

import React, { useState, useMemo, useCallback, useRef } from 'react';
import PropTypes from 'prop-types';
import _ from 'underscore';

import { console } from '@hms-dbmi-bgm/shared-portal-components/es/components/util';

import { FieldBlocks } from './FieldBlocks';



export const FilterBlock = React.memo(function FilterBlock(props){
    const {
        index,
        filterBlock,
        selected = false,
        // searchContext,
        removeFilterBlockAtIdx,
        setNameOfFilterBlockAtIdx,
        selectFilterBlockIdx,
        isSettingFilterBlockIdx,
        facetDict,
        duplicateQueryIndices,
        duplicateNameIndices,
        cachedCounts,
        filterBlocksLen,
        schemas
    } = props;

    const {
        query: filterStrQuery,
        name: filterName
    } = filterBlock;

    const cachedCount = cachedCounts[index];

    /**
     * The following 3 assignments are memoized since string comparisons are slower than object
     * reference and integer comparisons.
     * Also, `duplicateQueryIndices` etc. are objects (not arrays), but for insertion & lookup,
     * integer key (`index`) is auto-cast to string in both instances, so works fine. Just
     * keep in mind if do `Object.keys(duplicateQueryIndices)` or similar at any point, that
     * would get back list of strings (not ints) and need to compare `parseInt(key) === index`,
     * if ever necessary.
     */
    const isDuplicateQuery = useMemo(function(){ return typeof duplicateQueryIndices[index] === "number"; }, [ duplicateQueryIndices, index ]);
    const isDuplicateName = useMemo(function(){ return typeof duplicateNameIndices[index] === "number"; }, [ duplicateNameIndices, index ]);
    const countExists = useMemo(function(){ return typeof cachedCount === "number"; }, [ cachedCounts, index ]);

    const [ isEditingTitle, setIsEditingTitle ] = useState(false);

    // Equivalent to static getDerivedStateFromProps of classical React component.
    if (isEditingTitle && isSettingFilterBlockIdx) {
        setIsEditingTitle(false);
    }

    const onEditClick = useCallback(function(e){
        e.stopPropagation();
        e.preventDefault();
        setIsEditingTitle(true);
    }, [ setIsEditingTitle ]);

    const onRemoveClick = useCallback(function(e){
        e.stopPropagation();
        if (filterStrQuery && !isDuplicateQuery) {
            const confirmation = window.confirm("Are you sure you want to delete this filter block? It still has some values.");
            if (!confirmation) return false;
        }
        removeFilterBlockAtIdx(index);
    }, [ index, removeFilterBlockAtIdx, isDuplicateQuery, !!filterStrQuery ]);

    const onSelectClick = useCallback(function(e){
        e.stopPropagation();
        e.preventDefault();
        if (e.shiftKey) {
            // Workaround to prevent selection of text on shift+mousedown.
            window.document.getSelection().removeAllRanges();
        }
        selectFilterBlockIdx(index, !e.shiftKey);
    }, [ index, selectFilterBlockIdx ]);


    let title = null;
    if (isEditingTitle && !isSettingFilterBlockIdx) {
        title = (
            <form className="w-100 d-flex align-items-center mb-0" action="#case-info.filtering" onSubmit={function(e){
                e.stopPropagation();
                e.preventDefault();
                setIsEditingTitle(false);
                const formElem = e.target;
                const [ inputElem ] = formElem.children;
                setNameOfFilterBlockAtIdx(index, inputElem.value);
            }}>
                <input type="text" name="filterName" className="form-control" defaultValue={filterName} />
                <button type="reset" className="btn btn-sm btn-outline-dark ml-08" onClick={function(e){
                    e.stopPropagation();
                    e.preventDefault();
                    setIsEditingTitle(false);
                }}>
                    <i className="icon icon-fw icon-times fas" />
                </button>
                <button type="submit" className="btn btn-sm btn-outline-success ml-08"><i className="icon icon-fw icon-check fas" /></button>
            </form>
        );
    } else {
        const isLoadingBlock = (selected && isSettingFilterBlockIdx);
        const deleteIconCls = (
            "icon fas mr-07 icon-"
            + (isLoadingBlock ? "circle-notch icon-spin" : "times-circle clickable")
            + (filterBlocksLen > 1 ? "" : " disabled")
        );
        const titleCls = "text-small" + (
            isDuplicateName ? " text-danger"
                : !filterName ? " text-secondary"
                    : ""
        );

        title = (
            <React.Fragment>
                <i className={deleteIconCls} onClick={!isLoadingBlock && filterBlocksLen > 1 ? onRemoveClick : null}
                    data-tip={!isLoadingBlock && filterBlocksLen > 1 ? "Delete this filter block" : "Can't delete last filter block"} />
                <span className={titleCls} data-tip={isDuplicateName ? "Duplicate title of filter block #" + (duplicateNameIndices[index] + 1) : null}>
                    { filterName || <em>No Name</em> }
                </span>
                { typeof filterName === "string" ?
                    // Prevent [attempts at] editing of JSX/non-string 'filterName' values. Should only occur for hardcoded-UI stuff like DummyLoadingFilterBlock
                    <i className="icon icon-pencil-alt fas ml-1 clickable text-smaller" onClick={onEditClick} />
                    : null }
            </React.Fragment>
        );
    }

    const cls = (
        "filterset-block" +
        (selected ? " selected" : "") +
        (!isEditingTitle && filterBlocksLen > 1 ? " clickable" : "")
    );

    return (
        <div className={cls} onClick={!isEditingTitle ? onSelectClick : null} data-duplicate-query={isDuplicateQuery}
            data-tip={isDuplicateQuery ? "Duplicate query of filter block #" + (duplicateQueryIndices[index] + 1) : null}>
            <div className="row px-2 pt-08 pb-04 title-controls-row">
                <div className="col d-flex align-items-center">
                    { title }
                </div>
                <div className="col-auto">
                    <div className="cached-counts-value" data-count-exists={countExists} data-tip={countExists ? cachedCount + " results found for this filter block." : null}>
                        { cachedCount }
                    </div>
                </div>
            </div>
            <FieldBlocks {...{ filterBlock, facetDict, schemas }} />
        </div>
    );
});

