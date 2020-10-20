'use strict';

import React, { useState, useMemo } from 'react';
import _ from 'underscore';
import url from 'url';
import queryString from 'query-string';

import Collapse from "react-bootstrap/esm/Collapse";

import { console, layout, navigate, ajax, itemUtil } from '@hms-dbmi-bgm/shared-portal-components/es/components/util';
import { Alerts } from '@hms-dbmi-bgm/shared-portal-components/es/components/ui/Alerts';
import { LocalizedTime } from '@hms-dbmi-bgm/shared-portal-components/es/components/ui/LocalizedTime';

import { EmbeddedItemSearchTable } from '../components/EmbeddedItemSearchTable';
import { DisplayTitleColumnWrapper, DisplayTitleColumnDefault } from '@hms-dbmi-bgm/shared-portal-components/es/components/browse/components/table-commons';
import { AboveTableControlsBase } from '@hms-dbmi-bgm/shared-portal-components/es/components/browse/components/above-table-controls/AboveTableControlsBase';
import { VirtualHrefController } from '@hms-dbmi-bgm/shared-portal-components/es/components/browse/components/VirtualHrefController';


/** Maybe will be renamed if resuable */





export class FilteringTableFilterSetUI extends React.PureComponent {

    // TODO: Maybe store state.lastFilterSetSaved here and/or change to ~ reduxStore.dispatch({ ...context, active_filterset: })
    // To get active_filterset.

    constructor(props){
        super(props);
        this.toggleOpen = _.throttle(this.toggleOpen.bind(this), 750);
        this.state = {
            bodyOpen: false,
            bodyMounted: false // Is set to true for 750ms after closing to help keep contents visible until collapsed.
        };
    }

    toggleOpen(evt){
        evt.stopPropagation();
        evt.preventDefault();
        this.setState(function({ bodyOpen: exstOpen, reallyOpen }){
            const bodyOpen = !exstOpen;
            return { bodyOpen, bodyMounted: true };
        }, () => {
            const { bodyOpen } = this.state;
            if (!bodyOpen) {
                setTimeout(()=>{
                    this.setState({ bodyMounted: false });
                }, 700);
            }
        });
    }


    render(){
        const {
            filterSet = null,
            context: { total: totalCount } = {}, // Search Response
            caseItem: {
                display_title: caseTitle = null
            } = {},
            hiddenColumns, addHiddenColumn, removeHiddenColumn, columnDefinitions
        } = this.props;
        const { bodyOpen, bodyMounted } = this.state;

        const {
            '@id': filterSetID,
            display_title: fsTitle = null
        } = filterSet;

        // Too long:
        // const headerTitle = (
        //     fsTitle ? (caseTitle ? caseTitle + " - " : "") + fsTitle
        //         : null // Todo: some fallback maybe
        // );


        console.log('FILTERSETUIPROPS', this.props);

        return (
            // TODO Refactor/simplify AboveTableControlsBase to not need nor use `panelMap` (needless complexity / never had use for it)
            <div className="above-variantsample-table-ui">
                <div className="filterset-outer-container rounded">
                    <h4 className="text-400 clickable my-0 py-2 px-2" onClick={this.toggleOpen}>
                        <i className={"small icon icon-fw fas mr-07 icon-" + (bodyOpen ? "minus" : "plus")} />
                        { fsTitle }
                    </h4>
                    <Collapse in={bodyOpen}>
                        <div className="filterset-blocks-container">
                            { bodyMounted ? <FilterSetUIBlocks filterSet={filterSet} /> : null }
                        </div>
                    </Collapse>
                </div>
                <AboveTableControlsBase {...{ hiddenColumns, addHiddenColumn, removeHiddenColumn, columnDefinitions }}
                    panelMap={AboveTableControlsBase.getCustomColumnSelectorPanelMapDefinition(this.props)}>
                    <h4 className="text-400 col my-0">
                        <span className="text-600">{ totalCount }</span> Variant Matches
                    </h4>
                </AboveTableControlsBase>
            </div>
        );
    }

}

/** Renders the Blocks */

const FilterSetUIBlocks = React.memo(function FilterSetUIBlocks(props){
    const { filterSet } = props;
    const {
        "@id" : filterSetID,
        filter_blocks = []
    } = filterSet || {};

    console.log(filterSet);

    const filterBlocksJSX = filter_blocks.map(function({ queryStr }, index){
        return (
            <div className="filterset-block" key={index}>

            </div>
        );
    });

    if (filterBlocksJSX.length === 0) {
        return (
            <div className="py-3 px-2">
                <h4>No Blocks Defined</h4>
            </div>
        );
    }

    return (
        <div className="filterset-block">
            HI
        </div>
    );
});

/**
 * @todo
 * This will eventually replace some of logic in FilteringTab.js > FilteringTabSubtitle
 * While other stuff (calculation of if changed vs current search response filters etc)
 * will be in FilterSetUIBlocks or its children.
 */
export class FilterSetController extends React.PureComponent {

    constructor(props) {
        super(props);
        const { caseItem } = this.props;
        const { active_filterset } = caseItem || {};

        this.state = {
            "lastSavedFilterSet" : active_filterset || null,
            "currFilterSet": active_filterset || null
        };
    }

    render(){
        const { children } = this.props;
        const passProps = { // TODO

        };
        return React.Children.map(children, (child)=>{
            if (!React.isValidElement(child)) {
                return child;
            }
            if (typeof child.type === "string") {
                return child;
            }
            return React.cloneElement(child, passProps);
        });
    }

}
