import { configureStore, combineReducers } from '@reduxjs/toolkit';
import _ from 'underscore';

// Create a redux store to manage state for the whole application
// Not sure why everything is saved to & reduced from `action.type` but w/e .. this could likely
// be refactored further in future

const reducers = {
    href: function (state = '', action) {
        switch (action.type) {
            case 'SET_HREF':
                return action.payload || state;
            default:
                return state;
        }
    },

    context: function (state = {}, action) {
        switch (action.type) {
            case 'SET_CONTEXT':
                return action.payload || state;
            default:
                return state;
        }
    },

    lastBuildTime: function (state = '', action) {
        switch (action.type) {
            case 'SET_LAST_BUILD_TIME':
                return action.payload || state;
            default:
                return state;
        }
    },

    slow: function (state = false, action) {
        switch (action.type) {
            case 'SET_SLOW':
                return action.payload;
            default:
                return state;
        }
    },

    alerts: function (state = [], action) {
        switch (action.type) {
            case 'SET_ALERTS':
                return action.payload || state;
            default:
                return state;
        }
    },
};

const rootReducer = (state, action) => {
    switch (action.type) {
        case 'BATCH_ACTIONS':
            return action.payload.reduce((currentState, batchAction) => {
                return rootReducer(currentState, batchAction);
            }, state);
        default:
            return combineReducers(reducers)(state, action);
    }
};

const store = configureStore({
    reducer: rootReducer,
    middleware: (getDefaultMiddleware) =>
        getDefaultMiddleware({
            serializableCheck: false,
        })
});

export { store };

// Utility stuff (non-standard for redux)

export function mapStateToProps(currStore) {
    return _.object(_.map(_.keys(reducers), function (rfield) {
        return [rfield, currStore[rfield]];
    }));
}

export function batchDispatch(store, dict) {
    if (!store || !dict) {
        return;
    }

    const actions = [];
    if (dict.context) {
        actions.push({ type: 'SET_CONTEXT', payload: dict.context });
    }
    if (dict.href) {
        actions.push({ type: 'SET_HREF', payload: dict.href });
    }
    if (dict.lastBuildTime) {
        actions.push({ type: 'SET_LAST_BUILD_TIME', payload: dict.lastBuildTime });
    }
    if (dict.alerts) {
        actions.push({ type: 'SET_ALERTS', payload: dict.alerts });
    }
    if (typeof dict.slow === 'boolean') {
        actions.push({ type: 'SET_SLOW', payload: dict.slow });
    }
    if (actions.length > 0) {
        store.dispatch({ type: 'BATCH_ACTIONS', payload: actions });
    }
}
