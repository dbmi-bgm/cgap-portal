import React from 'react';
import PropTypes from 'prop-types';

import Popover  from 'react-bootstrap/esm/Popover';
import OverlayTrigger from 'react-bootstrap/esm/OverlayTrigger';

export default function QuickPopover(props) {
    const { title = null, children, className, popID, tooltip, placement } = props || {};
    const popover = (
        <Popover id={popID}>
            {title ? <Popover.Title className="m-0" as="h4">{title}</Popover.Title> : null}
            <Popover.Content>
                { children }
            </Popover.Content>
        </Popover>
    );
    const cls = "btn btn-link text-decoration-none" + (className ? " " + className : "");
    return (
        <OverlayTrigger trigger="focus" overlay={popover} {...{ placement }}>
            { function({ ref, ...triggerHandlers }){
                return (
                    <button type="button" ref={ref} { ...triggerHandlers } className={cls} data-tip={tooltip || "Click for citation info"}>
                        <i className="icon icon-info-circle fas" />
                    </button>
                );
            }}
        </OverlayTrigger>
    );
}