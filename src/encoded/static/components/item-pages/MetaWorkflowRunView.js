'use strict';

import React, { useMemo } from 'react';
import PropTypes from 'prop-types';
import _ from 'underscore';
import ReactTooltip from 'react-tooltip';
import memoize from 'memoize-one';

import { console, object, navigate } from '@hms-dbmi-bgm/shared-portal-components/es/components/util';
import { requestAnimationFrame } from '@hms-dbmi-bgm/shared-portal-components/es/components/viz/utilities';


import Graph, { parseAnalysisSteps, parseBasicIOAnalysisSteps } from '@hms-dbmi-bgm/react-workflow-viz';
import { WorkflowDetailPane } from './components/Workflow/WorkflowDetailPane';
import { WorkflowNodeElement } from './components/Workflow/WorkflowNodeElement';
import { WorkflowGraphSectionControls } from './components/Workflow/WorkflowGraphSectionControls';

import DefaultItemView from './DefaultItemView';


/**
 * Pass this to props.onNodeClick for Graph.
 *
 * @export
 * @param {Object} node - Node clicked on.
 * @param {Object|null} selectedNode - Node currently selected, if any.
 * @param {MouseEvent} evt - onClick MouseEvent.
 */
export function onItemPageNodeClick(node, selectedNode, evt){
    var navOpts = { 'inPlace' : true, 'skipRequest' : true, 'replace' : true };
    if (node !== selectedNode){
        navigate('#' + (node.id || node.name), navOpts);
    } else {
        navigate('#', navOpts);
    }
}

export function checkIfIndirectOrReferenceNodesExist(steps){
    const graphData = parseAnalysisSteps(steps, { 'showIndirectFiles' : true, 'showReferenceFiles' : true });
    const anyIndirectPathIONodes = _.any(graphData.nodes, function(n){
        return (n.nodeType === 'output' && n.meta && n.meta.in_path === false);
    });
    const anyReferenceFileNodes = _.any(graphData.nodes, function(n){
        return (n.ioType === 'reference file');
    });
    return { anyIndirectPathIONodes, anyReferenceFileNodes };
}


export function commonGraphPropsFromProps(props){
    const graphProps = {
        'href'              : props.href,
        'renderDetailPane'  : function(selectedNode, paneProps){
            return (
                <WorkflowDetailPane {...paneProps} {..._.pick(props, 'session', 'schemas', 'context', 'legendItems', 'windowWidth')} selectedNode={selectedNode} />
            );
        },
        'renderNodeElement' : function(node, graphProps){
            return <WorkflowNodeElement {...graphProps} {..._.pick(props, 'schemas', 'windowWidth')} node={node}/>;
        },
        'rowSpacingType'    : 'wide',
        'nodeClassName'     : null,
        'onNodeClick'       : typeof props.onNodeClick !== 'undefined' ? props.onNodeClick : null,
        'windowWidth'       : props.windowWidth
    };

    return graphProps;
}


export default class MetaWorkflowRunView extends DefaultItemView {

    constructor(props){
        super(props);
        this.getTabViewContents = this.getTabViewContents.bind(this);
        this.state = {
            'mounted' : false
        };
    }

    componentDidMount(){
        this.setState({ 'mounted' : true });
    }

    getTabViewContents(){
        const { context, windowHeight, windowWidth } = this.props;
        const { mounted } = this.state;
        const width = windowWidth - 60;


        // Eventually:



        // TODO: Include only if ... enough data to visualize exists/valid.
        const tabs = [
            {
                tab : <span><i className="icon icon-sitemap icon-rotate-90 fas icon-fw"/> Graph</span>,
                key : 'graph',
                content : (
                    <MetaWorkflowRunDataTransformer {...{ context }}>
                        <WorkflowGraphSection {...this.props} mounted={this.state.mounted} width={width} />
                    </MetaWorkflowRunDataTransformer>
                )
            }
        ];

        return _.map(tabs.concat(this.getCommonTabs()), (tabObj) => // Common properties
            _.extend(tabObj, {
                'style' : { 'minHeight' : Math.max((mounted && windowHeight && windowHeight - 300) || 0, 600) }
            })
        );
    }

}




const TEMPORARY_DUMMY_CONTEXT = {
    "input": [
        {
            "value": "[\"NA12879_sample-WGS\", \"NA12878_sample-WGS\", \"NA12877_sample-WGS\"]",
            "value_type": "json",
            "argument_name": "sample_names",
            "argument_type": "parameter"
        },
        {
            "value": "[\"NA12879_sample-WGS (proband)\", \"NA12878_sample-WGS (mother)\", \"NA12877_sample-WGS (father)\"]",
            "value_type": "json",
            "argument_name": "bamsnap_titles",
            "argument_type": "parameter"
        },
        {
            "value": "[{\"parents\": [\"GAPIDUZDOX4R\", \"GAPIDQV37Z5Y\"], \"individual\": \"GAPID43VJKQ6\", \"sample_name\": \"NA12879_sample-WGS\", \"gender\": \"F\"}, {\"parents\": [], \"individual\": \"GAPIDUZDOX4R\", \"sample_name\": \"NA12878_sample-WGS\", \"gender\": \"F\"}, {\"parents\": [], \"individual\": \"GAPIDQV37Z5Y\", \"sample_name\": \"NA12877_sample-WGS\", \"gender\": \"M\"}]",
            "value_type": "string",
            "argument_name": "pedigree",
            "argument_type": "parameter"
        },
        {
            "value": "[\"NA12879_sample-WGS.rck.gz\", \"NA12878_sample-WGS.rck.gz\", \"NA12877_sample-WGS.rck.gz\"]",
            "value_type": "json",
            "argument_name": "rcktar_file_names",
            "argument_type": "parameter"
        },
        {
            "value": "3",
            "value_type": "integer",
            "argument_name": "family_size",
            "argument_type": "parameter"
        },
        {
            "files": [
                {
                    "file": {
                        "@id": "/files-processed/GAPFIMIARUOB/",
                        "status": "uploaded",
                        "display_title": "GAPFIMIARUOB.bam",
                        "@type": [
                            "FileProcessed",
                            "File",
                            "Item"
                        ],
                        "uuid": "676dd0c1-82c4-41be-9ae7-619ce47e158e",
                        "principals_allowed": {
                            "view": [
                                "editor_for.12a92962-8265-4fc0-b2f8-cf14f05db58b",
                                "group.admin",
                                "group.read-only-admin",
                                "remoteuser.EMBED",
                                "remoteuser.INDEXER"
                            ],
                            "edit": [
                                "editor_for.12a92962-8265-4fc0-b2f8-cf14f05db58b",
                                "group.admin"
                            ]
                        }
                    },
                    "dimension": "0"
                },
                {
                    "file": {
                        "@id": "/files-processed/GAPFICEE9LEN/",
                        "status": "uploaded",
                        "display_title": "GAPFICEE9LEN.bam",
                        "@type": [
                            "FileProcessed",
                            "File",
                            "Item"
                        ],
                        "uuid": "6d199319-3719-4a42-8883-365072bc13b3",
                        "principals_allowed": {
                            "view": [
                                "editor_for.12a92962-8265-4fc0-b2f8-cf14f05db58b",
                                "group.admin",
                                "group.read-only-admin",
                                "remoteuser.EMBED",
                                "remoteuser.INDEXER"
                            ],
                            "edit": [
                                "editor_for.12a92962-8265-4fc0-b2f8-cf14f05db58b",
                                "group.admin"
                            ]
                        }
                    },
                    "dimension": "1"
                },
                {
                    "file": {
                        "@id": "/files-processed/GAPFITNHTOZI/",
                        "status": "uploaded",
                        "display_title": "GAPFITNHTOZI.bam",
                        "@type": [
                            "FileProcessed",
                            "File",
                            "Item"
                        ],
                        "uuid": "222ce0eb-22f8-40e3-87d5-f2708ad18393",
                        "principals_allowed": {
                            "view": [
                                "editor_for.12a92962-8265-4fc0-b2f8-cf14f05db58b",
                                "group.admin",
                                "group.read-only-admin",
                                "remoteuser.EMBED",
                                "remoteuser.INDEXER"
                            ],
                            "edit": [
                                "editor_for.12a92962-8265-4fc0-b2f8-cf14f05db58b",
                                "group.admin"
                            ]
                        }
                    },
                    "dimension": "2"
                }
            ],
            "argument_name": "input_bams",
            "argument_type": "file"
        }
    ],
    "title": "MetaWorkflowRun WGS SNV Germline Trio v1.0.0 from 2022-04-29",
    "status": "in review",
    "project": {
        "status": "shared",
        "uuid": "12a92962-8265-4fc0-b2f8-cf14f05db58b",
        "@type": [
            "Project",
            "Item"
        ],
        "display_title": "CGAP Core",
        "@id": "/projects/cgap-core/",
        "principals_allowed": {
            "view": [
                "system.Authenticated"
            ],
            "edit": [
                "group.admin"
            ]
        }
    },
    "institution": {
        "@type": [
            "Institution",
            "Item"
        ],
        "@id": "/institutions/hms-dbmi/",
        "display_title": "HMS DBMI",
        "status": "current",
        "uuid": "828cd4fe-ebb0-4b36-a94a-d2e3a36cc989",
        "principals_allowed": {
            "view": [
                "group.admin",
                "group.read-only-admin",
                "remoteuser.EMBED",
                "remoteuser.INDEXER"
            ],
            "edit": [
                "group.admin"
            ]
        }
    },
    "date_created": "2022-04-29T17:06:20.276955+00:00",
    "final_status": "completed",
    "submitted_by": {
        "status": "current",
        "@id": "/users/7677f8a8-79d2-4cff-ab0a-a967a2a68e39/",
        "@type": [
            "User",
            "Item"
        ],
        "display_title": "Foursight App",
        "uuid": "7677f8a8-79d2-4cff-ab0a-a967a2a68e39",
        "principals_allowed": {
            "view": [
                "group.admin",
                "remoteuser.EMBED",
                "remoteuser.INDEXER",
                "userid.7677f8a8-79d2-4cff-ab0a-a967a2a68e39"
            ],
            "edit": [
                "group.admin"
            ]
        }
    },
    "common_fields": {
        "project": "/projects/cgap-core/",
        "institution": "/institutions/hms-dbmi/",
        "associated_meta_workflow_runs": [
            "a77b8431-2936-4f87-8405-8aa43ee777c1"
        ]
    },
    "input_samples": [
        "304fc930-ff45-4fa8-b554-e928600b1925",
        "a9a58f78-a1c1-4624-987d-4d451b1e7e75",
        "7514c6c1-9600-4290-b982-402b72fbe917"
    ],
    "last_modified": {
        "modified_by": {
            "@type": [
                "User",
                "Item"
            ],
            "display_title": "Foursight App",
            "@id": "/users/7677f8a8-79d2-4cff-ab0a-a967a2a68e39/",
            "uuid": "7677f8a8-79d2-4cff-ab0a-a967a2a68e39",
            "status": "current",
            "principals_allowed": {
                "view": [
                    "group.admin",
                    "remoteuser.EMBED",
                    "remoteuser.INDEXER",
                    "userid.7677f8a8-79d2-4cff-ab0a-a967a2a68e39"
                ],
                "edit": [
                    "group.admin"
                ]
            }
        },
        "date_modified": "2022-04-30T09:15:47.380954+00:00"
    },
    "meta_workflow": {
        "name": "WGS_SNV_germline_trio",
        "input": [
            {
                "argument_name": "input_bams",
                "argument_type": "file",
                "dimensionality": 1
            },
            {
                "value_type": "json",
                "argument_name": "sample_names",
                "argument_type": "parameter"
            },
            {
                "value_type": "json",
                "argument_name": "bamsnap_titles",
                "argument_type": "parameter"
            },
            {
                "value_type": "string",
                "argument_name": "pedigree",
                "argument_type": "parameter"
            },
            {
                "value_type": "json",
                "argument_name": "rcktar_file_names",
                "argument_type": "parameter"
            },
            {
                "value_type": "integer",
                "argument_name": "family_size",
                "argument_type": "parameter"
            },
            {
                "files": [
                    {
                        "file": {
                            "uuid": "1936f246-22e1-45dc-bb5c-9cfd55537fe7",
                            "display_title": "GAPFIXRDPDK5.fa",
                            "@type": [
                                "FileReference",
                                "File",
                                "Item"
                            ],
                            "status": "uploaded",
                            "@id": "/files-reference/GAPFIXRDPDK5/",
                            "principals_allowed": {
                                "view": [
                                    "editor_for.12a92962-8265-4fc0-b2f8-cf14f05db58b",
                                    "group.admin",
                                    "group.read-only-admin",
                                    "remoteuser.EMBED",
                                    "remoteuser.INDEXER"
                                ],
                                "edit": [
                                    "editor_for.12a92962-8265-4fc0-b2f8-cf14f05db58b",
                                    "group.admin"
                                ]
                            }
                        }
                    }
                ],
                "argument_name": "reference_fa",
                "argument_type": "file"
            },
            {
                "files": [
                    {
                        "file": {
                            "uuid": "8ed35691-0af4-467a-adbc-81eb088549f0",
                            "display_title": "GAPFI4LJRN98.vcf.gz",
                            "@type": [
                                "FileReference",
                                "File",
                                "Item"
                            ],
                            "status": "uploaded",
                            "@id": "/files-reference/GAPFI4LJRN98/",
                            "principals_allowed": {
                                "view": [
                                    "editor_for.12a92962-8265-4fc0-b2f8-cf14f05db58b",
                                    "group.admin",
                                    "group.read-only-admin",
                                    "remoteuser.EMBED",
                                    "remoteuser.INDEXER"
                                ],
                                "edit": [
                                    "editor_for.12a92962-8265-4fc0-b2f8-cf14f05db58b",
                                    "group.admin"
                                ]
                            }
                        }
                    }
                ],
                "argument_name": "known-sites-snp",
                "argument_type": "file"
            },
            {
                "files": [
                    {
                        "file": {
                            "uuid": "1c07a3aa-e2a3-498c-b838-15991c4a2f28",
                            "display_title": "GAPFIBGEOI72.txt",
                            "@type": [
                                "FileReference",
                                "File",
                                "Item"
                            ],
                            "status": "uploaded",
                            "@id": "/files-reference/GAPFIBGEOI72/",
                            "principals_allowed": {
                                "view": [
                                    "editor_for.12a92962-8265-4fc0-b2f8-cf14f05db58b",
                                    "group.admin",
                                    "group.read-only-admin",
                                    "remoteuser.EMBED",
                                    "remoteuser.INDEXER"
                                ],
                                "edit": [
                                    "editor_for.12a92962-8265-4fc0-b2f8-cf14f05db58b",
                                    "group.admin"
                                ]
                            }
                        }
                    }
                ],
                "argument_name": "regions",
                "argument_type": "file"
            },
            {
                "files": [
                    {
                        "file": {
                            "uuid": "a1d504ee-a313-4064-b6ae-65fed9738980",
                            "display_title": "GAPFIGJVJDUY.txt",
                            "@type": [
                                "FileReference",
                                "File",
                                "Item"
                            ],
                            "status": "uploaded",
                            "@id": "/files-reference/GAPFIGJVJDUY/",
                            "principals_allowed": {
                                "view": [
                                    "editor_for.12a92962-8265-4fc0-b2f8-cf14f05db58b",
                                    "group.admin",
                                    "group.read-only-admin",
                                    "remoteuser.EMBED",
                                    "remoteuser.INDEXER"
                                ],
                                "edit": [
                                    "editor_for.12a92962-8265-4fc0-b2f8-cf14f05db58b",
                                    "group.admin"
                                ]
                            }
                        }
                    }
                ],
                "argument_name": "chromosomes",
                "argument_type": "file"
            },
            {
                "files": [
                    {
                        "file": {
                            "uuid": "ea103486-b65a-4439-9d0b-1186f8e59388",
                            "display_title": "GAPFIL8XMTIV.vep.tar.gz",
                            "@type": [
                                "FileReference",
                                "File",
                                "Item"
                            ],
                            "status": "uploaded",
                            "@id": "/files-reference/GAPFIL8XMTIV/",
                            "principals_allowed": {
                                "view": [
                                    "editor_for.12a92962-8265-4fc0-b2f8-cf14f05db58b",
                                    "group.admin",
                                    "group.read-only-admin",
                                    "remoteuser.EMBED",
                                    "remoteuser.INDEXER"
                                ],
                                "edit": [
                                    "editor_for.12a92962-8265-4fc0-b2f8-cf14f05db58b",
                                    "group.admin"
                                ]
                            }
                        }
                    }
                ],
                "argument_name": "vep",
                "argument_type": "file"
            },
            {
                "files": [
                    {
                        "file": {
                            "uuid": "7db786d5-13d2-4622-bdd2-99866036b9b9",
                            "display_title": "GAPFI121RWQE.vcf.gz",
                            "@type": [
                                "FileReference",
                                "File",
                                "Item"
                            ],
                            "status": "uploaded",
                            "@id": "/files-reference/GAPFI121RWQE/",
                            "principals_allowed": {
                                "view": [
                                    "editor_for.12a92962-8265-4fc0-b2f8-cf14f05db58b",
                                    "group.admin",
                                    "group.read-only-admin",
                                    "remoteuser.EMBED",
                                    "remoteuser.INDEXER"
                                ],
                                "edit": [
                                    "editor_for.12a92962-8265-4fc0-b2f8-cf14f05db58b",
                                    "group.admin"
                                ]
                            }
                        }
                    }
                ],
                "argument_name": "clinvar",
                "argument_type": "file"
            },
            {
                "files": [
                    {
                        "file": {
                            "uuid": "dc02df4c-49ac-4532-b85c-02800941aa44",
                            "display_title": "GAPFIKJ66FKY.dbnsfp.gz",
                            "@type": [
                                "FileReference",
                                "File",
                                "Item"
                            ],
                            "status": "uploaded",
                            "@id": "/files-reference/GAPFIKJ66FKY/",
                            "principals_allowed": {
                                "view": [
                                    "editor_for.12a92962-8265-4fc0-b2f8-cf14f05db58b",
                                    "group.admin",
                                    "group.read-only-admin",
                                    "remoteuser.EMBED",
                                    "remoteuser.INDEXER"
                                ],
                                "edit": [
                                    "editor_for.12a92962-8265-4fc0-b2f8-cf14f05db58b",
                                    "group.admin"
                                ]
                            }
                        }
                    }
                ],
                "argument_name": "dbnsfp",
                "argument_type": "file"
            },
            {
                "files": [
                    {
                        "file": {
                            "uuid": "71a7d16b-8452-4266-ae80-bbede2e305e2",
                            "display_title": "GAPFI6BNNTKA.tar.gz",
                            "@type": [
                                "FileReference",
                                "File",
                                "Item"
                            ],
                            "status": "uploaded",
                            "@id": "/files-reference/GAPFI6BNNTKA/",
                            "principals_allowed": {
                                "view": [
                                    "editor_for.12a92962-8265-4fc0-b2f8-cf14f05db58b",
                                    "group.admin",
                                    "group.read-only-admin",
                                    "remoteuser.EMBED",
                                    "remoteuser.INDEXER"
                                ],
                                "edit": [
                                    "editor_for.12a92962-8265-4fc0-b2f8-cf14f05db58b",
                                    "group.admin"
                                ]
                            }
                        }
                    }
                ],
                "argument_name": "maxent",
                "argument_type": "file"
            },
            {
                "files": [
                    {
                        "file": {
                            "uuid": "a35e580c-7579-4312-a3a1-66810e6d9366",
                            "display_title": "GAPFISUOC64Q.vcf.gz",
                            "@type": [
                                "FileReference",
                                "File",
                                "Item"
                            ],
                            "status": "uploaded",
                            "@id": "/files-reference/GAPFISUOC64Q/",
                            "principals_allowed": {
                                "view": [
                                    "editor_for.12a92962-8265-4fc0-b2f8-cf14f05db58b",
                                    "group.admin",
                                    "group.read-only-admin",
                                    "remoteuser.EMBED",
                                    "remoteuser.INDEXER"
                                ],
                                "edit": [
                                    "editor_for.12a92962-8265-4fc0-b2f8-cf14f05db58b",
                                    "group.admin"
                                ]
                            }
                        }
                    }
                ],
                "argument_name": "spliceai_snv",
                "argument_type": "file"
            },
            {
                "files": [
                    {
                        "file": {
                            "uuid": "3b7c0c29-5ee2-47c8-95a8-d28e15d5de47",
                            "display_title": "GAPFIZOPCWIU.vcf.gz",
                            "@type": [
                                "FileReference",
                                "File",
                                "Item"
                            ],
                            "status": "uploaded",
                            "@id": "/files-reference/GAPFIZOPCWIU/",
                            "principals_allowed": {
                                "view": [
                                    "editor_for.12a92962-8265-4fc0-b2f8-cf14f05db58b",
                                    "group.admin",
                                    "group.read-only-admin",
                                    "remoteuser.EMBED",
                                    "remoteuser.INDEXER"
                                ],
                                "edit": [
                                    "editor_for.12a92962-8265-4fc0-b2f8-cf14f05db58b",
                                    "group.admin"
                                ]
                            }
                        }
                    }
                ],
                "argument_name": "spliceai_indel",
                "argument_type": "file"
            },
            {
                "files": [
                    {
                        "file": {
                            "uuid": "52c6cbf6-ae94-4c10-ad03-26ed34f74a3e",
                            "display_title": "GAPFIJOMA2Q8.vcf.gz",
                            "@type": [
                                "FileReference",
                                "File",
                                "Item"
                            ],
                            "status": "uploaded",
                            "@id": "/files-reference/GAPFIJOMA2Q8/",
                            "principals_allowed": {
                                "view": [
                                    "editor_for.12a92962-8265-4fc0-b2f8-cf14f05db58b",
                                    "group.admin",
                                    "group.read-only-admin",
                                    "remoteuser.EMBED",
                                    "remoteuser.INDEXER"
                                ],
                                "edit": [
                                    "editor_for.12a92962-8265-4fc0-b2f8-cf14f05db58b",
                                    "group.admin"
                                ]
                            }
                        }
                    }
                ],
                "argument_name": "gnomad",
                "argument_type": "file"
            },
            {
                "files": [
                    {
                        "file": {
                            "uuid": "dd6f0384-d0b5-47d6-99a8-395c0b72feed",
                            "display_title": "GAPFIC5416E6.vcf.gz",
                            "@type": [
                                "FileReference",
                                "File",
                                "Item"
                            ],
                            "status": "uploaded",
                            "@id": "/files-reference/GAPFIC5416E6/",
                            "principals_allowed": {
                                "view": [
                                    "editor_for.12a92962-8265-4fc0-b2f8-cf14f05db58b",
                                    "group.admin",
                                    "group.read-only-admin",
                                    "remoteuser.EMBED",
                                    "remoteuser.INDEXER"
                                ],
                                "edit": [
                                    "editor_for.12a92962-8265-4fc0-b2f8-cf14f05db58b",
                                    "group.admin"
                                ]
                            }
                        }
                    }
                ],
                "argument_name": "gnomad2",
                "argument_type": "file"
            },
            {
                "files": [
                    {
                        "file": {
                            "uuid": "672de47f-d058-4dbd-9fc4-3e134cfe71d8",
                            "display_title": "GAPFI566QQCV.tsv.gz",
                            "@type": [
                                "FileReference",
                                "File",
                                "Item"
                            ],
                            "status": "uploaded",
                            "@id": "/files-reference/GAPFI566QQCV/",
                            "principals_allowed": {
                                "view": [
                                    "editor_for.12a92962-8265-4fc0-b2f8-cf14f05db58b",
                                    "group.admin",
                                    "group.read-only-admin",
                                    "remoteuser.EMBED",
                                    "remoteuser.INDEXER"
                                ],
                                "edit": [
                                    "editor_for.12a92962-8265-4fc0-b2f8-cf14f05db58b",
                                    "group.admin"
                                ]
                            }
                        }
                    }
                ],
                "argument_name": "CADD_snv",
                "argument_type": "file"
            },
            {
                "files": [
                    {
                        "file": {
                            "uuid": "b9f123dd-be05-4a14-957a-5e1e5a5ce254",
                            "display_title": "GAPFI1GC6AXF.tsv.gz",
                            "@type": [
                                "FileReference",
                                "File",
                                "Item"
                            ],
                            "status": "uploaded",
                            "@id": "/files-reference/GAPFI1GC6AXF/",
                            "principals_allowed": {
                                "view": [
                                    "editor_for.12a92962-8265-4fc0-b2f8-cf14f05db58b",
                                    "group.admin",
                                    "group.read-only-admin",
                                    "remoteuser.EMBED",
                                    "remoteuser.INDEXER"
                                ],
                                "edit": [
                                    "editor_for.12a92962-8265-4fc0-b2f8-cf14f05db58b",
                                    "group.admin"
                                ]
                            }
                        }
                    }
                ],
                "argument_name": "CADD_indel",
                "argument_type": "file"
            },
            {
                "files": [
                    {
                        "file": {
                            "uuid": "af93aecb-6b8e-4c8b-b159-eefb3f9d0ffb",
                            "display_title": "GAPFIMQ7MHGA.bw",
                            "@type": [
                                "FileReference",
                                "File",
                                "Item"
                            ],
                            "status": "uploaded",
                            "@id": "/files-reference/GAPFIMQ7MHGA/",
                            "principals_allowed": {
                                "view": [
                                    "editor_for.12a92962-8265-4fc0-b2f8-cf14f05db58b",
                                    "group.admin",
                                    "group.read-only-admin",
                                    "remoteuser.EMBED",
                                    "remoteuser.INDEXER"
                                ],
                                "edit": [
                                    "editor_for.12a92962-8265-4fc0-b2f8-cf14f05db58b",
                                    "group.admin"
                                ]
                            }
                        }
                    }
                ],
                "argument_name": "phylop100bw",
                "argument_type": "file"
            },
            {
                "files": [
                    {
                        "file": {
                            "uuid": "f6809af1-f7b9-43c0-882a-16764ccc431d",
                            "display_title": "GAPFI5MRTDLN.bw",
                            "@type": [
                                "FileReference",
                                "File",
                                "Item"
                            ],
                            "status": "uploaded",
                            "@id": "/files-reference/GAPFI5MRTDLN/",
                            "principals_allowed": {
                                "view": [
                                    "editor_for.12a92962-8265-4fc0-b2f8-cf14f05db58b",
                                    "group.admin",
                                    "group.read-only-admin",
                                    "remoteuser.EMBED",
                                    "remoteuser.INDEXER"
                                ],
                                "edit": [
                                    "editor_for.12a92962-8265-4fc0-b2f8-cf14f05db58b",
                                    "group.admin"
                                ]
                            }
                        }
                    }
                ],
                "argument_name": "phylop30bw",
                "argument_type": "file"
            },
            {
                "files": [
                    {
                        "file": {
                            "uuid": "19f03828-175b-4594-ba1a-52ddabcf640d",
                            "display_title": "GAPFI6KXAQMV.bw",
                            "@type": [
                                "FileReference",
                                "File",
                                "Item"
                            ],
                            "status": "uploaded",
                            "@id": "/files-reference/GAPFI6KXAQMV/",
                            "principals_allowed": {
                                "view": [
                                    "editor_for.12a92962-8265-4fc0-b2f8-cf14f05db58b",
                                    "group.admin",
                                    "group.read-only-admin",
                                    "remoteuser.EMBED",
                                    "remoteuser.INDEXER"
                                ],
                                "edit": [
                                    "editor_for.12a92962-8265-4fc0-b2f8-cf14f05db58b",
                                    "group.admin"
                                ]
                            }
                        }
                    }
                ],
                "argument_name": "phastc100bw",
                "argument_type": "file"
            },
            {
                "files": [
                    {
                        "file": {
                            "uuid": "84f2bb24-edd7-459b-ab89-0a21866d7826",
                            "display_title": "GAPFI5MKCART.txt",
                            "@type": [
                                "FileReference",
                                "File",
                                "Item"
                            ],
                            "status": "uploaded",
                            "@id": "/files-reference/GAPFI5MKCART/",
                            "principals_allowed": {
                                "view": [
                                    "editor_for.12a92962-8265-4fc0-b2f8-cf14f05db58b",
                                    "group.admin",
                                    "group.read-only-admin",
                                    "remoteuser.EMBED",
                                    "remoteuser.INDEXER"
                                ],
                                "edit": [
                                    "editor_for.12a92962-8265-4fc0-b2f8-cf14f05db58b",
                                    "group.admin"
                                ]
                            }
                        }
                    }
                ],
                "argument_name": "genes",
                "argument_type": "file"
            },
            {
                "files": [
                    {
                        "file": {
                            "uuid": "196ef586-be28-40c5-a244-d739fd173984",
                            "display_title": "GAPFIMO8Y4K1.rck.tar",
                            "@type": [
                                "FileReference",
                                "File",
                                "Item"
                            ],
                            "status": "uploading",
                            "@id": "/files-reference/GAPFIMO8Y4K1/",
                            "principals_allowed": {
                                "view": [
                                    "editor_for.12a92962-8265-4fc0-b2f8-cf14f05db58b",
                                    "group.admin",
                                    "group.read-only-admin",
                                    "remoteuser.EMBED",
                                    "remoteuser.INDEXER"
                                ],
                                "edit": [
                                    "editor_for.12a92962-8265-4fc0-b2f8-cf14f05db58b",
                                    "group.admin"
                                ]
                            }
                        }
                    }
                ],
                "argument_name": "unrelated",
                "argument_type": "file"
            },
            {
                "files": [
                    {
                        "file": {
                            "uuid": "aa542c8e-b31c-4cff-b2d4-aa4037bb913c",
                            "display_title": "GAPFIF4JKLTH.vcf.gz",
                            "@type": [
                                "FileReference",
                                "File",
                                "Item"
                            ],
                            "status": "uploaded",
                            "@id": "/files-reference/GAPFIF4JKLTH/",
                            "principals_allowed": {
                                "view": [
                                    "editor_for.12a92962-8265-4fc0-b2f8-cf14f05db58b",
                                    "group.admin",
                                    "group.read-only-admin",
                                    "remoteuser.EMBED",
                                    "remoteuser.INDEXER"
                                ],
                                "edit": [
                                    "editor_for.12a92962-8265-4fc0-b2f8-cf14f05db58b",
                                    "group.admin"
                                ]
                            }
                        }
                    }
                ],
                "argument_name": "dbSNP_full_ref_vcf",
                "argument_type": "file"
            },
            {
                "files": [
                    {
                        "file": {
                            "uuid": "297c872a-5b6b-4fc3-83d3-f4a853f8805c",
                            "display_title": "GAPFIYPTSAU8.chain.gz",
                            "@type": [
                                "FileReference",
                                "File",
                                "Item"
                            ],
                            "status": "uploaded",
                            "@id": "/files-reference/GAPFIYPTSAU8/",
                            "principals_allowed": {
                                "view": [
                                    "editor_for.12a92962-8265-4fc0-b2f8-cf14f05db58b",
                                    "group.admin",
                                    "group.read-only-admin",
                                    "remoteuser.EMBED",
                                    "remoteuser.INDEXER"
                                ],
                                "edit": [
                                    "editor_for.12a92962-8265-4fc0-b2f8-cf14f05db58b",
                                    "group.admin"
                                ]
                            }
                        }
                    }
                ],
                "argument_name": "chainfile",
                "argument_type": "file"
            },
            {
                "value": "gnomADg_AF",
                "value_type": "string",
                "argument_name": "variant_filtering_aftag",
                "argument_type": "parameter"
            },
            {
                "value": "0.01",
                "value_type": "float",
                "argument_name": "variant_filtering_afthr",
                "argument_type": "parameter"
            }
        ],
        "title": "WGS SNV Germline Trio v1.0.0",
        "status": "in review",
        "project": {
            "status": "shared",
            "@id": "/projects/cgap-core/",
            "display_title": "CGAP Core",
            "uuid": "12a92962-8265-4fc0-b2f8-cf14f05db58b",
            "@type": [
                "Project",
                "Item"
            ],
            "principals_allowed": {
                "view": [
                    "system.Authenticated"
                ],
                "edit": [
                    "group.admin"
                ]
            }
        },
        "version": "v1.0.0",
        "accession": "GAPLAFW2J13T",
        "workflows": [
            {
                "name": "workflow_granite-mpileupCounts",
                "input": [
                    {
                        "scatter": 1,
                        "argument_name": "input_bam",
                        "argument_type": "file",
                        "source_argument_name": "input_bams"
                    },
                    {
                        "argument_name": "reference",
                        "argument_type": "file",
                        "source_argument_name": "reference_fa"
                    },
                    {
                        "argument_name": "regions",
                        "argument_type": "file"
                    },
                    {
                        "value": "15",
                        "value_type": "integer",
                        "argument_name": "nthreads",
                        "argument_type": "parameter"
                    }
                ],
                "config": {
                    "ebs_size": "4x",
                    "run_name": "run_workflow_granite-mpileupCounts",
                    "EBS_optimized": true,
                    "instance_type": "c5.4xlarge",
                    "spot_instance": true,
                    "behavior_on_capacity_limit": "wait_and_retry"
                },
                "workflow": {
                    "uuid": "ace7324e-2943-435b-ac1d-5565953953d5",
                    "status": "in review",
                    "display_title": "Run granite mpileupCounts - GAPFKJF3DVC7",
                    "@type": [
                        "Workflow",
                        "Item"
                    ],
                    "@id": "/workflows/ace7324e-2943-435b-ac1d-5565953953d5/",
                    "principals_allowed": {
                        "view": [
                            "editor_for.12a92962-8265-4fc0-b2f8-cf14f05db58b",
                            "group.admin",
                            "group.read-only-admin",
                            "remoteuser.EMBED",
                            "remoteuser.INDEXER"
                        ],
                        "edit": [
                            "editor_for.12a92962-8265-4fc0-b2f8-cf14f05db58b",
                            "group.admin"
                        ]
                    }
                },
                "custom_pf_fields": {}
            },
            {
                "name": "workflow_gatk-HaplotypeCaller",
                "input": [
                    {
                        "scatter": 1,
                        "argument_name": "input_bam",
                        "argument_type": "file",
                        "source_argument_name": "input_bams"
                    },
                    {
                        "argument_name": "reference",
                        "argument_type": "file",
                        "source_argument_name": "reference_fa"
                    },
                    {
                        "argument_name": "regions",
                        "argument_type": "file"
                    },
                    {
                        "value": "20",
                        "value_type": "integer",
                        "argument_name": "nthreads",
                        "argument_type": "parameter"
                    }
                ],
                "config": {
                    "ebs_size": "5x",
                    "run_name": "run_workflow_gatk-HaplotypeCaller",
                    "EBS_optimized": true,
                    "instance_type": "c5n.18xlarge",
                    "spot_instance": true,
                    "behavior_on_capacity_limit": "wait_and_retry"
                },
                "workflow": {
                    "uuid": "00035e35-be9c-41c6-9aa9-a0e0b49d0759",
                    "status": "in review",
                    "display_title": "Run gatk HaplotypeCaller - GAPWFO65T9P3",
                    "@type": [
                        "Workflow",
                        "Item"
                    ],
                    "@id": "/workflows/00035e35-be9c-41c6-9aa9-a0e0b49d0759/",
                    "principals_allowed": {
                        "view": [
                            "editor_for.12a92962-8265-4fc0-b2f8-cf14f05db58b",
                            "group.admin",
                            "group.read-only-admin",
                            "remoteuser.EMBED",
                            "remoteuser.INDEXER"
                        ],
                        "edit": [
                            "editor_for.12a92962-8265-4fc0-b2f8-cf14f05db58b",
                            "group.admin"
                        ]
                    }
                },
                "custom_pf_fields": {}
            },
            {
                "name": "workflow_gatk-CombineGVCFs",
                "input": [
                    {
                        "gather": 1,
                        "source": "workflow_gatk-HaplotypeCaller",
                        "argument_name": "input_gvcfs",
                        "argument_type": "file",
                        "source_argument_name": "gvcf"
                    },
                    {
                        "argument_name": "reference",
                        "argument_type": "file",
                        "source_argument_name": "reference_fa"
                    },
                    {
                        "argument_name": "chromosomes",
                        "argument_type": "file"
                    }
                ],
                "config": {
                    "ebs_size": "formula:str(10 + family_size - 3) + 'x'",
                    "run_name": "run_workflow_gatk-CombineGVCFs",
                    "EBS_optimized": true,
                    "instance_type": "c5n.4xlarge",
                    "spot_instance": true,
                    "behavior_on_capacity_limit": "wait_and_retry"
                },
                "workflow": {
                    "uuid": "dce317eb-8dcf-4ea3-94ef-6a4a4fbe4bed",
                    "status": "in review",
                    "display_title": "Run gatk CombineGVCFs - GAPWFR81TL9K",
                    "@type": [
                        "Workflow",
                        "Item"
                    ],
                    "@id": "/workflows/dce317eb-8dcf-4ea3-94ef-6a4a4fbe4bed/",
                    "principals_allowed": {
                        "view": [
                            "editor_for.12a92962-8265-4fc0-b2f8-cf14f05db58b",
                            "group.admin",
                            "group.read-only-admin",
                            "remoteuser.EMBED",
                            "remoteuser.INDEXER"
                        ],
                        "edit": [
                            "editor_for.12a92962-8265-4fc0-b2f8-cf14f05db58b",
                            "group.admin"
                        ]
                    }
                },
                "custom_pf_fields": {}
            },
            {
                "name": "workflow_granite-rckTar",
                "input": [
                    {
                        "gather": 1,
                        "rename": "formula:rcktar_file_names",
                        "source": "workflow_granite-mpileupCounts",
                        "argument_name": "input_rcks",
                        "argument_type": "file",
                        "source_argument_name": "rck"
                    }
                ],
                "config": {
                    "ebs_size": "2.5x",
                    "run_name": "run_workflow_granite-rckTar",
                    "EBS_optimized": true,
                    "instance_type": "c5.xlarge",
                    "spot_instance": true,
                    "behavior_on_capacity_limit": "wait_and_retry"
                },
                "workflow": {
                    "uuid": "14eb6324-1ac2-40fd-9f39-de7f46604763",
                    "status": "in review",
                    "display_title": "Create a tar archive of rck files and an associate index file - GAPW9IDRLG31",
                    "@type": [
                        "Workflow",
                        "Item"
                    ],
                    "@id": "/workflows/14eb6324-1ac2-40fd-9f39-de7f46604763/",
                    "principals_allowed": {
                        "view": [
                            "editor_for.12a92962-8265-4fc0-b2f8-cf14f05db58b",
                            "group.admin",
                            "group.read-only-admin",
                            "remoteuser.EMBED",
                            "remoteuser.INDEXER"
                        ],
                        "edit": [
                            "editor_for.12a92962-8265-4fc0-b2f8-cf14f05db58b",
                            "group.admin"
                        ]
                    }
                },
                "custom_pf_fields": {}
            },
            {
                "name": "workflow_gatk-GenotypeGVCFs-check",
                "input": [
                    {
                        "source": "workflow_gatk-CombineGVCFs",
                        "argument_name": "input_gvcf",
                        "argument_type": "file",
                        "source_argument_name": "combined_gvcf"
                    },
                    {
                        "argument_name": "reference",
                        "argument_type": "file",
                        "source_argument_name": "reference_fa"
                    },
                    {
                        "argument_name": "chromosomes",
                        "argument_type": "file"
                    },
                    {
                        "argument_name": "known-sites-snp",
                        "argument_type": "file"
                    }
                ],
                "config": {
                    "ebs_size": "2.5x",
                    "run_name": "run_workflow_gatk-GenotypeGVCFs-check",
                    "EBS_optimized": true,
                    "instance_type": "c5n.4xlarge",
                    "spot_instance": true,
                    "behavior_on_capacity_limit": "wait_and_retry"
                },
                "workflow": {
                    "uuid": "bf34d8b4-1b76-4f76-869b-7310537d0998",
                    "status": "in review",
                    "display_title": "Run gatk GenotypeGVCFs plus output integrity-check - GAPWF2H256PZ",
                    "@type": [
                        "Workflow",
                        "Item"
                    ],
                    "@id": "/workflows/bf34d8b4-1b76-4f76-869b-7310537d0998/",
                    "principals_allowed": {
                        "view": [
                            "editor_for.12a92962-8265-4fc0-b2f8-cf14f05db58b",
                            "group.admin",
                            "group.read-only-admin",
                            "remoteuser.EMBED",
                            "remoteuser.INDEXER"
                        ],
                        "edit": [
                            "editor_for.12a92962-8265-4fc0-b2f8-cf14f05db58b",
                            "group.admin"
                        ]
                    }
                },
                "custom_pf_fields": {}
            },
            {
                "name": "workflow_granite-qcVCF",
                "input": [
                    {
                        "source": "workflow_gatk-GenotypeGVCFs-check",
                        "argument_name": "input_vcf",
                        "argument_type": "file",
                        "source_argument_name": "vcf"
                    },
                    {
                        "argument_name": "pedigree",
                        "argument_type": "parameter"
                    },
                    {
                        "argument_name": "samples",
                        "argument_type": "parameter",
                        "source_argument_name": "sample_names"
                    },
                    {
                        "value": "true",
                        "value_type": "boolean",
                        "argument_name": "trio_errors",
                        "argument_type": "parameter"
                    },
                    {
                        "value": "false",
                        "value_type": "boolean",
                        "argument_name": "het_hom",
                        "argument_type": "parameter"
                    },
                    {
                        "value": "false",
                        "value_type": "boolean",
                        "argument_name": "ti_tv",
                        "argument_type": "parameter"
                    }
                ],
                "config": {
                    "ebs_size": "2x",
                    "run_name": "run_workflow_granite-qcVCF",
                    "EBS_optimized": true,
                    "instance_type": "t3.small",
                    "spot_instance": true,
                    "behavior_on_capacity_limit": "wait_and_retry"
                },
                "workflow": {
                    "uuid": "78ba0550-0c09-47e1-8559-a45be0058056",
                    "status": "in review",
                    "display_title": "Run granite qcVCF - GAPXFAL93FS1",
                    "@type": [
                        "Workflow",
                        "Item"
                    ],
                    "@id": "/workflows/78ba0550-0c09-47e1-8559-a45be0058056/",
                    "principals_allowed": {
                        "view": [
                            "editor_for.12a92962-8265-4fc0-b2f8-cf14f05db58b",
                            "group.admin",
                            "group.read-only-admin",
                            "remoteuser.EMBED",
                            "remoteuser.INDEXER"
                        ],
                        "edit": [
                            "editor_for.12a92962-8265-4fc0-b2f8-cf14f05db58b",
                            "group.admin"
                        ]
                    }
                }
            },
            {
                "name": "workflow_samplegeno",
                "input": [
                    {
                        "source": "workflow_gatk-GenotypeGVCFs-check",
                        "argument_name": "input_vcf",
                        "argument_type": "file",
                        "source_argument_name": "vcf"
                    }
                ],
                "config": {
                    "ebs_size": "7x",
                    "run_name": "run_samplegeno",
                    "EBS_optimized": true,
                    "instance_type": "t3.small",
                    "spot_instance": true,
                    "behavior_on_capacity_limit": "wait_and_retry"
                },
                "workflow": {
                    "uuid": "068446c4-87f9-48a1-8f46-cf05084392a9",
                    "status": "in review",
                    "display_title": "Add samplegeno - GAPGLK9R65ML",
                    "@type": [
                        "Workflow",
                        "Item"
                    ],
                    "@id": "/workflows/068446c4-87f9-48a1-8f46-cf05084392a9/",
                    "principals_allowed": {
                        "view": [
                            "editor_for.12a92962-8265-4fc0-b2f8-cf14f05db58b",
                            "group.admin",
                            "group.read-only-admin",
                            "remoteuser.EMBED",
                            "remoteuser.INDEXER"
                        ],
                        "edit": [
                            "editor_for.12a92962-8265-4fc0-b2f8-cf14f05db58b",
                            "group.admin"
                        ]
                    }
                },
                "custom_pf_fields": {}
            },
            {
                "name": "workflow_granite-qcVCF-1",
                "input": [
                    {
                        "source": "workflow_samplegeno",
                        "argument_name": "input_vcf",
                        "argument_type": "file",
                        "source_argument_name": "samplegeno_vcf"
                    },
                    {
                        "argument_name": "pedigree",
                        "argument_type": "parameter"
                    },
                    {
                        "argument_name": "samples",
                        "argument_type": "parameter",
                        "source_argument_name": "sample_names"
                    },
                    {
                        "value": "true",
                        "value_type": "boolean",
                        "argument_name": "trio_errors",
                        "argument_type": "parameter"
                    },
                    {
                        "value": "false",
                        "value_type": "boolean",
                        "argument_name": "het_hom",
                        "argument_type": "parameter"
                    },
                    {
                        "value": "false",
                        "value_type": "boolean",
                        "argument_name": "ti_tv",
                        "argument_type": "parameter"
                    }
                ],
                "config": {
                    "ebs_size": "2x",
                    "run_name": "run_workflow_granite-qcVCF",
                    "EBS_optimized": true,
                    "instance_type": "t3.small",
                    "spot_instance": true,
                    "behavior_on_capacity_limit": "wait_and_retry"
                },
                "workflow": {
                    "uuid": "78ba0550-0c09-47e1-8559-a45be0058056",
                    "status": "in review",
                    "display_title": "Run granite qcVCF - GAPXFAL93FS1",
                    "@type": [
                        "Workflow",
                        "Item"
                    ],
                    "@id": "/workflows/78ba0550-0c09-47e1-8559-a45be0058056/",
                    "principals_allowed": {
                        "view": [
                            "editor_for.12a92962-8265-4fc0-b2f8-cf14f05db58b",
                            "group.admin",
                            "group.read-only-admin",
                            "remoteuser.EMBED",
                            "remoteuser.INDEXER"
                        ],
                        "edit": [
                            "editor_for.12a92962-8265-4fc0-b2f8-cf14f05db58b",
                            "group.admin"
                        ]
                    }
                }
            },
            {
                "name": "workflow_vep-annot-check",
                "input": [
                    {
                        "source": "workflow_samplegeno",
                        "argument_name": "input_vcf",
                        "argument_type": "file",
                        "source_argument_name": "samplegeno_vcf"
                    },
                    {
                        "argument_name": "reference",
                        "argument_type": "file",
                        "source_argument_name": "reference_fa"
                    },
                    {
                        "argument_name": "regions",
                        "argument_type": "file"
                    },
                    {
                        "argument_name": "vep",
                        "argument_type": "file"
                    },
                    {
                        "argument_name": "clinvar",
                        "argument_type": "file"
                    },
                    {
                        "argument_name": "dbnsfp",
                        "argument_type": "file"
                    },
                    {
                        "argument_name": "maxent",
                        "argument_type": "file"
                    },
                    {
                        "argument_name": "spliceai_snv",
                        "argument_type": "file"
                    },
                    {
                        "argument_name": "spliceai_indel",
                        "argument_type": "file"
                    },
                    {
                        "argument_name": "gnomad",
                        "argument_type": "file"
                    },
                    {
                        "argument_name": "gnomad2",
                        "argument_type": "file"
                    },
                    {
                        "argument_name": "CADD_snv",
                        "argument_type": "file"
                    },
                    {
                        "argument_name": "CADD_indel",
                        "argument_type": "file"
                    },
                    {
                        "argument_name": "phylop100bw",
                        "argument_type": "file"
                    },
                    {
                        "argument_name": "phylop30bw",
                        "argument_type": "file"
                    },
                    {
                        "argument_name": "phastc100bw",
                        "argument_type": "file"
                    },
                    {
                        "value": "72",
                        "value_type": "integer",
                        "argument_name": "nthreads",
                        "argument_type": "parameter"
                    }
                ],
                "config": {
                    "ebs_size": "1.35x",
                    "run_name": "run_workflow_vep-annot-check",
                    "EBS_optimized": true,
                    "instance_type": "c5n.18xlarge",
                    "spot_instance": true,
                    "behavior_on_capacity_limit": "wait_and_retry"
                },
                "workflow": {
                    "uuid": "c1c3c327-cd25-49fb-a6f6-aa14ea7af13f",
                    "status": "in review",
                    "display_title": "Split multiallelic variants, filter by variant depth (DP), and run VEP to annotate input vcf file - GAPWFEE29PXB",
                    "@type": [
                        "Workflow",
                        "Item"
                    ],
                    "@id": "/workflows/c1c3c327-cd25-49fb-a6f6-aa14ea7af13f/",
                    "principals_allowed": {
                        "view": [
                            "editor_for.12a92962-8265-4fc0-b2f8-cf14f05db58b",
                            "group.admin",
                            "group.read-only-admin",
                            "remoteuser.EMBED",
                            "remoteuser.INDEXER"
                        ],
                        "edit": [
                            "editor_for.12a92962-8265-4fc0-b2f8-cf14f05db58b",
                            "group.admin"
                        ]
                    }
                },
                "custom_pf_fields": {}
            },
            {
                "name": "workflow_peddy",
                "input": [
                    {
                        "source": "workflow_vep-annot-check",
                        "argument_name": "input_vcf",
                        "argument_type": "file",
                        "source_argument_name": "annotated_vcf"
                    },
                    {
                        "argument_name": "pedigree",
                        "argument_type": "parameter"
                    }
                ],
                "config": {
                    "ebs_size": "10x",
                    "run_name": "run_workflow_peddy",
                    "EBS_optimized": true,
                    "instance_type": "t3.small",
                    "spot_instance": true,
                    "behavior_on_capacity_limit": "wait_and_retry"
                },
                "workflow": {
                    "uuid": "b90f16cc-7d6a-4306-836e-4e9cb7879fb3",
                    "status": "in review",
                    "display_title": "Run peddy - GAPXKK231Z91",
                    "@type": [
                        "Workflow",
                        "Item"
                    ],
                    "@id": "/workflows/b90f16cc-7d6a-4306-836e-4e9cb7879fb3/",
                    "principals_allowed": {
                        "view": [
                            "editor_for.12a92962-8265-4fc0-b2f8-cf14f05db58b",
                            "group.admin",
                            "group.read-only-admin",
                            "remoteuser.EMBED",
                            "remoteuser.INDEXER"
                        ],
                        "edit": [
                            "editor_for.12a92962-8265-4fc0-b2f8-cf14f05db58b",
                            "group.admin"
                        ]
                    }
                }
            },
            {
                "name": "workflow_granite-qcVCF-2",
                "input": [
                    {
                        "source": "workflow_vep-annot-check",
                        "argument_name": "input_vcf",
                        "argument_type": "file",
                        "source_argument_name": "annotated_vcf"
                    },
                    {
                        "argument_name": "pedigree",
                        "argument_type": "parameter"
                    },
                    {
                        "argument_name": "samples",
                        "argument_type": "parameter",
                        "source_argument_name": "sample_names"
                    },
                    {
                        "value": "true",
                        "value_type": "boolean",
                        "argument_name": "trio_errors",
                        "argument_type": "parameter"
                    },
                    {
                        "value": "true",
                        "value_type": "boolean",
                        "argument_name": "het_hom",
                        "argument_type": "parameter"
                    },
                    {
                        "value": "true",
                        "value_type": "boolean",
                        "argument_name": "ti_tv",
                        "argument_type": "parameter"
                    }
                ],
                "config": {
                    "ebs_size": "2x",
                    "run_name": "run_workflow_granite-qcVCF",
                    "EBS_optimized": true,
                    "instance_type": "t3.small",
                    "spot_instance": true,
                    "behavior_on_capacity_limit": "wait_and_retry"
                },
                "workflow": {
                    "uuid": "78ba0550-0c09-47e1-8559-a45be0058056",
                    "status": "in review",
                    "display_title": "Run granite qcVCF - GAPXFAL93FS1",
                    "@type": [
                        "Workflow",
                        "Item"
                    ],
                    "@id": "/workflows/78ba0550-0c09-47e1-8559-a45be0058056/",
                    "principals_allowed": {
                        "view": [
                            "editor_for.12a92962-8265-4fc0-b2f8-cf14f05db58b",
                            "group.admin",
                            "group.read-only-admin",
                            "remoteuser.EMBED",
                            "remoteuser.INDEXER"
                        ],
                        "edit": [
                            "editor_for.12a92962-8265-4fc0-b2f8-cf14f05db58b",
                            "group.admin"
                        ]
                    }
                },
                "dependencies": [
                    "workflow_peddy"
                ]
            },
            {
                "name": "workflow_granite-filtering-check",
                "input": [
                    {
                        "source": "workflow_vep-annot-check",
                        "argument_name": "input_vcf",
                        "argument_type": "file",
                        "source_argument_name": "annotated_vcf"
                    },
                    {
                        "argument_name": "genes",
                        "argument_type": "file"
                    },
                    {
                        "argument_name": "aftag",
                        "argument_type": "parameter",
                        "source_argument_name": "variant_filtering_aftag"
                    },
                    {
                        "argument_name": "afthr",
                        "argument_type": "parameter",
                        "source_argument_name": "variant_filtering_afthr"
                    }
                ],
                "config": {
                    "ebs_size": "10x",
                    "run_name": "run_workflow_granite-filtering-check",
                    "EBS_optimized": true,
                    "instance_type": "t3.medium",
                    "spot_instance": true,
                    "behavior_on_capacity_limit": "wait_and_retry"
                },
                "workflow": {
                    "uuid": "97190da3-b0db-4176-b8e2-dd2168f85c31",
                    "status": "in review",
                    "display_title": "Run granite to filter and clean input vcf (geneList, whiteList, cleanVCF, blackList) plus output integrity-check - GAPK43RH92DS",
                    "@type": [
                        "Workflow",
                        "Item"
                    ],
                    "@id": "/workflows/97190da3-b0db-4176-b8e2-dd2168f85c31/",
                    "principals_allowed": {
                        "view": [
                            "editor_for.12a92962-8265-4fc0-b2f8-cf14f05db58b",
                            "group.admin",
                            "group.read-only-admin",
                            "remoteuser.EMBED",
                            "remoteuser.INDEXER"
                        ],
                        "edit": [
                            "editor_for.12a92962-8265-4fc0-b2f8-cf14f05db58b",
                            "group.admin"
                        ]
                    }
                },
                "custom_pf_fields": {}
            },
            {
                "name": "workflow_granite-qcVCF-3",
                "input": [
                    {
                        "source": "workflow_granite-filtering-check",
                        "argument_name": "input_vcf",
                        "argument_type": "file",
                        "source_argument_name": "merged_vcf"
                    },
                    {
                        "argument_name": "pedigree",
                        "argument_type": "parameter"
                    },
                    {
                        "argument_name": "samples",
                        "argument_type": "parameter",
                        "source_argument_name": "sample_names"
                    },
                    {
                        "value": "true",
                        "value_type": "boolean",
                        "argument_name": "trio_errors",
                        "argument_type": "parameter"
                    },
                    {
                        "value": "false",
                        "value_type": "boolean",
                        "argument_name": "het_hom",
                        "argument_type": "parameter"
                    },
                    {
                        "value": "false",
                        "value_type": "boolean",
                        "argument_name": "ti_tv",
                        "argument_type": "parameter"
                    }
                ],
                "config": {
                    "ebs_size": "2x",
                    "run_name": "run_workflow_granite-qcVCF",
                    "EBS_optimized": true,
                    "instance_type": "t3.small",
                    "spot_instance": true,
                    "behavior_on_capacity_limit": "wait_and_retry"
                },
                "workflow": {
                    "uuid": "78ba0550-0c09-47e1-8559-a45be0058056",
                    "status": "in review",
                    "display_title": "Run granite qcVCF - GAPXFAL93FS1",
                    "@type": [
                        "Workflow",
                        "Item"
                    ],
                    "@id": "/workflows/78ba0550-0c09-47e1-8559-a45be0058056/",
                    "principals_allowed": {
                        "view": [
                            "editor_for.12a92962-8265-4fc0-b2f8-cf14f05db58b",
                            "group.admin",
                            "group.read-only-admin",
                            "remoteuser.EMBED",
                            "remoteuser.INDEXER"
                        ],
                        "edit": [
                            "editor_for.12a92962-8265-4fc0-b2f8-cf14f05db58b",
                            "group.admin"
                        ]
                    }
                }
            },
            {
                "name": "workflow_granite-novoCaller-rck-check",
                "input": [
                    {
                        "source": "workflow_granite-filtering-check",
                        "argument_name": "input_vcf",
                        "argument_type": "file",
                        "source_argument_name": "merged_vcf"
                    },
                    {
                        "argument_name": "unrelated",
                        "argument_type": "file"
                    },
                    {
                        "source": "workflow_granite-rckTar",
                        "argument_name": "trio",
                        "argument_type": "file",
                        "source_argument_name": "rck_tar"
                    }
                ],
                "config": {
                    "ebs_size": "2.5x",
                    "run_name": "run_workflow_granite-novoCaller-rck-check",
                    "EBS_optimized": true,
                    "instance_type": "c5.xlarge",
                    "spot_instance": true,
                    "behavior_on_capacity_limit": "wait_and_retry"
                },
                "workflow": {
                    "uuid": "4903b64d-ec78-4673-8bc9-cfd16d1cc0c1",
                    "status": "in review",
                    "display_title": "Run granite novoCaller using rck files plus output integrity-check - GAPS8LJG3FDL",
                    "@type": [
                        "Workflow",
                        "Item"
                    ],
                    "@id": "/workflows/4903b64d-ec78-4673-8bc9-cfd16d1cc0c1/",
                    "principals_allowed": {
                        "view": [
                            "editor_for.12a92962-8265-4fc0-b2f8-cf14f05db58b",
                            "group.admin",
                            "group.read-only-admin",
                            "remoteuser.EMBED",
                            "remoteuser.INDEXER"
                        ],
                        "edit": [
                            "editor_for.12a92962-8265-4fc0-b2f8-cf14f05db58b",
                            "group.admin"
                        ]
                    }
                },
                "custom_pf_fields": {}
            },
            {
                "name": "workflow_granite-qcVCF-4",
                "input": [
                    {
                        "source": "workflow_granite-novoCaller-rck-check",
                        "argument_name": "input_vcf",
                        "argument_type": "file",
                        "source_argument_name": "novoCaller_vcf"
                    },
                    {
                        "argument_name": "pedigree",
                        "argument_type": "parameter"
                    },
                    {
                        "argument_name": "samples",
                        "argument_type": "parameter",
                        "source_argument_name": "sample_names"
                    },
                    {
                        "value": "true",
                        "value_type": "boolean",
                        "argument_name": "trio_errors",
                        "argument_type": "parameter"
                    },
                    {
                        "value": "false",
                        "value_type": "boolean",
                        "argument_name": "het_hom",
                        "argument_type": "parameter"
                    },
                    {
                        "value": "false",
                        "value_type": "boolean",
                        "argument_name": "ti_tv",
                        "argument_type": "parameter"
                    }
                ],
                "config": {
                    "ebs_size": "2x",
                    "run_name": "run_workflow_granite-qcVCF",
                    "EBS_optimized": true,
                    "instance_type": "t3.small",
                    "spot_instance": true,
                    "behavior_on_capacity_limit": "wait_and_retry"
                },
                "workflow": {
                    "uuid": "78ba0550-0c09-47e1-8559-a45be0058056",
                    "status": "in review",
                    "display_title": "Run granite qcVCF - GAPXFAL93FS1",
                    "@type": [
                        "Workflow",
                        "Item"
                    ],
                    "@id": "/workflows/78ba0550-0c09-47e1-8559-a45be0058056/",
                    "principals_allowed": {
                        "view": [
                            "editor_for.12a92962-8265-4fc0-b2f8-cf14f05db58b",
                            "group.admin",
                            "group.read-only-admin",
                            "remoteuser.EMBED",
                            "remoteuser.INDEXER"
                        ],
                        "edit": [
                            "editor_for.12a92962-8265-4fc0-b2f8-cf14f05db58b",
                            "group.admin"
                        ]
                    }
                }
            },
            {
                "name": "workflow_granite-comHet-check",
                "input": [
                    {
                        "source": "workflow_granite-novoCaller-rck-check",
                        "argument_name": "input_vcf",
                        "argument_type": "file",
                        "source_argument_name": "novoCaller_vcf"
                    },
                    {
                        "argument_name": "trio",
                        "argument_type": "parameter",
                        "source_argument_name": "sample_names"
                    }
                ],
                "config": {
                    "ebs_size": "3.5x",
                    "run_name": "run_workflow_granite-comHet-check",
                    "EBS_optimized": true,
                    "instance_type": "t3.small",
                    "spot_instance": true,
                    "behavior_on_capacity_limit": "wait_and_retry"
                },
                "workflow": {
                    "uuid": "bdcd68e4-be7f-43ea-a6a7-567dc682217e",
                    "status": "in review",
                    "display_title": "Run granite comHet plus output integrity-check - GAPWFC63LK1I",
                    "@type": [
                        "Workflow",
                        "Item"
                    ],
                    "@id": "/workflows/bdcd68e4-be7f-43ea-a6a7-567dc682217e/",
                    "principals_allowed": {
                        "view": [
                            "editor_for.12a92962-8265-4fc0-b2f8-cf14f05db58b",
                            "group.admin",
                            "group.read-only-admin",
                            "remoteuser.EMBED",
                            "remoteuser.INDEXER"
                        ],
                        "edit": [
                            "editor_for.12a92962-8265-4fc0-b2f8-cf14f05db58b",
                            "group.admin"
                        ]
                    }
                },
                "custom_pf_fields": {}
            },
            {
                "name": "workflow_granite-qcVCF-5",
                "input": [
                    {
                        "source": "workflow_granite-comHet-check",
                        "argument_name": "input_vcf",
                        "argument_type": "file",
                        "source_argument_name": "comHet_vcf"
                    },
                    {
                        "argument_name": "pedigree",
                        "argument_type": "parameter"
                    },
                    {
                        "argument_name": "samples",
                        "argument_type": "parameter",
                        "source_argument_name": "sample_names"
                    },
                    {
                        "value": "true",
                        "value_type": "boolean",
                        "argument_name": "trio_errors",
                        "argument_type": "parameter"
                    },
                    {
                        "value": "false",
                        "value_type": "boolean",
                        "argument_name": "het_hom",
                        "argument_type": "parameter"
                    },
                    {
                        "value": "false",
                        "value_type": "boolean",
                        "argument_name": "ti_tv",
                        "argument_type": "parameter"
                    }
                ],
                "config": {
                    "ebs_size": "2x",
                    "run_name": "run_workflow_granite-qcVCF",
                    "EBS_optimized": true,
                    "instance_type": "t3.small",
                    "spot_instance": true,
                    "behavior_on_capacity_limit": "wait_and_retry"
                },
                "workflow": {
                    "uuid": "78ba0550-0c09-47e1-8559-a45be0058056",
                    "status": "in review",
                    "display_title": "Run granite qcVCF - GAPXFAL93FS1",
                    "@type": [
                        "Workflow",
                        "Item"
                    ],
                    "@id": "/workflows/78ba0550-0c09-47e1-8559-a45be0058056/",
                    "principals_allowed": {
                        "view": [
                            "editor_for.12a92962-8265-4fc0-b2f8-cf14f05db58b",
                            "group.admin",
                            "group.read-only-admin",
                            "remoteuser.EMBED",
                            "remoteuser.INDEXER"
                        ],
                        "edit": [
                            "editor_for.12a92962-8265-4fc0-b2f8-cf14f05db58b",
                            "group.admin"
                        ]
                    }
                }
            },
            {
                "name": "workflow_dbSNP_ID_fixer-check",
                "input": [
                    {
                        "source": "workflow_granite-comHet-check",
                        "argument_name": "input_vcf",
                        "argument_type": "file",
                        "source_argument_name": "comHet_vcf"
                    },
                    {
                        "argument_name": "dbSNP_ref_vcf",
                        "argument_type": "file",
                        "source_argument_name": "dbSNP_full_ref_vcf"
                    },
                    {
                        "argument_name": "region_file",
                        "argument_type": "file",
                        "source_argument_name": "regions"
                    }
                ],
                "config": {
                    "ebs_size": "2x",
                    "run_name": "run_workflow_dbSNP_ID_fixer-check",
                    "EBS_optimized": true,
                    "instance_type": "t3.small",
                    "spot_instance": true,
                    "behavior_on_capacity_limit": "wait_and_retry"
                },
                "workflow": {
                    "uuid": "2fe0a5c6-08f0-4c1b-8ac2-8209927e198b",
                    "status": "in review",
                    "display_title": "Run dbSNP ID fixer plus output integrity-check - GAPWFRQ54BG2",
                    "@type": [
                        "Workflow",
                        "Item"
                    ],
                    "@id": "/workflows/2fe0a5c6-08f0-4c1b-8ac2-8209927e198b/",
                    "principals_allowed": {
                        "view": [
                            "editor_for.12a92962-8265-4fc0-b2f8-cf14f05db58b",
                            "group.admin",
                            "group.read-only-admin",
                            "remoteuser.EMBED",
                            "remoteuser.INDEXER"
                        ],
                        "edit": [
                            "editor_for.12a92962-8265-4fc0-b2f8-cf14f05db58b",
                            "group.admin"
                        ]
                    }
                },
                "custom_pf_fields": {}
            },
            {
                "name": "workflow_granite-qcVCF-6",
                "input": [
                    {
                        "source": "workflow_dbSNP_ID_fixer-check",
                        "argument_name": "input_vcf",
                        "argument_type": "file",
                        "source_argument_name": "vcf"
                    },
                    {
                        "argument_name": "pedigree",
                        "argument_type": "parameter"
                    },
                    {
                        "argument_name": "samples",
                        "argument_type": "parameter",
                        "source_argument_name": "sample_names"
                    },
                    {
                        "value": "true",
                        "value_type": "boolean",
                        "argument_name": "trio_errors",
                        "argument_type": "parameter"
                    },
                    {
                        "value": "false",
                        "value_type": "boolean",
                        "argument_name": "het_hom",
                        "argument_type": "parameter"
                    },
                    {
                        "value": "false",
                        "value_type": "boolean",
                        "argument_name": "ti_tv",
                        "argument_type": "parameter"
                    }
                ],
                "config": {
                    "ebs_size": "2x",
                    "run_name": "run_workflow_granite-qcVCF",
                    "EBS_optimized": true,
                    "instance_type": "t3.small",
                    "spot_instance": true,
                    "behavior_on_capacity_limit": "wait_and_retry"
                },
                "workflow": {
                    "uuid": "78ba0550-0c09-47e1-8559-a45be0058056",
                    "status": "in review",
                    "display_title": "Run granite qcVCF - GAPXFAL93FS1",
                    "@type": [
                        "Workflow",
                        "Item"
                    ],
                    "@id": "/workflows/78ba0550-0c09-47e1-8559-a45be0058056/",
                    "principals_allowed": {
                        "view": [
                            "editor_for.12a92962-8265-4fc0-b2f8-cf14f05db58b",
                            "group.admin",
                            "group.read-only-admin",
                            "remoteuser.EMBED",
                            "remoteuser.INDEXER"
                        ],
                        "edit": [
                            "editor_for.12a92962-8265-4fc0-b2f8-cf14f05db58b",
                            "group.admin"
                        ]
                    }
                }
            },
            {
                "name": "workflow_hg19lo_hgvsg-check",
                "input": [
                    {
                        "source": "workflow_dbSNP_ID_fixer-check",
                        "argument_name": "input_vcf",
                        "argument_type": "file",
                        "source_argument_name": "vcf"
                    },
                    {
                        "argument_name": "chainfile",
                        "argument_type": "file"
                    }
                ],
                "config": {
                    "ebs_size": "3x",
                    "run_name": "run_workflow_hg19lo_hgvsg-check",
                    "EBS_optimized": true,
                    "instance_type": "t3.small",
                    "spot_instance": true,
                    "behavior_on_capacity_limit": "wait_and_retry"
                },
                "workflow": {
                    "uuid": "0f08dc44-42c6-4b84-8962-af26e2133784",
                    "status": "in review",
                    "display_title": "Run hg19 liftover, hgvsg creator, and a vcf integrity check - GAPWFR588CA2",
                    "@type": [
                        "Workflow",
                        "Item"
                    ],
                    "@id": "/workflows/0f08dc44-42c6-4b84-8962-af26e2133784/",
                    "principals_allowed": {
                        "view": [
                            "editor_for.12a92962-8265-4fc0-b2f8-cf14f05db58b",
                            "group.admin",
                            "group.read-only-admin",
                            "remoteuser.EMBED",
                            "remoteuser.INDEXER"
                        ],
                        "edit": [
                            "editor_for.12a92962-8265-4fc0-b2f8-cf14f05db58b",
                            "group.admin"
                        ]
                    }
                },
                "custom_pf_fields": {}
            },
            {
                "name": "bamsnap",
                "input": [
                    {
                        "argument_name": "input_bams",
                        "argument_type": "file",
                        "source_argument_name": "input_bams"
                    },
                    {
                        "source": "workflow_hg19lo_hgvsg-check",
                        "argument_name": "input_vcf",
                        "argument_type": "file",
                        "source_argument_name": "vcf"
                    },
                    {
                        "argument_name": "ref",
                        "argument_type": "file",
                        "source_argument_name": "reference_fa"
                    },
                    {
                        "value": "16",
                        "value_type": "integer",
                        "argument_name": "nproc",
                        "argument_type": "parameter"
                    },
                    {
                        "argument_name": "titles",
                        "argument_type": "parameter",
                        "source_argument_name": "bamsnap_titles"
                    }
                ],
                "config": {
                    "ebs_size": "2x",
                    "run_name": "run_bamsnap",
                    "EBS_optimized": true,
                    "instance_type": "r5a.4xlarge",
                    "spot_instance": true,
                    "behavior_on_capacity_limit": "wait_and_retry"
                },
                "workflow": {
                    "uuid": "3849ea9c-afbe-4733-8b97-5044dea21e04",
                    "status": "in review",
                    "display_title": "Run bamsnap - GAPWFBRDS2A1",
                    "@type": [
                        "Workflow",
                        "Item"
                    ],
                    "@id": "/workflows/3849ea9c-afbe-4733-8b97-5044dea21e04/",
                    "principals_allowed": {
                        "view": [
                            "editor_for.12a92962-8265-4fc0-b2f8-cf14f05db58b",
                            "group.admin",
                            "group.read-only-admin",
                            "remoteuser.EMBED",
                            "remoteuser.INDEXER"
                        ],
                        "edit": [
                            "editor_for.12a92962-8265-4fc0-b2f8-cf14f05db58b",
                            "group.admin"
                        ]
                    }
                }
            },
            {
                "name": "workflow_granite-qcVCF-7",
                "input": [
                    {
                        "source": "workflow_hg19lo_hgvsg-check",
                        "argument_name": "input_vcf",
                        "argument_type": "file",
                        "source_argument_name": "vcf"
                    },
                    {
                        "argument_name": "pedigree",
                        "argument_type": "parameter"
                    },
                    {
                        "argument_name": "samples",
                        "argument_type": "parameter",
                        "source_argument_name": "sample_names"
                    },
                    {
                        "value": "true",
                        "value_type": "boolean",
                        "argument_name": "trio_errors",
                        "argument_type": "parameter"
                    },
                    {
                        "value": "false",
                        "value_type": "boolean",
                        "argument_name": "het_hom",
                        "argument_type": "parameter"
                    },
                    {
                        "value": "false",
                        "value_type": "boolean",
                        "argument_name": "ti_tv",
                        "argument_type": "parameter"
                    }
                ],
                "config": {
                    "ebs_size": "2x",
                    "run_name": "run_workflow_granite-qcVCF",
                    "EBS_optimized": true,
                    "instance_type": "t3.small",
                    "spot_instance": true,
                    "behavior_on_capacity_limit": "wait_and_retry"
                },
                "workflow": {
                    "uuid": "78ba0550-0c09-47e1-8559-a45be0058056",
                    "status": "in review",
                    "display_title": "Run granite qcVCF - GAPXFAL93FS1",
                    "@type": [
                        "Workflow",
                        "Item"
                    ],
                    "@id": "/workflows/78ba0550-0c09-47e1-8559-a45be0058056/",
                    "principals_allowed": {
                        "view": [
                            "editor_for.12a92962-8265-4fc0-b2f8-cf14f05db58b",
                            "group.admin",
                            "group.read-only-admin",
                            "remoteuser.EMBED",
                            "remoteuser.INDEXER"
                        ],
                        "edit": [
                            "editor_for.12a92962-8265-4fc0-b2f8-cf14f05db58b",
                            "group.admin"
                        ]
                    }
                },
                "custom_qc_fields": {
                    "filtering_condition": "((Exonic and splice variants OR spliceAI>0.2) AND (gnomAD AF<0.01)) OR (Clinvar Pathogenic/Likely Pathogenic, Conflicting Interpretation or Risk Factor)"
                }
            }
        ],
        "description": "WGS downstream pipeline for SNV using GATK for trio",
        "institution": {
            "@type": [
                "Institution",
                "Item"
            ],
            "status": "current",
            "@id": "/institutions/hms-dbmi/",
            "display_title": "HMS DBMI",
            "uuid": "828cd4fe-ebb0-4b36-a94a-d2e3a36cc989",
            "principals_allowed": {
                "view": [
                    "group.admin",
                    "group.read-only-admin",
                    "remoteuser.EMBED",
                    "remoteuser.INDEXER"
                ],
                "edit": [
                    "group.admin"
                ]
            }
        },
        "date_created": "2022-04-20T18:58:45.908180+00:00",
        "submitted_by": {
            "@id": "/users/b5f738b6-455a-42e5-bc1c-77fbfd9b15d2/",
            "display_title": "Genomics Platform Administration",
            "uuid": "b5f738b6-455a-42e5-bc1c-77fbfd9b15d2",
            "@type": [
                "User",
                "Item"
            ],
            "status": "current",
            "principals_allowed": {
                "view": [
                    "group.admin",
                    "remoteuser.EMBED",
                    "remoteuser.INDEXER",
                    "userid.b5f738b6-455a-42e5-bc1c-77fbfd9b15d2"
                ],
                "edit": [
                    "group.admin"
                ]
            }
        },
        "last_modified": {
            "modified_by": {
                "uuid": "b5f738b6-455a-42e5-bc1c-77fbfd9b15d2",
                "display_title": "Genomics Platform Administration",
                "@type": [
                    "User",
                    "Item"
                ],
                "status": "current",
                "@id": "/users/b5f738b6-455a-42e5-bc1c-77fbfd9b15d2/",
                "principals_allowed": {
                    "view": [
                        "group.admin",
                        "remoteuser.EMBED",
                        "remoteuser.INDEXER",
                        "userid.b5f738b6-455a-42e5-bc1c-77fbfd9b15d2"
                    ],
                    "edit": [
                        "group.admin"
                    ]
                }
            },
            "date_modified": "2022-08-16T18:02:02.584625+00:00"
        },
        "schema_version": "1",
        "@id": "/meta-workflows/GAPLAFW2J13T/",
        "@type": [
            "MetaWorkflow",
            "Item"
        ],
        "uuid": "b59f61cb-71b3-4b09-b1f6-92bca1124aba",
        "principals_allowed": {
            "view": [
                "editor_for.12a92962-8265-4fc0-b2f8-cf14f05db58b",
                "group.admin",
                "group.read-only-admin",
                "remoteuser.EMBED",
                "remoteuser.INDEXER"
            ],
            "edit": [
                "editor_for.12a92962-8265-4fc0-b2f8-cf14f05db58b",
                "group.admin"
            ]
        },
        "display_title": "WGS SNV Germline Trio v1.0.0 - GAPLAFW2J13T",
        "@context": "/terms/",
        "actions": [
            {
                "name": "create",
                "title": "Create",
                "profile": "/profiles/MetaWorkflow.json",
                "href": "/meta-workflows/GAPLAFW2J13T/?currentAction=create"
            },
            {
                "name": "edit",
                "title": "Edit",
                "profile": "/profiles/MetaWorkflow.json",
                "href": "/meta-workflows/GAPLAFW2J13T/?currentAction=edit"
            }
        ],
        "aggregated-items": {},
        "validation-errors": []
    },
    "workflow_runs": [
        {
            "name": "workflow_granite-mpileupCounts",
            "jobid": "4XFgemyz3PRj",
            "shard": "0",
            "output": [
                {
                    "file": {
                        "display_title": "GAPFI9CNINA2.rck.gz",
                        "status": "uploaded",
                        "@id": "/files-processed/GAPFI9CNINA2/",
                        "uuid": "90d5572a-3cb5-40bd-8cec-68346c28705b",
                        "@type": [
                            "FileProcessed",
                            "File",
                            "Item"
                        ],
                        "principals_allowed": {
                            "view": [
                                "editor_for.12a92962-8265-4fc0-b2f8-cf14f05db58b",
                                "group.admin",
                                "group.read-only-admin",
                                "remoteuser.EMBED",
                                "remoteuser.INDEXER"
                            ],
                            "edit": [
                                "editor_for.12a92962-8265-4fc0-b2f8-cf14f05db58b",
                                "group.admin"
                            ]
                        }
                    },
                    "argument_name": "rck"
                }
            ],
            "status": "completed",
            "workflow_run": {
                "title": "workflow_granite-mpileupCounts v1.0.0 run 2022-04-29 17:10:35.675189",
                "status": "shared",
                "run_url": "https://console.aws.amazon.com/states/home?region=us-east-1#/executions/details/arn:aws:states:us-east-1:922729568532:execution:tibanna_zebra_cgap-wolf:run_workflow_granite-mpileupCounts-a94ad3b8-10eb-4f9e-ad8b-0051dfce4f4a",
                "parameters": [
                    {
                        "value": "15",
                        "ordinal": 1,
                        "dimension": "0",
                        "workflow_argument_name": "nthreads"
                    }
                ],
                "run_status": "complete",
                "input_files": [
                    {
                        "value": {
                            "display_title": "GAPFIMIARUOB.bam",
                            "uuid": "676dd0c1-82c4-41be-9ae7-619ce47e158e",
                            "status": "uploaded",
                            "file_size": 106616301305,
                            "href": "/files-processed/GAPFIMIARUOB/@@download/GAPFIMIARUOB.bam",
                            "@id": "/files-processed/GAPFIMIARUOB/",
                            "accession": "GAPFIMIARUOB",
                            "@type": [
                                "FileProcessed",
                                "File",
                                "Item"
                            ],
                            "file_format": {
                                "@type": [
                                    "FileFormat",
                                    "Item"
                                ],
                                "status": "shared",
                                "@id": "/file-formats/bam/",
                                "uuid": "d13d06cf-218e-4f61-aaf0-91f226248b3c",
                                "display_title": "bam",
                                "principals_allowed": {
                                    "view": [
                                        "system.Authenticated"
                                    ],
                                    "edit": [
                                        "group.admin"
                                    ]
                                }
                            },
                            "principals_allowed": {
                                "view": [
                                    "editor_for.12a92962-8265-4fc0-b2f8-cf14f05db58b",
                                    "group.admin",
                                    "group.read-only-admin",
                                    "remoteuser.EMBED",
                                    "remoteuser.INDEXER"
                                ],
                                "edit": [
                                    "editor_for.12a92962-8265-4fc0-b2f8-cf14f05db58b",
                                    "group.admin"
                                ]
                            },
                            "quality_metric": {
                                "overall_quality_status": "PASS",
                                "uuid": "b5978c20-271c-4ac4-8407-8b3fd3c0bb86",
                                "@id": "/quality-metrics-bamqc/b5978c20-271c-4ac4-8407-8b3fd3c0bb86/",
                                "@type": [
                                    "QualityMetricBamqc",
                                    "QualityMetric",
                                    "Item"
                                ],
                                "status": "shared",
                                "display_title": "QualityMetricBamqc from 2022-04-29",
                                "principals_allowed": {
                                    "view": [
                                        "system.Authenticated"
                                    ],
                                    "edit": [
                                        "group.admin"
                                    ]
                                }
                            }
                        },
                        "ordinal": 1,
                        "dimension": "0",
                        "workflow_argument_name": "input_bam"
                    },
                    {
                        "value": {
                            "display_title": "GAPFIXRDPDK5.fa",
                            "uuid": "1936f246-22e1-45dc-bb5c-9cfd55537fe7",
                            "status": "uploaded",
                            "file_size": 3263683042,
                            "href": "/files-reference/GAPFIXRDPDK5/@@download/GAPFIXRDPDK5.fa",
                            "@id": "/files-reference/GAPFIXRDPDK5/",
                            "accession": "GAPFIXRDPDK5",
                            "@type": [
                                "FileReference",
                                "File",
                                "Item"
                            ],
                            "file_format": {
                                "@type": [
                                    "FileFormat",
                                    "Item"
                                ],
                                "status": "shared",
                                "@id": "/file-formats/fa/",
                                "uuid": "5ced774b-a73e-4d1b-8186-d7fbbde7a3c2",
                                "display_title": "fa",
                                "principals_allowed": {
                                    "view": [
                                        "system.Authenticated"
                                    ],
                                    "edit": [
                                        "group.admin"
                                    ]
                                }
                            },
                            "principals_allowed": {
                                "view": [
                                    "editor_for.12a92962-8265-4fc0-b2f8-cf14f05db58b",
                                    "group.admin",
                                    "group.read-only-admin",
                                    "remoteuser.EMBED",
                                    "remoteuser.INDEXER"
                                ],
                                "edit": [
                                    "editor_for.12a92962-8265-4fc0-b2f8-cf14f05db58b",
                                    "group.admin"
                                ]
                            }
                        },
                        "ordinal": 1,
                        "dimension": "0",
                        "workflow_argument_name": "reference"
                    },
                    {
                        "value": {
                            "display_title": "GAPFIBGEOI72.txt",
                            "uuid": "1c07a3aa-e2a3-498c-b838-15991c4a2f28",
                            "status": "uploaded",
                            "file_size": 7603,
                            "href": "/files-reference/GAPFIBGEOI72/@@download/GAPFIBGEOI72.txt",
                            "@id": "/files-reference/GAPFIBGEOI72/",
                            "accession": "GAPFIBGEOI72",
                            "@type": [
                                "FileReference",
                                "File",
                                "Item"
                            ],
                            "file_format": {
                                "@type": [
                                    "FileFormat",
                                    "Item"
                                ],
                                "status": "shared",
                                "@id": "/file-formats/txt/",
                                "uuid": "0cd4e777-a596-4927-95c8-b07716121aa3",
                                "display_title": "txt",
                                "principals_allowed": {
                                    "view": [
                                        "system.Authenticated"
                                    ],
                                    "edit": [
                                        "group.admin"
                                    ]
                                }
                            },
                            "principals_allowed": {
                                "view": [
                                    "editor_for.12a92962-8265-4fc0-b2f8-cf14f05db58b",
                                    "group.admin",
                                    "group.read-only-admin",
                                    "remoteuser.EMBED",
                                    "remoteuser.INDEXER"
                                ],
                                "edit": [
                                    "editor_for.12a92962-8265-4fc0-b2f8-cf14f05db58b",
                                    "group.admin"
                                ]
                            }
                        },
                        "ordinal": 1,
                        "dimension": "0",
                        "workflow_argument_name": "regions"
                    }
                ],
                "awsem_job_id": "4XFgemyz3PRj",
                "date_created": "2022-04-29T17:10:35.780481+00:00",
                "output_files": [
                    {
                        "type": "Output processed file",
                        "value": {
                            "@type": [
                                "FileProcessed",
                                "File",
                                "Item"
                            ],
                            "file_format": {
                                "@id": "/file-formats/rck_gz/",
                                "status": "shared",
                                "@type": [
                                    "FileFormat",
                                    "Item"
                                ],
                                "display_title": "rck_gz",
                                "uuid": "20d4d3aa-5f1c-4b75-9e25-73f9f370fefa",
                                "principals_allowed": {
                                    "view": [
                                        "system.Authenticated"
                                    ],
                                    "edit": [
                                        "group.admin"
                                    ]
                                }
                            },
                            "accession": "GAPFI9CNINA2",
                            "uuid": "90d5572a-3cb5-40bd-8cec-68346c28705b",
                            "@id": "/files-processed/GAPFI9CNINA2/",
                            "file_size": 11922164723,
                            "display_title": "GAPFI9CNINA2.rck.gz",
                            "status": "uploaded",
                            "href": "/files-processed/GAPFI9CNINA2/@@download/GAPFI9CNINA2.rck.gz",
                            "principals_allowed": {
                                "view": [
                                    "editor_for.12a92962-8265-4fc0-b2f8-cf14f05db58b",
                                    "group.admin",
                                    "group.read-only-admin",
                                    "remoteuser.EMBED",
                                    "remoteuser.INDEXER"
                                ],
                                "edit": [
                                    "editor_for.12a92962-8265-4fc0-b2f8-cf14f05db58b",
                                    "group.admin"
                                ]
                            }
                        },
                        "format": "/file-formats/rck_gz/",
                        "upload_key": "90d5572a-3cb5-40bd-8cec-68346c28705b/GAPFI9CNINA2.rck.gz",
                        "extra_files": [
                            {
                                "href": "/90d5572a-3cb5-40bd-8cec-68346c28705b/@@download/GAPFI9CNINA2.rck.gz.tbi",
                                "uuid": "90d5572a-3cb5-40bd-8cec-68346c28705b",
                                "status": "uploading",
                                "filename": "GAPFI9CNINA2",
                                "accession": "GAPFI9CNINA2",
                                "upload_key": "90d5572a-3cb5-40bd-8cec-68346c28705b/GAPFI9CNINA2.rck.gz.tbi",
                                "file_format": "/file-formats/rck_gz_tbi/"
                            }
                        ],
                        "secondary_file_formats": [
                            "/file-formats/rck_gz_tbi/"
                        ],
                        "workflow_argument_name": "rck"
                    }
                ],
                "run_platform": "AWSEM",
                "submitted_by": {
                    "status": "current",
                    "@type": [
                        "User",
                        "Item"
                    ],
                    "display_title": "Tibanna App",
                    "uuid": "b041dba8-e2b2-4e54-a621-97edb508a0c4",
                    "@id": "/users/b041dba8-e2b2-4e54-a621-97edb508a0c4/",
                    "principals_allowed": {
                        "view": [
                            "group.admin",
                            "remoteuser.EMBED",
                            "remoteuser.INDEXER",
                            "userid.b041dba8-e2b2-4e54-a621-97edb508a0c4"
                        ],
                        "edit": [
                            "group.admin"
                        ]
                    }
                },
                "last_modified": {
                    "modified_by": {
                        "@type": [
                            "User",
                            "Item"
                        ],
                        "display_title": "Foursight App",
                        "status": "current",
                        "@id": "/users/7677f8a8-79d2-4cff-ab0a-a967a2a68e39/",
                        "uuid": "7677f8a8-79d2-4cff-ab0a-a967a2a68e39",
                        "principals_allowed": {
                            "view": [
                                "group.admin",
                                "remoteuser.EMBED",
                                "remoteuser.INDEXER",
                                "userid.7677f8a8-79d2-4cff-ab0a-a967a2a68e39"
                            ],
                            "edit": [
                                "group.admin"
                            ]
                        }
                    },
                    "date_modified": "2022-04-30T10:00:32.276827+00:00"
                },
                "metadata_only": false,
                "awsem_app_name": "workflow_granite-mpileupCounts",
                "quality_metric": {
                    "uuid": "401df9fe-5dfc-4d9e-8877-1ef620646402",
                    "status": "shared",
                    "@type": [
                        "QualityMetricWorkflowrun",
                        "QualityMetric",
                        "Item"
                    ],
                    "display_title": "QualityMetricWorkflowrun from 2022-04-29",
                    "@id": "/quality-metrics-workflowrun/401df9fe-5dfc-4d9e-8877-1ef620646402/",
                    "principals_allowed": {
                        "view": [
                            "system.Authenticated"
                        ],
                        "edit": [
                            "group.admin"
                        ]
                    }
                },
                "schema_version": "3",
                "awsem_postrun_json": "https://s3.amazonaws.com/cgap-biotest-main-application-tibanna-output/4XFgemyz3PRj.postrun.json",
                "associated_meta_workflow_runs": [
                    "a77b8431-2936-4f87-8405-8aa43ee777c1"
                ],
                "@id": "/workflow-runs-awsem/d9b35c06-6911-4b67-ac04-395331a98e55/",
                "@type": [
                    "WorkflowRunAwsem",
                    "WorkflowRun",
                    "Item"
                ],
                "uuid": "d9b35c06-6911-4b67-ac04-395331a98e55",
                "principals_allowed": {
                    "view": [
                        "system.Authenticated"
                    ],
                    "edit": [
                        "group.admin"
                    ]
                },
                "display_title": "workflow_granite-mpileupCounts v1.0.0 run 2022-04-29 17:10:35.675189",
                "@context": "/terms/",
                "actions": [
                    {
                        "name": "create",
                        "title": "Create",
                        "profile": "/profiles/WorkflowRunAwsem.json",
                        "href": "/workflow-runs-awsem/d9b35c06-6911-4b67-ac04-395331a98e55/?currentAction=create"
                    },
                    {
                        "name": "edit",
                        "title": "Edit",
                        "profile": "/profiles/WorkflowRunAwsem.json",
                        "href": "/workflow-runs-awsem/d9b35c06-6911-4b67-ac04-395331a98e55/?currentAction=edit"
                    }
                ],
                "aggregated-items": {},
                "validation-errors": []
            }
        },
        {
            "name": "workflow_granite-mpileupCounts",
            "jobid": "AAhwVmgHrjKw",
            "shard": "1",
            "output": [
                {
                    "file": {
                        "display_title": "GAPFID5AE9ME.rck.gz",
                        "status": "uploaded",
                        "@id": "/files-processed/GAPFID5AE9ME/",
                        "uuid": "76111407-5e86-48dd-bd13-f3a167638140",
                        "@type": [
                            "FileProcessed",
                            "File",
                            "Item"
                        ],
                        "principals_allowed": {
                            "view": [
                                "editor_for.12a92962-8265-4fc0-b2f8-cf14f05db58b",
                                "group.admin",
                                "group.read-only-admin",
                                "remoteuser.EMBED",
                                "remoteuser.INDEXER"
                            ],
                            "edit": [
                                "editor_for.12a92962-8265-4fc0-b2f8-cf14f05db58b",
                                "group.admin"
                            ]
                        }
                    },
                    "argument_name": "rck"
                }
            ],
            "status": "completed",
            "workflow_run": {
                "title": "workflow_granite-mpileupCounts v1.0.0 run 2022-04-29 17:10:38.581075",
                "status": "shared",
                "run_url": "https://console.aws.amazon.com/states/home?region=us-east-1#/executions/details/arn:aws:states:us-east-1:922729568532:execution:tibanna_zebra_cgap-wolf:run_workflow_granite-mpileupCounts-40d325ae-fe69-4346-a552-38cadf0c0125",
                "parameters": [
                    {
                        "value": "15",
                        "ordinal": 1,
                        "dimension": "0",
                        "workflow_argument_name": "nthreads"
                    }
                ],
                "run_status": "complete",
                "input_files": [
                    {
                        "value": {
                            "accession": "GAPFICEE9LEN",
                            "display_title": "GAPFICEE9LEN.bam",
                            "href": "/files-processed/GAPFICEE9LEN/@@download/GAPFICEE9LEN.bam",
                            "file_size": 104992897560,
                            "uuid": "6d199319-3719-4a42-8883-365072bc13b3",
                            "@id": "/files-processed/GAPFICEE9LEN/",
                            "@type": [
                                "FileProcessed",
                                "File",
                                "Item"
                            ],
                            "file_format": {
                                "@id": "/file-formats/bam/",
                                "uuid": "d13d06cf-218e-4f61-aaf0-91f226248b3c",
                                "status": "shared",
                                "@type": [
                                    "FileFormat",
                                    "Item"
                                ],
                                "display_title": "bam",
                                "principals_allowed": {
                                    "view": [
                                        "system.Authenticated"
                                    ],
                                    "edit": [
                                        "group.admin"
                                    ]
                                }
                            },
                            "status": "uploaded",
                            "quality_metric": {
                                "status": "shared",
                                "@id": "/quality-metrics-bamqc/23408f2f-13ca-49d6-b8bf-162623795dd6/",
                                "overall_quality_status": "PASS",
                                "uuid": "23408f2f-13ca-49d6-b8bf-162623795dd6",
                                "@type": [
                                    "QualityMetricBamqc",
                                    "QualityMetric",
                                    "Item"
                                ],
                                "display_title": "QualityMetricBamqc from 2022-04-29",
                                "principals_allowed": {
                                    "view": [
                                        "system.Authenticated"
                                    ],
                                    "edit": [
                                        "group.admin"
                                    ]
                                }
                            },
                            "principals_allowed": {
                                "view": [
                                    "editor_for.12a92962-8265-4fc0-b2f8-cf14f05db58b",
                                    "group.admin",
                                    "group.read-only-admin",
                                    "remoteuser.EMBED",
                                    "remoteuser.INDEXER"
                                ],
                                "edit": [
                                    "editor_for.12a92962-8265-4fc0-b2f8-cf14f05db58b",
                                    "group.admin"
                                ]
                            }
                        },
                        "ordinal": 1,
                        "dimension": "0",
                        "workflow_argument_name": "input_bam"
                    },
                    {
                        "value": {
                            "accession": "GAPFIXRDPDK5",
                            "display_title": "GAPFIXRDPDK5.fa",
                            "href": "/files-reference/GAPFIXRDPDK5/@@download/GAPFIXRDPDK5.fa",
                            "file_size": 3263683042,
                            "uuid": "1936f246-22e1-45dc-bb5c-9cfd55537fe7",
                            "@id": "/files-reference/GAPFIXRDPDK5/",
                            "@type": [
                                "FileReference",
                                "File",
                                "Item"
                            ],
                            "file_format": {
                                "@id": "/file-formats/fa/",
                                "uuid": "5ced774b-a73e-4d1b-8186-d7fbbde7a3c2",
                                "status": "shared",
                                "@type": [
                                    "FileFormat",
                                    "Item"
                                ],
                                "display_title": "fa",
                                "principals_allowed": {
                                    "view": [
                                        "system.Authenticated"
                                    ],
                                    "edit": [
                                        "group.admin"
                                    ]
                                }
                            },
                            "status": "uploaded",
                            "principals_allowed": {
                                "view": [
                                    "editor_for.12a92962-8265-4fc0-b2f8-cf14f05db58b",
                                    "group.admin",
                                    "group.read-only-admin",
                                    "remoteuser.EMBED",
                                    "remoteuser.INDEXER"
                                ],
                                "edit": [
                                    "editor_for.12a92962-8265-4fc0-b2f8-cf14f05db58b",
                                    "group.admin"
                                ]
                            }
                        },
                        "ordinal": 1,
                        "dimension": "0",
                        "workflow_argument_name": "reference"
                    },
                    {
                        "value": {
                            "accession": "GAPFIBGEOI72",
                            "display_title": "GAPFIBGEOI72.txt",
                            "href": "/files-reference/GAPFIBGEOI72/@@download/GAPFIBGEOI72.txt",
                            "file_size": 7603,
                            "uuid": "1c07a3aa-e2a3-498c-b838-15991c4a2f28",
                            "@id": "/files-reference/GAPFIBGEOI72/",
                            "@type": [
                                "FileReference",
                                "File",
                                "Item"
                            ],
                            "file_format": {
                                "@id": "/file-formats/txt/",
                                "uuid": "0cd4e777-a596-4927-95c8-b07716121aa3",
                                "status": "shared",
                                "@type": [
                                    "FileFormat",
                                    "Item"
                                ],
                                "display_title": "txt",
                                "principals_allowed": {
                                    "view": [
                                        "system.Authenticated"
                                    ],
                                    "edit": [
                                        "group.admin"
                                    ]
                                }
                            },
                            "status": "uploaded",
                            "principals_allowed": {
                                "view": [
                                    "editor_for.12a92962-8265-4fc0-b2f8-cf14f05db58b",
                                    "group.admin",
                                    "group.read-only-admin",
                                    "remoteuser.EMBED",
                                    "remoteuser.INDEXER"
                                ],
                                "edit": [
                                    "editor_for.12a92962-8265-4fc0-b2f8-cf14f05db58b",
                                    "group.admin"
                                ]
                            }
                        },
                        "ordinal": 1,
                        "dimension": "0",
                        "workflow_argument_name": "regions"
                    }
                ],
                "institution": {
                    "uuid": "828cd4fe-ebb0-4b36-a94a-d2e3a36cc989",
                    "@type": [
                        "Institution",
                        "Item"
                    ],
                    "@id": "/institutions/hms-dbmi/",
                    "display_title": "HMS DBMI",
                    "status": "current",
                    "principals_allowed": {
                        "view": [
                            "group.admin",
                            "group.read-only-admin",
                            "remoteuser.EMBED",
                            "remoteuser.INDEXER"
                        ],
                        "edit": [
                            "group.admin"
                        ]
                    }
                },
                "awsem_job_id": "AAhwVmgHrjKw",
                "date_created": "2022-04-29T17:10:38.665357+00:00",
                "output_files": [
                    {
                        "type": "Output processed file",
                        "value": {
                            "@type": [
                                "FileProcessed",
                                "File",
                                "Item"
                            ],
                            "display_title": "GAPFID5AE9ME.rck.gz",
                            "@id": "/files-processed/GAPFID5AE9ME/",
                            "status": "uploaded",
                            "file_size": 11874191792,
                            "accession": "GAPFID5AE9ME",
                            "href": "/files-processed/GAPFID5AE9ME/@@download/GAPFID5AE9ME.rck.gz",
                            "uuid": "76111407-5e86-48dd-bd13-f3a167638140",
                            "file_format": {
                                "status": "shared",
                                "@type": [
                                    "FileFormat",
                                    "Item"
                                ],
                                "@id": "/file-formats/rck_gz/",
                                "uuid": "20d4d3aa-5f1c-4b75-9e25-73f9f370fefa",
                                "display_title": "rck_gz",
                                "principals_allowed": {
                                    "view": [
                                        "system.Authenticated"
                                    ],
                                    "edit": [
                                        "group.admin"
                                    ]
                                }
                            },
                            "principals_allowed": {
                                "view": [
                                    "editor_for.12a92962-8265-4fc0-b2f8-cf14f05db58b",
                                    "group.admin",
                                    "group.read-only-admin",
                                    "remoteuser.EMBED",
                                    "remoteuser.INDEXER"
                                ],
                                "edit": [
                                    "editor_for.12a92962-8265-4fc0-b2f8-cf14f05db58b",
                                    "group.admin"
                                ]
                            }
                        },
                        "format": "/file-formats/rck_gz/",
                        "upload_key": "76111407-5e86-48dd-bd13-f3a167638140/GAPFID5AE9ME.rck.gz",
                        "extra_files": [
                            {
                                "href": "/76111407-5e86-48dd-bd13-f3a167638140/@@download/GAPFID5AE9ME.rck.gz.tbi",
                                "uuid": "76111407-5e86-48dd-bd13-f3a167638140",
                                "status": "uploading",
                                "filename": "GAPFID5AE9ME",
                                "accession": "GAPFID5AE9ME",
                                "upload_key": "76111407-5e86-48dd-bd13-f3a167638140/GAPFID5AE9ME.rck.gz.tbi",
                                "file_format": "/file-formats/rck_gz_tbi/"
                            }
                        ],
                        "secondary_file_formats": [
                            "/file-formats/rck_gz_tbi/"
                        ],
                        "workflow_argument_name": "rck"
                    }
                ],
                "run_platform": "AWSEM",
                "submitted_by": {
                    "@type": [
                        "User",
                        "Item"
                    ],
                    "status": "current",
                    "@id": "/users/b041dba8-e2b2-4e54-a621-97edb508a0c4/",
                    "display_title": "Tibanna App",
                    "uuid": "b041dba8-e2b2-4e54-a621-97edb508a0c4",
                    "principals_allowed": {
                        "view": [
                            "group.admin",
                            "remoteuser.EMBED",
                            "remoteuser.INDEXER",
                            "userid.b041dba8-e2b2-4e54-a621-97edb508a0c4"
                        ],
                        "edit": [
                            "group.admin"
                        ]
                    }
                },
                "last_modified": {
                    "modified_by": {
                        "@id": "/users/7677f8a8-79d2-4cff-ab0a-a967a2a68e39/",
                        "uuid": "7677f8a8-79d2-4cff-ab0a-a967a2a68e39",
                        "display_title": "Foursight App",
                        "@type": [
                            "User",
                            "Item"
                        ],
                        "status": "current",
                        "principals_allowed": {
                            "view": [
                                "group.admin",
                                "remoteuser.EMBED",
                                "remoteuser.INDEXER",
                                "userid.7677f8a8-79d2-4cff-ab0a-a967a2a68e39"
                            ],
                            "edit": [
                                "group.admin"
                            ]
                        }
                    },
                    "date_modified": "2022-04-30T10:00:32.159617+00:00"
                },
                "metadata_only": false,
                "awsem_app_name": "workflow_granite-mpileupCounts",
                "quality_metric": {
                    "status": "shared",
                    "uuid": "5d49990b-0ca8-439b-8172-98f01d0784ec",
                    "display_title": "QualityMetricWorkflowrun from 2022-04-29",
                    "@type": [
                        "QualityMetricWorkflowrun",
                        "QualityMetric",
                        "Item"
                    ],
                    "@id": "/quality-metrics-workflowrun/5d49990b-0ca8-439b-8172-98f01d0784ec/",
                    "principals_allowed": {
                        "view": [
                            "system.Authenticated"
                        ],
                        "edit": [
                            "group.admin"
                        ]
                    }
                },
                "schema_version": "3",
                "awsem_postrun_json": "https://s3.amazonaws.com/cgap-biotest-main-application-tibanna-output/AAhwVmgHrjKw.postrun.json",
                "associated_meta_workflow_runs": [
                    "a77b8431-2936-4f87-8405-8aa43ee777c1"
                ],
                "@id": "/workflow-runs-awsem/8bca34d8-54c4-4de8-9057-ffb868d44795/",
                "@type": [
                    "WorkflowRunAwsem",
                    "WorkflowRun",
                    "Item"
                ],
                "uuid": "8bca34d8-54c4-4de8-9057-ffb868d44795",
                "principals_allowed": {
                    "view": [
                        "system.Authenticated"
                    ],
                    "edit": [
                        "group.admin"
                    ]
                },
                "display_title": "workflow_granite-mpileupCounts v1.0.0 run 2022-04-29 17:10:38.581075",
                "@context": "/terms/",
                "actions": [
                    {
                        "name": "create",
                        "title": "Create",
                        "profile": "/profiles/WorkflowRunAwsem.json",
                        "href": "/workflow-runs-awsem/8bca34d8-54c4-4de8-9057-ffb868d44795/?currentAction=create"
                    },
                    {
                        "name": "edit",
                        "title": "Edit",
                        "profile": "/profiles/WorkflowRunAwsem.json",
                        "href": "/workflow-runs-awsem/8bca34d8-54c4-4de8-9057-ffb868d44795/?currentAction=edit"
                    }
                ],
                "aggregated-items": {},
                "validation-errors": []
            }
        },
        {
            "name": "workflow_granite-mpileupCounts",
            "jobid": "vqBh5nx47BKk",
            "shard": "2",
            "output": [
                {
                    "file": {
                        "display_title": "GAPFI5T4QIBP.rck.gz",
                        "status": "uploaded",
                        "@id": "/files-processed/GAPFI5T4QIBP/",
                        "uuid": "87e8832d-9ece-439a-8602-152b1ee74b0f",
                        "@type": [
                            "FileProcessed",
                            "File",
                            "Item"
                        ],
                        "principals_allowed": {
                            "view": [
                                "editor_for.12a92962-8265-4fc0-b2f8-cf14f05db58b",
                                "group.admin",
                                "group.read-only-admin",
                                "remoteuser.EMBED",
                                "remoteuser.INDEXER"
                            ],
                            "edit": [
                                "editor_for.12a92962-8265-4fc0-b2f8-cf14f05db58b",
                                "group.admin"
                            ]
                        }
                    },
                    "argument_name": "rck"
                }
            ],
            "status": "completed",
            "workflow_run": {
                "title": "workflow_granite-mpileupCounts v1.0.0 run 2022-04-29 17:10:45.405166",
                "status": "shared",
                "run_url": "https://console.aws.amazon.com/states/home?region=us-east-1#/executions/details/arn:aws:states:us-east-1:922729568532:execution:tibanna_zebra_cgap-wolf:run_workflow_granite-mpileupCounts-3d938778-5890-493a-b47c-077b9e63cf10",
                "parameters": [
                    {
                        "value": "15",
                        "ordinal": 1,
                        "dimension": "0",
                        "workflow_argument_name": "nthreads"
                    }
                ],
                "run_status": "complete",
                "input_files": [
                    {
                        "value": {
                            "uuid": "222ce0eb-22f8-40e3-87d5-f2708ad18393",
                            "href": "/files-processed/GAPFITNHTOZI/@@download/GAPFITNHTOZI.bam",
                            "@id": "/files-processed/GAPFITNHTOZI/",
                            "accession": "GAPFITNHTOZI",
                            "display_title": "GAPFITNHTOZI.bam",
                            "file_size": 111610806810,
                            "@type": [
                                "FileProcessed",
                                "File",
                                "Item"
                            ],
                            "status": "uploaded",
                            "file_format": {
                                "uuid": "d13d06cf-218e-4f61-aaf0-91f226248b3c",
                                "status": "shared",
                                "@id": "/file-formats/bam/",
                                "display_title": "bam",
                                "@type": [
                                    "FileFormat",
                                    "Item"
                                ],
                                "principals_allowed": {
                                    "view": [
                                        "system.Authenticated"
                                    ],
                                    "edit": [
                                        "group.admin"
                                    ]
                                }
                            },
                            "quality_metric": {
                                "display_title": "QualityMetricBamqc from 2022-04-29",
                                "@type": [
                                    "QualityMetricBamqc",
                                    "QualityMetric",
                                    "Item"
                                ],
                                "uuid": "5530ced5-5252-42f2-afde-0d14e30a669b",
                                "@id": "/quality-metrics-bamqc/5530ced5-5252-42f2-afde-0d14e30a669b/",
                                "status": "shared",
                                "overall_quality_status": "PASS",
                                "principals_allowed": {
                                    "view": [
                                        "system.Authenticated"
                                    ],
                                    "edit": [
                                        "group.admin"
                                    ]
                                }
                            },
                            "principals_allowed": {
                                "view": [
                                    "editor_for.12a92962-8265-4fc0-b2f8-cf14f05db58b",
                                    "group.admin",
                                    "group.read-only-admin",
                                    "remoteuser.EMBED",
                                    "remoteuser.INDEXER"
                                ],
                                "edit": [
                                    "editor_for.12a92962-8265-4fc0-b2f8-cf14f05db58b",
                                    "group.admin"
                                ]
                            }
                        },
                        "ordinal": 1,
                        "dimension": "0",
                        "workflow_argument_name": "input_bam"
                    },
                    {
                        "value": {
                            "uuid": "1936f246-22e1-45dc-bb5c-9cfd55537fe7",
                            "href": "/files-reference/GAPFIXRDPDK5/@@download/GAPFIXRDPDK5.fa",
                            "@id": "/files-reference/GAPFIXRDPDK5/",
                            "accession": "GAPFIXRDPDK5",
                            "display_title": "GAPFIXRDPDK5.fa",
                            "file_size": 3263683042,
                            "@type": [
                                "FileReference",
                                "File",
                                "Item"
                            ],
                            "status": "uploaded",
                            "file_format": {
                                "uuid": "5ced774b-a73e-4d1b-8186-d7fbbde7a3c2",
                                "status": "shared",
                                "@id": "/file-formats/fa/",
                                "display_title": "fa",
                                "@type": [
                                    "FileFormat",
                                    "Item"
                                ],
                                "principals_allowed": {
                                    "view": [
                                        "system.Authenticated"
                                    ],
                                    "edit": [
                                        "group.admin"
                                    ]
                                }
                            },
                            "principals_allowed": {
                                "view": [
                                    "editor_for.12a92962-8265-4fc0-b2f8-cf14f05db58b",
                                    "group.admin",
                                    "group.read-only-admin",
                                    "remoteuser.EMBED",
                                    "remoteuser.INDEXER"
                                ],
                                "edit": [
                                    "editor_for.12a92962-8265-4fc0-b2f8-cf14f05db58b",
                                    "group.admin"
                                ]
                            }
                        },
                        "ordinal": 1,
                        "dimension": "0",
                        "workflow_argument_name": "reference"
                    },
                    {
                        "value": {
                            "uuid": "1c07a3aa-e2a3-498c-b838-15991c4a2f28",
                            "href": "/files-reference/GAPFIBGEOI72/@@download/GAPFIBGEOI72.txt",
                            "@id": "/files-reference/GAPFIBGEOI72/",
                            "accession": "GAPFIBGEOI72",
                            "display_title": "GAPFIBGEOI72.txt",
                            "file_size": 7603,
                            "@type": [
                                "FileReference",
                                "File",
                                "Item"
                            ],
                            "status": "uploaded",
                            "file_format": {
                                "uuid": "0cd4e777-a596-4927-95c8-b07716121aa3",
                                "status": "shared",
                                "@id": "/file-formats/txt/",
                                "display_title": "txt",
                                "@type": [
                                    "FileFormat",
                                    "Item"
                                ],
                                "principals_allowed": {
                                    "view": [
                                        "system.Authenticated"
                                    ],
                                    "edit": [
                                        "group.admin"
                                    ]
                                }
                            },
                            "principals_allowed": {
                                "view": [
                                    "editor_for.12a92962-8265-4fc0-b2f8-cf14f05db58b",
                                    "group.admin",
                                    "group.read-only-admin",
                                    "remoteuser.EMBED",
                                    "remoteuser.INDEXER"
                                ],
                                "edit": [
                                    "editor_for.12a92962-8265-4fc0-b2f8-cf14f05db58b",
                                    "group.admin"
                                ]
                            }
                        },
                        "ordinal": 1,
                        "dimension": "0",
                        "workflow_argument_name": "regions"
                    }
                ],
                "awsem_job_id": "vqBh5nx47BKk",
                "date_created": "2022-04-29T17:10:45.490365+00:00",
                "output_files": [
                    {
                        "type": "Output processed file",
                        "value": {
                            "file_format": {
                                "status": "shared",
                                "@id": "/file-formats/rck_gz/",
                                "@type": [
                                    "FileFormat",
                                    "Item"
                                ],
                                "uuid": "20d4d3aa-5f1c-4b75-9e25-73f9f370fefa",
                                "display_title": "rck_gz",
                                "principals_allowed": {
                                    "view": [
                                        "system.Authenticated"
                                    ],
                                    "edit": [
                                        "group.admin"
                                    ]
                                }
                            },
                            "uuid": "87e8832d-9ece-439a-8602-152b1ee74b0f",
                            "@id": "/files-processed/GAPFI5T4QIBP/",
                            "file_size": 12086253767,
                            "status": "uploaded",
                            "href": "/files-processed/GAPFI5T4QIBP/@@download/GAPFI5T4QIBP.rck.gz",
                            "display_title": "GAPFI5T4QIBP.rck.gz",
                            "accession": "GAPFI5T4QIBP",
                            "@type": [
                                "FileProcessed",
                                "File",
                                "Item"
                            ],
                            "principals_allowed": {
                                "view": [
                                    "editor_for.12a92962-8265-4fc0-b2f8-cf14f05db58b",
                                    "group.admin",
                                    "group.read-only-admin",
                                    "remoteuser.EMBED",
                                    "remoteuser.INDEXER"
                                ],
                                "edit": [
                                    "editor_for.12a92962-8265-4fc0-b2f8-cf14f05db58b",
                                    "group.admin"
                                ]
                            }
                        },
                        "format": "/file-formats/rck_gz/",
                        "upload_key": "87e8832d-9ece-439a-8602-152b1ee74b0f/GAPFI5T4QIBP.rck.gz",
                        "extra_files": [
                            {
                                "href": "/87e8832d-9ece-439a-8602-152b1ee74b0f/@@download/GAPFI5T4QIBP.rck.gz.tbi",
                                "uuid": "87e8832d-9ece-439a-8602-152b1ee74b0f",
                                "status": "uploading",
                                "filename": "GAPFI5T4QIBP",
                                "accession": "GAPFI5T4QIBP",
                                "upload_key": "87e8832d-9ece-439a-8602-152b1ee74b0f/GAPFI5T4QIBP.rck.gz.tbi",
                                "file_format": "/file-formats/rck_gz_tbi/"
                            }
                        ],
                        "secondary_file_formats": [
                            "/file-formats/rck_gz_tbi/"
                        ],
                        "workflow_argument_name": "rck"
                    }
                ],
                "run_platform": "AWSEM",
                "submitted_by": {
                    "display_title": "Tibanna App",
                    "@type": [
                        "User",
                        "Item"
                    ],
                    "status": "current",
                    "uuid": "b041dba8-e2b2-4e54-a621-97edb508a0c4",
                    "@id": "/users/b041dba8-e2b2-4e54-a621-97edb508a0c4/",
                    "principals_allowed": {
                        "view": [
                            "group.admin",
                            "remoteuser.EMBED",
                            "remoteuser.INDEXER",
                            "userid.b041dba8-e2b2-4e54-a621-97edb508a0c4"
                        ],
                        "edit": [
                            "group.admin"
                        ]
                    }
                },
                "last_modified": {
                    "modified_by": {
                        "display_title": "Foursight App",
                        "status": "current",
                        "@type": [
                            "User",
                            "Item"
                        ],
                        "@id": "/users/7677f8a8-79d2-4cff-ab0a-a967a2a68e39/",
                        "uuid": "7677f8a8-79d2-4cff-ab0a-a967a2a68e39",
                        "principals_allowed": {
                            "view": [
                                "group.admin",
                                "remoteuser.EMBED",
                                "remoteuser.INDEXER",
                                "userid.7677f8a8-79d2-4cff-ab0a-a967a2a68e39"
                            ],
                            "edit": [
                                "group.admin"
                            ]
                        }
                    },
                    "date_modified": "2022-04-30T10:00:32.057729+00:00"
                },
                "metadata_only": false,
                "awsem_app_name": "workflow_granite-mpileupCounts",
                "quality_metric": {
                    "uuid": "fcc93d47-e937-42c9-9d0e-4f29e09c3dce",
                    "display_title": "QualityMetricWorkflowrun from 2022-04-29",
                    "@id": "/quality-metrics-workflowrun/fcc93d47-e937-42c9-9d0e-4f29e09c3dce/",
                    "@type": [
                        "QualityMetricWorkflowrun",
                        "QualityMetric",
                        "Item"
                    ],
                    "status": "shared",
                    "principals_allowed": {
                        "view": [
                            "system.Authenticated"
                        ],
                        "edit": [
                            "group.admin"
                        ]
                    }
                },
                "schema_version": "3",
                "awsem_postrun_json": "https://s3.amazonaws.com/cgap-biotest-main-application-tibanna-output/vqBh5nx47BKk.postrun.json",
                "associated_meta_workflow_runs": [
                    "a77b8431-2936-4f87-8405-8aa43ee777c1"
                ],
                "@id": "/workflow-runs-awsem/e93fc945-f186-41e0-a0c3-b19a007ce81c/",
                "@type": [
                    "WorkflowRunAwsem",
                    "WorkflowRun",
                    "Item"
                ],
                "uuid": "e93fc945-f186-41e0-a0c3-b19a007ce81c",
                "principals_allowed": {
                    "view": [
                        "system.Authenticated"
                    ],
                    "edit": [
                        "group.admin"
                    ]
                },
                "display_title": "workflow_granite-mpileupCounts v1.0.0 run 2022-04-29 17:10:45.405166",
                "@context": "/terms/",
                "actions": [
                    {
                        "name": "create",
                        "title": "Create",
                        "profile": "/profiles/WorkflowRunAwsem.json",
                        "href": "/workflow-runs-awsem/e93fc945-f186-41e0-a0c3-b19a007ce81c/?currentAction=create"
                    },
                    {
                        "name": "edit",
                        "title": "Edit",
                        "profile": "/profiles/WorkflowRunAwsem.json",
                        "href": "/workflow-runs-awsem/e93fc945-f186-41e0-a0c3-b19a007ce81c/?currentAction=edit"
                    }
                ],
                "aggregated-items": {},
                "validation-errors": []
            }
        },
        {
            "name": "workflow_gatk-HaplotypeCaller",
            "jobid": "jJvXPOKdKSQn",
            "shard": "0",
            "output": [
                {
                    "file": {
                        "display_title": "GAPFIH71G455.gvcf.gz",
                        "status": "uploaded",
                        "@id": "/files-processed/GAPFIH71G455/",
                        "uuid": "1e51aea4-7fc1-4936-852a-83fbae9f34ff",
                        "@type": [
                            "FileProcessed",
                            "File",
                            "Item"
                        ],
                        "principals_allowed": {
                            "view": [
                                "editor_for.12a92962-8265-4fc0-b2f8-cf14f05db58b",
                                "group.admin",
                                "group.read-only-admin",
                                "remoteuser.EMBED",
                                "remoteuser.INDEXER"
                            ],
                            "edit": [
                                "editor_for.12a92962-8265-4fc0-b2f8-cf14f05db58b",
                                "group.admin"
                            ]
                        }
                    },
                    "argument_name": "gvcf"
                }
            ],
            "status": "completed",
            "workflow_run": {
                "title": "workflow_gatk-HaplotypeCaller v1.0.0 run 2022-04-29 17:10:52.092723",
                "status": "shared",
                "project": {
                    "uuid": "12a92962-8265-4fc0-b2f8-cf14f05db58b",
                    "status": "shared",
                    "@type": [
                        "Project",
                        "Item"
                    ],
                    "display_title": "CGAP Core",
                    "@id": "/projects/cgap-core/",
                    "principals_allowed": {
                        "view": [
                            "system.Authenticated"
                        ],
                        "edit": [
                            "group.admin"
                        ]
                    }
                },
                "run_url": "https://console.aws.amazon.com/states/home?region=us-east-1#/executions/details/arn:aws:states:us-east-1:922729568532:execution:tibanna_zebra_cgap-wolf:run_workflow_gatk-HaplotypeCaller-2f579ad9-be64-4e96-8e71-3b8c811db6f6",
                "parameters": [
                    {
                        "value": "20",
                        "ordinal": 1,
                        "dimension": "0",
                        "workflow_argument_name": "nthreads"
                    }
                ],
                "run_status": "complete",
                "input_files": [
                    {
                        "value": {
                            "uuid": "676dd0c1-82c4-41be-9ae7-619ce47e158e",
                            "href": "/files-processed/GAPFIMIARUOB/@@download/GAPFIMIARUOB.bam",
                            "@id": "/files-processed/GAPFIMIARUOB/",
                            "accession": "GAPFIMIARUOB",
                            "display_title": "GAPFIMIARUOB.bam",
                            "file_size": 106616301305,
                            "@type": [
                                "FileProcessed",
                                "File",
                                "Item"
                            ],
                            "status": "uploaded",
                            "file_format": {
                                "uuid": "d13d06cf-218e-4f61-aaf0-91f226248b3c",
                                "status": "shared",
                                "@id": "/file-formats/bam/",
                                "display_title": "bam",
                                "@type": [
                                    "FileFormat",
                                    "Item"
                                ],
                                "principals_allowed": {
                                    "view": [
                                        "system.Authenticated"
                                    ],
                                    "edit": [
                                        "group.admin"
                                    ]
                                }
                            },
                            "quality_metric": {
                                "display_title": "QualityMetricBamqc from 2022-04-29",
                                "@type": [
                                    "QualityMetricBamqc",
                                    "QualityMetric",
                                    "Item"
                                ],
                                "uuid": "b5978c20-271c-4ac4-8407-8b3fd3c0bb86",
                                "@id": "/quality-metrics-bamqc/b5978c20-271c-4ac4-8407-8b3fd3c0bb86/",
                                "status": "shared",
                                "overall_quality_status": "PASS",
                                "principals_allowed": {
                                    "view": [
                                        "system.Authenticated"
                                    ],
                                    "edit": [
                                        "group.admin"
                                    ]
                                }
                            },
                            "principals_allowed": {
                                "view": [
                                    "editor_for.12a92962-8265-4fc0-b2f8-cf14f05db58b",
                                    "group.admin",
                                    "group.read-only-admin",
                                    "remoteuser.EMBED",
                                    "remoteuser.INDEXER"
                                ],
                                "edit": [
                                    "editor_for.12a92962-8265-4fc0-b2f8-cf14f05db58b",
                                    "group.admin"
                                ]
                            }
                        },
                        "ordinal": 1,
                        "dimension": "0",
                        "workflow_argument_name": "input_bam"
                    },
                    {
                        "value": {
                            "uuid": "1936f246-22e1-45dc-bb5c-9cfd55537fe7",
                            "href": "/files-reference/GAPFIXRDPDK5/@@download/GAPFIXRDPDK5.fa",
                            "@id": "/files-reference/GAPFIXRDPDK5/",
                            "accession": "GAPFIXRDPDK5",
                            "display_title": "GAPFIXRDPDK5.fa",
                            "file_size": 3263683042,
                            "@type": [
                                "FileReference",
                                "File",
                                "Item"
                            ],
                            "status": "uploaded",
                            "file_format": {
                                "uuid": "5ced774b-a73e-4d1b-8186-d7fbbde7a3c2",
                                "status": "shared",
                                "@id": "/file-formats/fa/",
                                "display_title": "fa",
                                "@type": [
                                    "FileFormat",
                                    "Item"
                                ],
                                "principals_allowed": {
                                    "view": [
                                        "system.Authenticated"
                                    ],
                                    "edit": [
                                        "group.admin"
                                    ]
                                }
                            },
                            "principals_allowed": {
                                "view": [
                                    "editor_for.12a92962-8265-4fc0-b2f8-cf14f05db58b",
                                    "group.admin",
                                    "group.read-only-admin",
                                    "remoteuser.EMBED",
                                    "remoteuser.INDEXER"
                                ],
                                "edit": [
                                    "editor_for.12a92962-8265-4fc0-b2f8-cf14f05db58b",
                                    "group.admin"
                                ]
                            }
                        },
                        "ordinal": 1,
                        "dimension": "0",
                        "workflow_argument_name": "reference"
                    },
                    {
                        "value": {
                            "uuid": "1c07a3aa-e2a3-498c-b838-15991c4a2f28",
                            "href": "/files-reference/GAPFIBGEOI72/@@download/GAPFIBGEOI72.txt",
                            "@id": "/files-reference/GAPFIBGEOI72/",
                            "accession": "GAPFIBGEOI72",
                            "display_title": "GAPFIBGEOI72.txt",
                            "file_size": 7603,
                            "@type": [
                                "FileReference",
                                "File",
                                "Item"
                            ],
                            "status": "uploaded",
                            "file_format": {
                                "uuid": "0cd4e777-a596-4927-95c8-b07716121aa3",
                                "status": "shared",
                                "@id": "/file-formats/txt/",
                                "display_title": "txt",
                                "@type": [
                                    "FileFormat",
                                    "Item"
                                ],
                                "principals_allowed": {
                                    "view": [
                                        "system.Authenticated"
                                    ],
                                    "edit": [
                                        "group.admin"
                                    ]
                                }
                            },
                            "principals_allowed": {
                                "view": [
                                    "editor_for.12a92962-8265-4fc0-b2f8-cf14f05db58b",
                                    "group.admin",
                                    "group.read-only-admin",
                                    "remoteuser.EMBED",
                                    "remoteuser.INDEXER"
                                ],
                                "edit": [
                                    "editor_for.12a92962-8265-4fc0-b2f8-cf14f05db58b",
                                    "group.admin"
                                ]
                            }
                        },
                        "ordinal": 1,
                        "dimension": "0",
                        "workflow_argument_name": "regions"
                    }
                ],
                "institution": {
                    "status": "current",
                    "uuid": "828cd4fe-ebb0-4b36-a94a-d2e3a36cc989",
                    "@id": "/institutions/hms-dbmi/",
                    "@type": [
                        "Institution",
                        "Item"
                    ],
                    "display_title": "HMS DBMI",
                    "principals_allowed": {
                        "view": [
                            "group.admin",
                            "group.read-only-admin",
                            "remoteuser.EMBED",
                            "remoteuser.INDEXER"
                        ],
                        "edit": [
                            "group.admin"
                        ]
                    }
                },
                "awsem_job_id": "jJvXPOKdKSQn",
                "date_created": "2022-04-29T17:10:52.194059+00:00",
                "output_files": [
                    {
                        "type": "Output processed file",
                        "value": {
                            "file_format": {
                                "status": "shared",
                                "@id": "/file-formats/gvcf_gz/",
                                "@type": [
                                    "FileFormat",
                                    "Item"
                                ],
                                "uuid": "ad47d469-4561-4234-bce2-820f08f58e7c",
                                "display_title": "gvcf_gz",
                                "principals_allowed": {
                                    "view": [
                                        "system.Authenticated"
                                    ],
                                    "edit": [
                                        "group.admin"
                                    ]
                                }
                            },
                            "uuid": "1e51aea4-7fc1-4936-852a-83fbae9f34ff",
                            "@id": "/files-processed/GAPFIH71G455/",
                            "file_size": 2212472843,
                            "status": "uploaded",
                            "href": "/files-processed/GAPFIH71G455/@@download/GAPFIH71G455.gvcf.gz",
                            "display_title": "GAPFIH71G455.gvcf.gz",
                            "accession": "GAPFIH71G455",
                            "@type": [
                                "FileProcessed",
                                "File",
                                "Item"
                            ],
                            "principals_allowed": {
                                "view": [
                                    "editor_for.12a92962-8265-4fc0-b2f8-cf14f05db58b",
                                    "group.admin",
                                    "group.read-only-admin",
                                    "remoteuser.EMBED",
                                    "remoteuser.INDEXER"
                                ],
                                "edit": [
                                    "editor_for.12a92962-8265-4fc0-b2f8-cf14f05db58b",
                                    "group.admin"
                                ]
                            }
                        },
                        "format": "/file-formats/gvcf_gz/",
                        "upload_key": "1e51aea4-7fc1-4936-852a-83fbae9f34ff/GAPFIH71G455.gvcf.gz",
                        "extra_files": [
                            {
                                "href": "/1e51aea4-7fc1-4936-852a-83fbae9f34ff/@@download/GAPFIH71G455.gvcf.gz.tbi",
                                "uuid": "1e51aea4-7fc1-4936-852a-83fbae9f34ff",
                                "status": "uploading",
                                "filename": "GAPFIH71G455",
                                "accession": "GAPFIH71G455",
                                "upload_key": "1e51aea4-7fc1-4936-852a-83fbae9f34ff/GAPFIH71G455.gvcf.gz.tbi",
                                "file_format": "/file-formats/gvcf_gz_tbi/"
                            }
                        ],
                        "secondary_file_formats": [
                            "/file-formats/gvcf_gz_tbi/"
                        ],
                        "workflow_argument_name": "gvcf"
                    }
                ],
                "run_platform": "AWSEM",
                "submitted_by": {
                    "display_title": "Tibanna App",
                    "@type": [
                        "User",
                        "Item"
                    ],
                    "status": "current",
                    "uuid": "b041dba8-e2b2-4e54-a621-97edb508a0c4",
                    "@id": "/users/b041dba8-e2b2-4e54-a621-97edb508a0c4/",
                    "principals_allowed": {
                        "view": [
                            "group.admin",
                            "remoteuser.EMBED",
                            "remoteuser.INDEXER",
                            "userid.b041dba8-e2b2-4e54-a621-97edb508a0c4"
                        ],
                        "edit": [
                            "group.admin"
                        ]
                    }
                },
                "last_modified": {
                    "modified_by": {
                        "display_title": "Foursight App",
                        "status": "current",
                        "@type": [
                            "User",
                            "Item"
                        ],
                        "@id": "/users/7677f8a8-79d2-4cff-ab0a-a967a2a68e39/",
                        "uuid": "7677f8a8-79d2-4cff-ab0a-a967a2a68e39",
                        "principals_allowed": {
                            "view": [
                                "group.admin",
                                "remoteuser.EMBED",
                                "remoteuser.INDEXER",
                                "userid.7677f8a8-79d2-4cff-ab0a-a967a2a68e39"
                            ],
                            "edit": [
                                "group.admin"
                            ]
                        }
                    },
                    "date_modified": "2022-04-30T10:00:31.924250+00:00"
                },
                "metadata_only": false,
                "awsem_app_name": "workflow_gatk-HaplotypeCaller",
                "quality_metric": {
                    "uuid": "2a57391c-6566-4415-85d8-1c3af24b7263",
                    "display_title": "QualityMetricWorkflowrun from 2022-04-29",
                    "@id": "/quality-metrics-workflowrun/2a57391c-6566-4415-85d8-1c3af24b7263/",
                    "@type": [
                        "QualityMetricWorkflowrun",
                        "QualityMetric",
                        "Item"
                    ],
                    "status": "shared",
                    "principals_allowed": {
                        "view": [
                            "system.Authenticated"
                        ],
                        "edit": [
                            "group.admin"
                        ]
                    }
                },
                "schema_version": "3",
                "awsem_postrun_json": "https://s3.amazonaws.com/cgap-biotest-main-application-tibanna-output/jJvXPOKdKSQn.postrun.json",
                "associated_meta_workflow_runs": [
                    "a77b8431-2936-4f87-8405-8aa43ee777c1"
                ],
                "@id": "/workflow-runs-awsem/d2063a22-99c7-420e-b179-6daedad12499/",
                "@type": [
                    "WorkflowRunAwsem",
                    "WorkflowRun",
                    "Item"
                ],
                "uuid": "d2063a22-99c7-420e-b179-6daedad12499",
                "principals_allowed": {
                    "view": [
                        "system.Authenticated"
                    ],
                    "edit": [
                        "group.admin"
                    ]
                },
                "display_title": "workflow_gatk-HaplotypeCaller v1.0.0 run 2022-04-29 17:10:52.092723",
                "@context": "/terms/",
                "actions": [
                    {
                        "name": "create",
                        "title": "Create",
                        "profile": "/profiles/WorkflowRunAwsem.json",
                        "href": "/workflow-runs-awsem/d2063a22-99c7-420e-b179-6daedad12499/?currentAction=create"
                    },
                    {
                        "name": "edit",
                        "title": "Edit",
                        "profile": "/profiles/WorkflowRunAwsem.json",
                        "href": "/workflow-runs-awsem/d2063a22-99c7-420e-b179-6daedad12499/?currentAction=edit"
                    }
                ],
                "aggregated-items": {},
                "validation-errors": []
            }
        },
        {
            "name": "workflow_gatk-HaplotypeCaller",
            "jobid": "Ygjei1p00cGa",
            "shard": "1",
            "output": [
                {
                    "file": {
                        "display_title": "GAPFIXEYX9Q1.gvcf.gz",
                        "status": "uploaded",
                        "@id": "/files-processed/GAPFIXEYX9Q1/",
                        "uuid": "1bb89ec3-12cd-46de-bbd7-7ba95db3fec6",
                        "@type": [
                            "FileProcessed",
                            "File",
                            "Item"
                        ],
                        "principals_allowed": {
                            "view": [
                                "editor_for.12a92962-8265-4fc0-b2f8-cf14f05db58b",
                                "group.admin",
                                "group.read-only-admin",
                                "remoteuser.EMBED",
                                "remoteuser.INDEXER"
                            ],
                            "edit": [
                                "editor_for.12a92962-8265-4fc0-b2f8-cf14f05db58b",
                                "group.admin"
                            ]
                        }
                    },
                    "argument_name": "gvcf"
                }
            ],
            "status": "completed",
            "workflow_run": {
                "title": "workflow_gatk-HaplotypeCaller v1.0.0 run 2022-04-29 17:10:58.741225",
                "status": "shared",
                "run_url": "https://console.aws.amazon.com/states/home?region=us-east-1#/executions/details/arn:aws:states:us-east-1:922729568532:execution:tibanna_zebra_cgap-wolf:run_workflow_gatk-HaplotypeCaller-fc3aa3fa-d645-45d9-9f1b-44efdbee638a",
                "parameters": [
                    {
                        "value": "20",
                        "ordinal": 1,
                        "dimension": "0",
                        "workflow_argument_name": "nthreads"
                    }
                ],
                "run_status": "complete",
                "input_files": [
                    {
                        "value": {
                            "href": "/files-processed/GAPFICEE9LEN/@@download/GAPFICEE9LEN.bam",
                            "file_format": {
                                "uuid": "d13d06cf-218e-4f61-aaf0-91f226248b3c",
                                "@type": [
                                    "FileFormat",
                                    "Item"
                                ],
                                "@id": "/file-formats/bam/",
                                "status": "shared",
                                "display_title": "bam",
                                "principals_allowed": {
                                    "view": [
                                        "system.Authenticated"
                                    ],
                                    "edit": [
                                        "group.admin"
                                    ]
                                }
                            },
                            "status": "uploaded",
                            "display_title": "GAPFICEE9LEN.bam",
                            "@id": "/files-processed/GAPFICEE9LEN/",
                            "uuid": "6d199319-3719-4a42-8883-365072bc13b3",
                            "@type": [
                                "FileProcessed",
                                "File",
                                "Item"
                            ],
                            "file_size": 104992897560,
                            "accession": "GAPFICEE9LEN",
                            "quality_metric": {
                                "overall_quality_status": "PASS",
                                "@type": [
                                    "QualityMetricBamqc",
                                    "QualityMetric",
                                    "Item"
                                ],
                                "status": "shared",
                                "display_title": "QualityMetricBamqc from 2022-04-29",
                                "uuid": "23408f2f-13ca-49d6-b8bf-162623795dd6",
                                "@id": "/quality-metrics-bamqc/23408f2f-13ca-49d6-b8bf-162623795dd6/",
                                "principals_allowed": {
                                    "view": [
                                        "system.Authenticated"
                                    ],
                                    "edit": [
                                        "group.admin"
                                    ]
                                }
                            },
                            "principals_allowed": {
                                "view": [
                                    "editor_for.12a92962-8265-4fc0-b2f8-cf14f05db58b",
                                    "group.admin",
                                    "group.read-only-admin",
                                    "remoteuser.EMBED",
                                    "remoteuser.INDEXER"
                                ],
                                "edit": [
                                    "editor_for.12a92962-8265-4fc0-b2f8-cf14f05db58b",
                                    "group.admin"
                                ]
                            }
                        },
                        "ordinal": 1,
                        "dimension": "0",
                        "workflow_argument_name": "input_bam"
                    },
                    {
                        "value": {
                            "href": "/files-reference/GAPFIXRDPDK5/@@download/GAPFIXRDPDK5.fa",
                            "file_format": {
                                "uuid": "5ced774b-a73e-4d1b-8186-d7fbbde7a3c2",
                                "@type": [
                                    "FileFormat",
                                    "Item"
                                ],
                                "@id": "/file-formats/fa/",
                                "status": "shared",
                                "display_title": "fa",
                                "principals_allowed": {
                                    "view": [
                                        "system.Authenticated"
                                    ],
                                    "edit": [
                                        "group.admin"
                                    ]
                                }
                            },
                            "status": "uploaded",
                            "display_title": "GAPFIXRDPDK5.fa",
                            "@id": "/files-reference/GAPFIXRDPDK5/",
                            "uuid": "1936f246-22e1-45dc-bb5c-9cfd55537fe7",
                            "@type": [
                                "FileReference",
                                "File",
                                "Item"
                            ],
                            "file_size": 3263683042,
                            "accession": "GAPFIXRDPDK5",
                            "principals_allowed": {
                                "view": [
                                    "editor_for.12a92962-8265-4fc0-b2f8-cf14f05db58b",
                                    "group.admin",
                                    "group.read-only-admin",
                                    "remoteuser.EMBED",
                                    "remoteuser.INDEXER"
                                ],
                                "edit": [
                                    "editor_for.12a92962-8265-4fc0-b2f8-cf14f05db58b",
                                    "group.admin"
                                ]
                            }
                        },
                        "ordinal": 1,
                        "dimension": "0",
                        "workflow_argument_name": "reference"
                    },
                    {
                        "value": {
                            "href": "/files-reference/GAPFIBGEOI72/@@download/GAPFIBGEOI72.txt",
                            "file_format": {
                                "uuid": "0cd4e777-a596-4927-95c8-b07716121aa3",
                                "@type": [
                                    "FileFormat",
                                    "Item"
                                ],
                                "@id": "/file-formats/txt/",
                                "status": "shared",
                                "display_title": "txt",
                                "principals_allowed": {
                                    "view": [
                                        "system.Authenticated"
                                    ],
                                    "edit": [
                                        "group.admin"
                                    ]
                                }
                            },
                            "status": "uploaded",
                            "display_title": "GAPFIBGEOI72.txt",
                            "@id": "/files-reference/GAPFIBGEOI72/",
                            "uuid": "1c07a3aa-e2a3-498c-b838-15991c4a2f28",
                            "@type": [
                                "FileReference",
                                "File",
                                "Item"
                            ],
                            "file_size": 7603,
                            "accession": "GAPFIBGEOI72",
                            "principals_allowed": {
                                "view": [
                                    "editor_for.12a92962-8265-4fc0-b2f8-cf14f05db58b",
                                    "group.admin",
                                    "group.read-only-admin",
                                    "remoteuser.EMBED",
                                    "remoteuser.INDEXER"
                                ],
                                "edit": [
                                    "editor_for.12a92962-8265-4fc0-b2f8-cf14f05db58b",
                                    "group.admin"
                                ]
                            }
                        },
                        "ordinal": 1,
                        "dimension": "0",
                        "workflow_argument_name": "regions"
                    }
                ],
                "institution": {
                    "uuid": "828cd4fe-ebb0-4b36-a94a-d2e3a36cc989",
                    "@type": [
                        "Institution",
                        "Item"
                    ],
                    "status": "current",
                    "@id": "/institutions/hms-dbmi/",
                    "display_title": "HMS DBMI",
                    "principals_allowed": {
                        "view": [
                            "group.admin",
                            "group.read-only-admin",
                            "remoteuser.EMBED",
                            "remoteuser.INDEXER"
                        ],
                        "edit": [
                            "group.admin"
                        ]
                    }
                },
                "awsem_job_id": "Ygjei1p00cGa",
                "date_created": "2022-04-29T17:10:58.828045+00:00",
                "output_files": [
                    {
                        "type": "Output processed file",
                        "value": {
                            "uuid": "1bb89ec3-12cd-46de-bbd7-7ba95db3fec6",
                            "href": "/files-processed/GAPFIXEYX9Q1/@@download/GAPFIXEYX9Q1.gvcf.gz",
                            "file_size": 2200279777,
                            "@type": [
                                "FileProcessed",
                                "File",
                                "Item"
                            ],
                            "status": "uploaded",
                            "accession": "GAPFIXEYX9Q1",
                            "display_title": "GAPFIXEYX9Q1.gvcf.gz",
                            "file_format": {
                                "display_title": "gvcf_gz",
                                "status": "shared",
                                "uuid": "ad47d469-4561-4234-bce2-820f08f58e7c",
                                "@id": "/file-formats/gvcf_gz/",
                                "@type": [
                                    "FileFormat",
                                    "Item"
                                ],
                                "principals_allowed": {
                                    "view": [
                                        "system.Authenticated"
                                    ],
                                    "edit": [
                                        "group.admin"
                                    ]
                                }
                            },
                            "@id": "/files-processed/GAPFIXEYX9Q1/",
                            "principals_allowed": {
                                "view": [
                                    "editor_for.12a92962-8265-4fc0-b2f8-cf14f05db58b",
                                    "group.admin",
                                    "group.read-only-admin",
                                    "remoteuser.EMBED",
                                    "remoteuser.INDEXER"
                                ],
                                "edit": [
                                    "editor_for.12a92962-8265-4fc0-b2f8-cf14f05db58b",
                                    "group.admin"
                                ]
                            }
                        },
                        "format": "/file-formats/gvcf_gz/",
                        "upload_key": "1bb89ec3-12cd-46de-bbd7-7ba95db3fec6/GAPFIXEYX9Q1.gvcf.gz",
                        "extra_files": [
                            {
                                "href": "/1bb89ec3-12cd-46de-bbd7-7ba95db3fec6/@@download/GAPFIXEYX9Q1.gvcf.gz.tbi",
                                "uuid": "1bb89ec3-12cd-46de-bbd7-7ba95db3fec6",
                                "status": "uploading",
                                "filename": "GAPFIXEYX9Q1",
                                "accession": "GAPFIXEYX9Q1",
                                "upload_key": "1bb89ec3-12cd-46de-bbd7-7ba95db3fec6/GAPFIXEYX9Q1.gvcf.gz.tbi",
                                "file_format": "/file-formats/gvcf_gz_tbi/"
                            }
                        ],
                        "secondary_file_formats": [
                            "/file-formats/gvcf_gz_tbi/"
                        ],
                        "workflow_argument_name": "gvcf"
                    }
                ],
                "run_platform": "AWSEM",
                "submitted_by": {
                    "display_title": "Tibanna App",
                    "uuid": "b041dba8-e2b2-4e54-a621-97edb508a0c4",
                    "status": "current",
                    "@type": [
                        "User",
                        "Item"
                    ],
                    "@id": "/users/b041dba8-e2b2-4e54-a621-97edb508a0c4/",
                    "principals_allowed": {
                        "view": [
                            "group.admin",
                            "remoteuser.EMBED",
                            "remoteuser.INDEXER",
                            "userid.b041dba8-e2b2-4e54-a621-97edb508a0c4"
                        ],
                        "edit": [
                            "group.admin"
                        ]
                    }
                },
                "last_modified": {
                    "modified_by": {
                        "status": "current",
                        "@type": [
                            "User",
                            "Item"
                        ],
                        "uuid": "7677f8a8-79d2-4cff-ab0a-a967a2a68e39",
                        "@id": "/users/7677f8a8-79d2-4cff-ab0a-a967a2a68e39/",
                        "display_title": "Foursight App",
                        "principals_allowed": {
                            "view": [
                                "group.admin",
                                "remoteuser.EMBED",
                                "remoteuser.INDEXER",
                                "userid.7677f8a8-79d2-4cff-ab0a-a967a2a68e39"
                            ],
                            "edit": [
                                "group.admin"
                            ]
                        }
                    },
                    "date_modified": "2022-04-30T10:00:31.800037+00:00"
                },
                "metadata_only": false,
                "awsem_app_name": "workflow_gatk-HaplotypeCaller",
                "quality_metric": {
                    "status": "shared",
                    "uuid": "b3c1411b-8242-434d-a22a-6cd7da20a56d",
                    "@type": [
                        "QualityMetricWorkflowrun",
                        "QualityMetric",
                        "Item"
                    ],
                    "@id": "/quality-metrics-workflowrun/b3c1411b-8242-434d-a22a-6cd7da20a56d/",
                    "display_title": "QualityMetricWorkflowrun from 2022-04-29",
                    "principals_allowed": {
                        "view": [
                            "system.Authenticated"
                        ],
                        "edit": [
                            "group.admin"
                        ]
                    }
                },
                "schema_version": "3",
                "awsem_postrun_json": "https://s3.amazonaws.com/cgap-biotest-main-application-tibanna-output/Ygjei1p00cGa.postrun.json",
                "associated_meta_workflow_runs": [
                    "a77b8431-2936-4f87-8405-8aa43ee777c1"
                ],
                "@id": "/workflow-runs-awsem/a59335b9-d462-4578-b718-0fc54428cc77/",
                "@type": [
                    "WorkflowRunAwsem",
                    "WorkflowRun",
                    "Item"
                ],
                "uuid": "a59335b9-d462-4578-b718-0fc54428cc77",
                "principals_allowed": {
                    "view": [
                        "system.Authenticated"
                    ],
                    "edit": [
                        "group.admin"
                    ]
                },
                "display_title": "workflow_gatk-HaplotypeCaller v1.0.0 run 2022-04-29 17:10:58.741225",
                "@context": "/terms/",
                "actions": [
                    {
                        "name": "create",
                        "title": "Create",
                        "profile": "/profiles/WorkflowRunAwsem.json",
                        "href": "/workflow-runs-awsem/a59335b9-d462-4578-b718-0fc54428cc77/?currentAction=create"
                    },
                    {
                        "name": "edit",
                        "title": "Edit",
                        "profile": "/profiles/WorkflowRunAwsem.json",
                        "href": "/workflow-runs-awsem/a59335b9-d462-4578-b718-0fc54428cc77/?currentAction=edit"
                    }
                ],
                "aggregated-items": {},
                "validation-errors": []
            }
        },
        {
            "name": "workflow_gatk-HaplotypeCaller",
            "jobid": "yqu8bgzcBm7A",
            "shard": "2",
            "output": [
                {
                    "file": {
                        "display_title": "GAPFINHTTKUZ.gvcf.gz",
                        "status": "uploaded",
                        "@id": "/files-processed/GAPFINHTTKUZ/",
                        "uuid": "ed25677e-f2d6-4429-b9d2-300a36cff6ed",
                        "@type": [
                            "FileProcessed",
                            "File",
                            "Item"
                        ],
                        "principals_allowed": {
                            "view": [
                                "editor_for.12a92962-8265-4fc0-b2f8-cf14f05db58b",
                                "group.admin",
                                "group.read-only-admin",
                                "remoteuser.EMBED",
                                "remoteuser.INDEXER"
                            ],
                            "edit": [
                                "editor_for.12a92962-8265-4fc0-b2f8-cf14f05db58b",
                                "group.admin"
                            ]
                        }
                    },
                    "argument_name": "gvcf"
                }
            ],
            "status": "completed",
            "workflow_run": {
                "title": "workflow_gatk-HaplotypeCaller v1.0.0 run 2022-04-29 17:11:05.391428",
                "status": "shared",
                "project": {
                    "status": "shared",
                    "@type": [
                        "Project",
                        "Item"
                    ],
                    "display_title": "CGAP Core",
                    "uuid": "12a92962-8265-4fc0-b2f8-cf14f05db58b",
                    "@id": "/projects/cgap-core/",
                    "principals_allowed": {
                        "view": [
                            "system.Authenticated"
                        ],
                        "edit": [
                            "group.admin"
                        ]
                    }
                },
                "run_url": "https://console.aws.amazon.com/states/home?region=us-east-1#/executions/details/arn:aws:states:us-east-1:922729568532:execution:tibanna_zebra_cgap-wolf:run_workflow_gatk-HaplotypeCaller-ed4f266b-e2dd-4370-a680-2537c9e8f1c9",
                "parameters": [
                    {
                        "value": "20",
                        "ordinal": 1,
                        "dimension": "0",
                        "workflow_argument_name": "nthreads"
                    }
                ],
                "run_status": "complete",
                "input_files": [
                    {
                        "value": {
                            "accession": "GAPFITNHTOZI",
                            "display_title": "GAPFITNHTOZI.bam",
                            "href": "/files-processed/GAPFITNHTOZI/@@download/GAPFITNHTOZI.bam",
                            "file_size": 111610806810,
                            "uuid": "222ce0eb-22f8-40e3-87d5-f2708ad18393",
                            "@id": "/files-processed/GAPFITNHTOZI/",
                            "@type": [
                                "FileProcessed",
                                "File",
                                "Item"
                            ],
                            "file_format": {
                                "@id": "/file-formats/bam/",
                                "uuid": "d13d06cf-218e-4f61-aaf0-91f226248b3c",
                                "status": "shared",
                                "@type": [
                                    "FileFormat",
                                    "Item"
                                ],
                                "display_title": "bam",
                                "principals_allowed": {
                                    "view": [
                                        "system.Authenticated"
                                    ],
                                    "edit": [
                                        "group.admin"
                                    ]
                                }
                            },
                            "status": "uploaded",
                            "quality_metric": {
                                "status": "shared",
                                "@id": "/quality-metrics-bamqc/5530ced5-5252-42f2-afde-0d14e30a669b/",
                                "overall_quality_status": "PASS",
                                "uuid": "5530ced5-5252-42f2-afde-0d14e30a669b",
                                "@type": [
                                    "QualityMetricBamqc",
                                    "QualityMetric",
                                    "Item"
                                ],
                                "display_title": "QualityMetricBamqc from 2022-04-29",
                                "principals_allowed": {
                                    "view": [
                                        "system.Authenticated"
                                    ],
                                    "edit": [
                                        "group.admin"
                                    ]
                                }
                            },
                            "principals_allowed": {
                                "view": [
                                    "editor_for.12a92962-8265-4fc0-b2f8-cf14f05db58b",
                                    "group.admin",
                                    "group.read-only-admin",
                                    "remoteuser.EMBED",
                                    "remoteuser.INDEXER"
                                ],
                                "edit": [
                                    "editor_for.12a92962-8265-4fc0-b2f8-cf14f05db58b",
                                    "group.admin"
                                ]
                            }
                        },
                        "ordinal": 1,
                        "dimension": "0",
                        "workflow_argument_name": "input_bam"
                    },
                    {
                        "value": {
                            "accession": "GAPFIXRDPDK5",
                            "display_title": "GAPFIXRDPDK5.fa",
                            "href": "/files-reference/GAPFIXRDPDK5/@@download/GAPFIXRDPDK5.fa",
                            "file_size": 3263683042,
                            "uuid": "1936f246-22e1-45dc-bb5c-9cfd55537fe7",
                            "@id": "/files-reference/GAPFIXRDPDK5/",
                            "@type": [
                                "FileReference",
                                "File",
                                "Item"
                            ],
                            "file_format": {
                                "@id": "/file-formats/fa/",
                                "uuid": "5ced774b-a73e-4d1b-8186-d7fbbde7a3c2",
                                "status": "shared",
                                "@type": [
                                    "FileFormat",
                                    "Item"
                                ],
                                "display_title": "fa",
                                "principals_allowed": {
                                    "view": [
                                        "system.Authenticated"
                                    ],
                                    "edit": [
                                        "group.admin"
                                    ]
                                }
                            },
                            "status": "uploaded",
                            "principals_allowed": {
                                "view": [
                                    "editor_for.12a92962-8265-4fc0-b2f8-cf14f05db58b",
                                    "group.admin",
                                    "group.read-only-admin",
                                    "remoteuser.EMBED",
                                    "remoteuser.INDEXER"
                                ],
                                "edit": [
                                    "editor_for.12a92962-8265-4fc0-b2f8-cf14f05db58b",
                                    "group.admin"
                                ]
                            }
                        },
                        "ordinal": 1,
                        "dimension": "0",
                        "workflow_argument_name": "reference"
                    },
                    {
                        "value": {
                            "accession": "GAPFIBGEOI72",
                            "display_title": "GAPFIBGEOI72.txt",
                            "href": "/files-reference/GAPFIBGEOI72/@@download/GAPFIBGEOI72.txt",
                            "file_size": 7603,
                            "uuid": "1c07a3aa-e2a3-498c-b838-15991c4a2f28",
                            "@id": "/files-reference/GAPFIBGEOI72/",
                            "@type": [
                                "FileReference",
                                "File",
                                "Item"
                            ],
                            "file_format": {
                                "@id": "/file-formats/txt/",
                                "uuid": "0cd4e777-a596-4927-95c8-b07716121aa3",
                                "status": "shared",
                                "@type": [
                                    "FileFormat",
                                    "Item"
                                ],
                                "display_title": "txt",
                                "principals_allowed": {
                                    "view": [
                                        "system.Authenticated"
                                    ],
                                    "edit": [
                                        "group.admin"
                                    ]
                                }
                            },
                            "status": "uploaded",
                            "principals_allowed": {
                                "view": [
                                    "editor_for.12a92962-8265-4fc0-b2f8-cf14f05db58b",
                                    "group.admin",
                                    "group.read-only-admin",
                                    "remoteuser.EMBED",
                                    "remoteuser.INDEXER"
                                ],
                                "edit": [
                                    "editor_for.12a92962-8265-4fc0-b2f8-cf14f05db58b",
                                    "group.admin"
                                ]
                            }
                        },
                        "ordinal": 1,
                        "dimension": "0",
                        "workflow_argument_name": "regions"
                    }
                ],
                "institution": {
                    "uuid": "828cd4fe-ebb0-4b36-a94a-d2e3a36cc989",
                    "@type": [
                        "Institution",
                        "Item"
                    ],
                    "@id": "/institutions/hms-dbmi/",
                    "display_title": "HMS DBMI",
                    "status": "current",
                    "principals_allowed": {
                        "view": [
                            "group.admin",
                            "group.read-only-admin",
                            "remoteuser.EMBED",
                            "remoteuser.INDEXER"
                        ],
                        "edit": [
                            "group.admin"
                        ]
                    }
                },
                "awsem_job_id": "yqu8bgzcBm7A",
                "date_created": "2022-04-29T17:11:05.505335+00:00",
                "output_files": [
                    {
                        "type": "Output processed file",
                        "value": {
                            "@type": [
                                "FileProcessed",
                                "File",
                                "Item"
                            ],
                            "display_title": "GAPFINHTTKUZ.gvcf.gz",
                            "@id": "/files-processed/GAPFINHTTKUZ/",
                            "status": "uploaded",
                            "file_size": 2250854837,
                            "accession": "GAPFINHTTKUZ",
                            "href": "/files-processed/GAPFINHTTKUZ/@@download/GAPFINHTTKUZ.gvcf.gz",
                            "uuid": "ed25677e-f2d6-4429-b9d2-300a36cff6ed",
                            "file_format": {
                                "status": "shared",
                                "@type": [
                                    "FileFormat",
                                    "Item"
                                ],
                                "@id": "/file-formats/gvcf_gz/",
                                "uuid": "ad47d469-4561-4234-bce2-820f08f58e7c",
                                "display_title": "gvcf_gz",
                                "principals_allowed": {
                                    "view": [
                                        "system.Authenticated"
                                    ],
                                    "edit": [
                                        "group.admin"
                                    ]
                                }
                            },
                            "principals_allowed": {
                                "view": [
                                    "editor_for.12a92962-8265-4fc0-b2f8-cf14f05db58b",
                                    "group.admin",
                                    "group.read-only-admin",
                                    "remoteuser.EMBED",
                                    "remoteuser.INDEXER"
                                ],
                                "edit": [
                                    "editor_for.12a92962-8265-4fc0-b2f8-cf14f05db58b",
                                    "group.admin"
                                ]
                            }
                        },
                        "format": "/file-formats/gvcf_gz/",
                        "upload_key": "ed25677e-f2d6-4429-b9d2-300a36cff6ed/GAPFINHTTKUZ.gvcf.gz",
                        "extra_files": [
                            {
                                "href": "/ed25677e-f2d6-4429-b9d2-300a36cff6ed/@@download/GAPFINHTTKUZ.gvcf.gz.tbi",
                                "uuid": "ed25677e-f2d6-4429-b9d2-300a36cff6ed",
                                "status": "uploading",
                                "filename": "GAPFINHTTKUZ",
                                "accession": "GAPFINHTTKUZ",
                                "upload_key": "ed25677e-f2d6-4429-b9d2-300a36cff6ed/GAPFINHTTKUZ.gvcf.gz.tbi",
                                "file_format": "/file-formats/gvcf_gz_tbi/"
                            }
                        ],
                        "secondary_file_formats": [
                            "/file-formats/gvcf_gz_tbi/"
                        ],
                        "workflow_argument_name": "gvcf"
                    }
                ],
                "run_platform": "AWSEM",
                "submitted_by": {
                    "@type": [
                        "User",
                        "Item"
                    ],
                    "status": "current",
                    "@id": "/users/b041dba8-e2b2-4e54-a621-97edb508a0c4/",
                    "display_title": "Tibanna App",
                    "uuid": "b041dba8-e2b2-4e54-a621-97edb508a0c4",
                    "principals_allowed": {
                        "view": [
                            "group.admin",
                            "remoteuser.EMBED",
                            "remoteuser.INDEXER",
                            "userid.b041dba8-e2b2-4e54-a621-97edb508a0c4"
                        ],
                        "edit": [
                            "group.admin"
                        ]
                    }
                },
                "last_modified": {
                    "modified_by": {
                        "@id": "/users/7677f8a8-79d2-4cff-ab0a-a967a2a68e39/",
                        "uuid": "7677f8a8-79d2-4cff-ab0a-a967a2a68e39",
                        "display_title": "Foursight App",
                        "@type": [
                            "User",
                            "Item"
                        ],
                        "status": "current",
                        "principals_allowed": {
                            "view": [
                                "group.admin",
                                "remoteuser.EMBED",
                                "remoteuser.INDEXER",
                                "userid.7677f8a8-79d2-4cff-ab0a-a967a2a68e39"
                            ],
                            "edit": [
                                "group.admin"
                            ]
                        }
                    },
                    "date_modified": "2022-04-30T10:00:31.698148+00:00"
                },
                "metadata_only": false,
                "awsem_app_name": "workflow_gatk-HaplotypeCaller",
                "quality_metric": {
                    "status": "shared",
                    "uuid": "2d9ee9f2-0d14-4441-86af-6189dbf8f03f",
                    "display_title": "QualityMetricWorkflowrun from 2022-04-29",
                    "@type": [
                        "QualityMetricWorkflowrun",
                        "QualityMetric",
                        "Item"
                    ],
                    "@id": "/quality-metrics-workflowrun/2d9ee9f2-0d14-4441-86af-6189dbf8f03f/",
                    "principals_allowed": {
                        "view": [
                            "system.Authenticated"
                        ],
                        "edit": [
                            "group.admin"
                        ]
                    }
                },
                "schema_version": "3",
                "awsem_postrun_json": "https://s3.amazonaws.com/cgap-biotest-main-application-tibanna-output/yqu8bgzcBm7A.postrun.json",
                "associated_meta_workflow_runs": [
                    "a77b8431-2936-4f87-8405-8aa43ee777c1"
                ],
                "@id": "/workflow-runs-awsem/3f8e7c4e-254b-4981-81c8-d54821b0676c/",
                "@type": [
                    "WorkflowRunAwsem",
                    "WorkflowRun",
                    "Item"
                ],
                "uuid": "3f8e7c4e-254b-4981-81c8-d54821b0676c",
                "principals_allowed": {
                    "view": [
                        "system.Authenticated"
                    ],
                    "edit": [
                        "group.admin"
                    ]
                },
                "display_title": "workflow_gatk-HaplotypeCaller v1.0.0 run 2022-04-29 17:11:05.391428",
                "@context": "/terms/",
                "actions": [
                    {
                        "name": "create",
                        "title": "Create",
                        "profile": "/profiles/WorkflowRunAwsem.json",
                        "href": "/workflow-runs-awsem/3f8e7c4e-254b-4981-81c8-d54821b0676c/?currentAction=create"
                    },
                    {
                        "name": "edit",
                        "title": "Edit",
                        "profile": "/profiles/WorkflowRunAwsem.json",
                        "href": "/workflow-runs-awsem/3f8e7c4e-254b-4981-81c8-d54821b0676c/?currentAction=edit"
                    }
                ],
                "aggregated-items": {},
                "validation-errors": []
            }
        },
        {
            "name": "workflow_granite-rckTar",
            "jobid": "a8o1XfOgCguR",
            "shard": "0",
            "output": [
                {
                    "file": {
                        "display_title": "GAPFI7TBYWC7.rck.tar",
                        "status": "uploaded",
                        "@id": "/files-processed/GAPFI7TBYWC7/",
                        "uuid": "3e8a17d1-e07f-4226-bd6a-a4ca13606528",
                        "@type": [
                            "FileProcessed",
                            "File",
                            "Item"
                        ],
                        "principals_allowed": {
                            "view": [
                                "editor_for.12a92962-8265-4fc0-b2f8-cf14f05db58b",
                                "group.admin",
                                "group.read-only-admin",
                                "remoteuser.EMBED",
                                "remoteuser.INDEXER"
                            ],
                            "edit": [
                                "editor_for.12a92962-8265-4fc0-b2f8-cf14f05db58b",
                                "group.admin"
                            ]
                        }
                    },
                    "argument_name": "rck_tar"
                }
            ],
            "status": "completed",
            "dependencies": [
                "workflow_granite-mpileupCounts:0",
                "workflow_granite-mpileupCounts:1",
                "workflow_granite-mpileupCounts:2"
            ],
            "workflow_run": {
                "title": "workflow_granite-rckTar v1.0.0 run 2022-04-29 21:10:35.118284",
                "status": "shared",
                "project": {
                    "status": "shared",
                    "@type": [
                        "Project",
                        "Item"
                    ],
                    "display_title": "CGAP Core",
                    "uuid": "12a92962-8265-4fc0-b2f8-cf14f05db58b",
                    "@id": "/projects/cgap-core/",
                    "principals_allowed": {
                        "view": [
                            "system.Authenticated"
                        ],
                        "edit": [
                            "group.admin"
                        ]
                    }
                },
                "run_url": "https://console.aws.amazon.com/states/home?region=us-east-1#/executions/details/arn:aws:states:us-east-1:922729568532:execution:tibanna_zebra_cgap-wolf:run_workflow_granite-rckTar-3f007516-1aec-476b-b8cd-c8dcd0ff6723",
                "parameters": [],
                "run_status": "complete",
                "input_files": [
                    {
                        "value": {
                            "accession": "GAPFI9CNINA2",
                            "display_title": "GAPFI9CNINA2.rck.gz",
                            "href": "/files-processed/GAPFI9CNINA2/@@download/GAPFI9CNINA2.rck.gz",
                            "file_size": 11922164723,
                            "uuid": "90d5572a-3cb5-40bd-8cec-68346c28705b",
                            "@id": "/files-processed/GAPFI9CNINA2/",
                            "@type": [
                                "FileProcessed",
                                "File",
                                "Item"
                            ],
                            "file_format": {
                                "@id": "/file-formats/rck_gz/",
                                "uuid": "20d4d3aa-5f1c-4b75-9e25-73f9f370fefa",
                                "status": "shared",
                                "@type": [
                                    "FileFormat",
                                    "Item"
                                ],
                                "display_title": "rck_gz",
                                "principals_allowed": {
                                    "view": [
                                        "system.Authenticated"
                                    ],
                                    "edit": [
                                        "group.admin"
                                    ]
                                }
                            },
                            "status": "uploaded",
                            "principals_allowed": {
                                "view": [
                                    "editor_for.12a92962-8265-4fc0-b2f8-cf14f05db58b",
                                    "group.admin",
                                    "group.read-only-admin",
                                    "remoteuser.EMBED",
                                    "remoteuser.INDEXER"
                                ],
                                "edit": [
                                    "editor_for.12a92962-8265-4fc0-b2f8-cf14f05db58b",
                                    "group.admin"
                                ]
                            }
                        },
                        "ordinal": 1,
                        "dimension": "0",
                        "workflow_argument_name": "input_rcks"
                    },
                    {
                        "value": {
                            "accession": "GAPFID5AE9ME",
                            "display_title": "GAPFID5AE9ME.rck.gz",
                            "href": "/files-processed/GAPFID5AE9ME/@@download/GAPFID5AE9ME.rck.gz",
                            "file_size": 11874191792,
                            "uuid": "76111407-5e86-48dd-bd13-f3a167638140",
                            "@id": "/files-processed/GAPFID5AE9ME/",
                            "@type": [
                                "FileProcessed",
                                "File",
                                "Item"
                            ],
                            "file_format": {
                                "@id": "/file-formats/rck_gz/",
                                "uuid": "20d4d3aa-5f1c-4b75-9e25-73f9f370fefa",
                                "status": "shared",
                                "@type": [
                                    "FileFormat",
                                    "Item"
                                ],
                                "display_title": "rck_gz",
                                "principals_allowed": {
                                    "view": [
                                        "system.Authenticated"
                                    ],
                                    "edit": [
                                        "group.admin"
                                    ]
                                }
                            },
                            "status": "uploaded",
                            "principals_allowed": {
                                "view": [
                                    "editor_for.12a92962-8265-4fc0-b2f8-cf14f05db58b",
                                    "group.admin",
                                    "group.read-only-admin",
                                    "remoteuser.EMBED",
                                    "remoteuser.INDEXER"
                                ],
                                "edit": [
                                    "editor_for.12a92962-8265-4fc0-b2f8-cf14f05db58b",
                                    "group.admin"
                                ]
                            }
                        },
                        "ordinal": 2,
                        "dimension": "1",
                        "workflow_argument_name": "input_rcks"
                    },
                    {
                        "value": {
                            "accession": "GAPFI5T4QIBP",
                            "display_title": "GAPFI5T4QIBP.rck.gz",
                            "href": "/files-processed/GAPFI5T4QIBP/@@download/GAPFI5T4QIBP.rck.gz",
                            "file_size": 12086253767,
                            "uuid": "87e8832d-9ece-439a-8602-152b1ee74b0f",
                            "@id": "/files-processed/GAPFI5T4QIBP/",
                            "@type": [
                                "FileProcessed",
                                "File",
                                "Item"
                            ],
                            "file_format": {
                                "@id": "/file-formats/rck_gz/",
                                "uuid": "20d4d3aa-5f1c-4b75-9e25-73f9f370fefa",
                                "status": "shared",
                                "@type": [
                                    "FileFormat",
                                    "Item"
                                ],
                                "display_title": "rck_gz",
                                "principals_allowed": {
                                    "view": [
                                        "system.Authenticated"
                                    ],
                                    "edit": [
                                        "group.admin"
                                    ]
                                }
                            },
                            "status": "uploaded",
                            "principals_allowed": {
                                "view": [
                                    "editor_for.12a92962-8265-4fc0-b2f8-cf14f05db58b",
                                    "group.admin",
                                    "group.read-only-admin",
                                    "remoteuser.EMBED",
                                    "remoteuser.INDEXER"
                                ],
                                "edit": [
                                    "editor_for.12a92962-8265-4fc0-b2f8-cf14f05db58b",
                                    "group.admin"
                                ]
                            }
                        },
                        "ordinal": 3,
                        "dimension": "2",
                        "workflow_argument_name": "input_rcks"
                    }
                ],
                "institution": {
                    "uuid": "828cd4fe-ebb0-4b36-a94a-d2e3a36cc989",
                    "@type": [
                        "Institution",
                        "Item"
                    ],
                    "@id": "/institutions/hms-dbmi/",
                    "display_title": "HMS DBMI",
                    "status": "current",
                    "principals_allowed": {
                        "view": [
                            "group.admin",
                            "group.read-only-admin",
                            "remoteuser.EMBED",
                            "remoteuser.INDEXER"
                        ],
                        "edit": [
                            "group.admin"
                        ]
                    }
                },
                "awsem_job_id": "a8o1XfOgCguR",
                "date_created": "2022-04-29T21:10:35.210502+00:00",
                "output_files": [
                    {
                        "type": "Output processed file",
                        "value": {
                            "@type": [
                                "FileProcessed",
                                "File",
                                "Item"
                            ],
                            "display_title": "GAPFI7TBYWC7.rck.tar",
                            "@id": "/files-processed/GAPFI7TBYWC7/",
                            "status": "uploaded",
                            "file_size": 35891374080,
                            "accession": "GAPFI7TBYWC7",
                            "href": "/files-processed/GAPFI7TBYWC7/@@download/GAPFI7TBYWC7.rck.tar",
                            "uuid": "3e8a17d1-e07f-4226-bd6a-a4ca13606528",
                            "file_format": {
                                "status": "shared",
                                "@type": [
                                    "FileFormat",
                                    "Item"
                                ],
                                "@id": "/file-formats/rck_tar/",
                                "uuid": "39f836d8-bbb1-46c7-80d4-e321d4a44204",
                                "display_title": "rck_tar",
                                "principals_allowed": {
                                    "view": [
                                        "system.Authenticated"
                                    ],
                                    "edit": [
                                        "group.admin"
                                    ]
                                }
                            },
                            "principals_allowed": {
                                "view": [
                                    "editor_for.12a92962-8265-4fc0-b2f8-cf14f05db58b",
                                    "group.admin",
                                    "group.read-only-admin",
                                    "remoteuser.EMBED",
                                    "remoteuser.INDEXER"
                                ],
                                "edit": [
                                    "editor_for.12a92962-8265-4fc0-b2f8-cf14f05db58b",
                                    "group.admin"
                                ]
                            }
                        },
                        "format": "/file-formats/rck_tar/",
                        "upload_key": "3e8a17d1-e07f-4226-bd6a-a4ca13606528/GAPFI7TBYWC7.rck.tar",
                        "extra_files": [
                            {
                                "href": "/3e8a17d1-e07f-4226-bd6a-a4ca13606528/@@download/GAPFI7TBYWC7.rck.tar.index",
                                "uuid": "3e8a17d1-e07f-4226-bd6a-a4ca13606528",
                                "status": "uploading",
                                "filename": "GAPFI7TBYWC7",
                                "accession": "GAPFI7TBYWC7",
                                "upload_key": "3e8a17d1-e07f-4226-bd6a-a4ca13606528/GAPFI7TBYWC7.rck.tar.index",
                                "file_format": "/file-formats/rck_tar_index/"
                            }
                        ],
                        "secondary_file_formats": [
                            "/file-formats/rck_tar_index/"
                        ],
                        "workflow_argument_name": "rck_tar"
                    }
                ],
                "run_platform": "AWSEM",
                "submitted_by": {
                    "@type": [
                        "User",
                        "Item"
                    ],
                    "status": "current",
                    "@id": "/users/b041dba8-e2b2-4e54-a621-97edb508a0c4/",
                    "display_title": "Tibanna App",
                    "uuid": "b041dba8-e2b2-4e54-a621-97edb508a0c4",
                    "principals_allowed": {
                        "view": [
                            "group.admin",
                            "remoteuser.EMBED",
                            "remoteuser.INDEXER",
                            "userid.b041dba8-e2b2-4e54-a621-97edb508a0c4"
                        ],
                        "edit": [
                            "group.admin"
                        ]
                    }
                },
                "last_modified": {
                    "modified_by": {
                        "@id": "/users/7677f8a8-79d2-4cff-ab0a-a967a2a68e39/",
                        "uuid": "7677f8a8-79d2-4cff-ab0a-a967a2a68e39",
                        "display_title": "Foursight App",
                        "@type": [
                            "User",
                            "Item"
                        ],
                        "status": "current",
                        "principals_allowed": {
                            "view": [
                                "group.admin",
                                "remoteuser.EMBED",
                                "remoteuser.INDEXER",
                                "userid.7677f8a8-79d2-4cff-ab0a-a967a2a68e39"
                            ],
                            "edit": [
                                "group.admin"
                            ]
                        }
                    },
                    "date_modified": "2022-04-30T10:00:30.647426+00:00"
                },
                "metadata_only": false,
                "awsem_app_name": "workflow_granite-rckTar",
                "quality_metric": {
                    "status": "shared",
                    "uuid": "b2071ab0-ba44-4133-be3a-33c0d5df6bf2",
                    "display_title": "QualityMetricWorkflowrun from 2022-04-29",
                    "@type": [
                        "QualityMetricWorkflowrun",
                        "QualityMetric",
                        "Item"
                    ],
                    "@id": "/quality-metrics-workflowrun/b2071ab0-ba44-4133-be3a-33c0d5df6bf2/",
                    "principals_allowed": {
                        "view": [
                            "system.Authenticated"
                        ],
                        "edit": [
                            "group.admin"
                        ]
                    }
                },
                "schema_version": "3",
                "awsem_postrun_json": "https://s3.amazonaws.com/cgap-biotest-main-application-tibanna-output/a8o1XfOgCguR.postrun.json",
                "associated_meta_workflow_runs": [
                    "a77b8431-2936-4f87-8405-8aa43ee777c1"
                ],
                "@id": "/workflow-runs-awsem/6fb5a7f0-2156-49e3-bf42-95f4e8decdde/",
                "@type": [
                    "WorkflowRunAwsem",
                    "WorkflowRun",
                    "Item"
                ],
                "uuid": "6fb5a7f0-2156-49e3-bf42-95f4e8decdde",
                "principals_allowed": {
                    "view": [
                        "system.Authenticated"
                    ],
                    "edit": [
                        "group.admin"
                    ]
                },
                "display_title": "workflow_granite-rckTar v1.0.0 run 2022-04-29 21:10:35.118284",
                "@context": "/terms/",
                "actions": [
                    {
                        "name": "create",
                        "title": "Create",
                        "profile": "/profiles/WorkflowRunAwsem.json",
                        "href": "/workflow-runs-awsem/6fb5a7f0-2156-49e3-bf42-95f4e8decdde/?currentAction=create"
                    },
                    {
                        "name": "edit",
                        "title": "Edit",
                        "profile": "/profiles/WorkflowRunAwsem.json",
                        "href": "/workflow-runs-awsem/6fb5a7f0-2156-49e3-bf42-95f4e8decdde/?currentAction=edit"
                    }
                ],
                "aggregated-items": {},
                "validation-errors": []
            }
        },
        {
            "name": "workflow_gatk-CombineGVCFs",
            "jobid": "vWf0ouS1uBzP",
            "shard": "0",
            "output": [
                {
                    "file": {
                        "display_title": "GAPFI4589EXS.gvcf.gz",
                        "status": "uploaded",
                        "@id": "/files-processed/GAPFI4589EXS/",
                        "uuid": "2021801b-9f49-4fc9-9e86-9b8046edd5e9",
                        "@type": [
                            "FileProcessed",
                            "File",
                            "Item"
                        ],
                        "principals_allowed": {
                            "view": [
                                "editor_for.12a92962-8265-4fc0-b2f8-cf14f05db58b",
                                "group.admin",
                                "group.read-only-admin",
                                "remoteuser.EMBED",
                                "remoteuser.INDEXER"
                            ],
                            "edit": [
                                "editor_for.12a92962-8265-4fc0-b2f8-cf14f05db58b",
                                "group.admin"
                            ]
                        }
                    },
                    "argument_name": "combined_gvcf"
                }
            ],
            "status": "completed",
            "dependencies": [
                "workflow_gatk-HaplotypeCaller:0",
                "workflow_gatk-HaplotypeCaller:1",
                "workflow_gatk-HaplotypeCaller:2"
            ],
            "workflow_run": {
                "title": "workflow_gatk-CombineGVCFs v1.0.0 run 2022-04-29 19:55:36.043928",
                "status": "shared",
                "project": {
                    "@id": "/projects/cgap-core/",
                    "status": "shared",
                    "display_title": "CGAP Core",
                    "@type": [
                        "Project",
                        "Item"
                    ],
                    "uuid": "12a92962-8265-4fc0-b2f8-cf14f05db58b",
                    "principals_allowed": {
                        "view": [
                            "system.Authenticated"
                        ],
                        "edit": [
                            "group.admin"
                        ]
                    }
                },
                "run_url": "https://console.aws.amazon.com/states/home?region=us-east-1#/executions/details/arn:aws:states:us-east-1:922729568532:execution:tibanna_zebra_cgap-wolf:run_workflow_gatk-CombineGVCFs-b7cec697-b3c3-4fc6-9cd9-49893289b652",
                "parameters": [],
                "run_status": "complete",
                "input_files": [
                    {
                        "value": {
                            "display_title": "GAPFIH71G455.gvcf.gz",
                            "uuid": "1e51aea4-7fc1-4936-852a-83fbae9f34ff",
                            "status": "uploaded",
                            "file_size": 2212472843,
                            "href": "/files-processed/GAPFIH71G455/@@download/GAPFIH71G455.gvcf.gz",
                            "@id": "/files-processed/GAPFIH71G455/",
                            "accession": "GAPFIH71G455",
                            "@type": [
                                "FileProcessed",
                                "File",
                                "Item"
                            ],
                            "file_format": {
                                "@type": [
                                    "FileFormat",
                                    "Item"
                                ],
                                "status": "shared",
                                "@id": "/file-formats/gvcf_gz/",
                                "uuid": "ad47d469-4561-4234-bce2-820f08f58e7c",
                                "display_title": "gvcf_gz",
                                "principals_allowed": {
                                    "view": [
                                        "system.Authenticated"
                                    ],
                                    "edit": [
                                        "group.admin"
                                    ]
                                }
                            },
                            "principals_allowed": {
                                "view": [
                                    "editor_for.12a92962-8265-4fc0-b2f8-cf14f05db58b",
                                    "group.admin",
                                    "group.read-only-admin",
                                    "remoteuser.EMBED",
                                    "remoteuser.INDEXER"
                                ],
                                "edit": [
                                    "editor_for.12a92962-8265-4fc0-b2f8-cf14f05db58b",
                                    "group.admin"
                                ]
                            }
                        },
                        "ordinal": 1,
                        "dimension": "0",
                        "workflow_argument_name": "input_gvcfs"
                    },
                    {
                        "value": {
                            "display_title": "GAPFIXEYX9Q1.gvcf.gz",
                            "uuid": "1bb89ec3-12cd-46de-bbd7-7ba95db3fec6",
                            "status": "uploaded",
                            "file_size": 2200279777,
                            "href": "/files-processed/GAPFIXEYX9Q1/@@download/GAPFIXEYX9Q1.gvcf.gz",
                            "@id": "/files-processed/GAPFIXEYX9Q1/",
                            "accession": "GAPFIXEYX9Q1",
                            "@type": [
                                "FileProcessed",
                                "File",
                                "Item"
                            ],
                            "file_format": {
                                "@type": [
                                    "FileFormat",
                                    "Item"
                                ],
                                "status": "shared",
                                "@id": "/file-formats/gvcf_gz/",
                                "uuid": "ad47d469-4561-4234-bce2-820f08f58e7c",
                                "display_title": "gvcf_gz",
                                "principals_allowed": {
                                    "view": [
                                        "system.Authenticated"
                                    ],
                                    "edit": [
                                        "group.admin"
                                    ]
                                }
                            },
                            "principals_allowed": {
                                "view": [
                                    "editor_for.12a92962-8265-4fc0-b2f8-cf14f05db58b",
                                    "group.admin",
                                    "group.read-only-admin",
                                    "remoteuser.EMBED",
                                    "remoteuser.INDEXER"
                                ],
                                "edit": [
                                    "editor_for.12a92962-8265-4fc0-b2f8-cf14f05db58b",
                                    "group.admin"
                                ]
                            }
                        },
                        "ordinal": 2,
                        "dimension": "1",
                        "workflow_argument_name": "input_gvcfs"
                    },
                    {
                        "value": {
                            "display_title": "GAPFINHTTKUZ.gvcf.gz",
                            "uuid": "ed25677e-f2d6-4429-b9d2-300a36cff6ed",
                            "status": "uploaded",
                            "file_size": 2250854837,
                            "href": "/files-processed/GAPFINHTTKUZ/@@download/GAPFINHTTKUZ.gvcf.gz",
                            "@id": "/files-processed/GAPFINHTTKUZ/",
                            "accession": "GAPFINHTTKUZ",
                            "@type": [
                                "FileProcessed",
                                "File",
                                "Item"
                            ],
                            "file_format": {
                                "@type": [
                                    "FileFormat",
                                    "Item"
                                ],
                                "status": "shared",
                                "@id": "/file-formats/gvcf_gz/",
                                "uuid": "ad47d469-4561-4234-bce2-820f08f58e7c",
                                "display_title": "gvcf_gz",
                                "principals_allowed": {
                                    "view": [
                                        "system.Authenticated"
                                    ],
                                    "edit": [
                                        "group.admin"
                                    ]
                                }
                            },
                            "principals_allowed": {
                                "view": [
                                    "editor_for.12a92962-8265-4fc0-b2f8-cf14f05db58b",
                                    "group.admin",
                                    "group.read-only-admin",
                                    "remoteuser.EMBED",
                                    "remoteuser.INDEXER"
                                ],
                                "edit": [
                                    "editor_for.12a92962-8265-4fc0-b2f8-cf14f05db58b",
                                    "group.admin"
                                ]
                            }
                        },
                        "ordinal": 3,
                        "dimension": "2",
                        "workflow_argument_name": "input_gvcfs"
                    },
                    {
                        "value": {
                            "display_title": "GAPFIXRDPDK5.fa",
                            "uuid": "1936f246-22e1-45dc-bb5c-9cfd55537fe7",
                            "status": "uploaded",
                            "file_size": 3263683042,
                            "href": "/files-reference/GAPFIXRDPDK5/@@download/GAPFIXRDPDK5.fa",
                            "@id": "/files-reference/GAPFIXRDPDK5/",
                            "accession": "GAPFIXRDPDK5",
                            "@type": [
                                "FileReference",
                                "File",
                                "Item"
                            ],
                            "file_format": {
                                "@type": [
                                    "FileFormat",
                                    "Item"
                                ],
                                "status": "shared",
                                "@id": "/file-formats/fa/",
                                "uuid": "5ced774b-a73e-4d1b-8186-d7fbbde7a3c2",
                                "display_title": "fa",
                                "principals_allowed": {
                                    "view": [
                                        "system.Authenticated"
                                    ],
                                    "edit": [
                                        "group.admin"
                                    ]
                                }
                            },
                            "principals_allowed": {
                                "view": [
                                    "editor_for.12a92962-8265-4fc0-b2f8-cf14f05db58b",
                                    "group.admin",
                                    "group.read-only-admin",
                                    "remoteuser.EMBED",
                                    "remoteuser.INDEXER"
                                ],
                                "edit": [
                                    "editor_for.12a92962-8265-4fc0-b2f8-cf14f05db58b",
                                    "group.admin"
                                ]
                            }
                        },
                        "ordinal": 1,
                        "dimension": "0",
                        "workflow_argument_name": "reference"
                    },
                    {
                        "value": {
                            "display_title": "GAPFIGJVJDUY.txt",
                            "uuid": "a1d504ee-a313-4064-b6ae-65fed9738980",
                            "status": "uploaded",
                            "file_size": 138,
                            "href": "/files-reference/GAPFIGJVJDUY/@@download/GAPFIGJVJDUY.txt",
                            "@id": "/files-reference/GAPFIGJVJDUY/",
                            "accession": "GAPFIGJVJDUY",
                            "@type": [
                                "FileReference",
                                "File",
                                "Item"
                            ],
                            "file_format": {
                                "@type": [
                                    "FileFormat",
                                    "Item"
                                ],
                                "status": "shared",
                                "@id": "/file-formats/txt/",
                                "uuid": "0cd4e777-a596-4927-95c8-b07716121aa3",
                                "display_title": "txt",
                                "principals_allowed": {
                                    "view": [
                                        "system.Authenticated"
                                    ],
                                    "edit": [
                                        "group.admin"
                                    ]
                                }
                            },
                            "principals_allowed": {
                                "view": [
                                    "editor_for.12a92962-8265-4fc0-b2f8-cf14f05db58b",
                                    "group.admin",
                                    "group.read-only-admin",
                                    "remoteuser.EMBED",
                                    "remoteuser.INDEXER"
                                ],
                                "edit": [
                                    "editor_for.12a92962-8265-4fc0-b2f8-cf14f05db58b",
                                    "group.admin"
                                ]
                            }
                        },
                        "ordinal": 1,
                        "dimension": "0",
                        "workflow_argument_name": "chromosomes"
                    }
                ],
                "institution": {
                    "uuid": "828cd4fe-ebb0-4b36-a94a-d2e3a36cc989",
                    "@type": [
                        "Institution",
                        "Item"
                    ],
                    "status": "current",
                    "display_title": "HMS DBMI",
                    "@id": "/institutions/hms-dbmi/",
                    "principals_allowed": {
                        "view": [
                            "group.admin",
                            "group.read-only-admin",
                            "remoteuser.EMBED",
                            "remoteuser.INDEXER"
                        ],
                        "edit": [
                            "group.admin"
                        ]
                    }
                },
                "awsem_job_id": "vWf0ouS1uBzP",
                "date_created": "2022-04-29T19:55:36.136308+00:00",
                "output_files": [
                    {
                        "type": "Output processed file",
                        "value": {
                            "@type": [
                                "FileProcessed",
                                "File",
                                "Item"
                            ],
                            "file_format": {
                                "@id": "/file-formats/gvcf_gz/",
                                "status": "shared",
                                "@type": [
                                    "FileFormat",
                                    "Item"
                                ],
                                "display_title": "gvcf_gz",
                                "uuid": "ad47d469-4561-4234-bce2-820f08f58e7c",
                                "principals_allowed": {
                                    "view": [
                                        "system.Authenticated"
                                    ],
                                    "edit": [
                                        "group.admin"
                                    ]
                                }
                            },
                            "accession": "GAPFI4589EXS",
                            "uuid": "2021801b-9f49-4fc9-9e86-9b8046edd5e9",
                            "@id": "/files-processed/GAPFI4589EXS/",
                            "file_size": 6071718531,
                            "display_title": "GAPFI4589EXS.gvcf.gz",
                            "status": "uploaded",
                            "href": "/files-processed/GAPFI4589EXS/@@download/GAPFI4589EXS.gvcf.gz",
                            "principals_allowed": {
                                "view": [
                                    "editor_for.12a92962-8265-4fc0-b2f8-cf14f05db58b",
                                    "group.admin",
                                    "group.read-only-admin",
                                    "remoteuser.EMBED",
                                    "remoteuser.INDEXER"
                                ],
                                "edit": [
                                    "editor_for.12a92962-8265-4fc0-b2f8-cf14f05db58b",
                                    "group.admin"
                                ]
                            }
                        },
                        "format": "/file-formats/gvcf_gz/",
                        "upload_key": "2021801b-9f49-4fc9-9e86-9b8046edd5e9/GAPFI4589EXS.gvcf.gz",
                        "extra_files": [
                            {
                                "href": "/2021801b-9f49-4fc9-9e86-9b8046edd5e9/@@download/GAPFI4589EXS.gvcf.gz.tbi",
                                "uuid": "2021801b-9f49-4fc9-9e86-9b8046edd5e9",
                                "status": "uploading",
                                "filename": "GAPFI4589EXS",
                                "accession": "GAPFI4589EXS",
                                "upload_key": "2021801b-9f49-4fc9-9e86-9b8046edd5e9/GAPFI4589EXS.gvcf.gz.tbi",
                                "file_format": "/file-formats/gvcf_gz_tbi/"
                            }
                        ],
                        "secondary_file_formats": [
                            "/file-formats/gvcf_gz_tbi/"
                        ],
                        "workflow_argument_name": "combined_gvcf"
                    }
                ],
                "run_platform": "AWSEM",
                "submitted_by": {
                    "status": "current",
                    "@type": [
                        "User",
                        "Item"
                    ],
                    "display_title": "Tibanna App",
                    "uuid": "b041dba8-e2b2-4e54-a621-97edb508a0c4",
                    "@id": "/users/b041dba8-e2b2-4e54-a621-97edb508a0c4/",
                    "principals_allowed": {
                        "view": [
                            "group.admin",
                            "remoteuser.EMBED",
                            "remoteuser.INDEXER",
                            "userid.b041dba8-e2b2-4e54-a621-97edb508a0c4"
                        ],
                        "edit": [
                            "group.admin"
                        ]
                    }
                },
                "last_modified": {
                    "modified_by": {
                        "@type": [
                            "User",
                            "Item"
                        ],
                        "display_title": "Foursight App",
                        "status": "current",
                        "@id": "/users/7677f8a8-79d2-4cff-ab0a-a967a2a68e39/",
                        "uuid": "7677f8a8-79d2-4cff-ab0a-a967a2a68e39",
                        "principals_allowed": {
                            "view": [
                                "group.admin",
                                "remoteuser.EMBED",
                                "remoteuser.INDEXER",
                                "userid.7677f8a8-79d2-4cff-ab0a-a967a2a68e39"
                            ],
                            "edit": [
                                "group.admin"
                            ]
                        }
                    },
                    "date_modified": "2022-04-30T10:00:30.854390+00:00"
                },
                "metadata_only": false,
                "awsem_app_name": "workflow_gatk-CombineGVCFs",
                "quality_metric": {
                    "uuid": "648cf960-65b0-4911-8488-2ef6b6e54090",
                    "status": "shared",
                    "@type": [
                        "QualityMetricWorkflowrun",
                        "QualityMetric",
                        "Item"
                    ],
                    "display_title": "QualityMetricWorkflowrun from 2022-04-29",
                    "@id": "/quality-metrics-workflowrun/648cf960-65b0-4911-8488-2ef6b6e54090/",
                    "principals_allowed": {
                        "view": [
                            "system.Authenticated"
                        ],
                        "edit": [
                            "group.admin"
                        ]
                    }
                },
                "schema_version": "3",
                "awsem_postrun_json": "https://s3.amazonaws.com/cgap-biotest-main-application-tibanna-output/vWf0ouS1uBzP.postrun.json",
                "associated_meta_workflow_runs": [
                    "a77b8431-2936-4f87-8405-8aa43ee777c1"
                ],
                "@id": "/workflow-runs-awsem/59fc114b-ccd6-416d-9555-4d2270c4c3dd/",
                "@type": [
                    "WorkflowRunAwsem",
                    "WorkflowRun",
                    "Item"
                ],
                "uuid": "59fc114b-ccd6-416d-9555-4d2270c4c3dd",
                "principals_allowed": {
                    "view": [
                        "system.Authenticated"
                    ],
                    "edit": [
                        "group.admin"
                    ]
                },
                "display_title": "workflow_gatk-CombineGVCFs v1.0.0 run 2022-04-29 19:55:36.043928",
                "@context": "/terms/",
                "actions": [
                    {
                        "name": "create",
                        "title": "Create",
                        "profile": "/profiles/WorkflowRunAwsem.json",
                        "href": "/workflow-runs-awsem/59fc114b-ccd6-416d-9555-4d2270c4c3dd/?currentAction=create"
                    },
                    {
                        "name": "edit",
                        "title": "Edit",
                        "profile": "/profiles/WorkflowRunAwsem.json",
                        "href": "/workflow-runs-awsem/59fc114b-ccd6-416d-9555-4d2270c4c3dd/?currentAction=edit"
                    }
                ],
                "aggregated-items": {},
                "validation-errors": []
            }
        },
        {
            "name": "workflow_gatk-GenotypeGVCFs-check",
            "jobid": "yuiDWe4W2Wmr",
            "shard": "0",
            "output": [
                {
                    "file": {
                        "display_title": "GAPFI6J5MLR9.vcf.gz",
                        "status": "uploaded",
                        "@id": "/files-processed/GAPFI6J5MLR9/",
                        "uuid": "a6c9f1f0-e52a-4c3b-bc91-047462bf4d88",
                        "@type": [
                            "FileProcessed",
                            "File",
                            "Item"
                        ],
                        "principals_allowed": {
                            "view": [
                                "editor_for.12a92962-8265-4fc0-b2f8-cf14f05db58b",
                                "group.admin",
                                "group.read-only-admin",
                                "remoteuser.EMBED",
                                "remoteuser.INDEXER"
                            ],
                            "edit": [
                                "editor_for.12a92962-8265-4fc0-b2f8-cf14f05db58b",
                                "group.admin"
                            ]
                        }
                    },
                    "argument_name": "vcf"
                }
            ],
            "status": "completed",
            "dependencies": [
                "workflow_gatk-CombineGVCFs:0"
            ],
            "workflow_run": {
                "title": "workflow_gatk-GenotypeGVCFs-check v1.0.0 run 2022-04-29 21:10:40.235957",
                "status": "shared",
                "project": {
                    "uuid": "12a92962-8265-4fc0-b2f8-cf14f05db58b",
                    "status": "shared",
                    "@type": [
                        "Project",
                        "Item"
                    ],
                    "display_title": "CGAP Core",
                    "@id": "/projects/cgap-core/",
                    "principals_allowed": {
                        "view": [
                            "system.Authenticated"
                        ],
                        "edit": [
                            "group.admin"
                        ]
                    }
                },
                "run_url": "https://console.aws.amazon.com/states/home?region=us-east-1#/executions/details/arn:aws:states:us-east-1:922729568532:execution:tibanna_zebra_cgap-wolf:run_workflow_gatk-GenotypeGVCFs-check-cffd0f74-101f-42cc-ba8c-85437a2d9764",
                "parameters": [],
                "run_status": "complete",
                "input_files": [
                    {
                        "value": {
                            "uuid": "2021801b-9f49-4fc9-9e86-9b8046edd5e9",
                            "href": "/files-processed/GAPFI4589EXS/@@download/GAPFI4589EXS.gvcf.gz",
                            "@id": "/files-processed/GAPFI4589EXS/",
                            "accession": "GAPFI4589EXS",
                            "display_title": "GAPFI4589EXS.gvcf.gz",
                            "file_size": 6071718531,
                            "@type": [
                                "FileProcessed",
                                "File",
                                "Item"
                            ],
                            "status": "uploaded",
                            "file_format": {
                                "uuid": "ad47d469-4561-4234-bce2-820f08f58e7c",
                                "status": "shared",
                                "@id": "/file-formats/gvcf_gz/",
                                "display_title": "gvcf_gz",
                                "@type": [
                                    "FileFormat",
                                    "Item"
                                ],
                                "principals_allowed": {
                                    "view": [
                                        "system.Authenticated"
                                    ],
                                    "edit": [
                                        "group.admin"
                                    ]
                                }
                            },
                            "principals_allowed": {
                                "view": [
                                    "editor_for.12a92962-8265-4fc0-b2f8-cf14f05db58b",
                                    "group.admin",
                                    "group.read-only-admin",
                                    "remoteuser.EMBED",
                                    "remoteuser.INDEXER"
                                ],
                                "edit": [
                                    "editor_for.12a92962-8265-4fc0-b2f8-cf14f05db58b",
                                    "group.admin"
                                ]
                            }
                        },
                        "ordinal": 1,
                        "dimension": "0",
                        "workflow_argument_name": "input_gvcf"
                    },
                    {
                        "value": {
                            "uuid": "1936f246-22e1-45dc-bb5c-9cfd55537fe7",
                            "href": "/files-reference/GAPFIXRDPDK5/@@download/GAPFIXRDPDK5.fa",
                            "@id": "/files-reference/GAPFIXRDPDK5/",
                            "accession": "GAPFIXRDPDK5",
                            "display_title": "GAPFIXRDPDK5.fa",
                            "file_size": 3263683042,
                            "@type": [
                                "FileReference",
                                "File",
                                "Item"
                            ],
                            "status": "uploaded",
                            "file_format": {
                                "uuid": "5ced774b-a73e-4d1b-8186-d7fbbde7a3c2",
                                "status": "shared",
                                "@id": "/file-formats/fa/",
                                "display_title": "fa",
                                "@type": [
                                    "FileFormat",
                                    "Item"
                                ],
                                "principals_allowed": {
                                    "view": [
                                        "system.Authenticated"
                                    ],
                                    "edit": [
                                        "group.admin"
                                    ]
                                }
                            },
                            "principals_allowed": {
                                "view": [
                                    "editor_for.12a92962-8265-4fc0-b2f8-cf14f05db58b",
                                    "group.admin",
                                    "group.read-only-admin",
                                    "remoteuser.EMBED",
                                    "remoteuser.INDEXER"
                                ],
                                "edit": [
                                    "editor_for.12a92962-8265-4fc0-b2f8-cf14f05db58b",
                                    "group.admin"
                                ]
                            }
                        },
                        "ordinal": 1,
                        "dimension": "0",
                        "workflow_argument_name": "reference"
                    },
                    {
                        "value": {
                            "uuid": "a1d504ee-a313-4064-b6ae-65fed9738980",
                            "href": "/files-reference/GAPFIGJVJDUY/@@download/GAPFIGJVJDUY.txt",
                            "@id": "/files-reference/GAPFIGJVJDUY/",
                            "accession": "GAPFIGJVJDUY",
                            "display_title": "GAPFIGJVJDUY.txt",
                            "file_size": 138,
                            "@type": [
                                "FileReference",
                                "File",
                                "Item"
                            ],
                            "status": "uploaded",
                            "file_format": {
                                "uuid": "0cd4e777-a596-4927-95c8-b07716121aa3",
                                "status": "shared",
                                "@id": "/file-formats/txt/",
                                "display_title": "txt",
                                "@type": [
                                    "FileFormat",
                                    "Item"
                                ],
                                "principals_allowed": {
                                    "view": [
                                        "system.Authenticated"
                                    ],
                                    "edit": [
                                        "group.admin"
                                    ]
                                }
                            },
                            "principals_allowed": {
                                "view": [
                                    "editor_for.12a92962-8265-4fc0-b2f8-cf14f05db58b",
                                    "group.admin",
                                    "group.read-only-admin",
                                    "remoteuser.EMBED",
                                    "remoteuser.INDEXER"
                                ],
                                "edit": [
                                    "editor_for.12a92962-8265-4fc0-b2f8-cf14f05db58b",
                                    "group.admin"
                                ]
                            }
                        },
                        "ordinal": 1,
                        "dimension": "0",
                        "workflow_argument_name": "chromosomes"
                    },
                    {
                        "value": {
                            "uuid": "8ed35691-0af4-467a-adbc-81eb088549f0",
                            "href": "/files-reference/GAPFI4LJRN98/@@download/GAPFI4LJRN98.vcf.gz",
                            "@id": "/files-reference/GAPFI4LJRN98/",
                            "accession": "GAPFI4LJRN98",
                            "display_title": "GAPFI4LJRN98.vcf.gz",
                            "file_size": 1595848625,
                            "@type": [
                                "FileReference",
                                "File",
                                "Item"
                            ],
                            "status": "uploaded",
                            "file_format": {
                                "uuid": "1b8f525f-aecb-4211-9ae5-a2c998b05599",
                                "status": "shared",
                                "@id": "/file-formats/vcf_gz/",
                                "display_title": "vcf_gz",
                                "@type": [
                                    "FileFormat",
                                    "Item"
                                ],
                                "principals_allowed": {
                                    "view": [
                                        "system.Authenticated"
                                    ],
                                    "edit": [
                                        "group.admin"
                                    ]
                                }
                            },
                            "principals_allowed": {
                                "view": [
                                    "editor_for.12a92962-8265-4fc0-b2f8-cf14f05db58b",
                                    "group.admin",
                                    "group.read-only-admin",
                                    "remoteuser.EMBED",
                                    "remoteuser.INDEXER"
                                ],
                                "edit": [
                                    "editor_for.12a92962-8265-4fc0-b2f8-cf14f05db58b",
                                    "group.admin"
                                ]
                            }
                        },
                        "ordinal": 1,
                        "dimension": "0",
                        "workflow_argument_name": "known-sites-snp"
                    }
                ],
                "institution": {
                    "status": "current",
                    "uuid": "828cd4fe-ebb0-4b36-a94a-d2e3a36cc989",
                    "@id": "/institutions/hms-dbmi/",
                    "@type": [
                        "Institution",
                        "Item"
                    ],
                    "display_title": "HMS DBMI",
                    "principals_allowed": {
                        "view": [
                            "group.admin",
                            "group.read-only-admin",
                            "remoteuser.EMBED",
                            "remoteuser.INDEXER"
                        ],
                        "edit": [
                            "group.admin"
                        ]
                    }
                },
                "awsem_job_id": "yuiDWe4W2Wmr",
                "date_created": "2022-04-29T21:10:40.374470+00:00",
                "output_files": [
                    {
                        "type": "Output processed file",
                        "value": {
                            "file_format": {
                                "status": "shared",
                                "@id": "/file-formats/vcf_gz/",
                                "@type": [
                                    "FileFormat",
                                    "Item"
                                ],
                                "uuid": "1b8f525f-aecb-4211-9ae5-a2c998b05599",
                                "display_title": "vcf_gz",
                                "principals_allowed": {
                                    "view": [
                                        "system.Authenticated"
                                    ],
                                    "edit": [
                                        "group.admin"
                                    ]
                                }
                            },
                            "uuid": "a6c9f1f0-e52a-4c3b-bc91-047462bf4d88",
                            "@id": "/files-processed/GAPFI6J5MLR9/",
                            "file_size": 449938897,
                            "status": "uploaded",
                            "href": "/files-processed/GAPFI6J5MLR9/@@download/GAPFI6J5MLR9.vcf.gz",
                            "display_title": "GAPFI6J5MLR9.vcf.gz",
                            "accession": "GAPFI6J5MLR9",
                            "@type": [
                                "FileProcessed",
                                "File",
                                "Item"
                            ],
                            "quality_metric": {
                                "@id": "/quality-metrics-qclist/ede965e7-0c0f-4f7b-b7f8-2d47c2dbe36b/",
                                "uuid": "ede965e7-0c0f-4f7b-b7f8-2d47c2dbe36b",
                                "display_title": "QualityMetricQclist from 2022-04-29",
                                "status": "shared",
                                "overall_quality_status": "PASS",
                                "@type": [
                                    "QualityMetricQclist",
                                    "QualityMetric",
                                    "Item"
                                ],
                                "principals_allowed": {
                                    "view": [
                                        "system.Authenticated"
                                    ],
                                    "edit": [
                                        "group.admin"
                                    ]
                                }
                            },
                            "principals_allowed": {
                                "view": [
                                    "editor_for.12a92962-8265-4fc0-b2f8-cf14f05db58b",
                                    "group.admin",
                                    "group.read-only-admin",
                                    "remoteuser.EMBED",
                                    "remoteuser.INDEXER"
                                ],
                                "edit": [
                                    "editor_for.12a92962-8265-4fc0-b2f8-cf14f05db58b",
                                    "group.admin"
                                ]
                            }
                        },
                        "format": "/file-formats/vcf_gz/",
                        "upload_key": "a6c9f1f0-e52a-4c3b-bc91-047462bf4d88/GAPFI6J5MLR9.vcf.gz",
                        "extra_files": [
                            {
                                "href": "/a6c9f1f0-e52a-4c3b-bc91-047462bf4d88/@@download/GAPFI6J5MLR9.vcf.gz.tbi",
                                "uuid": "a6c9f1f0-e52a-4c3b-bc91-047462bf4d88",
                                "status": "uploading",
                                "filename": "GAPFI6J5MLR9",
                                "accession": "GAPFI6J5MLR9",
                                "upload_key": "a6c9f1f0-e52a-4c3b-bc91-047462bf4d88/GAPFI6J5MLR9.vcf.gz.tbi",
                                "file_format": "/file-formats/vcf_gz_tbi/"
                            }
                        ],
                        "secondary_file_formats": [
                            "/file-formats/vcf_gz_tbi/"
                        ],
                        "workflow_argument_name": "vcf"
                    },
                    {
                        "type": "Output QC file",
                        "value_qc": {
                            "status": "shared",
                            "display_title": "QualityMetricVcfcheck from 2022-04-29",
                            "@type": [
                                "QualityMetricVcfcheck",
                                "QualityMetric",
                                "Item"
                            ],
                            "overall_quality_status": "PASS",
                            "@id": "/quality-metrics-vcfcheck/3b0bfae1-55ca-4330-b1d2-2aefbc026767/",
                            "uuid": "3b0bfae1-55ca-4330-b1d2-2aefbc026767",
                            "principals_allowed": {
                                "view": [
                                    "system.Authenticated"
                                ],
                                "edit": [
                                    "group.admin"
                                ]
                            }
                        },
                        "workflow_argument_name": "vcf-check"
                    }
                ],
                "run_platform": "AWSEM",
                "submitted_by": {
                    "display_title": "Tibanna App",
                    "@type": [
                        "User",
                        "Item"
                    ],
                    "status": "current",
                    "uuid": "b041dba8-e2b2-4e54-a621-97edb508a0c4",
                    "@id": "/users/b041dba8-e2b2-4e54-a621-97edb508a0c4/",
                    "principals_allowed": {
                        "view": [
                            "group.admin",
                            "remoteuser.EMBED",
                            "remoteuser.INDEXER",
                            "userid.b041dba8-e2b2-4e54-a621-97edb508a0c4"
                        ],
                        "edit": [
                            "group.admin"
                        ]
                    }
                },
                "last_modified": {
                    "modified_by": {
                        "display_title": "Foursight App",
                        "status": "current",
                        "@type": [
                            "User",
                            "Item"
                        ],
                        "@id": "/users/7677f8a8-79d2-4cff-ab0a-a967a2a68e39/",
                        "uuid": "7677f8a8-79d2-4cff-ab0a-a967a2a68e39",
                        "principals_allowed": {
                            "view": [
                                "group.admin",
                                "remoteuser.EMBED",
                                "remoteuser.INDEXER",
                                "userid.7677f8a8-79d2-4cff-ab0a-a967a2a68e39"
                            ],
                            "edit": [
                                "group.admin"
                            ]
                        }
                    },
                    "date_modified": "2022-04-30T10:00:30.539549+00:00"
                },
                "metadata_only": false,
                "awsem_app_name": "workflow_gatk-GenotypeGVCFs-check",
                "quality_metric": {
                    "uuid": "b8752e3f-0ba7-41a3-a453-8021beb546aa",
                    "display_title": "QualityMetricWorkflowrun from 2022-04-29",
                    "@id": "/quality-metrics-workflowrun/b8752e3f-0ba7-41a3-a453-8021beb546aa/",
                    "@type": [
                        "QualityMetricWorkflowrun",
                        "QualityMetric",
                        "Item"
                    ],
                    "status": "shared",
                    "principals_allowed": {
                        "view": [
                            "system.Authenticated"
                        ],
                        "edit": [
                            "group.admin"
                        ]
                    }
                },
                "schema_version": "3",
                "awsem_postrun_json": "https://s3.amazonaws.com/cgap-biotest-main-application-tibanna-output/yuiDWe4W2Wmr.postrun.json",
                "associated_meta_workflow_runs": [
                    "a77b8431-2936-4f87-8405-8aa43ee777c1"
                ],
                "@id": "/workflow-runs-awsem/3e3530ef-c67d-4708-be5f-84349f49b182/",
                "@type": [
                    "WorkflowRunAwsem",
                    "WorkflowRun",
                    "Item"
                ],
                "uuid": "3e3530ef-c67d-4708-be5f-84349f49b182",
                "principals_allowed": {
                    "view": [
                        "system.Authenticated"
                    ],
                    "edit": [
                        "group.admin"
                    ]
                },
                "display_title": "workflow_gatk-GenotypeGVCFs-check v1.0.0 run 2022-04-29 21:10:40.235957",
                "@context": "/terms/",
                "actions": [
                    {
                        "name": "create",
                        "title": "Create",
                        "profile": "/profiles/WorkflowRunAwsem.json",
                        "href": "/workflow-runs-awsem/3e3530ef-c67d-4708-be5f-84349f49b182/?currentAction=create"
                    },
                    {
                        "name": "edit",
                        "title": "Edit",
                        "profile": "/profiles/WorkflowRunAwsem.json",
                        "href": "/workflow-runs-awsem/3e3530ef-c67d-4708-be5f-84349f49b182/?currentAction=edit"
                    }
                ],
                "aggregated-items": {},
                "validation-errors": []
            }
        },
        {
            "name": "workflow_samplegeno",
            "jobid": "sng5iNR61xlj",
            "shard": "0",
            "output": [
                {
                    "file": {
                        "display_title": "GAPFI68EKBY2.vcf.gz",
                        "status": "uploaded",
                        "@id": "/files-processed/GAPFI68EKBY2/",
                        "uuid": "56c0a779-c771-4a67-acce-f7bbc2707d6e",
                        "@type": [
                            "FileProcessed",
                            "File",
                            "Item"
                        ],
                        "principals_allowed": {
                            "view": [
                                "editor_for.12a92962-8265-4fc0-b2f8-cf14f05db58b",
                                "group.admin",
                                "group.read-only-admin",
                                "remoteuser.EMBED",
                                "remoteuser.INDEXER"
                            ],
                            "edit": [
                                "editor_for.12a92962-8265-4fc0-b2f8-cf14f05db58b",
                                "group.admin"
                            ]
                        }
                    },
                    "argument_name": "samplegeno_vcf"
                }
            ],
            "status": "completed",
            "dependencies": [
                "workflow_gatk-GenotypeGVCFs-check:0"
            ],
            "workflow_run": {
                "title": "workflow_samplegeno v1.0.0 run 2022-04-29 22:10:36.226203",
                "status": "shared",
                "project": {
                    "status": "shared",
                    "@id": "/projects/cgap-core/",
                    "@type": [
                        "Project",
                        "Item"
                    ],
                    "uuid": "12a92962-8265-4fc0-b2f8-cf14f05db58b",
                    "display_title": "CGAP Core",
                    "principals_allowed": {
                        "view": [
                            "system.Authenticated"
                        ],
                        "edit": [
                            "group.admin"
                        ]
                    }
                },
                "parameters": [],
                "run_status": "complete",
                "input_files": [
                    {
                        "value": {
                            "accession": "GAPFI6J5MLR9",
                            "@id": "/files-processed/GAPFI6J5MLR9/",
                            "file_size": 449938897,
                            "@type": [
                                "FileProcessed",
                                "File",
                                "Item"
                            ],
                            "display_title": "GAPFI6J5MLR9.vcf.gz",
                            "file_format": {
                                "@id": "/file-formats/vcf_gz/",
                                "status": "shared",
                                "display_title": "vcf_gz",
                                "uuid": "1b8f525f-aecb-4211-9ae5-a2c998b05599",
                                "@type": [
                                    "FileFormat",
                                    "Item"
                                ],
                                "principals_allowed": {
                                    "view": [
                                        "system.Authenticated"
                                    ],
                                    "edit": [
                                        "group.admin"
                                    ]
                                }
                            },
                            "status": "uploaded",
                            "href": "/files-processed/GAPFI6J5MLR9/@@download/GAPFI6J5MLR9.vcf.gz",
                            "uuid": "a6c9f1f0-e52a-4c3b-bc91-047462bf4d88",
                            "principals_allowed": {
                                "view": [
                                    "editor_for.12a92962-8265-4fc0-b2f8-cf14f05db58b",
                                    "group.admin",
                                    "group.read-only-admin",
                                    "remoteuser.EMBED",
                                    "remoteuser.INDEXER"
                                ],
                                "edit": [
                                    "editor_for.12a92962-8265-4fc0-b2f8-cf14f05db58b",
                                    "group.admin"
                                ]
                            },
                            "quality_metric": {
                                "display_title": "QualityMetricQclist from 2022-04-29",
                                "status": "shared",
                                "@id": "/quality-metrics-qclist/ede965e7-0c0f-4f7b-b7f8-2d47c2dbe36b/",
                                "overall_quality_status": "PASS",
                                "@type": [
                                    "QualityMetricQclist",
                                    "QualityMetric",
                                    "Item"
                                ],
                                "uuid": "ede965e7-0c0f-4f7b-b7f8-2d47c2dbe36b",
                                "principals_allowed": {
                                    "view": [
                                        "system.Authenticated"
                                    ],
                                    "edit": [
                                        "group.admin"
                                    ]
                                }
                            }
                        },
                        "ordinal": 1,
                        "dimension": "0",
                        "workflow_argument_name": "input_vcf"
                    }
                ],
                "institution": {
                    "uuid": "828cd4fe-ebb0-4b36-a94a-d2e3a36cc989",
                    "status": "current",
                    "@type": [
                        "Institution",
                        "Item"
                    ],
                    "display_title": "HMS DBMI",
                    "@id": "/institutions/hms-dbmi/",
                    "principals_allowed": {
                        "view": [
                            "group.admin",
                            "group.read-only-admin",
                            "remoteuser.EMBED",
                            "remoteuser.INDEXER"
                        ],
                        "edit": [
                            "group.admin"
                        ]
                    }
                },
                "awsem_job_id": "sng5iNR61xlj",
                "date_created": "2022-04-29T22:10:36.314530+00:00",
                "output_files": [
                    {
                        "type": "Output processed file",
                        "value": {
                            "status": "uploaded",
                            "@id": "/files-processed/GAPFI68EKBY2/",
                            "@type": [
                                "FileProcessed",
                                "File",
                                "Item"
                            ],
                            "href": "/files-processed/GAPFI68EKBY2/@@download/GAPFI68EKBY2.vcf.gz",
                            "file_size": 565028521,
                            "uuid": "56c0a779-c771-4a67-acce-f7bbc2707d6e",
                            "file_format": {
                                "@id": "/file-formats/vcf_gz/",
                                "uuid": "1b8f525f-aecb-4211-9ae5-a2c998b05599",
                                "status": "shared",
                                "display_title": "vcf_gz",
                                "@type": [
                                    "FileFormat",
                                    "Item"
                                ],
                                "principals_allowed": {
                                    "view": [
                                        "system.Authenticated"
                                    ],
                                    "edit": [
                                        "group.admin"
                                    ]
                                }
                            },
                            "accession": "GAPFI68EKBY2",
                            "display_title": "GAPFI68EKBY2.vcf.gz",
                            "quality_metric": {
                                "overall_quality_status": "PASS",
                                "uuid": "367b0795-c6f2-4ce3-85e2-b63f4d1b1b4a",
                                "@type": [
                                    "QualityMetricVcfqc",
                                    "QualityMetric",
                                    "Item"
                                ],
                                "status": "shared",
                                "display_title": "QualityMetricVcfqc from 2022-04-29",
                                "@id": "/quality-metrics-vcfqc/367b0795-c6f2-4ce3-85e2-b63f4d1b1b4a/",
                                "principals_allowed": {
                                    "view": [
                                        "system.Authenticated"
                                    ],
                                    "edit": [
                                        "group.admin"
                                    ]
                                }
                            },
                            "principals_allowed": {
                                "view": [
                                    "editor_for.12a92962-8265-4fc0-b2f8-cf14f05db58b",
                                    "group.admin",
                                    "group.read-only-admin",
                                    "remoteuser.EMBED",
                                    "remoteuser.INDEXER"
                                ],
                                "edit": [
                                    "editor_for.12a92962-8265-4fc0-b2f8-cf14f05db58b",
                                    "group.admin"
                                ]
                            }
                        },
                        "format": "/file-formats/vcf_gz/",
                        "upload_key": "56c0a779-c771-4a67-acce-f7bbc2707d6e/GAPFI68EKBY2.vcf.gz",
                        "extra_files": [
                            {
                                "href": "/56c0a779-c771-4a67-acce-f7bbc2707d6e/@@download/GAPFI68EKBY2.vcf.gz.tbi",
                                "uuid": "56c0a779-c771-4a67-acce-f7bbc2707d6e",
                                "status": "uploading",
                                "filename": "GAPFI68EKBY2",
                                "accession": "GAPFI68EKBY2",
                                "upload_key": "56c0a779-c771-4a67-acce-f7bbc2707d6e/GAPFI68EKBY2.vcf.gz.tbi",
                                "file_format": "/file-formats/vcf_gz_tbi/"
                            }
                        ],
                        "secondary_file_formats": [
                            "/file-formats/vcf_gz_tbi/"
                        ],
                        "workflow_argument_name": "samplegeno_vcf"
                    }
                ],
                "run_platform": "AWSEM",
                "submitted_by": {
                    "uuid": "b041dba8-e2b2-4e54-a621-97edb508a0c4",
                    "@id": "/users/b041dba8-e2b2-4e54-a621-97edb508a0c4/",
                    "display_title": "Tibanna App",
                    "@type": [
                        "User",
                        "Item"
                    ],
                    "status": "current",
                    "principals_allowed": {
                        "view": [
                            "group.admin",
                            "remoteuser.EMBED",
                            "remoteuser.INDEXER",
                            "userid.b041dba8-e2b2-4e54-a621-97edb508a0c4"
                        ],
                        "edit": [
                            "group.admin"
                        ]
                    }
                },
                "last_modified": {
                    "modified_by": {
                        "@id": "/users/7677f8a8-79d2-4cff-ab0a-a967a2a68e39/",
                        "display_title": "Foursight App",
                        "status": "current",
                        "@type": [
                            "User",
                            "Item"
                        ],
                        "uuid": "7677f8a8-79d2-4cff-ab0a-a967a2a68e39",
                        "principals_allowed": {
                            "view": [
                                "group.admin",
                                "remoteuser.EMBED",
                                "remoteuser.INDEXER",
                                "userid.7677f8a8-79d2-4cff-ab0a-a967a2a68e39"
                            ],
                            "edit": [
                                "group.admin"
                            ]
                        }
                    },
                    "date_modified": "2022-04-30T10:00:30.418150+00:00"
                },
                "metadata_only": false,
                "awsem_app_name": "workflow_samplegeno",
                "quality_metric": {
                    "@type": [
                        "QualityMetricWorkflowrun",
                        "QualityMetric",
                        "Item"
                    ],
                    "@id": "/quality-metrics-workflowrun/4e428911-8894-4bb1-b4d2-2577b38cea74/",
                    "uuid": "4e428911-8894-4bb1-b4d2-2577b38cea74",
                    "display_title": "QualityMetricWorkflowrun from 2022-04-29",
                    "status": "shared",
                    "principals_allowed": {
                        "view": [
                            "system.Authenticated"
                        ],
                        "edit": [
                            "group.admin"
                        ]
                    }
                },
                "schema_version": "3",
                "awsem_postrun_json": "https://s3.amazonaws.com/cgap-biotest-main-application-tibanna-output/sng5iNR61xlj.postrun.json",
                "associated_meta_workflow_runs": [
                    "a77b8431-2936-4f87-8405-8aa43ee777c1"
                ],
                "@id": "/workflow-runs-awsem/6aea60a0-18c8-4e4d-9a1c-fd993346baf2/",
                "@type": [
                    "WorkflowRunAwsem",
                    "WorkflowRun",
                    "Item"
                ],
                "uuid": "6aea60a0-18c8-4e4d-9a1c-fd993346baf2",
                "principals_allowed": {
                    "view": [
                        "system.Authenticated"
                    ],
                    "edit": [
                        "group.admin"
                    ]
                },
                "display_title": "workflow_samplegeno v1.0.0 run 2022-04-29 22:10:36.226203",
                "@context": "/terms/",
                "actions": [
                    {
                        "name": "create",
                        "title": "Create",
                        "profile": "/profiles/WorkflowRunAwsem.json",
                        "href": "/workflow-runs-awsem/6aea60a0-18c8-4e4d-9a1c-fd993346baf2/?currentAction=create"
                    },
                    {
                        "name": "edit",
                        "title": "Edit",
                        "profile": "/profiles/WorkflowRunAwsem.json",
                        "href": "/workflow-runs-awsem/6aea60a0-18c8-4e4d-9a1c-fd993346baf2/?currentAction=edit"
                    }
                ],
                "aggregated-items": {},
                "validation-errors": []
            }
        },
        {
            "name": "workflow_granite-qcVCF",
            "jobid": "M2ezVrAPnQrw",
            "shard": "0",
            "status": "completed",
            "dependencies": [
                "workflow_gatk-GenotypeGVCFs-check:0"
            ],
            "workflow_run": {
                "title": "workflow_granite-qcVCF v1.0.0 run 2022-04-29 22:10:39.971610",
                "status": "shared",
                "project": {
                    "status": "shared",
                    "@type": [
                        "Project",
                        "Item"
                    ],
                    "display_title": "CGAP Core",
                    "uuid": "12a92962-8265-4fc0-b2f8-cf14f05db58b",
                    "@id": "/projects/cgap-core/",
                    "principals_allowed": {
                        "view": [
                            "system.Authenticated"
                        ],
                        "edit": [
                            "group.admin"
                        ]
                    }
                },
                "run_url": "https://console.aws.amazon.com/states/home?region=us-east-1#/executions/details/arn:aws:states:us-east-1:922729568532:execution:tibanna_zebra_cgap-wolf:run_workflow_granite-qcVCF-af80078e-3d63-4307-b51a-e23ea44ca159",
                "parameters": [
                    {
                        "value": "[{\"parents\": [\"GAPIDUZDOX4R\", \"GAPIDQV37Z5Y\"], \"individual\": \"GAPID43VJKQ6\", \"sample_name\": \"NA12879_sample-WGS\", \"gender\": \"F\"}, {\"parents\": [], \"individual\": \"GAPIDUZDOX4R\", \"sample_name\": \"NA12878_sample-WGS\", \"gender\": \"F\"}, {\"parents\": [], \"individual\": \"GAPIDQV37Z5Y\", \"sample_name\": \"NA12877_sample-WGS\", \"gender\": \"M\"}]",
                        "ordinal": 1,
                        "dimension": "0",
                        "workflow_argument_name": "pedigree"
                    },
                    {
                        "value": "['NA12879_sample-WGS', 'NA12878_sample-WGS', 'NA12877_sample-WGS']",
                        "ordinal": 1,
                        "dimension": "0",
                        "workflow_argument_name": "samples"
                    },
                    {
                        "value": "True",
                        "ordinal": 1,
                        "dimension": "0",
                        "workflow_argument_name": "trio_errors"
                    },
                    {
                        "value": "False",
                        "ordinal": 1,
                        "dimension": "0",
                        "workflow_argument_name": "het_hom"
                    },
                    {
                        "value": "False",
                        "ordinal": 1,
                        "dimension": "0",
                        "workflow_argument_name": "ti_tv"
                    }
                ],
                "run_status": "complete",
                "input_files": [
                    {
                        "value": {
                            "accession": "GAPFI6J5MLR9",
                            "display_title": "GAPFI6J5MLR9.vcf.gz",
                            "href": "/files-processed/GAPFI6J5MLR9/@@download/GAPFI6J5MLR9.vcf.gz",
                            "file_size": 449938897,
                            "uuid": "a6c9f1f0-e52a-4c3b-bc91-047462bf4d88",
                            "@id": "/files-processed/GAPFI6J5MLR9/",
                            "@type": [
                                "FileProcessed",
                                "File",
                                "Item"
                            ],
                            "file_format": {
                                "@id": "/file-formats/vcf_gz/",
                                "uuid": "1b8f525f-aecb-4211-9ae5-a2c998b05599",
                                "status": "shared",
                                "@type": [
                                    "FileFormat",
                                    "Item"
                                ],
                                "display_title": "vcf_gz",
                                "principals_allowed": {
                                    "view": [
                                        "system.Authenticated"
                                    ],
                                    "edit": [
                                        "group.admin"
                                    ]
                                }
                            },
                            "status": "uploaded",
                            "quality_metric": {
                                "status": "shared",
                                "@id": "/quality-metrics-qclist/ede965e7-0c0f-4f7b-b7f8-2d47c2dbe36b/",
                                "overall_quality_status": "PASS",
                                "uuid": "ede965e7-0c0f-4f7b-b7f8-2d47c2dbe36b",
                                "@type": [
                                    "QualityMetricQclist",
                                    "QualityMetric",
                                    "Item"
                                ],
                                "display_title": "QualityMetricQclist from 2022-04-29",
                                "principals_allowed": {
                                    "view": [
                                        "system.Authenticated"
                                    ],
                                    "edit": [
                                        "group.admin"
                                    ]
                                }
                            },
                            "principals_allowed": {
                                "view": [
                                    "editor_for.12a92962-8265-4fc0-b2f8-cf14f05db58b",
                                    "group.admin",
                                    "group.read-only-admin",
                                    "remoteuser.EMBED",
                                    "remoteuser.INDEXER"
                                ],
                                "edit": [
                                    "editor_for.12a92962-8265-4fc0-b2f8-cf14f05db58b",
                                    "group.admin"
                                ]
                            }
                        },
                        "ordinal": 1,
                        "dimension": "0",
                        "workflow_argument_name": "input_vcf"
                    }
                ],
                "institution": {
                    "uuid": "828cd4fe-ebb0-4b36-a94a-d2e3a36cc989",
                    "@type": [
                        "Institution",
                        "Item"
                    ],
                    "@id": "/institutions/hms-dbmi/",
                    "display_title": "HMS DBMI",
                    "status": "current",
                    "principals_allowed": {
                        "view": [
                            "group.admin",
                            "group.read-only-admin",
                            "remoteuser.EMBED",
                            "remoteuser.INDEXER"
                        ],
                        "edit": [
                            "group.admin"
                        ]
                    }
                },
                "awsem_job_id": "M2ezVrAPnQrw",
                "date_created": "2022-04-29T22:10:40.120718+00:00",
                "output_files": [
                    {
                        "type": "Output QC file",
                        "value_qc": {
                            "@type": [
                                "QualityMetricVcfqc",
                                "QualityMetric",
                                "Item"
                            ],
                            "status": "shared",
                            "uuid": "535b02f6-e5ff-4e1b-a4a4-20c2dc135a42",
                            "display_title": "QualityMetricVcfqc from 2022-04-29",
                            "overall_quality_status": "PASS",
                            "@id": "/quality-metrics-vcfqc/535b02f6-e5ff-4e1b-a4a4-20c2dc135a42/",
                            "principals_allowed": {
                                "view": [
                                    "system.Authenticated"
                                ],
                                "edit": [
                                    "group.admin"
                                ]
                            }
                        },
                        "workflow_argument_name": "qc_json"
                    },
                    {
                        "type": "Output QC file",
                        "value_qc": {
                            "@type": [
                                "QualityMetricVcfqc",
                                "QualityMetric",
                                "Item"
                            ],
                            "status": "shared",
                            "uuid": "535b02f6-e5ff-4e1b-a4a4-20c2dc135a42",
                            "display_title": "QualityMetricVcfqc from 2022-04-29",
                            "overall_quality_status": "PASS",
                            "@id": "/quality-metrics-vcfqc/535b02f6-e5ff-4e1b-a4a4-20c2dc135a42/",
                            "principals_allowed": {
                                "view": [
                                    "system.Authenticated"
                                ],
                                "edit": [
                                    "group.admin"
                                ]
                            }
                        },
                        "workflow_argument_name": "uniq_variants"
                    }
                ],
                "run_platform": "AWSEM",
                "submitted_by": {
                    "@type": [
                        "User",
                        "Item"
                    ],
                    "status": "current",
                    "@id": "/users/b041dba8-e2b2-4e54-a621-97edb508a0c4/",
                    "display_title": "Tibanna App",
                    "uuid": "b041dba8-e2b2-4e54-a621-97edb508a0c4",
                    "principals_allowed": {
                        "view": [
                            "group.admin",
                            "remoteuser.EMBED",
                            "remoteuser.INDEXER",
                            "userid.b041dba8-e2b2-4e54-a621-97edb508a0c4"
                        ],
                        "edit": [
                            "group.admin"
                        ]
                    }
                },
                "last_modified": {
                    "modified_by": {
                        "@id": "/users/7677f8a8-79d2-4cff-ab0a-a967a2a68e39/",
                        "uuid": "7677f8a8-79d2-4cff-ab0a-a967a2a68e39",
                        "display_title": "Foursight App",
                        "@type": [
                            "User",
                            "Item"
                        ],
                        "status": "current",
                        "principals_allowed": {
                            "view": [
                                "group.admin",
                                "remoteuser.EMBED",
                                "remoteuser.INDEXER",
                                "userid.7677f8a8-79d2-4cff-ab0a-a967a2a68e39"
                            ],
                            "edit": [
                                "group.admin"
                            ]
                        }
                    },
                    "date_modified": "2022-04-30T10:00:30.320981+00:00"
                },
                "metadata_only": false,
                "awsem_app_name": "workflow_granite-qcVCF",
                "quality_metric": {
                    "status": "shared",
                    "uuid": "a60b9b81-2535-4e0d-9eab-9c3288a1daa5",
                    "display_title": "QualityMetricWorkflowrun from 2022-04-29",
                    "@type": [
                        "QualityMetricWorkflowrun",
                        "QualityMetric",
                        "Item"
                    ],
                    "@id": "/quality-metrics-workflowrun/a60b9b81-2535-4e0d-9eab-9c3288a1daa5/",
                    "principals_allowed": {
                        "view": [
                            "system.Authenticated"
                        ],
                        "edit": [
                            "group.admin"
                        ]
                    }
                },
                "schema_version": "3",
                "awsem_postrun_json": "https://s3.amazonaws.com/cgap-biotest-main-application-tibanna-output/M2ezVrAPnQrw.postrun.json",
                "associated_meta_workflow_runs": [
                    "a77b8431-2936-4f87-8405-8aa43ee777c1"
                ],
                "@id": "/workflow-runs-awsem/bf1f8c90-5f99-435f-85c9-52ac471de600/",
                "@type": [
                    "WorkflowRunAwsem",
                    "WorkflowRun",
                    "Item"
                ],
                "uuid": "bf1f8c90-5f99-435f-85c9-52ac471de600",
                "principals_allowed": {
                    "view": [
                        "system.Authenticated"
                    ],
                    "edit": [
                        "group.admin"
                    ]
                },
                "display_title": "workflow_granite-qcVCF v1.0.0 run 2022-04-29 22:10:39.971610",
                "@context": "/terms/",
                "actions": [
                    {
                        "name": "create",
                        "title": "Create",
                        "profile": "/profiles/WorkflowRunAwsem.json",
                        "href": "/workflow-runs-awsem/bf1f8c90-5f99-435f-85c9-52ac471de600/?currentAction=create"
                    },
                    {
                        "name": "edit",
                        "title": "Edit",
                        "profile": "/profiles/WorkflowRunAwsem.json",
                        "href": "/workflow-runs-awsem/bf1f8c90-5f99-435f-85c9-52ac471de600/?currentAction=edit"
                    }
                ]
            }
        },
        {
            "name": "workflow_granite-qcVCF-1",
            "jobid": "R5varE174wYQ",
            "shard": "0",
            "status": "completed",
            "dependencies": [
                "workflow_samplegeno:0"
            ],
            "workflow_run": {
                "title": "workflow_granite-qcVCF v1.0.0 run 2022-04-29 22:40:34.865115",
                "status": "shared",
                "project": {
                    "uuid": "12a92962-8265-4fc0-b2f8-cf14f05db58b",
                    "status": "shared",
                    "@type": [
                        "Project",
                        "Item"
                    ],
                    "display_title": "CGAP Core",
                    "@id": "/projects/cgap-core/",
                    "principals_allowed": {
                        "view": [
                            "system.Authenticated"
                        ],
                        "edit": [
                            "group.admin"
                        ]
                    }
                },
                "run_url": "https://console.aws.amazon.com/states/home?region=us-east-1#/executions/details/arn:aws:states:us-east-1:922729568532:execution:tibanna_zebra_cgap-wolf:run_workflow_granite-qcVCF-49702425-3a9d-46fb-b31c-9218ba4a4941",
                "parameters": [
                    {
                        "value": "[{\"parents\": [\"GAPIDUZDOX4R\", \"GAPIDQV37Z5Y\"], \"individual\": \"GAPID43VJKQ6\", \"sample_name\": \"NA12879_sample-WGS\", \"gender\": \"F\"}, {\"parents\": [], \"individual\": \"GAPIDUZDOX4R\", \"sample_name\": \"NA12878_sample-WGS\", \"gender\": \"F\"}, {\"parents\": [], \"individual\": \"GAPIDQV37Z5Y\", \"sample_name\": \"NA12877_sample-WGS\", \"gender\": \"M\"}]",
                        "ordinal": 1,
                        "dimension": "0",
                        "workflow_argument_name": "pedigree"
                    },
                    {
                        "value": "['NA12879_sample-WGS', 'NA12878_sample-WGS', 'NA12877_sample-WGS']",
                        "ordinal": 1,
                        "dimension": "0",
                        "workflow_argument_name": "samples"
                    },
                    {
                        "value": "True",
                        "ordinal": 1,
                        "dimension": "0",
                        "workflow_argument_name": "trio_errors"
                    },
                    {
                        "value": "False",
                        "ordinal": 1,
                        "dimension": "0",
                        "workflow_argument_name": "het_hom"
                    },
                    {
                        "value": "False",
                        "ordinal": 1,
                        "dimension": "0",
                        "workflow_argument_name": "ti_tv"
                    }
                ],
                "run_status": "complete",
                "input_files": [
                    {
                        "value": {
                            "uuid": "56c0a779-c771-4a67-acce-f7bbc2707d6e",
                            "href": "/files-processed/GAPFI68EKBY2/@@download/GAPFI68EKBY2.vcf.gz",
                            "@id": "/files-processed/GAPFI68EKBY2/",
                            "accession": "GAPFI68EKBY2",
                            "display_title": "GAPFI68EKBY2.vcf.gz",
                            "file_size": 565028521,
                            "@type": [
                                "FileProcessed",
                                "File",
                                "Item"
                            ],
                            "status": "uploaded",
                            "file_format": {
                                "uuid": "1b8f525f-aecb-4211-9ae5-a2c998b05599",
                                "status": "shared",
                                "@id": "/file-formats/vcf_gz/",
                                "display_title": "vcf_gz",
                                "@type": [
                                    "FileFormat",
                                    "Item"
                                ],
                                "principals_allowed": {
                                    "view": [
                                        "system.Authenticated"
                                    ],
                                    "edit": [
                                        "group.admin"
                                    ]
                                }
                            },
                            "quality_metric": {
                                "display_title": "QualityMetricVcfqc from 2022-04-29",
                                "@type": [
                                    "QualityMetricVcfqc",
                                    "QualityMetric",
                                    "Item"
                                ],
                                "uuid": "367b0795-c6f2-4ce3-85e2-b63f4d1b1b4a",
                                "@id": "/quality-metrics-vcfqc/367b0795-c6f2-4ce3-85e2-b63f4d1b1b4a/",
                                "status": "shared",
                                "overall_quality_status": "PASS",
                                "principals_allowed": {
                                    "view": [
                                        "system.Authenticated"
                                    ],
                                    "edit": [
                                        "group.admin"
                                    ]
                                }
                            },
                            "principals_allowed": {
                                "view": [
                                    "editor_for.12a92962-8265-4fc0-b2f8-cf14f05db58b",
                                    "group.admin",
                                    "group.read-only-admin",
                                    "remoteuser.EMBED",
                                    "remoteuser.INDEXER"
                                ],
                                "edit": [
                                    "editor_for.12a92962-8265-4fc0-b2f8-cf14f05db58b",
                                    "group.admin"
                                ]
                            }
                        },
                        "ordinal": 1,
                        "dimension": "0",
                        "workflow_argument_name": "input_vcf"
                    }
                ],
                "institution": {
                    "status": "current",
                    "uuid": "828cd4fe-ebb0-4b36-a94a-d2e3a36cc989",
                    "@id": "/institutions/hms-dbmi/",
                    "@type": [
                        "Institution",
                        "Item"
                    ],
                    "display_title": "HMS DBMI",
                    "principals_allowed": {
                        "view": [
                            "group.admin",
                            "group.read-only-admin",
                            "remoteuser.EMBED",
                            "remoteuser.INDEXER"
                        ],
                        "edit": [
                            "group.admin"
                        ]
                    }
                },
                "awsem_job_id": "R5varE174wYQ",
                "date_created": "2022-04-29T22:40:34.941317+00:00",
                "output_files": [
                    {
                        "type": "Output QC file",
                        "value_qc": {
                            "status": "shared",
                            "display_title": "QualityMetricVcfqc from 2022-04-29",
                            "@type": [
                                "QualityMetricVcfqc",
                                "QualityMetric",
                                "Item"
                            ],
                            "overall_quality_status": "PASS",
                            "@id": "/quality-metrics-vcfqc/367b0795-c6f2-4ce3-85e2-b63f4d1b1b4a/",
                            "uuid": "367b0795-c6f2-4ce3-85e2-b63f4d1b1b4a",
                            "principals_allowed": {
                                "view": [
                                    "system.Authenticated"
                                ],
                                "edit": [
                                    "group.admin"
                                ]
                            }
                        },
                        "workflow_argument_name": "qc_json"
                    },
                    {
                        "type": "Output QC file",
                        "value_qc": {
                            "status": "shared",
                            "display_title": "QualityMetricVcfqc from 2022-04-29",
                            "@type": [
                                "QualityMetricVcfqc",
                                "QualityMetric",
                                "Item"
                            ],
                            "overall_quality_status": "PASS",
                            "@id": "/quality-metrics-vcfqc/367b0795-c6f2-4ce3-85e2-b63f4d1b1b4a/",
                            "uuid": "367b0795-c6f2-4ce3-85e2-b63f4d1b1b4a",
                            "principals_allowed": {
                                "view": [
                                    "system.Authenticated"
                                ],
                                "edit": [
                                    "group.admin"
                                ]
                            }
                        },
                        "workflow_argument_name": "uniq_variants"
                    }
                ],
                "run_platform": "AWSEM",
                "submitted_by": {
                    "display_title": "Tibanna App",
                    "@type": [
                        "User",
                        "Item"
                    ],
                    "status": "current",
                    "uuid": "b041dba8-e2b2-4e54-a621-97edb508a0c4",
                    "@id": "/users/b041dba8-e2b2-4e54-a621-97edb508a0c4/",
                    "principals_allowed": {
                        "view": [
                            "group.admin",
                            "remoteuser.EMBED",
                            "remoteuser.INDEXER",
                            "userid.b041dba8-e2b2-4e54-a621-97edb508a0c4"
                        ],
                        "edit": [
                            "group.admin"
                        ]
                    }
                },
                "last_modified": {
                    "modified_by": {
                        "display_title": "Foursight App",
                        "status": "current",
                        "@type": [
                            "User",
                            "Item"
                        ],
                        "@id": "/users/7677f8a8-79d2-4cff-ab0a-a967a2a68e39/",
                        "uuid": "7677f8a8-79d2-4cff-ab0a-a967a2a68e39",
                        "principals_allowed": {
                            "view": [
                                "group.admin",
                                "remoteuser.EMBED",
                                "remoteuser.INDEXER",
                                "userid.7677f8a8-79d2-4cff-ab0a-a967a2a68e39"
                            ],
                            "edit": [
                                "group.admin"
                            ]
                        }
                    },
                    "date_modified": "2022-04-30T10:00:30.093090+00:00"
                },
                "metadata_only": false,
                "awsem_app_name": "workflow_granite-qcVCF",
                "quality_metric": {
                    "uuid": "5c4d54a5-01f8-4f21-adc4-40b3e5afc2c7",
                    "display_title": "QualityMetricWorkflowrun from 2022-04-29",
                    "@id": "/quality-metrics-workflowrun/5c4d54a5-01f8-4f21-adc4-40b3e5afc2c7/",
                    "@type": [
                        "QualityMetricWorkflowrun",
                        "QualityMetric",
                        "Item"
                    ],
                    "status": "shared",
                    "principals_allowed": {
                        "view": [
                            "system.Authenticated"
                        ],
                        "edit": [
                            "group.admin"
                        ]
                    }
                },
                "schema_version": "3",
                "awsem_postrun_json": "https://s3.amazonaws.com/cgap-biotest-main-application-tibanna-output/R5varE174wYQ.postrun.json",
                "associated_meta_workflow_runs": [
                    "a77b8431-2936-4f87-8405-8aa43ee777c1"
                ],
                "@id": "/workflow-runs-awsem/856f03f2-c89b-4291-94a0-6aa036673de0/",
                "@type": [
                    "WorkflowRunAwsem",
                    "WorkflowRun",
                    "Item"
                ],
                "uuid": "856f03f2-c89b-4291-94a0-6aa036673de0",
                "principals_allowed": {
                    "view": [
                        "system.Authenticated"
                    ],
                    "edit": [
                        "group.admin"
                    ]
                },
                "display_title": "workflow_granite-qcVCF v1.0.0 run 2022-04-29 22:40:34.865115",
                "@context": "/terms/",
                "actions": [
                    {
                        "name": "create",
                        "title": "Create",
                        "profile": "/profiles/WorkflowRunAwsem.json",
                        "href": "/workflow-runs-awsem/856f03f2-c89b-4291-94a0-6aa036673de0/?currentAction=create"
                    },
                    {
                        "name": "edit",
                        "title": "Edit",
                        "profile": "/profiles/WorkflowRunAwsem.json",
                        "href": "/workflow-runs-awsem/856f03f2-c89b-4291-94a0-6aa036673de0/?currentAction=edit"
                    }
                ]
            }
        },
        {
            "name": "workflow_vep-annot-check",
            "jobid": "QfIHwC079y92",
            "shard": "0",
            "output": [
                {
                    "file": {
                        "display_title": "GAPFIACVY8U8.vcf.gz",
                        "status": "uploaded",
                        "@id": "/files-processed/GAPFIACVY8U8/",
                        "uuid": "a7809e79-b980-4b7f-9e43-1c2a60959246",
                        "@type": [
                            "FileProcessed",
                            "File",
                            "Item"
                        ],
                        "principals_allowed": {
                            "view": [
                                "editor_for.12a92962-8265-4fc0-b2f8-cf14f05db58b",
                                "group.admin",
                                "group.read-only-admin",
                                "remoteuser.EMBED",
                                "remoteuser.INDEXER"
                            ],
                            "edit": [
                                "editor_for.12a92962-8265-4fc0-b2f8-cf14f05db58b",
                                "group.admin"
                            ]
                        }
                    },
                    "argument_name": "annotated_vcf"
                }
            ],
            "status": "completed",
            "dependencies": [
                "workflow_samplegeno:0"
            ],
            "workflow_run": {
                "title": "workflow_vep-annot-check v1.0.0 run 2022-04-29 22:40:46.334063",
                "status": "shared",
                "project": {
                    "uuid": "12a92962-8265-4fc0-b2f8-cf14f05db58b",
                    "@type": [
                        "Project",
                        "Item"
                    ],
                    "status": "shared",
                    "display_title": "CGAP Core",
                    "@id": "/projects/cgap-core/",
                    "principals_allowed": {
                        "view": [
                            "system.Authenticated"
                        ],
                        "edit": [
                            "group.admin"
                        ]
                    }
                },
                "run_url": "https://console.aws.amazon.com/states/home?region=us-east-1#/executions/details/arn:aws:states:us-east-1:922729568532:execution:tibanna_zebra_cgap-wolf:run_workflow_vep-annot-check-61028515-6112-43fe-992a-3f58bd5ce645",
                "parameters": [
                    {
                        "value": "72",
                        "ordinal": 1,
                        "dimension": "0",
                        "workflow_argument_name": "nthreads"
                    }
                ],
                "run_status": "complete",
                "input_files": [
                    {
                        "value": {
                            "href": "/files-processed/GAPFI68EKBY2/@@download/GAPFI68EKBY2.vcf.gz",
                            "file_format": {
                                "uuid": "1b8f525f-aecb-4211-9ae5-a2c998b05599",
                                "@type": [
                                    "FileFormat",
                                    "Item"
                                ],
                                "@id": "/file-formats/vcf_gz/",
                                "status": "shared",
                                "display_title": "vcf_gz",
                                "principals_allowed": {
                                    "view": [
                                        "system.Authenticated"
                                    ],
                                    "edit": [
                                        "group.admin"
                                    ]
                                }
                            },
                            "status": "uploaded",
                            "display_title": "GAPFI68EKBY2.vcf.gz",
                            "@id": "/files-processed/GAPFI68EKBY2/",
                            "uuid": "56c0a779-c771-4a67-acce-f7bbc2707d6e",
                            "@type": [
                                "FileProcessed",
                                "File",
                                "Item"
                            ],
                            "file_size": 565028521,
                            "accession": "GAPFI68EKBY2",
                            "quality_metric": {
                                "overall_quality_status": "PASS",
                                "@type": [
                                    "QualityMetricVcfqc",
                                    "QualityMetric",
                                    "Item"
                                ],
                                "status": "shared",
                                "display_title": "QualityMetricVcfqc from 2022-04-29",
                                "uuid": "367b0795-c6f2-4ce3-85e2-b63f4d1b1b4a",
                                "@id": "/quality-metrics-vcfqc/367b0795-c6f2-4ce3-85e2-b63f4d1b1b4a/",
                                "principals_allowed": {
                                    "view": [
                                        "system.Authenticated"
                                    ],
                                    "edit": [
                                        "group.admin"
                                    ]
                                }
                            },
                            "principals_allowed": {
                                "view": [
                                    "editor_for.12a92962-8265-4fc0-b2f8-cf14f05db58b",
                                    "group.admin",
                                    "group.read-only-admin",
                                    "remoteuser.EMBED",
                                    "remoteuser.INDEXER"
                                ],
                                "edit": [
                                    "editor_for.12a92962-8265-4fc0-b2f8-cf14f05db58b",
                                    "group.admin"
                                ]
                            }
                        },
                        "ordinal": 1,
                        "dimension": "0",
                        "workflow_argument_name": "input_vcf"
                    },
                    {
                        "value": {
                            "href": "/files-reference/GAPFIXRDPDK5/@@download/GAPFIXRDPDK5.fa",
                            "file_format": {
                                "uuid": "5ced774b-a73e-4d1b-8186-d7fbbde7a3c2",
                                "@type": [
                                    "FileFormat",
                                    "Item"
                                ],
                                "@id": "/file-formats/fa/",
                                "status": "shared",
                                "display_title": "fa",
                                "principals_allowed": {
                                    "view": [
                                        "system.Authenticated"
                                    ],
                                    "edit": [
                                        "group.admin"
                                    ]
                                }
                            },
                            "status": "uploaded",
                            "display_title": "GAPFIXRDPDK5.fa",
                            "@id": "/files-reference/GAPFIXRDPDK5/",
                            "uuid": "1936f246-22e1-45dc-bb5c-9cfd55537fe7",
                            "@type": [
                                "FileReference",
                                "File",
                                "Item"
                            ],
                            "file_size": 3263683042,
                            "accession": "GAPFIXRDPDK5",
                            "principals_allowed": {
                                "view": [
                                    "editor_for.12a92962-8265-4fc0-b2f8-cf14f05db58b",
                                    "group.admin",
                                    "group.read-only-admin",
                                    "remoteuser.EMBED",
                                    "remoteuser.INDEXER"
                                ],
                                "edit": [
                                    "editor_for.12a92962-8265-4fc0-b2f8-cf14f05db58b",
                                    "group.admin"
                                ]
                            }
                        },
                        "ordinal": 1,
                        "dimension": "0",
                        "workflow_argument_name": "reference"
                    },
                    {
                        "value": {
                            "href": "/files-reference/GAPFIBGEOI72/@@download/GAPFIBGEOI72.txt",
                            "file_format": {
                                "uuid": "0cd4e777-a596-4927-95c8-b07716121aa3",
                                "@type": [
                                    "FileFormat",
                                    "Item"
                                ],
                                "@id": "/file-formats/txt/",
                                "status": "shared",
                                "display_title": "txt",
                                "principals_allowed": {
                                    "view": [
                                        "system.Authenticated"
                                    ],
                                    "edit": [
                                        "group.admin"
                                    ]
                                }
                            },
                            "status": "uploaded",
                            "display_title": "GAPFIBGEOI72.txt",
                            "@id": "/files-reference/GAPFIBGEOI72/",
                            "uuid": "1c07a3aa-e2a3-498c-b838-15991c4a2f28",
                            "@type": [
                                "FileReference",
                                "File",
                                "Item"
                            ],
                            "file_size": 7603,
                            "accession": "GAPFIBGEOI72",
                            "principals_allowed": {
                                "view": [
                                    "editor_for.12a92962-8265-4fc0-b2f8-cf14f05db58b",
                                    "group.admin",
                                    "group.read-only-admin",
                                    "remoteuser.EMBED",
                                    "remoteuser.INDEXER"
                                ],
                                "edit": [
                                    "editor_for.12a92962-8265-4fc0-b2f8-cf14f05db58b",
                                    "group.admin"
                                ]
                            }
                        },
                        "ordinal": 1,
                        "dimension": "0",
                        "workflow_argument_name": "regions"
                    },
                    {
                        "value": {
                            "href": "/files-reference/GAPFIL8XMTIV/@@download/GAPFIL8XMTIV.vep.tar.gz",
                            "file_format": {
                                "uuid": "d05f9688-0ee1-4a86-83f4-656e6e21352a",
                                "@type": [
                                    "FileFormat",
                                    "Item"
                                ],
                                "@id": "/file-formats/vep_tar/",
                                "status": "shared",
                                "display_title": "vep_tar",
                                "principals_allowed": {
                                    "view": [
                                        "system.Authenticated"
                                    ],
                                    "edit": [
                                        "group.admin"
                                    ]
                                }
                            },
                            "status": "uploaded",
                            "display_title": "GAPFIL8XMTIV.vep.tar.gz",
                            "@id": "/files-reference/GAPFIL8XMTIV/",
                            "uuid": "ea103486-b65a-4439-9d0b-1186f8e59388",
                            "@type": [
                                "FileReference",
                                "File",
                                "Item"
                            ],
                            "file_size": 14459657412,
                            "accession": "GAPFIL8XMTIV",
                            "principals_allowed": {
                                "view": [
                                    "editor_for.12a92962-8265-4fc0-b2f8-cf14f05db58b",
                                    "group.admin",
                                    "group.read-only-admin",
                                    "remoteuser.EMBED",
                                    "remoteuser.INDEXER"
                                ],
                                "edit": [
                                    "editor_for.12a92962-8265-4fc0-b2f8-cf14f05db58b",
                                    "group.admin"
                                ]
                            }
                        },
                        "ordinal": 1,
                        "dimension": "0",
                        "workflow_argument_name": "vep"
                    },
                    {
                        "value": {
                            "href": "/files-reference/GAPFI121RWQE/@@download/GAPFI121RWQE.vcf.gz",
                            "file_format": {
                                "uuid": "1b8f525f-aecb-4211-9ae5-a2c998b05599",
                                "@type": [
                                    "FileFormat",
                                    "Item"
                                ],
                                "@id": "/file-formats/vcf_gz/",
                                "status": "shared",
                                "display_title": "vcf_gz",
                                "principals_allowed": {
                                    "view": [
                                        "system.Authenticated"
                                    ],
                                    "edit": [
                                        "group.admin"
                                    ]
                                }
                            },
                            "status": "uploaded",
                            "display_title": "GAPFI121RWQE.vcf.gz",
                            "@id": "/files-reference/GAPFI121RWQE/",
                            "uuid": "7db786d5-13d2-4622-bdd2-99866036b9b9",
                            "@type": [
                                "FileReference",
                                "File",
                                "Item"
                            ],
                            "file_size": 34029026,
                            "accession": "GAPFI121RWQE",
                            "principals_allowed": {
                                "view": [
                                    "editor_for.12a92962-8265-4fc0-b2f8-cf14f05db58b",
                                    "group.admin",
                                    "group.read-only-admin",
                                    "remoteuser.EMBED",
                                    "remoteuser.INDEXER"
                                ],
                                "edit": [
                                    "editor_for.12a92962-8265-4fc0-b2f8-cf14f05db58b",
                                    "group.admin"
                                ]
                            }
                        },
                        "ordinal": 1,
                        "dimension": "0",
                        "workflow_argument_name": "clinvar"
                    },
                    {
                        "value": {
                            "href": "/files-reference/GAPFIKJ66FKY/@@download/GAPFIKJ66FKY.dbnsfp.gz",
                            "file_format": {
                                "uuid": "65a2cca2-dae8-4ff2-ac8b-aa1e92f5416b",
                                "@type": [
                                    "FileFormat",
                                    "Item"
                                ],
                                "@id": "/file-formats/dbnsfp_gz/",
                                "status": "shared",
                                "display_title": "dbnsfp_gz",
                                "principals_allowed": {
                                    "view": [
                                        "system.Authenticated"
                                    ],
                                    "edit": [
                                        "group.admin"
                                    ]
                                }
                            },
                            "status": "uploaded",
                            "display_title": "GAPFIKJ66FKY.dbnsfp.gz",
                            "@id": "/files-reference/GAPFIKJ66FKY/",
                            "uuid": "dc02df4c-49ac-4532-b85c-02800941aa44",
                            "@type": [
                                "FileReference",
                                "File",
                                "Item"
                            ],
                            "file_size": 32749109158,
                            "accession": "GAPFIKJ66FKY",
                            "principals_allowed": {
                                "view": [
                                    "editor_for.12a92962-8265-4fc0-b2f8-cf14f05db58b",
                                    "group.admin",
                                    "group.read-only-admin",
                                    "remoteuser.EMBED",
                                    "remoteuser.INDEXER"
                                ],
                                "edit": [
                                    "editor_for.12a92962-8265-4fc0-b2f8-cf14f05db58b",
                                    "group.admin"
                                ]
                            }
                        },
                        "ordinal": 1,
                        "dimension": "0",
                        "workflow_argument_name": "dbnsfp"
                    },
                    {
                        "value": {
                            "href": "/files-reference/GAPFI6BNNTKA/@@download/GAPFI6BNNTKA.tar.gz",
                            "file_format": {
                                "uuid": "f2ec3b9f-a898-4e6c-8da5-734a7a6410b8",
                                "@type": [
                                    "FileFormat",
                                    "Item"
                                ],
                                "@id": "/file-formats/tar_gz/",
                                "status": "shared",
                                "display_title": "tar_gz",
                                "principals_allowed": {
                                    "view": [
                                        "system.Authenticated"
                                    ],
                                    "edit": [
                                        "group.admin"
                                    ]
                                }
                            },
                            "status": "uploaded",
                            "display_title": "GAPFI6BNNTKA.tar.gz",
                            "@id": "/files-reference/GAPFI6BNNTKA/",
                            "uuid": "71a7d16b-8452-4266-ae80-bbede2e305e2",
                            "@type": [
                                "FileReference",
                                "File",
                                "Item"
                            ],
                            "file_size": 1505157,
                            "accession": "GAPFI6BNNTKA",
                            "principals_allowed": {
                                "view": [
                                    "editor_for.12a92962-8265-4fc0-b2f8-cf14f05db58b",
                                    "group.admin",
                                    "group.read-only-admin",
                                    "remoteuser.EMBED",
                                    "remoteuser.INDEXER"
                                ],
                                "edit": [
                                    "editor_for.12a92962-8265-4fc0-b2f8-cf14f05db58b",
                                    "group.admin"
                                ]
                            }
                        },
                        "ordinal": 1,
                        "dimension": "0",
                        "workflow_argument_name": "maxent"
                    },
                    {
                        "value": {
                            "href": "/files-reference/GAPFISUOC64Q/@@download/GAPFISUOC64Q.vcf.gz",
                            "file_format": {
                                "uuid": "1b8f525f-aecb-4211-9ae5-a2c998b05599",
                                "@type": [
                                    "FileFormat",
                                    "Item"
                                ],
                                "@id": "/file-formats/vcf_gz/",
                                "status": "shared",
                                "display_title": "vcf_gz",
                                "principals_allowed": {
                                    "view": [
                                        "system.Authenticated"
                                    ],
                                    "edit": [
                                        "group.admin"
                                    ]
                                }
                            },
                            "status": "uploaded",
                            "display_title": "GAPFISUOC64Q.vcf.gz",
                            "@id": "/files-reference/GAPFISUOC64Q/",
                            "uuid": "a35e580c-7579-4312-a3a1-66810e6d9366",
                            "@type": [
                                "FileReference",
                                "File",
                                "Item"
                            ],
                            "file_size": 28829788377,
                            "accession": "GAPFISUOC64Q",
                            "principals_allowed": {
                                "view": [
                                    "editor_for.12a92962-8265-4fc0-b2f8-cf14f05db58b",
                                    "group.admin",
                                    "group.read-only-admin",
                                    "remoteuser.EMBED",
                                    "remoteuser.INDEXER"
                                ],
                                "edit": [
                                    "editor_for.12a92962-8265-4fc0-b2f8-cf14f05db58b",
                                    "group.admin"
                                ]
                            }
                        },
                        "ordinal": 1,
                        "dimension": "0",
                        "workflow_argument_name": "spliceai_snv"
                    },
                    {
                        "value": {
                            "href": "/files-reference/GAPFIZOPCWIU/@@download/GAPFIZOPCWIU.vcf.gz",
                            "file_format": {
                                "uuid": "1b8f525f-aecb-4211-9ae5-a2c998b05599",
                                "@type": [
                                    "FileFormat",
                                    "Item"
                                ],
                                "@id": "/file-formats/vcf_gz/",
                                "status": "shared",
                                "display_title": "vcf_gz",
                                "principals_allowed": {
                                    "view": [
                                        "system.Authenticated"
                                    ],
                                    "edit": [
                                        "group.admin"
                                    ]
                                }
                            },
                            "status": "uploaded",
                            "display_title": "GAPFIZOPCWIU.vcf.gz",
                            "@id": "/files-reference/GAPFIZOPCWIU/",
                            "uuid": "3b7c0c29-5ee2-47c8-95a8-d28e15d5de47",
                            "@type": [
                                "FileReference",
                                "File",
                                "Item"
                            ],
                            "file_size": 69322106029,
                            "accession": "GAPFIZOPCWIU",
                            "principals_allowed": {
                                "view": [
                                    "editor_for.12a92962-8265-4fc0-b2f8-cf14f05db58b",
                                    "group.admin",
                                    "group.read-only-admin",
                                    "remoteuser.EMBED",
                                    "remoteuser.INDEXER"
                                ],
                                "edit": [
                                    "editor_for.12a92962-8265-4fc0-b2f8-cf14f05db58b",
                                    "group.admin"
                                ]
                            }
                        },
                        "ordinal": 1,
                        "dimension": "0",
                        "workflow_argument_name": "spliceai_indel"
                    },
                    {
                        "value": {
                            "href": "/files-reference/GAPFIJOMA2Q8/@@download/GAPFIJOMA2Q8.vcf.gz",
                            "file_format": {
                                "uuid": "1b8f525f-aecb-4211-9ae5-a2c998b05599",
                                "@type": [
                                    "FileFormat",
                                    "Item"
                                ],
                                "@id": "/file-formats/vcf_gz/",
                                "status": "shared",
                                "display_title": "vcf_gz",
                                "principals_allowed": {
                                    "view": [
                                        "system.Authenticated"
                                    ],
                                    "edit": [
                                        "group.admin"
                                    ]
                                }
                            },
                            "status": "uploaded",
                            "display_title": "GAPFIJOMA2Q8.vcf.gz",
                            "@id": "/files-reference/GAPFIJOMA2Q8/",
                            "uuid": "52c6cbf6-ae94-4c10-ad03-26ed34f74a3e",
                            "@type": [
                                "FileReference",
                                "File",
                                "Item"
                            ],
                            "file_size": 56752948861,
                            "accession": "GAPFIJOMA2Q8",
                            "principals_allowed": {
                                "view": [
                                    "editor_for.12a92962-8265-4fc0-b2f8-cf14f05db58b",
                                    "group.admin",
                                    "group.read-only-admin",
                                    "remoteuser.EMBED",
                                    "remoteuser.INDEXER"
                                ],
                                "edit": [
                                    "editor_for.12a92962-8265-4fc0-b2f8-cf14f05db58b",
                                    "group.admin"
                                ]
                            }
                        },
                        "ordinal": 1,
                        "dimension": "0",
                        "workflow_argument_name": "gnomad"
                    },
                    {
                        "value": {
                            "href": "/files-reference/GAPFIC5416E6/@@download/GAPFIC5416E6.vcf.gz",
                            "file_format": {
                                "uuid": "1b8f525f-aecb-4211-9ae5-a2c998b05599",
                                "@type": [
                                    "FileFormat",
                                    "Item"
                                ],
                                "@id": "/file-formats/vcf_gz/",
                                "status": "shared",
                                "display_title": "vcf_gz",
                                "principals_allowed": {
                                    "view": [
                                        "system.Authenticated"
                                    ],
                                    "edit": [
                                        "group.admin"
                                    ]
                                }
                            },
                            "status": "uploaded",
                            "display_title": "GAPFIC5416E6.vcf.gz",
                            "@id": "/files-reference/GAPFIC5416E6/",
                            "uuid": "dd6f0384-d0b5-47d6-99a8-395c0b72feed",
                            "@type": [
                                "FileReference",
                                "File",
                                "Item"
                            ],
                            "file_size": 1461686984,
                            "accession": "GAPFIC5416E6",
                            "principals_allowed": {
                                "view": [
                                    "editor_for.12a92962-8265-4fc0-b2f8-cf14f05db58b",
                                    "group.admin",
                                    "group.read-only-admin",
                                    "remoteuser.EMBED",
                                    "remoteuser.INDEXER"
                                ],
                                "edit": [
                                    "editor_for.12a92962-8265-4fc0-b2f8-cf14f05db58b",
                                    "group.admin"
                                ]
                            }
                        },
                        "ordinal": 1,
                        "dimension": "0",
                        "workflow_argument_name": "gnomad2"
                    },
                    {
                        "value": {
                            "href": "/files-reference/GAPFI566QQCV/@@download/GAPFI566QQCV.tsv.gz",
                            "file_format": {
                                "uuid": "11ca3783-db6e-430e-997b-9cf0ca275814",
                                "@type": [
                                    "FileFormat",
                                    "Item"
                                ],
                                "@id": "/file-formats/tsv_gz/",
                                "status": "shared",
                                "display_title": "tsv_gz",
                                "principals_allowed": {
                                    "view": [
                                        "system.Authenticated"
                                    ],
                                    "edit": [
                                        "group.admin"
                                    ]
                                }
                            },
                            "status": "uploaded",
                            "display_title": "GAPFI566QQCV.tsv.gz",
                            "@id": "/files-reference/GAPFI566QQCV/",
                            "uuid": "672de47f-d058-4dbd-9fc4-3e134cfe71d8",
                            "@type": [
                                "FileReference",
                                "File",
                                "Item"
                            ],
                            "file_size": 86592987071,
                            "accession": "GAPFI566QQCV",
                            "principals_allowed": {
                                "view": [
                                    "editor_for.12a92962-8265-4fc0-b2f8-cf14f05db58b",
                                    "group.admin",
                                    "group.read-only-admin",
                                    "remoteuser.EMBED",
                                    "remoteuser.INDEXER"
                                ],
                                "edit": [
                                    "editor_for.12a92962-8265-4fc0-b2f8-cf14f05db58b",
                                    "group.admin"
                                ]
                            }
                        },
                        "ordinal": 1,
                        "dimension": "0",
                        "workflow_argument_name": "CADD_snv"
                    },
                    {
                        "value": {
                            "href": "/files-reference/GAPFI1GC6AXF/@@download/GAPFI1GC6AXF.tsv.gz",
                            "file_format": {
                                "uuid": "11ca3783-db6e-430e-997b-9cf0ca275814",
                                "@type": [
                                    "FileFormat",
                                    "Item"
                                ],
                                "@id": "/file-formats/tsv_gz/",
                                "status": "shared",
                                "display_title": "tsv_gz",
                                "principals_allowed": {
                                    "view": [
                                        "system.Authenticated"
                                    ],
                                    "edit": [
                                        "group.admin"
                                    ]
                                }
                            },
                            "status": "uploaded",
                            "display_title": "GAPFI1GC6AXF.tsv.gz",
                            "@id": "/files-reference/GAPFI1GC6AXF/",
                            "uuid": "b9f123dd-be05-4a14-957a-5e1e5a5ce254",
                            "@type": [
                                "FileReference",
                                "File",
                                "Item"
                            ],
                            "file_size": 1165363333,
                            "accession": "GAPFI1GC6AXF",
                            "principals_allowed": {
                                "view": [
                                    "editor_for.12a92962-8265-4fc0-b2f8-cf14f05db58b",
                                    "group.admin",
                                    "group.read-only-admin",
                                    "remoteuser.EMBED",
                                    "remoteuser.INDEXER"
                                ],
                                "edit": [
                                    "editor_for.12a92962-8265-4fc0-b2f8-cf14f05db58b",
                                    "group.admin"
                                ]
                            }
                        },
                        "ordinal": 1,
                        "dimension": "0",
                        "workflow_argument_name": "CADD_indel"
                    },
                    {
                        "value": {
                            "href": "/files-reference/GAPFIMQ7MHGA/@@download/GAPFIMQ7MHGA.bw",
                            "file_format": {
                                "uuid": "33f30c42-d582-4163-af44-fecf586b9dd3",
                                "@type": [
                                    "FileFormat",
                                    "Item"
                                ],
                                "@id": "/file-formats/BigWig/",
                                "status": "shared",
                                "display_title": "BigWig",
                                "principals_allowed": {
                                    "view": [
                                        "system.Authenticated"
                                    ],
                                    "edit": [
                                        "group.admin"
                                    ]
                                }
                            },
                            "status": "uploaded",
                            "display_title": "GAPFIMQ7MHGA.bw",
                            "@id": "/files-reference/GAPFIMQ7MHGA/",
                            "uuid": "af93aecb-6b8e-4c8b-b159-eefb3f9d0ffb",
                            "@type": [
                                "FileReference",
                                "File",
                                "Item"
                            ],
                            "file_size": 9870053206,
                            "accession": "GAPFIMQ7MHGA",
                            "principals_allowed": {
                                "view": [
                                    "editor_for.12a92962-8265-4fc0-b2f8-cf14f05db58b",
                                    "group.admin",
                                    "group.read-only-admin",
                                    "remoteuser.EMBED",
                                    "remoteuser.INDEXER"
                                ],
                                "edit": [
                                    "editor_for.12a92962-8265-4fc0-b2f8-cf14f05db58b",
                                    "group.admin"
                                ]
                            }
                        },
                        "ordinal": 1,
                        "dimension": "0",
                        "workflow_argument_name": "phylop100bw"
                    },
                    {
                        "value": {
                            "href": "/files-reference/GAPFI5MRTDLN/@@download/GAPFI5MRTDLN.bw",
                            "file_format": {
                                "uuid": "33f30c42-d582-4163-af44-fecf586b9dd3",
                                "@type": [
                                    "FileFormat",
                                    "Item"
                                ],
                                "@id": "/file-formats/BigWig/",
                                "status": "shared",
                                "display_title": "BigWig",
                                "principals_allowed": {
                                    "view": [
                                        "system.Authenticated"
                                    ],
                                    "edit": [
                                        "group.admin"
                                    ]
                                }
                            },
                            "status": "uploaded",
                            "display_title": "GAPFI5MRTDLN.bw",
                            "@id": "/files-reference/GAPFI5MRTDLN/",
                            "uuid": "f6809af1-f7b9-43c0-882a-16764ccc431d",
                            "@type": [
                                "FileReference",
                                "File",
                                "Item"
                            ],
                            "file_size": 8400229101,
                            "accession": "GAPFI5MRTDLN",
                            "principals_allowed": {
                                "view": [
                                    "editor_for.12a92962-8265-4fc0-b2f8-cf14f05db58b",
                                    "group.admin",
                                    "group.read-only-admin",
                                    "remoteuser.EMBED",
                                    "remoteuser.INDEXER"
                                ],
                                "edit": [
                                    "editor_for.12a92962-8265-4fc0-b2f8-cf14f05db58b",
                                    "group.admin"
                                ]
                            }
                        },
                        "ordinal": 1,
                        "dimension": "0",
                        "workflow_argument_name": "phylop30bw"
                    },
                    {
                        "value": {
                            "href": "/files-reference/GAPFI6KXAQMV/@@download/GAPFI6KXAQMV.bw",
                            "file_format": {
                                "uuid": "33f30c42-d582-4163-af44-fecf586b9dd3",
                                "@type": [
                                    "FileFormat",
                                    "Item"
                                ],
                                "@id": "/file-formats/BigWig/",
                                "status": "shared",
                                "display_title": "BigWig",
                                "principals_allowed": {
                                    "view": [
                                        "system.Authenticated"
                                    ],
                                    "edit": [
                                        "group.admin"
                                    ]
                                }
                            },
                            "status": "uploaded",
                            "display_title": "GAPFI6KXAQMV.bw",
                            "@id": "/files-reference/GAPFI6KXAQMV/",
                            "uuid": "19f03828-175b-4594-ba1a-52ddabcf640d",
                            "@type": [
                                "FileReference",
                                "File",
                                "Item"
                            ],
                            "file_size": 5886377734,
                            "accession": "GAPFI6KXAQMV",
                            "principals_allowed": {
                                "view": [
                                    "editor_for.12a92962-8265-4fc0-b2f8-cf14f05db58b",
                                    "group.admin",
                                    "group.read-only-admin",
                                    "remoteuser.EMBED",
                                    "remoteuser.INDEXER"
                                ],
                                "edit": [
                                    "editor_for.12a92962-8265-4fc0-b2f8-cf14f05db58b",
                                    "group.admin"
                                ]
                            }
                        },
                        "ordinal": 1,
                        "dimension": "0",
                        "workflow_argument_name": "phastc100bw"
                    }
                ],
                "institution": {
                    "uuid": "828cd4fe-ebb0-4b36-a94a-d2e3a36cc989",
                    "@type": [
                        "Institution",
                        "Item"
                    ],
                    "status": "current",
                    "@id": "/institutions/hms-dbmi/",
                    "display_title": "HMS DBMI",
                    "principals_allowed": {
                        "view": [
                            "group.admin",
                            "group.read-only-admin",
                            "remoteuser.EMBED",
                            "remoteuser.INDEXER"
                        ],
                        "edit": [
                            "group.admin"
                        ]
                    }
                },
                "awsem_job_id": "QfIHwC079y92",
                "date_created": "2022-04-29T22:40:46.453659+00:00",
                "output_files": [
                    {
                        "type": "Output processed file",
                        "value": {
                            "uuid": "a7809e79-b980-4b7f-9e43-1c2a60959246",
                            "href": "/files-processed/GAPFIACVY8U8/@@download/GAPFIACVY8U8.vcf.gz",
                            "file_size": 2727278155,
                            "@type": [
                                "FileProcessed",
                                "File",
                                "Item"
                            ],
                            "status": "uploaded",
                            "accession": "GAPFIACVY8U8",
                            "display_title": "GAPFIACVY8U8.vcf.gz",
                            "file_format": {
                                "display_title": "vcf_gz",
                                "status": "shared",
                                "uuid": "1b8f525f-aecb-4211-9ae5-a2c998b05599",
                                "@id": "/file-formats/vcf_gz/",
                                "@type": [
                                    "FileFormat",
                                    "Item"
                                ],
                                "principals_allowed": {
                                    "view": [
                                        "system.Authenticated"
                                    ],
                                    "edit": [
                                        "group.admin"
                                    ]
                                }
                            },
                            "@id": "/files-processed/GAPFIACVY8U8/",
                            "quality_metric": {
                                "@id": "/quality-metrics-qclist/c9df0265-50c5-4706-9327-86d9f18f8130/",
                                "overall_quality_status": "PASS",
                                "status": "shared",
                                "uuid": "c9df0265-50c5-4706-9327-86d9f18f8130",
                                "@type": [
                                    "QualityMetricQclist",
                                    "QualityMetric",
                                    "Item"
                                ],
                                "display_title": "QualityMetricQclist from 2022-04-30",
                                "principals_allowed": {
                                    "view": [
                                        "system.Authenticated"
                                    ],
                                    "edit": [
                                        "group.admin"
                                    ]
                                }
                            },
                            "principals_allowed": {
                                "view": [
                                    "editor_for.12a92962-8265-4fc0-b2f8-cf14f05db58b",
                                    "group.admin",
                                    "group.read-only-admin",
                                    "remoteuser.EMBED",
                                    "remoteuser.INDEXER"
                                ],
                                "edit": [
                                    "editor_for.12a92962-8265-4fc0-b2f8-cf14f05db58b",
                                    "group.admin"
                                ]
                            }
                        },
                        "format": "/file-formats/vcf_gz/",
                        "upload_key": "a7809e79-b980-4b7f-9e43-1c2a60959246/GAPFIACVY8U8.vcf.gz",
                        "extra_files": [
                            {
                                "href": "/a7809e79-b980-4b7f-9e43-1c2a60959246/@@download/GAPFIACVY8U8.vcf.gz.tbi",
                                "uuid": "a7809e79-b980-4b7f-9e43-1c2a60959246",
                                "status": "uploading",
                                "filename": "GAPFIACVY8U8",
                                "accession": "GAPFIACVY8U8",
                                "upload_key": "a7809e79-b980-4b7f-9e43-1c2a60959246/GAPFIACVY8U8.vcf.gz.tbi",
                                "file_format": "/file-formats/vcf_gz_tbi/"
                            }
                        ],
                        "secondary_file_formats": [
                            "/file-formats/vcf_gz_tbi/"
                        ],
                        "workflow_argument_name": "annotated_vcf"
                    },
                    {
                        "type": "Output QC file",
                        "value_qc": {
                            "status": "shared",
                            "uuid": "9e5392e5-0804-4db0-87a4-bedecd663a75",
                            "@id": "/quality-metrics-vcfcheck/9e5392e5-0804-4db0-87a4-bedecd663a75/",
                            "@type": [
                                "QualityMetricVcfcheck",
                                "QualityMetric",
                                "Item"
                            ],
                            "overall_quality_status": "PASS",
                            "display_title": "QualityMetricVcfcheck from 2022-04-30",
                            "principals_allowed": {
                                "view": [
                                    "system.Authenticated"
                                ],
                                "edit": [
                                    "group.admin"
                                ]
                            }
                        },
                        "workflow_argument_name": "annotated_vcf-check"
                    }
                ],
                "run_platform": "AWSEM",
                "submitted_by": {
                    "display_title": "Tibanna App",
                    "uuid": "b041dba8-e2b2-4e54-a621-97edb508a0c4",
                    "status": "current",
                    "@type": [
                        "User",
                        "Item"
                    ],
                    "@id": "/users/b041dba8-e2b2-4e54-a621-97edb508a0c4/",
                    "principals_allowed": {
                        "view": [
                            "group.admin",
                            "remoteuser.EMBED",
                            "remoteuser.INDEXER",
                            "userid.b041dba8-e2b2-4e54-a621-97edb508a0c4"
                        ],
                        "edit": [
                            "group.admin"
                        ]
                    }
                },
                "last_modified": {
                    "modified_by": {
                        "status": "current",
                        "@type": [
                            "User",
                            "Item"
                        ],
                        "uuid": "7677f8a8-79d2-4cff-ab0a-a967a2a68e39",
                        "@id": "/users/7677f8a8-79d2-4cff-ab0a-a967a2a68e39/",
                        "display_title": "Foursight App",
                        "principals_allowed": {
                            "view": [
                                "group.admin",
                                "remoteuser.EMBED",
                                "remoteuser.INDEXER",
                                "userid.7677f8a8-79d2-4cff-ab0a-a967a2a68e39"
                            ],
                            "edit": [
                                "group.admin"
                            ]
                        }
                    },
                    "date_modified": "2022-04-30T10:00:29.980650+00:00"
                },
                "metadata_only": false,
                "awsem_app_name": "workflow_vep-annot-check",
                "quality_metric": {
                    "status": "shared",
                    "uuid": "fcca0f3c-909a-4933-b877-1b0e62e22c42",
                    "@type": [
                        "QualityMetricWorkflowrun",
                        "QualityMetric",
                        "Item"
                    ],
                    "@id": "/quality-metrics-workflowrun/fcca0f3c-909a-4933-b877-1b0e62e22c42/",
                    "display_title": "QualityMetricWorkflowrun from 2022-04-30",
                    "principals_allowed": {
                        "view": [
                            "system.Authenticated"
                        ],
                        "edit": [
                            "group.admin"
                        ]
                    }
                },
                "schema_version": "3",
                "awsem_postrun_json": "https://s3.amazonaws.com/cgap-biotest-main-application-tibanna-output/QfIHwC079y92.postrun.json",
                "associated_meta_workflow_runs": [
                    "a77b8431-2936-4f87-8405-8aa43ee777c1"
                ],
                "@id": "/workflow-runs-awsem/cf4811eb-3f1f-4951-8d84-00a2c7ffe352/",
                "@type": [
                    "WorkflowRunAwsem",
                    "WorkflowRun",
                    "Item"
                ],
                "uuid": "cf4811eb-3f1f-4951-8d84-00a2c7ffe352",
                "principals_allowed": {
                    "view": [
                        "system.Authenticated"
                    ],
                    "edit": [
                        "group.admin"
                    ]
                },
                "display_title": "workflow_vep-annot-check v1.0.0 run 2022-04-29 22:40:46.334063",
                "@context": "/terms/",
                "actions": [
                    {
                        "name": "create",
                        "title": "Create",
                        "profile": "/profiles/WorkflowRunAwsem.json",
                        "href": "/workflow-runs-awsem/cf4811eb-3f1f-4951-8d84-00a2c7ffe352/?currentAction=create"
                    },
                    {
                        "name": "edit",
                        "title": "Edit",
                        "profile": "/profiles/WorkflowRunAwsem.json",
                        "href": "/workflow-runs-awsem/cf4811eb-3f1f-4951-8d84-00a2c7ffe352/?currentAction=edit"
                    }
                ],
                "aggregated-items": {},
                "validation-errors": []
            }
        },
        {
            "name": "workflow_peddy",
            "jobid": "PxpliDNZ3ili",
            "shard": "0",
            "status": "completed",
            "dependencies": [
                "workflow_vep-annot-check:0"
            ],
            "workflow_run": {
                "title": "workflow_peddy v1.0.0 run 2022-04-30 02:10:35.255342",
                "status": "shared",
                "project": {
                    "status": "shared",
                    "@type": [
                        "Project",
                        "Item"
                    ],
                    "display_title": "CGAP Core",
                    "uuid": "12a92962-8265-4fc0-b2f8-cf14f05db58b",
                    "@id": "/projects/cgap-core/",
                    "principals_allowed": {
                        "view": [
                            "system.Authenticated"
                        ],
                        "edit": [
                            "group.admin"
                        ]
                    }
                },
                "run_url": "https://console.aws.amazon.com/states/home?region=us-east-1#/executions/details/arn:aws:states:us-east-1:922729568532:execution:tibanna_zebra_cgap-wolf:run_workflow_peddy-4cf2c193-426e-48d8-821b-e062dc9466c2",
                "parameters": [
                    {
                        "value": "[{\"parents\": [\"GAPIDUZDOX4R\", \"GAPIDQV37Z5Y\"], \"individual\": \"GAPID43VJKQ6\", \"sample_name\": \"NA12879_sample-WGS\", \"gender\": \"F\"}, {\"parents\": [], \"individual\": \"GAPIDUZDOX4R\", \"sample_name\": \"NA12878_sample-WGS\", \"gender\": \"F\"}, {\"parents\": [], \"individual\": \"GAPIDQV37Z5Y\", \"sample_name\": \"NA12877_sample-WGS\", \"gender\": \"M\"}]",
                        "ordinal": 1,
                        "dimension": "0",
                        "workflow_argument_name": "pedigree"
                    }
                ],
                "run_status": "complete",
                "input_files": [
                    {
                        "value": {
                            "accession": "GAPFIACVY8U8",
                            "display_title": "GAPFIACVY8U8.vcf.gz",
                            "href": "/files-processed/GAPFIACVY8U8/@@download/GAPFIACVY8U8.vcf.gz",
                            "file_size": 2727278155,
                            "uuid": "a7809e79-b980-4b7f-9e43-1c2a60959246",
                            "@id": "/files-processed/GAPFIACVY8U8/",
                            "@type": [
                                "FileProcessed",
                                "File",
                                "Item"
                            ],
                            "file_format": {
                                "@id": "/file-formats/vcf_gz/",
                                "uuid": "1b8f525f-aecb-4211-9ae5-a2c998b05599",
                                "status": "shared",
                                "@type": [
                                    "FileFormat",
                                    "Item"
                                ],
                                "display_title": "vcf_gz",
                                "principals_allowed": {
                                    "view": [
                                        "system.Authenticated"
                                    ],
                                    "edit": [
                                        "group.admin"
                                    ]
                                }
                            },
                            "status": "uploaded",
                            "quality_metric": {
                                "status": "shared",
                                "@id": "/quality-metrics-qclist/c9df0265-50c5-4706-9327-86d9f18f8130/",
                                "overall_quality_status": "PASS",
                                "uuid": "c9df0265-50c5-4706-9327-86d9f18f8130",
                                "@type": [
                                    "QualityMetricQclist",
                                    "QualityMetric",
                                    "Item"
                                ],
                                "display_title": "QualityMetricQclist from 2022-04-30",
                                "principals_allowed": {
                                    "view": [
                                        "system.Authenticated"
                                    ],
                                    "edit": [
                                        "group.admin"
                                    ]
                                }
                            },
                            "principals_allowed": {
                                "view": [
                                    "editor_for.12a92962-8265-4fc0-b2f8-cf14f05db58b",
                                    "group.admin",
                                    "group.read-only-admin",
                                    "remoteuser.EMBED",
                                    "remoteuser.INDEXER"
                                ],
                                "edit": [
                                    "editor_for.12a92962-8265-4fc0-b2f8-cf14f05db58b",
                                    "group.admin"
                                ]
                            }
                        },
                        "ordinal": 1,
                        "dimension": "0",
                        "workflow_argument_name": "input_vcf"
                    }
                ],
                "awsem_job_id": "PxpliDNZ3ili",
                "date_created": "2022-04-30T02:10:35.344125+00:00",
                "output_files": [
                    {
                        "type": "Output QC file",
                        "value_qc": {
                            "@type": [
                                "QualityMetricPeddyqc",
                                "QualityMetric",
                                "Item"
                            ],
                            "status": "shared",
                            "uuid": "6561d7cf-a5c1-4ada-9eab-9e1ba62b3699",
                            "display_title": "QualityMetricPeddyqc from 2022-04-30",
                            "url": "https://s3.amazonaws.com/cgap-biotest-main-application-cgap-wolf-wfoutput/GAPFIACVY8U8/qc_report.html",
                            "overall_quality_status": "PASS",
                            "@id": "/quality-metrics-peddyqc/6561d7cf-a5c1-4ada-9eab-9e1ba62b3699/",
                            "principals_allowed": {
                                "view": [
                                    "system.Authenticated"
                                ],
                                "edit": [
                                    "group.admin"
                                ]
                            }
                        },
                        "workflow_argument_name": "qc_json"
                    },
                    {
                        "type": "Output QC file",
                        "value_qc": {
                            "@type": [
                                "QualityMetricPeddyqc",
                                "QualityMetric",
                                "Item"
                            ],
                            "status": "shared",
                            "uuid": "6561d7cf-a5c1-4ada-9eab-9e1ba62b3699",
                            "display_title": "QualityMetricPeddyqc from 2022-04-30",
                            "url": "https://s3.amazonaws.com/cgap-biotest-main-application-cgap-wolf-wfoutput/GAPFIACVY8U8/qc_report.html",
                            "overall_quality_status": "PASS",
                            "@id": "/quality-metrics-peddyqc/6561d7cf-a5c1-4ada-9eab-9e1ba62b3699/",
                            "principals_allowed": {
                                "view": [
                                    "system.Authenticated"
                                ],
                                "edit": [
                                    "group.admin"
                                ]
                            }
                        },
                        "workflow_argument_name": "qc_html"
                    }
                ],
                "run_platform": "AWSEM",
                "submitted_by": {
                    "@type": [
                        "User",
                        "Item"
                    ],
                    "status": "current",
                    "@id": "/users/b041dba8-e2b2-4e54-a621-97edb508a0c4/",
                    "display_title": "Tibanna App",
                    "uuid": "b041dba8-e2b2-4e54-a621-97edb508a0c4",
                    "principals_allowed": {
                        "view": [
                            "group.admin",
                            "remoteuser.EMBED",
                            "remoteuser.INDEXER",
                            "userid.b041dba8-e2b2-4e54-a621-97edb508a0c4"
                        ],
                        "edit": [
                            "group.admin"
                        ]
                    }
                },
                "last_modified": {
                    "modified_by": {
                        "@id": "/users/7677f8a8-79d2-4cff-ab0a-a967a2a68e39/",
                        "uuid": "7677f8a8-79d2-4cff-ab0a-a967a2a68e39",
                        "display_title": "Foursight App",
                        "@type": [
                            "User",
                            "Item"
                        ],
                        "status": "current",
                        "principals_allowed": {
                            "view": [
                                "group.admin",
                                "remoteuser.EMBED",
                                "remoteuser.INDEXER",
                                "userid.7677f8a8-79d2-4cff-ab0a-a967a2a68e39"
                            ],
                            "edit": [
                                "group.admin"
                            ]
                        }
                    },
                    "date_modified": "2022-04-30T10:00:29.364582+00:00"
                },
                "metadata_only": false,
                "awsem_app_name": "workflow_peddy",
                "quality_metric": {
                    "status": "shared",
                    "uuid": "aded4387-6e66-4400-beb3-2c41172920dd",
                    "display_title": "QualityMetricWorkflowrun from 2022-04-30",
                    "@type": [
                        "QualityMetricWorkflowrun",
                        "QualityMetric",
                        "Item"
                    ],
                    "@id": "/quality-metrics-workflowrun/aded4387-6e66-4400-beb3-2c41172920dd/",
                    "principals_allowed": {
                        "view": [
                            "system.Authenticated"
                        ],
                        "edit": [
                            "group.admin"
                        ]
                    }
                },
                "schema_version": "3",
                "awsem_postrun_json": "https://s3.amazonaws.com/cgap-biotest-main-application-tibanna-output/PxpliDNZ3ili.postrun.json",
                "associated_meta_workflow_runs": [
                    "a77b8431-2936-4f87-8405-8aa43ee777c1"
                ],
                "@id": "/workflow-runs-awsem/58210479-cf6c-40db-8a03-fbd2541be2c2/",
                "@type": [
                    "WorkflowRunAwsem",
                    "WorkflowRun",
                    "Item"
                ],
                "uuid": "58210479-cf6c-40db-8a03-fbd2541be2c2",
                "principals_allowed": {
                    "view": [
                        "system.Authenticated"
                    ],
                    "edit": [
                        "group.admin"
                    ]
                },
                "display_title": "workflow_peddy v1.0.0 run 2022-04-30 02:10:35.255342",
                "@context": "/terms/",
                "actions": [
                    {
                        "name": "create",
                        "title": "Create",
                        "profile": "/profiles/WorkflowRunAwsem.json",
                        "href": "/workflow-runs-awsem/58210479-cf6c-40db-8a03-fbd2541be2c2/?currentAction=create"
                    },
                    {
                        "name": "edit",
                        "title": "Edit",
                        "profile": "/profiles/WorkflowRunAwsem.json",
                        "href": "/workflow-runs-awsem/58210479-cf6c-40db-8a03-fbd2541be2c2/?currentAction=edit"
                    }
                ]
            }
        },
        {
            "name": "workflow_granite-qcVCF-2",
            "jobid": "Esw37nW399er",
            "shard": "0",
            "status": "completed",
            "dependencies": [
                "workflow_peddy:0",
                "workflow_vep-annot-check:0"
            ],
            "workflow_run": {
                "title": "workflow_granite-qcVCF v1.0.0 run 2022-04-30 02:40:35.197316",
                "status": "shared",
                "project": {
                    "uuid": "12a92962-8265-4fc0-b2f8-cf14f05db58b",
                    "@type": [
                        "Project",
                        "Item"
                    ],
                    "status": "shared",
                    "display_title": "CGAP Core",
                    "@id": "/projects/cgap-core/",
                    "principals_allowed": {
                        "view": [
                            "system.Authenticated"
                        ],
                        "edit": [
                            "group.admin"
                        ]
                    }
                },
                "run_url": "https://console.aws.amazon.com/states/home?region=us-east-1#/executions/details/arn:aws:states:us-east-1:922729568532:execution:tibanna_zebra_cgap-wolf:run_workflow_granite-qcVCF-dbfdd4c2-3937-4f4a-a0a6-5d39f0e3d863",
                "parameters": [
                    {
                        "value": "[{\"parents\": [\"GAPIDUZDOX4R\", \"GAPIDQV37Z5Y\"], \"individual\": \"GAPID43VJKQ6\", \"sample_name\": \"NA12879_sample-WGS\", \"gender\": \"F\"}, {\"parents\": [], \"individual\": \"GAPIDUZDOX4R\", \"sample_name\": \"NA12878_sample-WGS\", \"gender\": \"F\"}, {\"parents\": [], \"individual\": \"GAPIDQV37Z5Y\", \"sample_name\": \"NA12877_sample-WGS\", \"gender\": \"M\"}]",
                        "ordinal": 1,
                        "dimension": "0",
                        "workflow_argument_name": "pedigree"
                    },
                    {
                        "value": "['NA12879_sample-WGS', 'NA12878_sample-WGS', 'NA12877_sample-WGS']",
                        "ordinal": 1,
                        "dimension": "0",
                        "workflow_argument_name": "samples"
                    },
                    {
                        "value": "True",
                        "ordinal": 1,
                        "dimension": "0",
                        "workflow_argument_name": "trio_errors"
                    },
                    {
                        "value": "True",
                        "ordinal": 1,
                        "dimension": "0",
                        "workflow_argument_name": "het_hom"
                    },
                    {
                        "value": "True",
                        "ordinal": 1,
                        "dimension": "0",
                        "workflow_argument_name": "ti_tv"
                    }
                ],
                "run_status": "complete",
                "input_files": [
                    {
                        "value": {
                            "href": "/files-processed/GAPFIACVY8U8/@@download/GAPFIACVY8U8.vcf.gz",
                            "file_format": {
                                "uuid": "1b8f525f-aecb-4211-9ae5-a2c998b05599",
                                "@type": [
                                    "FileFormat",
                                    "Item"
                                ],
                                "@id": "/file-formats/vcf_gz/",
                                "status": "shared",
                                "display_title": "vcf_gz",
                                "principals_allowed": {
                                    "view": [
                                        "system.Authenticated"
                                    ],
                                    "edit": [
                                        "group.admin"
                                    ]
                                }
                            },
                            "status": "uploaded",
                            "display_title": "GAPFIACVY8U8.vcf.gz",
                            "@id": "/files-processed/GAPFIACVY8U8/",
                            "uuid": "a7809e79-b980-4b7f-9e43-1c2a60959246",
                            "@type": [
                                "FileProcessed",
                                "File",
                                "Item"
                            ],
                            "file_size": 2727278155,
                            "accession": "GAPFIACVY8U8",
                            "quality_metric": {
                                "overall_quality_status": "PASS",
                                "@type": [
                                    "QualityMetricQclist",
                                    "QualityMetric",
                                    "Item"
                                ],
                                "status": "shared",
                                "display_title": "QualityMetricQclist from 2022-04-30",
                                "uuid": "c9df0265-50c5-4706-9327-86d9f18f8130",
                                "@id": "/quality-metrics-qclist/c9df0265-50c5-4706-9327-86d9f18f8130/",
                                "principals_allowed": {
                                    "view": [
                                        "system.Authenticated"
                                    ],
                                    "edit": [
                                        "group.admin"
                                    ]
                                }
                            },
                            "principals_allowed": {
                                "view": [
                                    "editor_for.12a92962-8265-4fc0-b2f8-cf14f05db58b",
                                    "group.admin",
                                    "group.read-only-admin",
                                    "remoteuser.EMBED",
                                    "remoteuser.INDEXER"
                                ],
                                "edit": [
                                    "editor_for.12a92962-8265-4fc0-b2f8-cf14f05db58b",
                                    "group.admin"
                                ]
                            }
                        },
                        "ordinal": 1,
                        "dimension": "0",
                        "workflow_argument_name": "input_vcf"
                    }
                ],
                "institution": {
                    "uuid": "828cd4fe-ebb0-4b36-a94a-d2e3a36cc989",
                    "@type": [
                        "Institution",
                        "Item"
                    ],
                    "status": "current",
                    "@id": "/institutions/hms-dbmi/",
                    "display_title": "HMS DBMI",
                    "principals_allowed": {
                        "view": [
                            "group.admin",
                            "group.read-only-admin",
                            "remoteuser.EMBED",
                            "remoteuser.INDEXER"
                        ],
                        "edit": [
                            "group.admin"
                        ]
                    }
                },
                "awsem_job_id": "Esw37nW399er",
                "date_created": "2022-04-30T02:40:35.297643+00:00",
                "output_files": [
                    {
                        "type": "Output QC file",
                        "value_qc": {
                            "status": "shared",
                            "uuid": "1a6c85b3-2d60-4428-b449-0771abdf787a",
                            "@id": "/quality-metrics-vcfqc/1a6c85b3-2d60-4428-b449-0771abdf787a/",
                            "@type": [
                                "QualityMetricVcfqc",
                                "QualityMetric",
                                "Item"
                            ],
                            "overall_quality_status": "PASS",
                            "display_title": "QualityMetricVcfqc from 2022-04-30",
                            "principals_allowed": {
                                "view": [
                                    "system.Authenticated"
                                ],
                                "edit": [
                                    "group.admin"
                                ]
                            }
                        },
                        "workflow_argument_name": "qc_json"
                    },
                    {
                        "type": "Output QC file",
                        "value_qc": {
                            "status": "shared",
                            "uuid": "1a6c85b3-2d60-4428-b449-0771abdf787a",
                            "@id": "/quality-metrics-vcfqc/1a6c85b3-2d60-4428-b449-0771abdf787a/",
                            "@type": [
                                "QualityMetricVcfqc",
                                "QualityMetric",
                                "Item"
                            ],
                            "overall_quality_status": "PASS",
                            "display_title": "QualityMetricVcfqc from 2022-04-30",
                            "principals_allowed": {
                                "view": [
                                    "system.Authenticated"
                                ],
                                "edit": [
                                    "group.admin"
                                ]
                            }
                        },
                        "workflow_argument_name": "uniq_variants"
                    }
                ],
                "run_platform": "AWSEM",
                "submitted_by": {
                    "display_title": "Tibanna App",
                    "uuid": "b041dba8-e2b2-4e54-a621-97edb508a0c4",
                    "status": "current",
                    "@type": [
                        "User",
                        "Item"
                    ],
                    "@id": "/users/b041dba8-e2b2-4e54-a621-97edb508a0c4/",
                    "principals_allowed": {
                        "view": [
                            "group.admin",
                            "remoteuser.EMBED",
                            "remoteuser.INDEXER",
                            "userid.b041dba8-e2b2-4e54-a621-97edb508a0c4"
                        ],
                        "edit": [
                            "group.admin"
                        ]
                    }
                },
                "last_modified": {
                    "modified_by": {
                        "status": "current",
                        "@type": [
                            "User",
                            "Item"
                        ],
                        "uuid": "7677f8a8-79d2-4cff-ab0a-a967a2a68e39",
                        "@id": "/users/7677f8a8-79d2-4cff-ab0a-a967a2a68e39/",
                        "display_title": "Foursight App",
                        "principals_allowed": {
                            "view": [
                                "group.admin",
                                "remoteuser.EMBED",
                                "remoteuser.INDEXER",
                                "userid.7677f8a8-79d2-4cff-ab0a-a967a2a68e39"
                            ],
                            "edit": [
                                "group.admin"
                            ]
                        }
                    },
                    "date_modified": "2022-04-30T10:00:29.155017+00:00"
                },
                "metadata_only": false,
                "awsem_app_name": "workflow_granite-qcVCF",
                "quality_metric": {
                    "status": "shared",
                    "uuid": "a537482a-af3f-422b-89af-cc8043020751",
                    "@type": [
                        "QualityMetricWorkflowrun",
                        "QualityMetric",
                        "Item"
                    ],
                    "@id": "/quality-metrics-workflowrun/a537482a-af3f-422b-89af-cc8043020751/",
                    "display_title": "QualityMetricWorkflowrun from 2022-04-30",
                    "principals_allowed": {
                        "view": [
                            "system.Authenticated"
                        ],
                        "edit": [
                            "group.admin"
                        ]
                    }
                },
                "schema_version": "3",
                "awsem_postrun_json": "https://s3.amazonaws.com/cgap-biotest-main-application-tibanna-output/Esw37nW399er.postrun.json",
                "associated_meta_workflow_runs": [
                    "a77b8431-2936-4f87-8405-8aa43ee777c1"
                ],
                "@id": "/workflow-runs-awsem/eba22967-9efc-4071-a3df-fa5b55943db8/",
                "@type": [
                    "WorkflowRunAwsem",
                    "WorkflowRun",
                    "Item"
                ],
                "uuid": "eba22967-9efc-4071-a3df-fa5b55943db8",
                "principals_allowed": {
                    "view": [
                        "system.Authenticated"
                    ],
                    "edit": [
                        "group.admin"
                    ]
                },
                "display_title": "workflow_granite-qcVCF v1.0.0 run 2022-04-30 02:40:35.197316",
                "@context": "/terms/",
                "actions": [
                    {
                        "name": "create",
                        "title": "Create",
                        "profile": "/profiles/WorkflowRunAwsem.json",
                        "href": "/workflow-runs-awsem/eba22967-9efc-4071-a3df-fa5b55943db8/?currentAction=create"
                    },
                    {
                        "name": "edit",
                        "title": "Edit",
                        "profile": "/profiles/WorkflowRunAwsem.json",
                        "href": "/workflow-runs-awsem/eba22967-9efc-4071-a3df-fa5b55943db8/?currentAction=edit"
                    }
                ]
            }
        },
        {
            "name": "workflow_granite-filtering-check",
            "jobid": "ndgL6ekz3yoL",
            "shard": "0",
            "output": [
                {
                    "file": {
                        "display_title": "GAPFIF8PBOT6.vcf.gz",
                        "status": "uploaded",
                        "@id": "/files-processed/GAPFIF8PBOT6/",
                        "uuid": "c11cb753-5ae1-4298-b714-e30b67b46653",
                        "@type": [
                            "FileProcessed",
                            "File",
                            "Item"
                        ],
                        "principals_allowed": {
                            "view": [
                                "editor_for.12a92962-8265-4fc0-b2f8-cf14f05db58b",
                                "group.admin",
                                "group.read-only-admin",
                                "remoteuser.EMBED",
                                "remoteuser.INDEXER"
                            ],
                            "edit": [
                                "editor_for.12a92962-8265-4fc0-b2f8-cf14f05db58b",
                                "group.admin"
                            ]
                        }
                    },
                    "argument_name": "merged_vcf"
                }
            ],
            "status": "completed",
            "dependencies": [
                "workflow_vep-annot-check:0"
            ],
            "workflow_run": {
                "title": "workflow_granite-filtering-check v1.0.0 run 2022-04-30 02:10:40.339145",
                "status": "shared",
                "run_url": "https://console.aws.amazon.com/states/home?region=us-east-1#/executions/details/arn:aws:states:us-east-1:922729568532:execution:tibanna_zebra_cgap-wolf:run_workflow_granite-filtering-check-b8a5c163-a3e7-4d30-838e-92db66334153",
                "parameters": [
                    {
                        "value": "gnomADg_AF",
                        "ordinal": 1,
                        "dimension": "0",
                        "workflow_argument_name": "aftag"
                    },
                    {
                        "value": "0.01",
                        "ordinal": 1,
                        "dimension": "0",
                        "workflow_argument_name": "afthr"
                    }
                ],
                "run_status": "complete",
                "input_files": [
                    {
                        "value": {
                            "uuid": "a7809e79-b980-4b7f-9e43-1c2a60959246",
                            "href": "/files-processed/GAPFIACVY8U8/@@download/GAPFIACVY8U8.vcf.gz",
                            "@id": "/files-processed/GAPFIACVY8U8/",
                            "accession": "GAPFIACVY8U8",
                            "display_title": "GAPFIACVY8U8.vcf.gz",
                            "file_size": 2727278155,
                            "@type": [
                                "FileProcessed",
                                "File",
                                "Item"
                            ],
                            "status": "uploaded",
                            "file_format": {
                                "uuid": "1b8f525f-aecb-4211-9ae5-a2c998b05599",
                                "status": "shared",
                                "@id": "/file-formats/vcf_gz/",
                                "display_title": "vcf_gz",
                                "@type": [
                                    "FileFormat",
                                    "Item"
                                ],
                                "principals_allowed": {
                                    "view": [
                                        "system.Authenticated"
                                    ],
                                    "edit": [
                                        "group.admin"
                                    ]
                                }
                            },
                            "quality_metric": {
                                "display_title": "QualityMetricQclist from 2022-04-30",
                                "@type": [
                                    "QualityMetricQclist",
                                    "QualityMetric",
                                    "Item"
                                ],
                                "uuid": "c9df0265-50c5-4706-9327-86d9f18f8130",
                                "@id": "/quality-metrics-qclist/c9df0265-50c5-4706-9327-86d9f18f8130/",
                                "status": "shared",
                                "overall_quality_status": "PASS",
                                "principals_allowed": {
                                    "view": [
                                        "system.Authenticated"
                                    ],
                                    "edit": [
                                        "group.admin"
                                    ]
                                }
                            },
                            "principals_allowed": {
                                "view": [
                                    "editor_for.12a92962-8265-4fc0-b2f8-cf14f05db58b",
                                    "group.admin",
                                    "group.read-only-admin",
                                    "remoteuser.EMBED",
                                    "remoteuser.INDEXER"
                                ],
                                "edit": [
                                    "editor_for.12a92962-8265-4fc0-b2f8-cf14f05db58b",
                                    "group.admin"
                                ]
                            }
                        },
                        "ordinal": 1,
                        "dimension": "0",
                        "workflow_argument_name": "input_vcf"
                    },
                    {
                        "value": {
                            "uuid": "84f2bb24-edd7-459b-ab89-0a21866d7826",
                            "href": "/files-reference/GAPFI5MKCART/@@download/GAPFI5MKCART.txt",
                            "@id": "/files-reference/GAPFI5MKCART/",
                            "accession": "GAPFI5MKCART",
                            "display_title": "GAPFI5MKCART.txt",
                            "file_size": 349968,
                            "@type": [
                                "FileReference",
                                "File",
                                "Item"
                            ],
                            "status": "uploaded",
                            "file_format": {
                                "uuid": "0cd4e777-a596-4927-95c8-b07716121aa3",
                                "status": "shared",
                                "@id": "/file-formats/txt/",
                                "display_title": "txt",
                                "@type": [
                                    "FileFormat",
                                    "Item"
                                ],
                                "principals_allowed": {
                                    "view": [
                                        "system.Authenticated"
                                    ],
                                    "edit": [
                                        "group.admin"
                                    ]
                                }
                            },
                            "principals_allowed": {
                                "view": [
                                    "editor_for.12a92962-8265-4fc0-b2f8-cf14f05db58b",
                                    "group.admin",
                                    "group.read-only-admin",
                                    "remoteuser.EMBED",
                                    "remoteuser.INDEXER"
                                ],
                                "edit": [
                                    "editor_for.12a92962-8265-4fc0-b2f8-cf14f05db58b",
                                    "group.admin"
                                ]
                            }
                        },
                        "ordinal": 1,
                        "dimension": "0",
                        "workflow_argument_name": "genes"
                    }
                ],
                "awsem_job_id": "ndgL6ekz3yoL",
                "date_created": "2022-04-30T02:10:40.463671+00:00",
                "output_files": [
                    {
                        "type": "Output processed file",
                        "value": {
                            "file_format": {
                                "status": "shared",
                                "@id": "/file-formats/vcf_gz/",
                                "@type": [
                                    "FileFormat",
                                    "Item"
                                ],
                                "uuid": "1b8f525f-aecb-4211-9ae5-a2c998b05599",
                                "display_title": "vcf_gz",
                                "principals_allowed": {
                                    "view": [
                                        "system.Authenticated"
                                    ],
                                    "edit": [
                                        "group.admin"
                                    ]
                                }
                            },
                            "uuid": "c11cb753-5ae1-4298-b714-e30b67b46653",
                            "@id": "/files-processed/GAPFIF8PBOT6/",
                            "file_size": 4212759,
                            "status": "uploaded",
                            "href": "/files-processed/GAPFIF8PBOT6/@@download/GAPFIF8PBOT6.vcf.gz",
                            "display_title": "GAPFIF8PBOT6.vcf.gz",
                            "accession": "GAPFIF8PBOT6",
                            "@type": [
                                "FileProcessed",
                                "File",
                                "Item"
                            ],
                            "quality_metric": {
                                "@id": "/quality-metrics-qclist/22c5255f-ef08-4660-8524-887067eebb2e/",
                                "uuid": "22c5255f-ef08-4660-8524-887067eebb2e",
                                "display_title": "QualityMetricQclist from 2022-04-30",
                                "status": "shared",
                                "overall_quality_status": "PASS",
                                "@type": [
                                    "QualityMetricQclist",
                                    "QualityMetric",
                                    "Item"
                                ],
                                "principals_allowed": {
                                    "view": [
                                        "system.Authenticated"
                                    ],
                                    "edit": [
                                        "group.admin"
                                    ]
                                }
                            },
                            "principals_allowed": {
                                "view": [
                                    "editor_for.12a92962-8265-4fc0-b2f8-cf14f05db58b",
                                    "group.admin",
                                    "group.read-only-admin",
                                    "remoteuser.EMBED",
                                    "remoteuser.INDEXER"
                                ],
                                "edit": [
                                    "editor_for.12a92962-8265-4fc0-b2f8-cf14f05db58b",
                                    "group.admin"
                                ]
                            }
                        },
                        "format": "/file-formats/vcf_gz/",
                        "upload_key": "c11cb753-5ae1-4298-b714-e30b67b46653/GAPFIF8PBOT6.vcf.gz",
                        "extra_files": [
                            {
                                "href": "/c11cb753-5ae1-4298-b714-e30b67b46653/@@download/GAPFIF8PBOT6.vcf.gz.tbi",
                                "uuid": "c11cb753-5ae1-4298-b714-e30b67b46653",
                                "status": "uploading",
                                "filename": "GAPFIF8PBOT6",
                                "accession": "GAPFIF8PBOT6",
                                "upload_key": "c11cb753-5ae1-4298-b714-e30b67b46653/GAPFIF8PBOT6.vcf.gz.tbi",
                                "file_format": "/file-formats/vcf_gz_tbi/"
                            }
                        ],
                        "secondary_file_formats": [
                            "/file-formats/vcf_gz_tbi/"
                        ],
                        "workflow_argument_name": "merged_vcf"
                    },
                    {
                        "type": "Output QC file",
                        "value_qc": {
                            "status": "shared",
                            "display_title": "QualityMetricVcfcheck from 2022-04-30",
                            "@type": [
                                "QualityMetricVcfcheck",
                                "QualityMetric",
                                "Item"
                            ],
                            "overall_quality_status": "PASS",
                            "@id": "/quality-metrics-vcfcheck/623843ad-9242-49b4-8df7-65bf4eb041e5/",
                            "uuid": "623843ad-9242-49b4-8df7-65bf4eb041e5",
                            "principals_allowed": {
                                "view": [
                                    "system.Authenticated"
                                ],
                                "edit": [
                                    "group.admin"
                                ]
                            }
                        },
                        "workflow_argument_name": "merged_vcf-check"
                    }
                ],
                "run_platform": "AWSEM",
                "submitted_by": {
                    "display_title": "Tibanna App",
                    "@type": [
                        "User",
                        "Item"
                    ],
                    "status": "current",
                    "uuid": "b041dba8-e2b2-4e54-a621-97edb508a0c4",
                    "@id": "/users/b041dba8-e2b2-4e54-a621-97edb508a0c4/",
                    "principals_allowed": {
                        "view": [
                            "group.admin",
                            "remoteuser.EMBED",
                            "remoteuser.INDEXER",
                            "userid.b041dba8-e2b2-4e54-a621-97edb508a0c4"
                        ],
                        "edit": [
                            "group.admin"
                        ]
                    }
                },
                "last_modified": {
                    "modified_by": {
                        "display_title": "Foursight App",
                        "status": "current",
                        "@type": [
                            "User",
                            "Item"
                        ],
                        "@id": "/users/7677f8a8-79d2-4cff-ab0a-a967a2a68e39/",
                        "uuid": "7677f8a8-79d2-4cff-ab0a-a967a2a68e39",
                        "principals_allowed": {
                            "view": [
                                "group.admin",
                                "remoteuser.EMBED",
                                "remoteuser.INDEXER",
                                "userid.7677f8a8-79d2-4cff-ab0a-a967a2a68e39"
                            ],
                            "edit": [
                                "group.admin"
                            ]
                        }
                    },
                    "date_modified": "2022-04-30T10:00:29.260426+00:00"
                },
                "metadata_only": false,
                "awsem_app_name": "workflow_granite-filtering-check",
                "quality_metric": {
                    "uuid": "6f447253-3b1f-4ff9-90a5-0650a9ed6034",
                    "display_title": "QualityMetricWorkflowrun from 2022-04-30",
                    "@id": "/quality-metrics-workflowrun/6f447253-3b1f-4ff9-90a5-0650a9ed6034/",
                    "@type": [
                        "QualityMetricWorkflowrun",
                        "QualityMetric",
                        "Item"
                    ],
                    "status": "shared",
                    "principals_allowed": {
                        "view": [
                            "system.Authenticated"
                        ],
                        "edit": [
                            "group.admin"
                        ]
                    }
                },
                "schema_version": "3",
                "awsem_postrun_json": "https://s3.amazonaws.com/cgap-biotest-main-application-tibanna-output/ndgL6ekz3yoL.postrun.json",
                "associated_meta_workflow_runs": [
                    "a77b8431-2936-4f87-8405-8aa43ee777c1"
                ],
                "@id": "/workflow-runs-awsem/64a59f36-a856-47e1-be09-d0c6b8694252/",
                "@type": [
                    "WorkflowRunAwsem",
                    "WorkflowRun",
                    "Item"
                ],
                "uuid": "64a59f36-a856-47e1-be09-d0c6b8694252",
                "principals_allowed": {
                    "view": [
                        "system.Authenticated"
                    ],
                    "edit": [
                        "group.admin"
                    ]
                },
                "display_title": "workflow_granite-filtering-check v1.0.0 run 2022-04-30 02:10:40.339145",
                "@context": "/terms/",
                "actions": [
                    {
                        "name": "create",
                        "title": "Create",
                        "profile": "/profiles/WorkflowRunAwsem.json",
                        "href": "/workflow-runs-awsem/64a59f36-a856-47e1-be09-d0c6b8694252/?currentAction=create"
                    },
                    {
                        "name": "edit",
                        "title": "Edit",
                        "profile": "/profiles/WorkflowRunAwsem.json",
                        "href": "/workflow-runs-awsem/64a59f36-a856-47e1-be09-d0c6b8694252/?currentAction=edit"
                    }
                ]
            }
        },
        {
            "name": "workflow_granite-novoCaller-rck-check",
            "jobid": "xFRcGVgRfaTn",
            "shard": "0",
            "output": [
                {
                    "file": {
                        "display_title": "GAPFIRZZWDQL.vcf.gz",
                        "status": "uploaded",
                        "@id": "/files-processed/GAPFIRZZWDQL/",
                        "uuid": "0d5b70d8-3ab9-474b-92ff-0b41bfa1919b",
                        "@type": [
                            "FileProcessed",
                            "File",
                            "Item"
                        ],
                        "principals_allowed": {
                            "view": [
                                "editor_for.12a92962-8265-4fc0-b2f8-cf14f05db58b",
                                "group.admin",
                                "group.read-only-admin",
                                "remoteuser.EMBED",
                                "remoteuser.INDEXER"
                            ],
                            "edit": [
                                "editor_for.12a92962-8265-4fc0-b2f8-cf14f05db58b",
                                "group.admin"
                            ]
                        }
                    },
                    "argument_name": "novoCaller_vcf"
                }
            ],
            "status": "completed",
            "dependencies": [
                "workflow_granite-filtering-check:0",
                "workflow_granite-rckTar:0"
            ],
            "workflow_run": {
                "title": "workflow_granite-novoCaller-rck-check v1.0.0 run 2022-04-30 02:55:36.042917",
                "status": "shared",
                "run_url": "https://console.aws.amazon.com/states/home?region=us-east-1#/executions/details/arn:aws:states:us-east-1:922729568532:execution:tibanna_zebra_cgap-wolf:run_workflow_granite-novoCaller-rck-check-44d0b6a2-9280-4223-a514-aa7d08655128",
                "parameters": [],
                "run_status": "complete",
                "input_files": [
                    {
                        "value": {
                            "accession": "GAPFIF8PBOT6",
                            "display_title": "GAPFIF8PBOT6.vcf.gz",
                            "href": "/files-processed/GAPFIF8PBOT6/@@download/GAPFIF8PBOT6.vcf.gz",
                            "file_size": 4212759,
                            "uuid": "c11cb753-5ae1-4298-b714-e30b67b46653",
                            "@id": "/files-processed/GAPFIF8PBOT6/",
                            "@type": [
                                "FileProcessed",
                                "File",
                                "Item"
                            ],
                            "file_format": {
                                "@id": "/file-formats/vcf_gz/",
                                "uuid": "1b8f525f-aecb-4211-9ae5-a2c998b05599",
                                "status": "shared",
                                "@type": [
                                    "FileFormat",
                                    "Item"
                                ],
                                "display_title": "vcf_gz",
                                "principals_allowed": {
                                    "view": [
                                        "system.Authenticated"
                                    ],
                                    "edit": [
                                        "group.admin"
                                    ]
                                }
                            },
                            "status": "uploaded",
                            "quality_metric": {
                                "status": "shared",
                                "@id": "/quality-metrics-qclist/22c5255f-ef08-4660-8524-887067eebb2e/",
                                "overall_quality_status": "PASS",
                                "uuid": "22c5255f-ef08-4660-8524-887067eebb2e",
                                "@type": [
                                    "QualityMetricQclist",
                                    "QualityMetric",
                                    "Item"
                                ],
                                "display_title": "QualityMetricQclist from 2022-04-30",
                                "principals_allowed": {
                                    "view": [
                                        "system.Authenticated"
                                    ],
                                    "edit": [
                                        "group.admin"
                                    ]
                                }
                            },
                            "principals_allowed": {
                                "view": [
                                    "editor_for.12a92962-8265-4fc0-b2f8-cf14f05db58b",
                                    "group.admin",
                                    "group.read-only-admin",
                                    "remoteuser.EMBED",
                                    "remoteuser.INDEXER"
                                ],
                                "edit": [
                                    "editor_for.12a92962-8265-4fc0-b2f8-cf14f05db58b",
                                    "group.admin"
                                ]
                            }
                        },
                        "ordinal": 1,
                        "dimension": "0",
                        "workflow_argument_name": "input_vcf"
                    },
                    {
                        "value": {
                            "accession": "GAPFIMO8Y4PZ",
                            "display_title": "GAPFIMO8Y4PZ.rck.tar",
                            "href": "/files-reference/GAPFIMO8Y4PZ/@@download/GAPFIMO8Y4PZ.rck.tar",
                            "file_size": 209874647040,
                            "uuid": "eac862c0-8c87-4838-83cb-9a77412bff6f",
                            "@id": "/files-reference/GAPFIMO8Y4PZ/",
                            "@type": [
                                "FileReference",
                                "File",
                                "Item"
                            ],
                            "file_format": {
                                "@id": "/file-formats/rck_tar/",
                                "uuid": "39f836d8-bbb1-46c7-80d4-e321d4a44204",
                                "status": "shared",
                                "@type": [
                                    "FileFormat",
                                    "Item"
                                ],
                                "display_title": "rck_tar",
                                "principals_allowed": {
                                    "view": [
                                        "system.Authenticated"
                                    ],
                                    "edit": [
                                        "group.admin"
                                    ]
                                }
                            },
                            "status": "uploaded",
                            "principals_allowed": {
                                "view": [
                                    "editor_for.12a92962-8265-4fc0-b2f8-cf14f05db58b",
                                    "group.admin",
                                    "group.read-only-admin",
                                    "remoteuser.EMBED",
                                    "remoteuser.INDEXER"
                                ],
                                "edit": [
                                    "editor_for.12a92962-8265-4fc0-b2f8-cf14f05db58b",
                                    "group.admin"
                                ]
                            }
                        },
                        "ordinal": 1,
                        "dimension": "0",
                        "workflow_argument_name": "unrelated"
                    },
                    {
                        "value": {
                            "accession": "GAPFI7TBYWC7",
                            "display_title": "GAPFI7TBYWC7.rck.tar",
                            "href": "/files-processed/GAPFI7TBYWC7/@@download/GAPFI7TBYWC7.rck.tar",
                            "file_size": 35891374080,
                            "uuid": "3e8a17d1-e07f-4226-bd6a-a4ca13606528",
                            "@id": "/files-processed/GAPFI7TBYWC7/",
                            "@type": [
                                "FileProcessed",
                                "File",
                                "Item"
                            ],
                            "file_format": {
                                "@id": "/file-formats/rck_tar/",
                                "uuid": "39f836d8-bbb1-46c7-80d4-e321d4a44204",
                                "status": "shared",
                                "@type": [
                                    "FileFormat",
                                    "Item"
                                ],
                                "display_title": "rck_tar",
                                "principals_allowed": {
                                    "view": [
                                        "system.Authenticated"
                                    ],
                                    "edit": [
                                        "group.admin"
                                    ]
                                }
                            },
                            "status": "uploaded",
                            "principals_allowed": {
                                "view": [
                                    "editor_for.12a92962-8265-4fc0-b2f8-cf14f05db58b",
                                    "group.admin",
                                    "group.read-only-admin",
                                    "remoteuser.EMBED",
                                    "remoteuser.INDEXER"
                                ],
                                "edit": [
                                    "editor_for.12a92962-8265-4fc0-b2f8-cf14f05db58b",
                                    "group.admin"
                                ]
                            }
                        },
                        "ordinal": 1,
                        "dimension": "0",
                        "workflow_argument_name": "trio"
                    }
                ],
                "awsem_job_id": "xFRcGVgRfaTn",
                "date_created": "2022-04-30T02:55:36.144407+00:00",
                "output_files": [
                    {
                        "type": "Output processed file",
                        "value": {
                            "@type": [
                                "FileProcessed",
                                "File",
                                "Item"
                            ],
                            "display_title": "GAPFIRZZWDQL.vcf.gz",
                            "@id": "/files-processed/GAPFIRZZWDQL/",
                            "status": "uploaded",
                            "file_size": 4980651,
                            "accession": "GAPFIRZZWDQL",
                            "href": "/files-processed/GAPFIRZZWDQL/@@download/GAPFIRZZWDQL.vcf.gz",
                            "uuid": "0d5b70d8-3ab9-474b-92ff-0b41bfa1919b",
                            "file_format": {
                                "status": "shared",
                                "@type": [
                                    "FileFormat",
                                    "Item"
                                ],
                                "@id": "/file-formats/vcf_gz/",
                                "uuid": "1b8f525f-aecb-4211-9ae5-a2c998b05599",
                                "display_title": "vcf_gz",
                                "principals_allowed": {
                                    "view": [
                                        "system.Authenticated"
                                    ],
                                    "edit": [
                                        "group.admin"
                                    ]
                                }
                            },
                            "quality_metric": {
                                "@type": [
                                    "QualityMetricQclist",
                                    "QualityMetric",
                                    "Item"
                                ],
                                "@id": "/quality-metrics-qclist/8c3fe2b7-5186-451d-b273-b775f65afdf4/",
                                "display_title": "QualityMetricQclist from 2022-04-30",
                                "status": "shared",
                                "uuid": "8c3fe2b7-5186-451d-b273-b775f65afdf4",
                                "overall_quality_status": "PASS",
                                "principals_allowed": {
                                    "view": [
                                        "system.Authenticated"
                                    ],
                                    "edit": [
                                        "group.admin"
                                    ]
                                }
                            },
                            "principals_allowed": {
                                "view": [
                                    "editor_for.12a92962-8265-4fc0-b2f8-cf14f05db58b",
                                    "group.admin",
                                    "group.read-only-admin",
                                    "remoteuser.EMBED",
                                    "remoteuser.INDEXER"
                                ],
                                "edit": [
                                    "editor_for.12a92962-8265-4fc0-b2f8-cf14f05db58b",
                                    "group.admin"
                                ]
                            }
                        },
                        "format": "/file-formats/vcf_gz/",
                        "upload_key": "0d5b70d8-3ab9-474b-92ff-0b41bfa1919b/GAPFIRZZWDQL.vcf.gz",
                        "extra_files": [
                            {
                                "href": "/0d5b70d8-3ab9-474b-92ff-0b41bfa1919b/@@download/GAPFIRZZWDQL.vcf.gz.tbi",
                                "uuid": "0d5b70d8-3ab9-474b-92ff-0b41bfa1919b",
                                "status": "uploading",
                                "filename": "GAPFIRZZWDQL",
                                "accession": "GAPFIRZZWDQL",
                                "upload_key": "0d5b70d8-3ab9-474b-92ff-0b41bfa1919b/GAPFIRZZWDQL.vcf.gz.tbi",
                                "file_format": "/file-formats/vcf_gz_tbi/"
                            }
                        ],
                        "secondary_file_formats": [
                            "/file-formats/vcf_gz_tbi/"
                        ],
                        "workflow_argument_name": "novoCaller_vcf"
                    },
                    {
                        "type": "Output QC file",
                        "value_qc": {
                            "@type": [
                                "QualityMetricVcfcheck",
                                "QualityMetric",
                                "Item"
                            ],
                            "status": "shared",
                            "uuid": "0ce4f49b-05dc-433e-b950-a16076912205",
                            "display_title": "QualityMetricVcfcheck from 2022-04-30",
                            "overall_quality_status": "PASS",
                            "@id": "/quality-metrics-vcfcheck/0ce4f49b-05dc-433e-b950-a16076912205/",
                            "principals_allowed": {
                                "view": [
                                    "system.Authenticated"
                                ],
                                "edit": [
                                    "group.admin"
                                ]
                            }
                        },
                        "workflow_argument_name": "novoCaller_vcf-check"
                    }
                ],
                "run_platform": "AWSEM",
                "submitted_by": {
                    "@type": [
                        "User",
                        "Item"
                    ],
                    "status": "current",
                    "@id": "/users/b041dba8-e2b2-4e54-a621-97edb508a0c4/",
                    "display_title": "Tibanna App",
                    "uuid": "b041dba8-e2b2-4e54-a621-97edb508a0c4",
                    "principals_allowed": {
                        "view": [
                            "group.admin",
                            "remoteuser.EMBED",
                            "remoteuser.INDEXER",
                            "userid.b041dba8-e2b2-4e54-a621-97edb508a0c4"
                        ],
                        "edit": [
                            "group.admin"
                        ]
                    }
                },
                "last_modified": {
                    "modified_by": {
                        "@id": "/users/7677f8a8-79d2-4cff-ab0a-a967a2a68e39/",
                        "uuid": "7677f8a8-79d2-4cff-ab0a-a967a2a68e39",
                        "display_title": "Foursight App",
                        "@type": [
                            "User",
                            "Item"
                        ],
                        "status": "current",
                        "principals_allowed": {
                            "view": [
                                "group.admin",
                                "remoteuser.EMBED",
                                "remoteuser.INDEXER",
                                "userid.7677f8a8-79d2-4cff-ab0a-a967a2a68e39"
                            ],
                            "edit": [
                                "group.admin"
                            ]
                        }
                    },
                    "date_modified": "2022-04-30T10:00:28.931080+00:00"
                },
                "metadata_only": false,
                "awsem_app_name": "workflow_granite-novoCaller-rck-check",
                "quality_metric": {
                    "status": "shared",
                    "uuid": "c7441f7b-eaa8-4011-bf58-7bb32aae06f1",
                    "display_title": "QualityMetricWorkflowrun from 2022-04-30",
                    "@type": [
                        "QualityMetricWorkflowrun",
                        "QualityMetric",
                        "Item"
                    ],
                    "@id": "/quality-metrics-workflowrun/c7441f7b-eaa8-4011-bf58-7bb32aae06f1/",
                    "principals_allowed": {
                        "view": [
                            "system.Authenticated"
                        ],
                        "edit": [
                            "group.admin"
                        ]
                    }
                },
                "schema_version": "3",
                "awsem_postrun_json": "https://s3.amazonaws.com/cgap-biotest-main-application-tibanna-output/xFRcGVgRfaTn.postrun.json",
                "associated_meta_workflow_runs": [
                    "a77b8431-2936-4f87-8405-8aa43ee777c1"
                ],
                "@id": "/workflow-runs-awsem/2160c911-2d1b-466b-9643-ed30c74228a8/",
                "@type": [
                    "WorkflowRunAwsem",
                    "WorkflowRun",
                    "Item"
                ],
                "uuid": "2160c911-2d1b-466b-9643-ed30c74228a8",
                "principals_allowed": {
                    "view": [
                        "system.Authenticated"
                    ],
                    "edit": [
                        "group.admin"
                    ]
                },
                "display_title": "workflow_granite-novoCaller-rck-check v1.0.0 run 2022-04-30 02:55:36.042917",
                "@context": "/terms/",
                "actions": [
                    {
                        "name": "create",
                        "title": "Create",
                        "profile": "/profiles/WorkflowRunAwsem.json",
                        "href": "/workflow-runs-awsem/2160c911-2d1b-466b-9643-ed30c74228a8/?currentAction=create"
                    },
                    {
                        "name": "edit",
                        "title": "Edit",
                        "profile": "/profiles/WorkflowRunAwsem.json",
                        "href": "/workflow-runs-awsem/2160c911-2d1b-466b-9643-ed30c74228a8/?currentAction=edit"
                    }
                ]
            }
        },
        {
            "name": "workflow_granite-qcVCF-3",
            "jobid": "RZbFVWSkL5EX",
            "shard": "0",
            "status": "completed",
            "dependencies": [
                "workflow_granite-filtering-check:0"
            ],
            "workflow_run": {
                "title": "workflow_granite-qcVCF v1.0.0 run 2022-04-30 02:55:39.004849",
                "status": "shared",
                "run_url": "https://console.aws.amazon.com/states/home?region=us-east-1#/executions/details/arn:aws:states:us-east-1:922729568532:execution:tibanna_zebra_cgap-wolf:run_workflow_granite-qcVCF-2a2effee-ac1c-472d-aed9-c726ab259925",
                "parameters": [
                    {
                        "value": "[{\"parents\": [\"GAPIDUZDOX4R\", \"GAPIDQV37Z5Y\"], \"individual\": \"GAPID43VJKQ6\", \"sample_name\": \"NA12879_sample-WGS\", \"gender\": \"F\"}, {\"parents\": [], \"individual\": \"GAPIDUZDOX4R\", \"sample_name\": \"NA12878_sample-WGS\", \"gender\": \"F\"}, {\"parents\": [], \"individual\": \"GAPIDQV37Z5Y\", \"sample_name\": \"NA12877_sample-WGS\", \"gender\": \"M\"}]",
                        "ordinal": 1,
                        "dimension": "0",
                        "workflow_argument_name": "pedigree"
                    },
                    {
                        "value": "['NA12879_sample-WGS', 'NA12878_sample-WGS', 'NA12877_sample-WGS']",
                        "ordinal": 1,
                        "dimension": "0",
                        "workflow_argument_name": "samples"
                    },
                    {
                        "value": "True",
                        "ordinal": 1,
                        "dimension": "0",
                        "workflow_argument_name": "trio_errors"
                    },
                    {
                        "value": "False",
                        "ordinal": 1,
                        "dimension": "0",
                        "workflow_argument_name": "het_hom"
                    },
                    {
                        "value": "False",
                        "ordinal": 1,
                        "dimension": "0",
                        "workflow_argument_name": "ti_tv"
                    }
                ],
                "run_status": "complete",
                "input_files": [
                    {
                        "value": {
                            "display_title": "GAPFIF8PBOT6.vcf.gz",
                            "uuid": "c11cb753-5ae1-4298-b714-e30b67b46653",
                            "status": "uploaded",
                            "file_size": 4212759,
                            "href": "/files-processed/GAPFIF8PBOT6/@@download/GAPFIF8PBOT6.vcf.gz",
                            "@id": "/files-processed/GAPFIF8PBOT6/",
                            "accession": "GAPFIF8PBOT6",
                            "@type": [
                                "FileProcessed",
                                "File",
                                "Item"
                            ],
                            "file_format": {
                                "@type": [
                                    "FileFormat",
                                    "Item"
                                ],
                                "status": "shared",
                                "@id": "/file-formats/vcf_gz/",
                                "uuid": "1b8f525f-aecb-4211-9ae5-a2c998b05599",
                                "display_title": "vcf_gz",
                                "principals_allowed": {
                                    "view": [
                                        "system.Authenticated"
                                    ],
                                    "edit": [
                                        "group.admin"
                                    ]
                                }
                            },
                            "principals_allowed": {
                                "view": [
                                    "editor_for.12a92962-8265-4fc0-b2f8-cf14f05db58b",
                                    "group.admin",
                                    "group.read-only-admin",
                                    "remoteuser.EMBED",
                                    "remoteuser.INDEXER"
                                ],
                                "edit": [
                                    "editor_for.12a92962-8265-4fc0-b2f8-cf14f05db58b",
                                    "group.admin"
                                ]
                            },
                            "quality_metric": {
                                "overall_quality_status": "PASS",
                                "uuid": "22c5255f-ef08-4660-8524-887067eebb2e",
                                "@id": "/quality-metrics-qclist/22c5255f-ef08-4660-8524-887067eebb2e/",
                                "@type": [
                                    "QualityMetricQclist",
                                    "QualityMetric",
                                    "Item"
                                ],
                                "status": "shared",
                                "display_title": "QualityMetricQclist from 2022-04-30",
                                "principals_allowed": {
                                    "view": [
                                        "system.Authenticated"
                                    ],
                                    "edit": [
                                        "group.admin"
                                    ]
                                }
                            }
                        },
                        "ordinal": 1,
                        "dimension": "0",
                        "workflow_argument_name": "input_vcf"
                    }
                ],
                "institution": {
                    "uuid": "828cd4fe-ebb0-4b36-a94a-d2e3a36cc989",
                    "@type": [
                        "Institution",
                        "Item"
                    ],
                    "status": "current",
                    "display_title": "HMS DBMI",
                    "@id": "/institutions/hms-dbmi/",
                    "principals_allowed": {
                        "view": [
                            "group.admin",
                            "group.read-only-admin",
                            "remoteuser.EMBED",
                            "remoteuser.INDEXER"
                        ],
                        "edit": [
                            "group.admin"
                        ]
                    }
                },
                "awsem_job_id": "RZbFVWSkL5EX",
                "date_created": "2022-04-30T02:55:39.082405+00:00",
                "output_files": [
                    {
                        "type": "Output QC file",
                        "value_qc": {
                            "uuid": "dd4ca4bd-746c-483e-8c49-0ff28d6e5aa3",
                            "status": "shared",
                            "@id": "/quality-metrics-vcfqc/dd4ca4bd-746c-483e-8c49-0ff28d6e5aa3/",
                            "display_title": "QualityMetricVcfqc from 2022-04-30",
                            "overall_quality_status": "PASS",
                            "@type": [
                                "QualityMetricVcfqc",
                                "QualityMetric",
                                "Item"
                            ],
                            "principals_allowed": {
                                "view": [
                                    "system.Authenticated"
                                ],
                                "edit": [
                                    "group.admin"
                                ]
                            }
                        },
                        "workflow_argument_name": "qc_json"
                    },
                    {
                        "type": "Output QC file",
                        "value_qc": {
                            "uuid": "dd4ca4bd-746c-483e-8c49-0ff28d6e5aa3",
                            "status": "shared",
                            "@id": "/quality-metrics-vcfqc/dd4ca4bd-746c-483e-8c49-0ff28d6e5aa3/",
                            "display_title": "QualityMetricVcfqc from 2022-04-30",
                            "overall_quality_status": "PASS",
                            "@type": [
                                "QualityMetricVcfqc",
                                "QualityMetric",
                                "Item"
                            ],
                            "principals_allowed": {
                                "view": [
                                    "system.Authenticated"
                                ],
                                "edit": [
                                    "group.admin"
                                ]
                            }
                        },
                        "workflow_argument_name": "uniq_variants"
                    }
                ],
                "run_platform": "AWSEM",
                "submitted_by": {
                    "status": "current",
                    "@type": [
                        "User",
                        "Item"
                    ],
                    "display_title": "Tibanna App",
                    "uuid": "b041dba8-e2b2-4e54-a621-97edb508a0c4",
                    "@id": "/users/b041dba8-e2b2-4e54-a621-97edb508a0c4/",
                    "principals_allowed": {
                        "view": [
                            "group.admin",
                            "remoteuser.EMBED",
                            "remoteuser.INDEXER",
                            "userid.b041dba8-e2b2-4e54-a621-97edb508a0c4"
                        ],
                        "edit": [
                            "group.admin"
                        ]
                    }
                },
                "last_modified": {
                    "modified_by": {
                        "@type": [
                            "User",
                            "Item"
                        ],
                        "display_title": "Foursight App",
                        "status": "current",
                        "@id": "/users/7677f8a8-79d2-4cff-ab0a-a967a2a68e39/",
                        "uuid": "7677f8a8-79d2-4cff-ab0a-a967a2a68e39",
                        "principals_allowed": {
                            "view": [
                                "group.admin",
                                "remoteuser.EMBED",
                                "remoteuser.INDEXER",
                                "userid.7677f8a8-79d2-4cff-ab0a-a967a2a68e39"
                            ],
                            "edit": [
                                "group.admin"
                            ]
                        }
                    },
                    "date_modified": "2022-04-30T10:00:28.822699+00:00"
                },
                "metadata_only": false,
                "awsem_app_name": "workflow_granite-qcVCF",
                "quality_metric": {
                    "uuid": "90aa88d7-ac32-49d8-8154-e46e84f4e47e",
                    "status": "shared",
                    "@type": [
                        "QualityMetricWorkflowrun",
                        "QualityMetric",
                        "Item"
                    ],
                    "display_title": "QualityMetricWorkflowrun from 2022-04-30",
                    "@id": "/quality-metrics-workflowrun/90aa88d7-ac32-49d8-8154-e46e84f4e47e/",
                    "principals_allowed": {
                        "view": [
                            "system.Authenticated"
                        ],
                        "edit": [
                            "group.admin"
                        ]
                    }
                },
                "schema_version": "3",
                "awsem_postrun_json": "https://s3.amazonaws.com/cgap-biotest-main-application-tibanna-output/RZbFVWSkL5EX.postrun.json",
                "associated_meta_workflow_runs": [
                    "a77b8431-2936-4f87-8405-8aa43ee777c1"
                ],
                "@id": "/workflow-runs-awsem/99c36be0-a667-456a-9b8c-b08bb3b4da17/",
                "@type": [
                    "WorkflowRunAwsem",
                    "WorkflowRun",
                    "Item"
                ],
                "uuid": "99c36be0-a667-456a-9b8c-b08bb3b4da17",
                "principals_allowed": {
                    "view": [
                        "system.Authenticated"
                    ],
                    "edit": [
                        "group.admin"
                    ]
                },
                "display_title": "workflow_granite-qcVCF v1.0.0 run 2022-04-30 02:55:39.004849",
                "@context": "/terms/"
            }
        },
        {
            "name": "workflow_granite-qcVCF-4",
            "jobid": "2QC54BLxxGcw",
            "shard": "0",
            "status": "completed",
            "dependencies": [
                "workflow_granite-novoCaller-rck-check:0"
            ],
            "workflow_run": {
                "title": "workflow_granite-qcVCF v1.0.0 run 2022-04-30 05:10:33.627859",
                "status": "shared",
                "run_url": "https://console.aws.amazon.com/states/home?region=us-east-1#/executions/details/arn:aws:states:us-east-1:922729568532:execution:tibanna_zebra_cgap-wolf:run_workflow_granite-qcVCF-fb7d9ff3-e341-4ad0-955c-81825b203c79",
                "parameters": [
                    {
                        "value": "[{\"parents\": [\"GAPIDUZDOX4R\", \"GAPIDQV37Z5Y\"], \"individual\": \"GAPID43VJKQ6\", \"sample_name\": \"NA12879_sample-WGS\", \"gender\": \"F\"}, {\"parents\": [], \"individual\": \"GAPIDUZDOX4R\", \"sample_name\": \"NA12878_sample-WGS\", \"gender\": \"F\"}, {\"parents\": [], \"individual\": \"GAPIDQV37Z5Y\", \"sample_name\": \"NA12877_sample-WGS\", \"gender\": \"M\"}]",
                        "ordinal": 1,
                        "dimension": "0",
                        "workflow_argument_name": "pedigree"
                    },
                    {
                        "value": "['NA12879_sample-WGS', 'NA12878_sample-WGS', 'NA12877_sample-WGS']",
                        "ordinal": 1,
                        "dimension": "0",
                        "workflow_argument_name": "samples"
                    },
                    {
                        "value": "True",
                        "ordinal": 1,
                        "dimension": "0",
                        "workflow_argument_name": "trio_errors"
                    },
                    {
                        "value": "False",
                        "ordinal": 1,
                        "dimension": "0",
                        "workflow_argument_name": "het_hom"
                    },
                    {
                        "value": "False",
                        "ordinal": 1,
                        "dimension": "0",
                        "workflow_argument_name": "ti_tv"
                    }
                ],
                "run_status": "complete",
                "input_files": [
                    {
                        "value": {
                            "uuid": "0d5b70d8-3ab9-474b-92ff-0b41bfa1919b",
                            "href": "/files-processed/GAPFIRZZWDQL/@@download/GAPFIRZZWDQL.vcf.gz",
                            "@id": "/files-processed/GAPFIRZZWDQL/",
                            "accession": "GAPFIRZZWDQL",
                            "display_title": "GAPFIRZZWDQL.vcf.gz",
                            "file_size": 4980651,
                            "@type": [
                                "FileProcessed",
                                "File",
                                "Item"
                            ],
                            "status": "uploaded",
                            "file_format": {
                                "uuid": "1b8f525f-aecb-4211-9ae5-a2c998b05599",
                                "status": "shared",
                                "@id": "/file-formats/vcf_gz/",
                                "display_title": "vcf_gz",
                                "@type": [
                                    "FileFormat",
                                    "Item"
                                ],
                                "principals_allowed": {
                                    "view": [
                                        "system.Authenticated"
                                    ],
                                    "edit": [
                                        "group.admin"
                                    ]
                                }
                            },
                            "quality_metric": {
                                "display_title": "QualityMetricQclist from 2022-04-30",
                                "@type": [
                                    "QualityMetricQclist",
                                    "QualityMetric",
                                    "Item"
                                ],
                                "uuid": "8c3fe2b7-5186-451d-b273-b775f65afdf4",
                                "@id": "/quality-metrics-qclist/8c3fe2b7-5186-451d-b273-b775f65afdf4/",
                                "status": "shared",
                                "overall_quality_status": "PASS",
                                "principals_allowed": {
                                    "view": [
                                        "system.Authenticated"
                                    ],
                                    "edit": [
                                        "group.admin"
                                    ]
                                }
                            },
                            "principals_allowed": {
                                "view": [
                                    "editor_for.12a92962-8265-4fc0-b2f8-cf14f05db58b",
                                    "group.admin",
                                    "group.read-only-admin",
                                    "remoteuser.EMBED",
                                    "remoteuser.INDEXER"
                                ],
                                "edit": [
                                    "editor_for.12a92962-8265-4fc0-b2f8-cf14f05db58b",
                                    "group.admin"
                                ]
                            }
                        },
                        "ordinal": 1,
                        "dimension": "0",
                        "workflow_argument_name": "input_vcf"
                    }
                ],
                "institution": {
                    "status": "current",
                    "uuid": "828cd4fe-ebb0-4b36-a94a-d2e3a36cc989",
                    "@id": "/institutions/hms-dbmi/",
                    "@type": [
                        "Institution",
                        "Item"
                    ],
                    "display_title": "HMS DBMI",
                    "principals_allowed": {
                        "view": [
                            "group.admin",
                            "group.read-only-admin",
                            "remoteuser.EMBED",
                            "remoteuser.INDEXER"
                        ],
                        "edit": [
                            "group.admin"
                        ]
                    }
                },
                "awsem_job_id": "2QC54BLxxGcw",
                "date_created": "2022-04-30T05:10:33.721805+00:00",
                "output_files": [
                    {
                        "type": "Output QC file",
                        "value_qc": {
                            "status": "shared",
                            "display_title": "QualityMetricVcfqc from 2022-04-30",
                            "@type": [
                                "QualityMetricVcfqc",
                                "QualityMetric",
                                "Item"
                            ],
                            "overall_quality_status": "PASS",
                            "@id": "/quality-metrics-vcfqc/8bd8d24f-e436-4e4b-92e3-b65932fd0b02/",
                            "uuid": "8bd8d24f-e436-4e4b-92e3-b65932fd0b02",
                            "principals_allowed": {
                                "view": [
                                    "system.Authenticated"
                                ],
                                "edit": [
                                    "group.admin"
                                ]
                            }
                        },
                        "workflow_argument_name": "qc_json"
                    },
                    {
                        "type": "Output QC file",
                        "value_qc": {
                            "status": "shared",
                            "display_title": "QualityMetricVcfqc from 2022-04-30",
                            "@type": [
                                "QualityMetricVcfqc",
                                "QualityMetric",
                                "Item"
                            ],
                            "overall_quality_status": "PASS",
                            "@id": "/quality-metrics-vcfqc/8bd8d24f-e436-4e4b-92e3-b65932fd0b02/",
                            "uuid": "8bd8d24f-e436-4e4b-92e3-b65932fd0b02",
                            "principals_allowed": {
                                "view": [
                                    "system.Authenticated"
                                ],
                                "edit": [
                                    "group.admin"
                                ]
                            }
                        },
                        "workflow_argument_name": "uniq_variants"
                    }
                ],
                "run_platform": "AWSEM",
                "submitted_by": {
                    "display_title": "Tibanna App",
                    "@type": [
                        "User",
                        "Item"
                    ],
                    "status": "current",
                    "uuid": "b041dba8-e2b2-4e54-a621-97edb508a0c4",
                    "@id": "/users/b041dba8-e2b2-4e54-a621-97edb508a0c4/",
                    "principals_allowed": {
                        "view": [
                            "group.admin",
                            "remoteuser.EMBED",
                            "remoteuser.INDEXER",
                            "userid.b041dba8-e2b2-4e54-a621-97edb508a0c4"
                        ],
                        "edit": [
                            "group.admin"
                        ]
                    }
                },
                "last_modified": {
                    "modified_by": {
                        "display_title": "Foursight App",
                        "status": "current",
                        "@type": [
                            "User",
                            "Item"
                        ],
                        "@id": "/users/7677f8a8-79d2-4cff-ab0a-a967a2a68e39/",
                        "uuid": "7677f8a8-79d2-4cff-ab0a-a967a2a68e39",
                        "principals_allowed": {
                            "view": [
                                "group.admin",
                                "remoteuser.EMBED",
                                "remoteuser.INDEXER",
                                "userid.7677f8a8-79d2-4cff-ab0a-a967a2a68e39"
                            ],
                            "edit": [
                                "group.admin"
                            ]
                        }
                    },
                    "date_modified": "2022-04-30T10:00:28.157850+00:00"
                },
                "metadata_only": false,
                "awsem_app_name": "workflow_granite-qcVCF",
                "quality_metric": {
                    "uuid": "43b770af-dcde-4262-980d-deb992154468",
                    "display_title": "QualityMetricWorkflowrun from 2022-04-30",
                    "@id": "/quality-metrics-workflowrun/43b770af-dcde-4262-980d-deb992154468/",
                    "@type": [
                        "QualityMetricWorkflowrun",
                        "QualityMetric",
                        "Item"
                    ],
                    "status": "shared",
                    "principals_allowed": {
                        "view": [
                            "system.Authenticated"
                        ],
                        "edit": [
                            "group.admin"
                        ]
                    }
                },
                "schema_version": "3",
                "awsem_postrun_json": "https://s3.amazonaws.com/cgap-biotest-main-application-tibanna-output/2QC54BLxxGcw.postrun.json",
                "associated_meta_workflow_runs": [
                    "a77b8431-2936-4f87-8405-8aa43ee777c1"
                ],
                "@id": "/workflow-runs-awsem/31fad2bc-d98e-446e-8cc5-a695aee8ba47/",
                "@type": [
                    "WorkflowRunAwsem",
                    "WorkflowRun",
                    "Item"
                ],
                "uuid": "31fad2bc-d98e-446e-8cc5-a695aee8ba47",
                "principals_allowed": {
                    "view": [
                        "system.Authenticated"
                    ],
                    "edit": [
                        "group.admin"
                    ]
                },
                "display_title": "workflow_granite-qcVCF v1.0.0 run 2022-04-30 05:10:33.627859",
                "@context": "/terms/",
                "actions": [
                    {
                        "name": "create",
                        "title": "Create",
                        "profile": "/profiles/WorkflowRunAwsem.json",
                        "href": "/workflow-runs-awsem/31fad2bc-d98e-446e-8cc5-a695aee8ba47/?currentAction=create"
                    },
                    {
                        "name": "edit",
                        "title": "Edit",
                        "profile": "/profiles/WorkflowRunAwsem.json",
                        "href": "/workflow-runs-awsem/31fad2bc-d98e-446e-8cc5-a695aee8ba47/?currentAction=edit"
                    }
                ]
            }
        },
        {
            "name": "workflow_granite-comHet-check",
            "jobid": "oSRPGbXqqrmk",
            "shard": "0",
            "output": [
                {
                    "file": {
                        "display_title": "GAPFIUXS6TY7.vcf.gz",
                        "status": "uploaded",
                        "@id": "/files-processed/GAPFIUXS6TY7/",
                        "uuid": "2bdf5b97-b382-4c11-a70a-b6a5210bf319",
                        "@type": [
                            "FileProcessed",
                            "File",
                            "Item"
                        ],
                        "principals_allowed": {
                            "view": [
                                "editor_for.12a92962-8265-4fc0-b2f8-cf14f05db58b",
                                "group.admin",
                                "group.read-only-admin",
                                "remoteuser.EMBED",
                                "remoteuser.INDEXER"
                            ],
                            "edit": [
                                "editor_for.12a92962-8265-4fc0-b2f8-cf14f05db58b",
                                "group.admin"
                            ]
                        }
                    },
                    "argument_name": "comHet_vcf"
                }
            ],
            "status": "completed",
            "dependencies": [
                "workflow_granite-novoCaller-rck-check:0"
            ],
            "workflow_run": {
                "title": "workflow_granite-comHet-check v1.0.0 run 2022-04-30 05:10:39.280286",
                "status": "shared",
                "parameters": [
                    {
                        "value": "['NA12879_sample-WGS', 'NA12878_sample-WGS', 'NA12877_sample-WGS']",
                        "ordinal": 1,
                        "dimension": "0",
                        "workflow_argument_name": "trio"
                    }
                ],
                "run_status": "complete",
                "input_files": [
                    {
                        "value": {
                            "accession": "GAPFIRZZWDQL",
                            "@id": "/files-processed/GAPFIRZZWDQL/",
                            "file_size": 4980651,
                            "href": "/files-processed/GAPFIRZZWDQL/@@download/GAPFIRZZWDQL.vcf.gz",
                            "display_title": "GAPFIRZZWDQL.vcf.gz",
                            "uuid": "0d5b70d8-3ab9-474b-92ff-0b41bfa1919b",
                            "file_format": {
                                "@id": "/file-formats/vcf_gz/",
                                "display_title": "vcf_gz",
                                "uuid": "1b8f525f-aecb-4211-9ae5-a2c998b05599",
                                "@type": [
                                    "FileFormat",
                                    "Item"
                                ],
                                "status": "shared",
                                "principals_allowed": {
                                    "view": [
                                        "system.Authenticated"
                                    ],
                                    "edit": [
                                        "group.admin"
                                    ]
                                }
                            },
                            "status": "uploaded",
                            "@type": [
                                "FileProcessed",
                                "File",
                                "Item"
                            ],
                            "quality_metric": {
                                "uuid": "8c3fe2b7-5186-451d-b273-b775f65afdf4",
                                "@id": "/quality-metrics-qclist/8c3fe2b7-5186-451d-b273-b775f65afdf4/",
                                "display_title": "QualityMetricQclist from 2022-04-30",
                                "overall_quality_status": "PASS",
                                "status": "shared",
                                "@type": [
                                    "QualityMetricQclist",
                                    "QualityMetric",
                                    "Item"
                                ],
                                "principals_allowed": {
                                    "view": [
                                        "system.Authenticated"
                                    ],
                                    "edit": [
                                        "group.admin"
                                    ]
                                }
                            },
                            "principals_allowed": {
                                "view": [
                                    "editor_for.12a92962-8265-4fc0-b2f8-cf14f05db58b",
                                    "group.admin",
                                    "group.read-only-admin",
                                    "remoteuser.EMBED",
                                    "remoteuser.INDEXER"
                                ],
                                "edit": [
                                    "editor_for.12a92962-8265-4fc0-b2f8-cf14f05db58b",
                                    "group.admin"
                                ]
                            }
                        },
                        "ordinal": 1,
                        "dimension": "0",
                        "workflow_argument_name": "input_vcf"
                    }
                ],
                "institution": {
                    "@type": [
                        "Institution",
                        "Item"
                    ],
                    "display_title": "HMS DBMI",
                    "status": "current",
                    "uuid": "828cd4fe-ebb0-4b36-a94a-d2e3a36cc989",
                    "@id": "/institutions/hms-dbmi/",
                    "principals_allowed": {
                        "view": [
                            "group.admin",
                            "group.read-only-admin",
                            "remoteuser.EMBED",
                            "remoteuser.INDEXER"
                        ],
                        "edit": [
                            "group.admin"
                        ]
                    }
                },
                "awsem_job_id": "oSRPGbXqqrmk",
                "date_created": "2022-04-30T05:10:39.363643+00:00",
                "output_files": [
                    {
                        "type": "Output processed file",
                        "value": {
                            "file_format": {
                                "display_title": "vcf_gz",
                                "@type": [
                                    "FileFormat",
                                    "Item"
                                ],
                                "uuid": "1b8f525f-aecb-4211-9ae5-a2c998b05599",
                                "status": "shared",
                                "@id": "/file-formats/vcf_gz/",
                                "principals_allowed": {
                                    "view": [
                                        "system.Authenticated"
                                    ],
                                    "edit": [
                                        "group.admin"
                                    ]
                                }
                            },
                            "file_size": 5015079,
                            "accession": "GAPFIUXS6TY7",
                            "uuid": "2bdf5b97-b382-4c11-a70a-b6a5210bf319",
                            "@type": [
                                "FileProcessed",
                                "File",
                                "Item"
                            ],
                            "@id": "/files-processed/GAPFIUXS6TY7/",
                            "href": "/files-processed/GAPFIUXS6TY7/@@download/GAPFIUXS6TY7.vcf.gz",
                            "display_title": "GAPFIUXS6TY7.vcf.gz",
                            "status": "uploaded",
                            "quality_metric": {
                                "status": "shared",
                                "overall_quality_status": "PASS",
                                "display_title": "QualityMetricQclist from 2022-04-30",
                                "@type": [
                                    "QualityMetricQclist",
                                    "QualityMetric",
                                    "Item"
                                ],
                                "@id": "/quality-metrics-qclist/06a62061-7f6f-4e9e-995d-24c274509290/",
                                "uuid": "06a62061-7f6f-4e9e-995d-24c274509290",
                                "principals_allowed": {
                                    "view": [
                                        "system.Authenticated"
                                    ],
                                    "edit": [
                                        "group.admin"
                                    ]
                                }
                            },
                            "principals_allowed": {
                                "view": [
                                    "editor_for.12a92962-8265-4fc0-b2f8-cf14f05db58b",
                                    "group.admin",
                                    "group.read-only-admin",
                                    "remoteuser.EMBED",
                                    "remoteuser.INDEXER"
                                ],
                                "edit": [
                                    "editor_for.12a92962-8265-4fc0-b2f8-cf14f05db58b",
                                    "group.admin"
                                ]
                            }
                        },
                        "format": "/file-formats/vcf_gz/",
                        "upload_key": "2bdf5b97-b382-4c11-a70a-b6a5210bf319/GAPFIUXS6TY7.vcf.gz",
                        "extra_files": [
                            {
                                "href": "/2bdf5b97-b382-4c11-a70a-b6a5210bf319/@@download/GAPFIUXS6TY7.vcf.gz.tbi",
                                "uuid": "2bdf5b97-b382-4c11-a70a-b6a5210bf319",
                                "status": "uploading",
                                "filename": "GAPFIUXS6TY7",
                                "accession": "GAPFIUXS6TY7",
                                "upload_key": "2bdf5b97-b382-4c11-a70a-b6a5210bf319/GAPFIUXS6TY7.vcf.gz.tbi",
                                "file_format": "/file-formats/vcf_gz_tbi/"
                            }
                        ],
                        "secondary_file_formats": [
                            "/file-formats/vcf_gz_tbi/"
                        ],
                        "workflow_argument_name": "comHet_vcf"
                    },
                    {
                        "type": "Output QC file",
                        "value_qc": {
                            "overall_quality_status": "PASS",
                            "status": "shared",
                            "@type": [
                                "QualityMetricCmphet",
                                "QualityMetric",
                                "Item"
                            ],
                            "display_title": "QualityMetricCmphet from 2022-04-30",
                            "uuid": "ef24dd65-a246-4a54-9150-5357a2c31ef5",
                            "@id": "/quality-metrics-cmphet/ef24dd65-a246-4a54-9150-5357a2c31ef5/",
                            "principals_allowed": {
                                "view": [
                                    "system.Authenticated"
                                ],
                                "edit": [
                                    "group.admin"
                                ]
                            }
                        },
                        "workflow_argument_name": "comHet_vcf-json"
                    },
                    {
                        "type": "Output QC file",
                        "value_qc": {
                            "overall_quality_status": "PASS",
                            "status": "shared",
                            "@type": [
                                "QualityMetricVcfcheck",
                                "QualityMetric",
                                "Item"
                            ],
                            "display_title": "QualityMetricVcfcheck from 2022-04-30",
                            "uuid": "fc95bc98-e6eb-4168-9a71-90c4e3b2979b",
                            "@id": "/quality-metrics-vcfcheck/fc95bc98-e6eb-4168-9a71-90c4e3b2979b/",
                            "principals_allowed": {
                                "view": [
                                    "system.Authenticated"
                                ],
                                "edit": [
                                    "group.admin"
                                ]
                            }
                        },
                        "workflow_argument_name": "comHet_vcf-check"
                    }
                ],
                "run_platform": "AWSEM",
                "submitted_by": {
                    "@type": [
                        "User",
                        "Item"
                    ],
                    "@id": "/users/b041dba8-e2b2-4e54-a621-97edb508a0c4/",
                    "display_title": "Tibanna App",
                    "uuid": "b041dba8-e2b2-4e54-a621-97edb508a0c4",
                    "status": "current",
                    "principals_allowed": {
                        "view": [
                            "group.admin",
                            "remoteuser.EMBED",
                            "remoteuser.INDEXER",
                            "userid.b041dba8-e2b2-4e54-a621-97edb508a0c4"
                        ],
                        "edit": [
                            "group.admin"
                        ]
                    }
                },
                "last_modified": {
                    "modified_by": {
                        "display_title": "Foursight App",
                        "@id": "/users/7677f8a8-79d2-4cff-ab0a-a967a2a68e39/",
                        "status": "current",
                        "uuid": "7677f8a8-79d2-4cff-ab0a-a967a2a68e39",
                        "@type": [
                            "User",
                            "Item"
                        ],
                        "principals_allowed": {
                            "view": [
                                "group.admin",
                                "remoteuser.EMBED",
                                "remoteuser.INDEXER",
                                "userid.7677f8a8-79d2-4cff-ab0a-a967a2a68e39"
                            ],
                            "edit": [
                                "group.admin"
                            ]
                        }
                    },
                    "date_modified": "2022-04-30T10:00:28.036985+00:00"
                },
                "metadata_only": false,
                "awsem_app_name": "workflow_granite-comHet-check",
                "quality_metric": {
                    "status": "shared",
                    "uuid": "31102ce4-026b-443e-a177-1d06d010a9e1",
                    "@type": [
                        "QualityMetricWorkflowrun",
                        "QualityMetric",
                        "Item"
                    ],
                    "@id": "/quality-metrics-workflowrun/31102ce4-026b-443e-a177-1d06d010a9e1/",
                    "display_title": "QualityMetricWorkflowrun from 2022-04-30",
                    "principals_allowed": {
                        "view": [
                            "system.Authenticated"
                        ],
                        "edit": [
                            "group.admin"
                        ]
                    }
                },
                "schema_version": "3",
                "awsem_postrun_json": "https://s3.amazonaws.com/cgap-biotest-main-application-tibanna-output/oSRPGbXqqrmk.postrun.json",
                "associated_meta_workflow_runs": [
                    "a77b8431-2936-4f87-8405-8aa43ee777c1"
                ],
                "@id": "/workflow-runs-awsem/e71195e4-f32c-4cf7-866b-15b522b3998c/",
                "@type": [
                    "WorkflowRunAwsem",
                    "WorkflowRun",
                    "Item"
                ],
                "uuid": "e71195e4-f32c-4cf7-866b-15b522b3998c",
                "principals_allowed": {
                    "view": [
                        "system.Authenticated"
                    ],
                    "edit": [
                        "group.admin"
                    ]
                },
                "display_title": "workflow_granite-comHet-check v1.0.0 run 2022-04-30 05:10:39.280286",
                "@context": "/terms/",
                "actions": [
                    {
                        "name": "create",
                        "title": "Create",
                        "profile": "/profiles/WorkflowRunAwsem.json",
                        "href": "/workflow-runs-awsem/e71195e4-f32c-4cf7-866b-15b522b3998c/?currentAction=create"
                    },
                    {
                        "name": "edit",
                        "title": "Edit",
                        "profile": "/profiles/WorkflowRunAwsem.json",
                        "href": "/workflow-runs-awsem/e71195e4-f32c-4cf7-866b-15b522b3998c/?currentAction=edit"
                    }
                ]
            }
        },
        {
            "name": "workflow_dbSNP_ID_fixer-check",
            "jobid": "vAjaUx5vdAgX",
            "shard": "0",
            "output": [
                {
                    "file": {
                        "display_title": "GAPFI7UFWBGA.vcf.gz",
                        "status": "uploaded",
                        "@id": "/files-processed/GAPFI7UFWBGA/",
                        "uuid": "352d3ace-c687-41de-9027-db84bf8af10a",
                        "@type": [
                            "FileProcessed",
                            "File",
                            "Item"
                        ],
                        "principals_allowed": {
                            "view": [
                                "editor_for.12a92962-8265-4fc0-b2f8-cf14f05db58b",
                                "group.admin",
                                "group.read-only-admin",
                                "remoteuser.EMBED",
                                "remoteuser.INDEXER"
                            ],
                            "edit": [
                                "editor_for.12a92962-8265-4fc0-b2f8-cf14f05db58b",
                                "group.admin"
                            ]
                        }
                    },
                    "argument_name": "vcf"
                }
            ],
            "status": "completed",
            "dependencies": [
                "workflow_granite-comHet-check:0"
            ],
            "workflow_run": {
                "title": "workflow_dbSNP_ID_fixer-check v1.0.0 run 2022-04-30 05:40:37.109983",
                "status": "shared",
                "project": {
                    "status": "shared",
                    "@type": [
                        "Project",
                        "Item"
                    ],
                    "display_title": "CGAP Core",
                    "uuid": "12a92962-8265-4fc0-b2f8-cf14f05db58b",
                    "@id": "/projects/cgap-core/",
                    "principals_allowed": {
                        "view": [
                            "system.Authenticated"
                        ],
                        "edit": [
                            "group.admin"
                        ]
                    }
                },
                "run_url": "https://console.aws.amazon.com/states/home?region=us-east-1#/executions/details/arn:aws:states:us-east-1:922729568532:execution:tibanna_zebra_cgap-wolf:run_workflow_dbSNP_ID_fixer-check-94b7f323-81ec-4f20-bafa-2fa6a3e2a5d7",
                "parameters": [],
                "run_status": "complete",
                "input_files": [
                    {
                        "value": {
                            "accession": "GAPFIUXS6TY7",
                            "display_title": "GAPFIUXS6TY7.vcf.gz",
                            "href": "/files-processed/GAPFIUXS6TY7/@@download/GAPFIUXS6TY7.vcf.gz",
                            "file_size": 5015079,
                            "uuid": "2bdf5b97-b382-4c11-a70a-b6a5210bf319",
                            "@id": "/files-processed/GAPFIUXS6TY7/",
                            "@type": [
                                "FileProcessed",
                                "File",
                                "Item"
                            ],
                            "file_format": {
                                "@id": "/file-formats/vcf_gz/",
                                "uuid": "1b8f525f-aecb-4211-9ae5-a2c998b05599",
                                "status": "shared",
                                "@type": [
                                    "FileFormat",
                                    "Item"
                                ],
                                "display_title": "vcf_gz",
                                "principals_allowed": {
                                    "view": [
                                        "system.Authenticated"
                                    ],
                                    "edit": [
                                        "group.admin"
                                    ]
                                }
                            },
                            "status": "uploaded",
                            "quality_metric": {
                                "status": "shared",
                                "@id": "/quality-metrics-qclist/06a62061-7f6f-4e9e-995d-24c274509290/",
                                "overall_quality_status": "PASS",
                                "uuid": "06a62061-7f6f-4e9e-995d-24c274509290",
                                "@type": [
                                    "QualityMetricQclist",
                                    "QualityMetric",
                                    "Item"
                                ],
                                "display_title": "QualityMetricQclist from 2022-04-30",
                                "principals_allowed": {
                                    "view": [
                                        "system.Authenticated"
                                    ],
                                    "edit": [
                                        "group.admin"
                                    ]
                                }
                            },
                            "principals_allowed": {
                                "view": [
                                    "editor_for.12a92962-8265-4fc0-b2f8-cf14f05db58b",
                                    "group.admin",
                                    "group.read-only-admin",
                                    "remoteuser.EMBED",
                                    "remoteuser.INDEXER"
                                ],
                                "edit": [
                                    "editor_for.12a92962-8265-4fc0-b2f8-cf14f05db58b",
                                    "group.admin"
                                ]
                            }
                        },
                        "ordinal": 1,
                        "dimension": "0",
                        "workflow_argument_name": "input_vcf"
                    },
                    {
                        "value": {
                            "accession": "GAPFIF4JKLTH",
                            "display_title": "GAPFIF4JKLTH.vcf.gz",
                            "href": "/files-reference/GAPFIF4JKLTH/@@download/GAPFIF4JKLTH.vcf.gz",
                            "file_size": 6596050744,
                            "uuid": "aa542c8e-b31c-4cff-b2d4-aa4037bb913c",
                            "@id": "/files-reference/GAPFIF4JKLTH/",
                            "@type": [
                                "FileReference",
                                "File",
                                "Item"
                            ],
                            "file_format": {
                                "@id": "/file-formats/vcf_gz/",
                                "uuid": "1b8f525f-aecb-4211-9ae5-a2c998b05599",
                                "status": "shared",
                                "@type": [
                                    "FileFormat",
                                    "Item"
                                ],
                                "display_title": "vcf_gz",
                                "principals_allowed": {
                                    "view": [
                                        "system.Authenticated"
                                    ],
                                    "edit": [
                                        "group.admin"
                                    ]
                                }
                            },
                            "status": "uploaded",
                            "principals_allowed": {
                                "view": [
                                    "editor_for.12a92962-8265-4fc0-b2f8-cf14f05db58b",
                                    "group.admin",
                                    "group.read-only-admin",
                                    "remoteuser.EMBED",
                                    "remoteuser.INDEXER"
                                ],
                                "edit": [
                                    "editor_for.12a92962-8265-4fc0-b2f8-cf14f05db58b",
                                    "group.admin"
                                ]
                            }
                        },
                        "ordinal": 1,
                        "dimension": "0",
                        "workflow_argument_name": "dbSNP_ref_vcf"
                    },
                    {
                        "value": {
                            "accession": "GAPFIBGEOI72",
                            "display_title": "GAPFIBGEOI72.txt",
                            "href": "/files-reference/GAPFIBGEOI72/@@download/GAPFIBGEOI72.txt",
                            "file_size": 7603,
                            "uuid": "1c07a3aa-e2a3-498c-b838-15991c4a2f28",
                            "@id": "/files-reference/GAPFIBGEOI72/",
                            "@type": [
                                "FileReference",
                                "File",
                                "Item"
                            ],
                            "file_format": {
                                "@id": "/file-formats/txt/",
                                "uuid": "0cd4e777-a596-4927-95c8-b07716121aa3",
                                "status": "shared",
                                "@type": [
                                    "FileFormat",
                                    "Item"
                                ],
                                "display_title": "txt",
                                "principals_allowed": {
                                    "view": [
                                        "system.Authenticated"
                                    ],
                                    "edit": [
                                        "group.admin"
                                    ]
                                }
                            },
                            "status": "uploaded",
                            "principals_allowed": {
                                "view": [
                                    "editor_for.12a92962-8265-4fc0-b2f8-cf14f05db58b",
                                    "group.admin",
                                    "group.read-only-admin",
                                    "remoteuser.EMBED",
                                    "remoteuser.INDEXER"
                                ],
                                "edit": [
                                    "editor_for.12a92962-8265-4fc0-b2f8-cf14f05db58b",
                                    "group.admin"
                                ]
                            }
                        },
                        "ordinal": 1,
                        "dimension": "0",
                        "workflow_argument_name": "region_file"
                    }
                ],
                "awsem_job_id": "vAjaUx5vdAgX",
                "date_created": "2022-04-30T05:40:37.202051+00:00",
                "output_files": [
                    {
                        "type": "Output processed file",
                        "value": {
                            "@type": [
                                "FileProcessed",
                                "File",
                                "Item"
                            ],
                            "display_title": "GAPFI7UFWBGA.vcf.gz",
                            "@id": "/files-processed/GAPFI7UFWBGA/",
                            "status": "uploaded",
                            "file_size": 5033581,
                            "accession": "GAPFI7UFWBGA",
                            "href": "/files-processed/GAPFI7UFWBGA/@@download/GAPFI7UFWBGA.vcf.gz",
                            "uuid": "352d3ace-c687-41de-9027-db84bf8af10a",
                            "file_format": {
                                "status": "shared",
                                "@type": [
                                    "FileFormat",
                                    "Item"
                                ],
                                "@id": "/file-formats/vcf_gz/",
                                "uuid": "1b8f525f-aecb-4211-9ae5-a2c998b05599",
                                "display_title": "vcf_gz",
                                "principals_allowed": {
                                    "view": [
                                        "system.Authenticated"
                                    ],
                                    "edit": [
                                        "group.admin"
                                    ]
                                }
                            },
                            "quality_metric": {
                                "@type": [
                                    "QualityMetricQclist",
                                    "QualityMetric",
                                    "Item"
                                ],
                                "@id": "/quality-metrics-qclist/ed1b017f-45f5-4609-9972-14991d203897/",
                                "display_title": "QualityMetricQclist from 2022-04-30",
                                "status": "shared",
                                "uuid": "ed1b017f-45f5-4609-9972-14991d203897",
                                "overall_quality_status": "PASS",
                                "principals_allowed": {
                                    "view": [
                                        "system.Authenticated"
                                    ],
                                    "edit": [
                                        "group.admin"
                                    ]
                                }
                            },
                            "principals_allowed": {
                                "view": [
                                    "editor_for.12a92962-8265-4fc0-b2f8-cf14f05db58b",
                                    "group.admin",
                                    "group.read-only-admin",
                                    "remoteuser.EMBED",
                                    "remoteuser.INDEXER"
                                ],
                                "edit": [
                                    "editor_for.12a92962-8265-4fc0-b2f8-cf14f05db58b",
                                    "group.admin"
                                ]
                            }
                        },
                        "format": "/file-formats/vcf_gz/",
                        "upload_key": "352d3ace-c687-41de-9027-db84bf8af10a/GAPFI7UFWBGA.vcf.gz",
                        "extra_files": [
                            {
                                "href": "/352d3ace-c687-41de-9027-db84bf8af10a/@@download/GAPFI7UFWBGA.vcf.gz.tbi",
                                "uuid": "352d3ace-c687-41de-9027-db84bf8af10a",
                                "status": "uploading",
                                "filename": "GAPFI7UFWBGA",
                                "accession": "GAPFI7UFWBGA",
                                "upload_key": "352d3ace-c687-41de-9027-db84bf8af10a/GAPFI7UFWBGA.vcf.gz.tbi",
                                "file_format": "/file-formats/vcf_gz_tbi/"
                            }
                        ],
                        "secondary_file_formats": [
                            "/file-formats/vcf_gz_tbi/"
                        ],
                        "workflow_argument_name": "vcf"
                    },
                    {
                        "type": "Output QC file",
                        "value_qc": {
                            "@type": [
                                "QualityMetricVcfcheck",
                                "QualityMetric",
                                "Item"
                            ],
                            "status": "shared",
                            "uuid": "ef20bc31-5922-4b99-b910-aa7f9ef00f96",
                            "display_title": "QualityMetricVcfcheck from 2022-04-30",
                            "overall_quality_status": "PASS",
                            "@id": "/quality-metrics-vcfcheck/ef20bc31-5922-4b99-b910-aa7f9ef00f96/",
                            "principals_allowed": {
                                "view": [
                                    "system.Authenticated"
                                ],
                                "edit": [
                                    "group.admin"
                                ]
                            }
                        },
                        "workflow_argument_name": "vcf-check"
                    }
                ],
                "run_platform": "AWSEM",
                "submitted_by": {
                    "@type": [
                        "User",
                        "Item"
                    ],
                    "status": "current",
                    "@id": "/users/b041dba8-e2b2-4e54-a621-97edb508a0c4/",
                    "display_title": "Tibanna App",
                    "uuid": "b041dba8-e2b2-4e54-a621-97edb508a0c4",
                    "principals_allowed": {
                        "view": [
                            "group.admin",
                            "remoteuser.EMBED",
                            "remoteuser.INDEXER",
                            "userid.b041dba8-e2b2-4e54-a621-97edb508a0c4"
                        ],
                        "edit": [
                            "group.admin"
                        ]
                    }
                },
                "last_modified": {
                    "modified_by": {
                        "@id": "/users/7677f8a8-79d2-4cff-ab0a-a967a2a68e39/",
                        "uuid": "7677f8a8-79d2-4cff-ab0a-a967a2a68e39",
                        "display_title": "Foursight App",
                        "@type": [
                            "User",
                            "Item"
                        ],
                        "status": "current",
                        "principals_allowed": {
                            "view": [
                                "group.admin",
                                "remoteuser.EMBED",
                                "remoteuser.INDEXER",
                                "userid.7677f8a8-79d2-4cff-ab0a-a967a2a68e39"
                            ],
                            "edit": [
                                "group.admin"
                            ]
                        }
                    },
                    "date_modified": "2022-04-30T10:00:27.923378+00:00"
                },
                "metadata_only": false,
                "awsem_app_name": "workflow_dbSNP_ID_fixer-check",
                "quality_metric": {
                    "status": "shared",
                    "uuid": "04805449-55a4-413d-9ef7-9d3dc5d30891",
                    "display_title": "QualityMetricWorkflowrun from 2022-04-30",
                    "@type": [
                        "QualityMetricWorkflowrun",
                        "QualityMetric",
                        "Item"
                    ],
                    "@id": "/quality-metrics-workflowrun/04805449-55a4-413d-9ef7-9d3dc5d30891/",
                    "principals_allowed": {
                        "view": [
                            "system.Authenticated"
                        ],
                        "edit": [
                            "group.admin"
                        ]
                    }
                },
                "schema_version": "3",
                "awsem_postrun_json": "https://s3.amazonaws.com/cgap-biotest-main-application-tibanna-output/vAjaUx5vdAgX.postrun.json",
                "associated_meta_workflow_runs": [
                    "a77b8431-2936-4f87-8405-8aa43ee777c1"
                ],
                "@id": "/workflow-runs-awsem/703d75f8-4fdf-4cb4-a65b-6181e1079660/",
                "@type": [
                    "WorkflowRunAwsem",
                    "WorkflowRun",
                    "Item"
                ],
                "uuid": "703d75f8-4fdf-4cb4-a65b-6181e1079660",
                "principals_allowed": {
                    "view": [
                        "system.Authenticated"
                    ],
                    "edit": [
                        "group.admin"
                    ]
                },
                "display_title": "workflow_dbSNP_ID_fixer-check v1.0.0 run 2022-04-30 05:40:37.109983",
                "@context": "/terms/"
            }
        },
        {
            "name": "workflow_granite-qcVCF-5",
            "jobid": "qyBOM5Uoyyoe",
            "shard": "0",
            "status": "completed",
            "dependencies": [
                "workflow_granite-comHet-check:0"
            ],
            "workflow_run": {
                "title": "workflow_granite-qcVCF v1.0.0 run 2022-04-30 05:40:39.370350",
                "status": "shared",
                "run_url": "https://console.aws.amazon.com/states/home?region=us-east-1#/executions/details/arn:aws:states:us-east-1:922729568532:execution:tibanna_zebra_cgap-wolf:run_workflow_granite-qcVCF-9bd23b82-c742-4c92-8ebc-569cf265ce16",
                "parameters": [
                    {
                        "value": "[{\"parents\": [\"GAPIDUZDOX4R\", \"GAPIDQV37Z5Y\"], \"individual\": \"GAPID43VJKQ6\", \"sample_name\": \"NA12879_sample-WGS\", \"gender\": \"F\"}, {\"parents\": [], \"individual\": \"GAPIDUZDOX4R\", \"sample_name\": \"NA12878_sample-WGS\", \"gender\": \"F\"}, {\"parents\": [], \"individual\": \"GAPIDQV37Z5Y\", \"sample_name\": \"NA12877_sample-WGS\", \"gender\": \"M\"}]",
                        "ordinal": 1,
                        "dimension": "0",
                        "workflow_argument_name": "pedigree"
                    },
                    {
                        "value": "['NA12879_sample-WGS', 'NA12878_sample-WGS', 'NA12877_sample-WGS']",
                        "ordinal": 1,
                        "dimension": "0",
                        "workflow_argument_name": "samples"
                    },
                    {
                        "value": "True",
                        "ordinal": 1,
                        "dimension": "0",
                        "workflow_argument_name": "trio_errors"
                    },
                    {
                        "value": "False",
                        "ordinal": 1,
                        "dimension": "0",
                        "workflow_argument_name": "het_hom"
                    },
                    {
                        "value": "False",
                        "ordinal": 1,
                        "dimension": "0",
                        "workflow_argument_name": "ti_tv"
                    }
                ],
                "run_status": "complete",
                "input_files": [
                    {
                        "value": {
                            "display_title": "GAPFIUXS6TY7.vcf.gz",
                            "uuid": "2bdf5b97-b382-4c11-a70a-b6a5210bf319",
                            "status": "uploaded",
                            "file_size": 5015079,
                            "href": "/files-processed/GAPFIUXS6TY7/@@download/GAPFIUXS6TY7.vcf.gz",
                            "@id": "/files-processed/GAPFIUXS6TY7/",
                            "accession": "GAPFIUXS6TY7",
                            "@type": [
                                "FileProcessed",
                                "File",
                                "Item"
                            ],
                            "file_format": {
                                "@type": [
                                    "FileFormat",
                                    "Item"
                                ],
                                "status": "shared",
                                "@id": "/file-formats/vcf_gz/",
                                "uuid": "1b8f525f-aecb-4211-9ae5-a2c998b05599",
                                "display_title": "vcf_gz",
                                "principals_allowed": {
                                    "view": [
                                        "system.Authenticated"
                                    ],
                                    "edit": [
                                        "group.admin"
                                    ]
                                }
                            },
                            "principals_allowed": {
                                "view": [
                                    "editor_for.12a92962-8265-4fc0-b2f8-cf14f05db58b",
                                    "group.admin",
                                    "group.read-only-admin",
                                    "remoteuser.EMBED",
                                    "remoteuser.INDEXER"
                                ],
                                "edit": [
                                    "editor_for.12a92962-8265-4fc0-b2f8-cf14f05db58b",
                                    "group.admin"
                                ]
                            },
                            "quality_metric": {
                                "overall_quality_status": "PASS",
                                "uuid": "06a62061-7f6f-4e9e-995d-24c274509290",
                                "@id": "/quality-metrics-qclist/06a62061-7f6f-4e9e-995d-24c274509290/",
                                "@type": [
                                    "QualityMetricQclist",
                                    "QualityMetric",
                                    "Item"
                                ],
                                "status": "shared",
                                "display_title": "QualityMetricQclist from 2022-04-30",
                                "principals_allowed": {
                                    "view": [
                                        "system.Authenticated"
                                    ],
                                    "edit": [
                                        "group.admin"
                                    ]
                                }
                            }
                        },
                        "ordinal": 1,
                        "dimension": "0",
                        "workflow_argument_name": "input_vcf"
                    }
                ],
                "institution": {
                    "uuid": "828cd4fe-ebb0-4b36-a94a-d2e3a36cc989",
                    "@type": [
                        "Institution",
                        "Item"
                    ],
                    "status": "current",
                    "display_title": "HMS DBMI",
                    "@id": "/institutions/hms-dbmi/",
                    "principals_allowed": {
                        "view": [
                            "group.admin",
                            "group.read-only-admin",
                            "remoteuser.EMBED",
                            "remoteuser.INDEXER"
                        ],
                        "edit": [
                            "group.admin"
                        ]
                    }
                },
                "awsem_job_id": "qyBOM5Uoyyoe",
                "date_created": "2022-04-30T05:40:39.455578+00:00",
                "output_files": [
                    {
                        "type": "Output QC file",
                        "value_qc": {
                            "uuid": "ff13b07a-d3e0-4a75-836f-837c79c116fc",
                            "status": "shared",
                            "@id": "/quality-metrics-vcfqc/ff13b07a-d3e0-4a75-836f-837c79c116fc/",
                            "display_title": "QualityMetricVcfqc from 2022-04-30",
                            "overall_quality_status": "PASS",
                            "@type": [
                                "QualityMetricVcfqc",
                                "QualityMetric",
                                "Item"
                            ],
                            "principals_allowed": {
                                "view": [
                                    "system.Authenticated"
                                ],
                                "edit": [
                                    "group.admin"
                                ]
                            }
                        },
                        "workflow_argument_name": "qc_json"
                    },
                    {
                        "type": "Output QC file",
                        "value_qc": {
                            "uuid": "ff13b07a-d3e0-4a75-836f-837c79c116fc",
                            "status": "shared",
                            "@id": "/quality-metrics-vcfqc/ff13b07a-d3e0-4a75-836f-837c79c116fc/",
                            "display_title": "QualityMetricVcfqc from 2022-04-30",
                            "overall_quality_status": "PASS",
                            "@type": [
                                "QualityMetricVcfqc",
                                "QualityMetric",
                                "Item"
                            ],
                            "principals_allowed": {
                                "view": [
                                    "system.Authenticated"
                                ],
                                "edit": [
                                    "group.admin"
                                ]
                            }
                        },
                        "workflow_argument_name": "uniq_variants"
                    }
                ],
                "run_platform": "AWSEM",
                "submitted_by": {
                    "status": "current",
                    "@type": [
                        "User",
                        "Item"
                    ],
                    "display_title": "Tibanna App",
                    "uuid": "b041dba8-e2b2-4e54-a621-97edb508a0c4",
                    "@id": "/users/b041dba8-e2b2-4e54-a621-97edb508a0c4/",
                    "principals_allowed": {
                        "view": [
                            "group.admin",
                            "remoteuser.EMBED",
                            "remoteuser.INDEXER",
                            "userid.b041dba8-e2b2-4e54-a621-97edb508a0c4"
                        ],
                        "edit": [
                            "group.admin"
                        ]
                    }
                },
                "last_modified": {
                    "modified_by": {
                        "@type": [
                            "User",
                            "Item"
                        ],
                        "display_title": "Foursight App",
                        "status": "current",
                        "@id": "/users/7677f8a8-79d2-4cff-ab0a-a967a2a68e39/",
                        "uuid": "7677f8a8-79d2-4cff-ab0a-a967a2a68e39",
                        "principals_allowed": {
                            "view": [
                                "group.admin",
                                "remoteuser.EMBED",
                                "remoteuser.INDEXER",
                                "userid.7677f8a8-79d2-4cff-ab0a-a967a2a68e39"
                            ],
                            "edit": [
                                "group.admin"
                            ]
                        }
                    },
                    "date_modified": "2022-04-30T10:00:27.818312+00:00"
                },
                "metadata_only": false,
                "awsem_app_name": "workflow_granite-qcVCF",
                "quality_metric": {
                    "uuid": "a6a96521-2f77-4207-a56a-e0977a972752",
                    "status": "shared",
                    "@type": [
                        "QualityMetricWorkflowrun",
                        "QualityMetric",
                        "Item"
                    ],
                    "display_title": "QualityMetricWorkflowrun from 2022-04-30",
                    "@id": "/quality-metrics-workflowrun/a6a96521-2f77-4207-a56a-e0977a972752/",
                    "principals_allowed": {
                        "view": [
                            "system.Authenticated"
                        ],
                        "edit": [
                            "group.admin"
                        ]
                    }
                },
                "schema_version": "3",
                "awsem_postrun_json": "https://s3.amazonaws.com/cgap-biotest-main-application-tibanna-output/qyBOM5Uoyyoe.postrun.json",
                "associated_meta_workflow_runs": [
                    "a77b8431-2936-4f87-8405-8aa43ee777c1"
                ],
                "@id": "/workflow-runs-awsem/dd927729-294a-4cff-bf20-115dc9561ff7/",
                "@type": [
                    "WorkflowRunAwsem",
                    "WorkflowRun",
                    "Item"
                ],
                "uuid": "dd927729-294a-4cff-bf20-115dc9561ff7",
                "principals_allowed": {
                    "view": [
                        "system.Authenticated"
                    ],
                    "edit": [
                        "group.admin"
                    ]
                },
                "display_title": "workflow_granite-qcVCF v1.0.0 run 2022-04-30 05:40:39.370350",
                "@context": "/terms/"
            }
        },
        {
            "name": "workflow_granite-qcVCF-6",
            "jobid": "au4qDeogNSxc",
            "shard": "0",
            "status": "completed",
            "dependencies": [
                "workflow_dbSNP_ID_fixer-check:0"
            ],
            "workflow_run": {
                "title": "workflow_granite-qcVCF v1.0.0 run 2022-04-30 06:10:34.657719",
                "status": "shared",
                "run_url": "https://console.aws.amazon.com/states/home?region=us-east-1#/executions/details/arn:aws:states:us-east-1:922729568532:execution:tibanna_zebra_cgap-wolf:run_workflow_granite-qcVCF-97a99f5e-9650-4c8b-9f75-8b43fb67919d",
                "parameters": [
                    {
                        "value": "[{\"parents\": [\"GAPIDUZDOX4R\", \"GAPIDQV37Z5Y\"], \"individual\": \"GAPID43VJKQ6\", \"sample_name\": \"NA12879_sample-WGS\", \"gender\": \"F\"}, {\"parents\": [], \"individual\": \"GAPIDUZDOX4R\", \"sample_name\": \"NA12878_sample-WGS\", \"gender\": \"F\"}, {\"parents\": [], \"individual\": \"GAPIDQV37Z5Y\", \"sample_name\": \"NA12877_sample-WGS\", \"gender\": \"M\"}]",
                        "ordinal": 1,
                        "dimension": "0",
                        "workflow_argument_name": "pedigree"
                    },
                    {
                        "value": "['NA12879_sample-WGS', 'NA12878_sample-WGS', 'NA12877_sample-WGS']",
                        "ordinal": 1,
                        "dimension": "0",
                        "workflow_argument_name": "samples"
                    },
                    {
                        "value": "True",
                        "ordinal": 1,
                        "dimension": "0",
                        "workflow_argument_name": "trio_errors"
                    },
                    {
                        "value": "False",
                        "ordinal": 1,
                        "dimension": "0",
                        "workflow_argument_name": "het_hom"
                    },
                    {
                        "value": "False",
                        "ordinal": 1,
                        "dimension": "0",
                        "workflow_argument_name": "ti_tv"
                    }
                ],
                "run_status": "complete",
                "input_files": [
                    {
                        "value": {
                            "uuid": "352d3ace-c687-41de-9027-db84bf8af10a",
                            "href": "/files-processed/GAPFI7UFWBGA/@@download/GAPFI7UFWBGA.vcf.gz",
                            "@id": "/files-processed/GAPFI7UFWBGA/",
                            "accession": "GAPFI7UFWBGA",
                            "display_title": "GAPFI7UFWBGA.vcf.gz",
                            "file_size": 5033581,
                            "@type": [
                                "FileProcessed",
                                "File",
                                "Item"
                            ],
                            "status": "uploaded",
                            "file_format": {
                                "uuid": "1b8f525f-aecb-4211-9ae5-a2c998b05599",
                                "status": "shared",
                                "@id": "/file-formats/vcf_gz/",
                                "display_title": "vcf_gz",
                                "@type": [
                                    "FileFormat",
                                    "Item"
                                ],
                                "principals_allowed": {
                                    "view": [
                                        "system.Authenticated"
                                    ],
                                    "edit": [
                                        "group.admin"
                                    ]
                                }
                            },
                            "quality_metric": {
                                "display_title": "QualityMetricQclist from 2022-04-30",
                                "@type": [
                                    "QualityMetricQclist",
                                    "QualityMetric",
                                    "Item"
                                ],
                                "uuid": "ed1b017f-45f5-4609-9972-14991d203897",
                                "@id": "/quality-metrics-qclist/ed1b017f-45f5-4609-9972-14991d203897/",
                                "status": "shared",
                                "overall_quality_status": "PASS",
                                "principals_allowed": {
                                    "view": [
                                        "system.Authenticated"
                                    ],
                                    "edit": [
                                        "group.admin"
                                    ]
                                }
                            },
                            "principals_allowed": {
                                "view": [
                                    "editor_for.12a92962-8265-4fc0-b2f8-cf14f05db58b",
                                    "group.admin",
                                    "group.read-only-admin",
                                    "remoteuser.EMBED",
                                    "remoteuser.INDEXER"
                                ],
                                "edit": [
                                    "editor_for.12a92962-8265-4fc0-b2f8-cf14f05db58b",
                                    "group.admin"
                                ]
                            }
                        },
                        "ordinal": 1,
                        "dimension": "0",
                        "workflow_argument_name": "input_vcf"
                    }
                ],
                "awsem_job_id": "au4qDeogNSxc",
                "date_created": "2022-04-30T06:10:34.760434+00:00",
                "output_files": [
                    {
                        "type": "Output QC file",
                        "value_qc": {
                            "status": "shared",
                            "display_title": "QualityMetricVcfqc from 2022-04-30",
                            "@type": [
                                "QualityMetricVcfqc",
                                "QualityMetric",
                                "Item"
                            ],
                            "overall_quality_status": "PASS",
                            "@id": "/quality-metrics-vcfqc/fddd9992-b13c-4844-9a30-2933f9fd909b/",
                            "uuid": "fddd9992-b13c-4844-9a30-2933f9fd909b",
                            "principals_allowed": {
                                "view": [
                                    "system.Authenticated"
                                ],
                                "edit": [
                                    "group.admin"
                                ]
                            }
                        },
                        "workflow_argument_name": "qc_json"
                    },
                    {
                        "type": "Output QC file",
                        "value_qc": {
                            "status": "shared",
                            "display_title": "QualityMetricVcfqc from 2022-04-30",
                            "@type": [
                                "QualityMetricVcfqc",
                                "QualityMetric",
                                "Item"
                            ],
                            "overall_quality_status": "PASS",
                            "@id": "/quality-metrics-vcfqc/fddd9992-b13c-4844-9a30-2933f9fd909b/",
                            "uuid": "fddd9992-b13c-4844-9a30-2933f9fd909b",
                            "principals_allowed": {
                                "view": [
                                    "system.Authenticated"
                                ],
                                "edit": [
                                    "group.admin"
                                ]
                            }
                        },
                        "workflow_argument_name": "uniq_variants"
                    }
                ],
                "run_platform": "AWSEM",
                "submitted_by": {
                    "display_title": "Tibanna App",
                    "@type": [
                        "User",
                        "Item"
                    ],
                    "status": "current",
                    "uuid": "b041dba8-e2b2-4e54-a621-97edb508a0c4",
                    "@id": "/users/b041dba8-e2b2-4e54-a621-97edb508a0c4/",
                    "principals_allowed": {
                        "view": [
                            "group.admin",
                            "remoteuser.EMBED",
                            "remoteuser.INDEXER",
                            "userid.b041dba8-e2b2-4e54-a621-97edb508a0c4"
                        ],
                        "edit": [
                            "group.admin"
                        ]
                    }
                },
                "last_modified": {
                    "modified_by": {
                        "display_title": "Foursight App",
                        "status": "current",
                        "@type": [
                            "User",
                            "Item"
                        ],
                        "@id": "/users/7677f8a8-79d2-4cff-ab0a-a967a2a68e39/",
                        "uuid": "7677f8a8-79d2-4cff-ab0a-a967a2a68e39",
                        "principals_allowed": {
                            "view": [
                                "group.admin",
                                "remoteuser.EMBED",
                                "remoteuser.INDEXER",
                                "userid.7677f8a8-79d2-4cff-ab0a-a967a2a68e39"
                            ],
                            "edit": [
                                "group.admin"
                            ]
                        }
                    },
                    "date_modified": "2022-04-30T10:00:27.722113+00:00"
                },
                "metadata_only": false,
                "awsem_app_name": "workflow_granite-qcVCF",
                "quality_metric": {
                    "uuid": "c1a98817-76d8-4e89-ba87-825948097758",
                    "display_title": "QualityMetricWorkflowrun from 2022-04-30",
                    "@id": "/quality-metrics-workflowrun/c1a98817-76d8-4e89-ba87-825948097758/",
                    "@type": [
                        "QualityMetricWorkflowrun",
                        "QualityMetric",
                        "Item"
                    ],
                    "status": "shared",
                    "principals_allowed": {
                        "view": [
                            "system.Authenticated"
                        ],
                        "edit": [
                            "group.admin"
                        ]
                    }
                },
                "schema_version": "3",
                "awsem_postrun_json": "https://s3.amazonaws.com/cgap-biotest-main-application-tibanna-output/au4qDeogNSxc.postrun.json",
                "associated_meta_workflow_runs": [
                    "a77b8431-2936-4f87-8405-8aa43ee777c1"
                ],
                "@id": "/workflow-runs-awsem/da4c3ef1-7cee-42cf-a6d1-ea60dbd60169/",
                "@type": [
                    "WorkflowRunAwsem",
                    "WorkflowRun",
                    "Item"
                ],
                "uuid": "da4c3ef1-7cee-42cf-a6d1-ea60dbd60169",
                "principals_allowed": {
                    "view": [
                        "system.Authenticated"
                    ],
                    "edit": [
                        "group.admin"
                    ]
                },
                "display_title": "workflow_granite-qcVCF v1.0.0 run 2022-04-30 06:10:34.657719",
                "@context": "/terms/"
            }
        },
        {
            "name": "workflow_hg19lo_hgvsg-check",
            "jobid": "kZNfUWHW3HTK",
            "shard": "0",
            "output": [
                {
                    "file": {
                        "display_title": "GAPFIRGHPIDQ.vcf.gz",
                        "status": "uploaded",
                        "@id": "/files-processed/GAPFIRGHPIDQ/",
                        "uuid": "77ae0d41-f922-4646-bee2-029deaefdf49",
                        "@type": [
                            "FileProcessed",
                            "File",
                            "Item"
                        ],
                        "principals_allowed": {
                            "view": [
                                "editor_for.12a92962-8265-4fc0-b2f8-cf14f05db58b",
                                "group.admin",
                                "group.read-only-admin",
                                "remoteuser.EMBED",
                                "remoteuser.INDEXER"
                            ],
                            "edit": [
                                "editor_for.12a92962-8265-4fc0-b2f8-cf14f05db58b",
                                "group.admin"
                            ]
                        }
                    },
                    "argument_name": "vcf"
                }
            ],
            "status": "completed",
            "dependencies": [
                "workflow_dbSNP_ID_fixer-check:0"
            ],
            "workflow_run": {
                "title": "workflow_hg19lo_hgvsg-check v1.0.0 run 2022-04-30 06:10:40.434728",
                "status": "shared",
                "run_url": "https://console.aws.amazon.com/states/home?region=us-east-1#/executions/details/arn:aws:states:us-east-1:922729568532:execution:tibanna_zebra_cgap-wolf:run_workflow_hg19lo_hgvsg-check-39b82a06-80bf-4248-9c97-c43c01328c90",
                "parameters": [],
                "run_status": "complete",
                "input_files": [
                    {
                        "value": {
                            "uuid": "352d3ace-c687-41de-9027-db84bf8af10a",
                            "href": "/files-processed/GAPFI7UFWBGA/@@download/GAPFI7UFWBGA.vcf.gz",
                            "@id": "/files-processed/GAPFI7UFWBGA/",
                            "accession": "GAPFI7UFWBGA",
                            "display_title": "GAPFI7UFWBGA.vcf.gz",
                            "file_size": 5033581,
                            "@type": [
                                "FileProcessed",
                                "File",
                                "Item"
                            ],
                            "status": "uploaded",
                            "file_format": {
                                "uuid": "1b8f525f-aecb-4211-9ae5-a2c998b05599",
                                "status": "shared",
                                "@id": "/file-formats/vcf_gz/",
                                "display_title": "vcf_gz",
                                "@type": [
                                    "FileFormat",
                                    "Item"
                                ],
                                "principals_allowed": {
                                    "view": [
                                        "system.Authenticated"
                                    ],
                                    "edit": [
                                        "group.admin"
                                    ]
                                }
                            },
                            "quality_metric": {
                                "display_title": "QualityMetricQclist from 2022-04-30",
                                "@type": [
                                    "QualityMetricQclist",
                                    "QualityMetric",
                                    "Item"
                                ],
                                "uuid": "ed1b017f-45f5-4609-9972-14991d203897",
                                "@id": "/quality-metrics-qclist/ed1b017f-45f5-4609-9972-14991d203897/",
                                "status": "shared",
                                "overall_quality_status": "PASS",
                                "principals_allowed": {
                                    "view": [
                                        "system.Authenticated"
                                    ],
                                    "edit": [
                                        "group.admin"
                                    ]
                                }
                            },
                            "principals_allowed": {
                                "view": [
                                    "editor_for.12a92962-8265-4fc0-b2f8-cf14f05db58b",
                                    "group.admin",
                                    "group.read-only-admin",
                                    "remoteuser.EMBED",
                                    "remoteuser.INDEXER"
                                ],
                                "edit": [
                                    "editor_for.12a92962-8265-4fc0-b2f8-cf14f05db58b",
                                    "group.admin"
                                ]
                            }
                        },
                        "ordinal": 1,
                        "dimension": "0",
                        "workflow_argument_name": "input_vcf"
                    },
                    {
                        "value": {
                            "uuid": "297c872a-5b6b-4fc3-83d3-f4a853f8805c",
                            "href": "/files-reference/GAPFIYPTSAU8/@@download/GAPFIYPTSAU8.chain.gz",
                            "@id": "/files-reference/GAPFIYPTSAU8/",
                            "accession": "GAPFIYPTSAU8",
                            "display_title": "GAPFIYPTSAU8.chain.gz",
                            "file_size": 1246411,
                            "@type": [
                                "FileReference",
                                "File",
                                "Item"
                            ],
                            "status": "uploaded",
                            "file_format": {
                                "uuid": "dd1ef82d-da5e-4680-bd5c-cf471a87eb5b",
                                "status": "shared",
                                "@id": "/file-formats/chain/",
                                "display_title": "chain",
                                "@type": [
                                    "FileFormat",
                                    "Item"
                                ],
                                "principals_allowed": {
                                    "view": [
                                        "system.Authenticated"
                                    ],
                                    "edit": [
                                        "group.admin"
                                    ]
                                }
                            },
                            "principals_allowed": {
                                "view": [
                                    "editor_for.12a92962-8265-4fc0-b2f8-cf14f05db58b",
                                    "group.admin",
                                    "group.read-only-admin",
                                    "remoteuser.EMBED",
                                    "remoteuser.INDEXER"
                                ],
                                "edit": [
                                    "editor_for.12a92962-8265-4fc0-b2f8-cf14f05db58b",
                                    "group.admin"
                                ]
                            }
                        },
                        "ordinal": 1,
                        "dimension": "0",
                        "workflow_argument_name": "chainfile"
                    }
                ],
                "awsem_job_id": "kZNfUWHW3HTK",
                "date_created": "2022-04-30T06:10:40.557414+00:00",
                "output_files": [
                    {
                        "type": "Output processed file",
                        "value": {
                            "file_format": {
                                "status": "shared",
                                "@id": "/file-formats/vcf_gz/",
                                "@type": [
                                    "FileFormat",
                                    "Item"
                                ],
                                "uuid": "1b8f525f-aecb-4211-9ae5-a2c998b05599",
                                "display_title": "vcf_gz",
                                "principals_allowed": {
                                    "view": [
                                        "system.Authenticated"
                                    ],
                                    "edit": [
                                        "group.admin"
                                    ]
                                }
                            },
                            "uuid": "77ae0d41-f922-4646-bee2-029deaefdf49",
                            "@id": "/files-processed/GAPFIRGHPIDQ/",
                            "file_size": 5196340,
                            "status": "uploaded",
                            "href": "/files-processed/GAPFIRGHPIDQ/@@download/GAPFIRGHPIDQ.vcf.gz",
                            "display_title": "GAPFIRGHPIDQ.vcf.gz",
                            "accession": "GAPFIRGHPIDQ",
                            "@type": [
                                "FileProcessed",
                                "File",
                                "Item"
                            ],
                            "quality_metric": {
                                "@id": "/quality-metrics-qclist/ac83094c-6bb2-4754-9573-ec6f9dc74ee5/",
                                "uuid": "ac83094c-6bb2-4754-9573-ec6f9dc74ee5",
                                "display_title": "QualityMetricQclist from 2022-04-30",
                                "status": "shared",
                                "overall_quality_status": "PASS",
                                "@type": [
                                    "QualityMetricQclist",
                                    "QualityMetric",
                                    "Item"
                                ],
                                "principals_allowed": {
                                    "view": [
                                        "system.Authenticated"
                                    ],
                                    "edit": [
                                        "group.admin"
                                    ]
                                }
                            },
                            "principals_allowed": {
                                "view": [
                                    "editor_for.12a92962-8265-4fc0-b2f8-cf14f05db58b",
                                    "group.admin",
                                    "group.read-only-admin",
                                    "remoteuser.EMBED",
                                    "remoteuser.INDEXER"
                                ],
                                "edit": [
                                    "editor_for.12a92962-8265-4fc0-b2f8-cf14f05db58b",
                                    "group.admin"
                                ]
                            }
                        },
                        "format": "/file-formats/vcf_gz/",
                        "upload_key": "77ae0d41-f922-4646-bee2-029deaefdf49/GAPFIRGHPIDQ.vcf.gz",
                        "extra_files": [
                            {
                                "href": "/77ae0d41-f922-4646-bee2-029deaefdf49/@@download/GAPFIRGHPIDQ.vcf.gz.tbi",
                                "uuid": "77ae0d41-f922-4646-bee2-029deaefdf49",
                                "status": "uploading",
                                "filename": "GAPFIRGHPIDQ",
                                "accession": "GAPFIRGHPIDQ",
                                "upload_key": "77ae0d41-f922-4646-bee2-029deaefdf49/GAPFIRGHPIDQ.vcf.gz.tbi",
                                "file_format": "/file-formats/vcf_gz_tbi/"
                            }
                        ],
                        "secondary_file_formats": [
                            "/file-formats/vcf_gz_tbi/"
                        ],
                        "workflow_argument_name": "vcf"
                    },
                    {
                        "type": "Output QC file",
                        "value_qc": {
                            "status": "shared",
                            "display_title": "QualityMetricVcfcheck from 2022-04-30",
                            "@type": [
                                "QualityMetricVcfcheck",
                                "QualityMetric",
                                "Item"
                            ],
                            "overall_quality_status": "PASS",
                            "@id": "/quality-metrics-vcfcheck/72c24ef7-49bf-4e0c-9667-0a62f9f0397d/",
                            "uuid": "72c24ef7-49bf-4e0c-9667-0a62f9f0397d",
                            "principals_allowed": {
                                "view": [
                                    "system.Authenticated"
                                ],
                                "edit": [
                                    "group.admin"
                                ]
                            }
                        },
                        "workflow_argument_name": "vcf-check"
                    }
                ],
                "run_platform": "AWSEM",
                "submitted_by": {
                    "display_title": "Tibanna App",
                    "@type": [
                        "User",
                        "Item"
                    ],
                    "status": "current",
                    "uuid": "b041dba8-e2b2-4e54-a621-97edb508a0c4",
                    "@id": "/users/b041dba8-e2b2-4e54-a621-97edb508a0c4/",
                    "principals_allowed": {
                        "view": [
                            "group.admin",
                            "remoteuser.EMBED",
                            "remoteuser.INDEXER",
                            "userid.b041dba8-e2b2-4e54-a621-97edb508a0c4"
                        ],
                        "edit": [
                            "group.admin"
                        ]
                    }
                },
                "last_modified": {
                    "modified_by": {
                        "display_title": "Foursight App",
                        "status": "current",
                        "@type": [
                            "User",
                            "Item"
                        ],
                        "@id": "/users/7677f8a8-79d2-4cff-ab0a-a967a2a68e39/",
                        "uuid": "7677f8a8-79d2-4cff-ab0a-a967a2a68e39",
                        "principals_allowed": {
                            "view": [
                                "group.admin",
                                "remoteuser.EMBED",
                                "remoteuser.INDEXER",
                                "userid.7677f8a8-79d2-4cff-ab0a-a967a2a68e39"
                            ],
                            "edit": [
                                "group.admin"
                            ]
                        }
                    },
                    "date_modified": "2022-04-30T10:00:27.585650+00:00"
                },
                "metadata_only": false,
                "awsem_app_name": "workflow_hg19lo_hgvsg-check",
                "quality_metric": {
                    "uuid": "510850db-7fa7-4d85-9a4b-30f9b9ce7e94",
                    "display_title": "QualityMetricWorkflowrun from 2022-04-30",
                    "@id": "/quality-metrics-workflowrun/510850db-7fa7-4d85-9a4b-30f9b9ce7e94/",
                    "@type": [
                        "QualityMetricWorkflowrun",
                        "QualityMetric",
                        "Item"
                    ],
                    "status": "shared",
                    "principals_allowed": {
                        "view": [
                            "system.Authenticated"
                        ],
                        "edit": [
                            "group.admin"
                        ]
                    }
                },
                "schema_version": "3",
                "awsem_postrun_json": "https://s3.amazonaws.com/cgap-biotest-main-application-tibanna-output/kZNfUWHW3HTK.postrun.json",
                "associated_meta_workflow_runs": [
                    "a77b8431-2936-4f87-8405-8aa43ee777c1"
                ],
                "@id": "/workflow-runs-awsem/5df3ef23-0e93-4510-8ebb-63ebcc1214a7/",
                "@type": [
                    "WorkflowRunAwsem",
                    "WorkflowRun",
                    "Item"
                ],
                "uuid": "5df3ef23-0e93-4510-8ebb-63ebcc1214a7",
                "principals_allowed": {
                    "view": [
                        "system.Authenticated"
                    ],
                    "edit": [
                        "group.admin"
                    ]
                },
                "display_title": "workflow_hg19lo_hgvsg-check v1.0.0 run 2022-04-30 06:10:40.434728",
                "@context": "/terms/"
            }
        },
        {
            "name": "workflow_granite-qcVCF-7",
            "jobid": "m0GqurQz0XA4",
            "shard": "0",
            "status": "completed",
            "dependencies": [
                "workflow_hg19lo_hgvsg-check:0"
            ],
            "workflow_run": {
                "title": "workflow_granite-qcVCF v1.0.0 run 2022-04-30 06:40:35.011633",
                "status": "shared",
                "run_url": "https://console.aws.amazon.com/states/home?region=us-east-1#/executions/details/arn:aws:states:us-east-1:922729568532:execution:tibanna_zebra_cgap-wolf:run_workflow_granite-qcVCF-deb923c7-5500-42e9-817d-47f327fb8989",
                "parameters": [
                    {
                        "value": "[{\"parents\": [\"GAPIDUZDOX4R\", \"GAPIDQV37Z5Y\"], \"individual\": \"GAPID43VJKQ6\", \"sample_name\": \"NA12879_sample-WGS\", \"gender\": \"F\"}, {\"parents\": [], \"individual\": \"GAPIDUZDOX4R\", \"sample_name\": \"NA12878_sample-WGS\", \"gender\": \"F\"}, {\"parents\": [], \"individual\": \"GAPIDQV37Z5Y\", \"sample_name\": \"NA12877_sample-WGS\", \"gender\": \"M\"}]",
                        "ordinal": 1,
                        "dimension": "0",
                        "workflow_argument_name": "pedigree"
                    },
                    {
                        "value": "['NA12879_sample-WGS', 'NA12878_sample-WGS', 'NA12877_sample-WGS']",
                        "ordinal": 1,
                        "dimension": "0",
                        "workflow_argument_name": "samples"
                    },
                    {
                        "value": "True",
                        "ordinal": 1,
                        "dimension": "0",
                        "workflow_argument_name": "trio_errors"
                    },
                    {
                        "value": "False",
                        "ordinal": 1,
                        "dimension": "0",
                        "workflow_argument_name": "het_hom"
                    },
                    {
                        "value": "False",
                        "ordinal": 1,
                        "dimension": "0",
                        "workflow_argument_name": "ti_tv"
                    }
                ],
                "run_status": "complete",
                "input_files": [
                    {
                        "value": {
                            "accession": "GAPFIRGHPIDQ",
                            "@id": "/files-processed/GAPFIRGHPIDQ/",
                            "file_size": 5196340,
                            "@type": [
                                "FileProcessed",
                                "File",
                                "Item"
                            ],
                            "display_title": "GAPFIRGHPIDQ.vcf.gz",
                            "file_format": {
                                "@id": "/file-formats/vcf_gz/",
                                "status": "shared",
                                "display_title": "vcf_gz",
                                "uuid": "1b8f525f-aecb-4211-9ae5-a2c998b05599",
                                "@type": [
                                    "FileFormat",
                                    "Item"
                                ],
                                "principals_allowed": {
                                    "view": [
                                        "system.Authenticated"
                                    ],
                                    "edit": [
                                        "group.admin"
                                    ]
                                }
                            },
                            "status": "uploaded",
                            "href": "/files-processed/GAPFIRGHPIDQ/@@download/GAPFIRGHPIDQ.vcf.gz",
                            "uuid": "77ae0d41-f922-4646-bee2-029deaefdf49",
                            "principals_allowed": {
                                "view": [
                                    "editor_for.12a92962-8265-4fc0-b2f8-cf14f05db58b",
                                    "group.admin",
                                    "group.read-only-admin",
                                    "remoteuser.EMBED",
                                    "remoteuser.INDEXER"
                                ],
                                "edit": [
                                    "editor_for.12a92962-8265-4fc0-b2f8-cf14f05db58b",
                                    "group.admin"
                                ]
                            },
                            "quality_metric": {
                                "display_title": "QualityMetricQclist from 2022-04-30",
                                "status": "shared",
                                "@id": "/quality-metrics-qclist/ac83094c-6bb2-4754-9573-ec6f9dc74ee5/",
                                "overall_quality_status": "PASS",
                                "@type": [
                                    "QualityMetricQclist",
                                    "QualityMetric",
                                    "Item"
                                ],
                                "uuid": "ac83094c-6bb2-4754-9573-ec6f9dc74ee5",
                                "principals_allowed": {
                                    "view": [
                                        "system.Authenticated"
                                    ],
                                    "edit": [
                                        "group.admin"
                                    ]
                                }
                            }
                        },
                        "ordinal": 1,
                        "dimension": "0",
                        "workflow_argument_name": "input_vcf"
                    }
                ],
                "awsem_job_id": "m0GqurQz0XA4",
                "date_created": "2022-04-30T06:40:35.096736+00:00",
                "output_files": [
                    {
                        "type": "Output QC file",
                        "value_qc": {
                            "@id": "/quality-metrics-vcfqc/866988a5-2aa3-4f27-a103-1d17b3dd0fcc/",
                            "uuid": "866988a5-2aa3-4f27-a103-1d17b3dd0fcc",
                            "display_title": "QualityMetricVcfqc from 2022-04-30",
                            "@type": [
                                "QualityMetricVcfqc",
                                "QualityMetric",
                                "Item"
                            ],
                            "status": "shared",
                            "overall_quality_status": "PASS",
                            "principals_allowed": {
                                "view": [
                                    "system.Authenticated"
                                ],
                                "edit": [
                                    "group.admin"
                                ]
                            }
                        },
                        "workflow_argument_name": "qc_json"
                    },
                    {
                        "type": "Output QC file",
                        "value_qc": {
                            "@id": "/quality-metrics-vcfqc/866988a5-2aa3-4f27-a103-1d17b3dd0fcc/",
                            "uuid": "866988a5-2aa3-4f27-a103-1d17b3dd0fcc",
                            "display_title": "QualityMetricVcfqc from 2022-04-30",
                            "@type": [
                                "QualityMetricVcfqc",
                                "QualityMetric",
                                "Item"
                            ],
                            "status": "shared",
                            "overall_quality_status": "PASS",
                            "principals_allowed": {
                                "view": [
                                    "system.Authenticated"
                                ],
                                "edit": [
                                    "group.admin"
                                ]
                            }
                        },
                        "workflow_argument_name": "uniq_variants"
                    }
                ],
                "run_platform": "AWSEM",
                "submitted_by": {
                    "uuid": "b041dba8-e2b2-4e54-a621-97edb508a0c4",
                    "@id": "/users/b041dba8-e2b2-4e54-a621-97edb508a0c4/",
                    "display_title": "Tibanna App",
                    "@type": [
                        "User",
                        "Item"
                    ],
                    "status": "current",
                    "principals_allowed": {
                        "view": [
                            "group.admin",
                            "remoteuser.EMBED",
                            "remoteuser.INDEXER",
                            "userid.b041dba8-e2b2-4e54-a621-97edb508a0c4"
                        ],
                        "edit": [
                            "group.admin"
                        ]
                    }
                },
                "last_modified": {
                    "modified_by": {
                        "@id": "/users/7677f8a8-79d2-4cff-ab0a-a967a2a68e39/",
                        "display_title": "Foursight App",
                        "status": "current",
                        "@type": [
                            "User",
                            "Item"
                        ],
                        "uuid": "7677f8a8-79d2-4cff-ab0a-a967a2a68e39",
                        "principals_allowed": {
                            "view": [
                                "group.admin",
                                "remoteuser.EMBED",
                                "remoteuser.INDEXER",
                                "userid.7677f8a8-79d2-4cff-ab0a-a967a2a68e39"
                            ],
                            "edit": [
                                "group.admin"
                            ]
                        }
                    },
                    "date_modified": "2022-04-30T10:00:27.447169+00:00"
                },
                "metadata_only": false,
                "awsem_app_name": "workflow_granite-qcVCF",
                "quality_metric": {
                    "@type": [
                        "QualityMetricWorkflowrun",
                        "QualityMetric",
                        "Item"
                    ],
                    "@id": "/quality-metrics-workflowrun/11676a7a-8ae8-4c8c-9df4-9a59d7763bcf/",
                    "uuid": "11676a7a-8ae8-4c8c-9df4-9a59d7763bcf",
                    "display_title": "QualityMetricWorkflowrun from 2022-04-30",
                    "status": "shared",
                    "principals_allowed": {
                        "view": [
                            "system.Authenticated"
                        ],
                        "edit": [
                            "group.admin"
                        ]
                    }
                },
                "schema_version": "3",
                "awsem_postrun_json": "https://s3.amazonaws.com/cgap-biotest-main-application-tibanna-output/m0GqurQz0XA4.postrun.json",
                "associated_meta_workflow_runs": [
                    "a77b8431-2936-4f87-8405-8aa43ee777c1"
                ],
                "@id": "/workflow-runs-awsem/b847a5ad-670e-4b3c-92be-a1d3e9951b99/",
                "@type": [
                    "WorkflowRunAwsem",
                    "WorkflowRun",
                    "Item"
                ],
                "uuid": "b847a5ad-670e-4b3c-92be-a1d3e9951b99",
                "principals_allowed": {
                    "view": [
                        "system.Authenticated"
                    ],
                    "edit": [
                        "group.admin"
                    ]
                },
                "display_title": "workflow_granite-qcVCF v1.0.0 run 2022-04-30 06:40:35.011633",
                "@context": "/terms/"
            }
        },
        {
            "name": "bamsnap",
            "jobid": "79NRQiUCqvD9",
            "shard": "0",
            "status": "completed",
            "dependencies": [
                "workflow_hg19lo_hgvsg-check:0"
            ],
            "workflow_run": {
                "title": "bamsnap v1.0.0 run 2022-04-30 06:40:40.145843",
                "status": "shared",
                "run_url": "https://console.aws.amazon.com/states/home?region=us-east-1#/executions/details/arn:aws:states:us-east-1:922729568532:execution:tibanna_zebra_cgap-wolf:run_bamsnap-9de3f341-d4ce-4144-b94b-7467bbe2594e",
                "parameters": [
                    {
                        "value": "16",
                        "ordinal": 1,
                        "dimension": "0",
                        "workflow_argument_name": "nproc"
                    },
                    {
                        "value": "['NA12879_sample-WGS (proband)', 'NA12878_sample-WGS (mother)', 'NA12877_sample-WGS (father)']",
                        "ordinal": 1,
                        "dimension": "0",
                        "workflow_argument_name": "titles"
                    }
                ],
                "run_status": "complete",
                "input_files": [
                    {
                        "value": {
                            "href": "/files-processed/GAPFIMIARUOB/@@download/GAPFIMIARUOB.bam",
                            "file_format": {
                                "uuid": "d13d06cf-218e-4f61-aaf0-91f226248b3c",
                                "@type": [
                                    "FileFormat",
                                    "Item"
                                ],
                                "@id": "/file-formats/bam/",
                                "status": "shared",
                                "display_title": "bam",
                                "principals_allowed": {
                                    "view": [
                                        "system.Authenticated"
                                    ],
                                    "edit": [
                                        "group.admin"
                                    ]
                                }
                            },
                            "status": "uploaded",
                            "display_title": "GAPFIMIARUOB.bam",
                            "@id": "/files-processed/GAPFIMIARUOB/",
                            "uuid": "676dd0c1-82c4-41be-9ae7-619ce47e158e",
                            "@type": [
                                "FileProcessed",
                                "File",
                                "Item"
                            ],
                            "file_size": 106616301305,
                            "accession": "GAPFIMIARUOB",
                            "quality_metric": {
                                "overall_quality_status": "PASS",
                                "@type": [
                                    "QualityMetricBamqc",
                                    "QualityMetric",
                                    "Item"
                                ],
                                "status": "shared",
                                "display_title": "QualityMetricBamqc from 2022-04-29",
                                "uuid": "b5978c20-271c-4ac4-8407-8b3fd3c0bb86",
                                "@id": "/quality-metrics-bamqc/b5978c20-271c-4ac4-8407-8b3fd3c0bb86/",
                                "principals_allowed": {
                                    "view": [
                                        "system.Authenticated"
                                    ],
                                    "edit": [
                                        "group.admin"
                                    ]
                                }
                            },
                            "principals_allowed": {
                                "view": [
                                    "editor_for.12a92962-8265-4fc0-b2f8-cf14f05db58b",
                                    "group.admin",
                                    "group.read-only-admin",
                                    "remoteuser.EMBED",
                                    "remoteuser.INDEXER"
                                ],
                                "edit": [
                                    "editor_for.12a92962-8265-4fc0-b2f8-cf14f05db58b",
                                    "group.admin"
                                ]
                            }
                        },
                        "ordinal": 1,
                        "dimension": "0",
                        "workflow_argument_name": "input_bams"
                    },
                    {
                        "value": {
                            "href": "/files-processed/GAPFICEE9LEN/@@download/GAPFICEE9LEN.bam",
                            "file_format": {
                                "uuid": "d13d06cf-218e-4f61-aaf0-91f226248b3c",
                                "@type": [
                                    "FileFormat",
                                    "Item"
                                ],
                                "@id": "/file-formats/bam/",
                                "status": "shared",
                                "display_title": "bam",
                                "principals_allowed": {
                                    "view": [
                                        "system.Authenticated"
                                    ],
                                    "edit": [
                                        "group.admin"
                                    ]
                                }
                            },
                            "status": "uploaded",
                            "display_title": "GAPFICEE9LEN.bam",
                            "@id": "/files-processed/GAPFICEE9LEN/",
                            "uuid": "6d199319-3719-4a42-8883-365072bc13b3",
                            "@type": [
                                "FileProcessed",
                                "File",
                                "Item"
                            ],
                            "file_size": 104992897560,
                            "accession": "GAPFICEE9LEN",
                            "quality_metric": {
                                "overall_quality_status": "PASS",
                                "@type": [
                                    "QualityMetricBamqc",
                                    "QualityMetric",
                                    "Item"
                                ],
                                "status": "shared",
                                "display_title": "QualityMetricBamqc from 2022-04-29",
                                "uuid": "23408f2f-13ca-49d6-b8bf-162623795dd6",
                                "@id": "/quality-metrics-bamqc/23408f2f-13ca-49d6-b8bf-162623795dd6/",
                                "principals_allowed": {
                                    "view": [
                                        "system.Authenticated"
                                    ],
                                    "edit": [
                                        "group.admin"
                                    ]
                                }
                            },
                            "principals_allowed": {
                                "view": [
                                    "editor_for.12a92962-8265-4fc0-b2f8-cf14f05db58b",
                                    "group.admin",
                                    "group.read-only-admin",
                                    "remoteuser.EMBED",
                                    "remoteuser.INDEXER"
                                ],
                                "edit": [
                                    "editor_for.12a92962-8265-4fc0-b2f8-cf14f05db58b",
                                    "group.admin"
                                ]
                            }
                        },
                        "ordinal": 2,
                        "dimension": "1",
                        "workflow_argument_name": "input_bams"
                    },
                    {
                        "value": {
                            "href": "/files-processed/GAPFITNHTOZI/@@download/GAPFITNHTOZI.bam",
                            "file_format": {
                                "uuid": "d13d06cf-218e-4f61-aaf0-91f226248b3c",
                                "@type": [
                                    "FileFormat",
                                    "Item"
                                ],
                                "@id": "/file-formats/bam/",
                                "status": "shared",
                                "display_title": "bam",
                                "principals_allowed": {
                                    "view": [
                                        "system.Authenticated"
                                    ],
                                    "edit": [
                                        "group.admin"
                                    ]
                                }
                            },
                            "status": "uploaded",
                            "display_title": "GAPFITNHTOZI.bam",
                            "@id": "/files-processed/GAPFITNHTOZI/",
                            "uuid": "222ce0eb-22f8-40e3-87d5-f2708ad18393",
                            "@type": [
                                "FileProcessed",
                                "File",
                                "Item"
                            ],
                            "file_size": 111610806810,
                            "accession": "GAPFITNHTOZI",
                            "quality_metric": {
                                "overall_quality_status": "PASS",
                                "@type": [
                                    "QualityMetricBamqc",
                                    "QualityMetric",
                                    "Item"
                                ],
                                "status": "shared",
                                "display_title": "QualityMetricBamqc from 2022-04-29",
                                "uuid": "5530ced5-5252-42f2-afde-0d14e30a669b",
                                "@id": "/quality-metrics-bamqc/5530ced5-5252-42f2-afde-0d14e30a669b/",
                                "principals_allowed": {
                                    "view": [
                                        "system.Authenticated"
                                    ],
                                    "edit": [
                                        "group.admin"
                                    ]
                                }
                            },
                            "principals_allowed": {
                                "view": [
                                    "editor_for.12a92962-8265-4fc0-b2f8-cf14f05db58b",
                                    "group.admin",
                                    "group.read-only-admin",
                                    "remoteuser.EMBED",
                                    "remoteuser.INDEXER"
                                ],
                                "edit": [
                                    "editor_for.12a92962-8265-4fc0-b2f8-cf14f05db58b",
                                    "group.admin"
                                ]
                            }
                        },
                        "ordinal": 3,
                        "dimension": "2",
                        "workflow_argument_name": "input_bams"
                    },
                    {
                        "value": {
                            "href": "/files-processed/GAPFIRGHPIDQ/@@download/GAPFIRGHPIDQ.vcf.gz",
                            "file_format": {
                                "uuid": "1b8f525f-aecb-4211-9ae5-a2c998b05599",
                                "@type": [
                                    "FileFormat",
                                    "Item"
                                ],
                                "@id": "/file-formats/vcf_gz/",
                                "status": "shared",
                                "display_title": "vcf_gz",
                                "principals_allowed": {
                                    "view": [
                                        "system.Authenticated"
                                    ],
                                    "edit": [
                                        "group.admin"
                                    ]
                                }
                            },
                            "status": "uploaded",
                            "display_title": "GAPFIRGHPIDQ.vcf.gz",
                            "@id": "/files-processed/GAPFIRGHPIDQ/",
                            "uuid": "77ae0d41-f922-4646-bee2-029deaefdf49",
                            "@type": [
                                "FileProcessed",
                                "File",
                                "Item"
                            ],
                            "file_size": 5196340,
                            "accession": "GAPFIRGHPIDQ",
                            "quality_metric": {
                                "overall_quality_status": "PASS",
                                "@type": [
                                    "QualityMetricQclist",
                                    "QualityMetric",
                                    "Item"
                                ],
                                "status": "shared",
                                "display_title": "QualityMetricQclist from 2022-04-30",
                                "uuid": "ac83094c-6bb2-4754-9573-ec6f9dc74ee5",
                                "@id": "/quality-metrics-qclist/ac83094c-6bb2-4754-9573-ec6f9dc74ee5/",
                                "principals_allowed": {
                                    "view": [
                                        "system.Authenticated"
                                    ],
                                    "edit": [
                                        "group.admin"
                                    ]
                                }
                            },
                            "principals_allowed": {
                                "view": [
                                    "editor_for.12a92962-8265-4fc0-b2f8-cf14f05db58b",
                                    "group.admin",
                                    "group.read-only-admin",
                                    "remoteuser.EMBED",
                                    "remoteuser.INDEXER"
                                ],
                                "edit": [
                                    "editor_for.12a92962-8265-4fc0-b2f8-cf14f05db58b",
                                    "group.admin"
                                ]
                            }
                        },
                        "ordinal": 1,
                        "dimension": "0",
                        "workflow_argument_name": "input_vcf"
                    },
                    {
                        "value": {
                            "href": "/files-reference/GAPFIXRDPDK5/@@download/GAPFIXRDPDK5.fa",
                            "file_format": {
                                "uuid": "5ced774b-a73e-4d1b-8186-d7fbbde7a3c2",
                                "@type": [
                                    "FileFormat",
                                    "Item"
                                ],
                                "@id": "/file-formats/fa/",
                                "status": "shared",
                                "display_title": "fa",
                                "principals_allowed": {
                                    "view": [
                                        "system.Authenticated"
                                    ],
                                    "edit": [
                                        "group.admin"
                                    ]
                                }
                            },
                            "status": "uploaded",
                            "display_title": "GAPFIXRDPDK5.fa",
                            "@id": "/files-reference/GAPFIXRDPDK5/",
                            "uuid": "1936f246-22e1-45dc-bb5c-9cfd55537fe7",
                            "@type": [
                                "FileReference",
                                "File",
                                "Item"
                            ],
                            "file_size": 3263683042,
                            "accession": "GAPFIXRDPDK5",
                            "principals_allowed": {
                                "view": [
                                    "editor_for.12a92962-8265-4fc0-b2f8-cf14f05db58b",
                                    "group.admin",
                                    "group.read-only-admin",
                                    "remoteuser.EMBED",
                                    "remoteuser.INDEXER"
                                ],
                                "edit": [
                                    "editor_for.12a92962-8265-4fc0-b2f8-cf14f05db58b",
                                    "group.admin"
                                ]
                            }
                        },
                        "ordinal": 1,
                        "dimension": "0",
                        "workflow_argument_name": "ref"
                    }
                ],
                "awsem_job_id": "79NRQiUCqvD9",
                "date_created": "2022-04-30T06:40:40.292408+00:00",
                "output_files": [
                    {
                        "type": "Output QC file",
                        "workflow_argument_name": "bamsnap_images"
                    }
                ],
                "run_platform": "AWSEM",
                "submitted_by": {
                    "display_title": "Tibanna App",
                    "uuid": "b041dba8-e2b2-4e54-a621-97edb508a0c4",
                    "status": "current",
                    "@type": [
                        "User",
                        "Item"
                    ],
                    "@id": "/users/b041dba8-e2b2-4e54-a621-97edb508a0c4/",
                    "principals_allowed": {
                        "view": [
                            "group.admin",
                            "remoteuser.EMBED",
                            "remoteuser.INDEXER",
                            "userid.b041dba8-e2b2-4e54-a621-97edb508a0c4"
                        ],
                        "edit": [
                            "group.admin"
                        ]
                    }
                },
                "last_modified": {
                    "modified_by": {
                        "status": "current",
                        "@type": [
                            "User",
                            "Item"
                        ],
                        "uuid": "7677f8a8-79d2-4cff-ab0a-a967a2a68e39",
                        "@id": "/users/7677f8a8-79d2-4cff-ab0a-a967a2a68e39/",
                        "display_title": "Foursight App",
                        "principals_allowed": {
                            "view": [
                                "group.admin",
                                "remoteuser.EMBED",
                                "remoteuser.INDEXER",
                                "userid.7677f8a8-79d2-4cff-ab0a-a967a2a68e39"
                            ],
                            "edit": [
                                "group.admin"
                            ]
                        }
                    },
                    "date_modified": "2022-04-30T10:00:27.326607+00:00"
                },
                "metadata_only": false,
                "awsem_app_name": "bamsnap",
                "quality_metric": {
                    "status": "shared",
                    "uuid": "ee87f795-2d21-4dea-982c-3d3927035342",
                    "@type": [
                        "QualityMetricWorkflowrun",
                        "QualityMetric",
                        "Item"
                    ],
                    "@id": "/quality-metrics-workflowrun/ee87f795-2d21-4dea-982c-3d3927035342/",
                    "display_title": "QualityMetricWorkflowrun from 2022-04-30",
                    "principals_allowed": {
                        "view": [
                            "system.Authenticated"
                        ],
                        "edit": [
                            "group.admin"
                        ]
                    }
                },
                "schema_version": "3",
                "awsem_postrun_json": "https://s3.amazonaws.com/cgap-biotest-main-application-tibanna-output/79NRQiUCqvD9.postrun.json",
                "associated_meta_workflow_runs": [
                    "a77b8431-2936-4f87-8405-8aa43ee777c1"
                ],
                "@id": "/workflow-runs-awsem/106be8c3-5b02-4809-8205-4b7dae0fc375/",
                "@type": [
                    "WorkflowRunAwsem",
                    "WorkflowRun",
                    "Item"
                ],
                "uuid": "106be8c3-5b02-4809-8205-4b7dae0fc375",
                "principals_allowed": {
                    "view": [
                        "system.Authenticated"
                    ],
                    "edit": [
                        "group.admin"
                    ]
                },
                "display_title": "bamsnap v1.0.0 run 2022-04-30 06:40:40.145843",
                "@context": "/terms/"
            }
        }
    ],
    "schema_version": "1",
    "output_files_linked_status": "success",
    "associated_sample_processing": "e5f5c7f5-ec50-4841-adfd-6191a3e534c8",
    "ignore_output_quality_metrics": false,
    "@id": "/meta-workflow-runs/a77b8431-2936-4f87-8405-8aa43ee777c1/",
    "@type": [
        "MetaWorkflowRun",
        "Item"
    ],
    "uuid": "a77b8431-2936-4f87-8405-8aa43ee777c1",
    "principals_allowed": {
        "view": [
            "editor_for.12a92962-8265-4fc0-b2f8-cf14f05db58b",
            "group.admin",
            "group.read-only-admin",
            "remoteuser.EMBED",
            "remoteuser.INDEXER"
        ],
        "edit": [
            "editor_for.12a92962-8265-4fc0-b2f8-cf14f05db58b",
            "group.admin"
        ]
    },
    "display_title": "MetaWorkflowRun WGS SNV Germline Trio v1.0.0 from 2022-04-29",
    "@context": "/terms/",
    "actions": [
        {
            "name": "create",
            "title": "Create",
            "profile": "/profiles/MetaWorkflowRun.json",
            "href": "/meta-workflow-runs/a77b8431-2936-4f87-8405-8aa43ee777c1/?currentAction=create"
        },
        {
            "name": "edit",
            "title": "Edit",
            "profile": "/profiles/MetaWorkflowRun.json",
            "href": "/meta-workflow-runs/a77b8431-2936-4f87-8405-8aa43ee777c1/?currentAction=edit"
        }
    ],
    "aggregated-items": {},
    "validation-errors": []
};

const TEMPORARY_STEPS = [
    {
        "name": "/workflow-runs-awsem/d9b35c06-6911-4b67-ac04-395331a98e55/",
        "meta": {
            "@id": "/workflow-runs-awsem/d9b35c06-6911-4b67-ac04-395331a98e55/",
            "workflow": {
                "uuid": "ace7324e-2943-435b-ac1d-5565953953d5",
                "status": "in review",
                "display_title": "Run granite mpileupCounts - GAPFKJF3DVC7",
                "@type": [
                    "Workflow",
                    "Item"
                ],
                "@id": "/workflows/ace7324e-2943-435b-ac1d-5565953953d5/",
                "principals_allowed": {
                    "view": [
                        "editor_for.12a92962-8265-4fc0-b2f8-cf14f05db58b",
                        "group.admin",
                        "group.read-only-admin",
                        "remoteuser.EMBED",
                        "remoteuser.INDEXER"
                    ],
                    "edit": [
                        "editor_for.12a92962-8265-4fc0-b2f8-cf14f05db58b",
                        "group.admin"
                    ]
                }
            },
            "analysis_types": "dummy analysis type"
        },
        "inputs": [
            {
                "name": "input_bam",
                "source": [
                    {
                        "name": "input_bams",
                        "for_file": "/files-processed/GAPFIMIARUOB/"
                    }
                ],
                "meta": {
                    "global": true,
                    "type": "data file"
                },
                "run_data": {
                    "type": "input",
                    "file": [
                        {
                            "display_title": "GAPFIMIARUOB.bam",
                            "uuid": "676dd0c1-82c4-41be-9ae7-619ce47e158e",
                            "status": "uploaded",
                            "file_size": 106616301305,
                            "href": "/files-processed/GAPFIMIARUOB/@@download/GAPFIMIARUOB.bam",
                            "@id": "/files-processed/GAPFIMIARUOB/",
                            "accession": "GAPFIMIARUOB",
                            "@type": [
                                "FileProcessed",
                                "File",
                                "Item"
                            ],
                            "file_format": {
                                "@type": [
                                    "FileFormat",
                                    "Item"
                                ],
                                "status": "shared",
                                "@id": "/file-formats/bam/",
                                "uuid": "d13d06cf-218e-4f61-aaf0-91f226248b3c",
                                "display_title": "bam",
                                "principals_allowed": {
                                    "view": [
                                        "system.Authenticated"
                                    ],
                                    "edit": [
                                        "group.admin"
                                    ]
                                }
                            },
                            "principals_allowed": {
                                "view": [
                                    "editor_for.12a92962-8265-4fc0-b2f8-cf14f05db58b",
                                    "group.admin",
                                    "group.read-only-admin",
                                    "remoteuser.EMBED",
                                    "remoteuser.INDEXER"
                                ],
                                "edit": [
                                    "editor_for.12a92962-8265-4fc0-b2f8-cf14f05db58b",
                                    "group.admin"
                                ]
                            },
                            "quality_metric": {
                                "overall_quality_status": "PASS",
                                "uuid": "b5978c20-271c-4ac4-8407-8b3fd3c0bb86",
                                "@id": "/quality-metrics-bamqc/b5978c20-271c-4ac4-8407-8b3fd3c0bb86/",
                                "@type": [
                                    "QualityMetricBamqc",
                                    "QualityMetric",
                                    "Item"
                                ],
                                "status": "shared",
                                "display_title": "QualityMetricBamqc from 2022-04-29",
                                "principals_allowed": {
                                    "view": [
                                        "system.Authenticated"
                                    ],
                                    "edit": [
                                        "group.admin"
                                    ]
                                }
                            }
                        }
                    ],
                    "meta": [
                        {
                            "ordinal": 1,
                            "dimension": "0",
                            "workflow_argument_name": "input_bam"
                        }
                    ]
                }
            },
            {
                "name": "reference",
                "source": [
                    {
                        "name": "reference_fa",
                        "for_file": "/files-reference/GAPFIXRDPDK5/"
                    }
                ],
                "meta": {
                    "global": true,
                    "type": "reference file"
                },
                "run_data": {
                    "type": "input",
                    "file": [
                        {
                            "display_title": "GAPFIXRDPDK5.fa",
                            "uuid": "1936f246-22e1-45dc-bb5c-9cfd55537fe7",
                            "status": "uploaded",
                            "file_size": 3263683042,
                            "href": "/files-reference/GAPFIXRDPDK5/@@download/GAPFIXRDPDK5.fa",
                            "@id": "/files-reference/GAPFIXRDPDK5/",
                            "accession": "GAPFIXRDPDK5",
                            "@type": [
                                "FileReference",
                                "File",
                                "Item"
                            ],
                            "file_format": {
                                "@type": [
                                    "FileFormat",
                                    "Item"
                                ],
                                "status": "shared",
                                "@id": "/file-formats/fa/",
                                "uuid": "5ced774b-a73e-4d1b-8186-d7fbbde7a3c2",
                                "display_title": "fa",
                                "principals_allowed": {
                                    "view": [
                                        "system.Authenticated"
                                    ],
                                    "edit": [
                                        "group.admin"
                                    ]
                                }
                            },
                            "principals_allowed": {
                                "view": [
                                    "editor_for.12a92962-8265-4fc0-b2f8-cf14f05db58b",
                                    "group.admin",
                                    "group.read-only-admin",
                                    "remoteuser.EMBED",
                                    "remoteuser.INDEXER"
                                ],
                                "edit": [
                                    "editor_for.12a92962-8265-4fc0-b2f8-cf14f05db58b",
                                    "group.admin"
                                ]
                            }
                        }
                    ],
                    "meta": [
                        {
                            "ordinal": 1,
                            "dimension": "0",
                            "workflow_argument_name": "reference"
                        }
                    ]
                }
            },
            {
                "name": "regions",
                "source": [
                    {
                        "name": "regions",
                        "for_file": "/files-reference/GAPFIBGEOI72/"
                    }
                ],
                "meta": {
                    "global": true,
                    "type": "reference file"
                },
                "run_data": {
                    "type": "input",
                    "file": [
                        {
                            "display_title": "GAPFIBGEOI72.txt",
                            "uuid": "1c07a3aa-e2a3-498c-b838-15991c4a2f28",
                            "status": "uploaded",
                            "file_size": 7603,
                            "href": "/files-reference/GAPFIBGEOI72/@@download/GAPFIBGEOI72.txt",
                            "@id": "/files-reference/GAPFIBGEOI72/",
                            "accession": "GAPFIBGEOI72",
                            "@type": [
                                "FileReference",
                                "File",
                                "Item"
                            ],
                            "file_format": {
                                "@type": [
                                    "FileFormat",
                                    "Item"
                                ],
                                "status": "shared",
                                "@id": "/file-formats/txt/",
                                "uuid": "0cd4e777-a596-4927-95c8-b07716121aa3",
                                "display_title": "txt",
                                "principals_allowed": {
                                    "view": [
                                        "system.Authenticated"
                                    ],
                                    "edit": [
                                        "group.admin"
                                    ]
                                }
                            },
                            "principals_allowed": {
                                "view": [
                                    "editor_for.12a92962-8265-4fc0-b2f8-cf14f05db58b",
                                    "group.admin",
                                    "group.read-only-admin",
                                    "remoteuser.EMBED",
                                    "remoteuser.INDEXER"
                                ],
                                "edit": [
                                    "editor_for.12a92962-8265-4fc0-b2f8-cf14f05db58b",
                                    "group.admin"
                                ]
                            }
                        }
                    ],
                    "meta": [
                        {
                            "ordinal": 1,
                            "dimension": "0",
                            "workflow_argument_name": "regions"
                        }
                    ]
                }
            },
            {
                "name": "nthreads",
                "source": [
                    {
                        "name": "nthreads"
                    }
                ],
                "meta": {
                    "global": true,
                    "type": "parameter"
                },
                "run_data": {
                    "type": "input",
                    "value": [
                        "15"
                    ],
                    "meta": [
                        {
                            "ordinal": 1
                        }
                    ]
                }
            }
        ],
        "outputs": [
            {
                "name": "rck",
                "target": [
                    {
                        //"name": "rck",
                        "name": "input_rcks",
                        "step": "/workflow-runs-awsem/6fb5a7f0-2156-49e3-bf42-95f4e8decdde/",
                        "for_file": "/files-processed/GAPFI9CNINA2/"
                    }
                ],
                "meta": {
                    "type": "data file"
                },
                "run_data": {
                    "type": "output",
                    "file": [
                        {
                            "display_title": "GAPFI9CNINA2.rck.gz",
                            "status": "uploaded",
                            "@id": "/files-processed/GAPFI9CNINA2/",
                            "uuid": "90d5572a-3cb5-40bd-8cec-68346c28705b",
                            "@type": [
                                "FileProcessed",
                                "File",
                                "Item"
                            ],
                            "principals_allowed": {
                                "view": [
                                    "editor_for.12a92962-8265-4fc0-b2f8-cf14f05db58b",
                                    "group.admin",
                                    "group.read-only-admin",
                                    "remoteuser.EMBED",
                                    "remoteuser.INDEXER"
                                ],
                                "edit": [
                                    "editor_for.12a92962-8265-4fc0-b2f8-cf14f05db58b",
                                    "group.admin"
                                ]
                            }
                        }
                    ],
                    "meta": [
                        {
                            "type": "Output processed file"
                        }
                    ]
                }
            }
        ]
    },
    {
        "name": "/workflow-runs-awsem/8bca34d8-54c4-4de8-9057-ffb868d44795/",
        "meta": {
            "@id": "/workflow-runs-awsem/8bca34d8-54c4-4de8-9057-ffb868d44795/",
            "workflow": {
                "uuid": "ace7324e-2943-435b-ac1d-5565953953d5",
                "status": "in review",
                "display_title": "Run granite mpileupCounts - GAPFKJF3DVC7",
                "@type": [
                    "Workflow",
                    "Item"
                ],
                "@id": "/workflows/ace7324e-2943-435b-ac1d-5565953953d5/",
                "principals_allowed": {
                    "view": [
                        "editor_for.12a92962-8265-4fc0-b2f8-cf14f05db58b",
                        "group.admin",
                        "group.read-only-admin",
                        "remoteuser.EMBED",
                        "remoteuser.INDEXER"
                    ],
                    "edit": [
                        "editor_for.12a92962-8265-4fc0-b2f8-cf14f05db58b",
                        "group.admin"
                    ]
                }
            },
            "analysis_types": "dummy analysis type"
        },
        "inputs": [
            {
                "name": "input_bam",
                "source": [
                    {
                        "name": "input_bams",
                        "for_file": "/files-processed/GAPFICEE9LEN/"
                    }
                ],
                "meta": {
                    "global": true,
                    "type": "data file"
                },
                "run_data": {
                    "type": "input",
                    "file": [
                        {
                            "accession": "GAPFICEE9LEN",
                            "display_title": "GAPFICEE9LEN.bam",
                            "href": "/files-processed/GAPFICEE9LEN/@@download/GAPFICEE9LEN.bam",
                            "file_size": 104992897560,
                            "uuid": "6d199319-3719-4a42-8883-365072bc13b3",
                            "@id": "/files-processed/GAPFICEE9LEN/",
                            "@type": [
                                "FileProcessed",
                                "File",
                                "Item"
                            ],
                            "file_format": {
                                "@id": "/file-formats/bam/",
                                "uuid": "d13d06cf-218e-4f61-aaf0-91f226248b3c",
                                "status": "shared",
                                "@type": [
                                    "FileFormat",
                                    "Item"
                                ],
                                "display_title": "bam",
                                "principals_allowed": {
                                    "view": [
                                        "system.Authenticated"
                                    ],
                                    "edit": [
                                        "group.admin"
                                    ]
                                }
                            },
                            "status": "uploaded",
                            "quality_metric": {
                                "status": "shared",
                                "@id": "/quality-metrics-bamqc/23408f2f-13ca-49d6-b8bf-162623795dd6/",
                                "overall_quality_status": "PASS",
                                "uuid": "23408f2f-13ca-49d6-b8bf-162623795dd6",
                                "@type": [
                                    "QualityMetricBamqc",
                                    "QualityMetric",
                                    "Item"
                                ],
                                "display_title": "QualityMetricBamqc from 2022-04-29",
                                "principals_allowed": {
                                    "view": [
                                        "system.Authenticated"
                                    ],
                                    "edit": [
                                        "group.admin"
                                    ]
                                }
                            },
                            "principals_allowed": {
                                "view": [
                                    "editor_for.12a92962-8265-4fc0-b2f8-cf14f05db58b",
                                    "group.admin",
                                    "group.read-only-admin",
                                    "remoteuser.EMBED",
                                    "remoteuser.INDEXER"
                                ],
                                "edit": [
                                    "editor_for.12a92962-8265-4fc0-b2f8-cf14f05db58b",
                                    "group.admin"
                                ]
                            }
                        }
                    ],
                    "meta": [
                        {
                            "ordinal": 1,
                            "dimension": "0",
                            "workflow_argument_name": "input_bam"
                        }
                    ]
                }
            },
            {
                "name": "reference",
                "source": [
                    {
                        "name": "reference_fa",
                        "for_file": "/files-reference/GAPFIXRDPDK5/"
                    }
                ],
                "meta": {
                    "global": true,
                    "type": "reference file"
                },
                "run_data": {
                    "type": "input",
                    "file": [
                        {
                            "accession": "GAPFIXRDPDK5",
                            "display_title": "GAPFIXRDPDK5.fa",
                            "href": "/files-reference/GAPFIXRDPDK5/@@download/GAPFIXRDPDK5.fa",
                            "file_size": 3263683042,
                            "uuid": "1936f246-22e1-45dc-bb5c-9cfd55537fe7",
                            "@id": "/files-reference/GAPFIXRDPDK5/",
                            "@type": [
                                "FileReference",
                                "File",
                                "Item"
                            ],
                            "file_format": {
                                "@id": "/file-formats/fa/",
                                "uuid": "5ced774b-a73e-4d1b-8186-d7fbbde7a3c2",
                                "status": "shared",
                                "@type": [
                                    "FileFormat",
                                    "Item"
                                ],
                                "display_title": "fa",
                                "principals_allowed": {
                                    "view": [
                                        "system.Authenticated"
                                    ],
                                    "edit": [
                                        "group.admin"
                                    ]
                                }
                            },
                            "status": "uploaded",
                            "principals_allowed": {
                                "view": [
                                    "editor_for.12a92962-8265-4fc0-b2f8-cf14f05db58b",
                                    "group.admin",
                                    "group.read-only-admin",
                                    "remoteuser.EMBED",
                                    "remoteuser.INDEXER"
                                ],
                                "edit": [
                                    "editor_for.12a92962-8265-4fc0-b2f8-cf14f05db58b",
                                    "group.admin"
                                ]
                            }
                        }
                    ],
                    "meta": [
                        {
                            "ordinal": 1,
                            "dimension": "0",
                            "workflow_argument_name": "reference"
                        }
                    ]
                }
            },
            {
                "name": "regions",
                "source": [
                    {
                        "name": "regions",
                        "for_file": "/files-reference/GAPFIBGEOI72/"
                    }
                ],
                "meta": {
                    "global": true,
                    "type": "reference file"
                },
                "run_data": {
                    "type": "input",
                    "file": [
                        {
                            "accession": "GAPFIBGEOI72",
                            "display_title": "GAPFIBGEOI72.txt",
                            "href": "/files-reference/GAPFIBGEOI72/@@download/GAPFIBGEOI72.txt",
                            "file_size": 7603,
                            "uuid": "1c07a3aa-e2a3-498c-b838-15991c4a2f28",
                            "@id": "/files-reference/GAPFIBGEOI72/",
                            "@type": [
                                "FileReference",
                                "File",
                                "Item"
                            ],
                            "file_format": {
                                "@id": "/file-formats/txt/",
                                "uuid": "0cd4e777-a596-4927-95c8-b07716121aa3",
                                "status": "shared",
                                "@type": [
                                    "FileFormat",
                                    "Item"
                                ],
                                "display_title": "txt",
                                "principals_allowed": {
                                    "view": [
                                        "system.Authenticated"
                                    ],
                                    "edit": [
                                        "group.admin"
                                    ]
                                }
                            },
                            "status": "uploaded",
                            "principals_allowed": {
                                "view": [
                                    "editor_for.12a92962-8265-4fc0-b2f8-cf14f05db58b",
                                    "group.admin",
                                    "group.read-only-admin",
                                    "remoteuser.EMBED",
                                    "remoteuser.INDEXER"
                                ],
                                "edit": [
                                    "editor_for.12a92962-8265-4fc0-b2f8-cf14f05db58b",
                                    "group.admin"
                                ]
                            }
                        }
                    ],
                    "meta": [
                        {
                            "ordinal": 1,
                            "dimension": "0",
                            "workflow_argument_name": "regions"
                        }
                    ]
                }
            },
            {
                "name": "nthreads",
                "source": [
                    {
                        "name": "nthreads"
                    }
                ],
                "meta": {
                    "global": true,
                    "type": "parameter"
                },
                "run_data": {
                    "type": "input",
                    "value": [
                        "15"
                    ],
                    "meta": [
                        {
                            "ordinal": 1
                        }
                    ]
                }
            }
        ],
        "outputs": [
            {
                "name": "rck",
                "target": [
                    {
                        "name": "rck",
                        "for_file": "/files-processed/GAPFID5AE9ME/"
                    }
                ],
                "meta": {
                    "type": "data file"
                },
                "run_data": {
                    "type": "output",
                    "file": [
                        {
                            "display_title": "GAPFID5AE9ME.rck.gz",
                            "status": "uploaded",
                            "@id": "/files-processed/GAPFID5AE9ME/",
                            "uuid": "76111407-5e86-48dd-bd13-f3a167638140",
                            "@type": [
                                "FileProcessed",
                                "File",
                                "Item"
                            ],
                            "principals_allowed": {
                                "view": [
                                    "editor_for.12a92962-8265-4fc0-b2f8-cf14f05db58b",
                                    "group.admin",
                                    "group.read-only-admin",
                                    "remoteuser.EMBED",
                                    "remoteuser.INDEXER"
                                ],
                                "edit": [
                                    "editor_for.12a92962-8265-4fc0-b2f8-cf14f05db58b",
                                    "group.admin"
                                ]
                            }
                        }
                    ],
                    "meta": [
                        {
                            "type": "Output processed file"
                        }
                    ]
                }
            }
        ]
    },
    {
        "name": "/workflow-runs-awsem/e93fc945-f186-41e0-a0c3-b19a007ce81c/",
        "meta": {
            "@id": "/workflow-runs-awsem/e93fc945-f186-41e0-a0c3-b19a007ce81c/",
            "workflow": {
                "uuid": "ace7324e-2943-435b-ac1d-5565953953d5",
                "status": "in review",
                "display_title": "Run granite mpileupCounts - GAPFKJF3DVC7",
                "@type": [
                    "Workflow",
                    "Item"
                ],
                "@id": "/workflows/ace7324e-2943-435b-ac1d-5565953953d5/",
                "principals_allowed": {
                    "view": [
                        "editor_for.12a92962-8265-4fc0-b2f8-cf14f05db58b",
                        "group.admin",
                        "group.read-only-admin",
                        "remoteuser.EMBED",
                        "remoteuser.INDEXER"
                    ],
                    "edit": [
                        "editor_for.12a92962-8265-4fc0-b2f8-cf14f05db58b",
                        "group.admin"
                    ]
                }
            },
            "analysis_types": "dummy analysis type"
        },
        "inputs": [
            {
                "name": "input_bam",
                "source": [
                    {
                        "name": "input_bams",
                        "for_file": "/files-processed/GAPFITNHTOZI/"
                    }
                ],
                "meta": {
                    "global": true,
                    "type": "data file"
                },
                "run_data": {
                    "type": "input",
                    "file": [
                        {
                            "uuid": "222ce0eb-22f8-40e3-87d5-f2708ad18393",
                            "href": "/files-processed/GAPFITNHTOZI/@@download/GAPFITNHTOZI.bam",
                            "@id": "/files-processed/GAPFITNHTOZI/",
                            "accession": "GAPFITNHTOZI",
                            "display_title": "GAPFITNHTOZI.bam",
                            "file_size": 111610806810,
                            "@type": [
                                "FileProcessed",
                                "File",
                                "Item"
                            ],
                            "status": "uploaded",
                            "file_format": {
                                "uuid": "d13d06cf-218e-4f61-aaf0-91f226248b3c",
                                "status": "shared",
                                "@id": "/file-formats/bam/",
                                "display_title": "bam",
                                "@type": [
                                    "FileFormat",
                                    "Item"
                                ],
                                "principals_allowed": {
                                    "view": [
                                        "system.Authenticated"
                                    ],
                                    "edit": [
                                        "group.admin"
                                    ]
                                }
                            },
                            "quality_metric": {
                                "display_title": "QualityMetricBamqc from 2022-04-29",
                                "@type": [
                                    "QualityMetricBamqc",
                                    "QualityMetric",
                                    "Item"
                                ],
                                "uuid": "5530ced5-5252-42f2-afde-0d14e30a669b",
                                "@id": "/quality-metrics-bamqc/5530ced5-5252-42f2-afde-0d14e30a669b/",
                                "status": "shared",
                                "overall_quality_status": "PASS",
                                "principals_allowed": {
                                    "view": [
                                        "system.Authenticated"
                                    ],
                                    "edit": [
                                        "group.admin"
                                    ]
                                }
                            },
                            "principals_allowed": {
                                "view": [
                                    "editor_for.12a92962-8265-4fc0-b2f8-cf14f05db58b",
                                    "group.admin",
                                    "group.read-only-admin",
                                    "remoteuser.EMBED",
                                    "remoteuser.INDEXER"
                                ],
                                "edit": [
                                    "editor_for.12a92962-8265-4fc0-b2f8-cf14f05db58b",
                                    "group.admin"
                                ]
                            }
                        }
                    ],
                    "meta": [
                        {
                            "ordinal": 1,
                            "dimension": "0",
                            "workflow_argument_name": "input_bam"
                        }
                    ]
                }
            },
            {
                "name": "reference",
                "source": [
                    {
                        "name": "reference_fa",
                        "for_file": "/files-reference/GAPFIXRDPDK5/"
                    }
                ],
                "meta": {
                    "global": true,
                    "type": "reference file"
                },
                "run_data": {
                    "type": "input",
                    "file": [
                        {
                            "uuid": "1936f246-22e1-45dc-bb5c-9cfd55537fe7",
                            "href": "/files-reference/GAPFIXRDPDK5/@@download/GAPFIXRDPDK5.fa",
                            "@id": "/files-reference/GAPFIXRDPDK5/",
                            "accession": "GAPFIXRDPDK5",
                            "display_title": "GAPFIXRDPDK5.fa",
                            "file_size": 3263683042,
                            "@type": [
                                "FileReference",
                                "File",
                                "Item"
                            ],
                            "status": "uploaded",
                            "file_format": {
                                "uuid": "5ced774b-a73e-4d1b-8186-d7fbbde7a3c2",
                                "status": "shared",
                                "@id": "/file-formats/fa/",
                                "display_title": "fa",
                                "@type": [
                                    "FileFormat",
                                    "Item"
                                ],
                                "principals_allowed": {
                                    "view": [
                                        "system.Authenticated"
                                    ],
                                    "edit": [
                                        "group.admin"
                                    ]
                                }
                            },
                            "principals_allowed": {
                                "view": [
                                    "editor_for.12a92962-8265-4fc0-b2f8-cf14f05db58b",
                                    "group.admin",
                                    "group.read-only-admin",
                                    "remoteuser.EMBED",
                                    "remoteuser.INDEXER"
                                ],
                                "edit": [
                                    "editor_for.12a92962-8265-4fc0-b2f8-cf14f05db58b",
                                    "group.admin"
                                ]
                            }
                        }
                    ],
                    "meta": [
                        {
                            "ordinal": 1,
                            "dimension": "0",
                            "workflow_argument_name": "reference"
                        }
                    ]
                }
            },
            {
                "name": "regions",
                "source": [
                    {
                        "name": "regions",
                        "for_file": "/files-reference/GAPFIBGEOI72/"
                    }
                ],
                "meta": {
                    "global": true,
                    "type": "reference file"
                },
                "run_data": {
                    "type": "input",
                    "file": [
                        {
                            "uuid": "1c07a3aa-e2a3-498c-b838-15991c4a2f28",
                            "href": "/files-reference/GAPFIBGEOI72/@@download/GAPFIBGEOI72.txt",
                            "@id": "/files-reference/GAPFIBGEOI72/",
                            "accession": "GAPFIBGEOI72",
                            "display_title": "GAPFIBGEOI72.txt",
                            "file_size": 7603,
                            "@type": [
                                "FileReference",
                                "File",
                                "Item"
                            ],
                            "status": "uploaded",
                            "file_format": {
                                "uuid": "0cd4e777-a596-4927-95c8-b07716121aa3",
                                "status": "shared",
                                "@id": "/file-formats/txt/",
                                "display_title": "txt",
                                "@type": [
                                    "FileFormat",
                                    "Item"
                                ],
                                "principals_allowed": {
                                    "view": [
                                        "system.Authenticated"
                                    ],
                                    "edit": [
                                        "group.admin"
                                    ]
                                }
                            },
                            "principals_allowed": {
                                "view": [
                                    "editor_for.12a92962-8265-4fc0-b2f8-cf14f05db58b",
                                    "group.admin",
                                    "group.read-only-admin",
                                    "remoteuser.EMBED",
                                    "remoteuser.INDEXER"
                                ],
                                "edit": [
                                    "editor_for.12a92962-8265-4fc0-b2f8-cf14f05db58b",
                                    "group.admin"
                                ]
                            }
                        }
                    ],
                    "meta": [
                        {
                            "ordinal": 1,
                            "dimension": "0",
                            "workflow_argument_name": "regions"
                        }
                    ]
                }
            },
            {
                "name": "nthreads",
                "source": [
                    {
                        "name": "nthreads"
                    }
                ],
                "meta": {
                    "global": true,
                    "type": "parameter"
                },
                "run_data": {
                    "type": "input",
                    "value": [
                        "15"
                    ],
                    "meta": [
                        {
                            "ordinal": 1
                        }
                    ]
                }
            }
        ],
        "outputs": [
            {
                "name": "rck",
                "target": [
                    {
                        "name": "rck",
                        "for_file": "/files-processed/GAPFI5T4QIBP/"
                    }
                ],
                "meta": {
                    "type": "data file"
                },
                "run_data": {
                    "type": "output",
                    "file": [
                        {
                            "display_title": "GAPFI5T4QIBP.rck.gz",
                            "status": "uploaded",
                            "@id": "/files-processed/GAPFI5T4QIBP/",
                            "uuid": "87e8832d-9ece-439a-8602-152b1ee74b0f",
                            "@type": [
                                "FileProcessed",
                                "File",
                                "Item"
                            ],
                            "principals_allowed": {
                                "view": [
                                    "editor_for.12a92962-8265-4fc0-b2f8-cf14f05db58b",
                                    "group.admin",
                                    "group.read-only-admin",
                                    "remoteuser.EMBED",
                                    "remoteuser.INDEXER"
                                ],
                                "edit": [
                                    "editor_for.12a92962-8265-4fc0-b2f8-cf14f05db58b",
                                    "group.admin"
                                ]
                            }
                        }
                    ],
                    "meta": [
                        {
                            "type": "Output processed file"
                        }
                    ]
                }
            }
        ]
    },
    {
        "name": "/workflow-runs-awsem/d2063a22-99c7-420e-b179-6daedad12499/",
        "meta": {
            "@id": "/workflow-runs-awsem/d2063a22-99c7-420e-b179-6daedad12499/",
            "workflow": {
                "uuid": "00035e35-be9c-41c6-9aa9-a0e0b49d0759",
                "status": "in review",
                "display_title": "Run gatk HaplotypeCaller - GAPWFO65T9P3",
                "@type": [
                    "Workflow",
                    "Item"
                ],
                "@id": "/workflows/00035e35-be9c-41c6-9aa9-a0e0b49d0759/",
                "principals_allowed": {
                    "view": [
                        "editor_for.12a92962-8265-4fc0-b2f8-cf14f05db58b",
                        "group.admin",
                        "group.read-only-admin",
                        "remoteuser.EMBED",
                        "remoteuser.INDEXER"
                    ],
                    "edit": [
                        "editor_for.12a92962-8265-4fc0-b2f8-cf14f05db58b",
                        "group.admin"
                    ]
                }
            },
            "analysis_types": "dummy analysis type"
        },
        "inputs": [
            {
                "name": "input_bam",
                "source": [
                    {
                        "name": "input_bams",
                        "for_file": "/files-processed/GAPFIMIARUOB/"
                    }
                ],
                "meta": {
                    "global": true,
                    "type": "data file"
                },
                "run_data": {
                    "type": "input",
                    "file": [
                        {
                            "uuid": "676dd0c1-82c4-41be-9ae7-619ce47e158e",
                            "href": "/files-processed/GAPFIMIARUOB/@@download/GAPFIMIARUOB.bam",
                            "@id": "/files-processed/GAPFIMIARUOB/",
                            "accession": "GAPFIMIARUOB",
                            "display_title": "GAPFIMIARUOB.bam",
                            "file_size": 106616301305,
                            "@type": [
                                "FileProcessed",
                                "File",
                                "Item"
                            ],
                            "status": "uploaded",
                            "file_format": {
                                "uuid": "d13d06cf-218e-4f61-aaf0-91f226248b3c",
                                "status": "shared",
                                "@id": "/file-formats/bam/",
                                "display_title": "bam",
                                "@type": [
                                    "FileFormat",
                                    "Item"
                                ],
                                "principals_allowed": {
                                    "view": [
                                        "system.Authenticated"
                                    ],
                                    "edit": [
                                        "group.admin"
                                    ]
                                }
                            },
                            "quality_metric": {
                                "display_title": "QualityMetricBamqc from 2022-04-29",
                                "@type": [
                                    "QualityMetricBamqc",
                                    "QualityMetric",
                                    "Item"
                                ],
                                "uuid": "b5978c20-271c-4ac4-8407-8b3fd3c0bb86",
                                "@id": "/quality-metrics-bamqc/b5978c20-271c-4ac4-8407-8b3fd3c0bb86/",
                                "status": "shared",
                                "overall_quality_status": "PASS",
                                "principals_allowed": {
                                    "view": [
                                        "system.Authenticated"
                                    ],
                                    "edit": [
                                        "group.admin"
                                    ]
                                }
                            },
                            "principals_allowed": {
                                "view": [
                                    "editor_for.12a92962-8265-4fc0-b2f8-cf14f05db58b",
                                    "group.admin",
                                    "group.read-only-admin",
                                    "remoteuser.EMBED",
                                    "remoteuser.INDEXER"
                                ],
                                "edit": [
                                    "editor_for.12a92962-8265-4fc0-b2f8-cf14f05db58b",
                                    "group.admin"
                                ]
                            }
                        }
                    ],
                    "meta": [
                        {
                            "ordinal": 1,
                            "dimension": "0",
                            "workflow_argument_name": "input_bam"
                        }
                    ]
                }
            },
            {
                "name": "reference",
                "source": [
                    {
                        "name": "reference_fa",
                        "for_file": "/files-reference/GAPFIXRDPDK5/"
                    }
                ],
                "meta": {
                    "global": true,
                    "type": "reference file"
                },
                "run_data": {
                    "type": "input",
                    "file": [
                        {
                            "uuid": "1936f246-22e1-45dc-bb5c-9cfd55537fe7",
                            "href": "/files-reference/GAPFIXRDPDK5/@@download/GAPFIXRDPDK5.fa",
                            "@id": "/files-reference/GAPFIXRDPDK5/",
                            "accession": "GAPFIXRDPDK5",
                            "display_title": "GAPFIXRDPDK5.fa",
                            "file_size": 3263683042,
                            "@type": [
                                "FileReference",
                                "File",
                                "Item"
                            ],
                            "status": "uploaded",
                            "file_format": {
                                "uuid": "5ced774b-a73e-4d1b-8186-d7fbbde7a3c2",
                                "status": "shared",
                                "@id": "/file-formats/fa/",
                                "display_title": "fa",
                                "@type": [
                                    "FileFormat",
                                    "Item"
                                ],
                                "principals_allowed": {
                                    "view": [
                                        "system.Authenticated"
                                    ],
                                    "edit": [
                                        "group.admin"
                                    ]
                                }
                            },
                            "principals_allowed": {
                                "view": [
                                    "editor_for.12a92962-8265-4fc0-b2f8-cf14f05db58b",
                                    "group.admin",
                                    "group.read-only-admin",
                                    "remoteuser.EMBED",
                                    "remoteuser.INDEXER"
                                ],
                                "edit": [
                                    "editor_for.12a92962-8265-4fc0-b2f8-cf14f05db58b",
                                    "group.admin"
                                ]
                            }
                        }
                    ],
                    "meta": [
                        {
                            "ordinal": 1,
                            "dimension": "0",
                            "workflow_argument_name": "reference"
                        }
                    ]
                }
            },
            {
                "name": "regions",
                "source": [
                    {
                        "name": "regions",
                        "for_file": "/files-reference/GAPFIBGEOI72/"
                    }
                ],
                "meta": {
                    "global": true,
                    "type": "reference file"
                },
                "run_data": {
                    "type": "input",
                    "file": [
                        {
                            "uuid": "1c07a3aa-e2a3-498c-b838-15991c4a2f28",
                            "href": "/files-reference/GAPFIBGEOI72/@@download/GAPFIBGEOI72.txt",
                            "@id": "/files-reference/GAPFIBGEOI72/",
                            "accession": "GAPFIBGEOI72",
                            "display_title": "GAPFIBGEOI72.txt",
                            "file_size": 7603,
                            "@type": [
                                "FileReference",
                                "File",
                                "Item"
                            ],
                            "status": "uploaded",
                            "file_format": {
                                "uuid": "0cd4e777-a596-4927-95c8-b07716121aa3",
                                "status": "shared",
                                "@id": "/file-formats/txt/",
                                "display_title": "txt",
                                "@type": [
                                    "FileFormat",
                                    "Item"
                                ],
                                "principals_allowed": {
                                    "view": [
                                        "system.Authenticated"
                                    ],
                                    "edit": [
                                        "group.admin"
                                    ]
                                }
                            },
                            "principals_allowed": {
                                "view": [
                                    "editor_for.12a92962-8265-4fc0-b2f8-cf14f05db58b",
                                    "group.admin",
                                    "group.read-only-admin",
                                    "remoteuser.EMBED",
                                    "remoteuser.INDEXER"
                                ],
                                "edit": [
                                    "editor_for.12a92962-8265-4fc0-b2f8-cf14f05db58b",
                                    "group.admin"
                                ]
                            }
                        }
                    ],
                    "meta": [
                        {
                            "ordinal": 1,
                            "dimension": "0",
                            "workflow_argument_name": "regions"
                        }
                    ]
                }
            },
            {
                "name": "nthreads",
                "source": [
                    {
                        "name": "nthreads"
                    }
                ],
                "meta": {
                    "global": true,
                    "type": "parameter"
                },
                "run_data": {
                    "type": "input",
                    "value": [
                        "20"
                    ],
                    "meta": [
                        {
                            "ordinal": 1
                        }
                    ]
                }
            }
        ],
        "outputs": [
            {
                "name": "gvcf",
                "target": [
                    {
                        "name": "gvcf",
                        "for_file": "/files-processed/GAPFIH71G455/"
                    }
                ],
                "meta": {
                    "type": "data file"
                },
                "run_data": {
                    "type": "output",
                    "file": [
                        {
                            "display_title": "GAPFIH71G455.gvcf.gz",
                            "status": "uploaded",
                            "@id": "/files-processed/GAPFIH71G455/",
                            "uuid": "1e51aea4-7fc1-4936-852a-83fbae9f34ff",
                            "@type": [
                                "FileProcessed",
                                "File",
                                "Item"
                            ],
                            "principals_allowed": {
                                "view": [
                                    "editor_for.12a92962-8265-4fc0-b2f8-cf14f05db58b",
                                    "group.admin",
                                    "group.read-only-admin",
                                    "remoteuser.EMBED",
                                    "remoteuser.INDEXER"
                                ],
                                "edit": [
                                    "editor_for.12a92962-8265-4fc0-b2f8-cf14f05db58b",
                                    "group.admin"
                                ]
                            }
                        }
                    ],
                    "meta": [
                        {
                            "type": "Output processed file"
                        }
                    ]
                }
            }
        ]
    },
    {
        "name": "/workflow-runs-awsem/a59335b9-d462-4578-b718-0fc54428cc77/",
        "meta": {
            "@id": "/workflow-runs-awsem/a59335b9-d462-4578-b718-0fc54428cc77/",
            "workflow": {
                "uuid": "00035e35-be9c-41c6-9aa9-a0e0b49d0759",
                "status": "in review",
                "display_title": "Run gatk HaplotypeCaller - GAPWFO65T9P3",
                "@type": [
                    "Workflow",
                    "Item"
                ],
                "@id": "/workflows/00035e35-be9c-41c6-9aa9-a0e0b49d0759/",
                "principals_allowed": {
                    "view": [
                        "editor_for.12a92962-8265-4fc0-b2f8-cf14f05db58b",
                        "group.admin",
                        "group.read-only-admin",
                        "remoteuser.EMBED",
                        "remoteuser.INDEXER"
                    ],
                    "edit": [
                        "editor_for.12a92962-8265-4fc0-b2f8-cf14f05db58b",
                        "group.admin"
                    ]
                }
            },
            "analysis_types": "dummy analysis type"
        },
        "inputs": [
            {
                "name": "input_bam",
                "source": [
                    {
                        "name": "input_bams",
                        "for_file": "/files-processed/GAPFICEE9LEN/"
                    }
                ],
                "meta": {
                    "global": true,
                    "type": "data file"
                },
                "run_data": {
                    "type": "input",
                    "file": [
                        {
                            "href": "/files-processed/GAPFICEE9LEN/@@download/GAPFICEE9LEN.bam",
                            "file_format": {
                                "uuid": "d13d06cf-218e-4f61-aaf0-91f226248b3c",
                                "@type": [
                                    "FileFormat",
                                    "Item"
                                ],
                                "@id": "/file-formats/bam/",
                                "status": "shared",
                                "display_title": "bam",
                                "principals_allowed": {
                                    "view": [
                                        "system.Authenticated"
                                    ],
                                    "edit": [
                                        "group.admin"
                                    ]
                                }
                            },
                            "status": "uploaded",
                            "display_title": "GAPFICEE9LEN.bam",
                            "@id": "/files-processed/GAPFICEE9LEN/",
                            "uuid": "6d199319-3719-4a42-8883-365072bc13b3",
                            "@type": [
                                "FileProcessed",
                                "File",
                                "Item"
                            ],
                            "file_size": 104992897560,
                            "accession": "GAPFICEE9LEN",
                            "quality_metric": {
                                "overall_quality_status": "PASS",
                                "@type": [
                                    "QualityMetricBamqc",
                                    "QualityMetric",
                                    "Item"
                                ],
                                "status": "shared",
                                "display_title": "QualityMetricBamqc from 2022-04-29",
                                "uuid": "23408f2f-13ca-49d6-b8bf-162623795dd6",
                                "@id": "/quality-metrics-bamqc/23408f2f-13ca-49d6-b8bf-162623795dd6/",
                                "principals_allowed": {
                                    "view": [
                                        "system.Authenticated"
                                    ],
                                    "edit": [
                                        "group.admin"
                                    ]
                                }
                            },
                            "principals_allowed": {
                                "view": [
                                    "editor_for.12a92962-8265-4fc0-b2f8-cf14f05db58b",
                                    "group.admin",
                                    "group.read-only-admin",
                                    "remoteuser.EMBED",
                                    "remoteuser.INDEXER"
                                ],
                                "edit": [
                                    "editor_for.12a92962-8265-4fc0-b2f8-cf14f05db58b",
                                    "group.admin"
                                ]
                            }
                        }
                    ],
                    "meta": [
                        {
                            "ordinal": 1,
                            "dimension": "0",
                            "workflow_argument_name": "input_bam"
                        }
                    ]
                }
            },
            {
                "name": "reference",
                "source": [
                    {
                        "name": "reference_fa",
                        "for_file": "/files-reference/GAPFIXRDPDK5/"
                    }
                ],
                "meta": {
                    "global": true,
                    "type": "reference file"
                },
                "run_data": {
                    "type": "input",
                    "file": [
                        {
                            "href": "/files-reference/GAPFIXRDPDK5/@@download/GAPFIXRDPDK5.fa",
                            "file_format": {
                                "uuid": "5ced774b-a73e-4d1b-8186-d7fbbde7a3c2",
                                "@type": [
                                    "FileFormat",
                                    "Item"
                                ],
                                "@id": "/file-formats/fa/",
                                "status": "shared",
                                "display_title": "fa",
                                "principals_allowed": {
                                    "view": [
                                        "system.Authenticated"
                                    ],
                                    "edit": [
                                        "group.admin"
                                    ]
                                }
                            },
                            "status": "uploaded",
                            "display_title": "GAPFIXRDPDK5.fa",
                            "@id": "/files-reference/GAPFIXRDPDK5/",
                            "uuid": "1936f246-22e1-45dc-bb5c-9cfd55537fe7",
                            "@type": [
                                "FileReference",
                                "File",
                                "Item"
                            ],
                            "file_size": 3263683042,
                            "accession": "GAPFIXRDPDK5",
                            "principals_allowed": {
                                "view": [
                                    "editor_for.12a92962-8265-4fc0-b2f8-cf14f05db58b",
                                    "group.admin",
                                    "group.read-only-admin",
                                    "remoteuser.EMBED",
                                    "remoteuser.INDEXER"
                                ],
                                "edit": [
                                    "editor_for.12a92962-8265-4fc0-b2f8-cf14f05db58b",
                                    "group.admin"
                                ]
                            }
                        }
                    ],
                    "meta": [
                        {
                            "ordinal": 1,
                            "dimension": "0",
                            "workflow_argument_name": "reference"
                        }
                    ]
                }
            },
            {
                "name": "regions",
                "source": [
                    {
                        "name": "regions",
                        "for_file": "/files-reference/GAPFIBGEOI72/"
                    }
                ],
                "meta": {
                    "global": true,
                    "type": "reference file"
                },
                "run_data": {
                    "type": "input",
                    "file": [
                        {
                            "href": "/files-reference/GAPFIBGEOI72/@@download/GAPFIBGEOI72.txt",
                            "file_format": {
                                "uuid": "0cd4e777-a596-4927-95c8-b07716121aa3",
                                "@type": [
                                    "FileFormat",
                                    "Item"
                                ],
                                "@id": "/file-formats/txt/",
                                "status": "shared",
                                "display_title": "txt",
                                "principals_allowed": {
                                    "view": [
                                        "system.Authenticated"
                                    ],
                                    "edit": [
                                        "group.admin"
                                    ]
                                }
                            },
                            "status": "uploaded",
                            "display_title": "GAPFIBGEOI72.txt",
                            "@id": "/files-reference/GAPFIBGEOI72/",
                            "uuid": "1c07a3aa-e2a3-498c-b838-15991c4a2f28",
                            "@type": [
                                "FileReference",
                                "File",
                                "Item"
                            ],
                            "file_size": 7603,
                            "accession": "GAPFIBGEOI72",
                            "principals_allowed": {
                                "view": [
                                    "editor_for.12a92962-8265-4fc0-b2f8-cf14f05db58b",
                                    "group.admin",
                                    "group.read-only-admin",
                                    "remoteuser.EMBED",
                                    "remoteuser.INDEXER"
                                ],
                                "edit": [
                                    "editor_for.12a92962-8265-4fc0-b2f8-cf14f05db58b",
                                    "group.admin"
                                ]
                            }
                        }
                    ],
                    "meta": [
                        {
                            "ordinal": 1,
                            "dimension": "0",
                            "workflow_argument_name": "regions"
                        }
                    ]
                }
            },
            {
                "name": "nthreads",
                "source": [
                    {
                        "name": "nthreads"
                    }
                ],
                "meta": {
                    "global": true,
                    "type": "parameter"
                },
                "run_data": {
                    "type": "input",
                    "value": [
                        "20"
                    ],
                    "meta": [
                        {
                            "ordinal": 1
                        }
                    ]
                }
            }
        ],
        "outputs": [
            {
                "name": "gvcf",
                "target": [
                    {
                        "name": "gvcf",
                        "for_file": "/files-processed/GAPFIXEYX9Q1/"
                    }
                ],
                "meta": {
                    "type": "data file"
                },
                "run_data": {
                    "type": "output",
                    "file": [
                        {
                            "display_title": "GAPFIXEYX9Q1.gvcf.gz",
                            "status": "uploaded",
                            "@id": "/files-processed/GAPFIXEYX9Q1/",
                            "uuid": "1bb89ec3-12cd-46de-bbd7-7ba95db3fec6",
                            "@type": [
                                "FileProcessed",
                                "File",
                                "Item"
                            ],
                            "principals_allowed": {
                                "view": [
                                    "editor_for.12a92962-8265-4fc0-b2f8-cf14f05db58b",
                                    "group.admin",
                                    "group.read-only-admin",
                                    "remoteuser.EMBED",
                                    "remoteuser.INDEXER"
                                ],
                                "edit": [
                                    "editor_for.12a92962-8265-4fc0-b2f8-cf14f05db58b",
                                    "group.admin"
                                ]
                            }
                        }
                    ],
                    "meta": [
                        {
                            "type": "Output processed file"
                        }
                    ]
                }
            }
        ]
    },
    {
        "name": "/workflow-runs-awsem/3f8e7c4e-254b-4981-81c8-d54821b0676c/",
        "meta": {
            "@id": "/workflow-runs-awsem/3f8e7c4e-254b-4981-81c8-d54821b0676c/",
            "workflow": {
                "uuid": "00035e35-be9c-41c6-9aa9-a0e0b49d0759",
                "status": "in review",
                "display_title": "Run gatk HaplotypeCaller - GAPWFO65T9P3",
                "@type": [
                    "Workflow",
                    "Item"
                ],
                "@id": "/workflows/00035e35-be9c-41c6-9aa9-a0e0b49d0759/",
                "principals_allowed": {
                    "view": [
                        "editor_for.12a92962-8265-4fc0-b2f8-cf14f05db58b",
                        "group.admin",
                        "group.read-only-admin",
                        "remoteuser.EMBED",
                        "remoteuser.INDEXER"
                    ],
                    "edit": [
                        "editor_for.12a92962-8265-4fc0-b2f8-cf14f05db58b",
                        "group.admin"
                    ]
                }
            },
            "analysis_types": "dummy analysis type"
        },
        "inputs": [
            {
                "name": "input_bam",
                "source": [
                    {
                        "name": "input_bams",
                        "for_file": "/files-processed/GAPFITNHTOZI/"
                    }
                ],
                "meta": {
                    "global": true,
                    "type": "data file"
                },
                "run_data": {
                    "type": "input",
                    "file": [
                        {
                            "accession": "GAPFITNHTOZI",
                            "display_title": "GAPFITNHTOZI.bam",
                            "href": "/files-processed/GAPFITNHTOZI/@@download/GAPFITNHTOZI.bam",
                            "file_size": 111610806810,
                            "uuid": "222ce0eb-22f8-40e3-87d5-f2708ad18393",
                            "@id": "/files-processed/GAPFITNHTOZI/",
                            "@type": [
                                "FileProcessed",
                                "File",
                                "Item"
                            ],
                            "file_format": {
                                "@id": "/file-formats/bam/",
                                "uuid": "d13d06cf-218e-4f61-aaf0-91f226248b3c",
                                "status": "shared",
                                "@type": [
                                    "FileFormat",
                                    "Item"
                                ],
                                "display_title": "bam",
                                "principals_allowed": {
                                    "view": [
                                        "system.Authenticated"
                                    ],
                                    "edit": [
                                        "group.admin"
                                    ]
                                }
                            },
                            "status": "uploaded",
                            "quality_metric": {
                                "status": "shared",
                                "@id": "/quality-metrics-bamqc/5530ced5-5252-42f2-afde-0d14e30a669b/",
                                "overall_quality_status": "PASS",
                                "uuid": "5530ced5-5252-42f2-afde-0d14e30a669b",
                                "@type": [
                                    "QualityMetricBamqc",
                                    "QualityMetric",
                                    "Item"
                                ],
                                "display_title": "QualityMetricBamqc from 2022-04-29",
                                "principals_allowed": {
                                    "view": [
                                        "system.Authenticated"
                                    ],
                                    "edit": [
                                        "group.admin"
                                    ]
                                }
                            },
                            "principals_allowed": {
                                "view": [
                                    "editor_for.12a92962-8265-4fc0-b2f8-cf14f05db58b",
                                    "group.admin",
                                    "group.read-only-admin",
                                    "remoteuser.EMBED",
                                    "remoteuser.INDEXER"
                                ],
                                "edit": [
                                    "editor_for.12a92962-8265-4fc0-b2f8-cf14f05db58b",
                                    "group.admin"
                                ]
                            }
                        }
                    ],
                    "meta": [
                        {
                            "ordinal": 1,
                            "dimension": "0",
                            "workflow_argument_name": "input_bam"
                        }
                    ]
                }
            },
            {
                "name": "reference",
                "source": [
                    {
                        "name": "reference_fa",
                        "for_file": "/files-reference/GAPFIXRDPDK5/"
                    }
                ],
                "meta": {
                    "global": true,
                    "type": "reference file"
                },
                "run_data": {
                    "type": "input",
                    "file": [
                        {
                            "accession": "GAPFIXRDPDK5",
                            "display_title": "GAPFIXRDPDK5.fa",
                            "href": "/files-reference/GAPFIXRDPDK5/@@download/GAPFIXRDPDK5.fa",
                            "file_size": 3263683042,
                            "uuid": "1936f246-22e1-45dc-bb5c-9cfd55537fe7",
                            "@id": "/files-reference/GAPFIXRDPDK5/",
                            "@type": [
                                "FileReference",
                                "File",
                                "Item"
                            ],
                            "file_format": {
                                "@id": "/file-formats/fa/",
                                "uuid": "5ced774b-a73e-4d1b-8186-d7fbbde7a3c2",
                                "status": "shared",
                                "@type": [
                                    "FileFormat",
                                    "Item"
                                ],
                                "display_title": "fa",
                                "principals_allowed": {
                                    "view": [
                                        "system.Authenticated"
                                    ],
                                    "edit": [
                                        "group.admin"
                                    ]
                                }
                            },
                            "status": "uploaded",
                            "principals_allowed": {
                                "view": [
                                    "editor_for.12a92962-8265-4fc0-b2f8-cf14f05db58b",
                                    "group.admin",
                                    "group.read-only-admin",
                                    "remoteuser.EMBED",
                                    "remoteuser.INDEXER"
                                ],
                                "edit": [
                                    "editor_for.12a92962-8265-4fc0-b2f8-cf14f05db58b",
                                    "group.admin"
                                ]
                            }
                        }
                    ],
                    "meta": [
                        {
                            "ordinal": 1,
                            "dimension": "0",
                            "workflow_argument_name": "reference"
                        }
                    ]
                }
            },
            {
                "name": "regions",
                "source": [
                    {
                        "name": "regions",
                        "for_file": "/files-reference/GAPFIBGEOI72/"
                    }
                ],
                "meta": {
                    "global": true,
                    "type": "reference file"
                },
                "run_data": {
                    "type": "input",
                    "file": [
                        {
                            "accession": "GAPFIBGEOI72",
                            "display_title": "GAPFIBGEOI72.txt",
                            "href": "/files-reference/GAPFIBGEOI72/@@download/GAPFIBGEOI72.txt",
                            "file_size": 7603,
                            "uuid": "1c07a3aa-e2a3-498c-b838-15991c4a2f28",
                            "@id": "/files-reference/GAPFIBGEOI72/",
                            "@type": [
                                "FileReference",
                                "File",
                                "Item"
                            ],
                            "file_format": {
                                "@id": "/file-formats/txt/",
                                "uuid": "0cd4e777-a596-4927-95c8-b07716121aa3",
                                "status": "shared",
                                "@type": [
                                    "FileFormat",
                                    "Item"
                                ],
                                "display_title": "txt",
                                "principals_allowed": {
                                    "view": [
                                        "system.Authenticated"
                                    ],
                                    "edit": [
                                        "group.admin"
                                    ]
                                }
                            },
                            "status": "uploaded",
                            "principals_allowed": {
                                "view": [
                                    "editor_for.12a92962-8265-4fc0-b2f8-cf14f05db58b",
                                    "group.admin",
                                    "group.read-only-admin",
                                    "remoteuser.EMBED",
                                    "remoteuser.INDEXER"
                                ],
                                "edit": [
                                    "editor_for.12a92962-8265-4fc0-b2f8-cf14f05db58b",
                                    "group.admin"
                                ]
                            }
                        }
                    ],
                    "meta": [
                        {
                            "ordinal": 1,
                            "dimension": "0",
                            "workflow_argument_name": "regions"
                        }
                    ]
                }
            },
            {
                "name": "nthreads",
                "source": [
                    {
                        "name": "nthreads"
                    }
                ],
                "meta": {
                    "global": true,
                    "type": "parameter"
                },
                "run_data": {
                    "type": "input",
                    "value": [
                        "20"
                    ],
                    "meta": [
                        {
                            "ordinal": 1
                        }
                    ]
                }
            }
        ],
        "outputs": [
            {
                "name": "gvcf",
                "target": [
                    {
                        "name": "gvcf",
                        "for_file": "/files-processed/GAPFINHTTKUZ/"
                    }
                ],
                "meta": {
                    "type": "data file"
                },
                "run_data": {
                    "type": "output",
                    "file": [
                        {
                            "display_title": "GAPFINHTTKUZ.gvcf.gz",
                            "status": "uploaded",
                            "@id": "/files-processed/GAPFINHTTKUZ/",
                            "uuid": "ed25677e-f2d6-4429-b9d2-300a36cff6ed",
                            "@type": [
                                "FileProcessed",
                                "File",
                                "Item"
                            ],
                            "principals_allowed": {
                                "view": [
                                    "editor_for.12a92962-8265-4fc0-b2f8-cf14f05db58b",
                                    "group.admin",
                                    "group.read-only-admin",
                                    "remoteuser.EMBED",
                                    "remoteuser.INDEXER"
                                ],
                                "edit": [
                                    "editor_for.12a92962-8265-4fc0-b2f8-cf14f05db58b",
                                    "group.admin"
                                ]
                            }
                        }
                    ],
                    "meta": [
                        {
                            "type": "Output processed file"
                        }
                    ]
                }
            }
        ]
    },
    {
        "name": "/workflow-runs-awsem/6fb5a7f0-2156-49e3-bf42-95f4e8decdde/",
        "meta": {
            "@id": "/workflow-runs-awsem/6fb5a7f0-2156-49e3-bf42-95f4e8decdde/",
            "workflow": {
                "uuid": "14eb6324-1ac2-40fd-9f39-de7f46604763",
                "status": "in review",
                "display_title": "Create a tar archive of rck files and an associate index file - GAPW9IDRLG31",
                "@type": [
                    "Workflow",
                    "Item"
                ],
                "@id": "/workflows/14eb6324-1ac2-40fd-9f39-de7f46604763/",
                "principals_allowed": {
                    "view": [
                        "editor_for.12a92962-8265-4fc0-b2f8-cf14f05db58b",
                        "group.admin",
                        "group.read-only-admin",
                        "remoteuser.EMBED",
                        "remoteuser.INDEXER"
                    ],
                    "edit": [
                        "editor_for.12a92962-8265-4fc0-b2f8-cf14f05db58b",
                        "group.admin"
                    ]
                }
            },
            "analysis_types": "dummy analysis type"
        },
        "inputs": [
            {
                "name": "input_rcks",
                "source": [
                    {
                        "name": "rck",
                        "step": "/workflow-runs-awsem/d9b35c06-6911-4b67-ac04-395331a98e55/",
                        "for_file": "/files-processed/GAPFI9CNINA2/"
                    },
                    {
                        "name": "rck",
                        "step": "/workflow-runs-awsem/8bca34d8-54c4-4de8-9057-ffb868d44795/",
                        "for_file": "/files-processed/GAPFID5AE9ME/"
                    },
                    {
                        "name": "rck",
                        "step": "/workflow-runs-awsem/e93fc945-f186-41e0-a0c3-b19a007ce81c/",
                        "for_file": "/files-processed/GAPFI5T4QIBP/"
                    }
                ],
                "meta": {
                    "global": false,
                    "type": "data file"
                },
                "run_data": {
                    "type": "input",
                    "file": [
                        {
                            "accession": "GAPFI9CNINA2",
                            "display_title": "GAPFI9CNINA2.rck.gz",
                            "href": "/files-processed/GAPFI9CNINA2/@@download/GAPFI9CNINA2.rck.gz",
                            "file_size": 11922164723,
                            "uuid": "90d5572a-3cb5-40bd-8cec-68346c28705b",
                            "@id": "/files-processed/GAPFI9CNINA2/",
                            "@type": [
                                "FileProcessed",
                                "File",
                                "Item"
                            ],
                            "file_format": {
                                "@id": "/file-formats/rck_gz/",
                                "uuid": "20d4d3aa-5f1c-4b75-9e25-73f9f370fefa",
                                "status": "shared",
                                "@type": [
                                    "FileFormat",
                                    "Item"
                                ],
                                "display_title": "rck_gz",
                                "principals_allowed": {
                                    "view": [
                                        "system.Authenticated"
                                    ],
                                    "edit": [
                                        "group.admin"
                                    ]
                                }
                            },
                            "status": "uploaded",
                            "principals_allowed": {
                                "view": [
                                    "editor_for.12a92962-8265-4fc0-b2f8-cf14f05db58b",
                                    "group.admin",
                                    "group.read-only-admin",
                                    "remoteuser.EMBED",
                                    "remoteuser.INDEXER"
                                ],
                                "edit": [
                                    "editor_for.12a92962-8265-4fc0-b2f8-cf14f05db58b",
                                    "group.admin"
                                ]
                            }
                        },
                        {
                            "accession": "GAPFID5AE9ME",
                            "display_title": "GAPFID5AE9ME.rck.gz",
                            "href": "/files-processed/GAPFID5AE9ME/@@download/GAPFID5AE9ME.rck.gz",
                            "file_size": 11874191792,
                            "uuid": "76111407-5e86-48dd-bd13-f3a167638140",
                            "@id": "/files-processed/GAPFID5AE9ME/",
                            "@type": [
                                "FileProcessed",
                                "File",
                                "Item"
                            ],
                            "file_format": {
                                "@id": "/file-formats/rck_gz/",
                                "uuid": "20d4d3aa-5f1c-4b75-9e25-73f9f370fefa",
                                "status": "shared",
                                "@type": [
                                    "FileFormat",
                                    "Item"
                                ],
                                "display_title": "rck_gz",
                                "principals_allowed": {
                                    "view": [
                                        "system.Authenticated"
                                    ],
                                    "edit": [
                                        "group.admin"
                                    ]
                                }
                            },
                            "status": "uploaded",
                            "principals_allowed": {
                                "view": [
                                    "editor_for.12a92962-8265-4fc0-b2f8-cf14f05db58b",
                                    "group.admin",
                                    "group.read-only-admin",
                                    "remoteuser.EMBED",
                                    "remoteuser.INDEXER"
                                ],
                                "edit": [
                                    "editor_for.12a92962-8265-4fc0-b2f8-cf14f05db58b",
                                    "group.admin"
                                ]
                            }
                        },
                        {
                            "accession": "GAPFI5T4QIBP",
                            "display_title": "GAPFI5T4QIBP.rck.gz",
                            "href": "/files-processed/GAPFI5T4QIBP/@@download/GAPFI5T4QIBP.rck.gz",
                            "file_size": 12086253767,
                            "uuid": "87e8832d-9ece-439a-8602-152b1ee74b0f",
                            "@id": "/files-processed/GAPFI5T4QIBP/",
                            "@type": [
                                "FileProcessed",
                                "File",
                                "Item"
                            ],
                            "file_format": {
                                "@id": "/file-formats/rck_gz/",
                                "uuid": "20d4d3aa-5f1c-4b75-9e25-73f9f370fefa",
                                "status": "shared",
                                "@type": [
                                    "FileFormat",
                                    "Item"
                                ],
                                "display_title": "rck_gz",
                                "principals_allowed": {
                                    "view": [
                                        "system.Authenticated"
                                    ],
                                    "edit": [
                                        "group.admin"
                                    ]
                                }
                            },
                            "status": "uploaded",
                            "principals_allowed": {
                                "view": [
                                    "editor_for.12a92962-8265-4fc0-b2f8-cf14f05db58b",
                                    "group.admin",
                                    "group.read-only-admin",
                                    "remoteuser.EMBED",
                                    "remoteuser.INDEXER"
                                ],
                                "edit": [
                                    "editor_for.12a92962-8265-4fc0-b2f8-cf14f05db58b",
                                    "group.admin"
                                ]
                            }
                        }
                    ],
                    "meta": [
                        {
                            "ordinal": 1,
                            "dimension": "0",
                            "workflow_argument_name": "input_rcks"
                        },
                        {
                            "ordinal": 2,
                            "dimension": "1",
                            "workflow_argument_name": "input_rcks"
                        },
                        {
                            "ordinal": 3,
                            "dimension": "2",
                            "workflow_argument_name": "input_rcks"
                        }
                    ]
                }
            }
        ],
        "outputs": [
            {
                "name": "rck_tar",
                "target": [
                    {
                        "name": "rck_tar",
                        "for_file": "/files-processed/GAPFI7TBYWC7/"
                    }
                ],
                "meta": {
                    "type": "data file"
                },
                "run_data": {
                    "type": "output",
                    "file": [
                        {
                            "display_title": "GAPFI7TBYWC7.rck.tar",
                            "status": "uploaded",
                            "@id": "/files-processed/GAPFI7TBYWC7/",
                            "uuid": "3e8a17d1-e07f-4226-bd6a-a4ca13606528",
                            "@type": [
                                "FileProcessed",
                                "File",
                                "Item"
                            ],
                            "principals_allowed": {
                                "view": [
                                    "editor_for.12a92962-8265-4fc0-b2f8-cf14f05db58b",
                                    "group.admin",
                                    "group.read-only-admin",
                                    "remoteuser.EMBED",
                                    "remoteuser.INDEXER"
                                ],
                                "edit": [
                                    "editor_for.12a92962-8265-4fc0-b2f8-cf14f05db58b",
                                    "group.admin"
                                ]
                            }
                        }
                    ],
                    "meta": [
                        {
                            "type": "Output processed file"
                        }
                    ]
                }
            }
        ]
    },
    {
        "name": "/workflow-runs-awsem/59fc114b-ccd6-416d-9555-4d2270c4c3dd/",
        "meta": {
            "@id": "/workflow-runs-awsem/59fc114b-ccd6-416d-9555-4d2270c4c3dd/",
            "workflow": {
                "uuid": "dce317eb-8dcf-4ea3-94ef-6a4a4fbe4bed",
                "status": "in review",
                "display_title": "Run gatk CombineGVCFs - GAPWFR81TL9K",
                "@type": [
                    "Workflow",
                    "Item"
                ],
                "@id": "/workflows/dce317eb-8dcf-4ea3-94ef-6a4a4fbe4bed/",
                "principals_allowed": {
                    "view": [
                        "editor_for.12a92962-8265-4fc0-b2f8-cf14f05db58b",
                        "group.admin",
                        "group.read-only-admin",
                        "remoteuser.EMBED",
                        "remoteuser.INDEXER"
                    ],
                    "edit": [
                        "editor_for.12a92962-8265-4fc0-b2f8-cf14f05db58b",
                        "group.admin"
                    ]
                }
            },
            "analysis_types": "dummy analysis type"
        },
        "inputs": [
            {
                "name": "input_gvcfs",
                "source": [
                    {
                        "name": "gvcf",
                        "step": "workflow_gatk-HaplotypeCaller",
                        "for_file": "/files-processed/GAPFIH71G455/"
                    },
                    {
                        "name": "gvcf",
                        "step": "workflow_gatk-HaplotypeCaller",
                        "for_file": "/files-processed/GAPFIXEYX9Q1/"
                    },
                    {
                        "name": "gvcf",
                        "step": "workflow_gatk-HaplotypeCaller",
                        "for_file": "/files-processed/GAPFINHTTKUZ/"
                    }
                ],
                "meta": {
                    "global": false,
                    "type": "data file"
                },
                "run_data": {
                    "type": "input",
                    "file": [
                        {
                            "display_title": "GAPFIH71G455.gvcf.gz",
                            "uuid": "1e51aea4-7fc1-4936-852a-83fbae9f34ff",
                            "status": "uploaded",
                            "file_size": 2212472843,
                            "href": "/files-processed/GAPFIH71G455/@@download/GAPFIH71G455.gvcf.gz",
                            "@id": "/files-processed/GAPFIH71G455/",
                            "accession": "GAPFIH71G455",
                            "@type": [
                                "FileProcessed",
                                "File",
                                "Item"
                            ],
                            "file_format": {
                                "@type": [
                                    "FileFormat",
                                    "Item"
                                ],
                                "status": "shared",
                                "@id": "/file-formats/gvcf_gz/",
                                "uuid": "ad47d469-4561-4234-bce2-820f08f58e7c",
                                "display_title": "gvcf_gz",
                                "principals_allowed": {
                                    "view": [
                                        "system.Authenticated"
                                    ],
                                    "edit": [
                                        "group.admin"
                                    ]
                                }
                            },
                            "principals_allowed": {
                                "view": [
                                    "editor_for.12a92962-8265-4fc0-b2f8-cf14f05db58b",
                                    "group.admin",
                                    "group.read-only-admin",
                                    "remoteuser.EMBED",
                                    "remoteuser.INDEXER"
                                ],
                                "edit": [
                                    "editor_for.12a92962-8265-4fc0-b2f8-cf14f05db58b",
                                    "group.admin"
                                ]
                            }
                        },
                        {
                            "display_title": "GAPFIXEYX9Q1.gvcf.gz",
                            "uuid": "1bb89ec3-12cd-46de-bbd7-7ba95db3fec6",
                            "status": "uploaded",
                            "file_size": 2200279777,
                            "href": "/files-processed/GAPFIXEYX9Q1/@@download/GAPFIXEYX9Q1.gvcf.gz",
                            "@id": "/files-processed/GAPFIXEYX9Q1/",
                            "accession": "GAPFIXEYX9Q1",
                            "@type": [
                                "FileProcessed",
                                "File",
                                "Item"
                            ],
                            "file_format": {
                                "@type": [
                                    "FileFormat",
                                    "Item"
                                ],
                                "status": "shared",
                                "@id": "/file-formats/gvcf_gz/",
                                "uuid": "ad47d469-4561-4234-bce2-820f08f58e7c",
                                "display_title": "gvcf_gz",
                                "principals_allowed": {
                                    "view": [
                                        "system.Authenticated"
                                    ],
                                    "edit": [
                                        "group.admin"
                                    ]
                                }
                            },
                            "principals_allowed": {
                                "view": [
                                    "editor_for.12a92962-8265-4fc0-b2f8-cf14f05db58b",
                                    "group.admin",
                                    "group.read-only-admin",
                                    "remoteuser.EMBED",
                                    "remoteuser.INDEXER"
                                ],
                                "edit": [
                                    "editor_for.12a92962-8265-4fc0-b2f8-cf14f05db58b",
                                    "group.admin"
                                ]
                            }
                        },
                        {
                            "display_title": "GAPFINHTTKUZ.gvcf.gz",
                            "uuid": "ed25677e-f2d6-4429-b9d2-300a36cff6ed",
                            "status": "uploaded",
                            "file_size": 2250854837,
                            "href": "/files-processed/GAPFINHTTKUZ/@@download/GAPFINHTTKUZ.gvcf.gz",
                            "@id": "/files-processed/GAPFINHTTKUZ/",
                            "accession": "GAPFINHTTKUZ",
                            "@type": [
                                "FileProcessed",
                                "File",
                                "Item"
                            ],
                            "file_format": {
                                "@type": [
                                    "FileFormat",
                                    "Item"
                                ],
                                "status": "shared",
                                "@id": "/file-formats/gvcf_gz/",
                                "uuid": "ad47d469-4561-4234-bce2-820f08f58e7c",
                                "display_title": "gvcf_gz",
                                "principals_allowed": {
                                    "view": [
                                        "system.Authenticated"
                                    ],
                                    "edit": [
                                        "group.admin"
                                    ]
                                }
                            },
                            "principals_allowed": {
                                "view": [
                                    "editor_for.12a92962-8265-4fc0-b2f8-cf14f05db58b",
                                    "group.admin",
                                    "group.read-only-admin",
                                    "remoteuser.EMBED",
                                    "remoteuser.INDEXER"
                                ],
                                "edit": [
                                    "editor_for.12a92962-8265-4fc0-b2f8-cf14f05db58b",
                                    "group.admin"
                                ]
                            }
                        }
                    ],
                    "meta": [
                        {
                            "ordinal": 1,
                            "dimension": "0",
                            "workflow_argument_name": "input_gvcfs"
                        },
                        {
                            "ordinal": 2,
                            "dimension": "1",
                            "workflow_argument_name": "input_gvcfs"
                        },
                        {
                            "ordinal": 3,
                            "dimension": "2",
                            "workflow_argument_name": "input_gvcfs"
                        }
                    ]
                }
            },
            {
                "name": "reference",
                "source": [
                    {
                        "name": "reference_fa",
                        "for_file": "/files-reference/GAPFIXRDPDK5/"
                    }
                ],
                "meta": {
                    "global": true,
                    "type": "reference file"
                },
                "run_data": {
                    "type": "input",
                    "file": [
                        {
                            "display_title": "GAPFIXRDPDK5.fa",
                            "uuid": "1936f246-22e1-45dc-bb5c-9cfd55537fe7",
                            "status": "uploaded",
                            "file_size": 3263683042,
                            "href": "/files-reference/GAPFIXRDPDK5/@@download/GAPFIXRDPDK5.fa",
                            "@id": "/files-reference/GAPFIXRDPDK5/",
                            "accession": "GAPFIXRDPDK5",
                            "@type": [
                                "FileReference",
                                "File",
                                "Item"
                            ],
                            "file_format": {
                                "@type": [
                                    "FileFormat",
                                    "Item"
                                ],
                                "status": "shared",
                                "@id": "/file-formats/fa/",
                                "uuid": "5ced774b-a73e-4d1b-8186-d7fbbde7a3c2",
                                "display_title": "fa",
                                "principals_allowed": {
                                    "view": [
                                        "system.Authenticated"
                                    ],
                                    "edit": [
                                        "group.admin"
                                    ]
                                }
                            },
                            "principals_allowed": {
                                "view": [
                                    "editor_for.12a92962-8265-4fc0-b2f8-cf14f05db58b",
                                    "group.admin",
                                    "group.read-only-admin",
                                    "remoteuser.EMBED",
                                    "remoteuser.INDEXER"
                                ],
                                "edit": [
                                    "editor_for.12a92962-8265-4fc0-b2f8-cf14f05db58b",
                                    "group.admin"
                                ]
                            }
                        }
                    ],
                    "meta": [
                        {
                            "ordinal": 1,
                            "dimension": "0",
                            "workflow_argument_name": "reference"
                        }
                    ]
                }
            },
            {
                "name": "chromosomes",
                "source": [
                    {
                        "name": "chromosomes",
                        "for_file": "/files-reference/GAPFIGJVJDUY/"
                    }
                ],
                "meta": {
                    "global": true,
                    "type": "reference file"
                },
                "run_data": {
                    "type": "input",
                    "file": [
                        {
                            "display_title": "GAPFIGJVJDUY.txt",
                            "uuid": "a1d504ee-a313-4064-b6ae-65fed9738980",
                            "status": "uploaded",
                            "file_size": 138,
                            "href": "/files-reference/GAPFIGJVJDUY/@@download/GAPFIGJVJDUY.txt",
                            "@id": "/files-reference/GAPFIGJVJDUY/",
                            "accession": "GAPFIGJVJDUY",
                            "@type": [
                                "FileReference",
                                "File",
                                "Item"
                            ],
                            "file_format": {
                                "@type": [
                                    "FileFormat",
                                    "Item"
                                ],
                                "status": "shared",
                                "@id": "/file-formats/txt/",
                                "uuid": "0cd4e777-a596-4927-95c8-b07716121aa3",
                                "display_title": "txt",
                                "principals_allowed": {
                                    "view": [
                                        "system.Authenticated"
                                    ],
                                    "edit": [
                                        "group.admin"
                                    ]
                                }
                            },
                            "principals_allowed": {
                                "view": [
                                    "editor_for.12a92962-8265-4fc0-b2f8-cf14f05db58b",
                                    "group.admin",
                                    "group.read-only-admin",
                                    "remoteuser.EMBED",
                                    "remoteuser.INDEXER"
                                ],
                                "edit": [
                                    "editor_for.12a92962-8265-4fc0-b2f8-cf14f05db58b",
                                    "group.admin"
                                ]
                            }
                        }
                    ],
                    "meta": [
                        {
                            "ordinal": 1,
                            "dimension": "0",
                            "workflow_argument_name": "chromosomes"
                        }
                    ]
                }
            }
        ],
        "outputs": [
            {
                "name": "combined_gvcf",
                "target": [
                    {
                        "name": "combined_gvcf",
                        "for_file": "/files-processed/GAPFI4589EXS/"
                    }
                ],
                "meta": {
                    "type": "data file"
                },
                "run_data": {
                    "type": "output",
                    "file": [
                        {
                            "display_title": "GAPFI4589EXS.gvcf.gz",
                            "status": "uploaded",
                            "@id": "/files-processed/GAPFI4589EXS/",
                            "uuid": "2021801b-9f49-4fc9-9e86-9b8046edd5e9",
                            "@type": [
                                "FileProcessed",
                                "File",
                                "Item"
                            ],
                            "principals_allowed": {
                                "view": [
                                    "editor_for.12a92962-8265-4fc0-b2f8-cf14f05db58b",
                                    "group.admin",
                                    "group.read-only-admin",
                                    "remoteuser.EMBED",
                                    "remoteuser.INDEXER"
                                ],
                                "edit": [
                                    "editor_for.12a92962-8265-4fc0-b2f8-cf14f05db58b",
                                    "group.admin"
                                ]
                            }
                        }
                    ],
                    "meta": [
                        {
                            "type": "Output processed file"
                        }
                    ]
                }
            }
        ]
    },
    {
        "name": "/workflow-runs-awsem/3e3530ef-c67d-4708-be5f-84349f49b182/",
        "meta": {
            "@id": "/workflow-runs-awsem/3e3530ef-c67d-4708-be5f-84349f49b182/",
            "workflow": {
                "uuid": "bf34d8b4-1b76-4f76-869b-7310537d0998",
                "status": "in review",
                "display_title": "Run gatk GenotypeGVCFs plus output integrity-check - GAPWF2H256PZ",
                "@type": [
                    "Workflow",
                    "Item"
                ],
                "@id": "/workflows/bf34d8b4-1b76-4f76-869b-7310537d0998/",
                "principals_allowed": {
                    "view": [
                        "editor_for.12a92962-8265-4fc0-b2f8-cf14f05db58b",
                        "group.admin",
                        "group.read-only-admin",
                        "remoteuser.EMBED",
                        "remoteuser.INDEXER"
                    ],
                    "edit": [
                        "editor_for.12a92962-8265-4fc0-b2f8-cf14f05db58b",
                        "group.admin"
                    ]
                }
            },
            "analysis_types": "dummy analysis type"
        },
        "inputs": [
            {
                "name": "input_gvcf",
                "source": [
                    {
                        "name": "combined_gvcf",
                        "step": "workflow_gatk-CombineGVCFs",
                        "for_file": "/files-processed/GAPFI4589EXS/"
                    }
                ],
                "meta": {
                    "global": false,
                    "type": "data file"
                },
                "run_data": {
                    "type": "input",
                    "file": [
                        {
                            "uuid": "2021801b-9f49-4fc9-9e86-9b8046edd5e9",
                            "href": "/files-processed/GAPFI4589EXS/@@download/GAPFI4589EXS.gvcf.gz",
                            "@id": "/files-processed/GAPFI4589EXS/",
                            "accession": "GAPFI4589EXS",
                            "display_title": "GAPFI4589EXS.gvcf.gz",
                            "file_size": 6071718531,
                            "@type": [
                                "FileProcessed",
                                "File",
                                "Item"
                            ],
                            "status": "uploaded",
                            "file_format": {
                                "uuid": "ad47d469-4561-4234-bce2-820f08f58e7c",
                                "status": "shared",
                                "@id": "/file-formats/gvcf_gz/",
                                "display_title": "gvcf_gz",
                                "@type": [
                                    "FileFormat",
                                    "Item"
                                ],
                                "principals_allowed": {
                                    "view": [
                                        "system.Authenticated"
                                    ],
                                    "edit": [
                                        "group.admin"
                                    ]
                                }
                            },
                            "principals_allowed": {
                                "view": [
                                    "editor_for.12a92962-8265-4fc0-b2f8-cf14f05db58b",
                                    "group.admin",
                                    "group.read-only-admin",
                                    "remoteuser.EMBED",
                                    "remoteuser.INDEXER"
                                ],
                                "edit": [
                                    "editor_for.12a92962-8265-4fc0-b2f8-cf14f05db58b",
                                    "group.admin"
                                ]
                            }
                        }
                    ],
                    "meta": [
                        {
                            "ordinal": 1,
                            "dimension": "0",
                            "workflow_argument_name": "input_gvcf"
                        }
                    ]
                }
            },
            {
                "name": "reference",
                "source": [
                    {
                        "name": "reference_fa",
                        "for_file": "/files-reference/GAPFIXRDPDK5/"
                    }
                ],
                "meta": {
                    "global": true,
                    "type": "reference file"
                },
                "run_data": {
                    "type": "input",
                    "file": [
                        {
                            "uuid": "1936f246-22e1-45dc-bb5c-9cfd55537fe7",
                            "href": "/files-reference/GAPFIXRDPDK5/@@download/GAPFIXRDPDK5.fa",
                            "@id": "/files-reference/GAPFIXRDPDK5/",
                            "accession": "GAPFIXRDPDK5",
                            "display_title": "GAPFIXRDPDK5.fa",
                            "file_size": 3263683042,
                            "@type": [
                                "FileReference",
                                "File",
                                "Item"
                            ],
                            "status": "uploaded",
                            "file_format": {
                                "uuid": "5ced774b-a73e-4d1b-8186-d7fbbde7a3c2",
                                "status": "shared",
                                "@id": "/file-formats/fa/",
                                "display_title": "fa",
                                "@type": [
                                    "FileFormat",
                                    "Item"
                                ],
                                "principals_allowed": {
                                    "view": [
                                        "system.Authenticated"
                                    ],
                                    "edit": [
                                        "group.admin"
                                    ]
                                }
                            },
                            "principals_allowed": {
                                "view": [
                                    "editor_for.12a92962-8265-4fc0-b2f8-cf14f05db58b",
                                    "group.admin",
                                    "group.read-only-admin",
                                    "remoteuser.EMBED",
                                    "remoteuser.INDEXER"
                                ],
                                "edit": [
                                    "editor_for.12a92962-8265-4fc0-b2f8-cf14f05db58b",
                                    "group.admin"
                                ]
                            }
                        }
                    ],
                    "meta": [
                        {
                            "ordinal": 1,
                            "dimension": "0",
                            "workflow_argument_name": "reference"
                        }
                    ]
                }
            },
            {
                "name": "chromosomes",
                "source": [
                    {
                        "name": "chromosomes",
                        "for_file": "/files-reference/GAPFIGJVJDUY/"
                    }
                ],
                "meta": {
                    "global": true,
                    "type": "reference file"
                },
                "run_data": {
                    "type": "input",
                    "file": [
                        {
                            "uuid": "a1d504ee-a313-4064-b6ae-65fed9738980",
                            "href": "/files-reference/GAPFIGJVJDUY/@@download/GAPFIGJVJDUY.txt",
                            "@id": "/files-reference/GAPFIGJVJDUY/",
                            "accession": "GAPFIGJVJDUY",
                            "display_title": "GAPFIGJVJDUY.txt",
                            "file_size": 138,
                            "@type": [
                                "FileReference",
                                "File",
                                "Item"
                            ],
                            "status": "uploaded",
                            "file_format": {
                                "uuid": "0cd4e777-a596-4927-95c8-b07716121aa3",
                                "status": "shared",
                                "@id": "/file-formats/txt/",
                                "display_title": "txt",
                                "@type": [
                                    "FileFormat",
                                    "Item"
                                ],
                                "principals_allowed": {
                                    "view": [
                                        "system.Authenticated"
                                    ],
                                    "edit": [
                                        "group.admin"
                                    ]
                                }
                            },
                            "principals_allowed": {
                                "view": [
                                    "editor_for.12a92962-8265-4fc0-b2f8-cf14f05db58b",
                                    "group.admin",
                                    "group.read-only-admin",
                                    "remoteuser.EMBED",
                                    "remoteuser.INDEXER"
                                ],
                                "edit": [
                                    "editor_for.12a92962-8265-4fc0-b2f8-cf14f05db58b",
                                    "group.admin"
                                ]
                            }
                        }
                    ],
                    "meta": [
                        {
                            "ordinal": 1,
                            "dimension": "0",
                            "workflow_argument_name": "chromosomes"
                        }
                    ]
                }
            },
            {
                "name": "known-sites-snp",
                "source": [
                    {
                        "name": "known-sites-snp",
                        "for_file": "/files-reference/GAPFI4LJRN98/"
                    }
                ],
                "meta": {
                    "global": true,
                    "type": "reference file"
                },
                "run_data": {
                    "type": "input",
                    "file": [
                        {
                            "uuid": "8ed35691-0af4-467a-adbc-81eb088549f0",
                            "href": "/files-reference/GAPFI4LJRN98/@@download/GAPFI4LJRN98.vcf.gz",
                            "@id": "/files-reference/GAPFI4LJRN98/",
                            "accession": "GAPFI4LJRN98",
                            "display_title": "GAPFI4LJRN98.vcf.gz",
                            "file_size": 1595848625,
                            "@type": [
                                "FileReference",
                                "File",
                                "Item"
                            ],
                            "status": "uploaded",
                            "file_format": {
                                "uuid": "1b8f525f-aecb-4211-9ae5-a2c998b05599",
                                "status": "shared",
                                "@id": "/file-formats/vcf_gz/",
                                "display_title": "vcf_gz",
                                "@type": [
                                    "FileFormat",
                                    "Item"
                                ],
                                "principals_allowed": {
                                    "view": [
                                        "system.Authenticated"
                                    ],
                                    "edit": [
                                        "group.admin"
                                    ]
                                }
                            },
                            "principals_allowed": {
                                "view": [
                                    "editor_for.12a92962-8265-4fc0-b2f8-cf14f05db58b",
                                    "group.admin",
                                    "group.read-only-admin",
                                    "remoteuser.EMBED",
                                    "remoteuser.INDEXER"
                                ],
                                "edit": [
                                    "editor_for.12a92962-8265-4fc0-b2f8-cf14f05db58b",
                                    "group.admin"
                                ]
                            }
                        }
                    ],
                    "meta": [
                        {
                            "ordinal": 1,
                            "dimension": "0",
                            "workflow_argument_name": "known-sites-snp"
                        }
                    ]
                }
            }
        ],
        "outputs": [
            {
                "name": "vcf",
                "target": [
                    {
                        "name": "vcf",
                        "for_file": "/files-processed/GAPFI6J5MLR9/"
                    }
                ],
                "meta": {
                    "type": "data file"
                },
                "run_data": {
                    "type": "output",
                    "file": [
                        {
                            "display_title": "GAPFI6J5MLR9.vcf.gz",
                            "status": "uploaded",
                            "@id": "/files-processed/GAPFI6J5MLR9/",
                            "uuid": "a6c9f1f0-e52a-4c3b-bc91-047462bf4d88",
                            "@type": [
                                "FileProcessed",
                                "File",
                                "Item"
                            ],
                            "principals_allowed": {
                                "view": [
                                    "editor_for.12a92962-8265-4fc0-b2f8-cf14f05db58b",
                                    "group.admin",
                                    "group.read-only-admin",
                                    "remoteuser.EMBED",
                                    "remoteuser.INDEXER"
                                ],
                                "edit": [
                                    "editor_for.12a92962-8265-4fc0-b2f8-cf14f05db58b",
                                    "group.admin"
                                ]
                            }
                        }
                    ],
                    "meta": [
                        {
                            "type": "Output processed file"
                        }
                    ]
                }
            }
        ]
    },
    {
        "name": "/workflow-runs-awsem/6aea60a0-18c8-4e4d-9a1c-fd993346baf2/",
        "meta": {
            "@id": "/workflow-runs-awsem/6aea60a0-18c8-4e4d-9a1c-fd993346baf2/",
            "workflow": {
                "uuid": "068446c4-87f9-48a1-8f46-cf05084392a9",
                "status": "in review",
                "display_title": "Add samplegeno - GAPGLK9R65ML",
                "@type": [
                    "Workflow",
                    "Item"
                ],
                "@id": "/workflows/068446c4-87f9-48a1-8f46-cf05084392a9/",
                "principals_allowed": {
                    "view": [
                        "editor_for.12a92962-8265-4fc0-b2f8-cf14f05db58b",
                        "group.admin",
                        "group.read-only-admin",
                        "remoteuser.EMBED",
                        "remoteuser.INDEXER"
                    ],
                    "edit": [
                        "editor_for.12a92962-8265-4fc0-b2f8-cf14f05db58b",
                        "group.admin"
                    ]
                }
            },
            "analysis_types": "dummy analysis type"
        },
        "inputs": [
            {
                "name": "input_vcf",
                "source": [
                    {
                        "name": "vcf",
                        "step": "workflow_gatk-GenotypeGVCFs-check",
                        "for_file": "/files-processed/GAPFI6J5MLR9/"
                    }
                ],
                "meta": {
                    "global": false,
                    "type": "data file"
                },
                "run_data": {
                    "type": "input",
                    "file": [
                        {
                            "accession": "GAPFI6J5MLR9",
                            "@id": "/files-processed/GAPFI6J5MLR9/",
                            "file_size": 449938897,
                            "@type": [
                                "FileProcessed",
                                "File",
                                "Item"
                            ],
                            "display_title": "GAPFI6J5MLR9.vcf.gz",
                            "file_format": {
                                "@id": "/file-formats/vcf_gz/",
                                "status": "shared",
                                "display_title": "vcf_gz",
                                "uuid": "1b8f525f-aecb-4211-9ae5-a2c998b05599",
                                "@type": [
                                    "FileFormat",
                                    "Item"
                                ],
                                "principals_allowed": {
                                    "view": [
                                        "system.Authenticated"
                                    ],
                                    "edit": [
                                        "group.admin"
                                    ]
                                }
                            },
                            "status": "uploaded",
                            "href": "/files-processed/GAPFI6J5MLR9/@@download/GAPFI6J5MLR9.vcf.gz",
                            "uuid": "a6c9f1f0-e52a-4c3b-bc91-047462bf4d88",
                            "principals_allowed": {
                                "view": [
                                    "editor_for.12a92962-8265-4fc0-b2f8-cf14f05db58b",
                                    "group.admin",
                                    "group.read-only-admin",
                                    "remoteuser.EMBED",
                                    "remoteuser.INDEXER"
                                ],
                                "edit": [
                                    "editor_for.12a92962-8265-4fc0-b2f8-cf14f05db58b",
                                    "group.admin"
                                ]
                            },
                            "quality_metric": {
                                "display_title": "QualityMetricQclist from 2022-04-29",
                                "status": "shared",
                                "@id": "/quality-metrics-qclist/ede965e7-0c0f-4f7b-b7f8-2d47c2dbe36b/",
                                "overall_quality_status": "PASS",
                                "@type": [
                                    "QualityMetricQclist",
                                    "QualityMetric",
                                    "Item"
                                ],
                                "uuid": "ede965e7-0c0f-4f7b-b7f8-2d47c2dbe36b",
                                "principals_allowed": {
                                    "view": [
                                        "system.Authenticated"
                                    ],
                                    "edit": [
                                        "group.admin"
                                    ]
                                }
                            }
                        }
                    ],
                    "meta": [
                        {
                            "ordinal": 1,
                            "dimension": "0",
                            "workflow_argument_name": "input_vcf"
                        }
                    ]
                }
            }
        ],
        "outputs": [
            {
                "name": "samplegeno_vcf",
                "target": [
                    {
                        "name": "samplegeno_vcf",
                        "for_file": "/files-processed/GAPFI68EKBY2/"
                    }
                ],
                "meta": {
                    "type": "data file"
                },
                "run_data": {
                    "type": "output",
                    "file": [
                        {
                            "display_title": "GAPFI68EKBY2.vcf.gz",
                            "status": "uploaded",
                            "@id": "/files-processed/GAPFI68EKBY2/",
                            "uuid": "56c0a779-c771-4a67-acce-f7bbc2707d6e",
                            "@type": [
                                "FileProcessed",
                                "File",
                                "Item"
                            ],
                            "principals_allowed": {
                                "view": [
                                    "editor_for.12a92962-8265-4fc0-b2f8-cf14f05db58b",
                                    "group.admin",
                                    "group.read-only-admin",
                                    "remoteuser.EMBED",
                                    "remoteuser.INDEXER"
                                ],
                                "edit": [
                                    "editor_for.12a92962-8265-4fc0-b2f8-cf14f05db58b",
                                    "group.admin"
                                ]
                            }
                        }
                    ],
                    "meta": [
                        {
                            "type": "Output processed file"
                        }
                    ]
                }
            }
        ]
    },
    {
        "name": "/workflow-runs-awsem/bf1f8c90-5f99-435f-85c9-52ac471de600/",
        "meta": {
            "@id": "/workflow-runs-awsem/bf1f8c90-5f99-435f-85c9-52ac471de600/",
            "workflow": {
                "uuid": "78ba0550-0c09-47e1-8559-a45be0058056",
                "status": "in review",
                "display_title": "Run granite qcVCF - GAPXFAL93FS1",
                "@type": [
                    "Workflow",
                    "Item"
                ],
                "@id": "/workflows/78ba0550-0c09-47e1-8559-a45be0058056/",
                "principals_allowed": {
                    "view": [
                        "editor_for.12a92962-8265-4fc0-b2f8-cf14f05db58b",
                        "group.admin",
                        "group.read-only-admin",
                        "remoteuser.EMBED",
                        "remoteuser.INDEXER"
                    ],
                    "edit": [
                        "editor_for.12a92962-8265-4fc0-b2f8-cf14f05db58b",
                        "group.admin"
                    ]
                }
            },
            "analysis_types": "dummy analysis type"
        },
        "inputs": [
            {
                "name": "input_vcf",
                "source": [
                    {
                        "name": "vcf",
                        "step": "workflow_gatk-GenotypeGVCFs-check",
                        "for_file": "/files-processed/GAPFI6J5MLR9/"
                    }
                ],
                "meta": {
                    "global": false,
                    "type": "data file"
                },
                "run_data": {
                    "type": "input",
                    "file": [
                        {
                            "accession": "GAPFI6J5MLR9",
                            "display_title": "GAPFI6J5MLR9.vcf.gz",
                            "href": "/files-processed/GAPFI6J5MLR9/@@download/GAPFI6J5MLR9.vcf.gz",
                            "file_size": 449938897,
                            "uuid": "a6c9f1f0-e52a-4c3b-bc91-047462bf4d88",
                            "@id": "/files-processed/GAPFI6J5MLR9/",
                            "@type": [
                                "FileProcessed",
                                "File",
                                "Item"
                            ],
                            "file_format": {
                                "@id": "/file-formats/vcf_gz/",
                                "uuid": "1b8f525f-aecb-4211-9ae5-a2c998b05599",
                                "status": "shared",
                                "@type": [
                                    "FileFormat",
                                    "Item"
                                ],
                                "display_title": "vcf_gz",
                                "principals_allowed": {
                                    "view": [
                                        "system.Authenticated"
                                    ],
                                    "edit": [
                                        "group.admin"
                                    ]
                                }
                            },
                            "status": "uploaded",
                            "quality_metric": {
                                "status": "shared",
                                "@id": "/quality-metrics-qclist/ede965e7-0c0f-4f7b-b7f8-2d47c2dbe36b/",
                                "overall_quality_status": "PASS",
                                "uuid": "ede965e7-0c0f-4f7b-b7f8-2d47c2dbe36b",
                                "@type": [
                                    "QualityMetricQclist",
                                    "QualityMetric",
                                    "Item"
                                ],
                                "display_title": "QualityMetricQclist from 2022-04-29",
                                "principals_allowed": {
                                    "view": [
                                        "system.Authenticated"
                                    ],
                                    "edit": [
                                        "group.admin"
                                    ]
                                }
                            },
                            "principals_allowed": {
                                "view": [
                                    "editor_for.12a92962-8265-4fc0-b2f8-cf14f05db58b",
                                    "group.admin",
                                    "group.read-only-admin",
                                    "remoteuser.EMBED",
                                    "remoteuser.INDEXER"
                                ],
                                "edit": [
                                    "editor_for.12a92962-8265-4fc0-b2f8-cf14f05db58b",
                                    "group.admin"
                                ]
                            }
                        }
                    ],
                    "meta": [
                        {
                            "ordinal": 1,
                            "dimension": "0",
                            "workflow_argument_name": "input_vcf"
                        }
                    ]
                }
            },
            {
                "name": "pedigree",
                "source": [
                    {
                        "name": "pedigree"
                    }
                ],
                "meta": {
                    "global": true,
                    "type": "parameter"
                },
                "run_data": {
                    "type": "input",
                    "value": [
                        "[{\"parents\": [\"GAPIDUZDOX4R\", \"GAPIDQV37Z5Y\"], \"individual\": \"GAPID43VJKQ6\", \"sample_name\": \"NA12879_sample-WGS\", \"gender\": \"F\"}, {\"parents\": [], \"individual\": \"GAPIDUZDOX4R\", \"sample_name\": \"NA12878_sample-WGS\", \"gender\": \"F\"}, {\"parents\": [], \"individual\": \"GAPIDQV37Z5Y\", \"sample_name\": \"NA12877_sample-WGS\", \"gender\": \"M\"}]"
                    ],
                    "meta": [
                        {
                            "ordinal": 1
                        }
                    ]
                }
            },
            {
                "name": "samples",
                "source": [
                    {
                        "name": "sample_names"
                    }
                ],
                "meta": {
                    "global": true,
                    "type": "parameter"
                },
                "run_data": {
                    "type": "input",
                    "value": [
                        "[\"NA12879_sample-WGS\", \"NA12878_sample-WGS\", \"NA12877_sample-WGS\"]"
                    ],
                    "meta": [
                        {
                            "ordinal": 1
                        }
                    ]
                }
            },
            {
                "name": "trio_errors",
                "source": [
                    {
                        "name": "trio_errors"
                    }
                ],
                "meta": {
                    "global": true,
                    "type": "parameter"
                },
                "run_data": {
                    "type": "input",
                    "value": [
                        "true"
                    ],
                    "meta": [
                        {
                            "ordinal": 1
                        }
                    ]
                }
            },
            {
                "name": "het_hom",
                "source": [
                    {
                        "name": "het_hom"
                    }
                ],
                "meta": {
                    "global": true,
                    "type": "parameter"
                },
                "run_data": {
                    "type": "input",
                    "value": [
                        "false"
                    ],
                    "meta": [
                        {
                            "ordinal": 1
                        }
                    ]
                }
            },
            {
                "name": "ti_tv",
                "source": [
                    {
                        "name": "ti_tv"
                    }
                ],
                "meta": {
                    "global": true,
                    "type": "parameter"
                },
                "run_data": {
                    "type": "input",
                    "value": [
                        "false"
                    ],
                    "meta": [
                        {
                            "ordinal": 1
                        }
                    ]
                }
            }
        ],
        "outputs": []
    },
    {
        "name": "/workflow-runs-awsem/856f03f2-c89b-4291-94a0-6aa036673de0/",
        "meta": {
            "@id": "/workflow-runs-awsem/856f03f2-c89b-4291-94a0-6aa036673de0/",
            "workflow": {
                "uuid": "78ba0550-0c09-47e1-8559-a45be0058056",
                "status": "in review",
                "display_title": "Run granite qcVCF - GAPXFAL93FS1",
                "@type": [
                    "Workflow",
                    "Item"
                ],
                "@id": "/workflows/78ba0550-0c09-47e1-8559-a45be0058056/",
                "principals_allowed": {
                    "view": [
                        "editor_for.12a92962-8265-4fc0-b2f8-cf14f05db58b",
                        "group.admin",
                        "group.read-only-admin",
                        "remoteuser.EMBED",
                        "remoteuser.INDEXER"
                    ],
                    "edit": [
                        "editor_for.12a92962-8265-4fc0-b2f8-cf14f05db58b",
                        "group.admin"
                    ]
                }
            },
            "analysis_types": "dummy analysis type"
        },
        "inputs": [
            {
                "name": "input_vcf",
                "source": [
                    {
                        "name": "samplegeno_vcf",
                        "step": "workflow_samplegeno",
                        "for_file": "/files-processed/GAPFI68EKBY2/"
                    }
                ],
                "meta": {
                    "global": false,
                    "type": "data file"
                },
                "run_data": {
                    "type": "input",
                    "file": [
                        {
                            "uuid": "56c0a779-c771-4a67-acce-f7bbc2707d6e",
                            "href": "/files-processed/GAPFI68EKBY2/@@download/GAPFI68EKBY2.vcf.gz",
                            "@id": "/files-processed/GAPFI68EKBY2/",
                            "accession": "GAPFI68EKBY2",
                            "display_title": "GAPFI68EKBY2.vcf.gz",
                            "file_size": 565028521,
                            "@type": [
                                "FileProcessed",
                                "File",
                                "Item"
                            ],
                            "status": "uploaded",
                            "file_format": {
                                "uuid": "1b8f525f-aecb-4211-9ae5-a2c998b05599",
                                "status": "shared",
                                "@id": "/file-formats/vcf_gz/",
                                "display_title": "vcf_gz",
                                "@type": [
                                    "FileFormat",
                                    "Item"
                                ],
                                "principals_allowed": {
                                    "view": [
                                        "system.Authenticated"
                                    ],
                                    "edit": [
                                        "group.admin"
                                    ]
                                }
                            },
                            "quality_metric": {
                                "display_title": "QualityMetricVcfqc from 2022-04-29",
                                "@type": [
                                    "QualityMetricVcfqc",
                                    "QualityMetric",
                                    "Item"
                                ],
                                "uuid": "367b0795-c6f2-4ce3-85e2-b63f4d1b1b4a",
                                "@id": "/quality-metrics-vcfqc/367b0795-c6f2-4ce3-85e2-b63f4d1b1b4a/",
                                "status": "shared",
                                "overall_quality_status": "PASS",
                                "principals_allowed": {
                                    "view": [
                                        "system.Authenticated"
                                    ],
                                    "edit": [
                                        "group.admin"
                                    ]
                                }
                            },
                            "principals_allowed": {
                                "view": [
                                    "editor_for.12a92962-8265-4fc0-b2f8-cf14f05db58b",
                                    "group.admin",
                                    "group.read-only-admin",
                                    "remoteuser.EMBED",
                                    "remoteuser.INDEXER"
                                ],
                                "edit": [
                                    "editor_for.12a92962-8265-4fc0-b2f8-cf14f05db58b",
                                    "group.admin"
                                ]
                            }
                        }
                    ],
                    "meta": [
                        {
                            "ordinal": 1,
                            "dimension": "0",
                            "workflow_argument_name": "input_vcf"
                        }
                    ]
                }
            },
            {
                "name": "pedigree",
                "source": [
                    {
                        "name": "pedigree"
                    }
                ],
                "meta": {
                    "global": true,
                    "type": "parameter"
                },
                "run_data": {
                    "type": "input",
                    "value": [
                        "[{\"parents\": [\"GAPIDUZDOX4R\", \"GAPIDQV37Z5Y\"], \"individual\": \"GAPID43VJKQ6\", \"sample_name\": \"NA12879_sample-WGS\", \"gender\": \"F\"}, {\"parents\": [], \"individual\": \"GAPIDUZDOX4R\", \"sample_name\": \"NA12878_sample-WGS\", \"gender\": \"F\"}, {\"parents\": [], \"individual\": \"GAPIDQV37Z5Y\", \"sample_name\": \"NA12877_sample-WGS\", \"gender\": \"M\"}]"
                    ],
                    "meta": [
                        {
                            "ordinal": 1
                        }
                    ]
                }
            },
            {
                "name": "samples",
                "source": [
                    {
                        "name": "sample_names"
                    }
                ],
                "meta": {
                    "global": true,
                    "type": "parameter"
                },
                "run_data": {
                    "type": "input",
                    "value": [
                        "[\"NA12879_sample-WGS\", \"NA12878_sample-WGS\", \"NA12877_sample-WGS\"]"
                    ],
                    "meta": [
                        {
                            "ordinal": 1
                        }
                    ]
                }
            },
            {
                "name": "trio_errors",
                "source": [
                    {
                        "name": "trio_errors"
                    }
                ],
                "meta": {
                    "global": true,
                    "type": "parameter"
                },
                "run_data": {
                    "type": "input",
                    "value": [
                        "true"
                    ],
                    "meta": [
                        {
                            "ordinal": 1
                        }
                    ]
                }
            },
            {
                "name": "het_hom",
                "source": [
                    {
                        "name": "het_hom"
                    }
                ],
                "meta": {
                    "global": true,
                    "type": "parameter"
                },
                "run_data": {
                    "type": "input",
                    "value": [
                        "false"
                    ],
                    "meta": [
                        {
                            "ordinal": 1
                        }
                    ]
                }
            },
            {
                "name": "ti_tv",
                "source": [
                    {
                        "name": "ti_tv"
                    }
                ],
                "meta": {
                    "global": true,
                    "type": "parameter"
                },
                "run_data": {
                    "type": "input",
                    "value": [
                        "false"
                    ],
                    "meta": [
                        {
                            "ordinal": 1
                        }
                    ]
                }
            }
        ],
        "outputs": []
    },
    {
        "name": "/workflow-runs-awsem/cf4811eb-3f1f-4951-8d84-00a2c7ffe352/",
        "meta": {
            "@id": "/workflow-runs-awsem/cf4811eb-3f1f-4951-8d84-00a2c7ffe352/",
            "workflow": {
                "uuid": "c1c3c327-cd25-49fb-a6f6-aa14ea7af13f",
                "status": "in review",
                "display_title": "Split multiallelic variants, filter by variant depth (DP), and run VEP to annotate input vcf file - GAPWFEE29PXB",
                "@type": [
                    "Workflow",
                    "Item"
                ],
                "@id": "/workflows/c1c3c327-cd25-49fb-a6f6-aa14ea7af13f/",
                "principals_allowed": {
                    "view": [
                        "editor_for.12a92962-8265-4fc0-b2f8-cf14f05db58b",
                        "group.admin",
                        "group.read-only-admin",
                        "remoteuser.EMBED",
                        "remoteuser.INDEXER"
                    ],
                    "edit": [
                        "editor_for.12a92962-8265-4fc0-b2f8-cf14f05db58b",
                        "group.admin"
                    ]
                }
            },
            "analysis_types": "dummy analysis type"
        },
        "inputs": [
            {
                "name": "input_vcf",
                "source": [
                    {
                        "name": "samplegeno_vcf",
                        "step": "workflow_samplegeno",
                        "for_file": "/files-processed/GAPFI68EKBY2/"
                    }
                ],
                "meta": {
                    "global": false,
                    "type": "data file"
                },
                "run_data": {
                    "type": "input",
                    "file": [
                        {
                            "href": "/files-processed/GAPFI68EKBY2/@@download/GAPFI68EKBY2.vcf.gz",
                            "file_format": {
                                "uuid": "1b8f525f-aecb-4211-9ae5-a2c998b05599",
                                "@type": [
                                    "FileFormat",
                                    "Item"
                                ],
                                "@id": "/file-formats/vcf_gz/",
                                "status": "shared",
                                "display_title": "vcf_gz",
                                "principals_allowed": {
                                    "view": [
                                        "system.Authenticated"
                                    ],
                                    "edit": [
                                        "group.admin"
                                    ]
                                }
                            },
                            "status": "uploaded",
                            "display_title": "GAPFI68EKBY2.vcf.gz",
                            "@id": "/files-processed/GAPFI68EKBY2/",
                            "uuid": "56c0a779-c771-4a67-acce-f7bbc2707d6e",
                            "@type": [
                                "FileProcessed",
                                "File",
                                "Item"
                            ],
                            "file_size": 565028521,
                            "accession": "GAPFI68EKBY2",
                            "quality_metric": {
                                "overall_quality_status": "PASS",
                                "@type": [
                                    "QualityMetricVcfqc",
                                    "QualityMetric",
                                    "Item"
                                ],
                                "status": "shared",
                                "display_title": "QualityMetricVcfqc from 2022-04-29",
                                "uuid": "367b0795-c6f2-4ce3-85e2-b63f4d1b1b4a",
                                "@id": "/quality-metrics-vcfqc/367b0795-c6f2-4ce3-85e2-b63f4d1b1b4a/",
                                "principals_allowed": {
                                    "view": [
                                        "system.Authenticated"
                                    ],
                                    "edit": [
                                        "group.admin"
                                    ]
                                }
                            },
                            "principals_allowed": {
                                "view": [
                                    "editor_for.12a92962-8265-4fc0-b2f8-cf14f05db58b",
                                    "group.admin",
                                    "group.read-only-admin",
                                    "remoteuser.EMBED",
                                    "remoteuser.INDEXER"
                                ],
                                "edit": [
                                    "editor_for.12a92962-8265-4fc0-b2f8-cf14f05db58b",
                                    "group.admin"
                                ]
                            }
                        }
                    ],
                    "meta": [
                        {
                            "ordinal": 1,
                            "dimension": "0",
                            "workflow_argument_name": "input_vcf"
                        }
                    ]
                }
            },
            {
                "name": "reference",
                "source": [
                    {
                        "name": "reference_fa",
                        "for_file": "/files-reference/GAPFIXRDPDK5/"
                    }
                ],
                "meta": {
                    "global": true,
                    "type": "reference file"
                },
                "run_data": {
                    "type": "input",
                    "file": [
                        {
                            "href": "/files-reference/GAPFIXRDPDK5/@@download/GAPFIXRDPDK5.fa",
                            "file_format": {
                                "uuid": "5ced774b-a73e-4d1b-8186-d7fbbde7a3c2",
                                "@type": [
                                    "FileFormat",
                                    "Item"
                                ],
                                "@id": "/file-formats/fa/",
                                "status": "shared",
                                "display_title": "fa",
                                "principals_allowed": {
                                    "view": [
                                        "system.Authenticated"
                                    ],
                                    "edit": [
                                        "group.admin"
                                    ]
                                }
                            },
                            "status": "uploaded",
                            "display_title": "GAPFIXRDPDK5.fa",
                            "@id": "/files-reference/GAPFIXRDPDK5/",
                            "uuid": "1936f246-22e1-45dc-bb5c-9cfd55537fe7",
                            "@type": [
                                "FileReference",
                                "File",
                                "Item"
                            ],
                            "file_size": 3263683042,
                            "accession": "GAPFIXRDPDK5",
                            "principals_allowed": {
                                "view": [
                                    "editor_for.12a92962-8265-4fc0-b2f8-cf14f05db58b",
                                    "group.admin",
                                    "group.read-only-admin",
                                    "remoteuser.EMBED",
                                    "remoteuser.INDEXER"
                                ],
                                "edit": [
                                    "editor_for.12a92962-8265-4fc0-b2f8-cf14f05db58b",
                                    "group.admin"
                                ]
                            }
                        }
                    ],
                    "meta": [
                        {
                            "ordinal": 1,
                            "dimension": "0",
                            "workflow_argument_name": "reference"
                        }
                    ]
                }
            },
            {
                "name": "regions",
                "source": [
                    {
                        "name": "regions",
                        "for_file": "/files-reference/GAPFIBGEOI72/"
                    }
                ],
                "meta": {
                    "global": true,
                    "type": "reference file"
                },
                "run_data": {
                    "type": "input",
                    "file": [
                        {
                            "href": "/files-reference/GAPFIBGEOI72/@@download/GAPFIBGEOI72.txt",
                            "file_format": {
                                "uuid": "0cd4e777-a596-4927-95c8-b07716121aa3",
                                "@type": [
                                    "FileFormat",
                                    "Item"
                                ],
                                "@id": "/file-formats/txt/",
                                "status": "shared",
                                "display_title": "txt",
                                "principals_allowed": {
                                    "view": [
                                        "system.Authenticated"
                                    ],
                                    "edit": [
                                        "group.admin"
                                    ]
                                }
                            },
                            "status": "uploaded",
                            "display_title": "GAPFIBGEOI72.txt",
                            "@id": "/files-reference/GAPFIBGEOI72/",
                            "uuid": "1c07a3aa-e2a3-498c-b838-15991c4a2f28",
                            "@type": [
                                "FileReference",
                                "File",
                                "Item"
                            ],
                            "file_size": 7603,
                            "accession": "GAPFIBGEOI72",
                            "principals_allowed": {
                                "view": [
                                    "editor_for.12a92962-8265-4fc0-b2f8-cf14f05db58b",
                                    "group.admin",
                                    "group.read-only-admin",
                                    "remoteuser.EMBED",
                                    "remoteuser.INDEXER"
                                ],
                                "edit": [
                                    "editor_for.12a92962-8265-4fc0-b2f8-cf14f05db58b",
                                    "group.admin"
                                ]
                            }
                        }
                    ],
                    "meta": [
                        {
                            "ordinal": 1,
                            "dimension": "0",
                            "workflow_argument_name": "regions"
                        }
                    ]
                }
            },
            {
                "name": "vep",
                "source": [
                    {
                        "name": "vep",
                        "for_file": "/files-reference/GAPFIL8XMTIV/"
                    }
                ],
                "meta": {
                    "global": true,
                    "type": "reference file"
                },
                "run_data": {
                    "type": "input",
                    "file": [
                        {
                            "href": "/files-reference/GAPFIL8XMTIV/@@download/GAPFIL8XMTIV.vep.tar.gz",
                            "file_format": {
                                "uuid": "d05f9688-0ee1-4a86-83f4-656e6e21352a",
                                "@type": [
                                    "FileFormat",
                                    "Item"
                                ],
                                "@id": "/file-formats/vep_tar/",
                                "status": "shared",
                                "display_title": "vep_tar",
                                "principals_allowed": {
                                    "view": [
                                        "system.Authenticated"
                                    ],
                                    "edit": [
                                        "group.admin"
                                    ]
                                }
                            },
                            "status": "uploaded",
                            "display_title": "GAPFIL8XMTIV.vep.tar.gz",
                            "@id": "/files-reference/GAPFIL8XMTIV/",
                            "uuid": "ea103486-b65a-4439-9d0b-1186f8e59388",
                            "@type": [
                                "FileReference",
                                "File",
                                "Item"
                            ],
                            "file_size": 14459657412,
                            "accession": "GAPFIL8XMTIV",
                            "principals_allowed": {
                                "view": [
                                    "editor_for.12a92962-8265-4fc0-b2f8-cf14f05db58b",
                                    "group.admin",
                                    "group.read-only-admin",
                                    "remoteuser.EMBED",
                                    "remoteuser.INDEXER"
                                ],
                                "edit": [
                                    "editor_for.12a92962-8265-4fc0-b2f8-cf14f05db58b",
                                    "group.admin"
                                ]
                            }
                        }
                    ],
                    "meta": [
                        {
                            "ordinal": 1,
                            "dimension": "0",
                            "workflow_argument_name": "vep"
                        }
                    ]
                }
            },
            {
                "name": "clinvar",
                "source": [
                    {
                        "name": "clinvar",
                        "for_file": "/files-reference/GAPFI121RWQE/"
                    }
                ],
                "meta": {
                    "global": true,
                    "type": "reference file"
                },
                "run_data": {
                    "type": "input",
                    "file": [
                        {
                            "href": "/files-reference/GAPFI121RWQE/@@download/GAPFI121RWQE.vcf.gz",
                            "file_format": {
                                "uuid": "1b8f525f-aecb-4211-9ae5-a2c998b05599",
                                "@type": [
                                    "FileFormat",
                                    "Item"
                                ],
                                "@id": "/file-formats/vcf_gz/",
                                "status": "shared",
                                "display_title": "vcf_gz",
                                "principals_allowed": {
                                    "view": [
                                        "system.Authenticated"
                                    ],
                                    "edit": [
                                        "group.admin"
                                    ]
                                }
                            },
                            "status": "uploaded",
                            "display_title": "GAPFI121RWQE.vcf.gz",
                            "@id": "/files-reference/GAPFI121RWQE/",
                            "uuid": "7db786d5-13d2-4622-bdd2-99866036b9b9",
                            "@type": [
                                "FileReference",
                                "File",
                                "Item"
                            ],
                            "file_size": 34029026,
                            "accession": "GAPFI121RWQE",
                            "principals_allowed": {
                                "view": [
                                    "editor_for.12a92962-8265-4fc0-b2f8-cf14f05db58b",
                                    "group.admin",
                                    "group.read-only-admin",
                                    "remoteuser.EMBED",
                                    "remoteuser.INDEXER"
                                ],
                                "edit": [
                                    "editor_for.12a92962-8265-4fc0-b2f8-cf14f05db58b",
                                    "group.admin"
                                ]
                            }
                        }
                    ],
                    "meta": [
                        {
                            "ordinal": 1,
                            "dimension": "0",
                            "workflow_argument_name": "clinvar"
                        }
                    ]
                }
            },
            {
                "name": "dbnsfp",
                "source": [
                    {
                        "name": "dbnsfp",
                        "for_file": "/files-reference/GAPFIKJ66FKY/"
                    }
                ],
                "meta": {
                    "global": true,
                    "type": "reference file"
                },
                "run_data": {
                    "type": "input",
                    "file": [
                        {
                            "href": "/files-reference/GAPFIKJ66FKY/@@download/GAPFIKJ66FKY.dbnsfp.gz",
                            "file_format": {
                                "uuid": "65a2cca2-dae8-4ff2-ac8b-aa1e92f5416b",
                                "@type": [
                                    "FileFormat",
                                    "Item"
                                ],
                                "@id": "/file-formats/dbnsfp_gz/",
                                "status": "shared",
                                "display_title": "dbnsfp_gz",
                                "principals_allowed": {
                                    "view": [
                                        "system.Authenticated"
                                    ],
                                    "edit": [
                                        "group.admin"
                                    ]
                                }
                            },
                            "status": "uploaded",
                            "display_title": "GAPFIKJ66FKY.dbnsfp.gz",
                            "@id": "/files-reference/GAPFIKJ66FKY/",
                            "uuid": "dc02df4c-49ac-4532-b85c-02800941aa44",
                            "@type": [
                                "FileReference",
                                "File",
                                "Item"
                            ],
                            "file_size": 32749109158,
                            "accession": "GAPFIKJ66FKY",
                            "principals_allowed": {
                                "view": [
                                    "editor_for.12a92962-8265-4fc0-b2f8-cf14f05db58b",
                                    "group.admin",
                                    "group.read-only-admin",
                                    "remoteuser.EMBED",
                                    "remoteuser.INDEXER"
                                ],
                                "edit": [
                                    "editor_for.12a92962-8265-4fc0-b2f8-cf14f05db58b",
                                    "group.admin"
                                ]
                            }
                        }
                    ],
                    "meta": [
                        {
                            "ordinal": 1,
                            "dimension": "0",
                            "workflow_argument_name": "dbnsfp"
                        }
                    ]
                }
            },
            {
                "name": "maxent",
                "source": [
                    {
                        "name": "maxent",
                        "for_file": "/files-reference/GAPFI6BNNTKA/"
                    }
                ],
                "meta": {
                    "global": true,
                    "type": "reference file"
                },
                "run_data": {
                    "type": "input",
                    "file": [
                        {
                            "href": "/files-reference/GAPFI6BNNTKA/@@download/GAPFI6BNNTKA.tar.gz",
                            "file_format": {
                                "uuid": "f2ec3b9f-a898-4e6c-8da5-734a7a6410b8",
                                "@type": [
                                    "FileFormat",
                                    "Item"
                                ],
                                "@id": "/file-formats/tar_gz/",
                                "status": "shared",
                                "display_title": "tar_gz",
                                "principals_allowed": {
                                    "view": [
                                        "system.Authenticated"
                                    ],
                                    "edit": [
                                        "group.admin"
                                    ]
                                }
                            },
                            "status": "uploaded",
                            "display_title": "GAPFI6BNNTKA.tar.gz",
                            "@id": "/files-reference/GAPFI6BNNTKA/",
                            "uuid": "71a7d16b-8452-4266-ae80-bbede2e305e2",
                            "@type": [
                                "FileReference",
                                "File",
                                "Item"
                            ],
                            "file_size": 1505157,
                            "accession": "GAPFI6BNNTKA",
                            "principals_allowed": {
                                "view": [
                                    "editor_for.12a92962-8265-4fc0-b2f8-cf14f05db58b",
                                    "group.admin",
                                    "group.read-only-admin",
                                    "remoteuser.EMBED",
                                    "remoteuser.INDEXER"
                                ],
                                "edit": [
                                    "editor_for.12a92962-8265-4fc0-b2f8-cf14f05db58b",
                                    "group.admin"
                                ]
                            }
                        }
                    ],
                    "meta": [
                        {
                            "ordinal": 1,
                            "dimension": "0",
                            "workflow_argument_name": "maxent"
                        }
                    ]
                }
            },
            {
                "name": "spliceai_snv",
                "source": [
                    {
                        "name": "spliceai_snv",
                        "for_file": "/files-reference/GAPFISUOC64Q/"
                    }
                ],
                "meta": {
                    "global": true,
                    "type": "reference file"
                },
                "run_data": {
                    "type": "input",
                    "file": [
                        {
                            "href": "/files-reference/GAPFISUOC64Q/@@download/GAPFISUOC64Q.vcf.gz",
                            "file_format": {
                                "uuid": "1b8f525f-aecb-4211-9ae5-a2c998b05599",
                                "@type": [
                                    "FileFormat",
                                    "Item"
                                ],
                                "@id": "/file-formats/vcf_gz/",
                                "status": "shared",
                                "display_title": "vcf_gz",
                                "principals_allowed": {
                                    "view": [
                                        "system.Authenticated"
                                    ],
                                    "edit": [
                                        "group.admin"
                                    ]
                                }
                            },
                            "status": "uploaded",
                            "display_title": "GAPFISUOC64Q.vcf.gz",
                            "@id": "/files-reference/GAPFISUOC64Q/",
                            "uuid": "a35e580c-7579-4312-a3a1-66810e6d9366",
                            "@type": [
                                "FileReference",
                                "File",
                                "Item"
                            ],
                            "file_size": 28829788377,
                            "accession": "GAPFISUOC64Q",
                            "principals_allowed": {
                                "view": [
                                    "editor_for.12a92962-8265-4fc0-b2f8-cf14f05db58b",
                                    "group.admin",
                                    "group.read-only-admin",
                                    "remoteuser.EMBED",
                                    "remoteuser.INDEXER"
                                ],
                                "edit": [
                                    "editor_for.12a92962-8265-4fc0-b2f8-cf14f05db58b",
                                    "group.admin"
                                ]
                            }
                        }
                    ],
                    "meta": [
                        {
                            "ordinal": 1,
                            "dimension": "0",
                            "workflow_argument_name": "spliceai_snv"
                        }
                    ]
                }
            },
            {
                "name": "spliceai_indel",
                "source": [
                    {
                        "name": "spliceai_indel",
                        "for_file": "/files-reference/GAPFIZOPCWIU/"
                    }
                ],
                "meta": {
                    "global": true,
                    "type": "reference file"
                },
                "run_data": {
                    "type": "input",
                    "file": [
                        {
                            "href": "/files-reference/GAPFIZOPCWIU/@@download/GAPFIZOPCWIU.vcf.gz",
                            "file_format": {
                                "uuid": "1b8f525f-aecb-4211-9ae5-a2c998b05599",
                                "@type": [
                                    "FileFormat",
                                    "Item"
                                ],
                                "@id": "/file-formats/vcf_gz/",
                                "status": "shared",
                                "display_title": "vcf_gz",
                                "principals_allowed": {
                                    "view": [
                                        "system.Authenticated"
                                    ],
                                    "edit": [
                                        "group.admin"
                                    ]
                                }
                            },
                            "status": "uploaded",
                            "display_title": "GAPFIZOPCWIU.vcf.gz",
                            "@id": "/files-reference/GAPFIZOPCWIU/",
                            "uuid": "3b7c0c29-5ee2-47c8-95a8-d28e15d5de47",
                            "@type": [
                                "FileReference",
                                "File",
                                "Item"
                            ],
                            "file_size": 69322106029,
                            "accession": "GAPFIZOPCWIU",
                            "principals_allowed": {
                                "view": [
                                    "editor_for.12a92962-8265-4fc0-b2f8-cf14f05db58b",
                                    "group.admin",
                                    "group.read-only-admin",
                                    "remoteuser.EMBED",
                                    "remoteuser.INDEXER"
                                ],
                                "edit": [
                                    "editor_for.12a92962-8265-4fc0-b2f8-cf14f05db58b",
                                    "group.admin"
                                ]
                            }
                        }
                    ],
                    "meta": [
                        {
                            "ordinal": 1,
                            "dimension": "0",
                            "workflow_argument_name": "spliceai_indel"
                        }
                    ]
                }
            },
            {
                "name": "gnomad",
                "source": [
                    {
                        "name": "gnomad",
                        "for_file": "/files-reference/GAPFIJOMA2Q8/"
                    }
                ],
                "meta": {
                    "global": true,
                    "type": "reference file"
                },
                "run_data": {
                    "type": "input",
                    "file": [
                        {
                            "href": "/files-reference/GAPFIJOMA2Q8/@@download/GAPFIJOMA2Q8.vcf.gz",
                            "file_format": {
                                "uuid": "1b8f525f-aecb-4211-9ae5-a2c998b05599",
                                "@type": [
                                    "FileFormat",
                                    "Item"
                                ],
                                "@id": "/file-formats/vcf_gz/",
                                "status": "shared",
                                "display_title": "vcf_gz",
                                "principals_allowed": {
                                    "view": [
                                        "system.Authenticated"
                                    ],
                                    "edit": [
                                        "group.admin"
                                    ]
                                }
                            },
                            "status": "uploaded",
                            "display_title": "GAPFIJOMA2Q8.vcf.gz",
                            "@id": "/files-reference/GAPFIJOMA2Q8/",
                            "uuid": "52c6cbf6-ae94-4c10-ad03-26ed34f74a3e",
                            "@type": [
                                "FileReference",
                                "File",
                                "Item"
                            ],
                            "file_size": 56752948861,
                            "accession": "GAPFIJOMA2Q8",
                            "principals_allowed": {
                                "view": [
                                    "editor_for.12a92962-8265-4fc0-b2f8-cf14f05db58b",
                                    "group.admin",
                                    "group.read-only-admin",
                                    "remoteuser.EMBED",
                                    "remoteuser.INDEXER"
                                ],
                                "edit": [
                                    "editor_for.12a92962-8265-4fc0-b2f8-cf14f05db58b",
                                    "group.admin"
                                ]
                            }
                        }
                    ],
                    "meta": [
                        {
                            "ordinal": 1,
                            "dimension": "0",
                            "workflow_argument_name": "gnomad"
                        }
                    ]
                }
            },
            {
                "name": "gnomad2",
                "source": [
                    {
                        "name": "gnomad2",
                        "for_file": "/files-reference/GAPFIC5416E6/"
                    }
                ],
                "meta": {
                    "global": true,
                    "type": "reference file"
                },
                "run_data": {
                    "type": "input",
                    "file": [
                        {
                            "href": "/files-reference/GAPFIC5416E6/@@download/GAPFIC5416E6.vcf.gz",
                            "file_format": {
                                "uuid": "1b8f525f-aecb-4211-9ae5-a2c998b05599",
                                "@type": [
                                    "FileFormat",
                                    "Item"
                                ],
                                "@id": "/file-formats/vcf_gz/",
                                "status": "shared",
                                "display_title": "vcf_gz",
                                "principals_allowed": {
                                    "view": [
                                        "system.Authenticated"
                                    ],
                                    "edit": [
                                        "group.admin"
                                    ]
                                }
                            },
                            "status": "uploaded",
                            "display_title": "GAPFIC5416E6.vcf.gz",
                            "@id": "/files-reference/GAPFIC5416E6/",
                            "uuid": "dd6f0384-d0b5-47d6-99a8-395c0b72feed",
                            "@type": [
                                "FileReference",
                                "File",
                                "Item"
                            ],
                            "file_size": 1461686984,
                            "accession": "GAPFIC5416E6",
                            "principals_allowed": {
                                "view": [
                                    "editor_for.12a92962-8265-4fc0-b2f8-cf14f05db58b",
                                    "group.admin",
                                    "group.read-only-admin",
                                    "remoteuser.EMBED",
                                    "remoteuser.INDEXER"
                                ],
                                "edit": [
                                    "editor_for.12a92962-8265-4fc0-b2f8-cf14f05db58b",
                                    "group.admin"
                                ]
                            }
                        }
                    ],
                    "meta": [
                        {
                            "ordinal": 1,
                            "dimension": "0",
                            "workflow_argument_name": "gnomad2"
                        }
                    ]
                }
            },
            {
                "name": "CADD_snv",
                "source": [
                    {
                        "name": "CADD_snv",
                        "for_file": "/files-reference/GAPFI566QQCV/"
                    }
                ],
                "meta": {
                    "global": true,
                    "type": "reference file"
                },
                "run_data": {
                    "type": "input",
                    "file": [
                        {
                            "href": "/files-reference/GAPFI566QQCV/@@download/GAPFI566QQCV.tsv.gz",
                            "file_format": {
                                "uuid": "11ca3783-db6e-430e-997b-9cf0ca275814",
                                "@type": [
                                    "FileFormat",
                                    "Item"
                                ],
                                "@id": "/file-formats/tsv_gz/",
                                "status": "shared",
                                "display_title": "tsv_gz",
                                "principals_allowed": {
                                    "view": [
                                        "system.Authenticated"
                                    ],
                                    "edit": [
                                        "group.admin"
                                    ]
                                }
                            },
                            "status": "uploaded",
                            "display_title": "GAPFI566QQCV.tsv.gz",
                            "@id": "/files-reference/GAPFI566QQCV/",
                            "uuid": "672de47f-d058-4dbd-9fc4-3e134cfe71d8",
                            "@type": [
                                "FileReference",
                                "File",
                                "Item"
                            ],
                            "file_size": 86592987071,
                            "accession": "GAPFI566QQCV",
                            "principals_allowed": {
                                "view": [
                                    "editor_for.12a92962-8265-4fc0-b2f8-cf14f05db58b",
                                    "group.admin",
                                    "group.read-only-admin",
                                    "remoteuser.EMBED",
                                    "remoteuser.INDEXER"
                                ],
                                "edit": [
                                    "editor_for.12a92962-8265-4fc0-b2f8-cf14f05db58b",
                                    "group.admin"
                                ]
                            }
                        }
                    ],
                    "meta": [
                        {
                            "ordinal": 1,
                            "dimension": "0",
                            "workflow_argument_name": "CADD_snv"
                        }
                    ]
                }
            },
            {
                "name": "CADD_indel",
                "source": [
                    {
                        "name": "CADD_indel",
                        "for_file": "/files-reference/GAPFI1GC6AXF/"
                    }
                ],
                "meta": {
                    "global": true,
                    "type": "reference file"
                },
                "run_data": {
                    "type": "input",
                    "file": [
                        {
                            "href": "/files-reference/GAPFI1GC6AXF/@@download/GAPFI1GC6AXF.tsv.gz",
                            "file_format": {
                                "uuid": "11ca3783-db6e-430e-997b-9cf0ca275814",
                                "@type": [
                                    "FileFormat",
                                    "Item"
                                ],
                                "@id": "/file-formats/tsv_gz/",
                                "status": "shared",
                                "display_title": "tsv_gz",
                                "principals_allowed": {
                                    "view": [
                                        "system.Authenticated"
                                    ],
                                    "edit": [
                                        "group.admin"
                                    ]
                                }
                            },
                            "status": "uploaded",
                            "display_title": "GAPFI1GC6AXF.tsv.gz",
                            "@id": "/files-reference/GAPFI1GC6AXF/",
                            "uuid": "b9f123dd-be05-4a14-957a-5e1e5a5ce254",
                            "@type": [
                                "FileReference",
                                "File",
                                "Item"
                            ],
                            "file_size": 1165363333,
                            "accession": "GAPFI1GC6AXF",
                            "principals_allowed": {
                                "view": [
                                    "editor_for.12a92962-8265-4fc0-b2f8-cf14f05db58b",
                                    "group.admin",
                                    "group.read-only-admin",
                                    "remoteuser.EMBED",
                                    "remoteuser.INDEXER"
                                ],
                                "edit": [
                                    "editor_for.12a92962-8265-4fc0-b2f8-cf14f05db58b",
                                    "group.admin"
                                ]
                            }
                        }
                    ],
                    "meta": [
                        {
                            "ordinal": 1,
                            "dimension": "0",
                            "workflow_argument_name": "CADD_indel"
                        }
                    ]
                }
            },
            {
                "name": "phylop100bw",
                "source": [
                    {
                        "name": "phylop100bw",
                        "for_file": "/files-reference/GAPFIMQ7MHGA/"
                    }
                ],
                "meta": {
                    "global": true,
                    "type": "reference file"
                },
                "run_data": {
                    "type": "input",
                    "file": [
                        {
                            "href": "/files-reference/GAPFIMQ7MHGA/@@download/GAPFIMQ7MHGA.bw",
                            "file_format": {
                                "uuid": "33f30c42-d582-4163-af44-fecf586b9dd3",
                                "@type": [
                                    "FileFormat",
                                    "Item"
                                ],
                                "@id": "/file-formats/BigWig/",
                                "status": "shared",
                                "display_title": "BigWig",
                                "principals_allowed": {
                                    "view": [
                                        "system.Authenticated"
                                    ],
                                    "edit": [
                                        "group.admin"
                                    ]
                                }
                            },
                            "status": "uploaded",
                            "display_title": "GAPFIMQ7MHGA.bw",
                            "@id": "/files-reference/GAPFIMQ7MHGA/",
                            "uuid": "af93aecb-6b8e-4c8b-b159-eefb3f9d0ffb",
                            "@type": [
                                "FileReference",
                                "File",
                                "Item"
                            ],
                            "file_size": 9870053206,
                            "accession": "GAPFIMQ7MHGA",
                            "principals_allowed": {
                                "view": [
                                    "editor_for.12a92962-8265-4fc0-b2f8-cf14f05db58b",
                                    "group.admin",
                                    "group.read-only-admin",
                                    "remoteuser.EMBED",
                                    "remoteuser.INDEXER"
                                ],
                                "edit": [
                                    "editor_for.12a92962-8265-4fc0-b2f8-cf14f05db58b",
                                    "group.admin"
                                ]
                            }
                        }
                    ],
                    "meta": [
                        {
                            "ordinal": 1,
                            "dimension": "0",
                            "workflow_argument_name": "phylop100bw"
                        }
                    ]
                }
            },
            {
                "name": "phylop30bw",
                "source": [
                    {
                        "name": "phylop30bw",
                        "for_file": "/files-reference/GAPFI5MRTDLN/"
                    }
                ],
                "meta": {
                    "global": true,
                    "type": "reference file"
                },
                "run_data": {
                    "type": "input",
                    "file": [
                        {
                            "href": "/files-reference/GAPFI5MRTDLN/@@download/GAPFI5MRTDLN.bw",
                            "file_format": {
                                "uuid": "33f30c42-d582-4163-af44-fecf586b9dd3",
                                "@type": [
                                    "FileFormat",
                                    "Item"
                                ],
                                "@id": "/file-formats/BigWig/",
                                "status": "shared",
                                "display_title": "BigWig",
                                "principals_allowed": {
                                    "view": [
                                        "system.Authenticated"
                                    ],
                                    "edit": [
                                        "group.admin"
                                    ]
                                }
                            },
                            "status": "uploaded",
                            "display_title": "GAPFI5MRTDLN.bw",
                            "@id": "/files-reference/GAPFI5MRTDLN/",
                            "uuid": "f6809af1-f7b9-43c0-882a-16764ccc431d",
                            "@type": [
                                "FileReference",
                                "File",
                                "Item"
                            ],
                            "file_size": 8400229101,
                            "accession": "GAPFI5MRTDLN",
                            "principals_allowed": {
                                "view": [
                                    "editor_for.12a92962-8265-4fc0-b2f8-cf14f05db58b",
                                    "group.admin",
                                    "group.read-only-admin",
                                    "remoteuser.EMBED",
                                    "remoteuser.INDEXER"
                                ],
                                "edit": [
                                    "editor_for.12a92962-8265-4fc0-b2f8-cf14f05db58b",
                                    "group.admin"
                                ]
                            }
                        }
                    ],
                    "meta": [
                        {
                            "ordinal": 1,
                            "dimension": "0",
                            "workflow_argument_name": "phylop30bw"
                        }
                    ]
                }
            },
            {
                "name": "phastc100bw",
                "source": [
                    {
                        "name": "phastc100bw",
                        "for_file": "/files-reference/GAPFI6KXAQMV/"
                    }
                ],
                "meta": {
                    "global": true,
                    "type": "reference file"
                },
                "run_data": {
                    "type": "input",
                    "file": [
                        {
                            "href": "/files-reference/GAPFI6KXAQMV/@@download/GAPFI6KXAQMV.bw",
                            "file_format": {
                                "uuid": "33f30c42-d582-4163-af44-fecf586b9dd3",
                                "@type": [
                                    "FileFormat",
                                    "Item"
                                ],
                                "@id": "/file-formats/BigWig/",
                                "status": "shared",
                                "display_title": "BigWig",
                                "principals_allowed": {
                                    "view": [
                                        "system.Authenticated"
                                    ],
                                    "edit": [
                                        "group.admin"
                                    ]
                                }
                            },
                            "status": "uploaded",
                            "display_title": "GAPFI6KXAQMV.bw",
                            "@id": "/files-reference/GAPFI6KXAQMV/",
                            "uuid": "19f03828-175b-4594-ba1a-52ddabcf640d",
                            "@type": [
                                "FileReference",
                                "File",
                                "Item"
                            ],
                            "file_size": 5886377734,
                            "accession": "GAPFI6KXAQMV",
                            "principals_allowed": {
                                "view": [
                                    "editor_for.12a92962-8265-4fc0-b2f8-cf14f05db58b",
                                    "group.admin",
                                    "group.read-only-admin",
                                    "remoteuser.EMBED",
                                    "remoteuser.INDEXER"
                                ],
                                "edit": [
                                    "editor_for.12a92962-8265-4fc0-b2f8-cf14f05db58b",
                                    "group.admin"
                                ]
                            }
                        }
                    ],
                    "meta": [
                        {
                            "ordinal": 1,
                            "dimension": "0",
                            "workflow_argument_name": "phastc100bw"
                        }
                    ]
                }
            },
            {
                "name": "nthreads",
                "source": [
                    {
                        "name": "nthreads"
                    }
                ],
                "meta": {
                    "global": true,
                    "type": "parameter"
                },
                "run_data": {
                    "type": "input",
                    "value": [
                        "72"
                    ],
                    "meta": [
                        {
                            "ordinal": 1
                        }
                    ]
                }
            }
        ],
        "outputs": [
            {
                "name": "annotated_vcf",
                "target": [
                    {
                        "name": "annotated_vcf",
                        "for_file": "/files-processed/GAPFIACVY8U8/"
                    }
                ],
                "meta": {
                    "type": "data file"
                },
                "run_data": {
                    "type": "output",
                    "file": [
                        {
                            "display_title": "GAPFIACVY8U8.vcf.gz",
                            "status": "uploaded",
                            "@id": "/files-processed/GAPFIACVY8U8/",
                            "uuid": "a7809e79-b980-4b7f-9e43-1c2a60959246",
                            "@type": [
                                "FileProcessed",
                                "File",
                                "Item"
                            ],
                            "principals_allowed": {
                                "view": [
                                    "editor_for.12a92962-8265-4fc0-b2f8-cf14f05db58b",
                                    "group.admin",
                                    "group.read-only-admin",
                                    "remoteuser.EMBED",
                                    "remoteuser.INDEXER"
                                ],
                                "edit": [
                                    "editor_for.12a92962-8265-4fc0-b2f8-cf14f05db58b",
                                    "group.admin"
                                ]
                            }
                        }
                    ],
                    "meta": [
                        {
                            "type": "Output processed file"
                        }
                    ]
                }
            }
        ]
    },
    {
        "name": "/workflow-runs-awsem/58210479-cf6c-40db-8a03-fbd2541be2c2/",
        "meta": {
            "@id": "/workflow-runs-awsem/58210479-cf6c-40db-8a03-fbd2541be2c2/",
            "workflow": {
                "uuid": "b90f16cc-7d6a-4306-836e-4e9cb7879fb3",
                "status": "in review",
                "display_title": "Run peddy - GAPXKK231Z91",
                "@type": [
                    "Workflow",
                    "Item"
                ],
                "@id": "/workflows/b90f16cc-7d6a-4306-836e-4e9cb7879fb3/",
                "principals_allowed": {
                    "view": [
                        "editor_for.12a92962-8265-4fc0-b2f8-cf14f05db58b",
                        "group.admin",
                        "group.read-only-admin",
                        "remoteuser.EMBED",
                        "remoteuser.INDEXER"
                    ],
                    "edit": [
                        "editor_for.12a92962-8265-4fc0-b2f8-cf14f05db58b",
                        "group.admin"
                    ]
                }
            },
            "analysis_types": "dummy analysis type"
        },
        "inputs": [
            {
                "name": "input_vcf",
                "source": [
                    {
                        "name": "annotated_vcf",
                        "step": "workflow_vep-annot-check",
                        "for_file": "/files-processed/GAPFIACVY8U8/"
                    }
                ],
                "meta": {
                    "global": false,
                    "type": "data file"
                },
                "run_data": {
                    "type": "input",
                    "file": [
                        {
                            "accession": "GAPFIACVY8U8",
                            "display_title": "GAPFIACVY8U8.vcf.gz",
                            "href": "/files-processed/GAPFIACVY8U8/@@download/GAPFIACVY8U8.vcf.gz",
                            "file_size": 2727278155,
                            "uuid": "a7809e79-b980-4b7f-9e43-1c2a60959246",
                            "@id": "/files-processed/GAPFIACVY8U8/",
                            "@type": [
                                "FileProcessed",
                                "File",
                                "Item"
                            ],
                            "file_format": {
                                "@id": "/file-formats/vcf_gz/",
                                "uuid": "1b8f525f-aecb-4211-9ae5-a2c998b05599",
                                "status": "shared",
                                "@type": [
                                    "FileFormat",
                                    "Item"
                                ],
                                "display_title": "vcf_gz",
                                "principals_allowed": {
                                    "view": [
                                        "system.Authenticated"
                                    ],
                                    "edit": [
                                        "group.admin"
                                    ]
                                }
                            },
                            "status": "uploaded",
                            "quality_metric": {
                                "status": "shared",
                                "@id": "/quality-metrics-qclist/c9df0265-50c5-4706-9327-86d9f18f8130/",
                                "overall_quality_status": "PASS",
                                "uuid": "c9df0265-50c5-4706-9327-86d9f18f8130",
                                "@type": [
                                    "QualityMetricQclist",
                                    "QualityMetric",
                                    "Item"
                                ],
                                "display_title": "QualityMetricQclist from 2022-04-30",
                                "principals_allowed": {
                                    "view": [
                                        "system.Authenticated"
                                    ],
                                    "edit": [
                                        "group.admin"
                                    ]
                                }
                            },
                            "principals_allowed": {
                                "view": [
                                    "editor_for.12a92962-8265-4fc0-b2f8-cf14f05db58b",
                                    "group.admin",
                                    "group.read-only-admin",
                                    "remoteuser.EMBED",
                                    "remoteuser.INDEXER"
                                ],
                                "edit": [
                                    "editor_for.12a92962-8265-4fc0-b2f8-cf14f05db58b",
                                    "group.admin"
                                ]
                            }
                        }
                    ],
                    "meta": [
                        {
                            "ordinal": 1,
                            "dimension": "0",
                            "workflow_argument_name": "input_vcf"
                        }
                    ]
                }
            },
            {
                "name": "pedigree",
                "source": [
                    {
                        "name": "pedigree"
                    }
                ],
                "meta": {
                    "global": true,
                    "type": "parameter"
                },
                "run_data": {
                    "type": "input",
                    "value": [
                        "[{\"parents\": [\"GAPIDUZDOX4R\", \"GAPIDQV37Z5Y\"], \"individual\": \"GAPID43VJKQ6\", \"sample_name\": \"NA12879_sample-WGS\", \"gender\": \"F\"}, {\"parents\": [], \"individual\": \"GAPIDUZDOX4R\", \"sample_name\": \"NA12878_sample-WGS\", \"gender\": \"F\"}, {\"parents\": [], \"individual\": \"GAPIDQV37Z5Y\", \"sample_name\": \"NA12877_sample-WGS\", \"gender\": \"M\"}]"
                    ],
                    "meta": [
                        {
                            "ordinal": 1
                        }
                    ]
                }
            }
        ],
        "outputs": []
    },
    {
        "name": "/workflow-runs-awsem/eba22967-9efc-4071-a3df-fa5b55943db8/",
        "meta": {
            "@id": "/workflow-runs-awsem/eba22967-9efc-4071-a3df-fa5b55943db8/",
            "workflow": {
                "uuid": "78ba0550-0c09-47e1-8559-a45be0058056",
                "status": "in review",
                "display_title": "Run granite qcVCF - GAPXFAL93FS1",
                "@type": [
                    "Workflow",
                    "Item"
                ],
                "@id": "/workflows/78ba0550-0c09-47e1-8559-a45be0058056/",
                "principals_allowed": {
                    "view": [
                        "editor_for.12a92962-8265-4fc0-b2f8-cf14f05db58b",
                        "group.admin",
                        "group.read-only-admin",
                        "remoteuser.EMBED",
                        "remoteuser.INDEXER"
                    ],
                    "edit": [
                        "editor_for.12a92962-8265-4fc0-b2f8-cf14f05db58b",
                        "group.admin"
                    ]
                }
            },
            "analysis_types": "dummy analysis type"
        },
        "inputs": [
            {
                "name": "input_vcf",
                "source": [
                    {
                        "name": "annotated_vcf",
                        "step": "workflow_vep-annot-check",
                        "for_file": "/files-processed/GAPFIACVY8U8/"
                    }
                ],
                "meta": {
                    "global": false,
                    "type": "data file"
                },
                "run_data": {
                    "type": "input",
                    "file": [
                        {
                            "href": "/files-processed/GAPFIACVY8U8/@@download/GAPFIACVY8U8.vcf.gz",
                            "file_format": {
                                "uuid": "1b8f525f-aecb-4211-9ae5-a2c998b05599",
                                "@type": [
                                    "FileFormat",
                                    "Item"
                                ],
                                "@id": "/file-formats/vcf_gz/",
                                "status": "shared",
                                "display_title": "vcf_gz",
                                "principals_allowed": {
                                    "view": [
                                        "system.Authenticated"
                                    ],
                                    "edit": [
                                        "group.admin"
                                    ]
                                }
                            },
                            "status": "uploaded",
                            "display_title": "GAPFIACVY8U8.vcf.gz",
                            "@id": "/files-processed/GAPFIACVY8U8/",
                            "uuid": "a7809e79-b980-4b7f-9e43-1c2a60959246",
                            "@type": [
                                "FileProcessed",
                                "File",
                                "Item"
                            ],
                            "file_size": 2727278155,
                            "accession": "GAPFIACVY8U8",
                            "quality_metric": {
                                "overall_quality_status": "PASS",
                                "@type": [
                                    "QualityMetricQclist",
                                    "QualityMetric",
                                    "Item"
                                ],
                                "status": "shared",
                                "display_title": "QualityMetricQclist from 2022-04-30",
                                "uuid": "c9df0265-50c5-4706-9327-86d9f18f8130",
                                "@id": "/quality-metrics-qclist/c9df0265-50c5-4706-9327-86d9f18f8130/",
                                "principals_allowed": {
                                    "view": [
                                        "system.Authenticated"
                                    ],
                                    "edit": [
                                        "group.admin"
                                    ]
                                }
                            },
                            "principals_allowed": {
                                "view": [
                                    "editor_for.12a92962-8265-4fc0-b2f8-cf14f05db58b",
                                    "group.admin",
                                    "group.read-only-admin",
                                    "remoteuser.EMBED",
                                    "remoteuser.INDEXER"
                                ],
                                "edit": [
                                    "editor_for.12a92962-8265-4fc0-b2f8-cf14f05db58b",
                                    "group.admin"
                                ]
                            }
                        }
                    ],
                    "meta": [
                        {
                            "ordinal": 1,
                            "dimension": "0",
                            "workflow_argument_name": "input_vcf"
                        }
                    ]
                }
            },
            {
                "name": "pedigree",
                "source": [
                    {
                        "name": "pedigree"
                    }
                ],
                "meta": {
                    "global": true,
                    "type": "parameter"
                },
                "run_data": {
                    "type": "input",
                    "value": [
                        "[{\"parents\": [\"GAPIDUZDOX4R\", \"GAPIDQV37Z5Y\"], \"individual\": \"GAPID43VJKQ6\", \"sample_name\": \"NA12879_sample-WGS\", \"gender\": \"F\"}, {\"parents\": [], \"individual\": \"GAPIDUZDOX4R\", \"sample_name\": \"NA12878_sample-WGS\", \"gender\": \"F\"}, {\"parents\": [], \"individual\": \"GAPIDQV37Z5Y\", \"sample_name\": \"NA12877_sample-WGS\", \"gender\": \"M\"}]"
                    ],
                    "meta": [
                        {
                            "ordinal": 1
                        }
                    ]
                }
            },
            {
                "name": "samples",
                "source": [
                    {
                        "name": "sample_names"
                    }
                ],
                "meta": {
                    "global": true,
                    "type": "parameter"
                },
                "run_data": {
                    "type": "input",
                    "value": [
                        "[\"NA12879_sample-WGS\", \"NA12878_sample-WGS\", \"NA12877_sample-WGS\"]"
                    ],
                    "meta": [
                        {
                            "ordinal": 1
                        }
                    ]
                }
            },
            {
                "name": "trio_errors",
                "source": [
                    {
                        "name": "trio_errors"
                    }
                ],
                "meta": {
                    "global": true,
                    "type": "parameter"
                },
                "run_data": {
                    "type": "input",
                    "value": [
                        "true"
                    ],
                    "meta": [
                        {
                            "ordinal": 1
                        }
                    ]
                }
            },
            {
                "name": "het_hom",
                "source": [
                    {
                        "name": "het_hom"
                    }
                ],
                "meta": {
                    "global": true,
                    "type": "parameter"
                },
                "run_data": {
                    "type": "input",
                    "value": [
                        "true"
                    ],
                    "meta": [
                        {
                            "ordinal": 1
                        }
                    ]
                }
            },
            {
                "name": "ti_tv",
                "source": [
                    {
                        "name": "ti_tv"
                    }
                ],
                "meta": {
                    "global": true,
                    "type": "parameter"
                },
                "run_data": {
                    "type": "input",
                    "value": [
                        "true"
                    ],
                    "meta": [
                        {
                            "ordinal": 1
                        }
                    ]
                }
            }
        ],
        "outputs": []
    },
    {
        "name": "/workflow-runs-awsem/64a59f36-a856-47e1-be09-d0c6b8694252/",
        "meta": {
            "@id": "/workflow-runs-awsem/64a59f36-a856-47e1-be09-d0c6b8694252/",
            "workflow": {
                "uuid": "97190da3-b0db-4176-b8e2-dd2168f85c31",
                "status": "in review",
                "display_title": "Run granite to filter and clean input vcf (geneList, whiteList, cleanVCF, blackList) plus output integrity-check - GAPK43RH92DS",
                "@type": [
                    "Workflow",
                    "Item"
                ],
                "@id": "/workflows/97190da3-b0db-4176-b8e2-dd2168f85c31/",
                "principals_allowed": {
                    "view": [
                        "editor_for.12a92962-8265-4fc0-b2f8-cf14f05db58b",
                        "group.admin",
                        "group.read-only-admin",
                        "remoteuser.EMBED",
                        "remoteuser.INDEXER"
                    ],
                    "edit": [
                        "editor_for.12a92962-8265-4fc0-b2f8-cf14f05db58b",
                        "group.admin"
                    ]
                }
            },
            "analysis_types": "dummy analysis type"
        },
        "inputs": [
            {
                "name": "input_vcf",
                "source": [
                    {
                        "name": "annotated_vcf",
                        "step": "workflow_vep-annot-check",
                        "for_file": "/files-processed/GAPFIACVY8U8/"
                    }
                ],
                "meta": {
                    "global": false,
                    "type": "data file"
                },
                "run_data": {
                    "type": "input",
                    "file": [
                        {
                            "uuid": "a7809e79-b980-4b7f-9e43-1c2a60959246",
                            "href": "/files-processed/GAPFIACVY8U8/@@download/GAPFIACVY8U8.vcf.gz",
                            "@id": "/files-processed/GAPFIACVY8U8/",
                            "accession": "GAPFIACVY8U8",
                            "display_title": "GAPFIACVY8U8.vcf.gz",
                            "file_size": 2727278155,
                            "@type": [
                                "FileProcessed",
                                "File",
                                "Item"
                            ],
                            "status": "uploaded",
                            "file_format": {
                                "uuid": "1b8f525f-aecb-4211-9ae5-a2c998b05599",
                                "status": "shared",
                                "@id": "/file-formats/vcf_gz/",
                                "display_title": "vcf_gz",
                                "@type": [
                                    "FileFormat",
                                    "Item"
                                ],
                                "principals_allowed": {
                                    "view": [
                                        "system.Authenticated"
                                    ],
                                    "edit": [
                                        "group.admin"
                                    ]
                                }
                            },
                            "quality_metric": {
                                "display_title": "QualityMetricQclist from 2022-04-30",
                                "@type": [
                                    "QualityMetricQclist",
                                    "QualityMetric",
                                    "Item"
                                ],
                                "uuid": "c9df0265-50c5-4706-9327-86d9f18f8130",
                                "@id": "/quality-metrics-qclist/c9df0265-50c5-4706-9327-86d9f18f8130/",
                                "status": "shared",
                                "overall_quality_status": "PASS",
                                "principals_allowed": {
                                    "view": [
                                        "system.Authenticated"
                                    ],
                                    "edit": [
                                        "group.admin"
                                    ]
                                }
                            },
                            "principals_allowed": {
                                "view": [
                                    "editor_for.12a92962-8265-4fc0-b2f8-cf14f05db58b",
                                    "group.admin",
                                    "group.read-only-admin",
                                    "remoteuser.EMBED",
                                    "remoteuser.INDEXER"
                                ],
                                "edit": [
                                    "editor_for.12a92962-8265-4fc0-b2f8-cf14f05db58b",
                                    "group.admin"
                                ]
                            }
                        }
                    ],
                    "meta": [
                        {
                            "ordinal": 1,
                            "dimension": "0",
                            "workflow_argument_name": "input_vcf"
                        }
                    ]
                }
            },
            {
                "name": "genes",
                "source": [
                    {
                        "name": "genes",
                        "for_file": "/files-reference/GAPFI5MKCART/"
                    }
                ],
                "meta": {
                    "global": true,
                    "type": "reference file"
                },
                "run_data": {
                    "type": "input",
                    "file": [
                        {
                            "uuid": "84f2bb24-edd7-459b-ab89-0a21866d7826",
                            "href": "/files-reference/GAPFI5MKCART/@@download/GAPFI5MKCART.txt",
                            "@id": "/files-reference/GAPFI5MKCART/",
                            "accession": "GAPFI5MKCART",
                            "display_title": "GAPFI5MKCART.txt",
                            "file_size": 349968,
                            "@type": [
                                "FileReference",
                                "File",
                                "Item"
                            ],
                            "status": "uploaded",
                            "file_format": {
                                "uuid": "0cd4e777-a596-4927-95c8-b07716121aa3",
                                "status": "shared",
                                "@id": "/file-formats/txt/",
                                "display_title": "txt",
                                "@type": [
                                    "FileFormat",
                                    "Item"
                                ],
                                "principals_allowed": {
                                    "view": [
                                        "system.Authenticated"
                                    ],
                                    "edit": [
                                        "group.admin"
                                    ]
                                }
                            },
                            "principals_allowed": {
                                "view": [
                                    "editor_for.12a92962-8265-4fc0-b2f8-cf14f05db58b",
                                    "group.admin",
                                    "group.read-only-admin",
                                    "remoteuser.EMBED",
                                    "remoteuser.INDEXER"
                                ],
                                "edit": [
                                    "editor_for.12a92962-8265-4fc0-b2f8-cf14f05db58b",
                                    "group.admin"
                                ]
                            }
                        }
                    ],
                    "meta": [
                        {
                            "ordinal": 1,
                            "dimension": "0",
                            "workflow_argument_name": "genes"
                        }
                    ]
                }
            },
            {
                "name": "aftag",
                "source": [
                    {
                        "name": "variant_filtering_aftag"
                    }
                ],
                "meta": {
                    "global": true,
                    "type": "parameter"
                },
                "run_data": {
                    "type": "input",
                    "value": [
                        "gnomADg_AF"
                    ],
                    "meta": [
                        {
                            "ordinal": 1
                        }
                    ]
                }
            },
            {
                "name": "afthr",
                "source": [
                    {
                        "name": "variant_filtering_afthr"
                    }
                ],
                "meta": {
                    "global": true,
                    "type": "parameter"
                },
                "run_data": {
                    "type": "input",
                    "value": [
                        "0.01"
                    ],
                    "meta": [
                        {
                            "ordinal": 1
                        }
                    ]
                }
            }
        ],
        "outputs": [
            {
                "name": "merged_vcf",
                "target": [
                    {
                        "name": "merged_vcf",
                        "for_file": "/files-processed/GAPFIF8PBOT6/"
                    }
                ],
                "meta": {
                    "type": "data file"
                },
                "run_data": {
                    "type": "output",
                    "file": [
                        {
                            "display_title": "GAPFIF8PBOT6.vcf.gz",
                            "status": "uploaded",
                            "@id": "/files-processed/GAPFIF8PBOT6/",
                            "uuid": "c11cb753-5ae1-4298-b714-e30b67b46653",
                            "@type": [
                                "FileProcessed",
                                "File",
                                "Item"
                            ],
                            "principals_allowed": {
                                "view": [
                                    "editor_for.12a92962-8265-4fc0-b2f8-cf14f05db58b",
                                    "group.admin",
                                    "group.read-only-admin",
                                    "remoteuser.EMBED",
                                    "remoteuser.INDEXER"
                                ],
                                "edit": [
                                    "editor_for.12a92962-8265-4fc0-b2f8-cf14f05db58b",
                                    "group.admin"
                                ]
                            }
                        }
                    ],
                    "meta": [
                        {
                            "type": "Output processed file"
                        }
                    ]
                }
            }
        ]
    },
    {
        "name": "/workflow-runs-awsem/2160c911-2d1b-466b-9643-ed30c74228a8/",
        "meta": {
            "@id": "/workflow-runs-awsem/2160c911-2d1b-466b-9643-ed30c74228a8/",
            "workflow": {
                "uuid": "4903b64d-ec78-4673-8bc9-cfd16d1cc0c1",
                "status": "in review",
                "display_title": "Run granite novoCaller using rck files plus output integrity-check - GAPS8LJG3FDL",
                "@type": [
                    "Workflow",
                    "Item"
                ],
                "@id": "/workflows/4903b64d-ec78-4673-8bc9-cfd16d1cc0c1/",
                "principals_allowed": {
                    "view": [
                        "editor_for.12a92962-8265-4fc0-b2f8-cf14f05db58b",
                        "group.admin",
                        "group.read-only-admin",
                        "remoteuser.EMBED",
                        "remoteuser.INDEXER"
                    ],
                    "edit": [
                        "editor_for.12a92962-8265-4fc0-b2f8-cf14f05db58b",
                        "group.admin"
                    ]
                }
            },
            "analysis_types": "dummy analysis type"
        },
        "inputs": [
            {
                "name": "input_vcf",
                "source": [
                    {
                        "name": "merged_vcf",
                        "step": "workflow_granite-filtering-check",
                        "for_file": "/files-processed/GAPFIF8PBOT6/"
                    }
                ],
                "meta": {
                    "global": false,
                    "type": "data file"
                },
                "run_data": {
                    "type": "input",
                    "file": [
                        {
                            "accession": "GAPFIF8PBOT6",
                            "display_title": "GAPFIF8PBOT6.vcf.gz",
                            "href": "/files-processed/GAPFIF8PBOT6/@@download/GAPFIF8PBOT6.vcf.gz",
                            "file_size": 4212759,
                            "uuid": "c11cb753-5ae1-4298-b714-e30b67b46653",
                            "@id": "/files-processed/GAPFIF8PBOT6/",
                            "@type": [
                                "FileProcessed",
                                "File",
                                "Item"
                            ],
                            "file_format": {
                                "@id": "/file-formats/vcf_gz/",
                                "uuid": "1b8f525f-aecb-4211-9ae5-a2c998b05599",
                                "status": "shared",
                                "@type": [
                                    "FileFormat",
                                    "Item"
                                ],
                                "display_title": "vcf_gz",
                                "principals_allowed": {
                                    "view": [
                                        "system.Authenticated"
                                    ],
                                    "edit": [
                                        "group.admin"
                                    ]
                                }
                            },
                            "status": "uploaded",
                            "quality_metric": {
                                "status": "shared",
                                "@id": "/quality-metrics-qclist/22c5255f-ef08-4660-8524-887067eebb2e/",
                                "overall_quality_status": "PASS",
                                "uuid": "22c5255f-ef08-4660-8524-887067eebb2e",
                                "@type": [
                                    "QualityMetricQclist",
                                    "QualityMetric",
                                    "Item"
                                ],
                                "display_title": "QualityMetricQclist from 2022-04-30",
                                "principals_allowed": {
                                    "view": [
                                        "system.Authenticated"
                                    ],
                                    "edit": [
                                        "group.admin"
                                    ]
                                }
                            },
                            "principals_allowed": {
                                "view": [
                                    "editor_for.12a92962-8265-4fc0-b2f8-cf14f05db58b",
                                    "group.admin",
                                    "group.read-only-admin",
                                    "remoteuser.EMBED",
                                    "remoteuser.INDEXER"
                                ],
                                "edit": [
                                    "editor_for.12a92962-8265-4fc0-b2f8-cf14f05db58b",
                                    "group.admin"
                                ]
                            }
                        }
                    ],
                    "meta": [
                        {
                            "ordinal": 1,
                            "dimension": "0",
                            "workflow_argument_name": "input_vcf"
                        }
                    ]
                }
            },
            {
                "name": "unrelated",
                "source": [
                    {
                        "name": "unrelated",
                        "for_file": "/files-reference/GAPFIMO8Y4PZ/"
                    }
                ],
                "meta": {
                    "global": true,
                    "type": "reference file"
                },
                "run_data": {
                    "type": "input",
                    "file": [
                        {
                            "accession": "GAPFIMO8Y4PZ",
                            "display_title": "GAPFIMO8Y4PZ.rck.tar",
                            "href": "/files-reference/GAPFIMO8Y4PZ/@@download/GAPFIMO8Y4PZ.rck.tar",
                            "file_size": 209874647040,
                            "uuid": "eac862c0-8c87-4838-83cb-9a77412bff6f",
                            "@id": "/files-reference/GAPFIMO8Y4PZ/",
                            "@type": [
                                "FileReference",
                                "File",
                                "Item"
                            ],
                            "file_format": {
                                "@id": "/file-formats/rck_tar/",
                                "uuid": "39f836d8-bbb1-46c7-80d4-e321d4a44204",
                                "status": "shared",
                                "@type": [
                                    "FileFormat",
                                    "Item"
                                ],
                                "display_title": "rck_tar",
                                "principals_allowed": {
                                    "view": [
                                        "system.Authenticated"
                                    ],
                                    "edit": [
                                        "group.admin"
                                    ]
                                }
                            },
                            "status": "uploaded",
                            "principals_allowed": {
                                "view": [
                                    "editor_for.12a92962-8265-4fc0-b2f8-cf14f05db58b",
                                    "group.admin",
                                    "group.read-only-admin",
                                    "remoteuser.EMBED",
                                    "remoteuser.INDEXER"
                                ],
                                "edit": [
                                    "editor_for.12a92962-8265-4fc0-b2f8-cf14f05db58b",
                                    "group.admin"
                                ]
                            }
                        }
                    ],
                    "meta": [
                        {
                            "ordinal": 1,
                            "dimension": "0",
                            "workflow_argument_name": "unrelated"
                        }
                    ]
                }
            },
            {
                "name": "trio",
                "source": [
                    {
                        "name": "rck_tar",
                        "step": "workflow_granite-rckTar",
                        "for_file": "/files-processed/GAPFI7TBYWC7/"
                    }
                ],
                "meta": {
                    "global": false,
                    "type": "data file"
                },
                "run_data": {
                    "type": "input",
                    "file": [
                        {
                            "accession": "GAPFI7TBYWC7",
                            "display_title": "GAPFI7TBYWC7.rck.tar",
                            "href": "/files-processed/GAPFI7TBYWC7/@@download/GAPFI7TBYWC7.rck.tar",
                            "file_size": 35891374080,
                            "uuid": "3e8a17d1-e07f-4226-bd6a-a4ca13606528",
                            "@id": "/files-processed/GAPFI7TBYWC7/",
                            "@type": [
                                "FileProcessed",
                                "File",
                                "Item"
                            ],
                            "file_format": {
                                "@id": "/file-formats/rck_tar/",
                                "uuid": "39f836d8-bbb1-46c7-80d4-e321d4a44204",
                                "status": "shared",
                                "@type": [
                                    "FileFormat",
                                    "Item"
                                ],
                                "display_title": "rck_tar",
                                "principals_allowed": {
                                    "view": [
                                        "system.Authenticated"
                                    ],
                                    "edit": [
                                        "group.admin"
                                    ]
                                }
                            },
                            "status": "uploaded",
                            "principals_allowed": {
                                "view": [
                                    "editor_for.12a92962-8265-4fc0-b2f8-cf14f05db58b",
                                    "group.admin",
                                    "group.read-only-admin",
                                    "remoteuser.EMBED",
                                    "remoteuser.INDEXER"
                                ],
                                "edit": [
                                    "editor_for.12a92962-8265-4fc0-b2f8-cf14f05db58b",
                                    "group.admin"
                                ]
                            }
                        }
                    ],
                    "meta": [
                        {
                            "ordinal": 1,
                            "dimension": "0",
                            "workflow_argument_name": "trio"
                        }
                    ]
                }
            }
        ],
        "outputs": [
            {
                "name": "novoCaller_vcf",
                "target": [
                    {
                        "name": "novoCaller_vcf",
                        "for_file": "/files-processed/GAPFIRZZWDQL/"
                    }
                ],
                "meta": {
                    "type": "data file"
                },
                "run_data": {
                    "type": "output",
                    "file": [
                        {
                            "display_title": "GAPFIRZZWDQL.vcf.gz",
                            "status": "uploaded",
                            "@id": "/files-processed/GAPFIRZZWDQL/",
                            "uuid": "0d5b70d8-3ab9-474b-92ff-0b41bfa1919b",
                            "@type": [
                                "FileProcessed",
                                "File",
                                "Item"
                            ],
                            "principals_allowed": {
                                "view": [
                                    "editor_for.12a92962-8265-4fc0-b2f8-cf14f05db58b",
                                    "group.admin",
                                    "group.read-only-admin",
                                    "remoteuser.EMBED",
                                    "remoteuser.INDEXER"
                                ],
                                "edit": [
                                    "editor_for.12a92962-8265-4fc0-b2f8-cf14f05db58b",
                                    "group.admin"
                                ]
                            }
                        }
                    ],
                    "meta": [
                        {
                            "type": "Output processed file"
                        }
                    ]
                }
            }
        ]
    },
    {
        "name": "/workflow-runs-awsem/99c36be0-a667-456a-9b8c-b08bb3b4da17/",
        "meta": {
            "@id": "/workflow-runs-awsem/99c36be0-a667-456a-9b8c-b08bb3b4da17/",
            "workflow": {
                "uuid": "78ba0550-0c09-47e1-8559-a45be0058056",
                "status": "in review",
                "display_title": "Run granite qcVCF - GAPXFAL93FS1",
                "@type": [
                    "Workflow",
                    "Item"
                ],
                "@id": "/workflows/78ba0550-0c09-47e1-8559-a45be0058056/",
                "principals_allowed": {
                    "view": [
                        "editor_for.12a92962-8265-4fc0-b2f8-cf14f05db58b",
                        "group.admin",
                        "group.read-only-admin",
                        "remoteuser.EMBED",
                        "remoteuser.INDEXER"
                    ],
                    "edit": [
                        "editor_for.12a92962-8265-4fc0-b2f8-cf14f05db58b",
                        "group.admin"
                    ]
                }
            },
            "analysis_types": "dummy analysis type"
        },
        "inputs": [
            {
                "name": "input_vcf",
                "source": [
                    {
                        "name": "merged_vcf",
                        "step": "workflow_granite-filtering-check",
                        "for_file": "/files-processed/GAPFIF8PBOT6/"
                    }
                ],
                "meta": {
                    "global": false,
                    "type": "data file"
                },
                "run_data": {
                    "type": "input",
                    "file": [
                        {
                            "display_title": "GAPFIF8PBOT6.vcf.gz",
                            "uuid": "c11cb753-5ae1-4298-b714-e30b67b46653",
                            "status": "uploaded",
                            "file_size": 4212759,
                            "href": "/files-processed/GAPFIF8PBOT6/@@download/GAPFIF8PBOT6.vcf.gz",
                            "@id": "/files-processed/GAPFIF8PBOT6/",
                            "accession": "GAPFIF8PBOT6",
                            "@type": [
                                "FileProcessed",
                                "File",
                                "Item"
                            ],
                            "file_format": {
                                "@type": [
                                    "FileFormat",
                                    "Item"
                                ],
                                "status": "shared",
                                "@id": "/file-formats/vcf_gz/",
                                "uuid": "1b8f525f-aecb-4211-9ae5-a2c998b05599",
                                "display_title": "vcf_gz",
                                "principals_allowed": {
                                    "view": [
                                        "system.Authenticated"
                                    ],
                                    "edit": [
                                        "group.admin"
                                    ]
                                }
                            },
                            "principals_allowed": {
                                "view": [
                                    "editor_for.12a92962-8265-4fc0-b2f8-cf14f05db58b",
                                    "group.admin",
                                    "group.read-only-admin",
                                    "remoteuser.EMBED",
                                    "remoteuser.INDEXER"
                                ],
                                "edit": [
                                    "editor_for.12a92962-8265-4fc0-b2f8-cf14f05db58b",
                                    "group.admin"
                                ]
                            },
                            "quality_metric": {
                                "overall_quality_status": "PASS",
                                "uuid": "22c5255f-ef08-4660-8524-887067eebb2e",
                                "@id": "/quality-metrics-qclist/22c5255f-ef08-4660-8524-887067eebb2e/",
                                "@type": [
                                    "QualityMetricQclist",
                                    "QualityMetric",
                                    "Item"
                                ],
                                "status": "shared",
                                "display_title": "QualityMetricQclist from 2022-04-30",
                                "principals_allowed": {
                                    "view": [
                                        "system.Authenticated"
                                    ],
                                    "edit": [
                                        "group.admin"
                                    ]
                                }
                            }
                        }
                    ],
                    "meta": [
                        {
                            "ordinal": 1,
                            "dimension": "0",
                            "workflow_argument_name": "input_vcf"
                        }
                    ]
                }
            },
            {
                "name": "pedigree",
                "source": [
                    {
                        "name": "pedigree"
                    }
                ],
                "meta": {
                    "global": true,
                    "type": "parameter"
                },
                "run_data": {
                    "type": "input",
                    "value": [
                        "[{\"parents\": [\"GAPIDUZDOX4R\", \"GAPIDQV37Z5Y\"], \"individual\": \"GAPID43VJKQ6\", \"sample_name\": \"NA12879_sample-WGS\", \"gender\": \"F\"}, {\"parents\": [], \"individual\": \"GAPIDUZDOX4R\", \"sample_name\": \"NA12878_sample-WGS\", \"gender\": \"F\"}, {\"parents\": [], \"individual\": \"GAPIDQV37Z5Y\", \"sample_name\": \"NA12877_sample-WGS\", \"gender\": \"M\"}]"
                    ],
                    "meta": [
                        {
                            "ordinal": 1
                        }
                    ]
                }
            },
            {
                "name": "samples",
                "source": [
                    {
                        "name": "sample_names"
                    }
                ],
                "meta": {
                    "global": true,
                    "type": "parameter"
                },
                "run_data": {
                    "type": "input",
                    "value": [
                        "[\"NA12879_sample-WGS\", \"NA12878_sample-WGS\", \"NA12877_sample-WGS\"]"
                    ],
                    "meta": [
                        {
                            "ordinal": 1
                        }
                    ]
                }
            },
            {
                "name": "trio_errors",
                "source": [
                    {
                        "name": "trio_errors"
                    }
                ],
                "meta": {
                    "global": true,
                    "type": "parameter"
                },
                "run_data": {
                    "type": "input",
                    "value": [
                        "true"
                    ],
                    "meta": [
                        {
                            "ordinal": 1
                        }
                    ]
                }
            },
            {
                "name": "het_hom",
                "source": [
                    {
                        "name": "het_hom"
                    }
                ],
                "meta": {
                    "global": true,
                    "type": "parameter"
                },
                "run_data": {
                    "type": "input",
                    "value": [
                        "false"
                    ],
                    "meta": [
                        {
                            "ordinal": 1
                        }
                    ]
                }
            },
            {
                "name": "ti_tv",
                "source": [
                    {
                        "name": "ti_tv"
                    }
                ],
                "meta": {
                    "global": true,
                    "type": "parameter"
                },
                "run_data": {
                    "type": "input",
                    "value": [
                        "false"
                    ],
                    "meta": [
                        {
                            "ordinal": 1
                        }
                    ]
                }
            }
        ],
        "outputs": []
    },
    {
        "name": "/workflow-runs-awsem/31fad2bc-d98e-446e-8cc5-a695aee8ba47/",
        "meta": {
            "@id": "/workflow-runs-awsem/31fad2bc-d98e-446e-8cc5-a695aee8ba47/",
            "workflow": {
                "uuid": "78ba0550-0c09-47e1-8559-a45be0058056",
                "status": "in review",
                "display_title": "Run granite qcVCF - GAPXFAL93FS1",
                "@type": [
                    "Workflow",
                    "Item"
                ],
                "@id": "/workflows/78ba0550-0c09-47e1-8559-a45be0058056/",
                "principals_allowed": {
                    "view": [
                        "editor_for.12a92962-8265-4fc0-b2f8-cf14f05db58b",
                        "group.admin",
                        "group.read-only-admin",
                        "remoteuser.EMBED",
                        "remoteuser.INDEXER"
                    ],
                    "edit": [
                        "editor_for.12a92962-8265-4fc0-b2f8-cf14f05db58b",
                        "group.admin"
                    ]
                }
            },
            "analysis_types": "dummy analysis type"
        },
        "inputs": [
            {
                "name": "input_vcf",
                "source": [
                    {
                        "name": "novoCaller_vcf",
                        "step": "workflow_granite-novoCaller-rck-check",
                        "for_file": "/files-processed/GAPFIRZZWDQL/"
                    }
                ],
                "meta": {
                    "global": false,
                    "type": "data file"
                },
                "run_data": {
                    "type": "input",
                    "file": [
                        {
                            "uuid": "0d5b70d8-3ab9-474b-92ff-0b41bfa1919b",
                            "href": "/files-processed/GAPFIRZZWDQL/@@download/GAPFIRZZWDQL.vcf.gz",
                            "@id": "/files-processed/GAPFIRZZWDQL/",
                            "accession": "GAPFIRZZWDQL",
                            "display_title": "GAPFIRZZWDQL.vcf.gz",
                            "file_size": 4980651,
                            "@type": [
                                "FileProcessed",
                                "File",
                                "Item"
                            ],
                            "status": "uploaded",
                            "file_format": {
                                "uuid": "1b8f525f-aecb-4211-9ae5-a2c998b05599",
                                "status": "shared",
                                "@id": "/file-formats/vcf_gz/",
                                "display_title": "vcf_gz",
                                "@type": [
                                    "FileFormat",
                                    "Item"
                                ],
                                "principals_allowed": {
                                    "view": [
                                        "system.Authenticated"
                                    ],
                                    "edit": [
                                        "group.admin"
                                    ]
                                }
                            },
                            "quality_metric": {
                                "display_title": "QualityMetricQclist from 2022-04-30",
                                "@type": [
                                    "QualityMetricQclist",
                                    "QualityMetric",
                                    "Item"
                                ],
                                "uuid": "8c3fe2b7-5186-451d-b273-b775f65afdf4",
                                "@id": "/quality-metrics-qclist/8c3fe2b7-5186-451d-b273-b775f65afdf4/",
                                "status": "shared",
                                "overall_quality_status": "PASS",
                                "principals_allowed": {
                                    "view": [
                                        "system.Authenticated"
                                    ],
                                    "edit": [
                                        "group.admin"
                                    ]
                                }
                            },
                            "principals_allowed": {
                                "view": [
                                    "editor_for.12a92962-8265-4fc0-b2f8-cf14f05db58b",
                                    "group.admin",
                                    "group.read-only-admin",
                                    "remoteuser.EMBED",
                                    "remoteuser.INDEXER"
                                ],
                                "edit": [
                                    "editor_for.12a92962-8265-4fc0-b2f8-cf14f05db58b",
                                    "group.admin"
                                ]
                            }
                        }
                    ],
                    "meta": [
                        {
                            "ordinal": 1,
                            "dimension": "0",
                            "workflow_argument_name": "input_vcf"
                        }
                    ]
                }
            },
            {
                "name": "pedigree",
                "source": [
                    {
                        "name": "pedigree"
                    }
                ],
                "meta": {
                    "global": true,
                    "type": "parameter"
                },
                "run_data": {
                    "type": "input",
                    "value": [
                        "[{\"parents\": [\"GAPIDUZDOX4R\", \"GAPIDQV37Z5Y\"], \"individual\": \"GAPID43VJKQ6\", \"sample_name\": \"NA12879_sample-WGS\", \"gender\": \"F\"}, {\"parents\": [], \"individual\": \"GAPIDUZDOX4R\", \"sample_name\": \"NA12878_sample-WGS\", \"gender\": \"F\"}, {\"parents\": [], \"individual\": \"GAPIDQV37Z5Y\", \"sample_name\": \"NA12877_sample-WGS\", \"gender\": \"M\"}]"
                    ],
                    "meta": [
                        {
                            "ordinal": 1
                        }
                    ]
                }
            },
            {
                "name": "samples",
                "source": [
                    {
                        "name": "sample_names"
                    }
                ],
                "meta": {
                    "global": true,
                    "type": "parameter"
                },
                "run_data": {
                    "type": "input",
                    "value": [
                        "[\"NA12879_sample-WGS\", \"NA12878_sample-WGS\", \"NA12877_sample-WGS\"]"
                    ],
                    "meta": [
                        {
                            "ordinal": 1
                        }
                    ]
                }
            },
            {
                "name": "trio_errors",
                "source": [
                    {
                        "name": "trio_errors"
                    }
                ],
                "meta": {
                    "global": true,
                    "type": "parameter"
                },
                "run_data": {
                    "type": "input",
                    "value": [
                        "true"
                    ],
                    "meta": [
                        {
                            "ordinal": 1
                        }
                    ]
                }
            },
            {
                "name": "het_hom",
                "source": [
                    {
                        "name": "het_hom"
                    }
                ],
                "meta": {
                    "global": true,
                    "type": "parameter"
                },
                "run_data": {
                    "type": "input",
                    "value": [
                        "false"
                    ],
                    "meta": [
                        {
                            "ordinal": 1
                        }
                    ]
                }
            },
            {
                "name": "ti_tv",
                "source": [
                    {
                        "name": "ti_tv"
                    }
                ],
                "meta": {
                    "global": true,
                    "type": "parameter"
                },
                "run_data": {
                    "type": "input",
                    "value": [
                        "false"
                    ],
                    "meta": [
                        {
                            "ordinal": 1
                        }
                    ]
                }
            }
        ],
        "outputs": []
    },
    {
        "name": "/workflow-runs-awsem/e71195e4-f32c-4cf7-866b-15b522b3998c/",
        "meta": {
            "@id": "/workflow-runs-awsem/e71195e4-f32c-4cf7-866b-15b522b3998c/",
            "workflow": {
                "uuid": "bdcd68e4-be7f-43ea-a6a7-567dc682217e",
                "status": "in review",
                "display_title": "Run granite comHet plus output integrity-check - GAPWFC63LK1I",
                "@type": [
                    "Workflow",
                    "Item"
                ],
                "@id": "/workflows/bdcd68e4-be7f-43ea-a6a7-567dc682217e/",
                "principals_allowed": {
                    "view": [
                        "editor_for.12a92962-8265-4fc0-b2f8-cf14f05db58b",
                        "group.admin",
                        "group.read-only-admin",
                        "remoteuser.EMBED",
                        "remoteuser.INDEXER"
                    ],
                    "edit": [
                        "editor_for.12a92962-8265-4fc0-b2f8-cf14f05db58b",
                        "group.admin"
                    ]
                }
            },
            "analysis_types": "dummy analysis type"
        },
        "inputs": [
            {
                "name": "input_vcf",
                "source": [
                    {
                        "name": "novoCaller_vcf",
                        "step": "workflow_granite-novoCaller-rck-check",
                        "for_file": "/files-processed/GAPFIRZZWDQL/"
                    }
                ],
                "meta": {
                    "global": false,
                    "type": "data file"
                },
                "run_data": {
                    "type": "input",
                    "file": [
                        {
                            "accession": "GAPFIRZZWDQL",
                            "@id": "/files-processed/GAPFIRZZWDQL/",
                            "file_size": 4980651,
                            "href": "/files-processed/GAPFIRZZWDQL/@@download/GAPFIRZZWDQL.vcf.gz",
                            "display_title": "GAPFIRZZWDQL.vcf.gz",
                            "uuid": "0d5b70d8-3ab9-474b-92ff-0b41bfa1919b",
                            "file_format": {
                                "@id": "/file-formats/vcf_gz/",
                                "display_title": "vcf_gz",
                                "uuid": "1b8f525f-aecb-4211-9ae5-a2c998b05599",
                                "@type": [
                                    "FileFormat",
                                    "Item"
                                ],
                                "status": "shared",
                                "principals_allowed": {
                                    "view": [
                                        "system.Authenticated"
                                    ],
                                    "edit": [
                                        "group.admin"
                                    ]
                                }
                            },
                            "status": "uploaded",
                            "@type": [
                                "FileProcessed",
                                "File",
                                "Item"
                            ],
                            "quality_metric": {
                                "uuid": "8c3fe2b7-5186-451d-b273-b775f65afdf4",
                                "@id": "/quality-metrics-qclist/8c3fe2b7-5186-451d-b273-b775f65afdf4/",
                                "display_title": "QualityMetricQclist from 2022-04-30",
                                "overall_quality_status": "PASS",
                                "status": "shared",
                                "@type": [
                                    "QualityMetricQclist",
                                    "QualityMetric",
                                    "Item"
                                ],
                                "principals_allowed": {
                                    "view": [
                                        "system.Authenticated"
                                    ],
                                    "edit": [
                                        "group.admin"
                                    ]
                                }
                            },
                            "principals_allowed": {
                                "view": [
                                    "editor_for.12a92962-8265-4fc0-b2f8-cf14f05db58b",
                                    "group.admin",
                                    "group.read-only-admin",
                                    "remoteuser.EMBED",
                                    "remoteuser.INDEXER"
                                ],
                                "edit": [
                                    "editor_for.12a92962-8265-4fc0-b2f8-cf14f05db58b",
                                    "group.admin"
                                ]
                            }
                        }
                    ],
                    "meta": [
                        {
                            "ordinal": 1,
                            "dimension": "0",
                            "workflow_argument_name": "input_vcf"
                        }
                    ]
                }
            },
            {
                "name": "trio",
                "source": [
                    {
                        "name": "sample_names"
                    }
                ],
                "meta": {
                    "global": true,
                    "type": "parameter"
                },
                "run_data": {
                    "type": "input",
                    "value": [
                        "[\"NA12879_sample-WGS\", \"NA12878_sample-WGS\", \"NA12877_sample-WGS\"]"
                    ],
                    "meta": [
                        {
                            "ordinal": 1
                        }
                    ]
                }
            }
        ],
        "outputs": [
            {
                "name": "comHet_vcf",
                "target": [
                    {
                        "name": "comHet_vcf",
                        "for_file": "/files-processed/GAPFIUXS6TY7/"
                    }
                ],
                "meta": {
                    "type": "data file"
                },
                "run_data": {
                    "type": "output",
                    "file": [
                        {
                            "display_title": "GAPFIUXS6TY7.vcf.gz",
                            "status": "uploaded",
                            "@id": "/files-processed/GAPFIUXS6TY7/",
                            "uuid": "2bdf5b97-b382-4c11-a70a-b6a5210bf319",
                            "@type": [
                                "FileProcessed",
                                "File",
                                "Item"
                            ],
                            "principals_allowed": {
                                "view": [
                                    "editor_for.12a92962-8265-4fc0-b2f8-cf14f05db58b",
                                    "group.admin",
                                    "group.read-only-admin",
                                    "remoteuser.EMBED",
                                    "remoteuser.INDEXER"
                                ],
                                "edit": [
                                    "editor_for.12a92962-8265-4fc0-b2f8-cf14f05db58b",
                                    "group.admin"
                                ]
                            }
                        }
                    ],
                    "meta": [
                        {
                            "type": "Output processed file"
                        }
                    ]
                }
            }
        ]
    },
    {
        "name": "/workflow-runs-awsem/703d75f8-4fdf-4cb4-a65b-6181e1079660/",
        "meta": {
            "@id": "/workflow-runs-awsem/703d75f8-4fdf-4cb4-a65b-6181e1079660/",
            "workflow": {
                "uuid": "2fe0a5c6-08f0-4c1b-8ac2-8209927e198b",
                "status": "in review",
                "display_title": "Run dbSNP ID fixer plus output integrity-check - GAPWFRQ54BG2",
                "@type": [
                    "Workflow",
                    "Item"
                ],
                "@id": "/workflows/2fe0a5c6-08f0-4c1b-8ac2-8209927e198b/",
                "principals_allowed": {
                    "view": [
                        "editor_for.12a92962-8265-4fc0-b2f8-cf14f05db58b",
                        "group.admin",
                        "group.read-only-admin",
                        "remoteuser.EMBED",
                        "remoteuser.INDEXER"
                    ],
                    "edit": [
                        "editor_for.12a92962-8265-4fc0-b2f8-cf14f05db58b",
                        "group.admin"
                    ]
                }
            },
            "analysis_types": "dummy analysis type"
        },
        "inputs": [
            {
                "name": "input_vcf",
                "source": [
                    {
                        "name": "comHet_vcf",
                        "step": "workflow_granite-comHet-check",
                        "for_file": "/files-processed/GAPFIUXS6TY7/"
                    }
                ],
                "meta": {
                    "global": false,
                    "type": "data file"
                },
                "run_data": {
                    "type": "input",
                    "file": [
                        {
                            "accession": "GAPFIUXS6TY7",
                            "display_title": "GAPFIUXS6TY7.vcf.gz",
                            "href": "/files-processed/GAPFIUXS6TY7/@@download/GAPFIUXS6TY7.vcf.gz",
                            "file_size": 5015079,
                            "uuid": "2bdf5b97-b382-4c11-a70a-b6a5210bf319",
                            "@id": "/files-processed/GAPFIUXS6TY7/",
                            "@type": [
                                "FileProcessed",
                                "File",
                                "Item"
                            ],
                            "file_format": {
                                "@id": "/file-formats/vcf_gz/",
                                "uuid": "1b8f525f-aecb-4211-9ae5-a2c998b05599",
                                "status": "shared",
                                "@type": [
                                    "FileFormat",
                                    "Item"
                                ],
                                "display_title": "vcf_gz",
                                "principals_allowed": {
                                    "view": [
                                        "system.Authenticated"
                                    ],
                                    "edit": [
                                        "group.admin"
                                    ]
                                }
                            },
                            "status": "uploaded",
                            "quality_metric": {
                                "status": "shared",
                                "@id": "/quality-metrics-qclist/06a62061-7f6f-4e9e-995d-24c274509290/",
                                "overall_quality_status": "PASS",
                                "uuid": "06a62061-7f6f-4e9e-995d-24c274509290",
                                "@type": [
                                    "QualityMetricQclist",
                                    "QualityMetric",
                                    "Item"
                                ],
                                "display_title": "QualityMetricQclist from 2022-04-30",
                                "principals_allowed": {
                                    "view": [
                                        "system.Authenticated"
                                    ],
                                    "edit": [
                                        "group.admin"
                                    ]
                                }
                            },
                            "principals_allowed": {
                                "view": [
                                    "editor_for.12a92962-8265-4fc0-b2f8-cf14f05db58b",
                                    "group.admin",
                                    "group.read-only-admin",
                                    "remoteuser.EMBED",
                                    "remoteuser.INDEXER"
                                ],
                                "edit": [
                                    "editor_for.12a92962-8265-4fc0-b2f8-cf14f05db58b",
                                    "group.admin"
                                ]
                            }
                        }
                    ],
                    "meta": [
                        {
                            "ordinal": 1,
                            "dimension": "0",
                            "workflow_argument_name": "input_vcf"
                        }
                    ]
                }
            },
            {
                "name": "dbSNP_ref_vcf",
                "source": [
                    {
                        "name": "dbSNP_full_ref_vcf",
                        "for_file": "/files-reference/GAPFIF4JKLTH/"
                    }
                ],
                "meta": {
                    "global": true,
                    "type": "reference file"
                },
                "run_data": {
                    "type": "input",
                    "file": [
                        {
                            "accession": "GAPFIF4JKLTH",
                            "display_title": "GAPFIF4JKLTH.vcf.gz",
                            "href": "/files-reference/GAPFIF4JKLTH/@@download/GAPFIF4JKLTH.vcf.gz",
                            "file_size": 6596050744,
                            "uuid": "aa542c8e-b31c-4cff-b2d4-aa4037bb913c",
                            "@id": "/files-reference/GAPFIF4JKLTH/",
                            "@type": [
                                "FileReference",
                                "File",
                                "Item"
                            ],
                            "file_format": {
                                "@id": "/file-formats/vcf_gz/",
                                "uuid": "1b8f525f-aecb-4211-9ae5-a2c998b05599",
                                "status": "shared",
                                "@type": [
                                    "FileFormat",
                                    "Item"
                                ],
                                "display_title": "vcf_gz",
                                "principals_allowed": {
                                    "view": [
                                        "system.Authenticated"
                                    ],
                                    "edit": [
                                        "group.admin"
                                    ]
                                }
                            },
                            "status": "uploaded",
                            "principals_allowed": {
                                "view": [
                                    "editor_for.12a92962-8265-4fc0-b2f8-cf14f05db58b",
                                    "group.admin",
                                    "group.read-only-admin",
                                    "remoteuser.EMBED",
                                    "remoteuser.INDEXER"
                                ],
                                "edit": [
                                    "editor_for.12a92962-8265-4fc0-b2f8-cf14f05db58b",
                                    "group.admin"
                                ]
                            }
                        }
                    ],
                    "meta": [
                        {
                            "ordinal": 1,
                            "dimension": "0",
                            "workflow_argument_name": "dbSNP_ref_vcf"
                        }
                    ]
                }
            },
            {
                "name": "region_file",
                "source": [
                    {
                        "name": "regions",
                        "for_file": "/files-reference/GAPFIBGEOI72/"
                    }
                ],
                "meta": {
                    "global": true,
                    "type": "reference file"
                },
                "run_data": {
                    "type": "input",
                    "file": [
                        {
                            "accession": "GAPFIBGEOI72",
                            "display_title": "GAPFIBGEOI72.txt",
                            "href": "/files-reference/GAPFIBGEOI72/@@download/GAPFIBGEOI72.txt",
                            "file_size": 7603,
                            "uuid": "1c07a3aa-e2a3-498c-b838-15991c4a2f28",
                            "@id": "/files-reference/GAPFIBGEOI72/",
                            "@type": [
                                "FileReference",
                                "File",
                                "Item"
                            ],
                            "file_format": {
                                "@id": "/file-formats/txt/",
                                "uuid": "0cd4e777-a596-4927-95c8-b07716121aa3",
                                "status": "shared",
                                "@type": [
                                    "FileFormat",
                                    "Item"
                                ],
                                "display_title": "txt",
                                "principals_allowed": {
                                    "view": [
                                        "system.Authenticated"
                                    ],
                                    "edit": [
                                        "group.admin"
                                    ]
                                }
                            },
                            "status": "uploaded",
                            "principals_allowed": {
                                "view": [
                                    "editor_for.12a92962-8265-4fc0-b2f8-cf14f05db58b",
                                    "group.admin",
                                    "group.read-only-admin",
                                    "remoteuser.EMBED",
                                    "remoteuser.INDEXER"
                                ],
                                "edit": [
                                    "editor_for.12a92962-8265-4fc0-b2f8-cf14f05db58b",
                                    "group.admin"
                                ]
                            }
                        }
                    ],
                    "meta": [
                        {
                            "ordinal": 1,
                            "dimension": "0",
                            "workflow_argument_name": "region_file"
                        }
                    ]
                }
            }
        ],
        "outputs": [
            {
                "name": "vcf",
                "target": [
                    {
                        "name": "vcf",
                        "for_file": "/files-processed/GAPFI7UFWBGA/"
                    }
                ],
                "meta": {
                    "type": "data file"
                },
                "run_data": {
                    "type": "output",
                    "file": [
                        {
                            "display_title": "GAPFI7UFWBGA.vcf.gz",
                            "status": "uploaded",
                            "@id": "/files-processed/GAPFI7UFWBGA/",
                            "uuid": "352d3ace-c687-41de-9027-db84bf8af10a",
                            "@type": [
                                "FileProcessed",
                                "File",
                                "Item"
                            ],
                            "principals_allowed": {
                                "view": [
                                    "editor_for.12a92962-8265-4fc0-b2f8-cf14f05db58b",
                                    "group.admin",
                                    "group.read-only-admin",
                                    "remoteuser.EMBED",
                                    "remoteuser.INDEXER"
                                ],
                                "edit": [
                                    "editor_for.12a92962-8265-4fc0-b2f8-cf14f05db58b",
                                    "group.admin"
                                ]
                            }
                        }
                    ],
                    "meta": [
                        {
                            "type": "Output processed file"
                        }
                    ]
                }
            }
        ]
    },
    {
        "name": "/workflow-runs-awsem/dd927729-294a-4cff-bf20-115dc9561ff7/",
        "meta": {
            "@id": "/workflow-runs-awsem/dd927729-294a-4cff-bf20-115dc9561ff7/",
            "workflow": {
                "uuid": "78ba0550-0c09-47e1-8559-a45be0058056",
                "status": "in review",
                "display_title": "Run granite qcVCF - GAPXFAL93FS1",
                "@type": [
                    "Workflow",
                    "Item"
                ],
                "@id": "/workflows/78ba0550-0c09-47e1-8559-a45be0058056/",
                "principals_allowed": {
                    "view": [
                        "editor_for.12a92962-8265-4fc0-b2f8-cf14f05db58b",
                        "group.admin",
                        "group.read-only-admin",
                        "remoteuser.EMBED",
                        "remoteuser.INDEXER"
                    ],
                    "edit": [
                        "editor_for.12a92962-8265-4fc0-b2f8-cf14f05db58b",
                        "group.admin"
                    ]
                }
            },
            "analysis_types": "dummy analysis type"
        },
        "inputs": [
            {
                "name": "input_vcf",
                "source": [
                    {
                        "name": "comHet_vcf",
                        "step": "workflow_granite-comHet-check",
                        "for_file": "/files-processed/GAPFIUXS6TY7/"
                    }
                ],
                "meta": {
                    "global": false,
                    "type": "data file"
                },
                "run_data": {
                    "type": "input",
                    "file": [
                        {
                            "display_title": "GAPFIUXS6TY7.vcf.gz",
                            "uuid": "2bdf5b97-b382-4c11-a70a-b6a5210bf319",
                            "status": "uploaded",
                            "file_size": 5015079,
                            "href": "/files-processed/GAPFIUXS6TY7/@@download/GAPFIUXS6TY7.vcf.gz",
                            "@id": "/files-processed/GAPFIUXS6TY7/",
                            "accession": "GAPFIUXS6TY7",
                            "@type": [
                                "FileProcessed",
                                "File",
                                "Item"
                            ],
                            "file_format": {
                                "@type": [
                                    "FileFormat",
                                    "Item"
                                ],
                                "status": "shared",
                                "@id": "/file-formats/vcf_gz/",
                                "uuid": "1b8f525f-aecb-4211-9ae5-a2c998b05599",
                                "display_title": "vcf_gz",
                                "principals_allowed": {
                                    "view": [
                                        "system.Authenticated"
                                    ],
                                    "edit": [
                                        "group.admin"
                                    ]
                                }
                            },
                            "principals_allowed": {
                                "view": [
                                    "editor_for.12a92962-8265-4fc0-b2f8-cf14f05db58b",
                                    "group.admin",
                                    "group.read-only-admin",
                                    "remoteuser.EMBED",
                                    "remoteuser.INDEXER"
                                ],
                                "edit": [
                                    "editor_for.12a92962-8265-4fc0-b2f8-cf14f05db58b",
                                    "group.admin"
                                ]
                            },
                            "quality_metric": {
                                "overall_quality_status": "PASS",
                                "uuid": "06a62061-7f6f-4e9e-995d-24c274509290",
                                "@id": "/quality-metrics-qclist/06a62061-7f6f-4e9e-995d-24c274509290/",
                                "@type": [
                                    "QualityMetricQclist",
                                    "QualityMetric",
                                    "Item"
                                ],
                                "status": "shared",
                                "display_title": "QualityMetricQclist from 2022-04-30",
                                "principals_allowed": {
                                    "view": [
                                        "system.Authenticated"
                                    ],
                                    "edit": [
                                        "group.admin"
                                    ]
                                }
                            }
                        }
                    ],
                    "meta": [
                        {
                            "ordinal": 1,
                            "dimension": "0",
                            "workflow_argument_name": "input_vcf"
                        }
                    ]
                }
            },
            {
                "name": "pedigree",
                "source": [
                    {
                        "name": "pedigree"
                    }
                ],
                "meta": {
                    "global": true,
                    "type": "parameter"
                },
                "run_data": {
                    "type": "input",
                    "value": [
                        "[{\"parents\": [\"GAPIDUZDOX4R\", \"GAPIDQV37Z5Y\"], \"individual\": \"GAPID43VJKQ6\", \"sample_name\": \"NA12879_sample-WGS\", \"gender\": \"F\"}, {\"parents\": [], \"individual\": \"GAPIDUZDOX4R\", \"sample_name\": \"NA12878_sample-WGS\", \"gender\": \"F\"}, {\"parents\": [], \"individual\": \"GAPIDQV37Z5Y\", \"sample_name\": \"NA12877_sample-WGS\", \"gender\": \"M\"}]"
                    ],
                    "meta": [
                        {
                            "ordinal": 1
                        }
                    ]
                }
            },
            {
                "name": "samples",
                "source": [
                    {
                        "name": "sample_names"
                    }
                ],
                "meta": {
                    "global": true,
                    "type": "parameter"
                },
                "run_data": {
                    "type": "input",
                    "value": [
                        "[\"NA12879_sample-WGS\", \"NA12878_sample-WGS\", \"NA12877_sample-WGS\"]"
                    ],
                    "meta": [
                        {
                            "ordinal": 1
                        }
                    ]
                }
            },
            {
                "name": "trio_errors",
                "source": [
                    {
                        "name": "trio_errors"
                    }
                ],
                "meta": {
                    "global": true,
                    "type": "parameter"
                },
                "run_data": {
                    "type": "input",
                    "value": [
                        "true"
                    ],
                    "meta": [
                        {
                            "ordinal": 1
                        }
                    ]
                }
            },
            {
                "name": "het_hom",
                "source": [
                    {
                        "name": "het_hom"
                    }
                ],
                "meta": {
                    "global": true,
                    "type": "parameter"
                },
                "run_data": {
                    "type": "input",
                    "value": [
                        "false"
                    ],
                    "meta": [
                        {
                            "ordinal": 1
                        }
                    ]
                }
            },
            {
                "name": "ti_tv",
                "source": [
                    {
                        "name": "ti_tv"
                    }
                ],
                "meta": {
                    "global": true,
                    "type": "parameter"
                },
                "run_data": {
                    "type": "input",
                    "value": [
                        "false"
                    ],
                    "meta": [
                        {
                            "ordinal": 1
                        }
                    ]
                }
            }
        ],
        "outputs": []
    },
    {
        "name": "/workflow-runs-awsem/da4c3ef1-7cee-42cf-a6d1-ea60dbd60169/",
        "meta": {
            "@id": "/workflow-runs-awsem/da4c3ef1-7cee-42cf-a6d1-ea60dbd60169/",
            "workflow": {
                "uuid": "78ba0550-0c09-47e1-8559-a45be0058056",
                "status": "in review",
                "display_title": "Run granite qcVCF - GAPXFAL93FS1",
                "@type": [
                    "Workflow",
                    "Item"
                ],
                "@id": "/workflows/78ba0550-0c09-47e1-8559-a45be0058056/",
                "principals_allowed": {
                    "view": [
                        "editor_for.12a92962-8265-4fc0-b2f8-cf14f05db58b",
                        "group.admin",
                        "group.read-only-admin",
                        "remoteuser.EMBED",
                        "remoteuser.INDEXER"
                    ],
                    "edit": [
                        "editor_for.12a92962-8265-4fc0-b2f8-cf14f05db58b",
                        "group.admin"
                    ]
                }
            },
            "analysis_types": "dummy analysis type"
        },
        "inputs": [
            {
                "name": "input_vcf",
                "source": [
                    {
                        "name": "vcf",
                        "step": "workflow_dbSNP_ID_fixer-check",
                        "for_file": "/files-processed/GAPFI7UFWBGA/"
                    }
                ],
                "meta": {
                    "global": false,
                    "type": "data file"
                },
                "run_data": {
                    "type": "input",
                    "file": [
                        {
                            "uuid": "352d3ace-c687-41de-9027-db84bf8af10a",
                            "href": "/files-processed/GAPFI7UFWBGA/@@download/GAPFI7UFWBGA.vcf.gz",
                            "@id": "/files-processed/GAPFI7UFWBGA/",
                            "accession": "GAPFI7UFWBGA",
                            "display_title": "GAPFI7UFWBGA.vcf.gz",
                            "file_size": 5033581,
                            "@type": [
                                "FileProcessed",
                                "File",
                                "Item"
                            ],
                            "status": "uploaded",
                            "file_format": {
                                "uuid": "1b8f525f-aecb-4211-9ae5-a2c998b05599",
                                "status": "shared",
                                "@id": "/file-formats/vcf_gz/",
                                "display_title": "vcf_gz",
                                "@type": [
                                    "FileFormat",
                                    "Item"
                                ],
                                "principals_allowed": {
                                    "view": [
                                        "system.Authenticated"
                                    ],
                                    "edit": [
                                        "group.admin"
                                    ]
                                }
                            },
                            "quality_metric": {
                                "display_title": "QualityMetricQclist from 2022-04-30",
                                "@type": [
                                    "QualityMetricQclist",
                                    "QualityMetric",
                                    "Item"
                                ],
                                "uuid": "ed1b017f-45f5-4609-9972-14991d203897",
                                "@id": "/quality-metrics-qclist/ed1b017f-45f5-4609-9972-14991d203897/",
                                "status": "shared",
                                "overall_quality_status": "PASS",
                                "principals_allowed": {
                                    "view": [
                                        "system.Authenticated"
                                    ],
                                    "edit": [
                                        "group.admin"
                                    ]
                                }
                            },
                            "principals_allowed": {
                                "view": [
                                    "editor_for.12a92962-8265-4fc0-b2f8-cf14f05db58b",
                                    "group.admin",
                                    "group.read-only-admin",
                                    "remoteuser.EMBED",
                                    "remoteuser.INDEXER"
                                ],
                                "edit": [
                                    "editor_for.12a92962-8265-4fc0-b2f8-cf14f05db58b",
                                    "group.admin"
                                ]
                            }
                        }
                    ],
                    "meta": [
                        {
                            "ordinal": 1,
                            "dimension": "0",
                            "workflow_argument_name": "input_vcf"
                        }
                    ]
                }
            },
            {
                "name": "pedigree",
                "source": [
                    {
                        "name": "pedigree"
                    }
                ],
                "meta": {
                    "global": true,
                    "type": "parameter"
                },
                "run_data": {
                    "type": "input",
                    "value": [
                        "[{\"parents\": [\"GAPIDUZDOX4R\", \"GAPIDQV37Z5Y\"], \"individual\": \"GAPID43VJKQ6\", \"sample_name\": \"NA12879_sample-WGS\", \"gender\": \"F\"}, {\"parents\": [], \"individual\": \"GAPIDUZDOX4R\", \"sample_name\": \"NA12878_sample-WGS\", \"gender\": \"F\"}, {\"parents\": [], \"individual\": \"GAPIDQV37Z5Y\", \"sample_name\": \"NA12877_sample-WGS\", \"gender\": \"M\"}]"
                    ],
                    "meta": [
                        {
                            "ordinal": 1
                        }
                    ]
                }
            },
            {
                "name": "samples",
                "source": [
                    {
                        "name": "sample_names"
                    }
                ],
                "meta": {
                    "global": true,
                    "type": "parameter"
                },
                "run_data": {
                    "type": "input",
                    "value": [
                        "[\"NA12879_sample-WGS\", \"NA12878_sample-WGS\", \"NA12877_sample-WGS\"]"
                    ],
                    "meta": [
                        {
                            "ordinal": 1
                        }
                    ]
                }
            },
            {
                "name": "trio_errors",
                "source": [
                    {
                        "name": "trio_errors"
                    }
                ],
                "meta": {
                    "global": true,
                    "type": "parameter"
                },
                "run_data": {
                    "type": "input",
                    "value": [
                        "true"
                    ],
                    "meta": [
                        {
                            "ordinal": 1
                        }
                    ]
                }
            },
            {
                "name": "het_hom",
                "source": [
                    {
                        "name": "het_hom"
                    }
                ],
                "meta": {
                    "global": true,
                    "type": "parameter"
                },
                "run_data": {
                    "type": "input",
                    "value": [
                        "false"
                    ],
                    "meta": [
                        {
                            "ordinal": 1
                        }
                    ]
                }
            },
            {
                "name": "ti_tv",
                "source": [
                    {
                        "name": "ti_tv"
                    }
                ],
                "meta": {
                    "global": true,
                    "type": "parameter"
                },
                "run_data": {
                    "type": "input",
                    "value": [
                        "false"
                    ],
                    "meta": [
                        {
                            "ordinal": 1
                        }
                    ]
                }
            }
        ],
        "outputs": []
    },
    {
        "name": "/workflow-runs-awsem/5df3ef23-0e93-4510-8ebb-63ebcc1214a7/",
        "meta": {
            "@id": "/workflow-runs-awsem/5df3ef23-0e93-4510-8ebb-63ebcc1214a7/",
            "workflow": {
                "uuid": "0f08dc44-42c6-4b84-8962-af26e2133784",
                "status": "in review",
                "display_title": "Run hg19 liftover, hgvsg creator, and a vcf integrity check - GAPWFR588CA2",
                "@type": [
                    "Workflow",
                    "Item"
                ],
                "@id": "/workflows/0f08dc44-42c6-4b84-8962-af26e2133784/",
                "principals_allowed": {
                    "view": [
                        "editor_for.12a92962-8265-4fc0-b2f8-cf14f05db58b",
                        "group.admin",
                        "group.read-only-admin",
                        "remoteuser.EMBED",
                        "remoteuser.INDEXER"
                    ],
                    "edit": [
                        "editor_for.12a92962-8265-4fc0-b2f8-cf14f05db58b",
                        "group.admin"
                    ]
                }
            },
            "analysis_types": "dummy analysis type"
        },
        "inputs": [
            {
                "name": "input_vcf",
                "source": [
                    {
                        "name": "vcf",
                        "step": "workflow_dbSNP_ID_fixer-check",
                        "for_file": "/files-processed/GAPFI7UFWBGA/"
                    }
                ],
                "meta": {
                    "global": false,
                    "type": "data file"
                },
                "run_data": {
                    "type": "input",
                    "file": [
                        {
                            "uuid": "352d3ace-c687-41de-9027-db84bf8af10a",
                            "href": "/files-processed/GAPFI7UFWBGA/@@download/GAPFI7UFWBGA.vcf.gz",
                            "@id": "/files-processed/GAPFI7UFWBGA/",
                            "accession": "GAPFI7UFWBGA",
                            "display_title": "GAPFI7UFWBGA.vcf.gz",
                            "file_size": 5033581,
                            "@type": [
                                "FileProcessed",
                                "File",
                                "Item"
                            ],
                            "status": "uploaded",
                            "file_format": {
                                "uuid": "1b8f525f-aecb-4211-9ae5-a2c998b05599",
                                "status": "shared",
                                "@id": "/file-formats/vcf_gz/",
                                "display_title": "vcf_gz",
                                "@type": [
                                    "FileFormat",
                                    "Item"
                                ],
                                "principals_allowed": {
                                    "view": [
                                        "system.Authenticated"
                                    ],
                                    "edit": [
                                        "group.admin"
                                    ]
                                }
                            },
                            "quality_metric": {
                                "display_title": "QualityMetricQclist from 2022-04-30",
                                "@type": [
                                    "QualityMetricQclist",
                                    "QualityMetric",
                                    "Item"
                                ],
                                "uuid": "ed1b017f-45f5-4609-9972-14991d203897",
                                "@id": "/quality-metrics-qclist/ed1b017f-45f5-4609-9972-14991d203897/",
                                "status": "shared",
                                "overall_quality_status": "PASS",
                                "principals_allowed": {
                                    "view": [
                                        "system.Authenticated"
                                    ],
                                    "edit": [
                                        "group.admin"
                                    ]
                                }
                            },
                            "principals_allowed": {
                                "view": [
                                    "editor_for.12a92962-8265-4fc0-b2f8-cf14f05db58b",
                                    "group.admin",
                                    "group.read-only-admin",
                                    "remoteuser.EMBED",
                                    "remoteuser.INDEXER"
                                ],
                                "edit": [
                                    "editor_for.12a92962-8265-4fc0-b2f8-cf14f05db58b",
                                    "group.admin"
                                ]
                            }
                        }
                    ],
                    "meta": [
                        {
                            "ordinal": 1,
                            "dimension": "0",
                            "workflow_argument_name": "input_vcf"
                        }
                    ]
                }
            },
            {
                "name": "chainfile",
                "source": [
                    {
                        "name": "chainfile",
                        "for_file": "/files-reference/GAPFIYPTSAU8/"
                    }
                ],
                "meta": {
                    "global": true,
                    "type": "reference file"
                },
                "run_data": {
                    "type": "input",
                    "file": [
                        {
                            "uuid": "297c872a-5b6b-4fc3-83d3-f4a853f8805c",
                            "href": "/files-reference/GAPFIYPTSAU8/@@download/GAPFIYPTSAU8.chain.gz",
                            "@id": "/files-reference/GAPFIYPTSAU8/",
                            "accession": "GAPFIYPTSAU8",
                            "display_title": "GAPFIYPTSAU8.chain.gz",
                            "file_size": 1246411,
                            "@type": [
                                "FileReference",
                                "File",
                                "Item"
                            ],
                            "status": "uploaded",
                            "file_format": {
                                "uuid": "dd1ef82d-da5e-4680-bd5c-cf471a87eb5b",
                                "status": "shared",
                                "@id": "/file-formats/chain/",
                                "display_title": "chain",
                                "@type": [
                                    "FileFormat",
                                    "Item"
                                ],
                                "principals_allowed": {
                                    "view": [
                                        "system.Authenticated"
                                    ],
                                    "edit": [
                                        "group.admin"
                                    ]
                                }
                            },
                            "principals_allowed": {
                                "view": [
                                    "editor_for.12a92962-8265-4fc0-b2f8-cf14f05db58b",
                                    "group.admin",
                                    "group.read-only-admin",
                                    "remoteuser.EMBED",
                                    "remoteuser.INDEXER"
                                ],
                                "edit": [
                                    "editor_for.12a92962-8265-4fc0-b2f8-cf14f05db58b",
                                    "group.admin"
                                ]
                            }
                        }
                    ],
                    "meta": [
                        {
                            "ordinal": 1,
                            "dimension": "0",
                            "workflow_argument_name": "chainfile"
                        }
                    ]
                }
            }
        ],
        "outputs": [
            {
                "name": "vcf",
                "target": [
                    {
                        "name": "vcf",
                        "for_file": "/files-processed/GAPFIRGHPIDQ/"
                    }
                ],
                "meta": {
                    "type": "data file"
                },
                "run_data": {
                    "type": "output",
                    "file": [
                        {
                            "display_title": "GAPFIRGHPIDQ.vcf.gz",
                            "status": "uploaded",
                            "@id": "/files-processed/GAPFIRGHPIDQ/",
                            "uuid": "77ae0d41-f922-4646-bee2-029deaefdf49",
                            "@type": [
                                "FileProcessed",
                                "File",
                                "Item"
                            ],
                            "principals_allowed": {
                                "view": [
                                    "editor_for.12a92962-8265-4fc0-b2f8-cf14f05db58b",
                                    "group.admin",
                                    "group.read-only-admin",
                                    "remoteuser.EMBED",
                                    "remoteuser.INDEXER"
                                ],
                                "edit": [
                                    "editor_for.12a92962-8265-4fc0-b2f8-cf14f05db58b",
                                    "group.admin"
                                ]
                            }
                        }
                    ],
                    "meta": [
                        {
                            "type": "Output processed file"
                        }
                    ]
                }
            }
        ]
    },
    {
        "name": "/workflow-runs-awsem/b847a5ad-670e-4b3c-92be-a1d3e9951b99/",
        "meta": {
            "@id": "/workflow-runs-awsem/b847a5ad-670e-4b3c-92be-a1d3e9951b99/",
            "workflow": {
                "uuid": "78ba0550-0c09-47e1-8559-a45be0058056",
                "status": "in review",
                "display_title": "Run granite qcVCF - GAPXFAL93FS1",
                "@type": [
                    "Workflow",
                    "Item"
                ],
                "@id": "/workflows/78ba0550-0c09-47e1-8559-a45be0058056/",
                "principals_allowed": {
                    "view": [
                        "editor_for.12a92962-8265-4fc0-b2f8-cf14f05db58b",
                        "group.admin",
                        "group.read-only-admin",
                        "remoteuser.EMBED",
                        "remoteuser.INDEXER"
                    ],
                    "edit": [
                        "editor_for.12a92962-8265-4fc0-b2f8-cf14f05db58b",
                        "group.admin"
                    ]
                }
            },
            "analysis_types": "dummy analysis type"
        },
        "inputs": [
            {
                "name": "input_vcf",
                "source": [
                    {
                        "name": "vcf",
                        "step": "workflow_hg19lo_hgvsg-check",
                        "for_file": "/files-processed/GAPFIRGHPIDQ/"
                    }
                ],
                "meta": {
                    "global": false,
                    "type": "data file"
                },
                "run_data": {
                    "type": "input",
                    "file": [
                        {
                            "accession": "GAPFIRGHPIDQ",
                            "@id": "/files-processed/GAPFIRGHPIDQ/",
                            "file_size": 5196340,
                            "@type": [
                                "FileProcessed",
                                "File",
                                "Item"
                            ],
                            "display_title": "GAPFIRGHPIDQ.vcf.gz",
                            "file_format": {
                                "@id": "/file-formats/vcf_gz/",
                                "status": "shared",
                                "display_title": "vcf_gz",
                                "uuid": "1b8f525f-aecb-4211-9ae5-a2c998b05599",
                                "@type": [
                                    "FileFormat",
                                    "Item"
                                ],
                                "principals_allowed": {
                                    "view": [
                                        "system.Authenticated"
                                    ],
                                    "edit": [
                                        "group.admin"
                                    ]
                                }
                            },
                            "status": "uploaded",
                            "href": "/files-processed/GAPFIRGHPIDQ/@@download/GAPFIRGHPIDQ.vcf.gz",
                            "uuid": "77ae0d41-f922-4646-bee2-029deaefdf49",
                            "principals_allowed": {
                                "view": [
                                    "editor_for.12a92962-8265-4fc0-b2f8-cf14f05db58b",
                                    "group.admin",
                                    "group.read-only-admin",
                                    "remoteuser.EMBED",
                                    "remoteuser.INDEXER"
                                ],
                                "edit": [
                                    "editor_for.12a92962-8265-4fc0-b2f8-cf14f05db58b",
                                    "group.admin"
                                ]
                            },
                            "quality_metric": {
                                "display_title": "QualityMetricQclist from 2022-04-30",
                                "status": "shared",
                                "@id": "/quality-metrics-qclist/ac83094c-6bb2-4754-9573-ec6f9dc74ee5/",
                                "overall_quality_status": "PASS",
                                "@type": [
                                    "QualityMetricQclist",
                                    "QualityMetric",
                                    "Item"
                                ],
                                "uuid": "ac83094c-6bb2-4754-9573-ec6f9dc74ee5",
                                "principals_allowed": {
                                    "view": [
                                        "system.Authenticated"
                                    ],
                                    "edit": [
                                        "group.admin"
                                    ]
                                }
                            }
                        }
                    ],
                    "meta": [
                        {
                            "ordinal": 1,
                            "dimension": "0",
                            "workflow_argument_name": "input_vcf"
                        }
                    ]
                }
            },
            {
                "name": "pedigree",
                "source": [
                    {
                        "name": "pedigree"
                    }
                ],
                "meta": {
                    "global": true,
                    "type": "parameter"
                },
                "run_data": {
                    "type": "input",
                    "value": [
                        "[{\"parents\": [\"GAPIDUZDOX4R\", \"GAPIDQV37Z5Y\"], \"individual\": \"GAPID43VJKQ6\", \"sample_name\": \"NA12879_sample-WGS\", \"gender\": \"F\"}, {\"parents\": [], \"individual\": \"GAPIDUZDOX4R\", \"sample_name\": \"NA12878_sample-WGS\", \"gender\": \"F\"}, {\"parents\": [], \"individual\": \"GAPIDQV37Z5Y\", \"sample_name\": \"NA12877_sample-WGS\", \"gender\": \"M\"}]"
                    ],
                    "meta": [
                        {
                            "ordinal": 1
                        }
                    ]
                }
            },
            {
                "name": "samples",
                "source": [
                    {
                        "name": "sample_names"
                    }
                ],
                "meta": {
                    "global": true,
                    "type": "parameter"
                },
                "run_data": {
                    "type": "input",
                    "value": [
                        "[\"NA12879_sample-WGS\", \"NA12878_sample-WGS\", \"NA12877_sample-WGS\"]"
                    ],
                    "meta": [
                        {
                            "ordinal": 1
                        }
                    ]
                }
            },
            {
                "name": "trio_errors",
                "source": [
                    {
                        "name": "trio_errors"
                    }
                ],
                "meta": {
                    "global": true,
                    "type": "parameter"
                },
                "run_data": {
                    "type": "input",
                    "value": [
                        "true"
                    ],
                    "meta": [
                        {
                            "ordinal": 1
                        }
                    ]
                }
            },
            {
                "name": "het_hom",
                "source": [
                    {
                        "name": "het_hom"
                    }
                ],
                "meta": {
                    "global": true,
                    "type": "parameter"
                },
                "run_data": {
                    "type": "input",
                    "value": [
                        "false"
                    ],
                    "meta": [
                        {
                            "ordinal": 1
                        }
                    ]
                }
            },
            {
                "name": "ti_tv",
                "source": [
                    {
                        "name": "ti_tv"
                    }
                ],
                "meta": {
                    "global": true,
                    "type": "parameter"
                },
                "run_data": {
                    "type": "input",
                    "value": [
                        "false"
                    ],
                    "meta": [
                        {
                            "ordinal": 1
                        }
                    ]
                }
            }
        ],
        "outputs": []
    },
    {
        "name": "/workflow-runs-awsem/106be8c3-5b02-4809-8205-4b7dae0fc375/",
        "meta": {
            "@id": "/workflow-runs-awsem/106be8c3-5b02-4809-8205-4b7dae0fc375/",
            "workflow": {
                "uuid": "3849ea9c-afbe-4733-8b97-5044dea21e04",
                "status": "in review",
                "display_title": "Run bamsnap - GAPWFBRDS2A1",
                "@type": [
                    "Workflow",
                    "Item"
                ],
                "@id": "/workflows/3849ea9c-afbe-4733-8b97-5044dea21e04/",
                "principals_allowed": {
                    "view": [
                        "editor_for.12a92962-8265-4fc0-b2f8-cf14f05db58b",
                        "group.admin",
                        "group.read-only-admin",
                        "remoteuser.EMBED",
                        "remoteuser.INDEXER"
                    ],
                    "edit": [
                        "editor_for.12a92962-8265-4fc0-b2f8-cf14f05db58b",
                        "group.admin"
                    ]
                }
            },
            "analysis_types": "dummy analysis type"
        },
        "inputs": [
            {
                "name": "input_bams",
                "source": [
                    {
                        "name": "input_bams",
                        "for_file": "/files-processed/GAPFIMIARUOB/"
                    },
                    {
                        "name": "input_bams",
                        "for_file": "/files-processed/GAPFICEE9LEN/"
                    },
                    {
                        "name": "input_bams",
                        "for_file": "/files-processed/GAPFITNHTOZI/"
                    }
                ],
                "meta": {
                    "global": true,
                    "type": "data file"
                },
                "run_data": {
                    "type": "input",
                    "file": [
                        {
                            "href": "/files-processed/GAPFIMIARUOB/@@download/GAPFIMIARUOB.bam",
                            "file_format": {
                                "uuid": "d13d06cf-218e-4f61-aaf0-91f226248b3c",
                                "@type": [
                                    "FileFormat",
                                    "Item"
                                ],
                                "@id": "/file-formats/bam/",
                                "status": "shared",
                                "display_title": "bam",
                                "principals_allowed": {
                                    "view": [
                                        "system.Authenticated"
                                    ],
                                    "edit": [
                                        "group.admin"
                                    ]
                                }
                            },
                            "status": "uploaded",
                            "display_title": "GAPFIMIARUOB.bam",
                            "@id": "/files-processed/GAPFIMIARUOB/",
                            "uuid": "676dd0c1-82c4-41be-9ae7-619ce47e158e",
                            "@type": [
                                "FileProcessed",
                                "File",
                                "Item"
                            ],
                            "file_size": 106616301305,
                            "accession": "GAPFIMIARUOB",
                            "quality_metric": {
                                "overall_quality_status": "PASS",
                                "@type": [
                                    "QualityMetricBamqc",
                                    "QualityMetric",
                                    "Item"
                                ],
                                "status": "shared",
                                "display_title": "QualityMetricBamqc from 2022-04-29",
                                "uuid": "b5978c20-271c-4ac4-8407-8b3fd3c0bb86",
                                "@id": "/quality-metrics-bamqc/b5978c20-271c-4ac4-8407-8b3fd3c0bb86/",
                                "principals_allowed": {
                                    "view": [
                                        "system.Authenticated"
                                    ],
                                    "edit": [
                                        "group.admin"
                                    ]
                                }
                            },
                            "principals_allowed": {
                                "view": [
                                    "editor_for.12a92962-8265-4fc0-b2f8-cf14f05db58b",
                                    "group.admin",
                                    "group.read-only-admin",
                                    "remoteuser.EMBED",
                                    "remoteuser.INDEXER"
                                ],
                                "edit": [
                                    "editor_for.12a92962-8265-4fc0-b2f8-cf14f05db58b",
                                    "group.admin"
                                ]
                            }
                        },
                        {
                            "href": "/files-processed/GAPFICEE9LEN/@@download/GAPFICEE9LEN.bam",
                            "file_format": {
                                "uuid": "d13d06cf-218e-4f61-aaf0-91f226248b3c",
                                "@type": [
                                    "FileFormat",
                                    "Item"
                                ],
                                "@id": "/file-formats/bam/",
                                "status": "shared",
                                "display_title": "bam",
                                "principals_allowed": {
                                    "view": [
                                        "system.Authenticated"
                                    ],
                                    "edit": [
                                        "group.admin"
                                    ]
                                }
                            },
                            "status": "uploaded",
                            "display_title": "GAPFICEE9LEN.bam",
                            "@id": "/files-processed/GAPFICEE9LEN/",
                            "uuid": "6d199319-3719-4a42-8883-365072bc13b3",
                            "@type": [
                                "FileProcessed",
                                "File",
                                "Item"
                            ],
                            "file_size": 104992897560,
                            "accession": "GAPFICEE9LEN",
                            "quality_metric": {
                                "overall_quality_status": "PASS",
                                "@type": [
                                    "QualityMetricBamqc",
                                    "QualityMetric",
                                    "Item"
                                ],
                                "status": "shared",
                                "display_title": "QualityMetricBamqc from 2022-04-29",
                                "uuid": "23408f2f-13ca-49d6-b8bf-162623795dd6",
                                "@id": "/quality-metrics-bamqc/23408f2f-13ca-49d6-b8bf-162623795dd6/",
                                "principals_allowed": {
                                    "view": [
                                        "system.Authenticated"
                                    ],
                                    "edit": [
                                        "group.admin"
                                    ]
                                }
                            },
                            "principals_allowed": {
                                "view": [
                                    "editor_for.12a92962-8265-4fc0-b2f8-cf14f05db58b",
                                    "group.admin",
                                    "group.read-only-admin",
                                    "remoteuser.EMBED",
                                    "remoteuser.INDEXER"
                                ],
                                "edit": [
                                    "editor_for.12a92962-8265-4fc0-b2f8-cf14f05db58b",
                                    "group.admin"
                                ]
                            }
                        },
                        {
                            "href": "/files-processed/GAPFITNHTOZI/@@download/GAPFITNHTOZI.bam",
                            "file_format": {
                                "uuid": "d13d06cf-218e-4f61-aaf0-91f226248b3c",
                                "@type": [
                                    "FileFormat",
                                    "Item"
                                ],
                                "@id": "/file-formats/bam/",
                                "status": "shared",
                                "display_title": "bam",
                                "principals_allowed": {
                                    "view": [
                                        "system.Authenticated"
                                    ],
                                    "edit": [
                                        "group.admin"
                                    ]
                                }
                            },
                            "status": "uploaded",
                            "display_title": "GAPFITNHTOZI.bam",
                            "@id": "/files-processed/GAPFITNHTOZI/",
                            "uuid": "222ce0eb-22f8-40e3-87d5-f2708ad18393",
                            "@type": [
                                "FileProcessed",
                                "File",
                                "Item"
                            ],
                            "file_size": 111610806810,
                            "accession": "GAPFITNHTOZI",
                            "quality_metric": {
                                "overall_quality_status": "PASS",
                                "@type": [
                                    "QualityMetricBamqc",
                                    "QualityMetric",
                                    "Item"
                                ],
                                "status": "shared",
                                "display_title": "QualityMetricBamqc from 2022-04-29",
                                "uuid": "5530ced5-5252-42f2-afde-0d14e30a669b",
                                "@id": "/quality-metrics-bamqc/5530ced5-5252-42f2-afde-0d14e30a669b/",
                                "principals_allowed": {
                                    "view": [
                                        "system.Authenticated"
                                    ],
                                    "edit": [
                                        "group.admin"
                                    ]
                                }
                            },
                            "principals_allowed": {
                                "view": [
                                    "editor_for.12a92962-8265-4fc0-b2f8-cf14f05db58b",
                                    "group.admin",
                                    "group.read-only-admin",
                                    "remoteuser.EMBED",
                                    "remoteuser.INDEXER"
                                ],
                                "edit": [
                                    "editor_for.12a92962-8265-4fc0-b2f8-cf14f05db58b",
                                    "group.admin"
                                ]
                            }
                        }
                    ],
                    "meta": [
                        {
                            "ordinal": 1,
                            "dimension": "0",
                            "workflow_argument_name": "input_bams"
                        },
                        {
                            "ordinal": 2,
                            "dimension": "1",
                            "workflow_argument_name": "input_bams"
                        },
                        {
                            "ordinal": 3,
                            "dimension": "2",
                            "workflow_argument_name": "input_bams"
                        }
                    ]
                }
            },
            {
                "name": "input_vcf",
                "source": [
                    {
                        "name": "vcf",
                        "step": "workflow_hg19lo_hgvsg-check",
                        "for_file": "/files-processed/GAPFIRGHPIDQ/"
                    }
                ],
                "meta": {
                    "global": false,
                    "type": "data file"
                },
                "run_data": {
                    "type": "input",
                    "file": [
                        {
                            "href": "/files-processed/GAPFIRGHPIDQ/@@download/GAPFIRGHPIDQ.vcf.gz",
                            "file_format": {
                                "uuid": "1b8f525f-aecb-4211-9ae5-a2c998b05599",
                                "@type": [
                                    "FileFormat",
                                    "Item"
                                ],
                                "@id": "/file-formats/vcf_gz/",
                                "status": "shared",
                                "display_title": "vcf_gz",
                                "principals_allowed": {
                                    "view": [
                                        "system.Authenticated"
                                    ],
                                    "edit": [
                                        "group.admin"
                                    ]
                                }
                            },
                            "status": "uploaded",
                            "display_title": "GAPFIRGHPIDQ.vcf.gz",
                            "@id": "/files-processed/GAPFIRGHPIDQ/",
                            "uuid": "77ae0d41-f922-4646-bee2-029deaefdf49",
                            "@type": [
                                "FileProcessed",
                                "File",
                                "Item"
                            ],
                            "file_size": 5196340,
                            "accession": "GAPFIRGHPIDQ",
                            "quality_metric": {
                                "overall_quality_status": "PASS",
                                "@type": [
                                    "QualityMetricQclist",
                                    "QualityMetric",
                                    "Item"
                                ],
                                "status": "shared",
                                "display_title": "QualityMetricQclist from 2022-04-30",
                                "uuid": "ac83094c-6bb2-4754-9573-ec6f9dc74ee5",
                                "@id": "/quality-metrics-qclist/ac83094c-6bb2-4754-9573-ec6f9dc74ee5/",
                                "principals_allowed": {
                                    "view": [
                                        "system.Authenticated"
                                    ],
                                    "edit": [
                                        "group.admin"
                                    ]
                                }
                            },
                            "principals_allowed": {
                                "view": [
                                    "editor_for.12a92962-8265-4fc0-b2f8-cf14f05db58b",
                                    "group.admin",
                                    "group.read-only-admin",
                                    "remoteuser.EMBED",
                                    "remoteuser.INDEXER"
                                ],
                                "edit": [
                                    "editor_for.12a92962-8265-4fc0-b2f8-cf14f05db58b",
                                    "group.admin"
                                ]
                            }
                        }
                    ],
                    "meta": [
                        {
                            "ordinal": 1,
                            "dimension": "0",
                            "workflow_argument_name": "input_vcf"
                        }
                    ]
                }
            },
            {
                "name": "ref",
                "source": [
                    {
                        "name": "reference_fa",
                        "for_file": "/files-reference/GAPFIXRDPDK5/"
                    }
                ],
                "meta": {
                    "global": true,
                    "type": "reference file"
                },
                "run_data": {
                    "type": "input",
                    "file": [
                        {
                            "href": "/files-reference/GAPFIXRDPDK5/@@download/GAPFIXRDPDK5.fa",
                            "file_format": {
                                "uuid": "5ced774b-a73e-4d1b-8186-d7fbbde7a3c2",
                                "@type": [
                                    "FileFormat",
                                    "Item"
                                ],
                                "@id": "/file-formats/fa/",
                                "status": "shared",
                                "display_title": "fa",
                                "principals_allowed": {
                                    "view": [
                                        "system.Authenticated"
                                    ],
                                    "edit": [
                                        "group.admin"
                                    ]
                                }
                            },
                            "status": "uploaded",
                            "display_title": "GAPFIXRDPDK5.fa",
                            "@id": "/files-reference/GAPFIXRDPDK5/",
                            "uuid": "1936f246-22e1-45dc-bb5c-9cfd55537fe7",
                            "@type": [
                                "FileReference",
                                "File",
                                "Item"
                            ],
                            "file_size": 3263683042,
                            "accession": "GAPFIXRDPDK5",
                            "principals_allowed": {
                                "view": [
                                    "editor_for.12a92962-8265-4fc0-b2f8-cf14f05db58b",
                                    "group.admin",
                                    "group.read-only-admin",
                                    "remoteuser.EMBED",
                                    "remoteuser.INDEXER"
                                ],
                                "edit": [
                                    "editor_for.12a92962-8265-4fc0-b2f8-cf14f05db58b",
                                    "group.admin"
                                ]
                            }
                        }
                    ],
                    "meta": [
                        {
                            "ordinal": 1,
                            "dimension": "0",
                            "workflow_argument_name": "ref"
                        }
                    ]
                }
            },
            {
                "name": "nproc",
                "source": [
                    {
                        "name": "nproc"
                    }
                ],
                "meta": {
                    "global": true,
                    "type": "parameter"
                },
                "run_data": {
                    "type": "input",
                    "value": [
                        "16"
                    ],
                    "meta": [
                        {
                            "ordinal": 1
                        }
                    ]
                }
            },
            {
                "name": "titles",
                "source": [
                    {
                        "name": "bamsnap_titles"
                    }
                ],
                "meta": {
                    "global": true,
                    "type": "parameter"
                },
                "run_data": {
                    "type": "input",
                    "value": [
                        "[\"NA12879_sample-WGS (proband)\", \"NA12878_sample-WGS (mother)\", \"NA12877_sample-WGS (father)\"]"
                    ],
                    "meta": [
                        {
                            "ordinal": 1
                        }
                    ]
                }
            }
        ],
        "outputs": []
    }
];

export function transformMetaWorkflowRunToSteps (metaWorkflowRunItem) {
    // TODO
    const {
        workflow_runs = [],
        meta_workflow = {},
        input:  mwfrInputList = []
    } = metaWorkflowRunItem;

    const { workflows = [], input: mwfInputList = [] } = meta_workflow;
    const workflowsByName = {};
    workflows.forEach(function(workflow){
        const { name } = workflow;
        workflowsByName[name] = workflow;
    });

    // Combine MWF + MWFR data:
    const combinedMWFRs = workflow_runs.map(function(workflowRun){
        const { name } = workflowRun;
        const workflowForRun = workflowsByName[name];
        return {
            // Deep-copy (or selectively deep copy), else "input" lists/objects from workflow
            // will be shared.
            ...JSON.parse(JSON.stringify(workflowForRun)),
            ...workflowRun
        };
    });



    const allInputsDict = {};
    mwfInputList.forEach(function(inputObject){
        const { argument_name } = inputObject;
        allInputsDict[argument_name] = { ...inputObject };
    });

    mwfrInputList.forEach(function(inputObject){
        const { argument_name } = inputObject;
        allInputsDict[argument_name] = allInputsDict[argument_name] || {};
        Object.assign(allInputsDict[argument_name], inputObject);
    });

    const combinedInputList = Object.keys(allInputsDict).map(function(k){
        return allInputsDict[k];
    });


    combinedInputList.forEach(function(inputObject){
        const {
            argument_name: inputObjectArgName,
            argument_type: inputObjectArgType,
            files: inputObjectFiles = []
        } = inputObject;

        combinedMWFRs.forEach(function(workflowRunObject){
            const {
                input: wfrObjectInputs,
                shard = null
            } = workflowRunObject;
            wfrObjectInputs.forEach(function(wfrObjectInputObject){
                const {
                    source_argument_name: wfrSourceArgName,
                    argument_name: wfrArgName
                } = wfrObjectInputObject;
                const useArgName = wfrSourceArgName || wfrArgName;
                if (useArgName === inputObjectArgName) {
                    if (inputObjectArgType === "file") {
                        wfrObjectInputObject.files = wfrObjectInputObject.files || [];
                        inputObjectFiles.forEach(function(fileObject){
                            const { dimension } = fileObject;
                            if (typeof dimension !== "undefined") {
                                if (dimension === shard) {
                                    wfrObjectInputObject.files.push(fileObject);
                                }
                            } else {
                                wfrObjectInputObject.files.push(fileObject);
                            }
                        });
                    } else if (inputObjectArgType === "parameter") {
                        Object.assign(
                            wfrObjectInputObject,
                            _.omit(inputObject, "argument_name")
                        );
                    }
                }
            });
        });
    });

    console.log("TTTT3", combinedMWFRs);

    const incompleteSteps = combinedMWFRs.map(function(workflowRunObject){
        const {
            name,
            workflow,
            workflow_run: {
                "@id": workflowRunAtID,
                input_files: wfrItemInputFileObjects
            },
            input,
            output = []
        } = workflowRunObject;

        const inputFileObjectsGroupedByArgName = _.groupBy(wfrItemInputFileObjects, "workflow_argument_name");

        const { "@id": workflowAtID } = workflow || {};

        const initialStep = {
            // name,
            "name": workflowRunAtID,
            "meta": {
                "@id": workflowRunAtID,
                workflow,
                "analysis_types": "dummy analysis type",
            },
            "inputs": [],
            "outputs": []
        };


        input.forEach(function(wfrObjectInputObject){
            const {
                argument_name,
                argument_type,
                source: wfrSourceStepName,
                source_argument_name,
                // files = [],
                value
            } = wfrObjectInputObject;

            const filesForThisInput = inputFileObjectsGroupedByArgName[argument_name] || [];

            const initialSource = {
                "name": source_argument_name || argument_name
            };

            if (wfrSourceStepName) {
                // TODO Make it workflow_run @id....
                initialSource.step = wfrSourceStepName;
                // Maybe include later if needed:
                // initialSource.workflow = workflowAtID;
            }

            const initialSourceList = [];
            const filesLen = filesForThisInput.length;
            if (filesLen > 0) {
                filesForThisInput.forEach(function(fileObject){
                    const { value: fileItem } = fileObject;
                    const { "@id": fileAtID } = fileItem || {};
                    initialSourceList.push( { ...initialSource, "for_file": fileAtID } );
                });
            } else {
                initialSourceList.push(initialSource);
            }

            let isReferenceFileInput = false;
            if (filesLen > 0) {
                isReferenceFileInput = _.every(filesForThisInput, function(fileObject){
                    const { value: fileItem } = fileObject;
                    const { "@type": fileAtType } = fileItem || {};
                    return fileAtType.indexOf("FileReference") > -1;
                });
            }

            // const initialSourceList = [ initialSource ];
            // TODO: Add "for_file", subdivide sources per file
            const stepInputObject = {
                "name": argument_name,
                "source": initialSourceList,
                "meta": {
                    "global": !wfrSourceStepName,
                    // "in_path": ???,
                    "type": (
                        // Don't need to set QC or report for input... I think...
                        argument_type === "parameter" ? "parameter"
                            : isReferenceFileInput ? "reference file"
                                : filesLen > 0 ? "data file"
                                    : null
                    ),
                    // "cardinality": // TODO maybe
                },
                "run_data": {
                    "type": "input"
                }
            };

            if (filesLen > 0) {
                stepInputObject.run_data.file = _.pluck(filesForThisInput, "value");
                stepInputObject.run_data.meta = filesForThisInput.map(function({ value, ...remainingProperties }){
                    return remainingProperties;
                });
            } else if (typeof value !== "undefined") {
                stepInputObject.run_data.value = [ value ];
                stepInputObject.run_data.meta = [ { "ordinal": 1 } ];
            }

            initialStep.inputs.push(stepInputObject);
        });


        output.forEach(function(wfrOutputObject){

            const {
                argument_name,
                argument_type,
                source: wfrSourceStepName,
                source_argument_name,
                file,
                value
            } = wfrOutputObject;

            const initialTarget = {
                "name": source_argument_name || argument_name
            };

            const initialTargetList = [];
            if (file) {
                const { "@id": fileAtID } = file || {};
                initialTargetList.push( { ...initialTarget, "for_file": fileAtID } );
            } else {
                initialTargetList.push(initialTarget);
            }

            // TODO handle values other than file...

            const stepOutputObject = {
                "name": argument_name,
                "target": initialTargetList,
                "meta": {
                    // "global": !wfrSourceStepName,
                    // "in_path": ???,
                    "type": (
                        // TODO Check if QC or report for input... I think...
                        // Re-use strategy for determining is reference file from inputs
                        argument_type === "parameter" ? "parameter"
                            : file ? "data file"
                                : null
                    ),
                    // "cardinality": // TODO maybe
                },
                "run_data": {
                    "type": "output"
                }
            };

            if (file) {
                stepOutputObject.run_data.file = [ file ];
                stepOutputObject.run_data.meta = [ { "type": "Output processed file" } ];
            }
            // TODO handle 'value' if needed.

            initialStep.outputs.push(stepOutputObject);

        });

        return initialStep;

    });

    // TODO:
    // Create mirrored "target" with "target step"

    console.log("TTT4", incompleteSteps);

    return incompleteSteps;
}


function MetaWorkflowRunDataTransformer(props){
    const { context, children } = props;
    // TODO: parse context.workflow_runs, context.meta_workflow, context.input, etc...

    const steps = useMemo(function(){
        return transformMetaWorkflowRunToSteps(TEMPORARY_DUMMY_CONTEXT);
    }, [ TEMPORARY_DUMMY_CONTEXT ]);

    return React.cloneElement(children, { steps });
}




export class WorkflowGraphSection extends React.PureComponent {

    constructor(props){
        super(props);
        this.commonGraphProps = this.commonGraphProps.bind(this);
        this.parseAnalysisSteps = this.parseAnalysisSteps.bind(this);
        this.onToggleShowParameters     = _.throttle(this.onToggleShowParameters.bind(this), 1000);
        this.onToggleReferenceFiles     = _.throttle(this.onToggleReferenceFiles.bind(this), 1000);
        this.onChangeRowSpacingType     = _.throttle(this.onChangeRowSpacingType.bind(this), 1000, { trailing : false });

        this.memoized = {
            parseAnalysisSteps : memoize(parseAnalysisSteps),
            checkIfIndirectOrReferenceNodesExist : memoize(checkIfIndirectOrReferenceNodesExist)
        };

        this.state = {
            'showParameters' : false,
            'showReferenceFiles' : false,
            'rowSpacingType' : 'compact',
        };
    }


    parseAnalysisSteps(steps){
        const { showReferenceFiles, showParameters } = this.state;
        const parsingOptions = { showReferenceFiles, showParameters };
        return this.memoized.parseAnalysisSteps(steps, parsingOptions);
    }

    commonGraphProps(){
        const { steps } = this.props;
        const { showParameters, showReferenceFiles, rowSpacingType } = this.state;
        const graphData = this.parseAnalysisSteps(steps);

        // Filter out legend items which aren't relevant for this context.
        const keepItems = ['Input File', 'Output File', 'Input Reference File'];
        if (showParameters){
            keepItems.push('Input Parameter');
        }
        if (showReferenceFiles){
            keepItems.push('Input Reference File');
        }
        keepItems.push('Intermediate File');

        const legendItems = _.pick(WorkflowDetailPane.Legend.defaultProps.items, keepItems);
        const commonGraphProps = commonGraphPropsFromProps({ ...this.props, legendItems });
        return {
            ...commonGraphProps,
            ...graphData,
            rowSpacingType
        };
    }

    onToggleShowParameters(){
        this.setState(function({ showParameters }){
            return { 'showParameters' : !showParameters };
        });
    }

    onToggleReferenceFiles(){
        this.setState(function({ showReferenceFiles }){
            return { 'showReferenceFiles' : !showReferenceFiles };
        });
    }

    onChangeRowSpacingType(eventKey, evt){
        this.setState(function({ rowSpacingType }){
            console.log("TTT", eventKey, rowSpacingType);
            if (eventKey === rowSpacingType) return null;
            return { 'rowSpacingType' : eventKey };
        });
    }

    render(){
        const { rowSpacingType, showParameters, showReferenceFiles } = this.state;
        const { context, mounted, width, steps = [] } = this.props;
        const { anyIndirectPathIONodes, anyReferenceFileNodes } = this.memoized.checkIfIndirectOrReferenceNodesExist(context.steps);

        let body = null;

        if (!Array.isArray(steps)) {
            body = null;
        } else {
            body = <Graph { ...this.commonGraphProps() } />;
        }

        console.log("ROWSPACING", rowSpacingType);

        return (
            <div className="tabview-container-fullscreen-capable workflow-view-container workflow-viewing-detail">
                <h3 className="tab-section-title">
                    <span>Graph</span>
                    <WorkflowGraphSectionControls
                        {..._.pick(this.props, 'context', 'href', 'windowWidth')}
                        showChartType="detail" rowSpacingType={rowSpacingType} showParameters={showParameters}
                        showReferenceFiles={showReferenceFiles}
                        onRowSpacingTypeSelect={this.onChangeRowSpacingType}
                        onToggleShowParameters={this.onToggleShowParameters}
                        onToggleReferenceFiles={this.onToggleReferenceFiles}
                        isReferenceFilesCheckboxDisabled={!anyReferenceFileNodes}
                    />
                </h3>
                <hr className="tab-section-title-horiz-divider"/>
                { body }
            </div>
        );

    }

}

