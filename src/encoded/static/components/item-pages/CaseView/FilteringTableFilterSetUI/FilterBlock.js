'use strict';

import React, { useState, useMemo, useCallback, useRef } from 'react';
import PropTypes from 'prop-types';
import _ from 'underscore';
import queryString from 'query-string';

import { console, object } from '@hms-dbmi-bgm/shared-portal-components/es/components/util';

import { FieldBlocks } from './FieldBlocks';



export const FilterBlock = React.memo(function FilterBlock(props){
    const {
        index = 0,
        filterBlock,
        selected = false,
        removeFilterBlockAtIdx,
        setNameOfFilterBlockAtIdx,
        selectFilterBlockIdx,
        isSettingFilterBlockIdx = false,
        facetDict,
        duplicateQueryIndices = {},
        duplicateNameIndices = {},
        savedToVSLFilterBlockQueries = {},
        cachedCounts = {},
        allFilterBlockNameQueriesValid = true,
        filterBlocksLen = 1,
        schemas = null,
        showTitle = true,
        className = null
    } = props;

    const { query: filterStrQuery, name: filterName } = filterBlock;

    /**
     * `duplicateQueryIndices` etc. are objects (not arrays), but for insertion & lookup,
     * integer key (`index`) is auto-cast to string in both instances, so works fine. Just
     * keep in mind if do `Object.keys(duplicateQueryIndices)` or similar at any point, that
     * would get back list of strings (not ints) and need to compare `parseInt(key) === index`,
     * if ever necessary.
     */
    const isDuplicateQuery = typeof duplicateQueryIndices[index] === "number";
    const isLoadingBlock = (selected && isSettingFilterBlockIdx);

    const isValidNameContentsToSaveToVariantSampleList = useMemo(function(){
        if (allFilterBlockNameQueriesValid) {
            return true;
        }
        const existingSavedFilterBlock = savedToVSLFilterBlockQueries[filterName];
        if (!existingSavedFilterBlock) {
            return true;
        }
        return object.compareQueries(existingSavedFilterBlock, queryString.parse(filterStrQuery));
    }, [ allFilterBlockNameQueriesValid, savedToVSLFilterBlockQueries, filterBlock ]);

    const [ isEditingTitle, setIsEditingTitle ] = useState(false);

    // Equivalent to static getDerivedStateFromProps of classical React component.
    if (isEditingTitle && isSettingFilterBlockIdx) {
        setIsEditingTitle(false);
    }

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
        if (typeof selectFilterBlockIdx !== "function") {
            return false;
        }
        selectFilterBlockIdx(index, !e.shiftKey);
    }, [ index, selectFilterBlockIdx ]);

    const cls = (
        "filterset-block" +
        (selected ? " selected" : "") +
        (!isEditingTitle && filterBlocksLen > 1 && typeof selectFilterBlockIdx === "function" ? " clickable" : "") +
        (className ? " " + className : "")
    );

    return (
        <div className={cls} onClick={!isEditingTitle ? onSelectClick : null}
            data-duplicate-query={isDuplicateQuery}
            data-name-value-differs-in-existing-selection={!isValidNameContentsToSaveToVariantSampleList}
            tabIndex={!isEditingTitle && filterBlocksLen > 1 ? 0 : null}
            data-tip={isDuplicateQuery ? "Duplicate query of filter block #" + (duplicateQueryIndices[index] + 1) : null}>
            { showTitle ?
                <FilterBlockTitle onRemoveClick={typeof removeFilterBlockAtIdx === "function" ? onRemoveClick : null}
                    isOnlyFilterBlock={filterBlocksLen === 1} cachedCount={cachedCounts[index]} {...{ filterName, index, isEditingTitle, setIsEditingTitle,
                        isLoadingBlock, isValidNameContentsToSaveToVariantSampleList, setNameOfFilterBlockAtIdx, duplicateNameIndices }} />
                : null }
            <FieldBlocks {...{ filterBlock, facetDict, schemas }} />
        </div>
    );
});

const FilterBlockTitle = React.memo(function FilterBlockTitle (props) {
    const {
        filterName, isOnlyFilterBlock = true, index = 0,
        isEditingTitle, setIsEditingTitle,
        isLoadingBlock = false,
        isValidNameContentsToSaveToVariantSampleList = true,
        setNameOfFilterBlockAtIdx, onRemoveClick,
        duplicateNameIndices, cachedCount
    } = props;

    const onEditClick = useCallback(function(e){
        e.stopPropagation();
        e.preventDefault();
        setIsEditingTitle(true);
    }, [ setIsEditingTitle ]);

    let innerTitle = null;
    if (isEditingTitle) {
        innerTitle = (
            <form className="w-100 d-flex align-items-center mb-0" action="#case-info.filtering" autoComplete="off" onSubmit={function(e){
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
                <button type="submit" className="btn btn-sm btn-outline-success ml-08">
                    <i className="icon icon-fw icon-check fas" />
                </button>
            </form>
        );
    } else {
        const isDuplicateName = typeof duplicateNameIndices[index] === "number";
        const deleteIconCls = "icon fas mr-07 clickable icon-times-circle" + (!isOnlyFilterBlock ? "" : " disabled");
        const titleCls = "text-small pt-02" + (
            (isDuplicateName || !isValidNameContentsToSaveToVariantSampleList) ? " text-danger"
                : !filterName ? " text-secondary"
                    : ""
        );

        innerTitle = (
            <React.Fragment>
                { !isLoadingBlock && typeof onRemoveClick === "function" ?
                    <i className={deleteIconCls} onClick={!isOnlyFilterBlock ? onRemoveClick : null}
                        data-tip={!isOnlyFilterBlock ? "Delete this filter block" : "Can't delete last filter block"} />
                    : null }
                { isLoadingBlock ? <i className="icon fas mr-07 icon-circle-notch icon-spin" /> : null }
                <span className={titleCls} data-tip={isDuplicateName ? "Duplicate title of filter block #" + (duplicateNameIndices[index] + 1) : null}>
                    { filterName || <em>No Name</em> }
                </span>
                { typeof setNameOfFilterBlockAtIdx === "function" && typeof filterName === "string" ?
                    // Prevent [attempts at] editing of JSX/non-string 'filterName' values. Should only occur for hardcoded-UI stuff like DummyLoadingFilterBlock
                    <i className="icon icon-pencil-alt fas ml-1 clickable text-smaller align-self-start" onClick={onEditClick} />
                    : null }
            </React.Fragment>
        );
    }

    const countExists = typeof cachedCount === "number";

    return (
        <div className="d-flex align-items-center px-2 pt-08 pb-04 title-controls-row">
            <div className="flex-grow-1 d-flex align-items-center">
                { innerTitle }
            </div>
            <div className="flex-grow-0 pl-16">
                <div className="cached-counts-value" data-count-exists={countExists} data-tip={countExists ? cachedCount + " results found for this filter block." : null}>
                    { cachedCount }
                </div>
            </div>
        </div>
    );
});

/**
 * FilterBlock with preset props to show that it is loading.
 * Can be shown temporarily while initial FilterSet is still loading.
 * Accepts no props + is memoized to prevent any updates.
 */
export const DummyLoadingFilterBlock = React.memo(function DummyLoadingFilterBlock(){
    return <FilterBlock filterBlock={{ "query" : "", "name" : <em>Please wait...</em> }} isSettingFilterBlockIdx selected />;
});
