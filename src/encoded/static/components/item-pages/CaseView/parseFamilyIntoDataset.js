'use strict';

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
            display_title: name,
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
            age_at_death = null, age_at_death_units = null
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

        let showAgeText = null;
        let ageNumerical = age_at_death || age;
        if (typeof age_at_death === 'number' && age_at_death_units){
            showAgeText = "" + age_at_death + " " + age_at_death_units + (age_at_death > 1 ? "s" : "");
            ageNumerical = calcAgeNum(age_at_death, age_at_death_units);
        } else if (typeof age === 'number' && age_units) {
            showAgeText = "" + age + " " + age_units + (age > 1 ? "s" : "");
            ageNumerical = calcAgeNum(age, age_units);
        }

        return {
            id, gender, name,
            isDeceased : isDeceased || isTerminatedPregnancy || isSpontaneousAbortion || isStillBirth || false,
            isPregnancy : isPregnancy || isTerminatedPregnancy || isSpontaneousAbortion || isStillBirth || false,
            isTerminatedPregnancy,
            isSpontaneousAbortion,
            isStillBirth,
            diseases,
            'ageText' : showAgeText || ageNumerical,
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
