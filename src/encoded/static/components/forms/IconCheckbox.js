import React from 'react';
import { console } from '@hms-dbmi-bgm/shared-portal-components/es/components/util';


/** Must be a controlled checkbox */
export function IconCheckbox (props) {
    const {
        // Could also be a radio input, if "name" prop also passed in.
        type = "checkbox",
        checked = false,
        disabled = false,
        className = "mx-0 my-0 d-inline-block",
        iconCommonClassName = "",
        iconOn = "check-square fas",
        iconOff = "square far",
        iconOnColor = "primary",
        iconOffColor = "secondary",
        // passProps should include onChange, name, and any other input-element-specific props.
        ...passProps
    } = props;

    const iconClassList = ["icon"];
    if (iconCommonClassName){
        iconClassList.push(iconCommonClassName);
    }
    iconClassList.push("icon-" + (checked ? iconOn : iconOff));
    iconClassList.push("text-" + (disabled ? "muted" : checked ? iconOnColor : iconOffColor));

    return (
        <label className={className}>
            <input {...passProps} {...{ type, checked, disabled }} className="d-none" />
            <i className={iconClassList.join(" ")}/>
        </label>
    );
}
