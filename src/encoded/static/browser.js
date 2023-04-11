'use strict';
// Entry point for browser, compiled into bundle[.chunkHash].js.

import React from 'react';
import ReactDOM from 'react-dom';

import App from './components';
var domready = require('domready');
import { store, mapStateToProps } from './store';
import { Provider, connect } from 'react-redux';
import { patchedConsoleInstance as console } from '@hms-dbmi-bgm/shared-portal-components/es/components/util/patched-console';
import * as JWT from '@hms-dbmi-bgm/shared-portal-components/es/components/util/json-web-token';
import { BrowserFeat } from '@hms-dbmi-bgm/shared-portal-components/es/components/util/layout';

/**
 * Unset JWT/auth and reload page if missing user info which should be paired with otherwise valid JWT token.
 * If user_info valid (exists), update localStorage w/ server-provider user_details (through props).
 * If no user_details provided, assume not logged in and unset JWT, then continue.
 * User info would have been obtained on login & contains user_actions (only obtained through /login).
 */
function updateSessionInfo() {
    let props;

    // Try-block just in case,
    // keep <script data-prop-type="user_details"> in <head>, before <script data-prop-type="inline">, in app.js
    // so is available before this JS (via bundle.js)
    try {
        props = getRenderedPropValues(document, 'user_info');
    } catch (e) {
        console.error(e);
        return false;
    }

    const { user_info } = props;
    const { details: { email } = {} } = user_info || {};

    if (email && typeof email === 'string') {
        // We have user_info from server-side; keep client-side in sync (in case updated via/by back-end / dif client at some point)
        JWT.saveUserInfoLocalStorage(user_info);
    } else {
        // Ensure no lingering userInfo or token in localStorage or cookies
        JWT.remove();
    }
}

// Treat domready function as the entry point to the application.
// Inside this function, kick-off all initialization, everything up to this
// point should be definitions.
if (typeof window !== 'undefined' && window.document && !window.TEST_RUNNER) {
    window.onload = function () {
        console.log('Window Loaded');
        window._onload_event_fired = true;
    };

    updateSessionInfo();

    domready(function () {
        console.log('Browser: ready');

        // Update Redux store from Redux store props that've been rendered server-side
        // into <script data-prop-name={ propName }> elements.
        const initialReduxStoreState = getRenderedProps(document);
        delete initialReduxStoreState.user_details; // Stored into localStorage.
        store.dispatch({ type: initialReduxStoreState });

        const AppWithReduxProps = connect(mapStateToProps)(App);

        try {
            ReactDOM.hydrate(
                <Provider store={store}>
                    <AppWithReduxProps />
                </Provider>,
                document
            );
        } catch (e) {
            console.error('INVARIANT ERROR', e); // To debug
            // So we can get printout and compare diff of renders.
            window.app = require('react-dom/server').renderToString(
                <Provider store={store}>
                    <AppWithReduxProps />
                </Provider>
            );
        }

        // Set <html> class depending on browser features
        BrowserFeat.setHtmlFeatClass();
    });
}

/**
 * Collects prop values from server-side-rendered HTML
 * to be re-fed into Redux store.
 *
 * @param {HTMLElement} document - HTML DOM element representing the document.
 * @param {string} [filter=null] - If set, filters down prop fields/values collected to only one(s) defined.
 * @returns {Object} Object keyed by field name with collected value as value.
 */
function getRenderedPropValues(document, filter = null) {
    const returnObj = {};
    let script_props;
    if (typeof filter === 'string') {
        script_props = document.querySelectorAll(
            'script[data-prop-name="' + filter + '"]'
        );
    } else {
        script_props = document.querySelectorAll('script[data-prop-name]');
    }
    script_props.forEach(function (elem) {
        const prop_name = elem.getAttribute('data-prop-name');
        let elem_value = elem.text;
        const elem_type = elem.getAttribute('type') || '';
        if (
            elem_type === 'application/json' ||
            elem_type.slice(-5) === '+json'
        ) {
            elem_value = JSON.parse(elem_value);
        }
        returnObj[prop_name] = elem_value;
    });
    return returnObj;
}

/**
 * Runs `App.getRenderedPropValues` and adds `href` key value from canonical link element.
 *
 * @param {HTMLElement} document - HTML DOM element representing the document.
 * @param {string} [filter=null] - If set, filters down prop fields/values collected to only one(s) defined.
 * @returns {Object} Object keyed by field name with collected value as value.
 */
function getRenderedProps(document, filter = null) {
    const returnObj = getRenderedPropValues(document, filter);
    returnObj.href = document
        .querySelector('link[rel="canonical"]')
        .getAttribute('href'); // Ensure the initial render is exactly the same
    return returnObj;
}
