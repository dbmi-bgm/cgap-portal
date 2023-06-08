'use strict';
/**
 * A set of tiny utilities that are shared among CGAP's item pages
 * like Case, VariantSample, SomaticAnalysis, etc.
 */


/**
 * Converts the long form name for the sex of an individual into short
 * form for display in tables in Bioinfo Tabs
 * @param {String} sex Should be one of "male" | "female" | "unknown" | "undetermined"
 * @returns String
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

/**
 * Used by <QCMFlag> to convert the raw value for the QCM's flag value into
 * the class used to render the flag color in bootstrap
 * @param {String} flag Should be one of "pass" | "fail" | "warn"
 * @returns String
 */
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

/**
 * Takes in the relationships array and creates a mapping of individual IDs to objects containing
 * sex and role/relationship information. Used in columnExtensionMap and Case BioinformaticsTab.
 * @param {Object[]} relationshipsFromCanonicalFamily Array of objects containing relationship, sex, and individual.
 * @returns Object where keys are individual IDs and values are objects containing sex and role/relationship
 */
export function generateRelationshipMapping(relationshipsFromCanonicalFamily) {

    // Create a mapping of individuals to relationship and sex
    const relationshipMapping = {};
    relationshipsFromCanonicalFamily.forEach((item) => {
        const { relationship = null, sex = null, individual = null } = item;
        relationshipMapping[individual] = { sex, relationship };
    });

    return relationshipMapping;
}

/**
 * Sorts a list of QCMs in order with proband, mother, and father first, then other family members.
 * Also adds some additional key/value pairs to these QCMs for ease of use.
 * @TODO Group multiple samples by Individual
 * @param {Object[]} qcms Array of quality control metric objects
 * @param {Object} relationshipMapping Object where keys are individual IDs and values are objects containing sex and role/relationship
 *                                     Generated by generateRelationshipMapping above.
 * @returns sorted array of qcms w/new atID and role keys
 */
export function sortAndAddRolePropsToQCMs(qcms = [], relationshipMapping) {
    // Add the new properties to the item without sorting
    if (qcms.length === 1) {
        const { 0: { individual_accession: thisAccession } = {} } = qcms;

        const atID = `/individuals/${thisAccession}/`;
        const relation = relationshipMapping[thisAccession]?.relationship;

        qcms[0].atID = atID;
        qcms[0].role = relation;

        return qcms;
    }

    // Specify which order to put roles in
    const exceptions = {
        "proband": 1,
        "mother": 2,
        "father": 3
    };

    // Otherwise do sort
    return qcms.sort((a, b) => {
        const { individual_accession: aAccession } = a;
        const { individual_accession: bAccession } = b;

        const atIDA = `/individuals/${aAccession}/`;
        const atIDB = `/individuals/${bAccession}/`;

        // Find relationships
        const relationA = relationshipMapping[aAccession]?.relationship;
        const relationB = relationshipMapping[bAccession]?.relationship;

        // Add props to QCMS for future use
        a.atID = atIDA;
        b.atID = atIDB;
        a.role = relationA;
        b.role = relationB;

        // Sort by proband first, then by mother and father
        if (exceptions[relationA] && exceptions[relationB]) {
            return exceptions[relationA] - exceptions[relationB];
        } else if (exceptions[relationA]) {
            return -1;
        } else if (exceptions[relationB]) {
            return -1;
        } else {
            // Sort leftovers alphabetically
            return relationA.localeCompare(relationB);
        }
    });
}