'use strict';
/**
 * A set of tiny utilities that are shared among CGAP's item pages
 * like Case, VariantSample, SomaticAnalysis, etc.
 */


export const mapLongFormSexToLetter = (sex) => {
    if (!sex) { return; }

    // Ensure it's lowercase
    const sexLower = sex.toLowerCase();

    switch (sexLower) {
        case "male":
            return "M";
        case "female":
            return "F";
        case "unknown":
        case "undetermined":
            return "U";
        default:
            // unexpected value... render as-is
            return sex;
    }
};

export const flagToBootstrapClass = (flag) => {
    switch (flag) {
        case "pass":
            return "success";
        case "fail":
            return "danger";
        case "warn":
            return "warning";
        default:
            return "";
    }
};