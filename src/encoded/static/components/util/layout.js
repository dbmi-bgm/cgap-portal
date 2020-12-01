

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
export function responsiveGridState(width = null){
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
