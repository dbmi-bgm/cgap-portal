'use strict';
import _ from 'underscore';

const childWindowByName = {};

const cleanupChildWindowsDebounced = _.debounce(
    function () {
        Object.keys(childWindowByName).forEach(function (k) {
            if (childWindowByName[k].closed) {
                delete childWindowByName[k];
            }
        });
    },
    5000,
    false
);

/**
 * Reusable function that will navigate a child window if one exists already,
 * else opens new one. Maintains just one child window instance for entire app,
 * if postMessage=true is used.
 *
 * @todo
 * Possibly add support for more simultaneous child windows if this becomes useful/requirement.
 * Probably cleanup references to old/closed windows somehow if do this.
 */
export function navigateChildWindow(
    targetHref,
    windowName = null,
    postMessage = true
) {
    const childWindowName =
        windowName && typeof windowName === 'string' ? windowName : 'global';
    const childWindow = childWindowByName[childWindowName] || null;
    const childWindowOpen = childWindow && !childWindow.closed;
    if (childWindowOpen && postMessage) {
        childWindow.postMessage({ action: 'navigate', value: targetHref });
        childWindow.focus();
    } else {
        childWindowByName[childWindowName] = window.open(
            targetHref,
            'cw-' + childWindowName
            // "width=1200,height=900"
        );
    }

    // Cleanup references in background when possible.
    // 'childWindowByName' is a global-scope variable/store and itself never re-instantiated.
    cleanupChildWindowsDebounced();
}

function onClickCommonHandler(e) {
    e.stopPropagation();
    e.preventDefault();
    const useEvtTarget = e.currentTarget || e.target;
    const childWindowName =
        useEvtTarget.getAttribute('data-child-window') || null;
    const childWindowPostMessage = !(
        useEvtTarget.getAttribute('data-child-window-message') === 'false'
    );
    const targetHref =
        useEvtTarget.getAttribute('href') ||
        useEvtTarget.getAttribute('data-href') ||
        null;
    if (!targetHref || typeof targetHref !== 'string' || targetHref === '#') {
        throw new Error('Expected a target href');
    }
    return { childWindowName, childWindowPostMessage, targetHref };
}

export function onClickLinkNavigateChildWindow(e) {
    const { childWindowName, childWindowPostMessage, targetHref } =
        onClickCommonHandler(e);
    navigateChildWindow(targetHref, childWindowName, childWindowPostMessage);
    return false;
}

let newWindowCounter = 0;

/**
 * Always opens a new child window, rather than re-using existing one.
 */
export function openNewChildWindow(targetHref, postMessage) {
    const currentCount = newWindowCounter++;
    console.log('Openining window', currentCount);
    return navigateChildWindow(targetHref, 'nw-' + currentCount, postMessage);
}

export function onClickOpenNewChildWindow(e) {
    const { childWindowPostMessage, targetHref } = onClickCommonHandler(e);
    openNewChildWindow(targetHref, childWindowPostMessage);
    return false;
}
