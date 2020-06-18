'use strict';

import React from 'react';

/**
 * Parses `context.families` instance
 * into list of Individuals (JSON objects) with
 * PedigreeViz-compliant properties.
 */
export function parseFamilyIntoDataset(family){
    const { members = [], proband, original_pedigree } = family;
    const probandID = (proband && (typeof proband === 'string' ? proband : proband['@id'])) || null;
    return members.map(function(individual){
        const {
            "@id": id,
            display_title: displayTitle,
            sex: gender = "undetermined",
            father = null, // We might get these back as strings from back-end response, instd of embedded obj.
            mother = null,
            is_deceased: isDeceased = false,
            is_pregnancy: isPregnancy = false,
            is_termination_of_pregnancy: isTerminatedPregnancy = false,
            is_spontaneous_abortion: isSpontaneousAbortion = false,
            is_still_birth: isStillBirth = false,
            phenotypic_features = [],
            age = null, age_units = null,
            age_at_death = null, age_at_death_units = null,
            ancestry = []
        } = individual;

        const fatherStr = (father && (typeof father === 'string' ? father : father['@id'])) || null;
        const motherStr = (mother && (typeof mother === 'string' ? mother : mother['@id'])) || null;

        // Internally, PedigreeViz uses the "diseases" vocabulary per a pedigree standards doc.
        // Here we transform phenotypic_features to this vocab (might change later, and/or conditionally)

        const diseases = []; // All strings
        const carrierOfDiseases = [];
        const asymptoticDiseases = [];

        phenotypic_features.forEach(function(featureWrapper){
            const feature = (featureWrapper && featureWrapper.phenotypic_feature) || null;
            const featureTitle = (
                feature && (
                    typeof feature === 'string' ? feature : feature.display_title || feature['@id']
                )
            ) || null;
            if (!featureTitle) return;
            diseases.push(featureTitle);
        });

        function calcAgeNum(ageNum, units){
            if (units === 'months') {
                return ageNum * (1/12);
            }
            if (units === 'weeks') {
                return ageNum * (1/52);
            }
            if (units === 'days') {
                return ageNum * (1/365);
            }
            if (units === 'hours') {
                return ageNum * (1/(365 * 24));
            }
            return ageNum;
        }

        function unitsText(age, unit){
            if (unit === 'year'){
                return "y.o.";
            }
            return unit + (age === 1 ? "" : "s");
        }

        let showAgeString = null;
        let ageNumerical = age_at_death || age;
        if (typeof age_at_death === 'number' && age_at_death_units){
            showAgeString = "d. " + age_at_death + " " + unitsText(age_at_death, age_at_death_units);
            ageNumerical = calcAgeNum(age_at_death, age_at_death_units);
        } else if (typeof age === 'number' && age_units) {
            showAgeString = "" + age + " " + unitsText(age, age_units);
            ageNumerical = calcAgeNum(age, age_units);
        }

        let name = displayTitle;
        if (displayTitle.slice(0,5) === "GAPID"){
            // <span>s don't work inside SVGs
            /*
            name = (
                <React.Fragment>
                    <span className="small">CGAPID</span>
                    <span>{ displayTitle.slice(5) }</span>
                </React.Fragment>
            );
            */
            //name = "ɢᴀᴘɪᴅ" + displayTitle.slice(5);
            //name = "ᴳᴬᴾᴵᴰ " + displayTitle.slice(5);
            //name = "ᴵᴰ " + displayTitle.slice(5);
            name = "ɪᴅ: " + displayTitle.slice(5);
        }

        return {
            id, gender, name,
            isDeceased : isDeceased || isTerminatedPregnancy || isSpontaneousAbortion || isStillBirth || typeof age_at_death === 'number' || false,
            isPregnancy : isPregnancy || isTerminatedPregnancy || isSpontaneousAbortion || isStillBirth || false,
            isTerminatedPregnancy,
            isSpontaneousAbortion,
            isStillBirth,
            diseases,
            "ancestry" : ancestry.slice().sort(),
            'ageString' : showAgeString || ageNumerical,
            'age' : ageNumerical,
            'father' : fatherStr,
            'mother' : motherStr,
            'isProband' : probandID && probandID === id,
            'data' : {
                // Keep non-proband-viz specific data here. TODO: Define/document.
                'individualItem' : individual
            }
        };
    });
}


export function gatherPhenotypicFeatureItems(family){
    if (!family) return [];
    const {
        members = [],
        proband = null
    } = family;

    const diseases = [];
    const seenIDs = {};

    function addToDiseases(individual){
        const { phenotypic_features = [] } = individual;
        phenotypic_features.forEach(function(pfObj){
            const { phenotypic_feature } = pfObj;
            const { '@id': featureID, display_title: featureTitle } = phenotypic_feature;
            if (!featureID || seenIDs[featureID]){
                return;
            }
            seenIDs[featureID] = true;
            diseases.push(phenotypic_feature);
        });
    }

    if (proband){
        addToDiseases(proband);
    }

    members.forEach(addToDiseases);
    return [ ...diseases ];
}

/**
 * Maps `context.case_phenotypic_features`
 * to strings.
 *
 * @param {{ @id: string, display_title: string }[]|string[]} [case_phenotypic_features=[]] List of phenotypic feature Items from Case.
 * @returns {string[]}
 */
export function getPhenotypicFeatureStrings(case_phenotypic_features = []){
    const strings = [];
    case_phenotypic_features.forEach(function(feature){
        if (typeof feature === 'string') return feature;
        const { '@id' : featureID, display_title } = feature;
        if (!featureID) return;
        strings.push(display_title || featureID);
    });
    return strings;
}
