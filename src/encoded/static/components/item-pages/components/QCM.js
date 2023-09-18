'use strict';

import React, { useState } from 'react';

import { capitalize } from '@hms-dbmi-bgm/shared-portal-components/es/components/util/value-transforms';

import { flagToBootstrapClass } from '../../util/item';
import QuickPopover from './QuickPopover';

export function QCMFlag({ type, title, cls = "m-0 ml-1" }) {
    if (!title || !type) return null;

    const alertClass = type === "warn" ? "warning" : "danger";

    return (
        <div data-flag={type} className={`qcm-flag alert alert-${alertClass} py-1 px-3 text-small border-0 d-flex align-items-center justify-items-center ${cls}`} role="alert">
            <span className="d-none d-lg-block text-truncate">{qcmFieldNameToDisplay(title)}</span>
            <i className={`icon icon-flag fas text-${flagToBootstrapClass(alertClass)} ml-05`} />
        </div>
    );
}

function qcmFieldNameToDisplay(field = "") {
    switch (field) {
        // Special cases
        case "de_novo_fraction":
            return "De novo Fraction";
        case "transition_transversion_ratio":
            return "Transition-Transversion";
        case "heterozygosity_ratio":
            return "Heterozygosity";
        // Should suffice for most other cases... just split and capitalize each word
        // case "total_reads":
        // case "total_variants_called":
        // case "filtered_variants":
        // case "filtered_structural_variants":
        // case "coverage":
        // case "predicted_sex":
        // case "predicted_ancestry":
        default:
            return field.split("_").map((word) => capitalize(word)).join(" ");
    }
}

/**
 * Snippet for showing a single row in a BioinfoStats table (used in Bioinformatics tabs for displaying
 * quality control metrics)
 * @param {string} tooltip - Tooltip data (typically from schema) to display (if blank, no tooltip shown unless popoverContent present)
 * @param {string} label - What quality metric/stat is being displayed
 * @param {JSX} children - Value to display
 * @param {string | JSX} popoverContent - What to display in the popover (if blank, no popover icon is shown)
 * @returns JSX
 */
export function BioinfoStatsEntry(props) {
    const { tooltip, label = "", children, popoverContent = null } = props;
    const id = "biostatsentry_" + label.split(" ").join("_");
    return (
        <div className="col-12 col-md-6 col-lg-3 col-xl-3 py-2">
            <div className="qc-summary">
                <label className="d-inline mb-0" htmlFor={id}>
                    {label && <>{label}:</>}
                    {!popoverContent && tooltip ?
                        <i className="icon icon-info-circle fas icon-fw ml-05"
                            data-tip={tooltip} data-place="right" />
                        : null}
                </label>
                {popoverContent ? <QuickPopover popID={label} tooltip={tooltip || "Click for more info"} className="p-0 ml-05">{popoverContent}</QuickPopover> : null}
                <div {...{ id }}>{children}</div>
            </div>
        </div>
    );
}
