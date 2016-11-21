var React = require('react');
var url = require('url');
var queryString = require('query-string');
var _ = require('underscore');
var store = require('../store');
var { ajaxLoad, getNestedProperty, console } = require('./objectutils');


/**
 * Used to render individual terms in FacetList.
 * Available through FacetList.Facet.ExpTerm
 */
var ExpTerm = React.createClass({

    statics : {

        getPassExpsCount : function(termMatchExps, allExpsOrSets, expsOrSets = 'sets'){
            var numPassed = 0;

            if (expsOrSets == 'sets'){
                allExpsOrSets.forEach(function(expSet){
                    for (var i=0; i < expSet.experiments_in_set.length; i++){
                        if (termMatchExps.has(expSet.experiments_in_set[i])) {
                            numPassed++;
                            return;
                        }
                    }
                }, this);
            } else {
                // We have just list of experiments, not experiment sets.
                for (var i=0; i < allExpsOrSets.length; i++){
                    if (termMatchExps.has(allExpsOrSets[i])) numPassed++;
                }
            }

            return numPassed;
        },

        standardizeFieldKey : function(field, expsOrSets = 'sets', reverse = false){
            if (expsOrSets === 'experiments' && field !== 'experimentset_type'){
                // ToDo: arrays of expSet- and exp- exclusive fields
                if (reverse){
                    return field.replace('experiments_in_set.', '');
                }
                return 'experiments_in_set.' + field;
            } else {
                return field;
            }
        },

        /* Use as a mixin (i.e. func.call(this, termKey, facetField, expsOrSets) ) in components with access to this.props.expSetFilters */
        isSelected : function(
            termKey     = (this.state.term || this.props.term || {key:null}).key,
            facetField  = (this.state.facet || this.props.facet || {field:null}).field,
            expsOrSets  = this.props.experimentsOrSets || 'sets'
        ){
            var standardizedFieldKey = ExpTerm.standardizeFieldKey(facetField, expsOrSets);
            if (
                this.props.expSetFilters[standardizedFieldKey] && 
                this.props.expSetFilters[standardizedFieldKey].has(termKey)
            ){
                return true;
            }
            return false;
        }

    },

    propTypes : {
        'facet' : React.PropTypes.shape({
            'field' : React.PropTypes.string.isRequired
        }).isRequired,
        'term' : React.PropTypes.shape({
            'key' : React.PropTypes.string.isRequired
        }).isRequired,
        expSetFilters : React.PropTypes.object.isRequired,
        experimentsOrSets : React.PropTypes.string
    },

    getDefaultProps : function(){
        return {
            experimentsOrSets : 'sets'
        };
    },

    getInitialState: function() {

        // Bind isSelected (vs passing params) as needs no extraneous params
        this.isSelected = ExpTerm.isSelected.bind(this);

        /** 
         * props.expSetFilters uses standardized fieldKeys/props.facet.field while
         * experiment tables & facets do not. Props provided through props.facet 
         * are un-standardized, so run them through standardizeFieldKey() before
         * checking if in expSetFilters (e.g. as in ExpTerm.isSelected() ).
         */
        var termMatchExps = FacetList.siftExperiments(
            this.props.experimentSetListJSON,
            this.props.expSetFilters,
            this.props.ignoredFilters,
            this.props.facet.field,
            this.props.term.key
        );

        return {
            termMatchExps : termMatchExps,
            passExpsCount : this.getPassExpsCount(termMatchExps),
            filtering : false
        }
    },

    componentWillReceiveProps : function(newProps){
        var newState = {};
        if (
            // Probably only expSetFilters would change (re: faceting) but add other checks to be safe.
            newProps.term.key !== this.props.term.key ||
            newProps.facet.field !== this.props.facet.field ||
            newProps.expSetFilters !== this.props.expSetFilters ||
            newProps.ignoredFilters !== this.props.ignoredFilters ||
            !FacetList.compareExperimentLists(newProps.experimentSetListJSON, this.props.experimentSetListJSON)
        ){

            newState.termMatchExps = FacetList.siftExperiments(
                newProps.experimentSetListJSON || this.props.experimentSetListJSON,
                newProps.expSetFilters || this.props.expSetFilters,
                newProps.ignoredFilters || this.props.ignoredFilters,
                (newProps.facet || this.props.facet).field,
                (newProps.term || this.props.term).key
            );

            newState.passExpsCount = this.getPassExpsCount(newState.termMatchExps, newProps.experimentSetListJSON || this.props.experimentSetListJSON);
        }

        if (Object.keys(newState).length > 0){
            this.setState(newState);
        }

    },

    // Correct field to match that of browse page (ExpSet)
    standardizeFieldKey : function(field = this.props.facet.field, reverse = false){
        return ExpTerm.standardizeFieldKey(field, this.props.experimentsOrSets, reverse);
    },

    // find number of experiments or experiment sets
    getPassExpsCount : function(termMatchExps = this.state.termMatchExps, allExperiments = this.props.experimentSetListJSON){
        return ExpTerm.getPassExpsCount(termMatchExps, allExperiments, this.props.experimentsOrSets);
    },

    handleClick: function(e) {
        e.preventDefault();
        this.setState(
            { filtering : true },
            () => {
                this.props.changeFilters(
                    this.props.facet.field,
                    this.props.term.key,
                    ()=> {
                        this.setState({ filtering : false })
                    }
                )
            }
        );
    },

    render: function () {

        var standardizedFieldKey = this.standardizeFieldKey();
        //var expCount = this.state.termMatchExps.size;
        var selected = this.isSelected();
        return (
            <li className={"facet-list-element" + (selected ? " selected" : '')} key={this.props.term.key}>
                <a className={"term" + (selected ? " selected" : '')} href="#" onClick={this.handleClick}>
                    <span className="pull-left facet-selector">
                        { this.state.filtering ?
                            <i className="icon icon-circle-o-notch icon-spin icon-fw"></i>
                            : selected ? 
                                <i className="icon icon-times-circle icon-fw"></i>
                                : '' }
                    </span>
                    <span className="facet-item">
                        { this.props.title || this.props.term.key }
                    </span>
                    <span className="pull-right facet-count">{this.state.passExpsCount}</span>
                </a>
            </li>
        );
    }
});


/**
 * Used to render individual facet fields and their option(s) in FacetList.
 * Available through FacetList.Facet
 */
var Facet = React.createClass({

    statics : {
        ExpTerm : ExpTerm // Allow access to ExpTerm thru Facet.ExpTerm
    },

    propTypes : {
        'facet' : React.PropTypes.shape({
            'field' : React.PropTypes.string.isRequired,    // Name of nested field property in experiment objects, using dot-notation.
            'title' : React.PropTypes.string,               // Human-readable Facet Term
            'total' : React.PropTypes.number,               // Total experiments (or terms??) w/ field
            'terms' : React.PropTypes.array.isRequired      // Possible terms
        }),
        experimentSetListJSON : React.PropTypes.array,
        expSetFilters : React.PropTypes.object.isRequired,
        ignoredFilters : React.PropTypes.object,
        changeFilters : React.PropTypes.func.isRequired,    // Executed on term click
        experimentsOrSets : React.PropTypes.string,         // Defaults to 'sets'
        width : React.PropTypes.any
    },

    getDefaultProps: function() {
        return {
            width: 'inherit'
        };
    },
    
    getInitialState: function () {
        this.isSelected = this.isStatic() ? 
            Facet.ExpTerm.isSelected.bind(this, this.props.facet.terms[0].key) : () => false;
        return {
            facetOpen: false
        };
    },

    isStatic: function(props = this.props){ return !!(props.facet.terms.length === 1); },
    isEmpty: function(props = this.props){ return !!(props.facet.terms.length === 0); },

    /*
    handleClick: function (e) {
        e.preventDefault();
        this.setState({facetOpen: !this.state.facetOpen});
    },
    */

    handleStaticClick: function(e) {
        e.preventDefault();
        if (!this.isStatic()) return false;
        this.setState(
            { filtering : true },
            () => {
                this.props.changeFilters(
                    this.props.facet.field,
                    this.props.facet.terms[0].key,
                    ()=> {
                        this.setState({ filtering : false })
                    }
                )
            }
        );
    },

    render: function() {
        var facet = this.props.facet;
        var standardizedFieldKey = FacetList.Facet.ExpTerm.standardizeFieldKey(facet.field, this.props.experimentsOrSets);
        var selected = this.isSelected();
        if (this.isStatic()){ 
            // Only one term
            return (
                <div
                    className={"facet static row" + (selected ? ' selected' : '')}
                    style={{width: this.props.width}}
                    data-field={standardizedFieldKey}
                    title={
                        'All ' + (this.props.experimentsOrSets === 'sets' ? 'experiment sets' : 'experiments') +
                        ' have ' + facet.terms[0].key + ' as their ' + (facet.title || facet.field ).toLowerCase() + '; ' +
                        (selected ? 'currently active as portal-wide filter.' : 'not currently active as portal-wide filter.')
                    }
                >
                    <div className="facet-static-row clearfix">
                        <h5 className="facet-title">
                            { facet.title || facet.field }
                        </h5>
                        <div className={"facet-item term" + (selected? ' selected' : '')}>
                            <span>
                                <i className={
                                    "icon icon-fw icon-circle"
                                }></i>{ facet.terms[0].key }
                            </span>
                        </div>
                    </div>
                </div>
            );
        }

        // List of terms
        return (
            <div className="facet row" hidden={false/*this.isEmpty()*/} data-field={standardizedFieldKey}>
                <h5 className="facet-title">{ facet.title || facet.field }</h5>
                <div className="facet-list nav">
                    <div>
                        { facet.terms.map(function (term) {
                            return <Facet.ExpTerm {...this.props} key={term.key} term={term} total={facet.total}/>;
                        }.bind(this))}
                    </div>
                </div>
            </div>
        );

    }
});

/**
 * FacetList - Exported
 */

var FacetList = module.exports = React.createClass({

    statics : {

        // Include sub-components as static (sub-)properties of main FacetList
        Facet : Facet,

        /**
         * Adds a restrictions property to each facet from restrictions object
         * and uses it to filter terms.
         * 
         * @param {Object[]} origFacets - Array of initial facets; should have terms already.
         * @param {Object} [restrictions] - Object containing restricted facet fields as property names and arrays of term keys as values.
         */
        adjustedFacets : function(origFacets, restrictions = {}){
            return origFacets.map(function(facet){
                if (restrictions[facet.field] !== undefined) {
                    facet = _.clone(facet);
                    facet.restrictions = restrictions[facet.field];
                    facet.terms = facet.terms.filter(term => _.contains(facet.restrictions, term.key));
                }
                return facet;
            });
        },

        siftExperiments : function(graph, filters, ignored=null, field=null, term=null) {
            var passExperiments = new Set();
            // Start by adding all applicable experiments to set
            for(var i=0; i < graph.length; i++){
                if(graph[i].experiments_in_set){
                    for(var j=0; j < graph[i].experiments_in_set.length; j++){
                        passExperiments.add(graph[i].experiments_in_set[j]);
                    }
                } else {
                    passExperiments.add(graph[i]);
                }
            }
            // search through currently selected expt filters
            var filterKeys = Object.keys(filters);
            if (field && !_.contains(filterKeys, field)){
                filterKeys.push(field);
            }
            for(let experiment of passExperiments){
                var eliminated = false;
                for(var k=0; k < filterKeys.length; k++){
                    var refinedFilterSet;
                    if(ignored && ignored[filterKeys[k]] && ignored[filterKeys[k]].size > 0){
                        // remove the ignored filters by using the difference between sets
                        var difference = new Set([...filters[filterKeys[k]]].filter(x => !ignored[filterKeys[k]].has(x)));
                        refinedFilterSet = difference;
                    }else{
                        refinedFilterSet = filters[filterKeys[k]];
                    }
                    if(eliminated){
                        break;
                    }
                    var valueProbe = experiment;
                    var filterSplit = filterKeys[k].split('.');
                    for(var l=0; l < filterSplit.length; l++){
                        if(filterSplit[l] === 'experiments_in_set'){
                            continue;
                        }
                        // for now, use first item in an array (for things such as biosamples)
                        if(Array.isArray(valueProbe)){
                            valueProbe = valueProbe[0];
                        }
                        if(valueProbe[filterSplit[l]]){
                            valueProbe = valueProbe[filterSplit[l]];
                            if(l === filterSplit.length-1){ // last level of filter
                                if(field && filterKeys[k] === field){
                                    if(valueProbe !== term){
                                        eliminated = true;
                                        passExperiments.delete(experiment);
                                    }
                                }else if(refinedFilterSet.size > 0 && !refinedFilterSet.has(valueProbe)){ // OR behavior if not active field
                                    eliminated = true;
                                    passExperiments.delete(experiment);
                                }
                            }
                        }else{
                            if(filterKeys[k] !== field && refinedFilterSet.size > 0){
                                eliminated = true;
                                passExperiments.delete(experiment);
                                break;
                            }else{
                                break;
                            }
                        }
                    }
                }
            }

            return passExperiments;
        },

        /**
         * Unsets any 'terms' or 'total' properties on facets.
         * Modifies facets param in place, does not clone/copy/create new one(s).
         * 
         * @param {Object[]} facets - List of facets.
         */
        resetFacetTermsAndCounts : function(facets){
            facets.forEach(function(facet,i,a){
                delete facet.terms;
                delete facet.total;
            });
        },

        /**
         * Fills facet objects with 'terms' and 'total' properties, as well as terms' counts.
         * Modifies incompleteFacets param in place (to turn them into "complete" facets).
         *
         * @param {Object[]} incompleteFacets - Array of facet objects. Each should have field and title keys/values.
         * @param {Object[]} exps - Array of experiment objects, obtained from @graph or experiments_in_set property on context.
         */
        fillFacetTermsAndCountFromExps : function(incompleteFacets, exps){

            incompleteFacets.forEach(function(facet, facetIndex){

                var fieldHierarchyLevels = facet.field.split('.'); // E.g. [biosample, biosource, individual,..]
                var termCounts = {};

                // Loop through experiments to find all terms and counts per term.
                for (var i = 0; i < exps.length; i++){

                    var facetTerm = getNestedProperty(exps[i], fieldHierarchyLevels);

                    if (Array.isArray(facetTerm)) {
                        for (var j = 0; j < facetTerm.length; j++){
                            if (!termCounts.hasOwnProperty(facetTerm[j])) termCounts[facetTerm[j]] = 0;
                            termCounts[facetTerm[j]]++;
                        }
                    } else {
                        if (!termCounts.hasOwnProperty(facetTerm)) termCounts[facetTerm] = 0;
                        termCounts[facetTerm]++;
                    }

                }

                facet.total = 0;
                facet.terms = Object.keys(termCounts).map(function(term,i,a){
                    facet.total += termCounts[term];
                    return {
                        'key' : term,
                        'doc_count' : termCounts[term]
                    };
                });

            }, this);

        },

        /**
         * Find filters to ignore - i.e. filters which are set in expSetFilters but are
         * not present in facets.
         * 
         * @param {Object[]} facets - Array of complete facet objects (must have 'terms' & 'fields' properties).
         * @param {Object} expSetFilters - Object containing facet fields and their enabled terms:
         *     '{string} Field in item JSON hierarchy, using object dot notation : {Set} terms'.
         * 
         * @return {Object} The filters which are ignored. Object looks like expSetFilters.
         */
        findIgnoredFilters : function(facets, expSetFilters){
            var ignoredFilters = {};
            for(var i=0; i < facets.length; i++){
                var ignoredSet = new Set();
                
                if(expSetFilters[facets[i].field]){
                    for(let expFilter of expSetFilters[facets[i].field]){
                        var found = false;
                        for(var j=0; j < facets[i].terms.length; j++){
                            if(expFilter === facets[i].terms[j].key){
                                found = true;
                                break;
                            }
                        }
                        if(!found){
                            ignoredSet.add(expFilter);
                        }
                    }
                    if(ignoredSet.size > 0){
                        ignoredFilters[facets[i].field] = ignoredSet;
                    }
                }

            }
            if (Object.keys(ignoredFilters).length) console.log("Found Ignored Filters: ", ignoredFilters);
            return ignoredFilters;
        },

        /** 
         * Compare two arrays of experiments to check if contain same experiments, by their ID.
         * @return {boolean} True if equal.
         */
        compareExperimentLists : function(exps1, exps2){
            if (exps1.length != exps2.length) return false;
            for (var i; i < exps1.length; i++){
                if (exps1[i]['@id'] != exps2[i]['@id']) return false;
            }
            return true;
        },

        /**
         * ToDo : Compare two objects of expSetFilters.
         * @return {boolean} True if equal.
         */
        /*
        compareExpSetFilters : function(expSetFilters1, expSetFilters2){
            var esfKeys1 = Object.keys(expSetFilters1);
            var esfKeys2 = Object.keys(expSetFilters2);
            if (esfKeys1.length != esfKeys2.length) return false;
        },
        */
        checkFilledFacets : function(facets){
            if (!facets.length) return false;
            for (var i; i < facets.length; i++){
                if (typeof facets[i].total !== 'number') return false;
                if (typeof facets[i].terms === 'undefined') return false;
            }
            return true;
        }

    },

    contextTypes: {
        session: React.PropTypes.bool,
        hidePublicAudits: React.PropTypes.bool,
        location_href : React.PropTypes.string
    },

    propTypes : {
        /**
         * Array of objects containing -
         *   'field' : string (schema path),
         *   'terms' : [{'doc_count' : integer (# of matching experiments), 'key' : string (term/filter name) }],
         *   'title' : string (category name),
         *   'total' : integer (# of experiments)
         */
        facets : React.PropTypes.array,
        /**
         * In lieu of facets, which are only generated by search.py, can
         * use and format schemas (available to experiment-set-view.js through item.js)
         */
        schemas : React.PropTypes.object,
        // { '<schemaKey : string > (active facet categories)' : Set (active filters within category) }
        expSetFilters : React.PropTypes.object.isRequired,
        experimentSetListJSON : React.PropTypes.array.isRequired, // JSON data of experiments, if not in context['@graph']
        orientation : React.PropTypes.string,   // 'vertical' or 'horizontal'
        ignoredFilters : React.PropTypes.any,   // Passed down to ExpTerm
        urlPath : React.PropTypes.string,       // context['@id'], used to get search param.
        restrictions : React.PropTypes.object,
        experimentsOrSets : React.PropTypes.string,
        expIncompleteFacets : React.PropTypes.array,
        title : React.PropTypes.string,         // Title to put atop FacetList


        context : React.PropTypes.object,       // Unused -ish
        onFilter : React.PropTypes.func,        // Unused
        fileFormats : React.PropTypes.array,    // Unused
        // searchBase : React.PropTypes.string,    // Unused - grab from location_href
        restrictions : React.PropTypes.object,  // Unused
        mode : React.PropTypes.string,          // Unused
        onChange : React.PropTypes.func         // Unused
    },

    facets : null,
    ignoredFilters : null,

    getDefaultProps: function() {
        return {
            orientation: 'vertical',
            restrictions : {},
            facets : null,
            experimentsOrSets : 'sets',
            urlPath : null,
            title : "Properties"
        };
    },

    getInitialState : function(){

        var initState = {
            usingProvidedFacets : !!(this.props.facets), // Convert to bool
            facetsLoaded : false
        };

        if (initState.usingProvidedFacets) {
            this.facets = this.props.facets;
        } else {
            this.facets = this.props.expIncompleteFacets || []; // Try to get from Redux store via App props.
            if (this.facets && this.facets.length > 0) {
                initState.facetsLoaded = true;
            }
        }

        return initState;
    },

    componentWillMount : function(){
        if (this.state.usingProvidedFacets === false && this.state.facetsLoaded){
            FacetList.fillFacetTermsAndCountFromExps(this.facets, this.props.experimentSetListJSON);
        }
    },

    componentDidMount : function(){

        console.log(
            'Mounted FacetList on ' + (this.props.urlPath || 'unknown page.'),
            '\nFacets Provided: ' + this.state.usingProvidedFacets,
            'Facets Loaded: ' + this.state.facetsLoaded
        );

        if (this.state.usingProvidedFacets === false && !this.state.facetsLoaded && typeof window !== 'undefined'){
            // Load list of available facets via AJAX once & reuse.
            this.loadFacets(() => {
                FacetList.fillFacetTermsAndCountFromExps(this.facets, this.props.experimentSetListJSON);
                if (!this.props.ignoredFilters) {
                    this.ignoredFilters = FacetList.findIgnoredFilters(this.facets, this.props.expSetFilters);
                } // else: @see getInitialState
            });
        } // else if (this.state.usingProvidedFacets === false && this.state.facetsLoaded) : @see componentWillMount
    },

    componentWillUnmount : function(){
        if (this.state.usingProvidedFacets === false) {
            FacetList.resetFacetTermsAndCounts(this.facets);
        }
    },

    shouldComponentUpdate : function(nextProps, nextState){
        if (
            this.state.usingProvidedFacets === false ||
            this.props.ignoredFilters !== nextProps.ignoredFilters ||
            this.props.expSetFilters !== nextProps.expSetFilters ||
            this.props.facets !== nextProps.facets
        ){
            console.log('%cWill','color: green', 'update FacetList');
            return true;
        }
        console.log('%cWill not', 'color: red', 'update FacetList');
        return false;
    },

    componentWillReceiveProps : function(nextProps){
        if (
            this.props.ignoredFilters !== nextProps.ignoredFilters ||
            this.props.expSetFilters !== nextProps.expSetFilters ||
            this.props.facets !== nextProps.facets
        ){

            if (this.state.usingProvidedFacets === true && this.props.facets !== nextProps.facets){
                this.facets = nextProps.facets;
                console.timeLog('FacetList props.facets updated.');
            }

            if (!this.props.ignoredFilters && (this.state.usingProvidedFacets === true || this.state.facetsLoaded)){
                this.ignoredFilters = FacetList.findIgnoredFilters(this.facets, this.props.expSetFilters);
            } // else: See @componentDidMount > this.loadFacets() callback param
        }
    },

    loadFacets : function(callback = null){
        var facetType = (this.props.experimentsOrSets == 'sets' ? 'ExperimentSet' : 'Experiment');
        ajaxLoad('/facets?type=' + facetType + '&format=json', function(r){
            this.facets = r;
            console.log('Loaded Facet List via AJAX.');
            if (typeof callback == 'function') callback();
            if (facetType == 'Experiment' && !this.props.expIncompleteFacets && typeof window !== 'undefined'){
                window.requestAnimationFrame(()=>{
                    // Will trigger app re-render & update state.facetsLoaded as well through getInitialState.
                    store.dispatch({
                        type : {'expIncompleteFacets' : this.facets}
                    });
                    console.info('Stored Incomplete Facet List in Redux store.');
                });
            }
        }.bind(this));
    },

    clearFilters: function(e) {
        e.preventDefault();
        setTimeout(function(){
            store.dispatch({
                type : {'expSetFilters' : {}}
            });
        }, 0);
    },

    changeFilters: function(field, term, callback) {

        setTimeout(function(){

            // store currently selected filters as a dict of sets
            var tempObj = {};
            var newObj = {};

            // standardize on field naming convention for expSetFilters before they hit the redux store.
            field = FacetList.Facet.ExpTerm.standardizeFieldKey(field, this.props.experimentsOrSets);

            var expSet = this.props.expSetFilters[field] ? new Set(this.props.expSetFilters[field]) : new Set();
            if(expSet.has(term)){
                // term is already present, so delete it
                expSet.delete(term);
            }else{
                expSet.add(term);
            }
            if(expSet.size > 0){
                tempObj[field] = expSet;
                newObj = Object.assign({}, this.props.expSetFilters, tempObj);
            }else{ //remove key if set is empty
                newObj = Object.assign({}, this.props.expSetFilters);
                delete newObj[field];
            }

            var unsubscribe = store.subscribe(()=>{
                unsubscribe();
                if (typeof callback === 'function') setTimeout(callback, 0);
            });

            store.dispatch({
                type : {'expSetFilters' : newObj}
            });

        }.bind(this), 1);
    },

    searchQueryTerms : function(){
        var urlPath = this.props.urlPath || this.props.context && this.props.context['@id'] ? this.props.context['@id'] : null;
        if (!urlPath) return null;
        var searchQuery = urlPath && url.parse(urlPath).search;
        if (!searchQuery) return null;
        return queryString.parse(searchQuery);
    },

    renderFacets : function(){
        return this.facets
        .filter(facet => facet.field.substring(0, 6) !== 'audit.') /* ignore all audit facets for the time being */
        .filter(facet =>
            (
                (facet.field == 'type') ||
                (facet.field == 'experimentset_type') ||
                (   /* permissions */
                    !this.context.session && 
                    this.context.hidePublicAudits && 
                    facet.field.substring(0, 6) === 'audit.'
                )
            ) ? false : true )
        .map(facet =>
            <FacetList.Facet
                experimentSetListJSON={ this.props.experimentSetListJSON || this.props.context['@graph'] || null }
                expSetFilters={this.props.expSetFilters}
                ignoredFilters={ this.props.ignoredFilters || this.ignoredFilters }
                changeFilters={this.changeFilters}
                key={facet.field}
                facet={facet}
                width="inherit"
                experimentsOrSets={this.props.experimentsOrSets}
            />
        )
    },

    render: function() {
        console.timeLog('render facetlist');
        var exptypeDropdown;

        if (
            !this.facets ||
            (!this.facets.length && this.props.mode != 'picker') ||
            (!this.facets[0].terms && this.props.mode != 'picker')
        ) {
            if (!this.state.facetsLoaded) {
                return (
                    <div className="text-center" style={{ padding : "162px 0", fontSize : '26px', color : "#aaa" }}>
                        <i className="icon icon-spin icon-circle-o-notch"></i>
                    </div>
                );
            } else {
                return null;
            }
        }

        var clearButton = this.props.expSetFilters && !_.isEmpty(this.props.expSetFilters) ? true : false;

        //var terms = this.searchQueryTerms();
        //var searchBase = url.parse(this.context.location_href).search || '';
        //searchBase = searchBase && searchBase.length > 0 ? searchBase + '&' : searchBase + '?';

        return (
            <div>
                <div className="exptype-box">
                    { exptypeDropdown }
                </div>
                <div className={"facets-container facets " + this.props.orientation}>
                    <div className="row facets-header">
                        <div className="col-xs-6">
                            <h4 className="facets-title">{ this.props.title }</h4>
                        </div>
                        <div className={"col-xs-6 clear-filters-control" + (clearButton ? '' : ' placeholder')}>
                            <a href="#" onClick={this.clearFilters} className="btn btn-xs btn-primary">
                                <i className="icon icon-times"></i> Clear All
                            </a>
                        </div>
                    </div>
                    { this.renderFacets() }
                </div>
            </div>
        );
    }
});

