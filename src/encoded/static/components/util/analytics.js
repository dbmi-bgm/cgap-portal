'use strict';

var _ = require('underscore');
var url = require('url');
var { isServerSide } = require('./misc');
var console = require('./patched-console');
var Filters = require('./experiments-filters');
var navigate = require('./navigate');


var state = null;

var GADimensionMap = {
    'currentFilters' : 'dimension1'
};


var analytics = module.exports = {

    initializeGoogleAnalytics : function(trackingID = null, context = {}, currentExpSetFilters = {}, options = {
        isAnalyticsScriptOnPage : true,
        enhancedEcommercePlugin : true
    }){

        if (trackingID === null){
            trackingID = analytics.getTrackingId();
        }
        if (typeof trackingID !== 'string') return false;

        if (isServerSide()) return false;

        if (!options.isAnalyticsScriptOnPage){
            // If true, we already have <script src="...analytics.js">, e.g. in app.js so should skip this.
            (function(i,s,o,g,r,a,m){i['GoogleAnalyticsObject']=r;i[r]=i[r]||function(){
            (i[r].q=i[r].q||[]).push(arguments)},i[r].l=1*new Date();a=s.createElement(o),
            m=s.getElementsByTagName(o)[0];a.async=1;a.src=g;m.parentNode.insertBefore(a,m)
            })(window,document,'script','https://www.google-analytics.com/analytics.js','ga');
        }

        if (typeof window.ga === 'undefined'){
            console.error("Google Analytics is not initialized. Fine if this appears in a test.");
            return false;
        }

        state = _.clone(options);

        ga('create', trackingID, 'auto');
        console.info("Initialized google analytics.");
        
        if (options.enhancedEcommercePlugin){
            ga('require', 'ec');
            console.info("Initialized google analytics : Enhanced ECommerce Plugin");
        }

        analytics.registerPageView(null, context, currentExpSetFilters);
        return true;
    },

    registerPageView : function(href = null, context = {}, currentExpSetFilters = {}){
        if (isServerSide() || typeof window.ga === 'undefined') {
            console.error("Google Analytics is not initialized. Fine if this appears in a test.");
            return false;
        }

        if (!href) href = window.location && window.location.href;

        var opts = {};

        if (!href) {
            console.error("No HREF defined, check.. something. Will still send pageview event.");
        }

        var pastHref = href;
        var parts = url.parse(href);

        href = parts.pathname; // Clear query from HREF.

        // Set it as current page
        ga('set', 'page', href);

        if ( // If browse page, get current filters and add to pageview event for 'dimension1'.
            typeof parts.search === 'string' &&
            parts.search.length > 1 &&
            navigate.isBrowseHref(href) 
        ){
            opts[GADimensionMap.currentFilters] = analytics.getStringifiedCurrentFilters(currentExpSetFilters || pastHref);
            if (Array.isArray(context['@graph'])){
                analytics.impressionListOfItems(context['@graph'], pastHref, currentExpSetFilters);
            }
        } else if (state.enhancedEcommercePlugin && typeof context.accession === 'string'){
            // We got an Item, lets track some details about it.
            console.info("Item with an accession. Will track.");
            var productObj = analytics.createProductObjectFromItem(context);

            if (currentExpSetFilters && typeof currentExpSetFilters === 'object'){
                opts[GADimensionMap.currentFilters] = productObj[GADimensionMap.currentFilters] = analytics.getStringifiedCurrentFilters(currentExpSetFilters);
            }

            ga('ec:addProduct', productObj);
            ga('ec:setAction', 'detail', productObj);
        }
        
        ga('send', 'pageview', opts);
        console.info('Sent pageview event.', href, opts);
        return true;
    },

    impressionListOfItems : function(itemList, origHref = null, currentExpSetFilters = {}){
        var from = 0;
        if (typeof origHref === 'string'){
            var urlParts = url.parse(origHref, true);
            if (!isNaN(parseInt(urlParts.query['from']))) from = parseInt(urlParts.query['from']);
        }
        console.info("Will impression " + itemList.length + ' items.');
        itemList.forEach(function(expSet, i){
            var pObj = analytics.createProductObjectFromItem(expSet);
            if (currentExpSetFilters && typeof currentExpSetFilters === 'object'){
                pObj[GADimensionMap.currentFilters] = pObj.list = analytics.getStringifiedCurrentFilters(currentExpSetFilters);
            }
            pObj.position = from + i + 1;
            ga('ec:addImpression', pObj);
        });
    },

    createProductObjectFromItem : function(item){
        var productObj = {
            'id' : item.accession,
            'name' : item.display_title || item.title || null,
            'category' : item['@type'].slice().reverse().slice(1).join('/'),
            'brand' : (item.lab && item.lab.display_title) || (item.submitted_by && item.submitted_by.display_title) || item.lab || item.submitted_by || null,
        };
        return productObj;
    },

    getStringifiedCurrentFilters : function(filters){
        if (typeof filters === 'string'){
            filters = Filters.hrefToFilters(href);
        }
        return JSON.stringify(filters, _.keys(filters).sort());
    },

    getTrackingId : function(href = null){
        if (href === null && !isServerSide()){
            href = window.location.href;
        }
        var host = url.parse(href).host;
        if (host.indexOf('testportal.4dnucleome') > -1){
            return 'UA-86655305-2';
        }
        if (host.indexOf('data.4dnucleome') > -1){
            return 'UA-86655305-1';
        }
        if (host.indexOf('localhost') > -1){
            return 'UA-86655305-3';
        }
        if (host.indexOf('4dn-web-alex.us-east') > -1){
            return 'UA-86655305-4';
        }
        return null;
    },

};

if (!isServerSide()) {
    window.analytics = analytics;
}
