'use strict';

import { useCallback } from 'react';




let childWindow = null;


/**
 * Reusable hook which will navigate a child window if one exists already, else opens new one.
 * Maintains just one child window instance.
 *
 * @todo
 * Possibly add support for more simultaneous child windows if this becomes useful/requirement.
 * Probably cleanup references to old/closed windows somehow if do this.
 */
export function useChildWindowNavigate(){

    const navigateInChildWindow = useCallback(function (targetHref){
        const childWindowNavigate = childWindow && !childWindow.closed && childWindow.fourfront && childWindow.fourfront.navigate;
        if (childWindowNavigate) {
            // Calling `childWindow.fourfront.navigate` doesn't work consistently across browsers,
            // it's an enhancement to window.open but not replacement for it.
            // Using `childWindow.postMessage` would be safer in long term if we like this UX.
            childWindowNavigate(targetHref);
            // TODO Maybe:
            // childVSWindow.postMessage({"action" : "navigate", "params" : ["/variant-samples/.../"]});
            // wherein App.js could create an event listener for posted messages with action===navigate...
            childWindow.focus();
        } else {
            childWindow = window.open(
                targetHref,
                'child-window',
                "directories=0,titlebar=0,toolbar=0,menubar=0,width=800,height=600"
            );
        }
    });

    return navigateInChildWindow;

}
