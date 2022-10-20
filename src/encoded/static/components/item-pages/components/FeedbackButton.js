import React, { useMemo, useCallback } from 'react';
import _ from 'underscore';

import Dropdown from 'react-bootstrap/esm/Dropdown';
import { detect as detectBrowser } from 'detect-browser';

const EMAIL_ADDRESS = "cgap-support@hms-dbmi.atlassian.net"; // Maybe make an env var in future?

// TODO: See about converting these from literals in a way that doesn't break layout (via encodeURI as below)
const QUESTION_MAILTO = `mailto:${EMAIL_ADDRESS}?\
subject=CGAP%20Question\
&body=Feedback%20\
Type%3A%20Question%0D%0A%0D%0A\
Question%3A%0D%0A%0D%0A%0D%0A`;

const BUG_REPORT_MAILTO = `\
mailto:${EMAIL_ADDRESS}?\
subject=CGAP%20Issue\
&body=Feedback%20\
Type%3A%20Issue%2FBug%20Report%0D%0A%0D%0A\
Expected%20Behavior%3A%0D%0A%0D%0A%0D%0A\
Actual%20Behavior%3A%0D%0A%0D%0A%0D%0A\
Steps%20to%20Reproduce%20the%20Problem%3A%0D%0A%0D%0A%0D%0A`;

const FEEDBACK_MAILTO = `mailto:${EMAIL_ADDRESS}?\
subject=CGAP%20Feedback\
&body=Feedback%20\
Type%3A%20General%20Feedback%0D%0A%0D%0A\
Comments%3A%0D%0A%0D%0A%0D%0A`;

export default function FeedbackButton(props) {
    const { variant = "link", dropCls = "navbar-nav", toggleCls = "text-decoration-none rounded-0" } = props;

    const browserInfo = detectBrowser();
    const { name: browserName = null, version = null, os = null } = browserInfo || {};
    const browser = encodeURI(`${browserName} ${version ? "v" + version : ""}`);

    // TODO: convert with encodeURI instead
    const SPECIFICATIONS = `Browser%3A%20${browser}%0D%0AOperating%20System%3A%20${os}%0D%0A`;

    return (
        <Dropdown className={dropCls}>
            <Dropdown.Toggle variant={variant} className={toggleCls} id="feedback-btn-drop">
                <i className="icon icon-question-circle fas mr-1" />
                Feedback or Issues?
            </Dropdown.Toggle>

            <Dropdown.Menu>
                <Dropdown.Item href={QUESTION_MAILTO + SPECIFICATIONS}>Question</Dropdown.Item>
                <Dropdown.Item href={BUG_REPORT_MAILTO + SPECIFICATIONS}>Issue/Bug Report</Dropdown.Item>
                <Dropdown.Item href={FEEDBACK_MAILTO + SPECIFICATIONS}>General Feedback</Dropdown.Item>
            </Dropdown.Menu>
        </Dropdown>
    );
}


