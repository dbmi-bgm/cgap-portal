import React from 'react';
import memoize from 'memoize-one';
import _ from 'underscore';

import { console, object } from '@hms-dbmi-bgm/shared-portal-components/es/components/util';
import { Alerts } from '@hms-dbmi-bgm/shared-portal-components/es/components/ui/Alerts';

import { store } from './../../../store';

import { buildPedigreeGraphData } from './../../viz/PedigreeViz';

import { parseFamilyIntoDataset } from './family-parsing';
import { idToGraphIdentifier } from './PedigreeTabViewBody';


/**
 * @deprecated Somewhat -- commented out parts -- unless brought back later.
 */
export class CurrentFamilyController extends React.PureComponent {

    static haveFullViewPermissionForFamily(family){
        const { original_pedigree = null, proband = null, members = [] } = family;
        // if (original_pedigree && !object.isAnItem(original_pedigree)){
        //     // Tests for presence of display_title and @id, lack of which indicates lack of view permission.
        //     return false;
        // }
        if (proband && !object.isAnItem(proband)){
            return false;
        }
        if (members.length === 0) {
            return false;
        }
        for (var i = 0; i < members.length; i++){
            if (!object.isAnItem(members[i])){
                return false;
            }
        }
        return true;
    }

    constructor(props) {
        super(props);
        // this.onAddedFamily = this.onAddedFamily.bind(this);
        // this.handleFamilySelect = _.throttle(this.handleFamilySelect.bind(this), 1000);
        // const pedigreeFamilies = (props.context.sample_processing.families || []).filter(CurrentFamilyController.haveFullViewPermissionForFamily);
        // this.state = {
        //     pedigreeFamilies,
        //     pedigreeFamiliesIdx: 0 // familiesLen - 1
        // };
        this.memoized = {
            haveFullViewPermissionForFamily: memoize(CurrentFamilyController.haveFullViewPermissionForFamily),
            buildPedigreeGraphData: memoize(buildPedigreeGraphData),
            parseFamilyIntoDataset: memoize(parseFamilyIntoDataset),
            idToGraphIdentifier: memoize(idToGraphIdentifier)
        };
    }

    // componentDidUpdate(pastProps, pastState){
    //     const { context } = this.props;
    //     const { context: pastContext } = pastProps;

    //     if (pastContext !== context){
    //         const pedigreeFamilies = (context.sample_processing.families || []).filter(CurrentFamilyController.haveFullViewPermissionForFamily);
    //         const pastPedigreeFamilies = (pastContext.sample_processing.families || []).filter(CurrentFamilyController.haveFullViewPermissionForFamily);
    //         const familiesLen = pedigreeFamilies.length;
    //         const pastFamiliesLen = pastPedigreeFamilies.length;
    //         if (familiesLen !== pastFamiliesLen){
    //             this.setState({
    //                 pedigreeFamilies,
    //                 pedigreeFamiliesIdx: familiesLen - 1
    //             });
    //         }
    //     }
    // }

    // onAddedFamily(response){
    //     const { context, status, title } = response;
    //     if (!context || status !== "success") return;

    //     const { families = [] } = context || {};
    //     const familiesLen = families.length;
    //     const newestFamily = families[familiesLen - 1];

    //     if (!newestFamily) return;

    //     const {
    //         original_pedigree : {
    //             '@id' : pedigreeID,
    //             display_title: pedigreeTitle
    //         } = {},
    //         pedigree_source
    //     } = newestFamily;
    //     let message = null;

    //     if (pedigreeTitle && pedigreeID){
    //         message = (
    //             <React.Fragment>
    //                 <p className="mb-0">Added family from pedigree <a href={pedigreeID}>{ pedigreeTitle }</a>.</p>
    //                 { pedigree_source? <p className="mb-0 text-small">Source of pedigree: <em>{ pedigree_source }</em></p> : null }
    //             </React.Fragment>
    //         );
    //     }
    //     Alerts.queue({
    //         "title" : "Added family " + familiesLen,
    //         message,
    //         "style" : "success"
    //     });

    //     store.dispatch({ type: { context } });
    // }

    // handleFamilySelect(key, callback){
    //     const callable = () => {
    //         this.setState({ 'pedigreeFamiliesIdx' : parseInt(key) }, function(){
    //             if (typeof callback === "function") {
    //                 callback();
    //             }
    //         });
    //     };

    //     // Try to defer change to background execution to
    //     // avoid 'blocking'/'hanging' UI thread while new
    //     // objectGraph is calculated.
    //     // @todo Later - maybe attempt to offload PedigreeViz graph-transformer
    //     // stuff to a WebWorker instead.
    //     if (window && window.requestIdleCallback) {
    //         window.requestIdleCallback(callable);
    //     } else {
    //         setTimeout(callable, 0);
    //     }
    // }

    render(){
        const { children, context, ...passProps } = this.props;
        // const { pedigreeFamilies = [], pedigreeFamiliesIdx } = this.state;
        // const familiesLen = pedigreeFamilies.length;
        // let currFamily, graphData, idToGraphIdentifier;
        // if (familiesLen > 0){
        //     currFamily = pedigreeFamilies[pedigreeFamiliesIdx];
        //     graphData = this.memoized.buildPedigreeGraphData(this.memoized.parseFamilyIntoDataset(currFamily));
        //     idToGraphIdentifier = this.memoized.idToGraphIdentifier(graphData.objectGraph);
        // }

        const { family } = context;
        let currFamily = null, graphData, idToGraphIdentifier;
        if (this.memoized.haveFullViewPermissionForFamily(family)) {
            currFamily = family;
            graphData = this.memoized.buildPedigreeGraphData(this.memoized.parseFamilyIntoDataset(currFamily));
            idToGraphIdentifier = this.memoized.idToGraphIdentifier(graphData.objectGraph);
        }

        const childProps = {
            ...passProps,
            context,
            currFamily,
            graphData,
            idToGraphIdentifier,
            // pedigreeFamilies,
            // pedigreeFamiliesIdx,
            // onFamilySelect: this.handleFamilySelect,
        };
        return React.Children.map(children, function(child){
            return React.cloneElement(child, childProps);
        });
    }

}