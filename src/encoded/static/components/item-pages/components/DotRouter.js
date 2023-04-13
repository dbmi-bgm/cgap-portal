'use strict';

import React, { useState, useMemo, useCallback, useEffect, useContext } from 'react';
import _ from 'underscore';
import memoize from 'memoize-one';
import url from 'url';

import { navigate } from '@hms-dbmi-bgm/shared-portal-components/es/components/util';

import { TabPaneErrorBoundary } from './../components/TabView';

/**
 * Allows for the creation of tabbed views within Item pages that can be accessed by using
 * a "dot path". Ex. (/case/<id>/#overview.bioinformatics will route users to the bioinformatics
 * tab on case load while /case/<id>/#overview will route users to the accessioning tab or other default view).
 *
 * Used in CaseView and AnalysisView.
 */
export class DotRouter extends React.PureComponent {

    static getDotPath(href) {
        // Path must contain both tab (hashroute) and dotpath to navigate properly
        const hashString = (url.parse(href, false).hash || "#").slice(1) || null;

        // Handle the case where there's no dot path
        if (!hashString || hashString.indexOf(".") < 0) return null;

        const dotPathSplit = hashString.split(".");
        return "." + dotPathSplit[dotPathSplit.length - 1];
    }

    static getDefaultTab(children) {
        const childrenLen = children.length;

        if (childrenLen === 0) {
            throw new Error("Must provide children and ideally default tab to DotRouter via props.");
        }

        let defaultChildTab = null;

        for (var i = 0; i < childrenLen; i++) {
            const currChild = children[i];
            if (currChild.props.disabled) {
                continue;
            }
            defaultChildTab = currChild;
            if (currChild.props.default === true) {
                break;
            }
        }

        // If no default found, use last non-disabled tab.
        return defaultChildTab;
    }

    static defaultProps = {
        "className": null,
        "navClassName": "container-wide",
        "contentsClassName": "container-wide",
        "elementID": "dot-router"
    };

    constructor(props) {
        super(props);
        this.getCurrentTab = this.getCurrentTab.bind(this);
        this.memoized = {
            getDefaultTab: memoize(DotRouter.getDefaultTab),
            getDotPath: memoize(DotRouter.getDotPath)
        };
    }

    /**
     * Method is not explicitly memoized b.c. this component only has 2 props & is a PureComponent itself
     */
    getCurrentTab() {
        const { children, href } = this.props;
        const dotPath = this.memoized.getDotPath(href);

        if (dotPath) {
            for (let i = 0; i < children.length; i++) {
                const currChild = children[i];
                if (currChild.props.dotPath === dotPath && !currChild.props.disabled) {
                    // Maybe consider removing `&& !currChild.props.disabled` check from if condition
                    // for UX-URL consistency (show case review tab if go there, even if nothing to show).
                    return currChild;
                }
            }
        }

        return this.memoized.getDefaultTab(children);
    }

    render() {
        const { children, className, prependDotPath, navClassName, contentsClassName, elementID, isActive = true } = this.props;
        const currentTab = this.getCurrentTab();
        const { props: { dotPath: currTabDotPath } } = currentTab; // Falls back to default tab if not in hash.
        // const contentClassName = "tab-router-contents" + (contentsClassName ? " " + contentsClassName : "");
        const allTabContents = [];

        const adjustedChildren = React.Children.map(children, function (childTab, index) {
            const {
                props: {
                    dotPath,
                    children: tabChildren,
                    cache = false,
                    contentsClassName: overridingContentsClassName
                }
            } = childTab;

            const active = isActive && (currTabDotPath === dotPath);

            if (active || cache) {
                // If we cache tab contents, then pass down `props.isActiveDotRouterTab` so select downstream components
                // can hide or unmount themselves when not needed for performance.
                const transformedChildren = !cache ? tabChildren : React.Children.map(tabChildren, (child) => {
                    if (!React.isValidElement(child)) {
                        // String or something
                        return child;
                    }
                    if (typeof child.type === "string") {
                        // Normal element (a, div, etc)
                        return child;
                    } // Else is React component
                    return React.cloneElement(child, { "isActiveDotRouterTab": active });
                });
                const clsSuffix = overridingContentsClassName || contentsClassName || null;
                const cls = "tab-router-contents" + (clsSuffix ? " " + clsSuffix : "") + (!active ? " d-none" : "");
                allTabContents.push(
                    <div className={cls}
                        id={(prependDotPath || "") + dotPath}
                        data-tab-index={index} key={dotPath}>
                        <TabPaneErrorBoundary>
                            {transformedChildren}
                        </TabPaneErrorBoundary>
                    </div>
                );
            }

            return React.cloneElement(childTab, { "key": dotPath, active, prependDotPath, index });
        });

        return (
            <div className={"tab-router" + (className ? " " + className : "")} id={elementID}>
                <nav className={"dot-tab-nav" + (navClassName ? " " + navClassName : "")}>
                    <div className="dot-tab-nav-list">
                        {adjustedChildren}
                    </div>
                </nav>
                {allTabContents}
            </div>
        );
    }
}

export const DotRouterTab = React.memo(function DotRouterTab(props) {
    const {
        tabTitle,
        dotPath,
        disabled = false,
        active,
        prependDotPath,
        children,
        className = "",
        ...passProps
    } = props;

    const onClick = useCallback(function () {
        const targetDotPath = prependDotPath + dotPath;
        const navOpts = { "skipRequest": true, "replace": true, "dontScrollToTop": true };
        navigate("#" + targetDotPath, navOpts, function () {
            // Maybe uncomment - this could be annoying if someone is also trying to keep Status Overview visible or something.
            // layout.animateScrollTo(targetDotPath);
        });
    }, []); // Previously was: [ prependDotPath, dotPath ] -- removed for now since these are hardcoded and don't change. IMPORTANT: REVERT IF THESE BECOME DYNAMIC.

    if (!React.isValidElement(children)) {
        throw new Error("Expected children to be present and valid JSX");
    }

    return (
        <button type="button" onClick={disabled ? null : onClick} disabled={disabled}
            className={"arrow-tab" + (disabled ? " disabled " : "") + (active ? " active" : "")}>
            <div className="btn-prepend d-xs-none">
                <svg viewBox="0 0 1.5875 4.2333333" width={6} height={16}>
                    <path d="M 0,4.2333333 1.5875,2.1166667 v 2.1166666 z" />
                    <path d="M 0,3.3e-6 1.5875,0 v 2.1166667 z" />
                </svg>
            </div>
            <div className="btn-title">{tabTitle}</div>
            <div className="btn-append d-xs-none">
                <svg viewBox="0 0 1.5875 4.2333333" width={6} height={16}>
                    <path d="M 0,3.3e-6 1.5875,2.1166733 0,4.2333333 Z" />
                </svg>
            </div>
        </button>
    );
}, function (prevProps, nextProps) {
    // Custom equality comparison func.
    // Skip comparing the hardcoded `prependDotPath` & `dotPath` -- revert if those props become dynamic.
    // Also skip checking for props.children, since that is rendered by `DotRouter` and not this `DotRouterTab`.
    const compareKeys = ["disabled", "active", "tabTitle"];
    const anyChanged = _.any(compareKeys, function (k) {
        return prevProps[k] !== nextProps[k];
    });
    return !anyChanged;
});
