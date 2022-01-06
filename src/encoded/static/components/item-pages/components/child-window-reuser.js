'use strict';


let childWindow = null;


/**
 * Reusable function that will navigate a child window if one exists already,
 * else opens new one. Maintains just one child window instance for entire app.
 *
 * @todo
 * Possibly add support for more simultaneous child windows if this becomes useful/requirement.
 * Probably cleanup references to old/closed windows somehow if do this.
 */
export function navigateChildWindow(targetHref) {
    const childWindowNavigate = childWindow && !childWindow.closed;
    if (childWindowNavigate) {
        childWindow.postMessage({ "action" : "navigate", "value": targetHref });
        childWindow.focus();
    } else {
        childWindow = window.open(
            targetHref,
            'child-window',
            "directories=0,titlebar=0,toolbar=0,menubar=0,width=1200,height=900"
        );
    }
}

export function onClickLinkNavigateChildWindow(e){
    e.stopPropagation();
    e.preventDefault();
    const targetHref = (e.currentTarget || e.target).href;
    if (typeof targetHref !== "string") {
        return false;
    }
    navigateChildWindow(targetHref);
    return false;
}
