import React from 'react';
import memoize from 'memoize-one';
import url from 'url';

import SubmissionView from '@hms-dbmi-bgm/shared-portal-components/es/components/forms/SubmissionView';
import CaseSubmissionView from './../item-pages/CaseView/CaseSubmissionView';


export function getSubmissionItemTypes(context, href){
    let principalTypes = context['@type'];
    if (principalTypes[0] === 'Search' || principalTypes[0] === 'Browse'){
        // If we're creating from search or browse page, use type from href.
        const parsedHref = url.parse(href, true);
        let typeFromHref = (parsedHref.query && parsedHref.query.type) || 'Item';
        if (Array.isArray(typeFromHref)) {
            [ typeFromHref ] = _.without(typeFromHref, 'Item');
        }
        if (typeFromHref && typeFromHref !== 'Item'){
            principalTypes = [ typeFromHref ]; // e.g. ['ExperimentSetReplicate']
        }
    }
    return principalTypes;
}


export default class CGAPSubmissionView extends React.PureComponent {

    constructor(props){
        super(props);
        this.memoized = {
            getSubmissionItemTypes: memoize(getSubmissionItemTypes)
        };
    }

    render(){
        const { context, href, currentAction } = this.props;
        const principalTypes = this.memoized.getSubmissionItemTypes(context, href);
        const [ leafType ] = principalTypes;

        if (leafType === "Case" && (currentAction === "add" || currentAction === "create")){
            return <CaseSubmissionView {...this.props} />;
        }

        return <SubmissionView {...this.props} />;
    }
}
