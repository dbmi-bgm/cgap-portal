import React, { useState, useRef, useCallback } from 'react';
import PropTypes from 'prop-types';

import Popover  from 'react-bootstrap/esm/Popover';
import OverlayTrigger from 'react-bootstrap/esm/OverlayTrigger';

export default function QuickPopover(props) {
    const { title, content, className, popID, tooltip } = props || {};
    const popover = (
        <Popover id={popID}>
            <Popover.Title className="m-0" as="h4">{title}</Popover.Title>
            <Popover.Content>
                { content }
            </Popover.Content>
        </Popover>
    );
    const cls = "btn btn-link" + (className ? " " + className : "");
    return (
        <OverlayTrigger trigger="focus" placement="right" overlay={popover}>
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