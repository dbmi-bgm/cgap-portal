'use strict';

import React from 'react';
import PropTypes from 'prop-types';
import _ from 'underscore';
import { Collapse, Button } from 'react-bootstrap';
import ReactTooltip from 'react-tooltip';
import { console, object, Schemas } from './../../util';
import * as vizUtil from './../../viz/utilities';
import { PartialList } from './PartialList';
import { FilesInSetTable } from './FilesInSetTable';
import { getTitleStringFromContext } from './../item';
import JSONTree from 'react-json-tree';


export class TooltipInfoIconContainer extends React.Component {
    render(){
        var { elementType, title, tooltip } = this.props;
        return React.createElement(elementType || 'div', {
            'className' : "tooltip-info-container"
        }, (
            <span>{ title }&nbsp;{ typeof tooltip === 'string' ?
                <i data-tip={tooltip} className="icon icon-info-circle"/>
            : null }</span>
        ));
    }
}


/**
 * Contains and toggles visibility/mounting of a Subview.
 *
 * @class SubItem
 * @extends {React.Component}
 */
class SubItem extends React.Component {

    constructor(props){
        super(props);
        this.toggleLink = this.toggleLink.bind(this);
        this.render = this.render.bind(this);
        if (typeof props.onToggle !== 'function'){
            this.onToggle = this.handleToggleFallback.bind(this);
        } else {
            this.onToggle = this.props.onToggle;
        }
        this.state = {
            isOpen : false
        };
        
    }

    componentDidMount(){
        ReactTooltip.rebuild();
    }

    /**
     * Handler for rendered title element. Toggles visiblity of Subview.
     *
     * @param {React.SyntheticEvent} e - Mouse click event. Its preventDefault() method is called.
     * @returns {Object} 'isOpen' : false
     */
    handleToggleFallback (e) {
        e.preventDefault();
        this.setState({
            isOpen: !this.state.isOpen,
        });
    }

    /**
     * Renders title for the Subview.
     *
     * @param {string} title - Title of panel, e.g. display_title of object for which SubIPanel is being used.
     * @param {boolean} isOpen - Whether state.isOpen is true or not. Used for if plus or minus icon.
     * @returns {Element} <span> element.
     */
    toggleLink(title = this.props.title, isOpen = (this.props.isOpen || this.state.isOpen)){
        var iconType = isOpen ? 'icon-minus' : 'icon-plus';
        if (typeof title !== 'string' || title.toLowerCase() === 'no title found'){
            title = isOpen ? "Collapse" : "Expand";
        }
        return (
            <span className="subitem-toggle">
                <span className="link" onClick={this.onToggle}>
                    <i style={{'color':'black', 'paddingRight': 10, 'paddingLeft' : 5}} className={"icon " + iconType}/>
                    { title }
                </span>
            </span>
        );
    }

    /**
     * @returns {JSX.Element} React Span element containing expandable link, and maybe open panel below it.
     */
    render() {
        return (
            <span>
                { this.toggleLink(this.props.title, this.props.isOpen || this.state.isOpen) }
                { this.state.isOpen ? <SubItemListView {...this.props} isOpen /> : <div/> }
            </span>
        );
    }
}

class SubItemListView extends React.Component {

    static shouldRenderTable(content){
        var itemKeys = _.keys(content);
        var itemKeysLength = itemKeys.length;
        if (itemKeysLength > 6) {
            return false;
        }
        for (var i = 0; i < itemKeysLength; i++){
            if ( typeof content[itemKeys[i]] !== 'string' && typeof content[itemKeys[i]] !== 'number' ) return false;
        }
    }

    render(){
        if (!this.props.isOpen) return null;
        var schemas = this.props.schemas;
        var item = this.props.content;
        var popLink = this.props.popLink;
        var keyTitleDescriptionMap = this.props.keyTitleDescriptionMap || {};
        var props = {
            'context' : item,
            'schemas' : schemas,
            'popLink' : popLink,
            'alwaysCollapsibleKeys' : [],
            'excludedKeys' : (this.props.excludedKeys || _.without(Detail.defaultProps.excludedKeys,
                // Remove
                    '@id', 'audit', 'lab', 'award', 'description'
                ).concat([
                // Add
                    'link_id', 'schema_version', 'uuid'
                ])
            ),
            'keyTitleDescriptionMap' : _.extend({}, keyTitleDescriptionMap, {
                // Extend schema properties
                '@id' : {
                    'title' : 'Link',
                    'description' : 'Link to Item'
                }
            }),
            'showJSONButton' : false
        };
        return (
            <div className="sub-panel data-display panel-body-with-header">
                <div className="key-value sub-descriptions">
                    { React.createElement(typeof item.display_title === 'string' ? ItemDetailList : Detail, props) }
                </div>
            </div>
        );
    }
}

/**
 *  Messiness.
 * 
 * @class SubItemTable
 * @extends {React.Component}
 */
class SubItemTable extends React.Component {

    /**
     * This code could look better.
     * Essentially, checks each property in first object of param 'list' and if no values fail a rough validation wherein there must be no too-deeply nested objects or lists, returns true.
     * 
     * @param {Object[]} list - List of objects
     * @returns {boolean} True if a table would be good for showing these items.
     */
    static shouldUseTable(list){
        if (!Array.isArray(list)) return false;
        if (list.length < 1) return false;
        var firstRowItem = list[0];

        if (!firstRowItem) return false;
        if (typeof firstRowItem === 'string') return false;
        if (typeof firstRowItem === 'number') return false;
        if (typeof firstRowItem.display_title === 'string') return false; // TEMP

        var rootKeys = _.keys(firstRowItem);
        var embeddedKeys, i, j, embeddedListItem, embeddedListItemKeys;
        

        for (i = 0; i < rootKeys.length; i++){
            if (Array.isArray(firstRowItem[rootKeys[i]]) && firstRowItem[rootKeys[i]].length > 0 && firstRowItem[rootKeys[i]][0] && typeof firstRowItem[rootKeys[i]][0] === 'object'){
                // List of objects exist at least 1 level deep.
                embeddedListItem = firstRowItem[rootKeys[i]][0];
                embeddedListItemKeys = _.keys(embeddedListItem);
                for (j = 0; j < embeddedListItemKeys.length; j++){
                    if (
                        Array.isArray(embeddedListItem[embeddedListItemKeys[j]]) &&
                        embeddedListItem[embeddedListItemKeys[j]][0] &&
                        typeof embeddedListItem[embeddedListItemKeys[j]][0] === 'object'
                    ){
                        // List of objects exists at least 2 levels deep.
                        return false;
                    }

                }
            }
            if (!Array.isArray(firstRowItem[rootKeys[i]]) && firstRowItem[rootKeys[i]] && typeof firstRowItem[rootKeys[i]] === 'object') {
                // Embedded object 1 level deep. Will flatten upwards if passes checks:
                // example: (sub-object) {..., 'stringProp' : 'stringVal', 'meta' : {'argument_name' : 'x', 'argument_type' : 'y'}, ...} ===> (columns) 'stringProp', 'meta.argument_name', 'meta.argument_type'
                if (typeof firstRowItem[rootKeys[i]].display_title === 'string'){
                    // This embedded object is an.... ITEM! Skip rest of checks for this property, we're ok with just drawing link to Item.
                    continue;
                }
                embeddedKeys = _.keys(firstRowItem[rootKeys[i]]);
                if (embeddedKeys.length > 5) return false; // 5 properties to flatten up feels like a good limit. Lets render objects with more than that as lists or own table (not flattened up to another 1).
                // Run some checks against the embedded object's properties. Ensure all nested lists contain plain strings or numbers, as will flatten to simple comma-delimited list.
                for (j = 0; j < embeddedKeys.length; j++){
                    // Ensure if property on embedded object's is an array, that is a simple array of strings or numbers - no objects. Will be converted to comma-delimited list.
                    if ( Array.isArray(  firstRowItem[ rootKeys[i] ][ embeddedKeys[j] ]  ) ){
                        if (
                            firstRowItem[rootKeys[i]][embeddedKeys[j]].length < 4 &&
                            (typeof firstRowItem[rootKeys[i]][embeddedKeys[j]][0] === 'string' || typeof firstRowItem[rootKeys[i]][embeddedKeys[j]][0] === 'number')
                        ) { continue; } else { return false; }
                    }
                    
                    // Ensure that if is not an array, it is a simple string or number (not another embedded object).
                    if (
                        !Array.isArray(firstRowItem[rootKeys[i]][embeddedKeys[j]]) &&
                        firstRowItem[rootKeys[i]][embeddedKeys[j]] &&
                        typeof firstRowItem[rootKeys[i]][embeddedKeys[j]] === 'object'
                    ) { // Embedded object 2 levels deep. No thx we don't want any 'meta.argument_mapping.argument_type' -length column names. Unless it's an Item for which we can just render link for.
                        if (typeof firstRowItem[rootKeys[i]][embeddedKeys[j]].display_title === 'string') continue;
                        return false;
                    }
                }
            }
        }

        return true;
    }

    constructor(props){
        super(props);
        this.componentDidMount = this.componentDidMount.bind(this);
        this.state = { mounted : false };
    }

    componentDidMount(){
        vizUtil.requestAnimationFrame(()=>{
            this.setState({ mounted : true });
        });
    }

    getColumnKeys(){
        var firstRowItem = this.props.items[0];
        var objectWithAllItemKeys = _.reduce(this.props.items, function(m, v){
            return _.extend(m, v);
        }, {});
        //var schemas = this.props.schemas || Schemas.get();
        //var tips = schemas ? object.tipsFromSchema(schemas, context) : {};
        //if (typeof this.props.keyTitleDescriptionMap === 'object' && this.props.keyTitleDescriptionMap){
        //    _.extend(tips, this.props.keyTitleDescriptionMap);
        //}
        // Property columns to push to front (common across all objects)
        var rootKeys = _.keys(objectWithAllItemKeys);

        var columnKeys = [];

        for (var i = 0; i < rootKeys.length; i++){
            if (typeof firstRowItem[rootKeys[i]] === 'string' || typeof firstRowItem[rootKeys[i]] === 'number' || Array.isArray(firstRowItem[rootKeys[i]])) {
                if (  Array.isArray(firstRowItem[rootKeys[i]]) && firstRowItem[rootKeys[i]][0] && typeof firstRowItem[rootKeys[i]][0] === 'object' && typeof firstRowItem[rootKeys[i]][0].display_title !== 'string' ) {
                    columnKeys.push({
                        'key' : rootKeys[i],
                        'childKeys' : _.keys(
                            _.reduce(this.props.items, function(m1,v1){ 
                                return _.extend(
                                    m1,
                                    _.reduce(v1[rootKeys[i]], function(m2,v2) {
                                        return _.extend(m2, v2);
                                    }, {})
                                );
                            }, {})
                        )
                    });
                } else {
                    columnKeys.push({ 'key' : rootKeys[i] });
                }
            } else if (firstRowItem[rootKeys[i]] && typeof firstRowItem[rootKeys[i]] === 'object'){
                var itemAtID = typeof firstRowItem[rootKeys[i]].display_title === 'string' && object.atIdFromObject(firstRowItem[rootKeys[i]]);
                if (itemAtID) {
                    columnKeys.push({ 'key' : rootKeys[i] }); // Keep single key if is an Item, we'll make it into a link.
                } else { // Flatten up, otherwise.
                    columnKeys = columnKeys.concat(
                        _.keys(firstRowItem[rootKeys[i]]).map(function(embeddedKey){
                            return { 'key' : rootKeys[i] + '.' + embeddedKey };
                        })
                    );
                }
            }
        }

        return columnKeys.sort(function(a,b){
            console.log('SORT', a.key, b.key);
            if (['title', 'display_title', 'accession'].indexOf(a.key) > -1) return -5;
            if (['title', 'display_title', 'accession'].indexOf(b.key) > -1) return 5;
            if (['name', 'workflow_argument_name'].indexOf(a.key) > -1) return -4;
            if (['name', 'workflow_argument_name'].indexOf(b.key) > -1) return 4;
            if (['step', 'step_argument_name'].indexOf(a.key) > -1) return -3;
            if (['step', 'step_argument_name'].indexOf(b.key) > -1) return 3;
            if (['value'].indexOf(a.key) > -1) return -2;
            if (['value'].indexOf(b.key) > -1) return 2;
            return 0;
        }).sort(function(a,b){
            // Push columns with child/embedded object lists to the end.
            if (Array.isArray(a.childKeys)) return 1;
            if (Array.isArray(b.childKeys)) return -1;
            return 0;
        });
    }

    render(){
        var columnKeys = this.getColumnKeys();

        //console.log(columnKeys);
        var subListKeyWidths = this.subListKeyWidths;
        if (!subListKeyWidths){
            subListKeyWidths = this.subListKeyWidths = !this.state.mounted || !this.subListKeyRefs ? null : (function(refObj){
                var keys = _.keys(refObj);
                var widthObj = {};
                for (var i = 0; i < keys.length; i++){
                    widthObj[keys[i]] = _.object(_.pairs(refObj[keys[i]]).map(function(refSet){
                        //var colKey = refSet[1].getAttribute('data-key');
                        var colRows = Array.from(document.getElementsByClassName('child-column-' + keys[i] + '.' + refSet[0]));
                        var maxWidth = Math.max(
                            _.reduce(colRows, function(m,v){ return Math.max(m,v.offsetWidth); }, 0),
                            refSet[1].offsetWidth + 10
                        );
                        return [ refSet[0], maxWidth /*refSet[1].offsetWidth*/ ];
                    }));
                }
                return widthObj;
            })(this.subListKeyRefs);
        }

        var rowData = _.map(
            this.props.items,
            function(item){
                return _.map(columnKeys, function(colKeyContainer){
                    var colKey = colKeyContainer.key;
                    var value = object.getNestedProperty(item, colKey);
                    if (!value) return { 'value' : '-' };
                    if (Array.isArray(value)){
                        if (typeof value[0] === 'string') return { 'value' : value.join(', ') };
                        if (value[0] && typeof value[0] === 'object'){ // Embedded list of objects.
                            var allKeys = colKeyContainer.childKeys; //_.keys(  _.reduce(value, function(m,v){ return _.extend(m,v); }, {})   );
                            return {
                                'value' : value.map(function(embeddedRow, i){
                                    return (
                                        <div style={{ whiteSpace: "nowrap" }} className="text-left child-list-row">
                                            <div className="inline-block child-list-row-number">{ i + 1 }.</div>
                                            { allKeys.map(function(k, j){
                                                return (
                                                    <div
                                                        key={colKey + '.' + k + '--row-' + i}
                                                        className={"inline-block child-column-" + colKey + '.' + k}
                                                        style={{ width : !subListKeyWidths ? null : ((subListKeyWidths[colKey] || {})[k] || null) }}
                                                    >
                                                        { embeddedRow[k] } &nbsp;
                                                    </div>
                                                );
                                            }) }
                                        </div>
                                    );
                                }),
                                'className' : 'child-list-row-container'
                            };
                        }
                    }
                    if (value && typeof value === 'object' && typeof value.display_title === 'string') {
                        return { 'value' : <a href={object.atIdFromObject(value)}>{ value.display_title }</a> };
                    }
                    if (typeof value === 'string' && value.length < 25) {
                        return { 'value' : value, 'className' : 'no-word-break' };
                    }
                    return { 'value' : value };
                });
            }
        );

        var keyTitleDescriptionMap = (((this.props.keyTitleDescriptionMap || {})[this.props.parentKey] || {}).items || {}).properties || {};

        var subListKeyRefs = this.subListKeyRefs = {};

        return (
            <div className="detail-embedded-table-container">
                <table className="detail-embedded-table">
                    <thead>
                        <tr>{
                            [<th key="rowNumber" style={{ minWidth: 36, maxWidth : 36, width: 36 }}>#</th>].concat(columnKeys.map(function(colKeyContainer){
                                //var tips = object.tipsFromSchema(Schemas.get(), context) || {};
                                var colKey = colKeyContainer.key;
                                var title = keyTitleDescriptionMap[colKey] ? (keyTitleDescriptionMap[colKey].title || colKey) : colKey;
                                var tooltip = keyTitleDescriptionMap[colKey] ? (keyTitleDescriptionMap[colKey].description || null) : null;
                                return (
                                    <th key={"header-for-" + colKey}>
                                        <TooltipInfoIconContainer title={title} tooltip={tooltip}/>
                                        { 
                                            Array.isArray(colKeyContainer.childKeys) && colKeyContainer.childKeys.length > 0 ? (function(){
                                                //var subKeyTitleDescriptionMap = (((this.props.keyTitleDescriptionMap || {})[this.props.parentKey] || {}).items || {}).properties || {};
                                                var subKeyTitleDescriptionMap = (((keyTitleDescriptionMap || {})[colKey] || {}).items || {}).properties || {};
                                                subListKeyRefs[colKey] = {};
                                                return (
                                                    <div style={{ whiteSpace: "nowrap" }} className="sub-list-keys-header">{
                                                        [<div className="inline-block child-list-row-number">&nbsp;</div>].concat(colKeyContainer.childKeys.map(function(ck){
                                                            
                                                            return (
                                                                <div className="inline-block" data-key={colKey + '.' + ck} ref={function(r){
                                                                    if (r) subListKeyRefs[colKey][ck] = r;
                                                                }} style={{ 'width' : !subListKeyWidths ? null : ((subListKeyWidths[colKey] || {})[ck] || null) }}>
                                                                    <TooltipInfoIconContainer title={(subKeyTitleDescriptionMap[ck] || {}).title || ck} tooltip={(subKeyTitleDescriptionMap[ck] || {}).description || null} />
                                                                </div>
                                                            );
                                                        }))
                                                    }</div>
                                                );
                                            })()
                                            :
                                            null
                                        }
                                    </th>
                                );
                            })) 
                        }</tr>
                    </thead>
                    <tbody>{
                        rowData.map(function(row,i){
                            return (
                                <tr key={"row-" + i}>{
                                    [<td key="rowNumber">{ i + 1 }.</td>].concat(row.map(function(colVal, j){
                                        return <td key={("column-for-" + columnKeys[j].key)} className={colVal.className || null}>{ colVal.value }</td>;
                                    }))
                                }</tr>
                            );
                        })
                    }</tbody>
                </table>
            </div>
        );
    }

}


class DetailRow extends React.Component {

    constructor(props){
        super(props);
        this.handleToggle = this.handleToggle.bind(this);
        this.render = this.render.bind(this);
        this.state = { 'isOpen' : false };
    }

    /**
     * Handler for rendered title element. Toggles visiblity of Subview.
     *
     * @param {React.SyntheticEvent} e - Mouse click event. Its preventDefault() method is called.
     * @returns {Object} 'isOpen' : false
     */
    handleToggle (e, id = null) {
        e.preventDefault();
        this.setState({
            isOpen: !this.state.isOpen,
        });
    }

    render(){
        var value = Detail.formValue(
            this.props.item,
            this.props.popLink,
            this.props['data-key'],
            this.props.itemType,
            this.props.keyTitleDescriptionMap
        );
        var label = this.props.label;
        if (this.props.labelNumber) {
            label = (
                <span>
                    <span className={"label-number right inline-block" + (this.state.isOpen ? ' active' : '')}><span className="number-icon text-200">#</span> { this.props.labelNumber }</span>
                    { label }
                </span>
            );
        }

        if (value.type === SubItem) {
            // What we have here is an embedded object of some sort. Lets override its 'isOpen' & 'onToggle' functions.
            value = React.cloneElement(value, { onToggle : this.handleToggle, isOpen : this.state.isOpen });
            
            return (
                <div>
                    <PartialList.Row label={label} children={value} className={(this.props.className || '') + (this.state.isOpen ? ' open' : '')} />
                    <SubItemListView
                        popLink={this.props.popLink}
                        content={this.props.item}
                        schemas={this.props.schemas}
                        keyTitleDescriptionMap={this.props.keyTitleDescriptionMap}
                        isOpen={this.state.isOpen}
                    />
                </div>
            );
        }

        if (value.type === "ol" && value.props.children[0] && value.props.children[0].type === "li" &&
            value.props.children[0].props.children && value.props.children[0].props.children.type === SubItem) {
            // What we have here is a list of embedded objects. Render them out recursively and adjust some styles.
            return (
                <div className="array-group" data-length={this.props.item.length}>
                { React.Children.map(value.props.children, (c, i)=>
                    <DetailRow
                        {...this.props}
                        label={
                            i === 0 ? label : <span className="dim-duplicate">{ label }</span>
                        }
                        labelNumber={i + 1}
                        className={
                            ("array-group-row item-index-" + i) +
                            (i === this.props.item.length - 1 ? ' last-item' : '') +
                            (i === 0 ? ' first-item' : '')
                        }
                        item={this.props.item[i]}
                    />
                ) }
                </div>
            );
        }
        // Default / Pass-Thru
        return <PartialList.Row label={label} children={value} className={(this.props.className || '') + (this.state.isOpen ? ' open' : '')} />;
    }

}


/**
 * The list of properties contained within ItemDetailList.
 * Isolated to allow use without existing in ItemDetailList parent.
 *
 * @class Detail
 * @type {Component}
 */
export class Detail extends React.Component {

    /**
     * Formats the correct display for each metadata field.
     *
     * @memberof module:item-pages/components.ItemDetailList.Detail
     * @static
     * @param {Object} tips - Mapping of field property names (1 level deep) to schema properties.
     * @param {Object} key - Key to use to get 'description' for tooltip from the 'tips' param.
     * @returns {Element} <div> element with a tooltip and info-circle icon.
     */
    static formKey(tips, key, includeTooltip = true){
        var tooltip = null;
        var title = null;
        if (tips[key]){
            var info = tips[key];
            if (info.title)         title = info.title;
            if (!includeTooltip)    return title;
            if (info.description)   tooltip = info.description;
        }

        return <TooltipInfoIconContainer title={title || key} tooltip={tooltip} />;
    }

    /**
    * Recursively render keys/values included in a provided item.
    * Wraps URLs/paths in link elements. Sub-panels for objects.
    *
    * @memberof module:item-pages/components.ItemDetailList.Detail
    * @static
    * @param {Object} schemas - Object containing schemas for server's JSONized object output.
    * @param {Object|Array|string} item - Item(s) to render recursively.
    */
    static formValue(item, popLink = false, keyPrefix = '', atType = 'ExperimentSet', keyTitleDescriptionMap, depth = 0) {
        var schemas = Schemas.get();
        if (item === null){
            return <span>No Value</span>;
        } else if (Array.isArray(item)) {

            if (keyPrefix === 'files_in_set'){
                return (
                    <FilesInSetTable.Small files={item}/>
                );
            }

            console.log('SHOULD USE TABL:E?', SubItemTable.shouldUseTable(item), item);

            if (SubItemTable.shouldUseTable(item)) {
                return <SubItemTable items={item} popLink={popLink} keyTitleDescriptionMap={keyTitleDescriptionMap} parentKey={keyPrefix} />;
            }

            return (
                <ol>
                    {   item.length === 0 ? <li><em>None</em></li>
                        :
                        item.map(function(it, i){
                            return <li key={i}>{ Detail.formValue(it, popLink, keyPrefix, atType, keyTitleDescriptionMap, depth + 1) }</li>;
                        })
                    }
                </ol>
            );
        } else if (typeof item === 'object' && item !== null) {
            var title = getTitleStringFromContext(item);

            // if the following is true, we have an embedded object without significant other data
            if (item.display_title && (typeof item.link_id === 'string' || typeof item['@id'] === 'string') && _.keys(item).length < 4){
                //var format_id = item.link_id.replace(/~/g, "/");
                var link = object.atIdFromObject(item);
                if(popLink){
                    return (
                        <a href={link} target="_blank">
                            {title}
                        </a>
                    );
                } else {
                    return (
                        <a href={link}>
                            { title }
                        </a>
                    );
                }
            } else { // it must be an embedded sub-object (not Item)
                return (
                    <SubItem
                        schemas={schemas}
                        content={item}
                        key={title}
                        title={title}
                        popLink={popLink}
                        keyTitleDescriptionMap={keyTitleDescriptionMap}
                    />
                );
            }
        } else if (typeof item === 'string'){
            if (keyPrefix === '@id'){
                if(popLink){
                    return (
                        <a key={item} href={item} target="_blank">
                            {item}
                        </a>
                    );
                }else{
                    return (
                        <a key={item} href={item}>
                            {item}
                        </a>
                    );
                }
            }
            if(item.indexOf('@@download') > -1/* || item.charAt(0) === '/'*/){
                // this is a download link. Format appropriately
                var split_item = item.split('/');
                var attach_title = decodeURIComponent(split_item[split_item.length-1]);
                return (
                    <a key={item} href={item} target="_blank" download>
                        {attach_title || item}
                    </a>
                );
            } else if (item.charAt(0) === '/') {
                if(popLink){
                    return (
                        <a key={item} href={item} target="_blank">
                            {item}
                        </a>
                    );
                }else{
                    return (
                        <a key={item} href={item}>
                            {item}
                        </a>
                    );
                }
            } else if (item.slice(0,4) === 'http') {
                // Is a URL. Check if we should render it as a link/uri.
                var schemaProperty = Schemas.Field.getSchemaProperty(keyPrefix, schemas, atType);
                if (
                    schemaProperty &&
                    typeof schemaProperty.format === 'string' &&
                    ['uri','url'].indexOf(schemaProperty.format.toLowerCase()) > -1
                ){
                    return (
                        <a key={item} href={item} target="_blank">
                            {item}
                        </a>
                    );
                }
            }
        }
        return(<span>{ item }</span>); // Fallback
    }

    static SubItem = SubItem

    static propTypes = {
        'context' : PropTypes.object.isRequired,
        'keyTitleDescriptionMap' : PropTypes.object
    }

    static defaultProps = {
        'keyTitleDescriptionMap' : null,
        'excludedKeys' : [
            '@context', 'actions', 'audit',
            // Visible elsewhere on page
            'lab', 'award', 'description',
            '@id', 'link_id', 'display_title'
        ],
        'stickyKeys' : [
            // Experiment Set
            'experimentset_type', 'date_released',
            // Experiment
            'experiment_type', 'experiment_summary', 'experiment_sets', 'files', 'filesets',
            'protocol', 'biosample', 'digestion_enzyme', 'digestion_temperature',
            'digestion_time', 'ligation_temperature', 'ligation_time', 'ligation_volume',
            'tagging_method',
            // Biosample
            'biosource','biosource_summary','biosample_protocols','modifications_summary',
            'treatments_summary',
            // File
            'filename', 'file_type', 'file_format', 'href', 'notes', 'flowcell_details',
            // Lab
            'awards', 'address1', 'address2', 'city', 'country', 'institute_name', 'state',
            // Award
            'end_date', 'project', 'uri',
            // Document
            'attachment',
            // Things to go at bottom consistently
            'aliases',
        ],
        'alwaysCollapsibleKeys' : [
            '@type', 'accession', 'schema_version', 'uuid', 'replicate_exps', 'dbxrefs', 'status', 'external_references', 'date_created'
        ],
        'open' : null
    }

    render(){
        var context = this.props.context;
        var sortKeys = _.difference(_.keys(context).sort(), this.props.excludedKeys.sort());
        var schemas = this.props.schemas || Schemas.get();
        var tips = schemas ? object.tipsFromSchema(schemas, context) : {};
        if (typeof this.props.keyTitleDescriptionMap === 'object' && this.props.keyTitleDescriptionMap){
            _.extend(tips, this.props.keyTitleDescriptionMap);
        }

        // Sort applicable persistent keys by original persistent keys sort order.
        var stickyKeysObj = _.object(
            _.intersection(sortKeys, this.props.stickyKeys.slice(0).sort()).map(function(key){
                return [key, true];
            })
        );
        var orderedStickyKeys = [];
        this.props.stickyKeys.forEach(function (key) {
            if (stickyKeysObj[key] === true) orderedStickyKeys.push(key);
        });

        var extraKeys = _.difference(sortKeys, this.props.stickyKeys.slice(0).sort());
        var collapsibleKeys = _.intersection(extraKeys.sort(), this.props.alwaysCollapsibleKeys.slice(0).sort());
        extraKeys = _.difference(extraKeys, collapsibleKeys);
        var popLink = this.props.popLink || false; // determines whether links should be opened in a new tab
        return (
            <PartialList
                persistent={ orderedStickyKeys.concat(extraKeys).map((key,i) =>
                    <DetailRow key={key} label={Detail.formKey(tips,key)} item={context[key]} popLink={popLink} data-key={key} itemType={context['@type'] && context['@type'][0]} keyTitleDescriptionMap={tips}/>
                    /*
                    <PartialList.Row key={key} label={Detail.formKey(tips,key)}>
                        { Detail.formValue(
                            context[key],
                            popLink,
                            key,
                            context['@type'] && context['@type'][0],
                            tips
                        ) }
                    </PartialList.Row>
                    */
                )}
                collapsible={ collapsibleKeys.map((key,i) =>
                    <PartialList.Row key={key} label={Detail.formKey(tips,key)}>
                        { Detail.formValue(
                            context[key],
                            popLink,
                            key,
                            context['@type'] && context['@type'][0],
                            tips
                        ) }
                    </PartialList.Row>
                )}
                open={this.props.open}
            />
        );
    }

}

/**
 * A list of properties which belong to Item shown by ItemView.
 * Shows 'persistentKeys' fields & values stickied near top of list,
 * 'excludedKeys' never, and 'hiddenKeys' only when "See More Info" button is clicked.
 *
 * @class
 * @type {Component}
 */
export class ItemDetailList extends React.Component {

    static Detail = Detail

    static getTabObject(context, schemas = null){
        return {
            tab : <span><i className="icon icon-list-ul icon-fw"/> Details</span>,
            key : 'details',
            content : (
                <div>
                    <h3 className="tab-section-title">
                        <span>Details</span>
                    </h3>
                    <hr className="tab-section-title-horiz-divider"/>
                    <ItemDetailList context={context} schemas={schemas} />
                </div>
            )
        };
    }

    static defaultProps = {
        'showJSONButton' : true
    }

    constructor(props){
        super(props);
        this.seeMoreButton = this.seeMoreButton.bind(this);
        this.componentDidUpdate = this.componentDidUpdate.bind(this);
        this.toggleJSONButton = this.toggleJSONButton.bind(this);
        this.render = this.render.bind(this);
        this.state = {
            'collapsed' : true,
            'showingJSON' : false
        };
    }

    seeMoreButton(){
        if (typeof this.props.collapsed === 'boolean') return null;
        return (
            <button className="item-page-detail-toggle-button btn btn-default btn-block" onClick={()=>{
                this.setState({ collapsed : !this.state.collapsed });
            }}>{ this.state.collapsed ? "See advanced information" : "Hide" }</button>
        );
    }

    componentDidMount(){
        ReactTooltip.rebuild();
    }

    componentDidUpdate(pastProps, pastState){
        if (this.state.showingJSON === false && pastState.showingJSON === true){
            ReactTooltip.rebuild();
        }
    }

    toggleJSONButton(){
        return (
            <button type="button" className="btn btn-block btn-default" onClick={()=>{
                this.setState({ 'showingJSON' : !this.state.showingJSON });
            }}>
                { this.state.showingJSON ?
                    <span><i className="icon icon-fw icon-list"/> View as List</span>
                    :
                    <span><i className="icon icon-fw icon-code"/> View as JSON</span>
                }
            </button>
        );
    }

    buttonsRow(){
        if (!this.props.showJSONButton){
            return (
                <div className="row">
                    <div className="col-xs-12">{ this.seeMoreButton() }</div>
                </div>
            ); 
        }
        return (
            <div className="row">
                <div className="col-xs-6">{ this.seeMoreButton() }</div>
                <div className="col-xs-6">{ this.toggleJSONButton() }</div>
            </div>
        );
    }

    render(){
        var collapsed;
        if (typeof this.props.collapsed === 'boolean') collapsed = this.props.collapsed;
        else collapsed = this.state.collapsed;
        return (
            <div className="item-page-detail" style={typeof this.props.minHeight === 'number' ? { minHeight : this.props.minHeight } : null}>
                { !this.state.showingJSON ?
                    <div className="overflow-hidden">
                        <Detail
                            context={this.props.context}
                            schemas={this.props.schemas}
                            open={!collapsed}
                            keyTitleDescriptionMap={this.props.keyTitleDescriptionMap}
                            excludedKeys={this.props.excludedKeys || Detail.defaultProps.excludedKeys}
                            stickyKeys={this.props.stickyKeys || Detail.defaultProps.stickyKeys}
                        />
                        { this.buttonsRow() }
                    </div>
                    :
                    <div className="overflow-hidden">
                        <div className="json-tree-wrapper">
                            <JSONTree data={this.props.context} />
                        </div>
                        <br/>
                        <div className="row">
                            <div className="col-xs-12 col-sm-6 pull-right">{ this.toggleJSONButton() }</div>
                        </div>
                    </div>
                }

            </div>
        );
    }

}
