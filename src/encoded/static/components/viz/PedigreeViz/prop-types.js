import PropTypes from 'prop-types';

/**
 * @typedef DatasetEntry
 * @type {Object}
 * @prop {!(string|number)} id          Unique Identifier of Individual within dataset.
 * @prop {string} [name]                Publicly visible name of Individual/Node.
 * @prop {string} gender                Should be one of "m", "f", or "u".
 * @prop {?number} [age]                Should be calculated from date of birth to be in context of today.
 * @prop {?string[]} [diseases]         List of diseases affecting the individual.
 * @prop {!boolean} [isProband]         If true, identifies the proband individual.
 * @prop {!boolean} [isDeceased]        If true, then Individual is deceased.
 * @prop {!string} [causeOfDeath]       Describes cause of death.
 * @prop {!boolean} [isConsultand]      If true, Individual is seeking consultation.
 * @prop {?boolean} [isStillBirth]      If present & true, deceased must also be truthy _and_ must have no children.
 * @prop {?boolean} [isPregnancy]       If present & true, this individual is not yet born.
 * @prop {?boolean} [isSpontaneousAbortion] `isPregnancy` must also be `true`.
 * @prop {?boolean} [isTerminatedPregnancy] `isPregnancy` must also be `true`.
 * @prop {?boolean} [isEctopic]         `isPregnancy` must also be `true`.
 * @prop {?Object} [data]               Additional or raw data of the Individual which may not be relevant in pedigree. Would only appear in detailpane.
 *
 * @prop {string[]} [parents]           List of parents of Individual in form of IDs.
 * @prop {?string[]} [children]         List of children of Individual in form of IDs.
 * @prop {!string} [father]             Father of Individual in form of ID. Gets merged into 'parents'.
 * @prop {!string} [mother]             Mother of Individual in form of ID. Gets merged into 'parents'.
 */

export const graphTransformerPropTypes = {
    dataset: PropTypes.arrayOf(PropTypes.exact({
        'id'                : PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
        'name'              : PropTypes.string,
        'gender'            : PropTypes.oneOf(["m", "M", "male", "f", "F", "female", "u", "U", "undetermined"]).isRequired,
        'age'               : PropTypes.number,
        'diseases'          : PropTypes.arrayOf(PropTypes.string),
        'carrierOfDiseases' : PropTypes.arrayOf(PropTypes.string),
        'asymptoticDiseases': PropTypes.arrayOf(PropTypes.string),
        'isProband'         : PropTypes.bool,
        'isDeceased'        : PropTypes.bool,
        'isConsultand'      : PropTypes.bool,
        'isPregnancy'       : PropTypes.bool,
        'isStillBirth'      : PropTypes.bool,
        'isSpontaneousAbortion' : PropTypes.bool,
        'isTerminatedPregnancy' : PropTypes.bool,
        'isEctopic'         : PropTypes.bool,
        'data'              : PropTypes.object,
        'parents'           : PropTypes.arrayOf(PropTypes.oneOfType([ PropTypes.string, PropTypes.number ])),
        'children'          : PropTypes.arrayOf(PropTypes.oneOfType([ PropTypes.string, PropTypes.number ])),
        'mother'            : PropTypes.oneOfType([ PropTypes.string, PropTypes.number ]),
        'father'            : PropTypes.oneOfType([ PropTypes.string, PropTypes.number ]),
    })),
    dimensionOpts: PropTypes.objectOf(PropTypes.number),
    filterUnrelatedIndividuals: PropTypes.bool
};

export const pedigreeVizViewPropTypes = {
    height: PropTypes.number,
    width: PropTypes.number,
    onNodeSelected: PropTypes.func,
    renderDetailPane: PropTypes.func,
};

export const pedigreeVizPropTypes = {
    ...graphTransformerPropTypes,
    ...pedigreeVizViewPropTypes
};
