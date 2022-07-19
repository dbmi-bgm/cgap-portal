import React from 'react';
import { console } from '@hms-dbmi-bgm/shared-portal-components/es/components/util';


/** Must be a controlled checkbox */
export function IconCheckbox (props) {
    const {
        type = "checkbox",
        checked = false,
        disabled = false,
        className = "mx-0 my-0 d-inline-block",
        iconCommonClassName = "",
        iconOn = "check-square fas",
        iconOff= "square far",
        iconOnColor = "primary",
        iconOffColor = "secondary",
        ...passProps
    } = props;

    const iconCls = (
        "icon"
        + (iconCommonClassName ? " " + iconCommonClassName : "")
        + " icon-" + (checked ? iconOn : iconOff)
        + (disabled ? " text-muted" : checked ? " text-" + iconOnColor : " text-" + iconOffColor)
    );

    return (
        <label className={className}>
            <input {...passProps} {...{ type }} className="d-none" />
            <i className={iconCls}/>
        </label>
    );
}
