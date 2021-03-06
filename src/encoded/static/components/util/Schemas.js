'use strict';

import _ from 'underscore';
import React from 'react';

import { linkFromItem } from '@hms-dbmi-bgm/shared-portal-components/es/components/util/object';
import { LocalizedTime, format as dateFormat } from '@hms-dbmi-bgm/shared-portal-components/es/components/ui/LocalizedTime';
import { patchedConsoleInstance as console } from '@hms-dbmi-bgm/shared-portal-components/es/components/util/patched-console';
import { getTitleForType, getSchemaProperty } from '@hms-dbmi-bgm/shared-portal-components/es/components/util/schema-transforms';
import {
    capitalize, capitalizeSentence, bytesToLargerUnit, roundLargeNumber, roundDecimal, hrefToFilename
} from '@hms-dbmi-bgm/shared-portal-components/es/components/util/value-transforms';

let cachedSchemas = null;

/**
 * Should be set by app.js to return app.state.schemas
 *
 * @type {function}
 */
export function get(){
    return cachedSchemas;
}

export function set(schemas){
    cachedSchemas = schemas;
    return true;
}


export const Term = {
    toName : function(field, term, allowJSXOutput = false, addDescriptionTipForLinkTos = true){

        if (allowJSXOutput && typeof term !== 'string' && term && typeof term === 'object'){
            // Object, probably an item.
            return linkFromItem(term, addDescriptionTipForLinkTos);
        }

        let name = null;

        switch (field) {
            case '@id':
                return term;
            case 'type':
                return getTitleForType(term, get());
            case 'status':
                if (allowJSXOutput){
                    return (
                        <React.Fragment>
                            <i className="status-indicator-dot mr-07" data-status={term} />
                            { capitalizeSentence(term) }
                        </React.Fragment>
                    );
                }
                return capitalizeSentence(term);
            case 'date_created':
            case 'last_modified.date_modified':
            case 'date_modified':
            case 'public_release':
            case 'project_release':
                if (allowJSXOutput){
                    return <LocalizedTime timestamp={term} localize={false} />;
                }
                return dateFormat(term);
            case 'accession':
                //if (allowJSXOutput) {
                //    return <span className="accession text-small">{ term }</span>;
                //}
                return term;

            /** Fields that are lowercase with underscores but could be ~ proper nouns otherwise */
            case "project_roles.project": // Related to User (hardcoded enum field)
            case "gene_biotype":
                if (typeof term !== 'string') return term;
                return term.split("_").map(capitalize).join(" ");

            /** Related to Individual Items: */
            case 'is_pregnancy':
            case 'is_spontaneous_abortion':
            case 'is_infertile':
            case 'is_termination_of_pregnancy':
            case 'is_still_birth':
            case 'is_deceased':
                if (typeof term === "boolean"){
                    // Boolean, or undefined to be considered as "false"
                    return (term && "True") || "False";
                }
                if (typeof term === "undefined") {
                    return "False";
                }
                // Common cases, e.g. from search result:
                if (term === "true") return "True";
                if (term === "false") return "False";
                if (term === "No value") return term; // Ideally could have this as "False" but then get 2+ "False" values in list of Facet terms.
                return term;
            case 'sex':
                if (term === "M") name = "Male";
                if (term === "F") name = "Female";
                if (term === "U") name = "Undetermined";
                if (allowJSXOutput) {
                    return (
                        <React.Fragment>
                            <i className={`mr-03 icon icon-fw icon-${Term.genderCharacterToIcon(term)}`}/>
                            { name }
                        </React.Fragment>
                    );
                }
                return name;

            /** Related to File Items: */
            case 'file_type':
            case 'file_classification':
            case 'file_type_detailed':
            case 'files.file_type':
            case 'files.file_classification':
            case 'files.file_type_detailed':
            case 'ancestry':
                return capitalizeSentence(term);
            case 'life_status':
                return capitalize(term);
            case 'file_size':
            case 'attachment.size':
                if (typeof term === 'number'){
                    name = term;
                } else if (!isNaN(parseInt(term))) {
                    name = parseInt(term);
                }
                if (typeof name === 'number' && !isNaN(name)){
                    return bytesToLargerUnit(name);
                } else {
                    name = null;
                }
                break;

            default:
                break;
        }


        // Custom stuff
        if (field.indexOf('quality_metric.') > -1){
            if (field.slice(-11) === 'Total reads')     return roundLargeNumber(term);
            if (field.slice(-15) === 'Total Sequences') return roundLargeNumber(term);
            if (field.slice(-14) === 'Sequence length') return roundLargeNumber(term);
            if (field.slice(-15) === 'Cis/Trans ratio') return roundDecimal(term) + '%';
            if (field.slice(-35) === '% Long-range intrachromosomal reads') return roundDecimal(term) + '%';
            if (field.slice(-4) === '.url' && term.indexOf('http') > -1) {
                var linkTitle = hrefToFilename(term); // Filename most likely for quality_metric.url case(s).
                if (allowJSXOutput){
                    return <a href={term} target="_blank" rel="noopener noreferrer">{ linkTitle }</a>;
                } else {
                    return linkTitle;
                }
            }
        }

        // Fallback
        if (typeof name !== 'string') name = term;

        return name;
    },

    genderCharacterToIcon(gender){
        const m = {
            M: "mars fas",
            F: "venus fas",
            U: "question fas"
        };
        return m[gender];
    }
};


export const Field = {

    nameMap : {
        'experiments_in_set.biosample.biosource.individual.organism.name' : 'Organism',
        'accession' : 'Experiment Set',
        'experiments_in_set.digestion_enzyme.name' : 'Enzyme',
        'experiments_in_set.biosample.biosource_summary' : 'Biosource',
        'experiments_in_set.lab.title' : 'Lab',
        'experiments_in_set.experiment_type' : 'Experiment Type',
        'experiments_in_set.experiment_type.display_title' : 'Experiment Type',
        'experimentset_type' : 'Set Type',
        '@id' : "Link",
        'display_title' : "Title"
    },

    toName : function(field, schemas, schemaOnly = false, itemType = 'ExperimentSet'){
        if (!schemaOnly && Field.nameMap[field]){
            return Field.nameMap[field];
        } else {
            var schemaProperty = getSchemaProperty(field, schemas, itemType);
            if (schemaProperty && schemaProperty.title){
                Field.nameMap[field] = schemaProperty.title; // Cache in nameMap for faster lookups.
                return schemaProperty.title;
            } else if (!schemaOnly) {
                return field;
            } else {
                return null;
            }
        }
    },

    getSchemaProperty : function(field, schemas = null, startAt = 'ExperimentSet'){
        return getSchemaProperty(field, schemas, startAt);
    }

};

