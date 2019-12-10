'use strict';

import React from 'react';
import PropTypes from 'prop-types';
import memoize from 'memoize-one';
import url from 'url';
import _ from 'underscore';
import queryString from 'query-string';

import { ItemDetailList } from '@hms-dbmi-bgm/shared-portal-components/es/components/ui/ItemDetailList';
import { Alerts } from '@hms-dbmi-bgm/shared-portal-components/es/components/ui/Alerts';
import { console, object, layout, ajax, commonFileUtil, schemaTransforms } from '@hms-dbmi-bgm/shared-portal-components/es/components/util';

import { FlexibleDescriptionBox } from '@hms-dbmi-bgm/shared-portal-components/es/components/ui/FlexibleDescriptionBox';
import { Schemas, fileUtil, typedefs } from './../util';

import { SlideInPane } from './../viz/SlideInPane';
import { TabView } from './components/TabView';
import { BadgesTabView } from './components/BadgesTabView';
import { memoizedUrlParse } from './../globals';

import { ExpandableStaticHeader } from './../static-pages/components';

// eslint-disable-next-line no-unused-vars
const { TabObject, Item } = typedefs;

/**
 * This Component renders out the default Item page view for Item objects/contexts which do not have a more specific
 * Item page template associated with them.
 *
 * @module {Component} item-pages/DefaultItemView
 */



/**
 * Additional props we pass into ItemDetailList in all ItemViews.
 * Project-specific.
 */
export const propsForDetailList = {
    stickyKeys: ['accession', 'description', 'status', 'institution', 'project'],
    excludedKeys : ['@id', 'principals_allowed', 'actions', '@context', 'display_title', 'title', 'aggregated-items'],
    alwaysCollapsibleKeys : ['@type', 'schema_version', 'uuid', 'external_references', 'validation-errors'],
    termTransformFxn : function(field, term, allowJSX){
        // Relatively special cases for when on Item PageViews
        if (field === 'accession'){
            return (
                <object.CopyWrapper value={term} className="accession text-small inline-block" wrapperElement="span"
                    iconProps={{ 'style' : { 'fontSize' : '0.875rem', 'marginLeft' : -3 } }}>
                    { term }
                </object.CopyWrapper>
            );
        }
        if (field === 'description'){
            return (
                <FlexibleDescriptionBox
                    description={ term || <em>No description provided.</em> }
                    className="item-page-heading"
                    textClassName="text-medium"
                    defaultExpanded={term.length < 600}
                    fitTo="self"
                    lineHeight={23}
                    dimensions={{
                        'paddingWidth' : 0,
                        'paddingHeight' : 0, // Padding-top + border-top
                        'buttonWidth' : 30,
                        //'initialHeight' : 42
                    }}
                />
            );
        }
        return Schemas.Term.toName(field, term, typeof allowJSX === 'boolean' ? allowJSX : true);
    }
};


/**
 * The DefaultItemView class extends React.Component to provide some helper functions to be used from an Item View page.
 *
 * It provides a 'template' which can be extended further by Item page views such as ExperimentSetView, BiosourceView, etc. which can override/extend individual functions defined here.
 * Look at the render method to see how the functions are brought in together -- there shouldn't be a need to create own 'render' function from some Item view.
 */
export default class DefaultItemView extends React.PureComponent {

    static className = memoize(function(context){
        const classes = [
            'view-detail',
            'item-page-container',
            //'container'
        ];

        _.forEach((context['@type'] || []), function (type) {
            classes.push('type-' + type);
        });

        if (typeof context.status === 'string'){
            classes.push('status-' + context.status.toLowerCase().replace(/ /g, '-').replace(/\(|\)/g,''));
        }

        return classes.join(' ');
    });

    static propTypes = {
        'windowWidth' : PropTypes.number,
        'schemas' : PropTypes.object,
        'href' : PropTypes.string,
        'width' : PropTypes.number,
        'context' : PropTypes.shape({
            '@id' : PropTypes.string.isRequired,
            'display_title' : PropTypes.string.isRequired
        }),
        'alerts' : PropTypes.arrayOf(PropTypes.shape({
            'title' : PropTypes.string.isRequired,
            'message' : PropTypes.oneOfType([ PropTypes.string, PropTypes.element ]),
            'style': PropTypes.oneOf(['warning', 'success', 'danger', 'info', 'primary', 'secondary'])
        }))
    };

    /**
     * Bind instance methods to `this` and creates an empty state object which may be extended by subclasses.
     * May be extended by sub-classes.
     */
    constructor(props){
        super(props);
        this.getControllers = this.getControllers.bind(this);
        this.getCommonTabs = this.getCommonTabs.bind(this);
        this.getTabViewContents = this.getTabViewContents.bind(this);
        this.getTabViewWidth = this.getTabViewWidth.bind(this);
        this.setTabViewKey = this.setTabViewKey.bind(this);

        /**
         * Empty state object. May be extended by sub-classes.
         *
         * @public
         * @type {Object}
         */
        this.state = {};

        this.tabbedViewRef = React.createRef();
        this.itemActionsTabRef = React.createRef();
    }

    /**
     * If a URI param for `redirected_from` exists, and we can load the referenced Item via AJAX, show an alert at top of page regarding redirection.
     * Called upon mounting view. Is not extendable.
     *
     * @protected
     * @returns {void}
     */
    maybeSetReplacedRedirectedAlert(){
        const { href, context } = this.props;
        if (!href) return;

        let { query : { redirected_from = null } = { redirected_from : null } } = memoizedUrlParse(href);

        if (Array.isArray(redirected_from)){
            redirected_from = redirected_from[0];
        }

        let redirected_from_accession = redirected_from && _.filter(redirected_from.split('/'))[1];
        // TODO use value from schemas instd of "4DN"
        if (typeof redirected_from_accession !== 'string' || redirected_from_accession.slice(0,3) !== '4DN'){
            redirected_from_accession = null; // Unset if not in form of accession.
        }

        if (redirected_from_accession && context.accession && Array.isArray(context.alternate_accessions) && context.alternate_accessions.indexOf(redirected_from_accession) > -1){
            // Find @id of our redirected_from item.
            ajax.load('/search/?type=Item&field=@id&field=uuid&field=accession&status=replaced&accession=' + redirected_from_accession, (r)=>{
                const ourOldItem = _.findWhere(r['@graph'], { 'accession' : redirected_from_accession });
                if (!ourOldItem){
                    console.error('Couldnt find correct Item in list of results.');
                    return;
                }
                if (!object.itemUtil.atId(ourOldItem)){
                    console.error('Couldnt find @id of Item.');
                    return;
                }
                Alerts.queue({
                    'title' : "Redirected",
                    'message': <span>You have been redirected from <a href={ourOldItem['@id']}>{ redirected_from_accession }</a>, which this item ({ context.accession }) supercedes.</span>,
                    'style': 'warning'
                });
            }, 'GET', (err)=>{
                console.error('No results found');
            });
        }
    }

    /**
     * Calls `maybeSetReplacedRedirectedAlert`.
     * Sets body to full screen mode.
     * May be extended by sub-classes.
     *
     * @public
     * @returns {void}
     */
    componentDidMount(){
        this.maybeSetReplacedRedirectedAlert();
    }

    /**
     * Returns a list of _common_ tab definitions - `AttributionTabView`, `ItemDetailList`
     * DO NOT EXTEND.
     *
     * @protected
     * @param {Object} props Current props sent down to view. Should be about same as in App render function.
     * @returns {TabObject[]}
     */
    getCommonTabs(){
        const { context, schemas, windowWidth } = this.props;
        const returnArr = [];

        // Attribution Tab
        //if (context.lab || context.submitted_by || context.publications_of_set || context.produced_in_pub){
        //    returnArr.push(AttributionTabView.getTabObject(this.props));
        //}

        returnArr.push(DetailsTabView.getTabObject(this.props));

        // Badges, if any
        const badges = BadgesTabView.getBadgesList(context);
        if (badges){
            returnArr.push(BadgesTabView.getTabObject(this.props));
        }

        return returnArr;
    }

    /**
     * Returns a list of _default_ tab definitions - `ItemDetailList`, `AttributionTabView`
     * Order of tabs differs from `getCommonTabs`.
     * DO NOT EXTEND.
     *
     * @protected
     */
    getDefaultTabs(){
        const { context } = this.props;
        const returnArr = [];

        returnArr.push(DetailsTabView.getTabObject(this.props));

        //if (context.lab || context.submitted_by || context.publications_of_set || context.produced_in_pub){
        //    returnArr.push(AttributionTabView.getTabObject(this.props));
        //}
        return returnArr;
    }

    /**
     * Calculated width of tabview pane.
     * Alias of `layout.gridContainerWidth(this.props.windowWidth)`.
     *
     * @returns {number} Width of tabview.
     */
    getTabViewWidth(){
        // eslint-disable-next-line react/destructuring-assignment
        return layout.gridContainerWidth(this.props.windowWidth);
    }

    /**
     * Callback to navigate TabView to different tab.
     * DO NOT EXTEND
     *
     * @protected
     * @param {string} nextKey - Key name for tab to switch to.
     * @returns {void}
     */
    setTabViewKey(nextKey){
        const tabbedView = this.tabbedViewRef.current;
        if (tabbedView && typeof tabbedView.setActiveKey === 'function'){
            try {
                tabbedView.setActiveKey(nextKey);
            } catch (e) {
                console.warn('Could not switch TabbedView to key "' + nextKey + '", perhaps no longer supported by rc-tabs.');
            }
        } else {
            console.error('Cannot access tabbedView.setActiveKey()');
        }
    }

    /**
     * Extendable method to returns tabs for the view or sub-class view.
     * Returns `getDefaultTabs()` by default, until extended in a sub-class.
     * Executed on width change, as well as ItemView's prop changes.
     *
     * @param {Object<string,*>} [controllerProps] Props passed in from controllers, if any.
     * @returns {TabObject[]} Tab objects for this Item view/type.
     */
    getTabViewContents(controllerProps){
        return this.getDefaultTabs();
    }

    /**
     * Renders footer for the ItemView (if any).
     *
     * @returns {null} Nothing returned by default unless extended.
     */
    itemFooter(){
        return null; /*<ItemFooterRow context={context} schemas={schemas} />*/
    }

    /** Render additional item actions */
    additionalItemActionsContent(){
        return null;
    }

    /**
     * Add 'Controller' components
     * which clone children and pass down props.
     * Hacky temporary way to use these to wrap ItemViews
     * should make it somewhat easier to refactor later though.
     *
     * @returns {React.Component[]}
     */
    getControllers(){
        return null;
    }

    /**
     * The render method which puts the above method outputs together.
     * Should not override except for rare cases; instead, override other
     * methods which are called in this render method.
     *
     * @private
     * @protected
     * @returns {JSX.Element}
     */
    render() {
        const { context, href, alerts } = this.props;
        const titleTabObj = {
            'className' : "title-tab",
            'tab' : <TitleTab {..._.pick(this.props, 'schemas', 'href', 'context')} />,
            'key' : 'item-title'
        };
        const menuTabObj = {
            'className' : "menu-tab",
            'tab' : (
                <ItemActionsTab {..._.pick(this.props, 'schemas', 'href', 'context', 'innerOverlaysContainer', 'session')}
                    additionalItemActionsContent={this.additionalItemActionsContent()} />
            ),
            'key' : 'item-actions-menu',
            //'onClick' : this.onItemActionsTabClick
        };
        const controllers = this.getControllers();
        const controllersLen = (Array.isArray(controllers) && controllers.length) || 0;
        let innerBody = (
            <InnerBody getTabViewContents={this.getTabViewContents} ref={this.tabbedViewRef}
                {...{ href, context }} prefixTabs={[ titleTabObj ]} suffixTabs={[ menuTabObj ]} />
        );
        if (controllersLen > 0) {
            // Create ~ `<Controller0><Controller1><Controller2><InnerBody/></Controller2></Controller1></Controller0>`
            controllers.slice().reverse().forEach((ctrlr, i) => {
                // Handle both instantiated & non-instantiated controllers
                const createFxn = React.isValidElement(ctrlr) ? React.cloneElement : React.createElement;
                innerBody = createFxn(ctrlr, i === (controllersLen - 1) ? this.props : {}, innerBody);
            });
        }
        return (
            <div className={DefaultItemView.className(context)} id="content">
                <div id="item-page-alerts-container">
                    <Alerts alerts={alerts} className="alerts" />
                </div>
                { innerBody }
                { this.itemFooter() }
            </div>
        );
    }
}


const InnerBody = React.forwardRef(function InnerBody(props, ref){
    const { getTabViewContents, href, context, prefixTabs, suffixTabs, ...controllerProps } = props;
    return (
        <TabView
            contents={getTabViewContents(controllerProps)} ref={ref}
            {...{ href, context, prefixTabs, suffixTabs }} />
    );
});





/*******************************************
 ****** Helper Components & Functions ******
 *******************************************/

/** Show as first 'tab' of TabView Tabs. Not clickable. */
const TitleTab = React.memo(function TitleTab({ context, schemas }){
    const { display_title, accession } = context;
    const itemTypeTitle = schemaTransforms.getItemTypeTitle(context, schemas);
    let itemTitle = null;

    if (display_title && display_title !== accession) {
        itemTitle = <div className="col item-title">{ display_title }</div>;
    } else if (accession) {
        itemTitle = (
            <div className="col item-title">
                <span className="accession text-small">{ accession }</span>
            </div>
        );
    }

    return (
        <div className="row">
            <div className="col-auto item-type-title" data-tip="Item Type" data-place="right">
                { itemTypeTitle }
            </div>
            { itemTitle ?
                <div className="col-auto icon-col">
                    <i className="icon icon-angle-right fas"/>
                </div>
                : null
            }
            { itemTitle }
        </div>
    );
});


/** Show as last 'tab' of TabView Tabs */
export class ItemActionsTab extends React.PureComponent {

    static defaultProps = {
        'itemActionsExtras': {
            'edit'      : {
                description: 'Edit the properties of this Item.',
                icon: "pencil fas"
            },
            'create'    : {
                description: 'Create a blank new Item of the same type.',
                icon: "plus fas"
            },
            'clone'     : {
                description: 'Create and edit a copy of this Item.',
                icon: "copy fas"
            }
        }
    };

    constructor(props){
        super(props);
        this.toggleOpen = this.toggleOpen.bind(this);
        this.state = {
            open: false
        };
    }

    toggleOpen(evt){
        evt.preventDefault();
        evt.stopPropagation();
        this.setState(function({ open }){
            return { 'open' : !open };
        });
    }

    render(){
        const { innerOverlaysContainer, additionalItemActionsContent, ...passProps } = this.props;
        const { context : { actions = [] }, session, href, itemActionsExtras } = passProps;
        const { open } = this.state;

        if (!session && !additionalItemActionsContent){
            // No context.actions available except to see JSON (hardcoded)
            // might change in future.
            // So just show view JSON action and no menu.
            return (
                <ViewJSONAction href={href}>
                    <div className="icon-container clickable" onClick={this.toggleOpen} data-tip="Open window showing this Item in raw JSON format.">
                        <i className="icon icon-fw fas icon-file-code"/>
                        <span className="text-monospace text-smaller">JSON</span>
                    </div>
                </ViewJSONAction>
            );
        }

        // Only keep actions that are defined in the descriptions
        const filteredActions = _.filter(actions, function(action){
            return typeof itemActionsExtras[action.name] !== 'undefined';
        });

        return (
            <React.Fragment>
                <div className="icon-container clickable" onClick={this.toggleOpen}>
                    <i className="icon icon-fw fas icon-bars"/>
                    <span>Actions</span>
                </div>
                <SlideInPane in={open} overlaysContainer={innerOverlaysContainer} onClose={this.toggleOpen}>
                    <ItemActionsTabMenu {...passProps} actions={filteredActions} onClose={this.toggleOpen}>
                        { additionalItemActionsContent }
                    </ItemActionsTabMenu>
                </SlideInPane>
            </React.Fragment>
        );
    }

}


const ItemActionsTabMenu = React.memo(function ItemActionsTabMenu(props){
    const { actions, itemActionsExtras, href: currentPageHref, onClose, children } = props;

    const renderedActions = actions.map(function({ name, title, profile, href }, idx){
        const { description, icon } = itemActionsExtras[name];
        let innerTitle = (
            <React.Fragment>
                <h5>{ title || name }</h5>
                <span className="description">{ description }</span>
            </React.Fragment>
        );
        if (icon){
            innerTitle = (
                <div className="row">
                    <div className="col-auto icon-container">
                        <i className={"icon icon-fw icon-" + icon}/>
                    </div>
                    <div className="col title-col">{ innerTitle }</div>
                </div>
            );
        }
        return (
            <a className="menu-option" key={name || idx} href={href}>
                { innerTitle }
            </a>
        );
    });

    // Extend with some hardcoded actions
    // Currently only the view JSON btn.
    renderedActions.unshift(<ViewJSONMenuOption href={currentPageHref} />);

    return (
        <div className="item-page-actions-menu">
            <div className="title-box row">
                <h4 className="col">Actions</h4>
                <div className="col-auto close-btn-container clickable" onClick={onClose}>
                    <i className="icon icon-times fas"/>
                </div>
            </div>
            <div className="menu-inner">
                { renderedActions }
                { children }
            </div>
        </div>
    );
});

function ViewJSONAction({ href, children }){
    const urlParts = _.clone(memoizedUrlParse(href));
    urlParts.search = '?' + queryString.stringify(_.extend({}, urlParts.query, { 'format' : 'json' }));
    const viewUrl = url.format(urlParts);
    const onClick = (e) => {
        if (window && window.open){
            e.preventDefault();
            window.open(viewUrl, 'window', 'toolbar=no, menubar=no, resizable=yes, status=no, top=10, width=400');
        }
    };
    return React.cloneElement(children, { onClick });
}

const ViewJSONMenuOption = React.memo(function ViewJSONMenuOption({ href }){
    return (
        <ViewJSONAction href={href}>
            <a className="menu-option" href="#">
                <div className="row">
                    <div className="col-auto icon-container">
                        <i className="icon icon-fw fas icon-code"/>
                    </div>
                    <div className="col title-col">
                        <h5>View as JSON</h5>
                        <span className="description">Open raw JSON in new window.</span>
                    </div>
                </div>
            </a>
        </ViewJSONAction>
    );
});


const DetailsTabView = React.memo(function DetailsTabView(props){
    return (
        <div className="container-wide">
            <h3 className="tab-section-title">
                <span>Details</span>
            </h3>
            <hr className="tab-section-title-horiz-divider mb-05"/>
            <ItemDetailList {...propsForDetailList} {..._.pick(props, 'context', 'schemas', 'href')} />
        </div>
    );
});

DetailsTabView.getTabObject = function(props){
    return {
        'tab' : (
            <React.Fragment>
                <i className="icon fas icon-list icon-fw"/>
                <span>Details</span>
            </React.Fragment>
        ),
        'key' : 'details',
        'content' : <DetailsTabView {...props} />,
        'cache' : false
    };
};


/**
 * Renders out a list of ExpandableStaticHeader components to represent
 * `context.static_headers`.
 */

export const StaticHeadersArea = React.memo(function StaticHeaderArea({ context }){
    const headersFromStaticContent = _.pluck(_.filter(
        context.static_content || [],
        function(s){ return s.location === 'header'; }
    ), 'content');
    const headersToShow = _.uniq(_.filter(
        headersFromStaticContent.concat(context.static_headers || []),
        function(s){
            if (!s || s.error) return false; // No view permission(s)
            if (s.content || s.viewconfig) return true;
            return false; // Shouldn't happen
        }
    ), false, object.itemUtil.atId);

    if (!headersToShow || headersToShow.length === 0) return null;

    return (
        <div className="static-headers-area">
            { _.map(headersToShow, function(section, i){
                const { title, options = {}, name } = section;
                return (
                    <ExpandableStaticHeader
                        title={title || 'Informational Notice ' + (i + 1)}
                        context={section}
                        defaultOpen={options.default_open || false} key={name || i} index={i}
                        titleIcon={options.title_icon} />
                );
            })}
            <hr />
        </div>
    );
});

