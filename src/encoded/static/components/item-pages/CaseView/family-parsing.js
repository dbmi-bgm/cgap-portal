'use strict';

/**
 * Parses `context.families` instance
 * into list of Individuals (JSON objects) with
 * PedigreeViz-compliant properties.
 *
 * This is contextual to CGAP, with assumption that
 * stuff in PedigreeViz directory is meant to be
 * ambiguous re: who using it, so as to be reusable
 * and independently publishable eventually as own
 * NPM library.
 */

export function parseFamilyIntoDataset(family, showAsDiseases = "Phenotypic Features"){
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
            phenotypic_features: itemPhenFeatures = [],
            disorders: itemDisorders = [],
            age = null, age_units = null,
            age_at_death = null, age_at_death_units = null,
            ancestry = [],
            individual_id = null // Optional user-supplied name or identifier.
        } = individual;

        const fatherStr = (father && (typeof father === 'string' ? father : father['@id'])) || null;
        const motherStr = (mother && (typeof mother === 'string' ? mother : mother['@id'])) || null;

        // Internally, PedigreeViz uses the "diseases" vocabulary per a pedigree standards doc.
        // Here we transform phenotypic_features to this vocab (might change later, and/or conditionally)

        const diseases = []; // All strings
        const carrierOfDiseases = []; // todo
        const asymptoticDiseases = []; // todo

        if (showAsDiseases === "Phenotypic Features") {
            itemPhenFeatures.forEach(function(featureWrapper){
                const feature = (featureWrapper && featureWrapper.phenotypic_feature) || null;
                const featureTitle = (
                    feature && (
                        typeof feature === 'string' ? feature : feature.display_title || feature['@id']
                    )
                ) || null;
                if (!featureTitle) return;
                diseases.push(featureTitle);
            });
        } else if (showAsDiseases === "Disorders") {
            itemDisorders.forEach(function(disorderWrapperObj){
                const { disorder: { display_title: disorderTitle } = {} } = disorderWrapperObj || {};
                if (!disorderTitle) return;
                diseases.push(disorderTitle);
            });
        }

        // const phenotypic_features = itemPhenFeatures.map(function(featureWrapper){
        //     const { phenotypic_feature: { display_title } = {} } = featureWrapper;
        //     return display_title;
        // });

        // const disorders = itemDisorders.map(function(featureWrapper){
        //     const { disorder: { display_title } = {} } = featureWrapper;
        //     return display_title;
        // });

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

        let name = individual_id;   // Use user-supplied identifier where possible.
        if (!name) {                // Fallback to accession if not available.
            name = displayTitle;
            if (displayTitle.slice(0,5) === "GAPID"){
                // <span>s don't work inside SVGs
                // We could theoretically do multiple lines using SVG text... but... then can't sort by this.
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
        }

        return {
            id, gender, name,
            isDeceased : isDeceased || isTerminatedPregnancy || isSpontaneousAbortion || isStillBirth || typeof age_at_death === 'number' || false,
            isPregnancy : isPregnancy || isTerminatedPregnancy || isSpontaneousAbortion || isStillBirth || false,
            isTerminatedPregnancy,
            isSpontaneousAbortion,
            isStillBirth,
            diseases,   // <- Can be phenotypic_features or disorders, depending on dropdown
            // If going to split diseases and show both, need to refactor to:
            // phenotypic_features,
            // disorders,
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

/**
 * Gathers all phenotypic features from all individual members of a family.
 * Possibly deprecated.
 *
 * @param {{ members: { "@id": string }[], proband: { "@id" : string } }} family - Current Family
 */
export function gatherDiseaseItems(family, diseaseType = "Phenotypic Features"){
    if (!family) return [];
    const {
        members = [],
        proband = null
    } = family;

    const diseases = [];
    const seenIDs = {};

    function addToDiseases(individual){
        const useLinkToItemsFieldName = diseaseType === "Phenotypic Features" ? "phenotypic_features" : "disorders";
        const { [useLinkToItemsFieldName]: useLinkToItems = [] } = individual;
        useLinkToItems.forEach(function(linkedToDiseaseItemWrapperObject){
            const useLinkToItemField = diseaseType === "Phenotypic Features" ? "phenotypic_feature" : "disorder";
            const { [useLinkToItemField]: linkedToDiseaseItem } = linkedToDiseaseItemWrapperObject;
            const {
                '@id': diseaseID,
                display_title: diseaseTitle
            } = linkedToDiseaseItem;
            if (!diseaseID || seenIDs[diseaseID]){
                return; // Skip, perhaps no view permission.
            }
            seenIDs[diseaseID] = true;
            diseases.push(linkedToDiseaseItem);
        });
    }

    if (proband){
        addToDiseases(proband);
    }

    members.forEach(addToDiseases);

    return [ ...diseases ];
}

/**
 * Maps phenotypic features to plain strings,
 * usually display_title.
 *
 * @todo rename to "getPhenotypicFeaturesAsStrings" perhaps.
 * @todo Or keep phenotypic features as object in case of duplicate titles for some reason.
 * @param {{ @id: string, display_title: string }[]|string[]} [case_phenotypic_features=[]] List of phenotypic feature Items from Case.
 * @returns {string[]}
 */
export function getPhenotypicFeatureStrings(family_phenotypic_features = []){
    const strings = [];
    family_phenotypic_features.forEach(function(feature){
        if (typeof feature === 'string') return feature;
        const { '@id' : featureID, display_title } = feature;
        if (!featureID) return;
        strings.push(display_title || featureID);
    });
    return strings;
}
