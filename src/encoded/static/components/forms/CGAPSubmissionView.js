import React from 'react';
import memoize from 'memoize-one';
import url from 'url';

import SubmissionView from '@hms-dbmi-bgm/shared-portal-components/es/components/forms/SubmissionView';
// import CaseSubmissionView from './../item-pages/CaseView/CaseSubmissionView';


export function getSubmissionItemType(context, href){
    const { '@type': itemTypes = ["Item"] } = context;
    let [ principalType ] = itemTypes;

    const searchViewTypeMatch = principalType.match(/^(\w+)(SearchResults)$/); // Returns null or [ "ItemTypeSearchResults", "ItemType", "SearchResults" ]
    if (Array.isArray(searchViewTypeMatch) && searchViewTypeMatch.length === 3){
        // We're on a search results page. Parse out the proper 'type'.
        [ , principalType ] = searchViewTypeMatch; // e.g. [ "PublicationSearchResults", >> "Publication" <<, "SearchResults" ]
        return principalType;
    }

    return principalType;
}


export default class CGAPSubmissionView extends React.PureComponent {
    render(){
        return <SubmissionView {...this.props} />;
    }
}
