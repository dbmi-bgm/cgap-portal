'use strict';

import url from 'url';
import queryString from 'query-string';
import _ from 'underscore';

import { navigate as originalNavigate } from '@hms-dbmi-bgm/shared-portal-components/es/components/util/navigate';

let store = null;

const navigate = function(...args){ return originalNavigate(...args); };

// Carry over any util fxns. Then add more. Per portal.
_.extend(navigate, originalNavigate);

navigate.setNavigateFunction = function(...args){
    // eslint-disable-next-line prefer-destructuring
    store = require('../../store').store;
    originalNavigate.setNavigateFunction(...args);
};


/******* PUBLIC STATIC FUNCTIONS *******/

// TODO



export { navigate };
