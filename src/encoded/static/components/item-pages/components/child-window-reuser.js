'use strict';


const childWindowByName = {};

/**
 * Reusable function that will navigate a child window if one exists already,
 * else opens new one. Maintains just one child window instance for entire app,
 * if postMessage=true is used.
 *
 * @todo
 * Possibly add support for more simultaneous child windows if this becomes useful/requirement.
 * Probably cleanup references to old/closed windows somehow if do this.
 */
export function navigateChildWindow(targetHref, windowName = null, postMessage = true) {
    const childWindowName = windowName && typeof windowName === "string" ? windowName : "global";
    const childWindow = childWindowByName[childWindowName] || null;
    const childWindowOpen = childWindow && !childWindow.closed;
    if (childWindowOpen && postMessage) {
        childWindow.postMessage({ "action" : "navigate", "value": targetHref });
        childWindow.focus();
    } else {
        childWindowByName[childWindowName] = window.open(
            targetHref,
            "cw-" + childWindowName,
            "width=1200,height=900"
        );
    }
}

export function onClickLinkNavigateChildWindow(e){
    e.stopPropagation();
    e.preventDefault();
    const useEvtTarget = e.currentTarget || e.target;
    const childWindowName = useEvtTarget.getAttribute("data-child-window") || null;
    const childWindowPostMessage = !(useEvtTarget.getAttribute("data-child-window-message") === "false");
    const targetHref = useEvtTarget.href;
    if (!targetHref || typeof targetHref !== "string" || targetHref === "#") {
        return false;
    }
    navigateChildWindow(targetHref, childWindowName, childWindowPostMessage);
    return false;
}
