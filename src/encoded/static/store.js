import { createStore, combineReducers } from 'redux';
import _ from 'underscore';

// Create a redux store to manage state for the whole application
// Not sure why everything is saved to & reduced from `action.type` but w/e .. this could likely
// be refactored further in future

export const reducers = {

    'href' : function(state='', action) {
        return (action.type && action.type.href) || state;
    },

    'context' : function(state={}, action){
        if (action.type && typeof action.type.context !== 'undefined'){
            return action.type.context ? action.type.context : state;
        } else {
            return state;
        }
    },

    'lastCSSBuildTime' : function(state='', action) {
        return (action.type && action.type.lastCSSBuildTime) || state;
    },

    'slow' : function(state=false, action) {
        if (action.type && typeof action.type.slow === 'boolean'){
            return action.type.slow;
        }
        return state;
    },

    'alerts' : function(state=[], action) {
        if (action.type && Array.isArray(action.type.alerts)){
            return action.type.alerts;
        }
        return state;
    },

    // Deprecated, from 4DN, keeping later in case helps influence
    // implementation for different role/view 'states' (idk)
    'browseBaseState' : function(state='only_4dn', action){
        return (action.type && action.type.browseBaseState) || state;
    }
};


export const store = createStore(combineReducers(reducers));

// Utility stuff (non-standard for redux)

export function mapStateToProps(currStore){
    return _.object(_.map(_.keys(reducers), function(rfield){
        return [rfield, currStore[rfield]];
    }));
}

