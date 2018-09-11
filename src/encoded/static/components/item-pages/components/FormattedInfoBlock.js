'use strict';

import React from 'react';
import PropTypes from 'prop-types';
import _ from 'underscore';
import { Button } from 'react-bootstrap';
import { ajax, console, isServerSide, analytics, object } from './../../util';
import { PartialList } from './PartialList';
import { generateAddressString, generateContactPersonListItem } from './AttributionTabView';



// TODO: CLEANUP FILE

/**
 * Wraps some React elements, such as a list or title, in a FormattedInfoBlock-styled wrapper.
 *
 * @prop {boolean} isSingleItem     - Whether there is only 1 item or not.
 * @prop {Element[]} children       - React Elements or Components to be wrapped.
 * @prop {string} [singularTitle]   - Optional. Title displayed in top left label. Defaults to 'Publication'.
 * @prop {string} [className]       - Additional className to be added to wrapper element.
 * @prop {string} [iconClass='book']- CSS class for icon to be displayed. Defaults to 'book'.
 */
export class FormattedInfoWrapper extends React.PureComponent {

    static defaultProps = {
        'isSingleItem'  : false,
        'singularTitle' : 'Publication',
        'iconClass'     : 'book',
        'className'     : null
    }

    render(){
        var { isSingleItem, className, singularTitle, iconClass, children } = this.props;
        var outerClassName = (
            "publications-block formatted-info-panel formatted-wrapper" +
            (isSingleItem ? ' single-item' : '') +
            (className ? ' ' + className : '')
        );
        return (
            <div className={outerClassName}>
                <h6 className="publication-label">{ singularTitle }{ isSingleItem ? '' : 's' }</h6>
                <div className="row">
                    <div className="icon-container col-xs-2 col-lg-1">
                        <i className={"icon icon-" + iconClass} />
                    </div>
                    <div className="col-xs-10 col-lg-11" children={children}/>
                </div>
            </div>
        );
    }

}


export class WrappedListBlock extends React.PureComponent {
    render(){
        var { context, className } = this.props,
            atId = object.itemUtil.atId(context);
        return (
            <li className={className} key={atId}>
                <a className="text-500" href={atId}>{ context.display_title || context.title }</a>
            </li>
        );
    }
}


export class WrappedCollapsibleList extends React.Component {

    static defaultProps = {
        'persistentCount'   : 3,
        'publications'      : [],
        'singularTitle'     : 'Publication',
        'itemClassName'     : null,
        'iconClass'         : 'book',
        'itemRenderFxn'     : null,
        'wrapperElement'    : 'ul'
    }

    constructor(props){
        super(props);
        this.itemRenderFxnFallback = this.itemRenderFxnFallback.bind(this);
        this.renderItems = this.renderItems.bind(this);
        this.render = this.render.bind(this);
        this.state = {
            'open' : false
        };
    }

    itemRenderFxnFallback(item, idx, all){
        return <WrappedListBlock className={this.props.itemClassName} context={item} key={object.itemUtil.atId(item) || idx} />;
    }

    renderItems(){
        var { itemClassName, persistentCount, items, itemRenderFxn, wrapperElement } = this.props;

        var itemsToElements = ((pubs) => _.map(pubs, itemRenderFxn || this.itemRenderFxnFallback));

        if (items.length <= persistentCount){
            return React.createElement(wrapperElement || 'ul', {}, itemsToElements(items));
        } else {
            // Only show first 3 (props.persistentCount), then a 'more' button.
            return (
                <PartialList containerType={wrapperElement} open={this.state && this.state.open}
                    persistent={itemsToElements(items.slice(0, persistentCount))}
                    collapsible={itemsToElements(items.slice(persistentCount)) } />
            );
        }
    }

    render(){
        var { items, iconClass, singularTitle, persistentCount } = this.props;
        // publications = testData; // Uncomment to test listview.

        if (!Array.isArray(items) || items.length < 1) return null;

        var isSingleItem = items.length === 1;

        return (
            <FormattedInfoWrapper isSingleItem={isSingleItem} singularTitle={singularTitle} iconClass={iconClass}>
                <div>
                    { this.renderItems() }
                    { items.length > persistentCount ?
                        <Button bsStyle="default" bsSize="small" onClick={()=>{
                            this.setState({ open : !this.state.open });
                        }}>{ this.state.open ? "Collapse" : "See " + (items.length - persistentCount) + " More" }</Button>
                    : null }
                </div>
            </FormattedInfoWrapper>
        );
    }

}


/**
 * Optional container of FormattedInfoBlocks, wrapping them in a <UL> and <LI> elements.
 * Encapsulates all required ajax/aggregation for fetching array of fields/data.
 * Available via FormattedInfoBlock.List
 *
 * @prop {Object[]} details         - Array of complete details to display.
 * @prop {string[]} endpoints       - Array of endpoints to AJAX details from.
 * @prop {function} renderItem      - Render function for items. Should return a FormattedInfoBlock component.
 * @prop {Component|Element|string} fallbackMsg - What to display if both details and endpoints don't exist or are empty.
 * @prop {string} [propertyName]    - Descriptive unique ID of property/ies displayed.
 * @prop {function} [ajaxCallback]  - Callback to execute with details, if/after they are fetched w/ AJAX.
 */
class FormattedInfoBlockList extends React.Component {

    /**
     * Same functionality as @see FormattedInfoBlock.ajaxPropertyDetails, catered to a list.
     * Use (FormattedInfoBlock.List.ajaxPropertyDetails.)bind/call/apply and from another (e.g. parent) React component.
     * 
     * @param {string[]} endpoints - Array of endpoints to get data from.
     * @param {string} propertyName - A unique id to use as state property suffix for saving results, e.g. 'labs' for state.details_labs.
     * @param {function} [callback] - Optional callback, takes results as parameter.
     */
    static ajaxPropertyDetails(endpoints, propertyName, callback = null){
        if (!Array.isArray(endpoints) || endpoints.length === 0) return false;

        var results = [];
        endpoints.forEach(function(endpoint, i){

            console.log('Obtaining ' + propertyName + '[' + i + '] via AJAX from ' + endpoint);
            ajax.load(endpoint + '?format=json&frame=embedded', function(result){
                results[i] = result;
                console.log('Obtained ' + propertyName + '[' + i + '] via AJAX.');
                if (results.length === endpoints.length){
                    // All loaded
                    var newState = {};
                    newState['details_' + propertyName] = results;
                    this.setState(newState, ()=>{
                        if (typeof callback === 'function'){
                            callback(results);
                        }
                    });
                    console.log('Obtained details_'+ propertyName +' (' + results.length + ') via AJAX: ', results);
                }
            }.bind(this), 'GET');
        }.bind(this));
    }

    static propTypes = {
        details         : PropTypes.array,        // Complete detail data for all list items, if available.
        endpoints       : PropTypes.array,      // Endpoints to use for fetching detail data. Required if details is empty.
        propertyName    : PropTypes.string,  // Property from which array is gotten.
        renderItem      : PropTypes.func,      // Function used to render child FormattedInfoBlocks
        ajaxCallback    : PropTypes.func,    // Optional callback to invoke on recieving ajax'd data, taking results as a param.
        fallbackMsg     : PropTypes.any,      // Fallback text or component(s) if endpoints not set.
        loading         : PropTypes.bool,         // Override this.state.loading - only do so if providing details array prop.
        debug           : PropTypes.bool            // Verbose lifecycle logging.
    }

    static defaultProps = {
        propertyName : 'property',
        fallbackMsg : 'Not set'
    }

    static propEndpointsValid(props){
        return props.endpoints && Array.isArray(props.endpoints) && props.endpoints.length > 0;
    }

    static propDetailsValid(props){
        return (
            (props.details && Array.isArray(props.details) && props.details.length > 0) &&
            (!props.endpoints || (FormattedInfoBlockList.propEndpointsValid(props) && props.endpoints.length === props.details.length))
        );
    }

    static getInitialDetailsState(props){
        var state = {};
        if (this.propDetailsValid(props)) {
            state['details_' + props.propertyName] = props.details;
        } else {
            state['details_' + props.propertyName] = null;
        }
        return state;
    }

    constructor(props){
        super(props);
        this.componentDidMount = this.componentDidMount.bind(this);
        this.componentWillReceiveProps = this.componentWillReceiveProps.bind(this);
        this.render = this.render.bind(this);
        this.state = _.extend(FormattedInfoBlockList.getInitialDetailsState(props), {
            'loading' : props.loading || (!FormattedInfoBlockList.propDetailsValid(props) && FormattedInfoBlockList.propEndpointsValid(props) ? true : null),
            'mounted' : false
        });
    }

    componentDidMount(){
        if (!this.state['details_' + this.props.propertyName] && FormattedInfoBlockList.propEndpointsValid(this.props)){
            FormattedInfoBlockList.ajaxPropertyDetails.call(this, this.props.endpoints, this.props.propertyName, (results) => {
                this.setState({ loading : false });
                if (typeof this.props.ajaxCallback === 'function') this.props.ajaxCallback(results);
            });
        }
        this.setState({ mounted : true });
    }

    componentWillReceiveProps(newProps){
        var stateChange = {};
        if (this.props.details !== newProps.details){
            stateChange = FormattedInfoBlockList.getInitialDetailsState(newProps);
        }
        if (this.props.loading !== newProps.loading && this.state.loading !== newProps.loading){
            stateChange.loading = newProps.loading;
        }
        this.setState(stateChange);
    }

    componentDidUpdate(prevProps, prevState){
        if (prevState.loading === true && this.state.loading === false && !this.state.transitionDelayElapsed){
            if (this.props.debug) console.info('FormattedInfoBlock.List > updated this.props.loading');
            if (this.state.mounted && !isServerSide()){
                setTimeout(()=>{
                    if (this.props.debug) console.info('FormattedInfoBlock.List > setting state.transitionDelayElapsed');
                    this.setState({ transitionDelayElapsed : true });
                }, 100);
            }
        }
    }

    render(){

        if (!FormattedInfoBlockList.propDetailsValid(this.props) && !FormattedInfoBlockList.propEndpointsValid(this.props) && !this.state.loading){
            return (
                <span className="not-set">{ this.props.fallbackMsg }</span>
            );
        }

        var blocks;

        if (this.state.loading) {
            blocks = ()=> ( this.props.endpoints || this.props.details || [null] ).map((item,i)=>
                <li key={this.props.propertyName + '-' + i} className={this.props.propertyName + "-item"}>
                    <i className="icon icon-spin icon-circle-o-notch"></i>
                </li>
            );
        } else if (this.state && this.state['details_' + this.props.propertyName]){
            blocks = ()=> this.state['details_' + this.props.propertyName].map((item,i) => {
                return (
                    <li key={this.props.propertyName + '-' + i} className={this.props.propertyName + "-item"}>
                        { this.props.renderItem(item) }
                    </li>
                );
            });
        }

        return (
            <ul
                className={
                    "formatted-info-panel-list" +
                    (this.state.loading ? ' loading' : (this.state.loading === false ? ' loaded' : '')) +
                    (this.state.transitionDelayElapsed ? ' transitioned' : '')
                }
                id={this.props.propertyName}
            >{ blocks() }</ul>
        );
    }

}

/**
 * Formats a lab, award, or potentially other object to appear in a small rectangle that can be included in a sidebar.
 * Also offers mix-in functions to help AJAX in the required details to the parent component's state.
 *
 * Also contains FormattedInfoBlock.List which is meant to display a list of FormattedInfoBlocks, and potentially AJAX in details for them.
 *
 * @class FormattedInfoBlock
 * @type {Component}
 */
export class FormattedInfoBlock extends React.Component {

    static List = FormattedInfoBlockList

    /**
     * Set a parent component's state to have 'details_' + propertyName data fetched via AJAX.
     * Must supply 'this' from parent component, via .call/.apply/.bind(this, args...),
     * AKA use like a mixin.
     *
     * @deprecated
     * @param {string} endpoint - REST endpoint to get from. Usually a '@id' field in schema-derived JSON data.
     * @param {string} propertyName - The second part of state variable to save results into, after 'details_'. E.g. 'lab' for 'details_lab'.
     * @param {function} [callback] - Optional callback.
     * 
     * @example
     * componentDidMount : function(){
     *     if (typeof this.props.context.lab == 'string' && this.props.context.lab.length > 0){
     *         FormattedInfoBlock.ajaxPropertyDetails.call(this, this.props.context.lab, 'lab');
     *     }
     * },
     */
    static ajaxPropertyDetails(endpoint, propertyName, callback = null){
        console.info('Obtaining details_' + propertyName + ' via AJAX.');
        ajax.load(endpoint + '?format=json&frame=embedded', function(result){
            var newStateAddition = {};
            newStateAddition['details_' + propertyName] = result;
            this.setState(newStateAddition, ()=>{
                if (typeof callback == 'function'){
                    callback(result);
                }
            });
            console.info('Obtained details_' + propertyName + ' via AJAX:', result);
        }.bind(this), 'GET', function(error){
            var newStateAddition = {};
            newStateAddition['details_' + propertyName] = {
                'error' : true,
                'body' : error
            };
            this.setState(newStateAddition);
            analytics.event('FormattedInfoBlock', 'ERROR', {
                eventLabel : (
                    "AJAX Error: "  + (error.title       || 'N/A') + ' | ' +
                    'Detail: '      + (error.detail      || 'N/A') + ' | ' +
                    'Description: ' + (error.description || 'N/A')
                ),
                eventValue : error.code || null
            });
        }.bind(this));
    }

    /**
     * Use like a mixin from a component which parents a FormattedInfoBlock(s).
     *
     * @deprecated
     * @param {string} propertyName - Name/key of linkTo property to fetch.
     * @param {string|Object} contextProperty - What we have as value in context, e.g. uuid or object with link_id.
     * @param {function} cb - Callback function passed down to ajaxPropertyDetails.
     * @returns {boolean} Whether an AJAX load/fetch was initiated.
     */
    static onMountMaybeFetch(propertyName = 'lab', contextProperty = (this.props.context && this.props.context.lab), cb = null){
        if (typeof contextProperty == 'string' && contextProperty.length > 0){
            FormattedInfoBlock.ajaxPropertyDetails.call(this, contextProperty, propertyName, cb);
            return true;
        }
        if (contextProperty && typeof contextProperty === 'object'){

            if (typeof contextProperty.error === 'string' && contextProperty.error.toLowerCase() === 'no view permissions') return false;
            var atId = object.itemUtil.atId(contextProperty);
            if (_.keys(contextProperty).length <= 3 && atId && typeof contextProperty.display_title === 'string'){
                FormattedInfoBlock.ajaxPropertyDetails.call(this, atId, propertyName, cb);
                return true;
            }
        }
        return false;
    }

    /**
     * Preset generator for Lab detail block.
     * @see FormattedInfoBlock.generate
     *
     * @param {Object} details_lab - Object containing Lab Details.
     * @param {boolean|string} [includeIcon] - Include icon or not. Supply string to override default lab icon. Defaults to true.
     * @param {boolean} [includeLabel] - Include 'Lab >' label in top left corner, or not. Defaults to true.
     * @param {boolean} [includeDetail] - Include description/details or not. Defaults to true.
     * @param {string} [key] - Unique key to add to generated element, supply if generating a collection/array.
     */
    static Lab(details_lab, includeIcon = true, includeLabel = true, includeDetail = true, isMounted = false, key = null){

        if (details_lab && typeof details_lab.error !== 'undefined' && details_lab.error) {
            return null;
            //return FormattedInfoBlock.Error.apply(this, arguments);
        }

        var innerContent = null,
            contactPersons = null;

        if (includeDetail && details_lab){

            contactPersons = Array.isArray(details_lab.correspondence) && _.filter(details_lab.correspondence, function(contact_person){
                return contact_person.display_title && object.itemUtil.atId(contact_person) && contact_person.contact_email;
            });

            if (contactPersons && contactPersons.length > 0){
                // Point of contact(s) for Lab which has view permission(s)
                innerContent = (
                    <div>
                        <div className="address">{ generateAddressString(details_lab) }</div>
                        <div className="correspondence">
                            <h6 className="mt-08 mb-03 text-500">Correspondence:</h6>
                            <ul>{ _.map(contactPersons, generateContactPersonListItem) }</ul>
                        </div>
                    </div>
                );
            } else {
                innerContent = generateAddressString(details_lab);
            }
        }

        return FormattedInfoBlock.generate(
            details_lab,                                                                                // detail
            typeof includeIcon == 'string' ? includeIcon : (includeIcon == true ? "icon-users" : null), // includeIcon
            includeLabel ? "Lab" : null,                                                                // includeLabel
            innerContent,                                                                               // contents
            'lab',                                                                                      // extraContainerClassName
            contactPersons ? 'contact' : 'address',                                                      // extraDetailClassName
            key                                                                                         // key
        );
    }

    /**
     * Preset generator for Award detail block.
     * @see FormattedInfoBlock.Lab
     */
    static Award(details_award, includeIcon = true, includeLabel = true, includeDetail = true, key = null){
        if (details_award && typeof details_award.error !== 'undefined' && details_award.error) {
            return null;
            //return FormattedInfoBlock.Error.apply(this, arguments);
        }
        return FormattedInfoBlock.generate(
            details_award,
            typeof includeIcon == 'string' ? includeIcon : (includeIcon == true ? "icon-institution" : null),
            includeLabel ? "Award" : null,
            details_award && includeDetail ? details_award.project : null,
            'award',
            'project',
            key
        );
    }

    /**
     * Preset generator for User detail block.
     * @see FormattedInfoBlock.Lab
     */
    static User(details_user, includeIcon = true, includeLabel = true, includeDetail = true, key = null){
        if (details_user && typeof details_user.error !== 'undefined' && details_user.error) {
            return null;
            //return FormattedInfoBlock.Error.apply(this, arguments);
        }
        return FormattedInfoBlock.generate(
            details_user,
            typeof includeIcon == 'string' ? includeIcon : (includeIcon == true ? "icon-user" : null),
            includeLabel ? (typeof includeLabel === 'string' ? includeLabel : "Submitted By") : null,
            details_user && includeDetail ? (
                (details_user.lab && details_user.lab.display_title) || details_user.job_title || details_user.timezone
            ) : null,
            'user',
            'project',
            key
        );
    }

    static Error(details_error, includeIcon = true, includeLabel = true, includeDetail = true, key = null){
        return FormattedInfoBlock.generate(
            details_error.body,
            typeof includeIcon == 'string' ? includeIcon : (includeIcon == true ? "icon-exclamation-circle" : null),
            includeLabel ? "Error" : null,
            details_error && details_error.body && includeDetail ? details_error.body.detail : null,
            'error-block',
            'error-message',
            key
        );
    }

    static generate(detail, iconClass = null, label = null, contents = null, extraContainerClassName = null, extraDetailClassName = null, key = null){
        return (
            <FormattedInfoBlock key={key} label={label} iconClass={iconClass}
                title={detail.display_title} titleHref={object.itemUtil.atId(detail)}
                extraContainerClassName={extraContainerClassName} extraDetailClassName={extraDetailClassName}
                loading={!detail} children={contents}/>
        );
    }

    static propTypes = {
        'label'                     : PropTypes.string,
        'iconClass'                 : PropTypes.string,
        'title'                     : PropTypes.string,
        'titleHref'                 : PropTypes.string,
        'detailContent'             : PropTypes.any,
        'extraContainerClassName'   : PropTypes.string,
        'extraDetailClassName'      : PropTypes.string,
        'loading'                   : PropTypes.bool,
        'debug'                     : PropTypes.bool    // Verbose log messages.
    }


    static defaultProps = {
        'label'                     : null,
        'title'                     : null,
        'titleHref'                 : "#",
        'detailContent'             : null,
        'extraContainerClassName'   : null,
        'extraDetailClassName'      : null,
        'loading'                   : false,
        'children'                  : null, // Inner contents of <FormattedInfoBlock>...</FormattedInfoBlock>
        'debug'                     : false
    }

    constructor(props){
        super(props);
        this.componentDidMount = this.componentDidMount.bind(this);
        this.componentDidUpdate = this.componentDidUpdate.bind(this);
        this.outerClassName = this.outerClassName.bind(this);
        this.render = this.render.bind(this);
        this.state = {
            transitionDelayElapsed : !props.loading,
            mounted : false
        };
    }

    componentDidMount(){
        if (this.props.debug) console.info('FormattedInfoBlock > Mounted');
        this.setState({ mounted : true });
    }

    componentDidUpdate(prevProps, prevState){
        if (prevProps.loading === true && this.props.loading === false && !this.state.transitionDelayElapsed){
            if (this.props.debug) console.info('FormattedInfoBlock > updated this.props.loading');
            
            if (this.state.mounted && !isServerSide()){
                setTimeout(()=>{
                    if (this.props.debug) console.info('FormattedInfoBlock > setting state.transitionDelayElapsed');
                    this.setState({ transitionDelayElapsed : true });
                }, 100);
            }
            
        }
    }

    outerClassName(){
        var { iconClass, label, detailContent, children, title, loading, extraContainerClassName } = this.props;
        var classes = ["formatted-info-panel"];
        if (!iconClass) classes.push('no-icon');
        if (!label) classes.push('no-label');
        if (detailContent === null && children === null) classes.push('no-details');
        if (!title) classes.push('no-title');
        if (loading) classes.push('loading');
        else classes.push('loaded');
        if (this.state.transitionDelayElapsed) classes.push('transitioned');
        if (extraContainerClassName) classes.push(extraContainerClassName);
        return classes.join(' ');
    }

    render(){
        var { loading, iconClass, detailContent, children, title, titleHref, extraDetailClassName, label } = this.props;
        var innerContent;

        if (loading) {
            innerContent = (
                <div className="row">
                    <div className="col-xs-12 text-center" style={{ color : '#d2d2d2', fontSize : '22px', paddingTop : 3 }}>
                        <i className="icon icon-spin icon-circle-o-notch"></i>
                    </div>
                </div>
            );
        } else {
            innerContent = (
                <div className="row loaded">
                    { iconClass ? <div className="col-xs-2 col-lg-1 icon-container"><i className={"icon " + iconClass}/></div> : null }
                    <div className={"details-col " + (iconClass ? "col-xs-10 col-lg-11" : "col-sm-12") + (!detailContent && !children ? ' no-more-details' : '')}>
                        { title ?
                            titleHref ?
                                <h5 className="block-title"><a href={ titleHref } title={title}>{ title }</a></h5>
                                : <h5 className="block-title no-link">{ title }</h5>
                        : null }
                        { detailContent || children ? <div className={"more-details " + extraDetailClassName} children={detailContent || children} /> : null }
                    </div>
                </div>
            );
        }
        return (
            <div className={ this.outerClassName() }>
                { label ? <h6 className="info-panel-label">{ label }</h6> : null }
                { innerContent }
            </div>
        );
    }

}
