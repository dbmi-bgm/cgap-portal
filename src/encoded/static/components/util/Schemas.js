'use strict';

import _ from 'underscore';
import React from 'react';
import memoize from 'memoize-one';

import { linkFromItem } from '@hms-dbmi-bgm/shared-portal-components/es/components/util/object';
import {
    LocalizedTime,
    format as dateFormat,
} from '@hms-dbmi-bgm/shared-portal-components/es/components/ui/LocalizedTime';
import { patchedConsoleInstance as console } from '@hms-dbmi-bgm/shared-portal-components/es/components/util/patched-console';
import {
    getTitleForType,
    getSchemaProperty,
} from '@hms-dbmi-bgm/shared-portal-components/es/components/util/schema-transforms';
import {
    capitalize,
    capitalizeSentence,
    bytesToLargerUnit,
    roundLargeNumber,
    roundDecimal,
    hrefToFilename,
} from '@hms-dbmi-bgm/shared-portal-components/es/components/util/value-transforms';

let cachedSchemas = null;

/**
 * Should be set by app.js to return app.state.schemas
 *
 * @type {function}
 */
export function get() {
    return cachedSchemas;
}

export function set(schemas) {
    cachedSchemas = schemas;
    return true;
}

export const Term = {
    toName: function (
        field,
        term,
        allowJSXOutput = false,
        addDescriptionTipForLinkTos = true
    ) {
        if (
            allowJSXOutput &&
            typeof term !== 'string' &&
            term &&
            typeof term === 'object'
        ) {
            // Object, probably an item.
            return linkFromItem(term, addDescriptionTipForLinkTos);
        }

        let name = null;

        const termTranslateFunc = fieldToTransformationDict()[field];

        if (termTranslateFunc) {
            return termTranslateFunc(term);
        }

        // Custom stuff - todo consider converting to dict lookup also
        if (field.indexOf('quality_metric.') > -1) {
            if (field.slice(-11) === 'Total reads')
                return roundLargeNumber(term);
            if (field.slice(-15) === 'Total Sequences')
                return roundLargeNumber(term);
            if (field.slice(-14) === 'Sequence length')
                return roundLargeNumber(term);
            if (field.slice(-15) === 'Cis/Trans ratio')
                return roundDecimal(term) + '%';
            if (field.slice(-35) === '% Long-range intrachromosomal reads')
                return roundDecimal(term) + '%';
            if (field.slice(-4) === '.url' && term.indexOf('http') > -1) {
                var linkTitle = hrefToFilename(term); // Filename most likely for quality_metric.url case(s).
                if (allowJSXOutput) {
                    return (
                        <a
                            href={term}
                            target="_blank"
                            rel="noopener noreferrer">
                            {linkTitle}
                        </a>
                    );
                } else {
                    return linkTitle;
                }
            }
        }

        // Fallback
        if (typeof name !== 'string') name = term;

        return name;
    },

    genderCharacterToIcon(gender) {
        const m = {
            M: 'mars fas',
            F: 'venus fas',
            U: 'question fas',
        };
        return m[gender];
    },
};

/** Globally memoized, since creation of object is expensive part of obj lookup */
const fieldToTransformationDict = memoize(function () {
    function returnLocalizedTime(term, allowJSXOutput) {
        if (allowJSXOutput) {
            return <LocalizedTime timestamp={term} localize={false} />;
        }
        return dateFormat(term);
    }

    function returnTerm(term, allowJSXOutput) {
        return term;
    }

    function returnBoolean(term, allowJSXOutput) {
        if (typeof term === 'boolean') {
            // Boolean, or undefined to be considered as "false"
            return (term && 'True') || 'False';
        }
        if (typeof term === 'undefined') {
            return 'False';
        }
        // Common cases, e.g. from search result:
        if (term === 'true') return 'True';
        if (term === 'false') return 'False';
        if (term === 'No value') return term; // Ideally could have this as "False" but then get 2+ "False" values in list of Facet terms.
        return term;
    }

    function returnFileSize(term, allowJSXOutput) {
        let val = term;
        if (typeof term === 'number') {
            val = term;
        } else if (!isNaN(parseInt(term))) {
            val = parseInt(term);
        }
        if (typeof val === 'number' && !isNaN(val)) {
            return bytesToLargerUnit(val);
        } else {
            return null;
        }
    }

    const exactFieldNameDict = {
        '@id': returnTerm,
        type: function (term, allowJSXOutput) {
            return getTitleForType(term, get());
        },
        status: function (term, allowJSXOutput) {
            if (allowJSXOutput) {
                return (
                    <React.Fragment>
                        <i
                            className="status-indicator-dot mr-07"
                            data-status={term}
                        />
                        {capitalizeSentence(term)}
                    </React.Fragment>
                );
            }
            return capitalizeSentence(term);
        },
        date_created: returnLocalizedTime,
        'last_modified.date_modified': returnLocalizedTime,
        date_modified: returnLocalizedTime,
        public_release: returnLocalizedTime,
        project_release: returnLocalizedTime,
        approved_date: returnLocalizedTime,
        accession: returnTerm,
        /** Fields that are lowercase with underscores but could be ~ proper nouns otherwise */
        'project_roles.project': function (term, allowJSXOutput) {
            if (typeof term !== 'string') return term;
            return term.split('_').map(capitalize).join(' ');
        },
        gene_biotype: function (term, allowJSXOutput) {
            if (typeof term !== 'string') return term;
            return term.split('_').map(capitalize).join(' ');
        },
        /** Related to Individual Items, mostly: */
        is_pregnancy: returnBoolean,
        is_spontaneous_abortion: returnBoolean,
        is_infertile: returnBoolean,
        is_termination_of_pregnancy: returnBoolean,
        is_still_birth: returnBoolean,
        is_deceased: returnBoolean,
        sex: function (term, allowJSXOutput) {
            let txtName = null;
            if (term === 'M') txtName = 'Male';
            if (term === 'F') txtName = 'Female';
            if (term === 'U') txtName = 'Undetermined';
            if (allowJSXOutput) {
                return (
                    <React.Fragment>
                        <i
                            className={`mr-03 icon icon-fw icon-${Term.genderCharacterToIcon(
                                term
                            )}`}
                        />
                        {txtName}
                    </React.Fragment>
                );
            }
            return txtName;
        },
        file_type: capitalizeSentence,
        file_classification: capitalizeSentence,
        file_type_detailed: capitalizeSentence,
        'files.file_type': capitalizeSentence,
        'files.file_classification': capitalizeSentence,
        'files.file_type_detailed': capitalizeSentence,
        ancestry: capitalizeSentence,
        life_status: capitalize,
        'project_roles.role': capitalize,
        file_size: returnFileSize,
        'attachment.size': returnFileSize,
        'associated_genotype_labels.proband_genotype_label': function (
            term,
            allowJSXOutput
        ) {
            switch (term) {
                case 'False':
                    return 'Sex inconsistent';
                case 'False (multiallelic in family)':
                case 'False  (multiallelic in family)':
                    return 'Sex inconsistent (multiallelic in family)';
                default:
                    return term;
            }
        },
    };

    return exactFieldNameDict;
});

export const Field = {
    nameMap: {
        'experiments_in_set.biosample.biosource.individual.organism.name':
            'Organism',
        accession: 'Experiment Set',
        'experiments_in_set.digestion_enzyme.name': 'Enzyme',
        'experiments_in_set.biosample.biosource_summary': 'Biosource',
        'experiments_in_set.lab.title': 'Lab',
        'experiments_in_set.experiment_type': 'Experiment Type',
        'experiments_in_set.experiment_type.display_title': 'Experiment Type',
        experimentset_type: 'Set Type',
        '@id': 'Link',
        display_title: 'Title',
    },

    toName: function (
        field,
        schemas,
        schemaOnly = false,
        itemType = 'ExperimentSet'
    ) {
        if (!schemaOnly && Field.nameMap[field]) {
            return Field.nameMap[field];
        } else {
            var schemaProperty = getSchemaProperty(field, schemas, itemType);
            if (schemaProperty && schemaProperty.title) {
                Field.nameMap[field] = schemaProperty.title; // Cache in nameMap for faster lookups.
                return schemaProperty.title;
            } else if (!schemaOnly) {
                return field;
            } else {
                return null;
            }
        }
    },

    getSchemaProperty: function (
        field,
        schemas = null,
        startAt = 'ExperimentSet'
    ) {
        return getSchemaProperty(field, schemas, startAt);
    },
};

/**
 * Builds dictionaries of facets from schemas.
 * Will exclude any additionally-calculated facets.
 * Globally memoized since will have only 1 instance of schemas per app instance.
 *
 * @returns {Object<string,{ field: string, aggregation_type: string }>}
 */
export const buildSchemaFacetDictionary = memoize(function (schemas) {
    const facetsByType = {};
    if (!schemas) {
        return facetsByType;
    }
    Object.keys(schemas).forEach(function (typeName) {
        const typeSchema = schemas[typeName];
        const { facets = {} } = typeSchema;
        facetsByType[typeName] = {};
        Object.keys(facets).forEach(function (facetFieldName) {
            const facetObj = facets[facetFieldName];
            // `facetObj` contains up to but not including: field, title, description, grouping, order, field_type, disabled, default_hidden
            const { aggregation_type = 'terms' } = facetObj;
            facetsByType[typeName][facetFieldName] = {
                ...facetObj,
                aggregation_type,
                field: facetFieldName,
            };
        });
    });
    return facetsByType;
});
