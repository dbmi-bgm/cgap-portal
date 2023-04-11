import React, { useEffect, useState } from 'react';
import { isServerSide } from '@hms-dbmi-bgm/shared-portal-components/es/components/util/misc';

/**
 * Get current grid size, if need to sidestep CSS.
 * Keep widths in sync with stylesheet, e.g. $screen-sm-min, $screen-md-min, & $screen-lg-min
 * in src/encoded/static/scss/bootstrap/_variables.scss.
 *
 * 2019-07-10 -- updated to Bootstrap v4 breakpoints, added 'xl'.
 * 2020-10-22 -- Moved to CGAP rep, since breakpoints differ from 4DN now.
 *
 * @param {number} width - Width of the current browser _window_.
 * @return {string} - Abbreviation for column/grid Bootstrap size, e.g. 'lg', 'md', 'sm', or 'xs'.
 */
export function responsiveGridState(width = null) {
    if (typeof width !== 'number') {
        // Assumed to be null or undefined which should mean we are
        // server-side or not yet mounted.
        return 'xl';
    }
    if (width >= 1500) return 'xl';
    if (width >= 992) return 'lg';
    if (width >= 768) return 'md';
    if (width >= 576) return 'sm';
    return 'xs';
}

/**
 * Get the width of what a 12-column bootstrap '.container' would be in current viewport size.
 * Keep widths in sync with stylesheet, e.g.
 * $container-tablet - $grid-gutter-width,
 * $container-desktop - $grid-gutter-width, and
 * $container-large-desktop - $grid-gutter-width
 * in src/encoded/static/scss/bootstrap/_variables.scss.
 *
 * @param {number} [windowWidth] Optional current window width to supply.
 * @return {integer}
 */
export function gridContainerWidth(windowWidth = null) {
    // Subtract 20 for padding/margins.
    switch (responsiveGridState(windowWidth)) {
        case 'xl':
            return 1120;
        case 'lg':
            return 940;
        case 'md':
            return 700;
        case 'sm':
            return 520;
        case 'xs':
            if (isServerSide()) return 400;
            return (windowWidth || window.innerWidth) - 20;
    }
}

/**
 * Defers mounting of an element until after page render.
 * Originally used to defer loading of secondary/non-critical
 * print CSS stylesheet.
 * @todo Move to SPC.
 */
export function DeferMount(props) {
    const { children, delay = 250, onMount = null } = props;
    const [isMounted, setIsMounted] = useState(false);
    useEffect(function () {
        setTimeout(function () {
            setIsMounted(true);
            if (onMount) {
                onMount();
            }
        }, delay);
    }, []); // Run once after mount;
    if (isMounted) {
        return children;
    }
    return null;
}
