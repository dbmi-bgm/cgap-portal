'use strict';

import React from 'react';
import url from 'url';
import queryString from 'query-string';
import _ from 'underscore';
import memoize from 'memoize-one';
import ReactTooltip from 'react-tooltip';
var serialize = require('form-serialize');
import { detect as detectBrowser } from 'detect-browser';
import jsonScriptEscape from '../libs/jsonScriptEscape';
import { content_views as globalContentViews, portalConfig, getGoogleAnalyticsTrackingID, analyticsConfigurationOptions } from './globals';
import ErrorPage from './static-pages/ErrorPage';
import { NavigationBar } from './navigation/NavigationBar';
import { NotLoggedInAlert } from './navigation/components/LoginNavItem';
import { Footer } from './Footer';
import { store } from './../store';

import { Alerts } from '@hms-dbmi-bgm/shared-portal-components/es/components/ui/Alerts';
import { ajax, JWT, console, isServerSide, object, layout, analytics, memoizedUrlParse, WindowEventDelegator } from '@hms-dbmi-bgm/shared-portal-components/es/components/util';
import { Schemas, SEO, typedefs, navigate } from './util';
import { responsiveGridState, DeferMount } from './util/layout';
import { requestAnimationFrame as raf } from '@hms-dbmi-bgm/shared-portal-components/es/components/viz/utilities';

import { PageTitleSection } from './PageTitleSection';

// eslint-disable-next-line no-unused-vars
const { NavigateOpts } = typedefs;


/**
 * Creates a promise which completes after a delay, performing no network request.
 * Used to perform a promise.race to see if this timeout or a network requests completes first, which
 * then allows us to set app.state.slow and render a loading icon until long-running network request completes.
 *
 * @private
 */
class Timeout {
    /**
     * @param {number} timeout - The length of time before this promise resolves.
     */
    constructor(timeout) {
        /**
         * Internal promise object which resolves after length of time as specified by `timeout`.
         * @private
         */
        this.promise = new Promise((resolve) => setTimeout(resolve.bind(null, this), timeout));
    }
}

/**
 * The root and top-most React component for our application.
 * This is wrapped by a Redux store and then rendered by either the server-side
 * NodeJS sub-process or by the browser.
 *
 * @see https://github.com/4dn-dcic/fourfront/blob/master/src/encoded/static/server.js
 * @see https://github.com/4dn-dcic/fourfront/blob/master/src/encoded/static/browser.js
 */
export default class App extends React.PureComponent {

    /**
     * Defines time before a 'slow loading' indicator appears on page.
     *
     * @constant
     * @type {number}
     */
    static SLOW_REQUEST_TIME = 750;

    /**
     * Immediately scrolls browser viewport to current window hash or to top of page.
     *
     * @returns {void} Nothing
     */
    static scrollTo() {
        const { hash } = window.location;
        if (hash && document.getElementById(hash.slice(1))) {
            window.location.replace(hash);
        } else {
            window.scrollTo(0, 0);
        }
    }

    static debouncedOnNavigationTooltipRebuild = _.debounce(ReactTooltip.rebuild, 500);

    /**
     * Does some initialization, checks if browser HistoryAPI is supported,
     * sets state.session according to JWT in current cookie, etc.
     */
    constructor(props){
        super(props);
        _.bindAll(this, 'currentAction', 'loadSchemas',
            'setIsSubmitting', 'stayOnSubmissionsPage',
            'updateAppSessionState', 'confirmNavigation', 'navigate',
            'handleWindowMessage',
            // Global event handlers. These will catch events unless they are caught and prevented from bubbling up earlier.
            'handleClick', 'handleSubmit', 'handlePopState', 'handleBeforeUnload'
        );

        const { context } = props;

        Alerts.setStore(store);

        /**
         * Whether HistoryAPI is supported in current browser.
         * Assigned / determined in constructor.
         *
         * @type {boolean}
         */
        this.historyEnabled = !!(typeof window != 'undefined' && window.history && window.history.pushState);

        // Todo: Migrate session & user_actions to redux store?
        const session = !!(JWT.getUserInfo());

        // Save navigate fxn and other req'd stuffs to GLOBAL navigate obj.
        // So that we may call it from anywhere if necessary without passing through props.
        navigate.initializeFromApp(this);
        navigate.registerCallbackFunction(Alerts.updateCurrentAlertsTitleMap.bind(this, null));

        /**
         * Initial state of application.
         *
         * @type {Object}
         * @property {boolean}         state.session               Whether user is currently logged in or not. User details are retrieved using JWT utility.
         * @property {Object[]}        state.schemas               Current schemas; null until AJAX-ed in (may change).
         * @property {string|Object}   state.isSubmitting          Whether there's a submission in progress. If string, browser alert is shown to prevent user from accidentally navigating away. If object & modal key has a value, that JSX will be rendered when isSubmittingModalOpen = true
         * @property {boolean}         state.mounted               Whether app has been mounted into DOM in browser yet.
         * @property {boolean}         state.isSubmittingModalOpen Whether or not a submitting modal is currently open (rendered in BodyElement)
         */
        this.state = {
            session,
            'schemas'                     : context.schemas || null,
            'isSubmitting'                : false,
            'mounted'                     : false,
            'isSubmittingModalOpen'       : false,
        };

        // Holds a reference to current navigation request for `context`.
        // (App works as a single-page-application (SPA))
        this.currentNavigationRequest = null;

        if (!isServerSide()) console.info("App Initial State: ", this.state);
    }

    /**
     * Perform various actions once component is mounted which depend on browser environment:
     *
     * - Add URI hash from window.location.hash/href to Redux store (doesn't get sent server-side).
     * - Bind 'handlePopState' function to window popstate event (e.g. back/forward button navigation).
     * - Initializes Google Analytics
     * - Exposes 'API' from browser window object via property {Object} 'fourfront' which has reference to Alerts, JWT, navigate, and this app component.
     * - Emits an event from browser window named 'fourfrontinitialized', letting any listeners (parent windows, etc.) know that JS of this window has initialized. Posts message with same 'eventType' as well.
     * - Shows browser suggestion alert if not using Chrome, Safari, Firefox.
     * - Sets state.mounted to be true.
     * - Clears out any UTM URI parameters three seconds after mounting (giving Google Analytics time to pick them up).
     */
    componentDidMount() {
        const { href, context } = this.props;
        const { session } = this.state;

        // This won't refresh current page.
        // And preserves contents of browser view if are on edit page or similar.
        // Individual components may add/remove their own session expired callbacks and refresh page (or selves) if needed.
        ajax.AJAXSettings.addSessionExpiredCallback(this.updateAppSessionState);

        // The href prop we have was from serverside. It would not have a hash in it, and might be shortened.
        // Here we grab full-length href from window and then update props.href (via Redux), if it is different.
        const windowHref = (window && window.location && window.location.href) || href;
        if (href !== windowHref){
            store.dispatch({ 'type' : { 'href' : windowHref } });
        }

        // ANALYTICS INITIALIZATION; Sets userID (if any), performs initial pageview track
        const analyticsID = getGoogleAnalyticsTrackingID(href);
        if (analyticsID){
            analytics.initializeGoogleAnalytics(
                analyticsID,
                {
                    ...analyticsConfigurationOptions,
                    reduxStore: store,
                    initialContext: context,
                    initialHref: windowHref
                }
            );
        }

        // Load schemas into app.state, access them where needed via props (preferred, safer) or this.context.
        this.loadSchemas();

        if (this.historyEnabled) {
            try {
                window.history.replaceState(context, '', window.location.href);
            } catch (exc) {
                // Might fail due to too large data
                window.history.replaceState(null, '', window.location.href);
            }
            // Avoid popState on load, see: http://stackoverflow.com/q/6421769/199100
            // We don't use WindowEventDelegator here since we intend to `useCapture` to prevent default browser handling from being triggered for this.
            const registerWindowOnPopState = () => {
                window.addEventListener("popstate", this.handlePopState, true);
            };
            if (window._onload_event_fired) {
                registerWindowOnPopState();
            } else {
                window.addEventListener("load", function(){ setTimeout(registerWindowOnPopState, 10); });
            }
        } else {
            window.onhashchange = this.onHashChange;
        }

        window.onbeforeunload = this.handleBeforeUnload;

        // Save some stuff to global window variables so we can access it in tests:
        // Normally would call this 'window.app' but ENCODE already sets this in browser.js to be the top-level Redux provider (not really useful, remove?)
        window.fourfront = _.extend(window.fourfront || {}, {
            'app'       : this,
            'alerts'    : Alerts,
            'JWT'       : JWT,
            'navigate'  : navigate
        });

        // Listen to any 'navigate' messages.
        WindowEventDelegator.addHandler("message", this.handleWindowMessage);

        // Detect browser and save it to state. Show alert to inform people we're too ~lazy~ under-resourced to support MS Edge to the max.
        const browserInfo = detectBrowser();

        console.info('BROWSER', browserInfo);

        if (browserInfo && typeof browserInfo.name === 'string' && ['chrome', 'firefox', 'safari'].indexOf(browserInfo.name) === -1){
            Alerts.queue({
                'title' : 'Browser Suggestion',
                'message' : (
                    <div>
                        <p className="mb-0">
                            <a href="https://www.google.com/chrome/" rel="noopener noreferrer" target="_blank" className="text-500">Google Chrome</a>{' '}
                            or <a href="https://www.mozilla.org/en-US/firefox/" rel="noopener noreferrer" target="_blank" className="text-500">Mozilla Firefox</a> are
                            the recommended browser(s) for using the 4DN Data Portal.
                        </p>
                        <p className="mb-0">
                            Microsoft Edge, Safari, etc. should work for a majority of portal functions but are not explicitly supported and may present some glitches, e.g. during submission.
                        </p>
                    </div>
                ),
                'style' : 'warning'
            });
        }

        // Post-mount stuff
        this.setState({ 'mounted' : true, browserInfo }, () => {

            console.log('App is mounted, dispatching fourfrontinitialized event.');
            // DEPRECATED:
            // Emit event from our window object to notify that fourfront JS has initialized.
            // This is to be used by, e.g. submissions view which might control a child window.
            window.dispatchEvent(new Event('fourfrontinitialized'));

            // CURRENT: If we have parent window, post a message to it as well.
            if (window.opener) {
                window.opener.postMessage({ 'eventType' : 'fourfrontinitialized' }, '*');
            }

            // If we have UTM URL parameters in the URI, attempt to set history state (& browser) URL to exclude them after a few seconds
            // after Google Analytics may have stored proper 'source', 'medium', etc. (async)
            const { query = null, protocol, host, pathname } = url.parse(windowHref, true);
            const paramsToClear = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content'];

            if (query && _.any(paramsToClear, function(prm){ return typeof query[prm] !== 'undefined'; })){
                setTimeout(()=>{
                    const queryToSet = _.clone(query);
                    paramsToClear.forEach(function(prm){ typeof queryToSet[prm] !== 'undefined' && delete queryToSet[prm]; });
                    const nextUrl = (
                        protocol + '//' + host +
                        pathname + (_.keys(queryToSet).length > 0 ? '?' + queryString.stringify(queryToSet) : '')
                    );
                    if (nextUrl !== windowHref && this.historyEnabled){
                        try {
                            window.history.replaceState(context, '', nextUrl);
                        } catch (exc) {
                            // Might fail due to too large data
                            window.history.replaceState(null, '', nextUrl);
                        }
                        console.info('Replaced UTM params in URI:', windowHref, nextUrl);
                    }
                }, 3000);
            }

            // Set Alert if not on homepage and not logged in. This 'if' logic will likely change later
            // especially if have multiple 'for-public' pages like blog posts, news, documentation, etc.
            if (!session && pathname != "/") {
                // MAYBE TODO next time are working on shared-portal-components (SPC) repository:
                // Put this Alert into SPC as a predefined/constant export, then cancel/remove it (if active) in the callback function
                // upon login success ( https://github.com/4dn-dcic/shared-portal-components/blob/master/src/components/navigation/components/LoginController.js#L111 )
                Alerts.queue(NotLoggedInAlert);
            }

            // Set Alert if user initializes app between 330-830a ET (possibly temporary)
            // 12-4 am in ET is either 4am-8am or 5am-9am UTC, depending on daylight savings.
            const currTime = new Date();
            const currUTCHours = currTime.getUTCHours();
            const currUTCMinutes = currTime.getUTCMinutes();
            const showAlert = (
                ((currUTCHours >= 4 || (currUTCHours === 3 && currUTCMinutes >= 30))
                && currUTCHours <= 7 || (currUTCHours === 8 && currUTCMinutes <= 30))
            );
            if (showAlert) {
                const startTime = new Date();
                startTime.setUTCHours(3);
                startTime.setUTCMinutes(30);
                startTime.setUTCSeconds(0);
                const endTime = new Date();
                endTime.setUTCHours(8);
                endTime.setUTCMinutes(30);
                endTime.setUTCSeconds(0);
                let timezoneOffset = endTime.getTimezoneOffset() / 60;
                timezoneOffset = 0 - timezoneOffset;
                if (timezoneOffset > 0) { timezoneOffset = "+" + timezoneOffset; }
                Alerts.queue({
                    "title" : "Scheduled Daily Maintenance",
                    "style": "warning",
                    "message": `CGAP is running its daily scheduled maintenance and data indexing. \
                                Some data might not show up between ${startTime.toLocaleTimeString()} and ${endTime.toLocaleTimeString()} (UTC${timezoneOffset}).`
                });
            }

        });
    }

    /** @ignore */
    componentDidUpdate(prevProps, prevState) {
        const { href, context } = this.props;
        const { session } = this.state;
        var key;

        if (href !== prevProps.href){ // We navigated somewhere else.

            // Register google analytics pageview event.
            analytics.registerPageView(href, context);

            // We need to rebuild tooltips after navigation to a different page.
            // Add a debounce so it runs again after a delay, so other components get a chance to mount.
            App.debouncedOnNavigationTooltipRebuild();
        }

        // We can skip doing this unless debugging on localhost-
        if (console.isDebugging()){

            for (key in this.props) {
                // eslint-disable-next-line react/destructuring-assignment
                if (this.props[key] !== prevProps[key]) {
                    console.log('changed props: %s', key);
                }
            }

            for (key in this.state) {
                // eslint-disable-next-line react/destructuring-assignment
                if (this.state[key] !== prevState[key]) {
                    console.log('changed state: %s', key);
                }
            }

        }

    }

    handleWindowMessage(event) {
        const { origin, data } = event;
        const { href } = this.props;
        const { protocol, host } = memoizedUrlParse(href) || {};
        const hrefOrigin = protocol + '//' + host;
        if (origin !== hrefOrigin) {
            return false;
        }
        const { action, value, options } = data || {};
        if (action === "navigate" && typeof value === "string") {
            this.navigate(value,  options);
        }
    }

    /**
     * Calculates current action, if any, from URL hash.
     *
     * @public
     * @param {string} [href] - Href to get current action from. Optional.
     * @returns {!string} Current action if any, or null.
     */
    currentAction(href) {
        const { href : propHref } = this.props;
        if (!href) {
            href = propHref;
        }
        const query = memoizedUrlParse(href).query || {};
        let action = query.currentAction || null;

        // Handle list of values, e.g. if `currentAction=selection&currentAction=selection&currentAction=edit` or something is in URL.
        // We should __not__ get an array here and is glitch, but if so, lets fallback and choose _1st_ non-null item.
        if (Array.isArray(action)){
            console.error("Received unexpected list for `currentAction` URI param", action);
            action = _.filter(action);
            action = (action.length > 0 ? action[0] : null);
        }

        return action;
    }

    /**
     * If no schemas yet stored in our state, we AJAX them in from `/profiles/?format=json`.
     * Performed after/outside initial page render, because it's a lot of data and sending down alongside
     * or within html response would significantly increase time to page render.
     *
     * @param {function} [callback=null] - If defined, will be executed upon completion of load, with schemas passed in as first argument.
     * @param {boolean} [forceFetch=false] - If true, will ignore any previously-fetched schemas and fetch new ones.
     * @returns {void}
     */
    loadSchemas(callback = null, forceFetch = false){
        const { schemas } = this.state;
        if (schemas !== null && !forceFetch){
            // We've already loaded these successfully (hopefully)
            if (typeof callback === 'function') callback(schemas);
            console.info('Schemas available already.');
            return schemas;
        }
        ajax.promise('/profiles/?format=json').then((data) => {
            if (object.isValidJSON(data)){
                // Performed prior to state update, to be available globally immediately after state update.
                Schemas.set(data);
                this.setState({ 'schemas' : data }, () => {
                    // Rebuild tooltips because they likely use descriptions from schemas
                    ReactTooltip.rebuild();
                    if (typeof callback === 'function') callback(data);
                    console.info('Loaded schemas');
                });
            }
        });
    }

    /**
     * Intercepts a click on a hyperlink HTML element
     * and navigates to its target href if is an internal link.
     * Skips for download links, external links, etc.
     *
     * @private
     * @param {React.SyntheticEvent} event React SyntheticEvent for click MouseEvent.
     */
    handleClick(event) {
        // https://github.com/facebook/react/issues/1691
        if (event.isDefaultPrevented()) return;
        const { href } = this.props;
        const { nativeEvent, target: evtTarget } = event;

        // Might click on e.g. the <h4> within a <a href=... className="d-block"><h4>...</h4><span>...</span></a>
        const target = layout.elementIsChildOfLink(evtTarget);

        if (!target) return;

        if (target.getAttribute('disabled')) {
            event.preventDefault();
            return;
        }

        // Ensure this is a plain click
        if (nativeEvent.which > 1 || nativeEvent.shiftKey || nativeEvent.altKey || nativeEvent.metaKey) return;

        // Skip links with a data-bypass attribute or with download attribute.
        if (target.getAttribute('data-bypass') !== null || target.getAttribute('download') !== null){
            return false;
        }

        const targetHref = target.getAttribute('href') || target.getAttribute('data-href');

        if (targetHref === null){
            return false;
        }

        // Skip javascript links
        if (targetHref.indexOf('javascript:') === 0) return false;

        // Skip external links
        if (!navigate.sameOrigin(targetHref)) return false;

        // Skip links with a different target
        if (target.getAttribute('target')) return false;

        // Skip @@download links
        if (targetHref.indexOf('/@@download') != -1) return false;

        // With HTML5 history supported, local navigation is passed
        // through the navigate method.
        if (this.historyEnabled) {
            event.preventDefault();

            const tHrefParts = url.parse(targetHref);
            const pHrefParts = memoizedUrlParse(href);
            let tHrefHash = tHrefParts.hash;
            const samePath = pHrefParts.path === tHrefParts.path; // Occurs when click link which has same path but different hash, most often.
            const navOpts = {
                // Same pathname & search but maybe different hash. Don't add history entry etc.
                'replace'           : samePath,
                'skipRequest'       : samePath || !!(target.getAttribute('data-skiprequest')),
                'dontScrollToTop'   : samePath
            };
            let targetOffset = target.getAttribute('data-target-offset');
            const noCache = target.getAttribute('data-no-cache');

            // Don't cache requests to user profile.
            if (noCache) navOpts.cache = false;

            navigate(targetHref, navOpts, function(){
                if (targetOffset) targetOffset = parseInt(targetOffset);
                if (!targetOffset || isNaN(targetOffset)) targetOffset = 112;
                if (tHrefHash && typeof tHrefHash === 'string' && tHrefHash.length > 1 && tHrefHash[1] !== '!'){
                    tHrefHash = tHrefHash.slice(1); // Strip out '#'
                    setTimeout(function(){
                        layout.animateScrollTo(tHrefHash, 750, targetOffset);
                    }, 100);
                }
            });

            if (target && target.blur) target.blur();
        }
    }

    /**
     * Intercepts a form submission on a form HTML element
     * and performs it via AJAX. Similar to handling of hyperlinks.
     *
     * @private
     * @param {React.SyntheticEvent} event Form submission event.
     */
    handleSubmit(event) {
        const { href } = this.props;
        const { target } = event;
        const hrefParts = memoizedUrlParse(href);

        // Skip POST forms
        if (target.method !== 'get') return;

        // Skip forms with a data-bypass attribute.
        if (target.getAttribute('data-bypass')) return;

        // Skip external forms
        if (!navigate.sameOrigin(target.action)) return;

        const actionUrlParts  = url.parse(url.resolve(href, target.action));
        const currentAction   = this.currentAction();
        const navOptions      = {
            'replace'       : actionUrlParts.pathname == hrefParts.pathname,
            'skipRequest'   : !!(target.getAttribute('data-skiprequest'))
        };
        let search = serialize(target);
        let targetHref = actionUrlParts.pathname;

        if (target.getAttribute('data-removeempty')) {
            search = _.map(
                _.filter(search.split('&'), function (item) {
                    return item.slice(-1) != '=';
                }),
                function(item){
                    var split = item.split('=');
                    return split[0] + '=' + encodeURIComponent(split[1]).replace(/(')/g, "%27");
                }
            ).join('&');
        }

        // If we're submitting search form in selection mode, preserve selection mode at next URL.
        if (currentAction === 'selection' || currentAction === 'multiselect'){
            if (search && search.indexOf('currentAction=selection') === -1){
                search += '&currentAction=selection';
            } else if (!search) {
                search = 'currentAction=selection';
            }
        }

        // Append form name:vals as stringified URI params (`search`).
        if (search) targetHref += '?' + search;

        if (this.historyEnabled) {
            event.preventDefault();
            navigate(targetHref, navOptions);
        } // Else is submitted as normal browser HTTP GET request if event.preventDefault() not called.
    }

    /**
     * Handles a history change event.
     *
     * @private
     * @param {React.SyntheticEvent} event - A popstate event.
     */
    handlePopState(event) {
        if (this.DISABLE_POPSTATE) return;
        const { href, context } = this.props;
        const windowHref = window.location.href; // Href which browser just navigated to, but maybe not yet set to this.props.href

        if (!this.confirmPopState(windowHref)){
            try {
                // Undo what we just did (hit the back button) by re-adding it to history and returning (not performing actual naivgate backward)
                window.history.pushState(event.state, '', href);
            } catch (e){ // Too large
                console.warn('error pushing state (current, popped:)', context, event.state);
                window.history.pushState(null, '', href);
            }
            return;
        }

        if (!this.historyEnabled) {
            window.location.reload();
            return;
        }

        if (event.state) {
            // Abort inflight xhr before dispatching
            if (this.currentNavigationRequest !== null) {
                this.currentNavigationRequest.abort();
                this.currentNavigationRequest = null;
            }
            store.dispatch({
                type: {
                    'href' : windowHref,
                    'context' : event.state
                }
            });
        }

        // Always async update in case of server side changes.
        navigate(windowHref, { 'replace': true });
    }

    /**
     * Tests that JWT is present along with user info and user actions, and if so, updates `state.session`.
     * Called by `authenticateUser` as well as Login.
     *
     * @public
     * @param {function} [callback=null] Optional callback to be ran upon completing authentication.
     * @returns {void}
     */
    updateAppSessionState(callback = null){
        // get user actions (a function of log in) from local storage
        const userInfo  = JWT.getUserInfo();
        // We definitively use Cookies for JWT.
        // It can be unset via response headers from back-end.
        // const currentToken = JWT.get('cookie');
        const { session: existingSession } = this.state;
        const nextSession = !!(userInfo); // cast to bool

        console.log("Update session state", existingSession, nextSession);

        if (nextSession === existingSession) {
            return null;
        }

        this.setState({ "session": nextSession }, () => {
            const { session } = this.state;
            if (session === false && existingSession === true){
                Alerts.queue(Alerts.LoggedOut);
                // Clear out remaining auth/JWT stuff from localStorage if any.
                JWT.remove();
            } else if (session === true && existingSession === false){
                // Remove lingering 'logged out' alerts if have logged in.
                Alerts.deQueue([ Alerts.LoggedOut, NotLoggedInAlert ]);
            }
            if (typeof callback === 'function'){
                callback(session, userInfo);
            }
        });

    }

    /**
     * Updates Redux store with non-hash version of URI. For IE8/9 only.
     *
     * @deprecated
     * @private
     * @param {React.SyntheticEvent} event An event.
     * @returns {void}
     */
    onHashChange(event) {
        store.dispatch({
            type: { 'href' : document.querySelector('link[rel="canonical"]').getAttribute('href') }
        });
    }

    /**
     * Rules to prevent browser from changing to 'href' via back/forward buttons.
     *
     * @private
     * @param {string} href - Next href.
     * @returns {boolean} Whether to proceed with browser navigation.
     */
    confirmPopState(href){
        if (this.stayOnSubmissionsPage(href)) return false;
        return true;
    }

    /**
     * Only navigate if href changes unless is inPlace navigation, if don't need to stay on submissions
     * view, etc.
     *
     * @private
     * @param {string} href - New URI we're navigating to.
     * @param {Object} [options] - Options for navigation request.
     * @returns {boolean}
     */
    confirmNavigation(toHref, options) {
        const { href } = this.props;
        // check if user is currently on submission page
        // if so, warn them about leaving
        if (this.stayOnSubmissionsPage(toHref)){
            return false;
        }

        if (options && options.inPlace && options.inPlace === true){
            return true;
        }

        if (toHref === href){
            return false;
        }
        /*
        var partsNew = url.parse(toHref),
            partsOld = url.parse(href);

        if (partsNew.path === partsOld.path && !globals.isHashPartOfHref(null, partsNew)){
            return false;
        }
        */
        return true;
    }

    /**
     * Check this.state.isSubmitting to prompt user if navigating away
     * from the submissions page.
     *
     * @param {string} [href=null] - Href we are navigating to (in case of navigate, confirmNavigation) or have just navigated to (in case of popState event).
     * @returns {boolean}
     */
    stayOnSubmissionsPage(nextHref = null) {
        const { href } = this.props;
        const { isSubmitting } = this.state;
        // can override state in options
        // override with replace, which occurs on back button navigation
        if (isSubmitting){

            // Allow if changing hash, since generally navigates around a view while preserving it.
            const tHrefParts = url.parse(nextHref, false);
            const pHrefParts = memoizedUrlParse(href);
            const { path: tPath, search: tSearch } = tHrefParts; // Returns search: null if no query
            const { path, search } = pHrefParts; // Returns search: "" if no query (b.c. memoizedUrlParse does query:true in its call to url.parse)

            // Allow if only changing hash, since generally navigates around a view while preserving it.
            if (path === tPath && (search || "") === (tSearch || "")) {
                return false;
            }

            const nextAction = this.currentAction(nextHref);
            if (nextAction && { 'edit':1, 'create':1, 'clone':1 }[nextAction]){
                // Cancel out if we are "returning" to edit or create (submissions page) href.
                return false;
            }

            // If a custom modal is passed through in an object, use that to prompt user before navigating away
            if (typeof isSubmitting === "object" && isSubmitting.modal && React.isValidElement(isSubmitting.modal)) {

                // Feed navigation href to modal via prop
                const modalClone = React.cloneElement(isSubmitting.modal, { href: nextHref });

                this.setState({ isSubmitting: { modal: modalClone }, isSubmittingModalOpen: true });

                return true; // Do not navigate yet

            } else { // Render the browser confirm alert
                const confirmMessage = typeof isSubmitting === "string" ? isSubmitting : "Leaving will cause all unsubmitted work to be lost. Are you sure you want to proceed?";

                if (window.confirm(confirmMessage)){
                    // we are no longer submitting
                    this.setIsSubmitting(false);
                    return false;
                } else {
                    // stay
                    return true;
                }
            }
        } else {
            return false;
        }
    }

    /**
     * Should not be called directly - aliased to global function `util.navigate` during App constructor.
     * Function which is used/called to navigate us around the portal in single-page-application (AJAX)
     * fashion.
     *
     * @alias navigate
     * @private
     * @param {string} href                 URI we're attempting to navigate to.
     * @param {NavigateOpts} [options={}]   Options for the navigation request.
     * @param {function} [callback=null]    Optional callback, accepting response JSON as first argument.
     * @param {function} [fallbackCallback=null] - Optional callback to be called in case request fails.
     * @param {Object} [includeReduxDispatch={}] - Optional extra data to save to Redux store along with the next response.
     * @returns {void}
     */
    navigate(targetHref, options = {}, callback = null, fallbackCallback = null, includeReduxDispatch = {}) {

        const { href, context } = this.props;

        // options.skipRequest only used by collection search form
        // options.replace only used handleSubmit, handlePopState, handlePersonaLogin

        // Holds #hash, if any.
        let hashAppendage;

        // What we end up putting into Redux upon request completion.
        // Will include at least `context`, `href`.
        const reduxDispatchDict = _.clone(includeReduxDispatch);


        // Prepare the target href. Cancel out if some rule prevents navigation(s) at moment.
        targetHref = url.resolve(href, targetHref);
        if (!options.skipConfirmCheck && !this.confirmNavigation(targetHref, options)) {
            return false;
        }
        // Strip url hash.
        hashAppendage = '';
        var href_hash_pos = targetHref.indexOf('#');
        if (href_hash_pos > -1) {
            hashAppendage = targetHref.slice(href_hash_pos);
            targetHref = targetHref.slice(0, href_hash_pos);
        }

        const doRequest = () => {

            if (!this.historyEnabled) {
                if (options.replace) {
                    window.location.replace(targetHref + hashAppendage);
                } else {
                    const [ old_path ] = ('' + window.location).split('#');
                    window.location.assign(targetHref + hashAppendage);
                    if (old_path === targetHref) {
                        window.location.reload();
                    }
                }
                return false; // Unlike 'null', skips callback b.c. leaving page anyway.
            }

            // Abort the current/previous request, if any.
            if (this.currentNavigationRequest !== null){
                console.warn('Canceling previous navigation request', this.currentNavigationRequest);
                this.currentNavigationRequest.abort();
                this.currentNavigationRequest = null;
                this.setState(function({ slowLoad }){
                    if (!slowLoad) return null;
                    return { 'slowLoad' : false };
                });
            }

            if (options.skipRequest) {
                if (options.replace) {
                    try {
                        window.history.replaceState(context, '', targetHref + hashAppendage);
                    } catch (exc) {
                        console.warn('Data too big, saving null to browser history in place of props.context.');
                        window.history.replaceState(null, '', targetHref + hashAppendage);
                    }
                } else {
                    try {
                        window.history.pushState(context, '', targetHref + hashAppendage);
                    } catch (exc) {
                        console.warn('Data too big, saving null to browser history in place of props.context.');
                        window.history.pushState(null, '', targetHref + hashAppendage);
                    }
                }
                if (!options.skipUpdateHref) {
                    reduxDispatchDict.href = targetHref + hashAppendage;
                }
                if (_.keys(reduxDispatchDict).length > 0){
                    store.dispatch({ 'type' : reduxDispatchDict });
                }
                return false;
            }

            this.currentNavigationRequest = ajax.fetch(targetHref);
            // Keep a reference in current scope to later assert if same request instance (vs new superceding one).
            const currentRequestInThisScope = this.currentNavigationRequest;
            const timeout = new Timeout(App.SLOW_REQUEST_TIME);

            Promise.race([currentRequestInThisScope, timeout.promise]).then((v) => {
                if (v instanceof Timeout && currentRequestInThisScope === this.currentNavigationRequest) {
                    console.log('TIMEOUT!!!');
                    this.setState(function({ slowLoad }){
                        if (slowLoad) return null;
                        return { 'slowLoad' : true };
                    });
                }
            });

            currentRequestInThisScope
                .then((response)=>{
                    console.info("Fetched new context", response);

                    if (!object.isValidJSON(response)) { // Probably only if 500 server error or similar. Or link to xml or image etc.
                        // navigate normally to URL of unexpected non-JSON response so back button works.
                        // this cancels out of promise chain & current app JS scope
                        if (options.replace) {
                            window.location.replace(targetHref + hashAppendage);
                        } else {
                            window.location.assign(targetHref + hashAppendage);
                        }
                    }

                    return response;
                })
                .then((response) => {
                    // Get correct URL from XHR, in case we hit a redirect during the request.
                    const responseHref = (
                        currentRequestInThisScope && currentRequestInThisScope.xhr && currentRequestInThisScope.xhr.responseURL
                    ) || targetHref;

                    reduxDispatchDict.href = responseHref + hashAppendage;

                    if (currentRequestInThisScope === this.currentNavigationRequest){ // Ensure we're not de-referencing some new superceding request.
                        this.currentNavigationRequest = null;
                    }
                    return response;
                })
                .then((response) => {
                    // Update redux store w. response/context. Add Browser History Entry.
                    if (options.replace){
                        try { // title (2nd param) for replaceState & pushState is currently ignored by browsers
                            window.history.replaceState(response, '', reduxDispatchDict.href);
                        } catch (exc) {
                            console.warn('Data too big, saving null to browser history in place of props.context.');
                            window.history.replaceState(null, '', reduxDispatchDict.href);
                        }
                    } else {
                        try {
                            window.history.pushState(response, '', reduxDispatchDict.href);
                        } catch (exc) {
                            console.warn('Data too big, saving null to browser history in place of props.context.');
                            window.history.pushState(null, '', reduxDispatchDict.href);
                        }
                    }

                    reduxDispatchDict.context = response;
                    store.dispatch({ 'type' : _.extend({}, reduxDispatchDict, includeReduxDispatch) });
                    return response;
                })
                .then((response) => { // Finalize - clean up `slowLoad : true` if in state, run callbacks and analytics.
                    this.setState(function({ slowLoad }){
                        if (!slowLoad) return null;
                        return { 'slowLoad' : false };
                    });
                    if (typeof callback === 'function'){
                        callback(response);
                    }
                    if (response.code === 404){
                        // This may not be caught as a server or network error.
                        // If is explicit 404 (vs just 0 search results), pyramid will send it as 'code' property.
                        analytics.exception('Page Not Found - ' + targetHref);
                    }
                }).then(function(){
                    if (!options.replace && !options.dontScrollToTop) {
                        App.scrollTo();
                    }
                });

            /**
             * Param `err` could be one of multiple things -
             * It will be an (XMLHttpRequest) XHR object if could not parse JSON.
             * XHR object exposes a numerical `status` property.
             * This would likely occur on 500 server error, 502 timeout error,
             * a 404 error that isn't in for a JSON resource, or similar.
             *
             * In the case of lack of internet connection or similar, `err` would
             * most likely be a `ProgressEvent` object which has a reference to XHR
             * via its `target` property.
             */
            currentRequestInThisScope.catch((err)=>{
                console.error('App Navigate Error -', err);
                this.setState(function({ slowLoad }){
                    if (!slowLoad) return null;
                    return { 'slowLoad' : false };
                });

                if (currentRequestInThisScope === this.currentNavigationRequest){
                    // Ensure we're not de-referencing some new superceding request.
                    this.currentNavigationRequest = null;
                }

                if (typeof fallbackCallback == 'function'){
                    fallbackCallback(err);
                }

                if (err.code === 500){
                    analytics.exception('Server Error: ' + err.status + ' - ' + targetHref);
                }

                if (err.code === 404){
                    analytics.exception('Page Not Found - ' + targetHref);
                }

                if (err.code === 403){
                    // An error may be thrown in Promise response chain with this message ("HTTPForbidden") if received a 403 status code in response
                    if (typeof callback === 'function'){
                        callback(err);
                    }
                } else if ({ 502:1, 503:1, 504:1, 505:1, 598:1, 599:1, 444:1, 499:1, 522:1, 524:1 }[err.code] > -1) {
                    // Bad connection
                    Alerts.queue(Alerts.ConnectionError);
                    const msg = 'Network Error: ' + err.status + ' - ' + targetHref;
                    analytics.exception(msg);
                    console.warn(msg);
                } else {
                    Alerts.queue(Alerts.ConnectionError);
                    const msg = 'Unknown Network Error: ' + err.status + ' - ' + targetHref;
                    analytics.exception(msg);
                    console.error(msg);
                    // Unknown/unanticipated error: Bubble it up (won't break app).
                    throw err;
                }

                // Possibly not needed: If no major JS error thrown, add entry in Browser History so that back/forward buttons still works after hitting a 404 or similar.
                // title currently ignored by browsers
                if (options.replace){
                    try {
                        window.history.replaceState(err, '', targetHref + hashAppendage);
                    } catch (exc) {
                        console.warn('Data too big, saving null to browser history in place of props.context.');
                        window.history.replaceState(null, '', targetHref + hashAppendage);
                    }
                } else {
                    try {
                        window.history.pushState(err, '', targetHref + hashAppendage);
                    } catch (exc) {
                        console.warn('Data too big, saving null to browser history in place of props.context.');
                        window.history.pushState(null, '', targetHref + hashAppendage);
                    }
                }
            });

            // currentRequestInThisScope === this.currentNavigationRequest here and in outer `this.navigation` scope.
            // BUT this may not be case later in async Promise chain if new request launched and
            // `abort` not called in time to cancel execution of Promise chain.
            console.info('Navigating > ', currentRequestInThisScope);
            return currentRequestInThisScope;
        };

        const requestIfLaunched = doRequest();
        if (!requestIfLaunched){ // We cancelled out somewhere due to `options.skipRequest` or similar.
            if (typeof callback === 'function'){
                setTimeout(callback, 100);
            }
        }
        return requestIfLaunched; // === this.currentNavigationRequest definitively here still, until async Promise chain.
    }

    /**
     * Set 'isSubmitting' in state. works with handleBeforeUnload
     *
     * @param {boolean|string|object} value - Value to set. If string is provided, will show as text in popup. If object is provided and modal key contains JSX, isSubmittingModalOpen opened/closed according to value for showModelOpen
     * @param {function} [callback=null] - Optional callback to execute after updating state.
     * @param {boolean} showModalOpen - Optional setting to also close/open modal
     */
    setIsSubmitting(value, callback=null, showModalOpen){
        if (showModalOpen === true || showModalOpen === false) {
            this.setState({ 'isSubmitting': value, 'isSubmittingModalOpen': showModalOpen }, callback);
        } else {
            this.setState({ 'isSubmitting': value }, callback);
        }
    }

    /**
     * Catch and alert user navigating away from page if in submission process.
     * (This doesn't always print the message, and instead returns browser's default one, e.g. in Chrome)
     * See: https://developer.mozilla.org/en-US/docs/Web/API/WindowEventHandlers/onbeforeunload (esp Browser Compatibility for custom text support)
     *
     * @param {React.SyntheticEvent} e Window beforeunload event.
     * @returns {string|void} Dialog text which is to be shown to user.
     */
    handleBeforeUnload(e){
        const { isSubmitting } = this.state;
        if (isSubmitting){
            e.preventDefault();
            const confirmMessage = typeof isSubmitting === "string" ? isSubmitting : "Leaving will cause all unsubmitted work to be lost. Are you sure you want to proceed?";
            e.returnValue = confirmMessage;
            return confirmMessage;
        }
    }

    /** Renders the entire HTML of the application. */
    render() {
        const { context, lastBuildTime, href, contextRequest } = this.props;
        const { mounted = false } = this.state;
        const hrefParts = memoizedUrlParse(href);
        const routeList = hrefParts.pathname.split("/");
        const routeLeaf = routeList[routeList.length - 1];
        const currentAction = this.currentAction();
        const userInfo = JWT.getUserInfo();
        const userActions = (userInfo && userInfo.user_actions) || null;
        let canonical = href;
        let status;

        // `canonical` is meant to refer to the definitive URI for current resource.
        // For example, https://data.4dnucleome.org/some-item, http://data.4dnucleome.org/some-item, http://www.data.4dnucleome.org/some-item
        // refer to same item, and `canonical` URL is the one that should be used when referring to or citing "/some-item".
        // In our case, it is "https://data.4dnucleome.org/"; this canonical code may be deprecated as we always redirect to https and
        // [wwww.]4dnuclome.org is a separate domain/site.

        if (context.canonical_uri) {
            if (hrefParts.host) {
                canonical = (hrefParts.protocol || '') + '//' + hrefParts.host + context.canonical_uri;
            } else {
                canonical = context.canonical_uri;
            }
        }

        // check error status
        if (context.code === 403){
            if (context.title && (context.title.toLowerCase() === 'login failure' || context.title === 'No Access')){
                status = 'invalid_login';
            } else if (context.title && context.title === 'Forbidden'){
                status = 'forbidden';
            }
        } else if (context.code === 404){
            status = 'not_found';
        } else if (routeLeaf == 'submissions' && !_.contains(_.pluck(userActions, 'id'), 'submissions')){
            status = 'forbidden'; // attempting to view submissions but it's not in users actions
        }

        const isLoading = contextRequest && contextRequest.xhr && contextRequest.xhr.readyState < 4;
        const baseDomain = (hrefParts.protocol || '') + '//' + hrefParts.host;
        const bodyElementProps = _.extend({}, this.state, this.props, { // Complete set of own props, own state, + extras.
            canonical,
            baseDomain,
            isLoading,
            currentAction,
            status,
            routeLeaf,
            hrefParts,
            'updateUploads'  : this.updateUploads,
            'updateAppSessionState' : this.updateAppSessionState,
            'setIsSubmitting': this.setIsSubmitting,
            'onBodyClick'    : this.handleClick,
            'onBodySubmit'   : this.handleSubmit,
        });

        const contentSecurityPolicyStr = [
            "default-src 'self'",
            "img-src 'self' https://* https://i.ytimg.com data:",
            "child-src blob:",
            // Allowing unsafe-eval temporarily re: 'box-intersect' dependency of some HiGlass tracks.
            "frame-src https://www.google.com/recaptcha/ https://www.youtube.com",
            // Allow anything on https://*.auth0.com domain to allow customization of Auth0 - Will Jan 31 2023
            "script-src 'self' https://www.google-analytics.com https://*.auth0.com https://secure.gravatar.com https://www.google.com/recaptcha/ https://www.gstatic.com/recaptcha/ 'unsafe-eval'", // + (typeof BUILDTYPE === "string" && BUILDTYPE === "quick" ? " 'unsafe-eval'" : ""),
            "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com  https://unpkg.com",
            "font-src 'self' https://fonts.gstatic.com",
            "worker-src 'self' blob:",
            "connect-src 'self' https://cgap-higlass.com https://*.s3.amazonaws.com https://rest.ensembl.org https://eutils.ncbi.nlm.nih.gov"
        ].join("; ");
        // In future consider adding: object-src 'none'; require-trusted-types-for 'script';
        // (from google csp eval -- Will says what we have is fine for now, though)

        // `lastBuildTime` is used for both CSS and JS because is most likely they change at the same time on production from recompiling

        return (
            <html lang="en">
                <head>
                    <meta charSet="utf-8"/>
                    <meta httpEquiv="Content-Type" content="text/html, charset=UTF-8"/>
                    <meta httpEquiv="Content-Security-Policy" content={contentSecurityPolicyStr}/>
                    <meta httpEquiv="X-UA-Compatible" content="IE=edge"/>
                    <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1"/>
                    <meta name="google-site-verification" content="sia9P1_R16tk3XW93WBFeJZvlTt3h0qL00aAJd3QknU" />
                    <meta name="robots" content="noindex"/>
                    <HTMLTitle {...{ context, currentAction, canonical, status }} />
                    <script data-prop-name="user_info" type="application/json" dangerouslySetInnerHTML={mounted ? null : {
                        __html: jsonScriptEscape(JSON.stringify(JWT.getUserInfo())) /* Kept up-to-date in browser.js */
                    }}/>
                    <script data-prop-name="lastBuildTime" type="application/json" dangerouslySetInnerHTML={{ __html: lastBuildTime }}/>
                    <link rel="stylesheet" href={'/static/css/style.css?build=' + (lastBuildTime || 0)} />
                    <DeferMount><link rel="stylesheet" media="print" href={'/static/css/print.css?build=' + (lastBuildTime || 0)} /></DeferMount>
                    <SEO.CurrentContext {...{ context, hrefParts, baseDomain }} />
                    <link href="https://fonts.googleapis.com/css?family=Source+Sans+Pro:200,300,400,600,700,900,300i,400i,600i|Yrsa|Source+Code+Pro:300,400,500,600" rel="stylesheet"/>
                    {/* Can set webpack.config.js browser build's externals "react":"React" and load via CDN but need to then allow cross-origin requests to CDN domain
                    <script crossOrigin src="https://unpkg.com/react@17/umd/react.development.js"></script>
                    <script crossOrigin src="https://unpkg.com/react-dom@17/umd/react-dom.development.js"></script>
                    */}
                    <script defer type="application/javascript" src="//www.google-analytics.com/analytics.js" />
                    <script defer type="application/javascript" src={"/static/build/bundle.js?build=" + (lastBuildTime || 0)} charSet="utf-8" />
                    <link rel="canonical" href={canonical} />
                    {/* <script data-prop-name="inline" type="application/javascript" charSet="utf-8" dangerouslySetInnerHTML={{__html: this.props.inline}}/> <-- SAVED FOR REFERENCE */}
                </head>
                <React.StrictMode>
                    <BodyElement {...bodyElementProps} />
                </React.StrictMode>
            </html>
        );
    }
}

/**
 * Renders out the <title> element in the <head> area of the
 * HTML document.
 */
class HTMLTitle extends React.PureComponent {

    componentDidMount() {
        // See https://github.com/facebook/react/issues/2323
        // Deprecated as of React v16.
        var node = document.querySelector('title');
        if (node && this._rootNodeID && !node.getAttribute('data-reactid')) {
            node.setAttribute('data-reactid', this._rootNodeID);
        }
    }

    render() {
        const { canonical, currentAction, context, status, contentViews } = this.props;
        const { title: portalTitle } = portalConfig;
        let title;

        if (canonical === "about:blank"){   // first case is fallback
            title = portalTitle;
        } else if (status) {                // error catching
            title = 'Error';
        } else if (context) {               // What should occur (success)

            const ContentView = (contentViews || globalContentViews).lookup(context, currentAction);

            // Set browser window title.
            title = object.itemUtil.getTitleStringFromContext(context);

            if (title && title != 'Home') {
                title = title + ' – ' + portalTitle;
            } else {
                title = portalTitle;
            }

            if (!ContentView){ // Handle the case where context is not loaded correctly
                title = 'Error';
            } else if (currentAction && _.contains(['edit', 'add', 'create'], currentAction)) { // Handle content edit + create action permissions
                const contextActionNames = _.filter(_.pluck((context && context.actions) || [], 'name'));
                // see if desired actions is not allowed for current user
                if (!_.contains(contextActionNames, currentAction)){
                    title = 'Action not permitted';
                }
            }
        } else {
            throw new Error('No context is available. Some error somewhere.');
        }

        return <title>{ title }</title>;
    }

}

const ContentRenderer = React.memo(function ContentRenderer(props){
    const { canonical, status, currentAction, context, routeLeaf, contentViews, href } = props;
    const contextAtID = object.itemUtil.atId(context);
    const key = contextAtID && contextAtID.split('?')[0]; // Switching between collections may leave component in place
    let content; // Output

    // Object of common props passed to all content_views.
    const commonContentViewProps = _.pick(props,
        // Props from App:
        'schemas', 'session', 'href', 'navigate', 'uploads', 'updateUploads', 'alerts',
        'setIsSubmitting', 'isSubmitting', 'isSubmittingModalOpen', 'updateAppSessionState', 'context', 'currentAction',
        // Props from BodyElement:
        'windowWidth', 'windowHeight', 'registerWindowOnResizeHandler', 'registerWindowOnScrollHandler',
        'addToBodyClassList', 'removeFromBodyClassList', 'toggleFullScreen', 'isFullscreen',
        'overlaysContainer', 'innerOverlaysContainer'
    );

    if (canonical === "about:blank"){   // first case is fallback
        content = null;
    } else if (status) {                // error catching
        content = <ErrorPage currRoute={routeLeaf} status={status}/>;
    } else if (context) {               // What should occur (success)
        const ContentView = (contentViews || globalContentViews).lookup(context, currentAction);

        if (!ContentView){ // Handle the case where context is not loaded correctly
            content = <ErrorPage status={null}/>;
        } else if (currentAction && _.contains(['edit', 'add', 'create'], currentAction)) { // Handle content edit + create action permissions
            const contextActionNames = _.filter(_.pluck((context && context.actions) || [], 'name'));
            // see if desired actions is not allowed for current user
            if (!_.contains(contextActionNames, currentAction)){
                content = <ErrorPage status="forbidden" />;
            }
        }

        if (!content) { // No overriding cases encountered. Proceed to render appropriate view for our context.
            content = <ContentView key={key} {...commonContentViewProps} />;
        }
    } else {
        throw new Error('No context is available. Some error somewhere.');
    }

    return <ContentErrorBoundary canonical={canonical} href={href}>{ content }</ContentErrorBoundary>;
});

/**
 * This component provides some extra layout properties to certain components.
 * Namely, it handles, stores, and passes down state related to scrolling up/down the page.
 * This prevents needing to have numerous window scroll event listeners living throughout the app.
 *
 * @public
 * @class
 * @listens {Event} Window scroll events.
 * @listens {Event} Window resize events.
 * @todo Perhaps grab and pass down windowInnerWidth, windowInnerHeight, and/or similar props as well.
 */
class BodyElement extends React.PureComponent {

    /**
     * Calculates and returns width and height of viewport.
     * @returns {{ windowWidth: number, windowHeight: number }} Object with windowWidth and windowHeight properties.
     */
    static getViewportDimensions(){
        if (isServerSide()) return;
        return { 'windowWidth' : window.innerWidth , 'windowHeight' : window.innerHeight };
    }

    static getDerivedStateFromProps(props, state){
        var stateChange = { 'lastHref' : props.href };
        // Unset full screen if moving away to different pathname.
        if (state.isFullscreen && stateChange.lastHref !== state.lastHref){
            var currParts = url.parse(state.lastHref),
                nextParts = url.parse(stateChange.lastHref);

            if (currParts.pathname !== nextParts.pathname){
                stateChange.isFullscreen = false;
            }
        }
        return stateChange;
    }

    /**
     * Instantiates the BodyElement component, binds functions.
     */
    constructor(props){
        super(props);
        this.hideTestWarning = this.hideTestWarning.bind(this);
        this.onResize = _.debounce(this.onResize.bind(this), 300);
        this.setupScrollHandler = this.setupScrollHandler.bind(this);
        this.onAfterTooltipHide = this.onAfterTooltipHide.bind(this);

        this.registerWindowOnResizeHandler = this.registerWindowOnResizeHandler.bind(this);
        this.registerWindowOnScrollHandler = this.registerWindowOnScrollHandler.bind(this);
        this.addToBodyClassList         = this.addToBodyClassList.bind(this);
        this.removeFromBodyClassList    = this.removeFromBodyClassList.bind(this);
        this.toggleFullScreen           = this.toggleFullScreen.bind(this);
        this.bodyClassName              = this.bodyClassName.bind(this);

        /**
         * State object for BodyElement.
         *
         * @type {Object}
         * @property {boolean} state.scrolledPastTop        Whether window has been scrolled past 0.
         * @property {boolean} state.scrolledPast80     Whether window has been scrolled past 80px.
         * @property {number} state.windowWidth             Window inner width.
         * @property {number} state.windowHeight            Window inner height.
         * @property {string[]} state.classList             List of additional classNames that are added to the body element.
         */
        this.state = {
            scrolledPastTop       : null,
            scrolledPast80        : null,
            scrolledPast160       : null,
            scrolledPast240       : null,
            //'scrollTop'             : null // Not used, too many state updates if were to be.
            windowWidth           : null,
            windowHeight          : null,
            classList             : [],
            hasError              : false,
            errorInfo             : null,
            isFullscreen          : false,
            // Because componentWillReceiveProps is deprecated in favor of (static) getDerivedStateFromProps,
            // we ironically must now clone href in state to be able to do comparisons...
            // See: https://stackoverflow.com/questions/49723019/compare-with-previous-props-in-getderivedstatefromprops
            lastHref              : props.href,
            // Whether Test Data warning banner is visible.
            testWarningPresent    : false, //!globals.productionHost[props.hrefParts.hostname] || false
        };

        /**
         * Holds event handlers for window scroll event.
         * @private
         */
        this.scrollHandlers = [];
        /**
         * Holds event handlers for window resize event.
         * @private
         */
        this.resizeHandlers = [];

        /**
         * Reference to ReactTooltip component instance.
         * Used to unset the `top` and `left` positions after hover out.
         */
        this.tooltipRef = React.createRef();

        /**
         * Reference to overlays container.
         * Used for React.createPortal in whichever components
         * may need to make one.
         *
         * Eventually, this will be used to supercede React-Bootstraps
         * Modal Components.
         */
        this.overlaysContainerRef = React.createRef();

        /** Similar to above, but keeping navbar & footer visible if needed */
        this.innerOverlaysContainerRef = React.createRef();
    }

    /**
     * Initializes scroll event handler & loading of help menu tree.
     *
     * @returns {void}
     */
    componentDidMount(){
        this.setupScrollHandler();
        WindowEventDelegator.addHandler("resize", this.onResize);
        this.onResize();
    }

    componentDidUpdate(pastProps){
        const { href } = this.props;
        if (pastProps.href !== href){
            // Remove tooltip if still lingering from previous page
            this.tooltipRef && this.tooltipRef.current && this.tooltipRef.current.hideTooltip();
        }
    }

    /**
     * Unbinds event listeners.
     * Probably not needed but lets be safe & cleanup.
     *
     * @returns {void}
     */
    componentWillUnmount(){
        WindowEventDelegator.removeHandler("scroll", this.throttledScrollHandler);
        delete this.throttledScrollHandler;
        WindowEventDelegator.addHandler("resize", this.onResize);
    }

    /**
     * Catches exceptions in NavBar and similar 'outer' component areas.
     *
     * @private
     * @returns {void}
     */
    componentDidCatch(err, info){
        const { href } = this.props;
        this.setState({ 'hasError' : true, 'errorInfo' : info }, ()=>{
            analytics.exception('Client Error - ' + href + ': ' + err, true);
            // Unset app.historyEnabled so that user may navigate backward w/o JS.
            if (window && window.fourfront && window.fourfront.app){
                window.fourfront.app.historyEnabled = false;
            }
        });
    }

    /**
     * Sets `state.testWarningPresent` to be false and scrolls the window if sticky header is visible (SearchView)
     * so that sticky header gets its dimension(s) updated.
     *
     * @param {React.SyntheticEvent} [e] An event, if any. Unused.
     * @returns {void}
     */
    hideTestWarning(e) {
        // Remove the warning banner because the user clicked the close icon
        this.setState({ 'testWarningPresent': false });

        // If collection with .sticky-header on page, jiggle scroll position
        // to force the sticky header to jump to the top of the page.
        const hdrs = document.getElementsByClassName('sticky-header');
        if (hdrs.length) {
            window.scrollBy(0,-1);
            window.scrollBy(0,1);
        }
    }

    /**
     * Function passed down as a prop to content views to register window on scroll handlers.
     *
     * @public
     * @param {function} scrollHandlerFxn - Callback function which accepts a 'scrollTop' (number) and 'scrollVector' (number) param.
     * @returns {function} A function to call to unregister newly registered handler.
     */
    registerWindowOnScrollHandler(scrollHandlerFxn){
        var exists = this.scrollHandlers.indexOf(scrollHandlerFxn);// _.findIndex(this.scrollHandlers, scrollHandlerFxn);
        if (exists > -1) {
            console.warn('Function already registered.', scrollHandlerFxn);
            return null;
        } else {
            this.scrollHandlers.push(scrollHandlerFxn);
            console.info("Registered scroll handler", scrollHandlerFxn);
            return () => {
                var idxToRemove = this.scrollHandlers.indexOf(scrollHandlerFxn);
                if (idxToRemove === -1){
                    console.warn('Function no longer registered.', scrollHandlerFxn);
                    return false;
                }
                this.scrollHandlers.splice(idxToRemove, 1);
                console.info('Unregistered function from scroll events', scrollHandlerFxn);
                return true;
            };
        }
    }


    /**
     * Function passed down as a prop to content views to register window on resize handlers.
     *
     * @public
     * @param {function} resizeHandlerFxn - Callback function which accepts a 'dims' ({ windowWidth: number, windowHeight: number }) and 'pastDims' param.
     * @returns {function} A function to call to unregister newly registered handler.
     */
    registerWindowOnResizeHandler(resizeHandlerFxn){
        var exists = this.resizeHandlers.indexOf(resizeHandlerFxn);
        if (exists > -1) {
            console.warn('Function already registered.', resizeHandlerFxn);
            return null;
        } else {
            this.resizeHandlers.push(resizeHandlerFxn);
            console.info("Registered resize handler", resizeHandlerFxn);
            return () => {
                var idxToRemove = this.resizeHandlers.indexOf(resizeHandlerFxn);
                if (idxToRemove === -1){
                    console.warn('Function no longer registered.', resizeHandlerFxn);
                    return false;
                }
                this.resizeHandlers.splice(idxToRemove, 1);
                console.info('Unregistered function from resize events', resizeHandlerFxn);
                return true;
            };
        }
    }

    /**
     * Adds param `className` to `state.classList`. Passed down through props for child components to be able to adjust
     * body className in response to user interactions, such as setting a full screen state.
     *
     * @public
     * @param {string}   className      ClassName to add to class list.
     * @param {function} [callback]     Optional callback to be executed after state change.
     * @returns {void}
     */
    addToBodyClassList(className, callback){
        this.setState(function({ classList }){
            const foundIdx = classList.indexOf(className);
            if (foundIdx > -1){
                console.warn('ClassName already set', className);
                return null;
            } else {
                const nextClassList = classList.slice(0);
                nextClassList.push(className);
                console.info('Adding "' + className + '" to body classList');
                return { "classList" : nextClassList };
            }
        }, callback);
    }

    /**
     * Removes param `className` from `state.classList`. Passed down through props for child components to be able to adjust
     * body className in response to user interactions, such as removing a full screen state.
     *
     * @public
     * @param {string}   className      ClassName to remove from class list.
     * @param {function} [callback]     Optional callback to be executed after state change.
     * @returns {void}
     */
    removeFromBodyClassList(className, callback){
        this.setState(function({ classList }){
            const foundIdx = classList.indexOf(className);
            if (foundIdx === -1){
                console.warn('ClassName not in list', className);
                return null;
            } else {
                const nextClassList = classList.slice(0);
                nextClassList.splice(foundIdx, 1);
                console.info('Removing "' + className + '" from body classList');
                return { "classList" : nextClassList };
            }
        }, callback);
    }


    /**
     * Updates windowWidth and windowHeight dimensions in this.state, if different.
     * @private
     * @returns {void}
     */
    onResize(e){
        let dims, pastDims;
        this.setState(function({ windowWidth, windowHeight }){
            const nextState = {};
            dims = BodyElement.getViewportDimensions();
            pastDims = { windowWidth, windowHeight };
            if (dims.windowWidth !== pastDims.windowWidth)     nextState.windowWidth = dims.windowWidth;
            if (dims.windowHeight !== pastDims.windowHeight)   nextState.windowHeight = dims.windowHeight;
            if (Object.keys(nextState).length > 0){
                return nextState;
            }
            return null;
        }, ()=>{
            console.info('Window resize detected.', dims);
            if (this.resizeHandlers.length > 0){
                this.resizeHandlers.forEach(function(resizeHandlerFxn){ resizeHandlerFxn(dims, pastDims, e); });
            }
        });
    }

    /**
     * Attaches event listeners to the `window` object and passes down 'registerOnWindowEvent' functions as props which children down the rendering tree can subscribe to.
     * Updates `state.scrolledPastTop` and `<body/>` element className depending on window current scroll top.
     *
     * @private
     * @listens {Event} Window scroll events.
     * @returns {void}
     */
    setupScrollHandler(){
        if (!(typeof window !== 'undefined' && window && document && document.body && typeof document.body.scrollTop !== 'undefined')){
            return null;
        }

        let lastScrollTop = 0;
        const handleScroll = (e) => {
            const currentScrollTop = layout.getPageVerticalScrollPosition();
            const scrollVector = currentScrollTop - lastScrollTop;

            lastScrollTop = currentScrollTop;

            if (this.scrollHandlers.length > 0){
                _.forEach(this.scrollHandlers, (scrollHandlerFxn) => scrollHandlerFxn(currentScrollTop, scrollVector, e) );
            }

            this.setState(function({ windowWidth }){
                const rgs = responsiveGridState(windowWidth);
                let scrolledPastTop = false;
                let scrolledPast80 = false;
                let scrolledPast160 = false;
                let scrolledPast240 = false;

                if ( // Fixed nav takes effect at medium grid breakpoint or wider.
                    ['xs','sm'].indexOf(rgs) === -1 && (
                        (currentScrollTop > 20 && scrollVector >= 0) ||
                        (currentScrollTop > 80)
                    )
                ){
                    scrolledPastTop = true;
                    if (currentScrollTop > 80){
                        scrolledPast80 = true;
                    }
                    if (currentScrollTop > 160){
                        scrolledPast160 = true;
                    }
                    if (currentScrollTop > 240){
                        scrolledPast240 = true;
                    }
                }

                return { scrolledPastTop, scrolledPast80, scrolledPast160, scrolledPast240 };
            });
        };

        // We add as property of class instance so we can remove event listener on unmount, for example.
        this.throttledScrollHandler = _.throttle(raf.bind(window, handleScroll), 10);

        WindowEventDelegator.addHandler("scroll", this.throttledScrollHandler);

        setTimeout(this.throttledScrollHandler, 100, null);
    }

    onAfterTooltipHide(e){
        // Grab tip & unset style.left and style.top using same method tooltip does internally.
        const ref = this.tooltipRef && this.tooltipRef.current;
        const node = (ref && ref.tooltipRef) || null;
        if (!node || !node.style) {
            console.warn("Tooltip to hide not found");
            return;
        }
        node.style.left = null;
        node.style.top = null;
    }

    toggleFullScreen(isFullscreen, callback){
        if (typeof isFullscreen === 'boolean'){
            this.setState({ isFullscreen }, callback);
        } else {
            this.setState(function(currState){
                return { 'isFullscreen' : !currState.isFullscreen };
            }, callback);
        }
    }

    renderErrorState(){
        return (
            <body>
                <div id="slot-application">
                    <div id="application" className="done error">
                        <div id="layout">
                            <ErrorNotice />
                            <div id="layout-footer"/>
                        </div>
                    </div>
                </div>
            </body>
        );
    }

    bodyClassName(){
        const { isLoading, context } = this.props;
        const { scrolledPast80, scrolledPast160, scrolledPast240, scrolledPastTop, classList, isFullscreen, testWarningPresent } = this.state;
        const bodyClassList = (classList && classList.slice(0)) || [];

        // Common UI
        if (isLoading)          bodyClassList.push("loading-request");
        if (scrolledPastTop)    bodyClassList.push("scrolled-past-top");
        if (scrolledPast80)     bodyClassList.push("scrolled-past-80");
        if (scrolledPast160)    bodyClassList.push("scrolled-past-160");
        if (scrolledPast240)    bodyClassList.push("scrolled-past-240");
        if (isFullscreen){
            bodyClassList.push("is-full-screen");
        } else if (testWarningPresent) {
            bodyClassList.push("test-warning-visible");
        }

        // If is a typical ItemView, we want to show a full-width view.
        // StaticPages, unless on ItemView for them, _do not_ contain "Item"
        // in their @type field and instead have Portal, StaticPage, etc.
        if (Array.isArray(context['@type'])){
            if (context['@type'].indexOf('Item') > -1){
                bodyClassList.push("is-item-view");
            }
        }

        if (bodyClassList.length > 0){
            return bodyClassList.join(' ');
        } else {
            return null;
        }
    }

    /**
     * Renders out the body layout of the application.
     * TestWarning stuff is _possibly_ deprecated and for 4DN only.
     */
    render(){
        const { onBodyClick, onBodySubmit, context, alerts, canonical, currentAction, hrefParts, slowLoad, mounted, href, session, schemas,
            updateAppSessionState, isSubmitting, isSubmittingModalOpen } = this.props;
        const { windowWidth, windowHeight, classList, hasError, isFullscreen, testWarningPresent } = this.state;
        const { registerWindowOnResizeHandler, registerWindowOnScrollHandler, addToBodyClassList, removeFromBodyClassList, toggleFullScreen } = this;
        const overlaysContainer = this.overlaysContainerRef.current;
        const innerOverlaysContainer = this.innerOverlaysContainerRef.current;

        if (hasError) return this.renderErrorState();

        let innerContainerMinHeight;
        if (mounted && windowHeight){
            const rgs = responsiveGridState(windowWidth);
            if ({ 'xl' : 1, 'lg' : 1, 'md' : 1 }[rgs]){
                innerContainerMinHeight = (
                    // Hardcoded:
                    // - minus top nav full height, footer, [testWarning]
                    windowHeight - ((testWarningPresent && 52) || 0)
                );
            }
        }

        const navbarProps = {
            windowWidth, windowHeight,
            isFullscreen, toggleFullScreen, overlaysContainer,
            testWarningPresent, hideTestWarning: this.hideTestWarning,
            context, href, currentAction, session, schemas,
            updateAppSessionState
        };

        const propsPassedToAllViews = {
            ...this.props,
            windowWidth,
            windowHeight,
            navigate, // <- We could probably stop passing this down since can use the global aliased function instead...
            registerWindowOnResizeHandler,
            registerWindowOnScrollHandler,
            addToBodyClassList, removeFromBodyClassList,
            toggleFullScreen, isFullscreen, // <- These two are probably deprecated, were originally for 4DN.
            overlaysContainer,
            innerOverlaysContainer,
            alerts
        };

        return (
            // We skip setting `props.dangerouslySetInnerHTML` if mounted, since this data is only used for initializing over server-side-rendered HTML.
            <body data-current-action={currentAction} onClick={onBodyClick} onSubmit={onBodySubmit} data-path={hrefParts.path}
                data-pathname={hrefParts.pathname} className={this.bodyClassName()}>

                <script data-prop-name="context" type="application/json" dangerouslySetInnerHTML={mounted ? null : {
                    __html: jsonScriptEscape(JSON.stringify(context))
                }}/>
                <script data-prop-name="alerts" type="application/json" dangerouslySetInnerHTML={mounted ? null : {
                    __html: jsonScriptEscape(JSON.stringify(alerts))
                }}/>

                <div id="slow-load-container" className={slowLoad ? 'visible' : null}>
                    <div className="inner">
                        <i className="icon icon-circle-notch fas"/>
                    </div>
                </div>

                <div id="application">
                    <div id="layout">
                        { (isSubmitting && isSubmitting.modal) && isSubmittingModalOpen ? isSubmitting.modal : null}

                        <NavigationBar {...navbarProps} />

                        <div id="post-navbar-container" style={{ minHeight : innerContainerMinHeight }}>

                            <PageTitleSection {...this.props} windowWidth={windowWidth} />

                            <ContentErrorBoundary {...{ canonical, href }}>
                                <ContentRenderer {...propsPassedToAllViews} />
                            </ContentErrorBoundary>

                            <div id="inner-overlays-container" ref={this.innerOverlaysContainerRef} />

                        </div>
                    </div>
                    <Footer version={context.app_version} />
                </div>

                <div id="overlays-container" ref={this.overlaysContainerRef}/>

                <ReactTooltip effect="solid" globalEventOff="click" key="tooltip" uuid="primary-tooltip-fake-uuid"
                    afterHide={this.onAfterTooltipHide} ref={this.tooltipRef} />

            </body>
        );
    }

}




function ErrorNotice(props){
    return (
        <div className="error-boundary container" id="content">
            <hr/>
            <div className="mb-2 mt-2">
                <h3 className="text-400">A client-side error has occured, please go back or try again later.</h3>
            </div>
        </div>
    );
}


class ContentErrorBoundary extends React.Component {

    constructor(props){
        super(props);
        this.state = {
            'hasError' : false,
            'errorInfo' : null
        };
    }

    componentDidCatch(err, info){
        const { href } = this.props;
        this.setState({ 'hasError' : true, 'errorInfo' : info }, ()=>{
            analytics.exception('Client Error - ' + href + ': ' + err, true);
        });
    }

    /**
     * Unsets the error state if we navigate to a different view/href .. which normally should be different ContentView.
     */
    componentDidUpdate(pastProps){
        const { canonical } = this.props;
        if (pastProps.canonical !== canonical){
            this.setState(function(currState){
                if (currState.hasError) {
                    return {
                        'hasError' : false,
                        'errorInfo' : null
                    };
                }
                return {};
            });
        }
    }

    render(){
        const { children } = this.props, { hasError } = this.state;
        if (hasError){
            return <ErrorNotice />;
        }
        return children;
    }
}
