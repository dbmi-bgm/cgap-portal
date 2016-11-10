'use strict';

var React = require('react');
var _ = require('underscore');
var store = require('../store');
var { ajaxLoad, console, getNestedProperty } = require('./objectutils');

/**
 * FieldSet allows to group EditableFields together.
 * Will apply pass props to all child EditableFields which it wraps, including 
 * context (JSON graph/output from server) and parent, if any.
 * Can also act as host of state.currentlyEditing (== props.labelID of 
 * current EditableField being edited, if any) if props.parent is not supplied.
 * 
 * @see EditableField
 */

var FieldSet = module.exports.FieldSet = React.createClass({

    propTypes : {
        children : React.PropTypes.node,    // Inner fieldset content, should have at least 1 EditableField, probably more.
        context : React.PropTypes.object,   // JSON graph/output from server representing page data. Passed to child EditableFields.
        endpoint : React.PropTypes.string,  // Override context['@id'] (if doesn't exist, dif endpoint, etc.)
        inputSize : React.PropTypes.oneOf(['sm', 'md', 'lg']),
        style : React.PropTypes.oneOf(['row', 'minimal', 'inline']),
        parent : React.PropTypes.any,       // Pass a parent React component, i.e. supply 'this' from a parent's render method, 
                                            // to have it act as host of state.currentlyEditing. Use when there are other EditableFields
                                            // available on view/page which act on same props.context but not all within this FieldSet.
        className : React.PropTypes.string  // Additional className to prepend.
    },

    getDefaultProps : function(){
        return {
            parent : null, // if null, use own state
            context : {},
            className : '',
            endpoint : null
        };
    },

    children : null,
    childrenIDs : [],

    componentWillMount : function(){
        this.children = this.adjustedChildren();
        this.childrenIDs = this.getChildrenIDs();
    },

    componentWillUpdate : function(newProps){
        if (this.props.children !== newProps.children){
            this.children = this.adjustedChildren();
            this.childrenIDs = this.getChildrenIDs();
        }
    },

    adjustedChildren : function(){
        // Add common props to children EditableField elements.
        return React.Children.map(this.props.children, (child)=>{
            if (child.type.displayName == 'EditableField'){
                var newProps = {};
                if (!child.props.context || _.isEmpty(child.props.context)) newProps.context = this.props.context;
                if (!child.props.parent) newProps.parent = this.props.parent || this;
                if (!child.props.endpoint && this.props.endpoint) newProps.endpoint = this.props.endpoint;
                if (!child.props.inputSize && this.props.inputSize) newProps.inputSize = this.props.inputSize;
                if (!child.props.style && this.props.style) newProps.style = this.props.style;
                child = React.cloneElement(child, newProps);
            };
            return child;
        });
    },

    getChildrenIDs : function(){
        return React.Children.map((this.children || this.props.children), (child) => child.props.labelID );
    },

    fullClassName : function(){
        var stateHolder = this.props.parent || this; // Fallback to using self as state holder.
        return (
            this.props.className + 
            " editable-fields fieldset" + 
            (
                stateHolder.state && 
                stateHolder.state.currentlyEditing && 
                this.childrenIDs.indexOf(stateHolder.state.currentlyEditing) > -1 ? 
                    ' editing' : ''
            )
        );
    },

    render : function(){
        return (
            <div className={this.fullClassName()}>
                { this.children }
            </div>
        );
    }

});

/**
 * Display a field which may be edited & saved to server.
 * Currently can only be used on pages/views which have a context, i.e. JSON graph/output
 * from server, and only edit fields in that context.
 * 
 * @see EditableField.propTypes for more info of props to provide.
 */
var EditableField = module.exports.EditableField = React.createClass({

    statics : {
        regex : {
            // http://www.regular-expressions.info/email.html -> changed capital A to lowercase
            email : '^[a-Z0-9][a-Z0-9._%+-]{0,63}@(?:(?=[a-Z0-9-]{1,63}\.)[a-Z0-9]+(?:-[a-Z0-9]+)*\.){1,8}[a-Z]{2,63}$',
            // Digits only, with optional extension (space + x, ext, extension + [space?] + 1-7 digits) and 
            // optional leading plus sign (for international)
            phone : '[+]?[\\d]{10,36}((\\sx|\\sext|\\sextension)(\\s)?[\\d]{1,7})?$'
        },

        /**
         * Sets value to be deeply nested within an otherwise empty object, given a field with dot notation.
         * Use for creating objects for PATCH requests. Does not currently support arrays.
         * If want to update a full object rather than create an empty one, use @see EditableField.deepInsertObj with output.
         * 
         * @param {string|string[]} field - Property name of object of where to nest value, in dot-notation or pre-split into array.
         * @param {*} value - Any value to nest.
         * @returns {Object} - Object with deepy-nested value.
         * @example 
         *   EditableField.generateNestedProperty('human.body.leftArm.indexFinger', 'Orange') returns
         *   { human : { body : { leftArm : { indexFinger : 'Orange' } } } }
         */
        generateNestedProperty : function(field, value){
            if (typeof field === 'string') field = field.split('.');
            if (!Array.isArray(field)) throw new Error("Could not create nested field in object. Check field name.");

            var currObj = {};
            currObj[field.pop()] = value;

            if (field.length === 0) return currObj;
            return EditableField.generateNestedProperty(field, currObj);
        },

        /**
         * Performs a 'deep merge' of a small object (one property per level, max) into a host object.
         */
        deepInsertObj : function(hostObj, nestedObj, depth = 0){
            var nKey = Object.keys(nestedObj)[0]; // Should only be 1.
            if (depth > 10){
                // Doubt we'd go this deep... so cancel out
                return false;
            }
            if (typeof hostObj[nKey] !== 'undefined'){
                if (typeof nestedObj[nKey] === 'object' && !Array.isArray(hostObj[nKey]) ){
                    return EditableField.deepInsertObj(hostObj[nKey], nestedObj[nKey], depth + 1);
                } else {
                    // No more nested objects, insert here.
                    hostObj[nKey] = nestedObj[nKey];
                    return true;
                }
            } else if (typeof nestedObj[nKey] !== 'undefined') {
                // Field doesn't exist on hostObj, but does on nestedObj, == new field.
                hostObj[nKey] = nestedObj[nKey];
                return true;
            } else {
                // Whoops, doesn't seem like fields match.
                return false;
            }
        }
    },

    contextTypes: {
        navigate: React.PropTypes.func
    },

    propTypes : {
        label : React.PropTypes.string,
        labelID : React.PropTypes.string,   // Property in context to be edited. Allows dot notation for nested values.
        parent : React.PropTypes.any,       // Holds 'currentlyEditing' state (== labelID of field being edited.)
        fallbackText : React.PropTypes.string, // Fallback text to display when no value is set/available.
        context : React.PropTypes.object,   // ToDo : validate context obj has property labelID.
        endpoint : React.PropTypes.string,  // Endpoint to PATCH update to. Defaults to props.context['@id'] if not set.
        fieldType : React.PropTypes.string, // Type of field, used for rendering of input element & validation.
        style : React.PropTypes.string,     // Markup style, e.g. render row with label (default), minimal (just input field w/ buttons).
        inputSize : React.PropTypes.oneOf(['sm', 'md', 'lg']), // Size of Bootstrap input field to use. Defaults to sm.
        children : React.PropTypes.any      // Rendered value of field, use custom formatting on a per-field basis. ToDo : create fallback.
    },

    getDefaultProps : function(){
        return {
            fieldType : 'text',
            context : {},
            fallbackText : 'Not set',
            style : 'row',
            inputSize : 'sm',
            parent : null
        };
    },

    getInitialState : function(){
        var value = getNestedProperty(this.props.context, this.props.labelID);
        console.log('VALUE', value);
        return {
            'value' : value || null,      // Changes on input field change
            'savedValue' : value || null, // Changes only on sync w/ server.
            'serverErrors' : [],          // Validation state sent from server.
            'serverErrorsMessage' : null,
            'loading' : false             // True if in middle of save or fetch request.
        };
    },

    componentWillReceiveProps : function(newProps){
        if (
            (this.props.context !== newProps.context) ||
            (this.props.labelID !== newProps.labelID)
        ) {
            var value = getNestedProperty(this.props.context, this.props.labelID);
            this.setState({ 'value' : value || null, 'savedValue' : value || null });
        }
    },

    isSet : function(){ return typeof this.props.context !== 'undefined' && this.state.savedValue !== null; },

    enterEditState : function(e){
        e.preventDefault();
        if (this.props.parent.state && this.props.parent.state.currentlyEditing) return null;
        this.props.parent.setState({ currentlyEditing : this.props.labelID });
    },

    cancelEditState : function(e){
        e.preventDefault();
        if (!this.props.parent.state || !this.props.parent.state.currentlyEditing) {
            throw new Error('No state was set on parent.');
        }
        this.props.parent.setState({ currentlyEditing : null });
    },

    isValid : function(checkServer = false){
        if (typeof this.state.valid === 'boolean' && !this.state.valid){
            return false;
        };
        if (checkServer && this.state.serverErrors && this.state.serverErrors.length > 0) {
            return false;
        }
        return true;
    },

    saveEditState : function(e){
        e.preventDefault();
        if (!this.isValid()){
            // ToDo : Bigger notification to end user that something is wrong.
            console.error("Cannot save " + this.props.labelID + "; value is not valid:", this.state.value);
            return;
        }  

        this.save(()=>{
            // Success callback
            this.props.parent.setState({ currentlyEditing : null }, ()=> {
                console.info("Saved " + this.props.labelID + " : " + this.state.savedValue);
            });
        });
    },

    fetch : function(){
        ajaxLoad(this.props.endpoint || this.props.context['@id'], (r)=>{
            var val = getNestedProperty(r, this.props.labelID);
            this.setState({ value : val, savedValue : val });
        }, 'GET');
    },

    save : function(successCallback = null, errorCallback = null){

        this.setState({ loading : true }, ()=>{
            var patchData = EditableField.generateNestedProperty(this.props.labelID, this.state.value);
            ajaxLoad(this.props.endpoint || this.props.context['@id'], (r)=>{
                if (r.status === 'error'){
                    // ToDo display errors
                    console.error("Error: ", r);
                    this.setState({ serverErrors : r.errors, serverErrorsMessage : r.description, loading : false }, errorCallback);
                    return;
                } else if (r.status === 'success') {
                    // Update context (yes, tis modifying a prop)
                    var updatedContext = _.clone(this.props.context);
                    var inserted = EditableField.deepInsertObj(updatedContext, patchData);
                    console.log(patchData, updatedContext);
                    if (inserted){
                        store.dispatch({
                            type: { 'context': updatedContext }
                        });
                        this.setState({ savedValue : this.state.value, loading : false }, ()=> {
                            if (typeof successCallback === 'function') successCallback(r);
                        });
                    } else {
                        // Couldn't insert into current context, refetch from server :s.
                        console.warn("Couldn't update current context, fetching from server.");
                        this.context.navigate('', {'inPlace':true});
                        // ToDo : ...navigate(inPlace)...
                    }
                }
            }, 'PATCH', null, JSON.stringify(patchData));
        });
    },

    handleChange : function(e){
        var state = { value : e.target.value };
        if (e.target.validity){
            if (typeof e.target.validity.valid == 'boolean') {
                state.valid = e.target.validity.valid;
            }
        }
        if (e.target.validationMessage){
            state.validationMessage = e.target.validationMessage;
        }
        // ToDo : cross-browser validation check + set error state then use for styling, etc.
        this.setState(state);
    },

    renderActionIcon : function(type = 'edit'){

        var extClass = "right";
        if (this.props.style === 'inline') extClass = "inline";

        if (this.state.loading){
            switch (type){
                case 'save' : return null;
                case 'cancel' : return (
                    <span className={extClass + " field-loading-icon"}>
                        <i className="icon icon-spin icon-circle-o-notch icon-fw"></i>
                    </span>
                );
            }
        }

        switch (type){
            case 'edit' : 
                if (this.props.disabled) {
                    if (!this.props.info) return null;
                    // ToDo info popup or tooltip
                    return (
                        <span className={extClass + " edit-button info disabled"}>
                            <i className="icon icon-info-circle icon-fw"></i>
                        </span>
                    );
                }
                return (
                    <a href={ "#edit-" + this.props.labelID } className={extClass + " edit-button"} onClick={ this.enterEditState } title="Edit">
                        <i className="icon icon-pencil icon-fw"></i>
                    </a>
                );
            case 'save' :
                if (!this.isValid(false)) return null;
                return (
                    <a href={ "#save-" + this.props.labelID } className={extClass + " save-button"} onClick={this.saveEditState} title="Save">
                        <i className="icon icon-save icon-fw"></i>
                    </a>
                );
            case 'cancel': return (
                <a href="#" className={extClass + " cancel-button"} onClick={this.cancelEditState} title="Cancel">
                    <i className="icon icon-times-circle-o icon-fw"></i>
                </a>
            );
        }
    },

    renderSaved : function(){
        var renderedValue = this.props.children || this.state.savedValue;

        if (this.props.style === 'row'){
            return (
                <div className={"row editable-field-entry " + this.props.labelID}>
                    <div className="col-sm-3 text-right text-left-xs">
                        <label htmlFor={ this.props.labelID }>{ this.props.label }</label>
                    </div>
                    <div className="col-sm-9 value">
                        { this.renderActionIcon('edit') }
                        { this.isSet() ?
                            <span id={ this.props.labelID } className="set">{ renderedValue }</span>
                            :
                            <span className="not-set">{ this.props.fallbackText || ('No ' + this.props.labelID) }</span> 
                        }
                    </div>
                </div>
            );
        }
        if (this.props.style === 'minimal'){
            return (
                <div className={"editable-field-entry " + this.props.labelID}>
                    <div className="value">
                        { this.renderActionIcon('edit') }
                        { this.isSet() ?
                            <span id={ this.props.labelID } className="set">{ renderedValue }</span>
                            :
                            <span className="not-set">{ this.props.fallbackText || ('No ' + this.props.labelID) }</span> 
                        }
                    </div>
                </div>
            );
        }
        if (this.props.style === 'inline'){
            return (
                <span className={"editable-field-entry " + this.props.labelID}>
                    <span className="value">
                        { this.isSet() ?
                            <span id={ this.props.labelID } className="set">{ renderedValue }</span>
                            :
                            <span className="not-set">{ this.props.fallbackText || ('No ' + this.props.labelID) }</span> 
                        }
                        { this.renderActionIcon('edit') }
                    </span>
                </span>
            );
        }

    },

    validationFeedbackMessage : function(){
        //if (this.isValid(true)) return null;
        // ^ Hide via CSS instead.
        switch(this.props.fieldType){

            case 'phone': return (
                <span className="help-block">
                    Only use digits &mdash; no dashes, spaces, or parantheses.
                    Optionally may include leading '+' or extension.<br/>
                    <b>e.g.:</b> <code>+######### x###</code>
                </span>
            );
            case 'email': return (
                <span className="help-block">
                    Please enter a valid email address.
                </span>
            );
            case 'username' : return (
                null
            );
            case 'text' : return (
                null
            );
        }
    },

    inputField : function(){
        // ToDo : Select boxes, radios, checkboxes, etc.
        var commonProps = {
            id : this.props.labelID,
            required : this.props.required || false,
            disabled : this.props.disabled || false
        };
        var commonPropsTextInput = _.extend({
            className : 'form-control input-' + this.props.inputSize,
            value : this.state.value || '',
            onChange : this.handleChange,
            name : this.props.labelID
        }, commonProps);

        switch(this.props.fieldType){

            case 'phone': return (
                <span className="input-wrapper">
                    <input type="text" placeholder="17775559999 x1234" inputMode="tel" autoComplete="tel" pattern={EditableField.regex.phone} {...commonPropsTextInput} />
                    { this.validationFeedbackMessage() }
                </span>
            );
            case 'email': return (
                <span className="input-wrapper">
                    <input type="email" autoComplete="email" pattern={EditableField.regex.email} {...commonPropsTextInput} />
                    { this.validationFeedbackMessage() }
                </span>
            );
            case 'username' : return (
                <span className="input-wrapper">
                    <input type="text" inputMode="latin-name" autoComplete="username" {...commonPropsTextInput} />
                </span>
            );
            case 'text' : return (
                <span className="input-wrapper">
                    <input type="text" inputMode="latin" {...commonPropsTextInput} />
                </span>
            );
        }
        // Fallback (?)
        return <span>No edit field created yet.</span>;
    },

    renderEditing : function(){
        
        var outerBaseClass = "editable-field-entry editing has-feedback" + 
            (!this.isValid(true) ? ' has-error ' : ' has-success ') +
            ('input-size-' + this.props.inputSize + ' ');

        if (this.props.style == 'row') {
            return (
                <div className={outerBaseClass + this.props.labelID + ' row'}>
                    <div className="col-sm-3 text-right text-left-xs">
                        <label htmlFor={ this.props.labelID }>{ this.props.label }</label>
                    </div>
                    <div className="col-sm-9 value editing">
                        { this.renderActionIcon('cancel') }
                        { this.renderActionIcon('save') }
                        { this.inputField() }
                    </div>
                </div>
            );
        }

        if (this.props.style == 'minimal') {
            return (
                <div className={ outerBaseClass + this.props.labelID }>
                    <div className="value editing">
                        { this.renderActionIcon('cancel') }
                        { this.renderActionIcon('save') }
                        { this.inputField() }
                    </div>
                </div>
            );
        }

        if (this.props.style == 'inline') {
            return (
                <span className={ outerBaseClass + this.props.labelID + ' inline' }>
                    <span className="value editing clearfix">
                        { this.inputField() }
                        { this.renderActionIcon('cancel') }
                        { this.renderActionIcon('save') }
                    </span>
                </span>
            );
        }

    },

    render : function(){
        if (this.props.parent && this.props.parent.state && this.props.parent.state.currentlyEditing === this.props.labelID) {
            return this.renderEditing();
        } else {
            return this.renderSaved();
        }
    }

});