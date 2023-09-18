import React from 'react';
import PropTypes from 'prop-types';

import Popover  from 'react-bootstrap/esm/Popover';
import OverlayTrigger from 'react-bootstrap/esm/OverlayTrigger';

export default function QuickPopover(props) {
    const { title = null, children = [], className, popID, tooltip, placement = "auto", htmlContent } = props || {};

    const popoverContent = children.length === 0 ?
        // HTML content is NOT santized; do not use with user-submitted input.
        // In future, will need to pass this through static section (now only used in VariantTabBody with
        // extended description HTML from schema)
        <div dangerouslySetInnerHTML={{ __html: htmlContent }} /> : children;

    const popover = (
        <Popover id={popID}>
            {title ? <Popover.Title className="m-0" as="h4">{title}</Popover.Title> : null}
            <Popover.Content>
                { popoverContent }
            </Popover.Content>
        </Popover>
    );
    const cls = "btn btn-link text-decoration-none" + (className ? " " + className : "");
    return (
        <OverlayTrigger trigger="click" overlay={popover} rootClose rootCloseEvent="click" {...{ placement }}>
            { function({ ref, ...triggerHandlers }){
                return (
                    <button type="button" ref={ref} { ...triggerHandlers } className={cls} data-tip={tooltip || "Click for more information"}>
                        <i className="icon icon-info-circle fas" />
                    </button>
                );
            }}
        </OverlayTrigger>
    );
}