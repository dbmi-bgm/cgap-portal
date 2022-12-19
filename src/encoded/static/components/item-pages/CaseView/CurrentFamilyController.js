import React, { useMemo } from 'react';
import memoize from 'memoize-one';
import _ from 'underscore';

import { console, object } from '@hms-dbmi-bgm/shared-portal-components/es/components/util';

import { parseFamilyIntoDataset } from './family-parsing';



export function findCanonicalFamilyIndex(familyList, canonicalFamilyPartialItem) {
    const { uuid: canonicalFamilyUUID } = canonicalFamilyPartialItem || {};
    if (!canonicalFamilyUUID) {
        throw new Error("No canonical family UUID provided. Check view permissions?");
    }
    const len = familyList.length;
    for (var i = 0; i < len; i++) {
        const { uuid: listFamilyUUID } = familyList[i];
        if (!listFamilyUUID) {
            return false; // No view permission or similar.
        }
        if (listFamilyUUID === canonicalFamilyUUID) {
            return i;
        }
    }
    return -1;
}


/**
 * Creates Object mapping Individual `@id` to
 * the generational identifier (or `orderBasedName`)
 * that is present for that Individual node in graph
 * data.
 *
 * @param {{ id: string, orderBasedName: string }[]} objectGraph
 * @returns {Object.<string, string>}
 */
function calculateIdToGraphIdentifier(objectGraph, isRelationshipNodeFunc){
    const mapping = {};
    objectGraph.forEach(function(node){
        if (isRelationshipNodeFunc(node)) return;
        // We use Individual's `@id` as their dataset entry `id`.
        // If this changes, can change to get from `node.data.individualItem['@id']` instead.
        // console.log("id mapped to ", node.id, " : ", node.orderBasedName);
        mapping[node.id] = node.orderBasedName;
    });
    return mapping;
}






export class CurrentFamilyController extends React.PureComponent {

    static haveFullViewPermissionForFamily(family){
        const {
            original_pedigree = null,
            proband = null,
            members = [],
            "@id": familyAtID
        } = family || {};

        if (!familyAtID) {
            return false;
        }

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

    static buildGraphData(dataset, buildFunc){
        if (!buildFunc) return null;
        return buildFunc(dataset);
    }

    static filterFamiliesWithViewPermission(spFamilies){
        if (!Array.isArray(spFamilies)) return [];
        return spFamilies.filter(CurrentFamilyController.haveFullViewPermissionForFamily);
    }

    constructor(props) {
        super(props);
        const {
            context: {
                sample_processing: { families: spFamilies = [] } = {},
                family: canonicalFamilyPartialEmbed = {}
            }
        } = props;

        this.handleFamilySelect = _.throttle(this.handleFamilySelect.bind(this), 1000);

        this.memoized = {
            haveFullViewPermissionForFamily: memoize(CurrentFamilyController.haveFullViewPermissionForFamily),
            filterFamiliesWithViewPermission: memoize(CurrentFamilyController.filterFamiliesWithViewPermission),
            buildGraphData: memoize(CurrentFamilyController.buildGraphData),
            parseFamilyIntoDataset: memoize(parseFamilyIntoDataset),
            calculateIdToGraphIdentifier: memoize(calculateIdToGraphIdentifier),
            findCanonicalFamilyIndex: memoize(findCanonicalFamilyIndex)
        };

        const familiesWithViewPermission = this.memoized.filterFamiliesWithViewPermission(spFamilies);
        const canonicalFamilyIdx = this.memoized.findCanonicalFamilyIndex(familiesWithViewPermission, canonicalFamilyPartialEmbed);

        this.state = {
            // Visualize the canonical family by default, but allow users to select different one to view in Pedigree visualizer afterwards.
            "pedigreeFamiliesIdx": canonicalFamilyIdx
        };
    }

    handleFamilySelect(key, callback){
        const callable = () => {
            this.setState({ 'pedigreeFamiliesIdx' : parseInt(key) }, function(){
                if (typeof callback === "function") {
                    callback();
                }
            });
        };

        // Try to defer change to background execution to
        // avoid 'blocking'/'hanging' UI thread while new
        // objectGraph is calculated.
        // @todo Later - maybe attempt to offload PedigreeViz graph-transformer
        // stuff to a WebWorker instead.
        if (window && window.requestIdleCallback) {
            window.requestIdleCallback(callable);
        } else {
            setTimeout(callable, 0);
        }
    }

    render(){
        const { children, context, PedigreeVizLibrary, ...passProps } = this.props;
        const {
            family: canonicalFamilyPartialEmbed,
            sample_processing: {
                families: spFamilies = []
            } = {},
        } = context;
        const { pedigreeFamiliesIdx } = this.state;


        const familiesWithViewPermission = this.memoized.filterFamiliesWithViewPermission(spFamilies);
        const familiesLen = familiesWithViewPermission.length;
        const canonicalFamilyIdx = this.memoized.findCanonicalFamilyIndex(familiesWithViewPermission, canonicalFamilyPartialEmbed);

        // TODO: Throw error if canonicalFamilyIdx is -1? It will throw index out of bounds error anyway below.
        // Not sure if we should support lack of ability to view family (or no family present..)

        let canonicalFamily, currPedigreeFamily, graphData, idToGraphIdentifier;
        if (familiesLen > 0){
            canonicalFamily = familiesWithViewPermission[canonicalFamilyIdx];
            currPedigreeFamily = familiesWithViewPermission[pedigreeFamiliesIdx];
        }

        const childProps = {
            ...passProps,
            PedigreeVizLibrary,
            context,
            canonicalFamily,
            currPedigreeFamily,
            familiesWithViewPermission,
            pedigreeFamiliesIdx,
            onFamilySelect: this.handleFamilySelect
        };

        return React.Children.map(children, function(child){
            return React.cloneElement(child, childProps);
        });
    }

}




export function FamilyItemParser(props){
    const { children, currPedigreeFamily, PedigreeVizLibrary, showAsDiseases, ...passProps } = props;
    const { buildPedigreeGraphData = null, isRelationshipNode } = PedigreeVizLibrary || {};

    const graphData = useMemo(function(){
        if (!buildPedigreeGraphData || typeof buildPedigreeGraphData !== "function") return null;
        return buildPedigreeGraphData(
            parseFamilyIntoDataset(currPedigreeFamily, showAsDiseases)
        );
    }, [ buildPedigreeGraphData, currPedigreeFamily, showAsDiseases ]);

    const idToGraphIdentifier = useMemo(function(){
        if (!graphData || !isRelationshipNode) return {};
        return calculateIdToGraphIdentifier(graphData.objectGraph, isRelationshipNode);
    }, [ graphData ]);

    const childProps = {
        ...passProps,
        PedigreeVizLibrary, currPedigreeFamily,
        showAsDiseases, graphData, idToGraphIdentifier
    };

    return React.Children.map(children, function(child){
        return React.cloneElement(child, childProps);
    });
}

