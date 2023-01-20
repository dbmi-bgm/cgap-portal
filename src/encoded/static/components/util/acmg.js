'use strict';

import memoize from 'memoize-one';

export const rules = ["BA1", "BS1", "BS2", "BS3", "BS4", "BP1", "BP2", "BP3", "BP4", "BP5", "BP6", "BP7", "PP1", "PP2", "PP3", "PP4", "PP5", "PM1", "PM2", "PM3", "PM4", "PM5", "PM6", "PS1", "PS2", "PS3", "PS4", "PVS1"];

// Note: order key currently organizes rules from strongest benign evidence to strongest pathogenic evidence.
export const metadata = {
    "BA1": { type: "benign", strength: "Standalone", order: 1, description: "Allele frequency is >5% in Exome Sequencing Project, 1000 Genomes Project, or Exome Aggregation Consortium" },
    "BS1": { type: "benign", strength: "Strong", order: 2, description: "Allele frequency is greater than expected for disorder (see Table 6)" },
    "BS2": { type: "benign", strength: "Strong", order: 2, description: "Observed in a healthy adult individual for a recessive (homozygous), dominant (heterozygous), or X-linked (hemizygous) disorder, with full penetrance expected at an early age" },
    "BS3": { type: "benign", strength: "Strong", order: 2, description: "Well-established in vitro or in vivo functional studies show no damaging effect on protein function or splicing" },
    "BS4": { type: "benign", strength: "Strong", order: 2, description: "Lack of segregation in affected members of a family<br/><br/><ul><li>Caveat: The presence of phenocopies for common phenotypes (i.e., cancer, epilepsy) can mimic lack of segregation among affected individuals. Also, families may have more than one pathogenic variant contributing to an autosomal dominant disorder, further confounding an apparent lack of segregation.</li></ul>" },
    "BP1": { type: "benign", strength: "Supporting", order: 3, description: "Missense variant in a gene for which primarily truncating variants are known to cause disease" },
    "BP2": { type: "benign", strength: "Supporting", order: 3, description: "Observed in <span class='font-italic'>trans</span> with a pathogenic variant for a fully penetrant dominant gene/disorder or observed in <span class='font-italic'>cis</span> with a pathogenic variant in any inheritance pattern" },
    "BP3": { type: "benign", strength: "Supporting", order: 3, description: "In-frame deletions/insertions in a repetitive region without a known function" },
    "BP4": { type: "benign", strength: "Supporting", order: 3, description: "Multiple lines of computational evidence suggest no impact on gene or gene product (conservation, evolutionary, splicing impact, etc.)<br/><br/><ul><li>Caveat: Because many in silico algorithms use the same or very similar input for their predictions, each algorithm cannot be counted as an independent criterion. BP4 can be used only once in any evaluation of a variant.</li></ul>" },
    "BP5": { type: "benign", strength: "Supporting", order: 3, description: "Variant found in a case with an alternate molecular basis for disease" },
    "BP6": { type: "benign", strength: "Supporting", order: 3, description: "Reputable source recently reports variant as benign, but the evidence is not available to the laboratory to perform an independent evaluation" },
    "BP7": { type: "benign", strength: "Supporting", order: 3, description: "A synonymous (silent) variant for which splicing prediction algorithms predict no impact to the splice consensus sequence nor the creation of a new splice site AND the nucleotide is not highly conserved" },
    "PP1": { type: "pathogenic", strength: "Supporting", order: 4, description: "Cosegregation with disease in multiple affected family members in a gene definitively known to cause the disease<br/><br/><ul><li>Note: May be used as stronger evidence with increasing segregation data</li></ul>" },
    "PP2": { type: "pathogenic", strength: "Supporting", order: 4, description: "Missense variant in a gene that has a low rate of benign missense variation and in which missense variants are a common mechanism of disease" },
    "PP3": { type: "pathogenic", strength: "Supporting", order: 4, description: "Multiple lines of computational evidence support a deleterious effect on the gene or gene product (conservation, evolutionary, splicing impact, etc.)<br/><ul><li>Caveat: Because many in-silico algorithms use the same or very similar input for their predictions, each algorithm should not be counted as an independent criterion. PP3 can be used only once in any evaluation of a variant.</li></ul>" },
    "PP4": { type: "pathogenic", strength: "Supporting", order: 4, description: "Patient’s phenotype or family history is highly specific for a disease with a single genetic etiology" },
    "PP5": { type: "pathogenic", strength: "Supporting", order: 4, description: "Reputable source recently reports variant as pathogenic, but the evidence is not available to the laboratory to perform an independent evaluation" },
    "PM1": { type: "pathogenic", strength: "Moderate", order: 5, description: "Located in a mutational hot spot and/or critical and well-established functional domain (e.g., active site of an enzyme) without benign variation." },
    "PM2": { type: "pathogenic", strength: "Moderate", order: 5, description: "Absent from controls (or at extremely low frequency if recessive) (Table 6) in Exome Sequencing Project, 1000 Genomes Project, or Exome Aggregation Consortium<br/><ul><li>Caveat: Population data for insertions/deletions may be poorly called by next-generation sequencing</li></ul>" },
    "PM3": { type: "pathogenic", strength: "Moderate", order: 5, description: "For recessive disorders, detected in <span class='font-italic'>trans</span> with a pathogenic variant<br/><br/><em>Note: This requires testing of parents (or offspring) to determine phase.</em>" },
    "PM4": { type: "pathogenic", strength: "Moderate", order: 5, description: "Protein length changes as a result of in-frame deletions/insertions in a nonrepeat region or stop-loss variants" },
    "PM5": { type: "pathogenic", strength: "Moderate", order: 5, description: "Novel missense change at an amino acid residue where a different missense change determined to be pathogenic has been seen before<br/><ul><li>Example: Arg156His is pathogenic; now you observe Arg156Cys</li><li>Caveat: Beware of changes that impact splicing rather than at the amino acid/protein level.</li></ul>" },
    "PM6": { type: "pathogenic", strength: "Moderate", order: 5, description: "Assumed de novo, but without confirmation of paternity and maternity" },
    "PS1": { type: "pathogenic", strength: "Strong", order: 6, description: "Same amino acid change as a previously established pathogenic variant regardless of nucleotide change<br/><ul><li>Example: Val→Leu caused by either G>C or G>T in the same codon</li><li>Caveat: Beware of changes that impact splicing rather than at the amino acid/protein level</li></ul>" },
    "PS2": { type: "pathogenic", strength: "Strong", order: 6, description: "De novo (<u>both</u> maternity and paternity confirmed) in a patient with the disease and no family history<br/><br/><em>Note: Confirmation of paternity only is insufficient. Egg donation, surrogate motherhood, errors in embryo transfer, and so on, can contribute to nonmaternity.</em>" },
    "PS3": { type: "pathogenic", strength: "Strong", order: 6, description: "Well-established in vitro or in vivo functional studies supportive of a damaging effect on the gene or gene product<br/><br/><em>Note: Functional studies that have been validated and shown to be reproducible and robust in a clinical diagnostic laboratory setting are considered the most well established.</em>" },
    "PS4": { type: "pathogenic", strength: "Strong", order: 6, description: "The prevalence of the variant in affected individuals is significantly increased compared with the prevalence in controls<br/><br/><em>Note 1: Relative risk or OR, as obtained from case–control studies, is >5.0, and the confidence interval around the estimate of relative risk or OR does not include 1.0. See the article for detailed guidance.</em><br/><br/><em>Note 2: In instances of very rare variants where case–control studies may not reach statistical significance, the prior observation of the variant in multiple unrelated patients with the same phenotype, and its absence in controls, may be used as moderate level of evidence.</em>" },
    "PVS1": { type: "pathogenic", strength: "Very Strong", order: 7, description: "Null variant (nonsense, frameshift, canonical ±1 or 2 splice sites, initiation codon, single or multiexon deletion) in a gene where LOF is a known mechanism of disease.<br/><br/>Caveats:<br/><ul><li>Beware of genes where LOF is not a known disease mechanism (e.g., GFAP, MYH7)</li><li>Use caution interpreting LOF variants at the extreme 3′ end of a gene</li><li>Use caution with splice variants that are predicted to lead to exon skipping but leave the remainder of the protein intact</li><li>Use caution in the presence of multiple transcripts</li></ul>" }
};

/**
 * Converts an array into a map of rules to invoked state
 * @param {Array} arr An array of invoked criteria objects structured for/from acmg_guidelines_invoked field
 * @returns {Object} structured such that { [ACMG_Rule]: rulestrength } for using in InterpretationController state
 * Note: Uninvoked rules can be represented with a value of undefined (never invoked) or false (after first invocation);
 * additionally, rules can be invoked at "Default" (in which the value used in auto-classification calculation will be taken
 * from acmgUtil.metadata[rule].strength) or at a modded strength level.
 */
export function criteriaArrayToStateMap(arr) {
    const stateObj = {};
    arr.forEach((criteria) => {
        const { acmg_rule_name: rule, rule_strength: strength } = criteria || {};
        stateObj[rule] = strength;
    });

    return stateObj;
}


/**
 * Converts a rule state map back into an array of invoked items
 * @param {Object} obj structured such that { [ACMG_Rule]: rulestrength } for using in InterpretationController state
 * @returns {Array} An array of invoked criteria, sorted from least to most pathogenic (according to default rule strength)
 */
export function flattenStateMapIntoArray(obj) {
    // Flatten into an array of invoked items
    const invokedFlat = [];
    Object.keys(obj).forEach((rule) => {
        if (obj[rule]) {
            invokedFlat.push({ acmg_rule_name: rule, rule_strength: obj[rule] });
        }
    });
    return invokedFlat.sort((a, b) => {
        const { acmg_rule_name: ruleA } = a;
        const { acmg_rule_name: ruleB } = b;
        const orderA = metadata[ruleA].order;
        const orderB = metadata[ruleB].order;

        return orderA - orderB;
    });
}

/**
 * Based on https://www.mgz-muenchen.com/files/Public/Downloads/2018/ACMG%20Classification%20of%20Sequence%20Variants.pdf (pg 3)
 * with additional consultation from https://www.nature.com/articles/gim201530 (Tables 3-5)
 *
 * Structured as a class so that a single instance can be initiated and then updated via invocation methods. Test calculations in browser console
 * by instantiating a new class and attaching to window (see); this can be useful in determining whether bugs are due to calculation error or react implementation.
 *
 * Note: there is currently not a method to switch strengths of a rule already invoked; to do this uninvoke the old rule, and invoke the new one.
 */
export class AutoClassify {

    /**
     * Takes evidence of pathogenicity counts and returns true if Pathogenic criteria invoked
     * @param {Number} vstrong      # of PVS1 evidence invoked
     * @param {Number} strong       # of (PS1–PS4) evidence invoked
     * @param {Number} moderate     # of (PM1–PM6) evidence invoked
     * @param {Number} supporting   # of (PP1–PP5) evidence invoked
     * @returns {boolean}
     */
    static isPathogenic(vstrong, strong, moderate, supporting){
        if (vstrong > 1) {
            return true;    // Modded ACMG Rule -- since 1 strong and 1 very strong === pathogenic, 2 very strongs should equal pathogenic
        }
        if (vstrong === 1) {                             // (i) 1 Very strong (PVS1) AND
            if ((strong >= 1) ||                        //      a) ≥1 Strong (PS1–PS4) OR
                (moderate >= 2) ||                      //      b) ≥2 Moderate (PM1–PM6) OR
                (moderate === 1 && supporting === 1) || //      c) 1 Moderate (PM1–PM6) and 1 supporting (PP1–PP5) OR
                (supporting >= 2)) {                    //      d) d) ≥2 Supporting (PP1–PP5)
                return true;
            }
        }
        if (strong >= 2) {                              // (ii) ≥2 Strong (PS1–PS4) OR
            return true;
        }
        if (strong === 1) {                             // (iii) 1 Strong (PS1–PS4) AND
            if ((moderate >= 3) ||                      //      a) ≥3 Moderate (PM1–PM6) OR
            (moderate === 2 && supporting >= 2) ||      //      b) 2 Moderate (PM1–PM6) AND ≥2 Supporting (PP1–PP5) OR
            (moderate === 1 && supporting >= 4)) {      //      c) 1 Moderate (PM1–PM6) AND ≥4 supporting (PP1–PP5
                return true;
            }
        }

        return false;
    }

    /**
     * Takes evidence of pathogenicity counts and returns true if Likely Pathogenic criteria invoked
     * @param {Number} vstrong      # of PVS1 evidence invoked
     * @param {Number} strong       # of (PS1–PS4) evidence invoked
     * @param {Number} moderate     # of (PM1–PM6) evidence invoked
     * @param {Number} supporting   # of (PP1–PP5) evidence invoked
     * @returns {boolean}
     */
    static isLikelyPathogenic(vstrong, strong, moderate, supporting){
        if ((vstrong === 1 && moderate === 1) ||                    // (i) 1 Very strong (PVS1) AND 1 moderate (PM1–PM6) OR
            (strong === 1 && (moderate === 1 || moderate === 2)) || // (ii) 1 Strong (PS1–PS4) AND 1–2 moderate (PM1–PM6) OR
            (strong === 1 && (supporting >= 2)) ||                  // (iii) 1 Strong (PS1–PS4) AND ≥2 supporting (PP1–PP5) OR
            (moderate >= 3) ||                                      // (iv) ≥3 Moderate (PM1–PM6) OR
            (moderate === 2) && (supporting >= 2) ||                // (v) 2 Moderate (PM1–PM6) AND ≥2 supporting (PP1–PP5) OR
            (moderate === 1) && (supporting >= 4)) {                // (vi) 1 Moderate (PM1–PM6) AND ≥4 supporting (PP1–PP5)
            return true;
        }
        return false;

    }

    /**
     * Takes evidence of benign effect counts and returns true if Benign criteria invoked
     * @param {Number} standalone       # of BA1 evidence invoked
     * @param {Number} strong           # of (BS1-BS4) evidence invoked
     * @returns {boolean}
     */
    static isBenign(standalone, strong){
        if (standalone || strong >= 2) {    // (i) 1 Stand-alone (BA1) OR (ii) ≥2 Strong (BS1–BS4)
            return true;
        }
        return false;
    }

    /**
     * Takes evidence of benign effect counts and returns true if Likely Benign criteria invoked
     * @param {Number} strong           # of (BS1-BS4) evidence invoked
     * @param {Number} supporting       # of (BP1-BP7) evidence invoked
     * @returns {boolean}
     */
    static isLikelyBenign(strong, supporting){
        if ((strong === 1 && supporting >= 1) ||    // (i) 1 Strong (BS1–BS4) and 1 supporting (BP1–BP7) OR
            (supporting >= 2)                       // (ii) ≥2 Supporting (BP1–BP7)
        ) {
            return true;
        }
        return false;
    }

    constructor(invoked) {
        this.evidenceOfPathogenicity = {};
        this.evidenceOfBenignImpact = {};
        this.autoClassification = null;

        this.memoized = {
            isBenign: memoize(AutoClassify.isBenign),
            isLikelyBenign: memoize(AutoClassify.isLikelyBenign),
            isPathogenic: memoize(AutoClassify.isPathogenic),
            isLikelyPathogenic: memoize(AutoClassify.isLikelyPathogenic)
        };

        this.initializeEvidenceFromInvoked = this.initializeEvidenceFromInvoked.bind(this);
        this.classify = this.classify.bind(this);
        this.updateClassification = this.updateClassification.bind(this);
        this.invoke = this.invoke.bind(this);
        this.uninvoke = this.uninvoke.bind(this);

        this.initializeEvidenceFromInvoked(invoked);
    }

    initializeEvidenceFromInvoked(invoked) {
        // console.log("populating with evidence from, ", invoked);
        // Flatten into an array of invoked items
        const invokedFlat = flattenStateMapIntoArray(invoked);

        // Collect counts of various evidence types
        invokedFlat.forEach((invoked) => {
            const { rule_strength: strength, acmg_rule_name: rule } = invoked;
            const { strength: defaultStrength, type } = metadata[rule];

            // Takes into consideration non-default strengths, if present
            const selectedStrength = (strength && strength !== "Default") ? strength : defaultStrength;

            if (type === "pathogenic") {
                if (this.evidenceOfPathogenicity[selectedStrength] === undefined) {
                    this.evidenceOfPathogenicity[selectedStrength] = 1;
                } else {
                    const newValue = this.evidenceOfPathogenicity[selectedStrength] + 1;
                    this.evidenceOfPathogenicity[selectedStrength] = newValue;
                }
            } else {
                if (this.evidenceOfBenignImpact[selectedStrength] === undefined) {
                    this.evidenceOfBenignImpact[selectedStrength] = 1;
                } else {
                    const newValue = this.evidenceOfBenignImpact[selectedStrength] + 1;
                    this.evidenceOfBenignImpact[selectedStrength] = newValue;
                }
            }
        });

        this.updateClassification();
    }

    /**
     * Uses the current evidence counts for Benign or Pathogenic impact to calculate a classification.
     * @returns {string} a classification (one of "Benign", "Likely Benign", "Uncertain significance", "Likely Pathogenic", or "Pathogenic")
     * Note: the line in the ACMG Guidelines about contradictory "criteria for benign and pathogenic" resulting in uncertain significance
     * classification has been expanded to also apply to contradictory criteria for likely benign and likely pathogenic; so collections of
     * rules and strengths that result in both likely benign and likely pathogenic classifications will return uncertain significance.
     */
    classify() {
        const {
            Standalone: standalone = null,
            Strong: strongb = null,
            Supporting: supportingb = null
        } = this.evidenceOfBenignImpact;
        const {
            "Very Strong": vstrong = null,
            Strong: strongp = null,
            Supporting: supportingp = null,
            Moderate: moderatep = null
        } = this.evidenceOfPathogenicity;

        // Check for certain benign effect
        const isBenign = this.memoized.isBenign(standalone, strongb);
        let isPathogenic;
        if (isBenign) {
            isPathogenic = this.memoized.isPathogenic(vstrong, strongp, moderatep, supportingp);
            // (Uncertain significance ii) the criteria for benign and pathogenic are contradictory
            return isPathogenic ? "Uncertain significance" : "Benign";
        }

        // Check for certain pathogenicity
        if (isPathogenic === undefined) {
            isPathogenic = this.memoized.isPathogenic(vstrong, strongp, moderatep, supportingp);
        }
        if (isPathogenic) {
            return "Pathogenic";
        }

        // Check for probable benign effect
        const isLikelyBenign = this.memoized.isLikelyBenign(strongb, supportingb);
        let isLikelyPathogenic;
        if (isLikelyBenign) {
            isLikelyPathogenic = this.memoized.isLikelyPathogenic(vstrong, strongp, moderatep, supportingp);
            // (Uncertain significance ii) the criteria for benign and pathogenic are contradictory
            return isLikelyPathogenic ? "Uncertain significance" : "Likely benign";
        }

        // Check for probable pathogenic effect
        if (isLikelyPathogenic === undefined) {
            isLikelyPathogenic = this.memoized.isLikelyPathogenic(vstrong, strongp, moderatep, supportingp);
        }
        if (isLikelyPathogenic) {
            return "Likely pathogenic";
        }

        // (Uncertain significance i) Other criteria shown above are not met
        return "Uncertain significance";
    }

    /**
     * Adjusts evidence according to newly invoked rules/strengths and re-calculates classification
     * @param {String} rule ACMG Rule
     * @param {String} strength Can be "Default" or a modded strength. If falsy, default strength is invoked.
     * @returns {String} new classification
     */
    invoke(rule, strength) {
        if (!rule) {
            throw new Error ("ACMG rule to invoke was not passed in");
        }
        // Adjust count of evidence types (take into consideration non-default strengths)
        const { strength: defaultStrength, type } = metadata[rule];
        const selectedStrength = (strength && strength !== "Default") ? strength: defaultStrength;
        if (type === "pathogenic") {
            if (this.evidenceOfPathogenicity[selectedStrength] === undefined) {
                this.evidenceOfPathogenicity[selectedStrength] = 1;
            } else {
                const newValue = this.evidenceOfPathogenicity[selectedStrength] + 1;
                this.evidenceOfPathogenicity[selectedStrength] = newValue;
            }
        } else {
            if (this.evidenceOfBenignImpact[selectedStrength] === undefined) {
                this.evidenceOfBenignImpact[selectedStrength] = 1;
            } else {
                const newValue = this.evidenceOfBenignImpact[selectedStrength] + 1;
                this.evidenceOfBenignImpact[selectedStrength] = newValue;
            }
        }

        return this.updateClassification();
    }

    /**
     * Adjusts evidence according to newly uninvoked rules/strengths and re-calculates classification
     * @param {String} rule ACMG Rule
     * @param {String} strength Can be "Default" or a modded strength. If falsy, default strength is uninvoked.
     * @returns {String} new classification
     */
    uninvoke(rule, strength) {
        if (!rule) {
            throw new Error ("ACMG rule to uninvoke was not passed in");
        }
        // Adjust count of evidence types (take into consideration non-default strengths)
        const { strength: defaultStrength, type } = metadata[rule];
        const selectedStrength = (strength && strength !== "Default") ? strength: defaultStrength;
        if (type === "pathogenic") {
            const newValue = this.evidenceOfPathogenicity[selectedStrength] - 1;
            this.evidenceOfPathogenicity[selectedStrength] = newValue;
        } else {
            const newValue = this.evidenceOfBenignImpact[selectedStrength] - 1;
            this.evidenceOfBenignImpact[selectedStrength] = newValue;
        }

        return this.updateClassification();
    }

    updateClassification() {
        const classification = this.classify();
        this.autoClassification = classification;
        return classification;
    }

    getClassification() {
        return this.autoClassification;
    }
}