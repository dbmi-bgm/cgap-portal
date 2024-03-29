// ***********************************************
// This example commands.js shows you how to
// create various custom commands and overwrite
// existing commands.
//
// For more comprehensive examples of custom
// commands please read more here:
// https://on.cypress.io/custom-commands
// ***********************************************
//
//
// -- This is a parent command --
// Cypress.Commands.add("login", (email, password) => { ... })
//
//
// -- This is a child command --
// Cypress.Commands.add("drag", { prevSubject: 'element'}, (subject, options) => { ... })
//
//
// -- This is a dual command --
// Cypress.Commands.add("dismiss", { prevSubject: 'optional'}, (subject, options) => { ... })
//
//
// -- This is will overwrite an existing command --
// Cypress.Commands.overwrite("visit", (originalFn, url, options) => { ... })

import _ from 'underscore';
var jwt = require('jsonwebtoken');
import { Buffer } from 'buffer';


/** Expected to throw error of some sort if not on search page, or no results. */
Cypress.Commands.add('searchPageTotalResultCount', function(options){
    return cy.get('div.above-results-table-row #results-count')
        .invoke('text').then(function(resultText){
            return parseInt(resultText);
        });
});



Cypress.Commands.add('scrollToBottom', function(options){
    return cy.get('body').then(($body)=>{
        cy.scrollTo(0, $body[0].scrollHeight);
    });
});


Cypress.Commands.add('scrollToCenterElement', { prevSubject : true }, (subject, options) => {
    expect(subject.length).to.equal(1);
    const subjectElem = subject[0];
    var bounds = subjectElem.getBoundingClientRect();
    return cy.window().then((w)=>{
        w.scrollBy(0, (bounds.top - (w.innerHeight / 2)));
        return cy.wrap(subjectElem);
    });
});



/**
 * This emulates login.js. Perhaps we should adjust login.js somewhat to match this better re: navigate.then(...) .
 */
Cypress.Commands.add('loginCGAP', function(options = { 'useEnvToken': false, 'email': null }){

    function performLogin(token){
        return cy.window().then((w)=>{
            cy.request({
                'url' : '/login',
                'method' : 'POST',
                'body' : JSON.stringify({ 'id_token' : token }),
                'headers' : {
                    'Authorization': 'Bearer ' + token,
                    'Accept': "application/json",
                    'Content-Type': "application/json; charset=UTF-8"
                },
                'followRedirect' : true
            }).then(function(resp){
                if (resp.status && resp.status === 200) {
                    cy.request({
                        'url': '/session-properties',
                        'method': 'GET',
                        'headers' : {
                            'Accept': "application/json",
                            'Content-Type': "application/json; charset=UTF-8"
                        }
                    }).then(function (userInfoResponse) {
                        w.fourfront.JWT.saveUserInfoLocalStorage(userInfoResponse.body);
                        // Triggers app.state.session change (req'd to update UI)
                        w.fourfront.app.updateAppSessionState();
                        // Refresh curr page/context
                        w.fourfront.navigate('', { 'inPlace' : true });
                    }).end();
                }
            }).end();
        }).end();
    }

    let jwt_token = null;

    if (options.useEnvToken) {
        jwt_token = Cypress.env('JWT_TOKEN');
        console.log('ENV TOKEN', jwt_token);
        if (typeof jwt_token === 'string' && jwt_token) {
            console.log('Logging in with token');
            return performLogin(jwt_token);
        }
    }

    // If no token, we try to generate/impersonate one ourselves

    const email = options.email || options.user || "cypress-test-user@cgap.hms.harvard.edu";
    const auth0client = Cypress.env('Auth0Client');
    const auth0secret = Cypress.env('Auth0Secret');

    if (!auth0client || !auth0secret) throw new Error('Cannot test login if no Auth0Client & Auth0Secret in ENV vars.');

    Cypress.log({
        'name' : "Login CGAP",
        'message' : 'Attempting to impersonate-login for ' + email,
        'consoleProps' : ()=>{
            return { auth0client, auth0secret, email };
        }
    });

    // Generate JWT
    const jwtPayload = {
        'email': email,
        'email_verified': true,
        'aud': auth0client,
        "iss": "https://hms-dbmi.auth0.com/"
    };

    jwt_token = jwt.sign(jwtPayload, Buffer.from(auth0secret, 'utf-8'));
    expect(jwt_token).to.have.length.greaterThan(0);
    Cypress.log({
        'name' : "Login 4DN",
        'message' : 'Generated own JWT with length ' + jwt_token.length,
    });
    return performLogin(jwt_token);

});

Cypress.Commands.add('logoutCGAP', function(options = { 'useEnvToken' : true }){
    cy.get("#user_account_nav_button").click().wait(100).end()
        .get('#logoutbtn').click().end().get('#user_account_nav_button').should('contain', 'Log In').wait(300).end()
        .get('#slow-load-container').should('not.have.class', 'visible').end();
});




/** Session Caching */

var localStorageCache = { 'user_info' : null };
var cookieCache = { 'jwtToken' : null, 'searchSessionID' : null };


Cypress.Commands.add('saveBrowserSession', function(options = {}){
    _.forEach(_.keys(localStorageCache), function(storageKey){
        localStorageCache[storageKey] = localStorage.getItem(storageKey) || null;
    });
    _.forEach(_.keys(cookieCache), function(cookieKey){
        cookieCache[cookieKey] = cy.getCookie(cookieKey) || null;
    });
});

Cypress.Commands.add('loadBrowserSession', function(options = {}){
    _.forEach(_.keys(localStorageCache), function(storageKey){
        if (typeof localStorageCache[storageKey] === 'string'){
            localStorage.setItem(storageKey, localStorageCache[storageKey]);
        }
    });
    _.forEach(_.keys(cookieCache), function(cookieKey){
        if (typeof cookieCache[cookieKey] === 'string'){
            cy.setCookie(cookieKey, cookieCache[cookieKey]);
        }
    });
});

Cypress.Commands.add('clearBrowserSession', function(options = {}){
    _.forEach(_.keys(localStorageCache), function(storageKey){
        localStorageCache[storageKey] = null;
    });
    _.forEach(_.keys(cookieCache), function(cookieKey){
        cookieCache[cookieKey] = null;
    });
    cy.loadBrowserSession();
});


/* Hovering */

Cypress.Commands.add('hoverIn', { prevSubject : true }, function(subject, options){

    expect(subject.length).to.equal(1);

    var subjElem = subject[0];

    var bounds = subjElem.getBoundingClientRect();
    var cursorPos = { 'clientX' : bounds.left + (bounds.width / 2), 'clientY' : bounds.top + (bounds.height / 2) };
    var commonEventVals = _.extend({ bubbles : true, cancelable : true }, cursorPos);

    subjElem.dispatchEvent(new MouseEvent('mouseenter', commonEventVals ) );
    subjElem.dispatchEvent(new MouseEvent('mouseover', commonEventVals ) );
    subjElem.dispatchEvent(new MouseEvent('mousemove', commonEventVals ) );

    return subject;
});

Cypress.Commands.add('hoverOut', { prevSubject : true }, function(subject, options){

    expect(subject.length).to.equal(1);

    var subjElem = subject[0];

    var bounds = subjElem.getBoundingClientRect();
    var cursorPos = { 'clientX' : Math.max(bounds.left - (bounds.width / 2), 0), 'clientY' : Math.max(bounds.top - (bounds.height / 2), 0) };
    var commonEventValsIn = _.extend({ 'bubbles' : true, 'cancelable' : true, }, cursorPos);

    subjElem.dispatchEvent(new MouseEvent('mousemove', commonEventValsIn ) );
    subjElem.dispatchEvent(new MouseEvent('mouseover', commonEventValsIn ) );
    subjElem.dispatchEvent(new MouseEvent('mouseleave', _.extend({ 'relatedTarget' : subjElem }, commonEventValsIn, { 'clientX' : bounds.left - 5, 'clientY' : bounds.top - 5 }) ) );

    return subject;
});

Cypress.Commands.add('clickEvent', { prevSubject : true }, function(subject, options){

    expect(subject.length).to.equal(1);

    var subjElem = subject[0];

    var bounds = subjElem.getBoundingClientRect();
    var cursorPos = { 'clientX' : bounds.left + (bounds.width / 2), 'clientY' : bounds.top + (bounds.height / 2) };
    var commonEventValsIn = _.extend({ 'bubbles' : true, 'cancelable' : true, }, cursorPos);

    subjElem.dispatchEvent(new MouseEvent('mouseenter', commonEventValsIn ) );
    subjElem.dispatchEvent(new MouseEvent('mousemove', commonEventValsIn ) );
    subjElem.dispatchEvent(new MouseEvent('mouseover', commonEventValsIn ) );
    subjElem.dispatchEvent(new MouseEvent('mousedown', commonEventValsIn ) );
    subjElem.dispatchEvent(new MouseEvent('mouseup', commonEventValsIn ) );
    //subjElem.dispatchEvent(new MouseEvent('mouseleave', _.extend({ 'relatedTarget' : subjElem }, commonEventValsIn, { 'clientX' : bounds.left - 5, 'clientY' : bounds.top - 5 }) ) );

    return subject;
});
