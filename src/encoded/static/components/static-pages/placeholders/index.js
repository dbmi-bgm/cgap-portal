'use strict';

import React from 'react';
import JsxParser from 'react-jsx-parser';
import memoize from 'memoize-one';
import _ from 'underscore';

import { EmbeddedItemSearchTable, SearchTableTitle } from './../../item-pages/components/EmbeddedItemSearchTable';
import { CohortStatisticalAnalysisTable } from './../../item-pages/components/CohortStatisticalAnalysisTable';
import { EmbeddedCohortBrowser } from './../../item-pages/components/HiGlass/EmbeddedCohortBrowser';
import { YoutubeVideoEmbed } from '../components/YoutubeVideoEmbed';


/**
 * Any placeholder(s) used in a StaticSection _must_ get imported here
 * and be available here.
 */
const placeholders = { EmbeddedItemSearchTable, SearchTableTitle, EmbeddedCohortBrowser, CohortStatisticalAnalysisTable, YoutubeVideoEmbed };

export const replaceString = memoize(function(placeholderString, props){

    var parsedJSXContent = (
        <JsxParser bindings={props} jsx={placeholderString} components={placeholders} key="placeholder-replacement"
            renderInWrapper={false} showWarnings onError={onError} disableKeyGeneration />
    );

    if (parsedJSXContent){
        return parsedJSXContent;
    } else {
        return placeholderString;
    }
}, function([nextPlaceHolderString, nextProps], [pastPlaceHolderString, pastProps]){
    if (nextPlaceHolderString !== pastPlaceHolderString) return false;
    var keys = _.keys(nextProps), keysLen = keys.length, i, k;
    for (i = 0; i < keysLen; i++){
        k = keys[i];
        if (nextProps[k] !== pastProps[k]) return false;
    }
    return true;
});

function onError(err){
    console.error("Error in JSX Parser --", err);
}
