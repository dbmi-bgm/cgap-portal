'use strict';

import React from 'react';
import PropTypes from 'prop-types';
import _ from 'underscore';
import url from 'url';
import memoize from 'memoize-one';

import { Alerts } from '@hms-dbmi-bgm/shared-portal-components/es/components/ui/Alerts';
import { LocalizedTime } from '@hms-dbmi-bgm/shared-portal-components/es/components/ui/LocalizedTime';
import { console, object, JWT, layout, schemaTransforms, memoizedUrlParse } from '@hms-dbmi-bgm/shared-portal-components/es/components/util';
import Registry from '@hms-dbmi-bgm/shared-portal-components/es/components/navigation/components/Registry';

import jsonScriptEscape from './../libs/jsonScriptEscape';
import { typedefs } from './util';

// eslint-disable-next-line no-unused-vars
const { Item, JSONContentResponse, SearchResponse } = typedefs;


/**
 * Other components may import this and register title views to it.
 * Custom map-like structure from ENCODE which allows 2 keys.
 *
 * @see index.js and globals.js for other examples.
 */
export const pageTitleViews = new Registry();


/** @todo add proptypes (?) */
export const PageTitleSection = React.memo(function PageTitle(props){
    const { context, currentAction, schemas, alerts, session, href } = props;

    // See if any views register their own custom-er title view.
    const FoundTitleView = pageTitleViews.lookup(context, currentAction);
    if (typeof FoundTitleView !== "undefined"){ // `null` considered as conscious lack of title
        return <FoundTitleView {...props} />;
    }

    // Else use fallback(s)

    if (isEditingFormView(context, currentAction)){
        return <EditingItemPageTitle {...{ currentAction, context, schemas, alerts }} />;
    }

    if (isStaticPage(context)){
        return <StaticPageTitle {...{ context, schemas, currentAction, alerts, session, href }} />;
    }

    if (isAnItem(context)){
        return null; // Item Pages show titles themselves
        //return <GenericItemPageTitle {...{ context, schemas, alerts }}/>;
    }

    return (
        <PageTitleContainer alerts={alerts}>
            <OnlyTitle>{ object.itemUtil.getTitleStringFromContext(context) || <em>Unknown</em> }</OnlyTitle>
        </PageTitleContainer>
    );

});


export const EditingItemPageTitle = React.memo(function EditingItemPageTitle(props){
    const { currentAction, context, schemas, alerts } = props;
    const subtitle = currentAction === 'edit' ? object.itemUtil.getTitleStringFromContext(context) // on item view
        : currentAction === 'create' ? schemaTransforms.getItemTypeTitle(context, schemas) // on item view
            : currentAction === 'add' ? schemaTransforms.getSchemaTypeFromSearchContext(context, schemas) // on search view
                : schemaTransforms.getItemTypeTitle(context, schemas);
    return (
        <PageTitleContainer alerts={alerts}>
            <TitleAndSubtitleBeside subtitle={subtitle}>
                { currentAction === 'edit' ? 'Editing' : 'Creating' }
            </TitleAndSubtitleBeside>
        </PageTitleContainer>
    );
});

/** Title Parts/Components **/


/** All custom page title views should include this unless alerts strictly not needed */
export const PageTitleContainer = React.memo(function PageTitleContainer({ children, alerts, alertsContainerClassName, className = "container" }){
    return (
        <div id="page-title-container" className={className}>
            { children }
            <Alerts alerts={alerts} className={alertsContainerClassName} />
        </div>
    );
});


export const OnlyTitle = React.memo(function OnlyTitle({ children, className, ...passProps }){
    return (
        <h1 className={"page-title top-of-page " + (className || '')} {...passProps}>
            { children }
        </h1>
    );
});

export const TitleAndSubtitleUnder = React.memo(function TitleAndSubtitleUnder(props){
    const { children, subtitle, title, className, subTitleClassName, ...passProps } = props;
    return (
        <h1 className={"page-title top-of-page " + (className || '')} {...passProps}>
            { children || title }
            <div className={"subtitle page-subtitle " + (subTitleClassName || '')}>
                { subtitle }
            </div>
        </h1>
    );
});

export const TitleAndSubtitleBeside = React.memo(function TitleAndSubtitleNextTo(props){
    const { children, subtitle, className, subTitleClassName = "prominent", ...passProps } = props;
    return (
        <h1 className={"page-title top-of-page " + (className || '')} {...passProps}>
            <span className="title">
                { children }
            </span>
            <span className={"subtitle " + (subTitleClassName || '')}>
                { subtitle }
            </span>
        </h1>
    );
});



/** Composed Titles **/

const StaticPageTitle = React.memo(function StaticPageTitle(props){
    const { children, alerts, breadCrumbsVisible, session, context, href } = props;
    const hasToc = (
        context && Array.isArray(context['@type'])
        && context['@type'].indexOf('StaticPage') > -1
        && context['table-of-contents']
        && context['table-of-contents'].enabled
    );
    const commonCls = "col-12" + hasToc ? " col-lg-9" : '';
    return (
        <PageTitleContainer alerts={alerts} className="container" alertsContainerClassName={commonCls + " mt-2"}>
            <div className="row">
                { !breadCrumbsVisible ?
                    <StaticPageBreadcrumbs {...{ context, session, href }}
                        key="breadcrumbs" className={commonCls}/>
                    : null }
                <OnlyTitle className={commonCls}>{ children || context.display_title }</OnlyTitle>
            </div>
        </PageTitleContainer>
    );
});

/** Based on 4DN content views & metadata, to be updated re: CGAP */
const GenericItemPageTitle = React.memo(function GenericItemPageTitle(props){
    const { context, schemas, alerts } = props;
    const itemTitle = object.itemUtil.getTitleStringFromContext(context);
    const itemTypeTitle = schemaTransforms.getItemTypeTitle(context, schemas);
    const isTitleAnAccession = itemTitle && object.itemUtil.isDisplayTitleAccession(context, itemTitle, true);

    if (itemTitle && isTitleAnAccession){
        // Don't show accession as title (Item Pages currently show it elsewhere)
        // But show rest of title if it is in form 'Something - ACCESSION'
        const isTherePrepend = typeof context.accession === 'string' && context.accession.length >= 12 && itemTitle.indexOf(' - ' + context.accession) > -1;
        if (isTherePrepend){
            const remainderTitle = itemTitle.replace(' - ' + context.accession, '');
            if (remainderTitle.length > 0){
                return (
                    <PageTitleContainer alerts={alerts}>
                        <TitleAndSubtitleBeside subtitle={remainderTitle}>
                            { itemTypeTitle }
                        </TitleAndSubtitleBeside>
                    </PageTitleContainer>
                );
            }
        }
        // We currently render accession in ItemView so exclude it here if it is the title.
        return <PageTitleContainer alerts={alerts}><OnlyTitle>{ itemTypeTitle }</OnlyTitle></PageTitleContainer>;
    }

    if (itemTitle && itemTitle.indexOf(context['@type'][0] + ' from ') === 0){
        // Our title is in form of 'CellCultureDetails from 2018-01-01' or something, lets make it prettier.
        // Becomes ~ `<title>CellCultureDetails</title><subtitle> from January 1st, 2018</subtitle>`
        const dateCreatedTitle = (
            (context.date_created && <span>from <LocalizedTime timestamp={context.date_created} /></span>) ||
            itemTitle.replace(context['@type'][0] + ' ', '')
        );
        return (
            <PageTitleContainer alerts={alerts}>
                <TitleAndSubtitleBeside subtitle={dateCreatedTitle}>{ itemTypeTitle }</TitleAndSubtitleBeside>
            </PageTitleContainer>
        );
    }

    if (itemTitle){
        const itemTypeHierarchy = schemaTransforms.schemasToItemTypeHierarchy(schemas);
        if (!context.accession && !itemTypeHierarchy[context['@type'][0]] && typeof itemTitle === 'string' && itemTitle.length > 20) {
            // Item views will currently show accession &/or abstract type.
            // While this is case, we need to test for them here for layouting.
            // If itemTitle is < 20chars might as well show it beside itemTypeTitle, anyway.
            return (
                <PageTitleContainer alerts={alerts}>
                    <TitleAndSubtitleUnder subtitle={itemTitle}>{ itemTypeTitle }</TitleAndSubtitleUnder>
                </PageTitleContainer>
            );
        } else {
            return (
                <PageTitleContainer alerts={alerts}>
                    <TitleAndSubtitleBeside subtitle={itemTitle}>{ itemTypeTitle }</TitleAndSubtitleBeside>
                </PageTitleContainer>
            );
        }
    }

    // Default
    return <PageTitleContainer alerts={alerts}><OnlyTitle>{ itemTypeTitle }</OnlyTitle></PageTitleContainer>;

});


/** Check whether current context has an `@type` list containing "StaticPage". */
const isStaticPage = memoize(function(context){
    if (Array.isArray(context['@type'])){
        if (context['@type'][context['@type'].length - 1] === 'Portal' && context['@type'][context['@type'].length - 2] === 'StaticPage'){
            if (context['@type'].indexOf('HomePage') > -1) return false; // Exclude home page
            return true;
        }
    }
    return false;
});

const isAnItem = memoize(function(context){
    if (object.itemUtil.isAnItem(context) && Array.isArray(context['@type'])){
        if (context['@type'].indexOf('Item') > -1){
            return true;
        }
    }
    return false;
});

const isEditingFormView = memoize(function(context, currentAction){
    return (
        currentAction &&
        { 'edit':1, 'create':1, 'add':1 }[currentAction] &&
        (object.isAnItem(context) || (context['@type'] && context['@type'].indexOf('Search') > -1))
    );
});


/**
 * Renders out breadcrumb links under page title for static help pages.
 * Also adds JSON-LD structured data breadcrumbs for SEO.
 *
 * Is used as part of PageTitle.
 * @memberof PageTitle
 */
export class StaticPageBreadcrumbs extends React.Component {

    /**
     * Get ancestors of current Item JSON.
     *
     * @param {Item} context - Current Item JSON.
     * @returns {{ '@id' : string }[]} List of ancestors as a JSON list.
     */
    static getAncestors(context){
        if (!context.parent || !context.parent.display_title) return null;
        var list = [];
        var node = context.parent;
        while (node){
            list.push(node);
            node = node.parent;
        }
        list.reverse();
        list.push(context);
        return list;
    }

    /**
     * @constant
     * @public
     * @ignore
     */
    static defaultProps = {
        'editBtnStyle' : {}
    };

    /** @ignore */
    constructor(props){
        super(props);
        this.renderCrumb = this.renderCrumb.bind(this);
        this.seoMetadata = this.seoMetadata.bind(this);
    }

    /**
     * Renders each individual crumb.
     *
     * @private
     * @param {Item} ancestor   JSON representing an ancestor. Should have at least an @id and a display_title.
     * @param {number} index    Current ancestor index.
     * @param {Item[]} all      List of all ancestors being iterated.
     * @returns {JSX.Element} A div element representing a breadcrumb.
     */
    renderCrumb(ancestor, index, all){
        var inner;
        if (ancestor['@id'] === this.props.context['@id']){
            inner = null;//ancestor.display_title;
        } else {
            inner = <a href={ancestor['@id']}>{ ancestor.display_title }</a>;
        }
        return (
            <div className="static-breadcrumb" data-name={ancestor.name} key={ancestor['@id']}>
                { index > 0 ? <i className="icon icon-fw icon-angle-right fas"/> : null }
                { inner }
            </div>
        );
    }

    /**
     * Renders an edit button to right side of page for people with edit permission.
     *
     * @private
     */
    editButton(){
        const { session, context, style } = this.props;
        if (session && context && Array.isArray(context['@type']) && context['@type'].indexOf('StaticPage') > -1){

            if (Array.isArray(context.actions)){
                var editAction = _.findWhere(context.actions, { 'name' : 'edit' });
                if (editAction && editAction.href){
                    return (
                        <div className="static-edit-button pull-right" style={style}>
                            <i className="icon icon-fw icon-pencil fas"/> <a href={editAction.href} data-tip="Edit this Static Page">Edit</a>
                        </div>
                    );
                }
            }
        }
        return null;
    }

    /**
     * Renders out JSON-LD structured data version of our breadcrumbs for
     * search engine consumption.
     *
     * @see https://developers.google.com/search/docs/data-types/breadcrumb
     *
     * @private
     * @param {{ display_title: string }[]} ancestors - List of ancestors, including self.
     * @returns {JSX.Element} A script element containing JSON-LD data.
     */
    seoMetadata(ancestors){
        if (!ancestors || !Array.isArray(ancestors) || ancestors.length < 2) return null;
        const hrefParts = memoizedUrlParse(this.props.href);
        const baseDomain = (hrefParts.protocol || '') + '//' + hrefParts.host;
        const structuredJSON = {
            "@context": "http://schema.org",
            "@type": "BreadcrumbList",
            "itemListElement" : _.map(ancestors, function(item, idx){
                return {
                    "@type" : "ListItem",
                    "position" : idx + 1,
                    "item" : {
                        "name" : item.title || item.display_title,
                        "@id" : baseDomain + object.itemUtil.atId(item)
                    }
                };
            })
        };
        return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonScriptEscape(JSON.stringify(structuredJSON)) }} />;
    }

    /** @private */
    render(){
        var { context, className } = this.props,
            ancestors = StaticPageBreadcrumbs.getAncestors(context),
            crumbs = ancestors && _.map(ancestors, this.renderCrumb);

        return  (
            <div className={"static-page-breadcrumbs clearfix" + (!crumbs ? ' empty' : '') + (className ? ' ' + className : '')}>
                { crumbs }
                { this.editButton() }
                { this.seoMetadata(ancestors) }
            </div>
        );
    }
}
