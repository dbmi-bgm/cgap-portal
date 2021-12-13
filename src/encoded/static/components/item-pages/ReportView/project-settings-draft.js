/**
 * This is a working draft of data model that would eventually
 * exist in our schemas as `Project.report_sections_config`.
 * @see https://docs.google.com/document/d/1-7ls8fu18t5BCDhgdRj_ukuQlhV6VvdC8Y1RP1kP6_U/edit#
 */
export const projectReportSettings = {
    // Hardcoded sections with configurable options per section
    "header": {
        "organization_title": "CGAP Core", // If null, then Report.project.display_title is used.
        "show_individual_id": true,
        "show_family_id": true,
        "show_cgap_id": true,
        "show_sample_type": true,
        "show_sex": true,
        "show_age": true,
        // OR (instead of above boolean flags, to allow ordering & fields variety)
        // Con: more work on UI to implement array ordering/re-arranging/defining
        // "header_fields_included": [
        //     "individual.individual_id",
        //     "family.family_id",
        //     "accession",
        //     "sample.sample_type",
        //     "last_modified.date_modified" // (can pull in title per field from Schema)
        // ]
    },
    "table_tags": {
        "show_subsections": true,
        "subsection_note_order": [
            "acmg_interpretations",
            "discovery_intepretations"
        ],
        "tags": [
            // Will become available as "tags" that can applied to VariantSamples (?)
            // (somewhat more tricky than hardcoded enums… maybe we can hardcode…?)
            {
                "id": "clinical-primary",
                "title": "Primary Findings",
                "always_visible": true
            },
            {
                "id": "clinical-secondary",
                "title": "Secondary Findings",
                // If true, then table present with statement that no results found.
                "always_visible": true
            },
            {
                "id": "research-high-priority",
                "title": "High Priority Findings (Research)"
            },
            {
                "id": "research-medium-priority",
                "title": "Medium Priority Findings (Research)"
            },
            {
                "id": "research-low-priority",
                "title": "Low Priority Findings (Research)"
            }
        ]
    },
    "report_sections": {
        "indication": {
            "title" : "Indication",
            "order": 1,
            "included": true,
            "readonly": false
        },
        "analysis_performed": {
            "title" : "Tests / Analysis Performed",
            "order": 2,
            "included": true,
            "readonly": true,
            // Maybe, if not free-text:
            //"tests_shown": ["something1", "something2"]
        },
        "result_summary": {
            "title" : "Result Summary",
            "order": 3,
            "included": true,
            "readonly": false,
            "defaultValue": null
        },
        "findings_table": {
            // "title" : null,
            "order": 4,
            "included": true
        },
        "recommendations": {
            "title" : "Recommendations",
            "order": 5,
            "included": true,
            "readonly": false,
            "defaultValue": null,
        },
        "additional_case_notes": {
            "title" : "Additional Case Notes",
            "order": 6,
            "included": true,
            "readonly": false,
            "defaultValue": null,
        },
        "methodology": {
            "title" : "Methodology",
            "order": 7,
            "included": true,
            "readonly": false,
            // Considering something like this -
            "defaultValue": "Tested ABCD with XYZ and then something or other"
        },
        "references": {
            "title": "References",
            "order": 8,
            "included": true,
            "readonly": false,
            "defaultValue": null,
        }
    }
};
