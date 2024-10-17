import React from 'react';

export function BigDropdownBigLink(props){
    const {
        children,
        titleIcon = null,
        className = null,
        isActive = false,
        isButton = false,
        ...passProps // Contains: `href`, `rel`, `onClick`, etc.
    } = props;

    if (!children) return null;

    const textCol = (
        <div className="col">
            { children }
        </div>
    );

    let iconCol = null;

    if (typeof titleIcon === "string") {
        iconCol = (
            <div className="col-auto icon-beside-column text-end">
                <i className={"icon icon-fw icon-2x icon-" + titleIcon}/>
            </div>
        );
    } else if (React.isValidElement(titleIcon)){
        iconCol = (
            <div className="col-auto icon-beside-column text-end">
                { titleIcon }
            </div>
        );
    }

    if (!isButton) {
        return (
            <a {...passProps} className={"big-link" + (className? " " + className : "") + (isActive? " active" : "")}>
                <div className="row align-items-center">
                    { iconCol }
                    { textCol }
                </div>
            </a>
        );
    }
    return (
        <div {...passProps} className={"big-link" + (className? " " + className : "") + (isActive? " active" : "")}>
            <div className="row align-items-center">
                { iconCol }
                { textCol }
            </div>
        </div>
    );
}