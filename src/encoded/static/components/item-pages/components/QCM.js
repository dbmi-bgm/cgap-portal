'use strict';

import React, { useState } from 'react';

import { capitalize } from '@hms-dbmi-bgm/shared-portal-components/es/components/util/value-transforms';

import { flagToBootstrapClass } from '../../util/item';

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
