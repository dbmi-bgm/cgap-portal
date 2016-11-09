'use strict';

var SingleTreatment = module.exports.SingleTreatment = function(treatment) {
    var treatmentText = '';

    if (treatment.concentration) {
        treatmentText += treatment.concentration + (treatment.concentration_units ? ' ' + treatment.concentration_units : '') + ' ';
    }
    treatmentText += treatment.treatment_term_name + (treatment.treatment_term_id ? ' (' + treatment.treatment_term_id + ')' : '') + ' ';
    if (treatment.duration) {
        treatmentText += 'for ' + treatment.duration + ' ' + (treatment.duration_units ? treatment.duration_units : '');
    }
    return treatmentText;
};


/**
 * Check if JS is processing on serverside, vs in browser (clientside).
 * Adapted from react/node_modules/fbjs/lib/ExecutionEnvironment.canUseDOM()
 *
 * @return {boolean} - True if processing on serverside.
 */
var isServerSide = module.exports.isServerSide = function(){
    if (typeof window == 'undefined' || !window || !window.document || !window.document.createElement){
        return true;
    }
    return false;
}

/**
 * Check if process.env.NODE_ENV is not on 'production'.
 * 
 * @return {boolean} - True if NODE_ENV != 'production'.
 */
var isDebugging = module.exports.isDebugging = function(){
    // process.env.NODE_ENV is set in webpack.config.js if running 'npm run build'
    if (typeof process !== 'undefined' && process.env && process.env.NODE_ENV === 'production') {
        return false;
    }
    return true;
}

/** 
 * Custom patched console for debugging. Only print out statements if debugging/development environment.
 * Prevent potential issues where console might not be available (earlier IE).
 */
var patchedConsole = module.exports.console = (function(){

    if (!isServerSide() && window.patchedConsole) return window.patchedConsole; // Re-use instance if available.
    
    var PatchedConsole = function(){
        this._initArgs = arguments; // arguments variable contains any arguments passed to function in an array.
        this._enabled = true; // Default
        this._available = true;

        if (!console || !console.log) { // Check for seldomly incompatible browsers
            this._available = false;
        }

        if (!isDebugging) {
            this._enabled = false; // Be silent on production.
        }

        this._methods = ['log', 'assert', 'dir', 'error', 'info', 'warn', 'clear', 'profile', 'profileEnd'];
        this._nativeConsole = console;

        this._patchMethods = function(){
            this._methods.forEach(function(methodName){
                if (!(this._enabled && this._available)) {
                    this[methodName] = function(){return false;};
                } else {
                    this[methodName] = this._nativeConsole[methodName];
                }
            }.bind(this));
        }.bind(this);

        // Ability to override, e.g. on production.
        this.on = function(){
            this._enabled = true;
            this._patchMethods();
        }.bind(this);

        this.off = function(){
            this._enabled = false;
            this._patchMethods();
        }.bind(this);

        this._patchMethods();
    }

    var patchedConsole = new PatchedConsole();

    if (!isServerSide()) {
        window.patchedConsole = patchedConsole;
    }
    return patchedConsole;
})();


var setJWTHeaders = function(xhr, headers = {}) { 
    if (typeof headers["Content-Type"] == 'undefined'){
        headers["Content-Type"] = "application/json;charset=UTF-8";
        headers['Accept'] = 'aplication/json';
    }

    var userInfo = localStorage.getItem('user_info') || null;
    var idToken = userInfo ? JSON.parse(userInfo).id_token : null;

    // Add req'd headers if not exist already
    if(userInfo && typeof headers['Authorization'] == 'undefined'){
        headers['Authorization'] = 'Bearer '+idToken;
    }

    // put everything in the header
    var headerKeys = Object.keys(headers);
    for (var i=0; i < headerKeys.length; i++){
        xhr.setRequestHeader(headerKeys[i], headers[headerKeys[i]]);
    }

    return xhr;
}

var ajaxLoad = module.exports.ajaxLoad = function(url, callback, method = 'GET', fallback = null, data = null, headers = {}){
    if (typeof window == 'undefined') return null;
    var xhr = new XMLHttpRequest();
    xhr.onreadystatechange = function() {
        if (xhr.readyState == XMLHttpRequest.DONE ) {
            if (xhr.status == 200) {
                if (typeof callback == 'function'){
                    callback(JSON.parse(xhr.responseText));
                }
            } else if (xhr.status == 400) {
                (patchedConsole || console).error('There was an error 400');
                if (typeof fallback == 'function'){
                    fallback();
                }
            } else {
                (patchedConsole || console).error('Something else other than 200 was returned: ',JSON.parse(xhr.responseText));
                if (typeof fallback == 'function'){
                    fallback();
                }
            }
        }
    };

    xhr.open(method, url, true);
    xhr = setJWTHeaders(xhr, headers);

    if(data){
        xhr.send(data);
    }else{
        xhr.send();
    }
}

var ajaxPromise = module.exports.ajaxPromise = function(url, method, headers = {}, data = null){
    return new Promise(function(resolve, reject) {
        var xhr = new XMLHttpRequest();
        xhr.onload = function() {
            // response SHOULD be json
            resolve(JSON.parse(xhr.responseText));
        };
        xhr.onerror = reject;
        xhr.open(method,url,true);
        xhr = setJWTHeaders(xhr, headers);

        if(data){
            xhr.send(data);
        }else{
            xhr.send();
        }
        return xhr;
    });
}

/**
 * Find property within an object using a propertyName in object dot notation.
 * Recursively travels down object tree following dot-delimited property names.
 * If any node is an array, will return array of results.
 * 
 * @param {Object} object - Item to traverse or find propertyName in.
 * @param {string|string[]} propertyName - (Nested) property in object to retrieve, in dot notation or ordered array.
 * @return {*} - Value corresponding to propertyName.
 */

var getNestedProperty = module.exports.getNestedProperty = function(object, propertyName){

    if (typeof propertyName === 'string') propertyName = propertyName.split('.'); 
    if (!Array.isArray(propertyName)) throw new Error('Using improper propertyName in objectutils.getNestedProperty.');

    return (function findNestedValue(currentNode, fieldHierarchyLevels, level = 0){
        if (level == fieldHierarchyLevels.length) return currentNode;

        if (Array.isArray(currentNode)){
            var arrayVals = [];
            for (var i = 0; i < currentNode.length; i++){
                arrayVals.push( findNestedValue(currentNode[i], fieldHierarchyLevels, level) );
            }
            return arrayVals;
        } else {
            return findNestedValue(
                currentNode[fieldHierarchyLevels[level]],
                fieldHierarchyLevels,
                ++level
            );
        }
    })(object, propertyName);

};


var DateUtility = module.exports.DateUtility = (function(){

    // ToDo : Handle locales (w/ moment)

    // 'require' allows to load code in conditionally, so lets do that here until more funcs require moment.
    var moment = require('moment');

    // Class itself, if need to create non-static instance at some point.
    var DateUtility = function(timestamp = null){};

    // Static Class Methods

    /**
     * Presets for date/time output formats for 4DN.
     * Uses bootstrap grid sizing name convention, so may utilize with responsiveGridState
     * to set responsively according to screen size, e.g. in a (debounced/delayed) window 
     * resize event listener.
     * 
     * @see responsiveGridState
     * @param {string} [formatType] - Key for date/time format to display. Defaults to 'date-md'.
     * @param {string} [dateTimeSeparator] - Separator between date and time if formatting a date-time. Defaults to ' '.
     */
    DateUtility.preset = function(formatType = 'date-md', dateTimeSeparator = " "){

        function date(ft){
            switch(ft){
                case 'date-xs':
                    // 11/03/2016
                    return "MM/DD/YYYY";
                case 'date-sm':
                    // Nov 3rd, 2016
                    return "MMM Do, YYYY";
                case 'date-md':
                    // November 3rd, 2016   (default)
                    return "MMMM Do, YYYY";
                case 'date-lg':
                    // Thursday, November 3rd, 2016
                    return "dddd, MMMM Do, YYYY";
            }
        }

        function time(ft){
            switch(ft){
                case 'time-xs':
                    // 12pm
                    return "ha";
                case 'time-sm':
                case 'time-md':
                    // 12:27pm
                    return "h:mma";
                case 'time-lg':
                    // 12:27:34 pm
                    return "h:mm:ss a";
            }
        }

        if (formatType.indexOf('date-time-') > -1){
            return date(formatType.replace('time-','')) + '[' + dateTimeSeparator + ']' + time(formatType.replace('date-',''));
        } else if (formatType.indexOf('date-') > -1){
            return date(formatType);
        } else if (formatType.indexOf('time-') > -1){
            return time(formatType);
        }
        return null;
    };

    /**
     * Format a timestamp to pretty output. Uses moment.js, which uses Date() object in underlying code.
     * @see DateUtility.preset
     * 
     * @param {string} timestamp - Timestamp as provided by server output. No timezone corrections currently.
     * @param {string} [formatType] - Preset format to use. Ignored if customOutputFormat is provided. Defaults to 'date-md', e.g. "October 31st, 2016".
     * @param {string} [dateTimeSeparator] - Separator between date & time if both are in preset formattype. Defaults to " ".
     * @param {boolean} [localize] - Output in local timezone instead of UTC.
     * @param {string} [customOutputFormat] - Custom format to use in lieu of formatType.
     * @return {string} Prettified date/time output.
     */
    DateUtility.format = function(timestamp, formatType = 'date-md', dateTimeSeparator = " ", localize = false, customOutputFormat = null){
        
        var outputFormat;
        if (customOutputFormat) {
            outputFormat = customOutputFormat;
        } else {
            outputFormat = DateUtility.preset(formatType, dateTimeSeparator);
        }
        
        if (localize){
            return moment.utc(timestamp).local().format(outputFormat);
        }

        return moment.utc(timestamp).format(outputFormat);
    };

    return DateUtility;
})();


/**
 * Check width of text or text-like content if it were to fit on one line.
 * @param {string} textContent - Either text or text-like content, e.g. with span elements.
 * @param {string} [containerElementType] - Type of element to fit into, e.g. 'div' or 'p'.
 * @param {string} [containerClassName] - ClassName of containing element, e.g. with 'text-large' to use larger text size.
 * @param {integer} [widthForHeightCheck] - If provided, will return an object which will return height of text content when constrained to width.
 * @return {integer|Object} - Width of text if whitespace style set to nowrap, or object containing 'containerHeight' & 'textWidth' if widthForHeightCheck is set.
 */
var textContentWidth = module.exports.textContentWidth = function(
    textContent,
    containerElementType = 'div',
    containerClassName = '',
    widthForHeightCheck = null
){
    if (isServerSide()){
        return null;
    };
    var contElem = document.createElement(containerElementType);
    contElem.className = "off-screen " + containerClassName;
    contElem.innerHTML = textContent;
    contElem.style.whiteSpace = "nowrap";
    document.body.appendChild(contElem);
    var textLineWidth = contElem.clientWidth;
    var fullContainerHeight;
    if (widthForHeightCheck){
        contElem.style.whiteSpace = "";
        contElem.style.display = "block";
        contElem.style.width = widthForHeightCheck + "px";
        fullContainerHeight = contElem.clientHeight;
    }
    document.body.removeChild(contElem);
    if (fullContainerHeight) {
        return { containerHeight : fullContainerHeight, textWidth : textLineWidth };
    }
    return textLineWidth;
}

/**
 * Get the width of what a 12-column bootstrap section would be in current viewport size.
 * Keep widths in sync with stylesheet, e.g. 
 * $container-tablet - $grid-gutter-width, 
 * $container-desktop - $grid-gutter-width, and
 * $container-large-desktop - $grid-gutter-width 
 * in src/encoded/static/scss/bootstrap/_variables.scss.
 *
 * @return {integer}
 */
var gridContainerWidth = module.exports.gridContainerWidth = function(){
    // Subtract 20 for padding/margins.
    switch(responsiveGridState()){
        case 'lg': return 1140;
        case 'md': return 940;
        case 'sm': return 720;
        case 'xs':
            if (isServerSide()) return 400;
            return window.innerWidth - 20;
    }

};

/**
 * Get current grid size, if need to sidestep CSS.
 * Keep widths in sync with stylesheet, e.g. $screen-sm-min, $screen-md-min, & $screen-lg-min
 * in src/encoded/static/scss/bootstrap/_variables.scss.
 *
 * @return {string} - Abbreviation for column/grid Bootstrap size, e.g. 'lg', 'md', 'sm', or 'xs'.
 */

var responsiveGridState = module.exports.responsiveGridState = function(){
    if (isServerSide()) return 'lg';
    if (window.innerWidth >= 1200) return 'lg';
    if (window.innerWidth >= 992) return 'md';
    if (window.innerWidth >= 768) return 'sm';
    return 'xs';
};
