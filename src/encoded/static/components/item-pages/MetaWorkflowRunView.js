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
                        "@id": "/files-processed/GAPFI9CNINA2/",
                        "status": "uploaded",
                        "display_title": "GAPFI9CNINA2.rck.gz",
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
                "uuid": "d9b35c06-6911-4b67-ac04-395331a98e55",
                "@type": [
                    "WorkflowRunAwsem",
                    "WorkflowRun",
                    "Item"
                ],
                "display_title": "workflow_granite-mpileupCounts v1.0.0 run 2022-04-29 17:10:35.675189",
                "status": "shared",
                "@id": "/workflow-runs-awsem/d9b35c06-6911-4b67-ac04-395331a98e55/",
                "output_files": [
                    {
                        "type": "Output processed file",
                        "value": {
                            "status": "uploaded",
                            "display_title": "GAPFI9CNINA2.rck.gz",
                            "uuid": "90d5572a-3cb5-40bd-8cec-68346c28705b",
                            "file_format": {
                                "@type": [
                                    "FileFormat",
                                    "Item"
                                ],
                                "status": "shared",
                                "display_title": "rck_gz",
                                "uuid": "20d4d3aa-5f1c-4b75-9e25-73f9f370fefa",
                                "@id": "/file-formats/rck_gz/",
                                "principals_allowed": {
                                    "view": [
                                        "system.Authenticated"
                                    ],
                                    "edit": [
                                        "group.admin"
                                    ]
                                }
                            },
                            "file_size": 11922164723,
                            "@id": "/files-processed/GAPFI9CNINA2/",
                            "@type": [
                                "FileProcessed",
                                "File",
                                "Item"
                            ],
                            "workflow_run_inputs": [
                                {
                                    "@type": [
                                        "WorkflowRunAwsem",
                                        "WorkflowRun",
                                        "Item"
                                    ],
                                    "uuid": "6fb5a7f0-2156-49e3-bf42-95f4e8decdde",
                                    "@id": "/workflow-runs-awsem/6fb5a7f0-2156-49e3-bf42-95f4e8decdde/",
                                    "display_title": "workflow_granite-rckTar v1.0.0 run 2022-04-29 21:10:35.118284",
                                    "status": "shared",
                                    "principals_allowed": {
                                        "view": [
                                            "system.Authenticated"
                                        ],
                                        "edit": [
                                            "group.admin"
                                        ]
                                    }
                                }
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
                "input_files": [
                    {
                        "value": {
                            "uuid": "676dd0c1-82c4-41be-9ae7-619ce47e158e",
                            "file_format": {
                                "uuid": "d13d06cf-218e-4f61-aaf0-91f226248b3c",
                                "display_title": "bam",
                                "@type": [
                                    "FileFormat",
                                    "Item"
                                ],
                                "@id": "/file-formats/bam/",
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
                            "display_title": "GAPFIMIARUOB.bam",
                            "file_size": 106616301305,
                            "@type": [
                                "FileProcessed",
                                "File",
                                "Item"
                            ],
                            "@id": "/files-processed/GAPFIMIARUOB/",
                            "status": "uploaded",
                            "workflow_run_outputs": [
                                {
                                    "status": "shared",
                                    "display_title": "workflow_sentieon_dedup-recal v1.0.0 run 2022-04-29 04:25:35.950498",
                                    "@type": [
                                        "WorkflowRunAwsem",
                                        "WorkflowRun",
                                        "Item"
                                    ],
                                    "@id": "/workflow-runs-awsem/784f3f5f-d3cf-432b-8c0f-3dcd957b2042/",
                                    "uuid": "784f3f5f-d3cf-432b-8c0f-3dcd957b2042",
                                    "principals_allowed": {
                                        "view": [
                                            "system.Authenticated"
                                        ],
                                        "edit": [
                                            "group.admin"
                                        ]
                                    }
                                }
                            ],
                            "quality_metric": {
                                "uuid": "b5978c20-271c-4ac4-8407-8b3fd3c0bb86",
                                "overall_quality_status": "PASS",
                                "display_title": "QualityMetricBamqc from 2022-04-29",
                                "@type": [
                                    "QualityMetricBamqc",
                                    "QualityMetric",
                                    "Item"
                                ],
                                "status": "shared",
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
                        "workflow_argument_name": "input_bam"
                    },
                    {
                        "value": {
                            "uuid": "1936f246-22e1-45dc-bb5c-9cfd55537fe7",
                            "file_format": {
                                "uuid": "5ced774b-a73e-4d1b-8186-d7fbbde7a3c2",
                                "display_title": "fa",
                                "@type": [
                                    "FileFormat",
                                    "Item"
                                ],
                                "@id": "/file-formats/fa/",
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
                            "display_title": "GAPFIXRDPDK5.fa",
                            "file_size": 3263683042,
                            "@type": [
                                "FileReference",
                                "File",
                                "Item"
                            ],
                            "@id": "/files-reference/GAPFIXRDPDK5/",
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
                            "uuid": "1c07a3aa-e2a3-498c-b838-15991c4a2f28",
                            "file_format": {
                                "uuid": "0cd4e777-a596-4927-95c8-b07716121aa3",
                                "display_title": "txt",
                                "@type": [
                                    "FileFormat",
                                    "Item"
                                ],
                                "@id": "/file-formats/txt/",
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
                            "display_title": "GAPFIBGEOI72.txt",
                            "file_size": 7603,
                            "@type": [
                                "FileReference",
                                "File",
                                "Item"
                            ],
                            "@id": "/files-reference/GAPFIBGEOI72/",
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
                "parameters": [
                    {
                        "value": "15",
                        "ordinal": 1,
                        "dimension": "0",
                        "workflow_argument_name": "nthreads"
                    }
                ],
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
        {
            "name": "workflow_granite-mpileupCounts",
            "jobid": "AAhwVmgHrjKw",
            "shard": "1",
            "output": [
                {
                    "file": {
                        "@id": "/files-processed/GAPFID5AE9ME/",
                        "status": "uploaded",
                        "display_title": "GAPFID5AE9ME.rck.gz",
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
                "uuid": "8bca34d8-54c4-4de8-9057-ffb868d44795",
                "@type": [
                    "WorkflowRunAwsem",
                    "WorkflowRun",
                    "Item"
                ],
                "display_title": "workflow_granite-mpileupCounts v1.0.0 run 2022-04-29 17:10:38.581075",
                "status": "shared",
                "@id": "/workflow-runs-awsem/8bca34d8-54c4-4de8-9057-ffb868d44795/",
                "output_files": [
                    {
                        "type": "Output processed file",
                        "value": {
                            "status": "uploaded",
                            "display_title": "GAPFID5AE9ME.rck.gz",
                            "uuid": "76111407-5e86-48dd-bd13-f3a167638140",
                            "file_format": {
                                "@type": [
                                    "FileFormat",
                                    "Item"
                                ],
                                "status": "shared",
                                "display_title": "rck_gz",
                                "uuid": "20d4d3aa-5f1c-4b75-9e25-73f9f370fefa",
                                "@id": "/file-formats/rck_gz/",
                                "principals_allowed": {
                                    "view": [
                                        "system.Authenticated"
                                    ],
                                    "edit": [
                                        "group.admin"
                                    ]
                                }
                            },
                            "file_size": 11874191792,
                            "@id": "/files-processed/GAPFID5AE9ME/",
                            "@type": [
                                "FileProcessed",
                                "File",
                                "Item"
                            ],
                            "workflow_run_inputs": [
                                {
                                    "@type": [
                                        "WorkflowRunAwsem",
                                        "WorkflowRun",
                                        "Item"
                                    ],
                                    "uuid": "6fb5a7f0-2156-49e3-bf42-95f4e8decdde",
                                    "@id": "/workflow-runs-awsem/6fb5a7f0-2156-49e3-bf42-95f4e8decdde/",
                                    "display_title": "workflow_granite-rckTar v1.0.0 run 2022-04-29 21:10:35.118284",
                                    "status": "shared",
                                    "principals_allowed": {
                                        "view": [
                                            "system.Authenticated"
                                        ],
                                        "edit": [
                                            "group.admin"
                                        ]
                                    }
                                }
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
                "input_files": [
                    {
                        "value": {
                            "uuid": "6d199319-3719-4a42-8883-365072bc13b3",
                            "file_format": {
                                "uuid": "d13d06cf-218e-4f61-aaf0-91f226248b3c",
                                "display_title": "bam",
                                "@type": [
                                    "FileFormat",
                                    "Item"
                                ],
                                "@id": "/file-formats/bam/",
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
                            "display_title": "GAPFICEE9LEN.bam",
                            "file_size": 104992897560,
                            "@type": [
                                "FileProcessed",
                                "File",
                                "Item"
                            ],
                            "@id": "/files-processed/GAPFICEE9LEN/",
                            "status": "uploaded",
                            "workflow_run_outputs": [
                                {
                                    "status": "shared",
                                    "display_title": "workflow_sentieon_dedup-recal v1.0.0 run 2022-04-29 04:25:39.481922",
                                    "@type": [
                                        "WorkflowRunAwsem",
                                        "WorkflowRun",
                                        "Item"
                                    ],
                                    "@id": "/workflow-runs-awsem/25d04009-a2fe-481b-ada7-da5c1216d52e/",
                                    "uuid": "25d04009-a2fe-481b-ada7-da5c1216d52e",
                                    "principals_allowed": {
                                        "view": [
                                            "system.Authenticated"
                                        ],
                                        "edit": [
                                            "group.admin"
                                        ]
                                    }
                                }
                            ],
                            "quality_metric": {
                                "uuid": "23408f2f-13ca-49d6-b8bf-162623795dd6",
                                "overall_quality_status": "PASS",
                                "display_title": "QualityMetricBamqc from 2022-04-29",
                                "@type": [
                                    "QualityMetricBamqc",
                                    "QualityMetric",
                                    "Item"
                                ],
                                "status": "shared",
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
                            "uuid": "1936f246-22e1-45dc-bb5c-9cfd55537fe7",
                            "file_format": {
                                "uuid": "5ced774b-a73e-4d1b-8186-d7fbbde7a3c2",
                                "display_title": "fa",
                                "@type": [
                                    "FileFormat",
                                    "Item"
                                ],
                                "@id": "/file-formats/fa/",
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
                            "display_title": "GAPFIXRDPDK5.fa",
                            "file_size": 3263683042,
                            "@type": [
                                "FileReference",
                                "File",
                                "Item"
                            ],
                            "@id": "/files-reference/GAPFIXRDPDK5/",
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
                            "uuid": "1c07a3aa-e2a3-498c-b838-15991c4a2f28",
                            "file_format": {
                                "uuid": "0cd4e777-a596-4927-95c8-b07716121aa3",
                                "display_title": "txt",
                                "@type": [
                                    "FileFormat",
                                    "Item"
                                ],
                                "@id": "/file-formats/txt/",
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
                            "display_title": "GAPFIBGEOI72.txt",
                            "file_size": 7603,
                            "@type": [
                                "FileReference",
                                "File",
                                "Item"
                            ],
                            "@id": "/files-reference/GAPFIBGEOI72/",
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
                "parameters": [
                    {
                        "value": "15",
                        "ordinal": 1,
                        "dimension": "0",
                        "workflow_argument_name": "nthreads"
                    }
                ],
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
        {
            "name": "workflow_granite-mpileupCounts",
            "jobid": "vqBh5nx47BKk",
            "shard": "2",
            "output": [
                {
                    "file": {
                        "@id": "/files-processed/GAPFI5T4QIBP/",
                        "status": "uploaded",
                        "display_title": "GAPFI5T4QIBP.rck.gz",
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
                "uuid": "e93fc945-f186-41e0-a0c3-b19a007ce81c",
                "@type": [
                    "WorkflowRunAwsem",
                    "WorkflowRun",
                    "Item"
                ],
                "display_title": "workflow_granite-mpileupCounts v1.0.0 run 2022-04-29 17:10:45.405166",
                "status": "shared",
                "@id": "/workflow-runs-awsem/e93fc945-f186-41e0-a0c3-b19a007ce81c/",
                "output_files": [
                    {
                        "type": "Output processed file",
                        "value": {
                            "status": "uploaded",
                            "display_title": "GAPFI5T4QIBP.rck.gz",
                            "uuid": "87e8832d-9ece-439a-8602-152b1ee74b0f",
                            "file_format": {
                                "@type": [
                                    "FileFormat",
                                    "Item"
                                ],
                                "status": "shared",
                                "display_title": "rck_gz",
                                "uuid": "20d4d3aa-5f1c-4b75-9e25-73f9f370fefa",
                                "@id": "/file-formats/rck_gz/",
                                "principals_allowed": {
                                    "view": [
                                        "system.Authenticated"
                                    ],
                                    "edit": [
                                        "group.admin"
                                    ]
                                }
                            },
                            "file_size": 12086253767,
                            "@id": "/files-processed/GAPFI5T4QIBP/",
                            "@type": [
                                "FileProcessed",
                                "File",
                                "Item"
                            ],
                            "workflow_run_inputs": [
                                {
                                    "@type": [
                                        "WorkflowRunAwsem",
                                        "WorkflowRun",
                                        "Item"
                                    ],
                                    "uuid": "6fb5a7f0-2156-49e3-bf42-95f4e8decdde",
                                    "@id": "/workflow-runs-awsem/6fb5a7f0-2156-49e3-bf42-95f4e8decdde/",
                                    "display_title": "workflow_granite-rckTar v1.0.0 run 2022-04-29 21:10:35.118284",
                                    "status": "shared",
                                    "principals_allowed": {
                                        "view": [
                                            "system.Authenticated"
                                        ],
                                        "edit": [
                                            "group.admin"
                                        ]
                                    }
                                }
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
                "input_files": [
                    {
                        "value": {
                            "uuid": "222ce0eb-22f8-40e3-87d5-f2708ad18393",
                            "file_format": {
                                "uuid": "d13d06cf-218e-4f61-aaf0-91f226248b3c",
                                "display_title": "bam",
                                "@type": [
                                    "FileFormat",
                                    "Item"
                                ],
                                "@id": "/file-formats/bam/",
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
                            "display_title": "GAPFITNHTOZI.bam",
                            "file_size": 111610806810,
                            "@type": [
                                "FileProcessed",
                                "File",
                                "Item"
                            ],
                            "@id": "/files-processed/GAPFITNHTOZI/",
                            "status": "uploaded",
                            "workflow_run_outputs": [
                                {
                                    "status": "shared",
                                    "display_title": "workflow_sentieon_dedup-recal v1.0.0 run 2022-04-29 04:25:46.368031",
                                    "@type": [
                                        "WorkflowRunAwsem",
                                        "WorkflowRun",
                                        "Item"
                                    ],
                                    "@id": "/workflow-runs-awsem/d4b58584-ecc6-41ad-a0ce-81d4b600b033/",
                                    "uuid": "d4b58584-ecc6-41ad-a0ce-81d4b600b033",
                                    "principals_allowed": {
                                        "view": [
                                            "system.Authenticated"
                                        ],
                                        "edit": [
                                            "group.admin"
                                        ]
                                    }
                                }
                            ],
                            "quality_metric": {
                                "uuid": "5530ced5-5252-42f2-afde-0d14e30a669b",
                                "overall_quality_status": "PASS",
                                "display_title": "QualityMetricBamqc from 2022-04-29",
                                "@type": [
                                    "QualityMetricBamqc",
                                    "QualityMetric",
                                    "Item"
                                ],
                                "status": "shared",
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
                        "ordinal": 1,
                        "dimension": "0",
                        "workflow_argument_name": "input_bam"
                    },
                    {
                        "value": {
                            "uuid": "1936f246-22e1-45dc-bb5c-9cfd55537fe7",
                            "file_format": {
                                "uuid": "5ced774b-a73e-4d1b-8186-d7fbbde7a3c2",
                                "display_title": "fa",
                                "@type": [
                                    "FileFormat",
                                    "Item"
                                ],
                                "@id": "/file-formats/fa/",
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
                            "display_title": "GAPFIXRDPDK5.fa",
                            "file_size": 3263683042,
                            "@type": [
                                "FileReference",
                                "File",
                                "Item"
                            ],
                            "@id": "/files-reference/GAPFIXRDPDK5/",
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
                            "uuid": "1c07a3aa-e2a3-498c-b838-15991c4a2f28",
                            "file_format": {
                                "uuid": "0cd4e777-a596-4927-95c8-b07716121aa3",
                                "display_title": "txt",
                                "@type": [
                                    "FileFormat",
                                    "Item"
                                ],
                                "@id": "/file-formats/txt/",
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
                            "display_title": "GAPFIBGEOI72.txt",
                            "file_size": 7603,
                            "@type": [
                                "FileReference",
                                "File",
                                "Item"
                            ],
                            "@id": "/files-reference/GAPFIBGEOI72/",
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
                "parameters": [
                    {
                        "value": "15",
                        "ordinal": 1,
                        "dimension": "0",
                        "workflow_argument_name": "nthreads"
                    }
                ],
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
        {
            "name": "workflow_gatk-HaplotypeCaller",
            "jobid": "jJvXPOKdKSQn",
            "shard": "0",
            "output": [
                {
                    "file": {
                        "@id": "/files-processed/GAPFIH71G455/",
                        "status": "uploaded",
                        "display_title": "GAPFIH71G455.gvcf.gz",
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
                "uuid": "d2063a22-99c7-420e-b179-6daedad12499",
                "@type": [
                    "WorkflowRunAwsem",
                    "WorkflowRun",
                    "Item"
                ],
                "display_title": "workflow_gatk-HaplotypeCaller v1.0.0 run 2022-04-29 17:10:52.092723",
                "status": "shared",
                "@id": "/workflow-runs-awsem/d2063a22-99c7-420e-b179-6daedad12499/",
                "output_files": [
                    {
                        "type": "Output processed file",
                        "value": {
                            "status": "uploaded",
                            "display_title": "GAPFIH71G455.gvcf.gz",
                            "uuid": "1e51aea4-7fc1-4936-852a-83fbae9f34ff",
                            "file_format": {
                                "@type": [
                                    "FileFormat",
                                    "Item"
                                ],
                                "status": "shared",
                                "display_title": "gvcf_gz",
                                "uuid": "ad47d469-4561-4234-bce2-820f08f58e7c",
                                "@id": "/file-formats/gvcf_gz/",
                                "principals_allowed": {
                                    "view": [
                                        "system.Authenticated"
                                    ],
                                    "edit": [
                                        "group.admin"
                                    ]
                                }
                            },
                            "file_size": 2212472843,
                            "@id": "/files-processed/GAPFIH71G455/",
                            "@type": [
                                "FileProcessed",
                                "File",
                                "Item"
                            ],
                            "workflow_run_inputs": [
                                {
                                    "@type": [
                                        "WorkflowRunAwsem",
                                        "WorkflowRun",
                                        "Item"
                                    ],
                                    "uuid": "59fc114b-ccd6-416d-9555-4d2270c4c3dd",
                                    "@id": "/workflow-runs-awsem/59fc114b-ccd6-416d-9555-4d2270c4c3dd/",
                                    "display_title": "workflow_gatk-CombineGVCFs v1.0.0 run 2022-04-29 19:55:36.043928",
                                    "status": "shared",
                                    "principals_allowed": {
                                        "view": [
                                            "system.Authenticated"
                                        ],
                                        "edit": [
                                            "group.admin"
                                        ]
                                    }
                                }
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
                "input_files": [
                    {
                        "value": {
                            "uuid": "676dd0c1-82c4-41be-9ae7-619ce47e158e",
                            "file_format": {
                                "uuid": "d13d06cf-218e-4f61-aaf0-91f226248b3c",
                                "display_title": "bam",
                                "@type": [
                                    "FileFormat",
                                    "Item"
                                ],
                                "@id": "/file-formats/bam/",
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
                            "display_title": "GAPFIMIARUOB.bam",
                            "file_size": 106616301305,
                            "@type": [
                                "FileProcessed",
                                "File",
                                "Item"
                            ],
                            "@id": "/files-processed/GAPFIMIARUOB/",
                            "status": "uploaded",
                            "workflow_run_outputs": [
                                {
                                    "status": "shared",
                                    "display_title": "workflow_sentieon_dedup-recal v1.0.0 run 2022-04-29 04:25:35.950498",
                                    "@type": [
                                        "WorkflowRunAwsem",
                                        "WorkflowRun",
                                        "Item"
                                    ],
                                    "@id": "/workflow-runs-awsem/784f3f5f-d3cf-432b-8c0f-3dcd957b2042/",
                                    "uuid": "784f3f5f-d3cf-432b-8c0f-3dcd957b2042",
                                    "principals_allowed": {
                                        "view": [
                                            "system.Authenticated"
                                        ],
                                        "edit": [
                                            "group.admin"
                                        ]
                                    }
                                }
                            ],
                            "quality_metric": {
                                "uuid": "b5978c20-271c-4ac4-8407-8b3fd3c0bb86",
                                "overall_quality_status": "PASS",
                                "display_title": "QualityMetricBamqc from 2022-04-29",
                                "@type": [
                                    "QualityMetricBamqc",
                                    "QualityMetric",
                                    "Item"
                                ],
                                "status": "shared",
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
                        "workflow_argument_name": "input_bam"
                    },
                    {
                        "value": {
                            "uuid": "1936f246-22e1-45dc-bb5c-9cfd55537fe7",
                            "file_format": {
                                "uuid": "5ced774b-a73e-4d1b-8186-d7fbbde7a3c2",
                                "display_title": "fa",
                                "@type": [
                                    "FileFormat",
                                    "Item"
                                ],
                                "@id": "/file-formats/fa/",
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
                            "display_title": "GAPFIXRDPDK5.fa",
                            "file_size": 3263683042,
                            "@type": [
                                "FileReference",
                                "File",
                                "Item"
                            ],
                            "@id": "/files-reference/GAPFIXRDPDK5/",
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
                            "uuid": "1c07a3aa-e2a3-498c-b838-15991c4a2f28",
                            "file_format": {
                                "uuid": "0cd4e777-a596-4927-95c8-b07716121aa3",
                                "display_title": "txt",
                                "@type": [
                                    "FileFormat",
                                    "Item"
                                ],
                                "@id": "/file-formats/txt/",
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
                            "display_title": "GAPFIBGEOI72.txt",
                            "file_size": 7603,
                            "@type": [
                                "FileReference",
                                "File",
                                "Item"
                            ],
                            "@id": "/files-reference/GAPFIBGEOI72/",
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
        {
            "name": "workflow_gatk-HaplotypeCaller",
            "jobid": "Ygjei1p00cGa",
            "shard": "1",
            "output": [
                {
                    "file": {
                        "@id": "/files-processed/GAPFIXEYX9Q1/",
                        "status": "uploaded",
                        "display_title": "GAPFIXEYX9Q1.gvcf.gz",
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
                "uuid": "a59335b9-d462-4578-b718-0fc54428cc77",
                "@type": [
                    "WorkflowRunAwsem",
                    "WorkflowRun",
                    "Item"
                ],
                "display_title": "workflow_gatk-HaplotypeCaller v1.0.0 run 2022-04-29 17:10:58.741225",
                "status": "shared",
                "@id": "/workflow-runs-awsem/a59335b9-d462-4578-b718-0fc54428cc77/",
                "output_files": [
                    {
                        "type": "Output processed file",
                        "value": {
                            "status": "uploaded",
                            "display_title": "GAPFIXEYX9Q1.gvcf.gz",
                            "uuid": "1bb89ec3-12cd-46de-bbd7-7ba95db3fec6",
                            "file_format": {
                                "@type": [
                                    "FileFormat",
                                    "Item"
                                ],
                                "status": "shared",
                                "display_title": "gvcf_gz",
                                "uuid": "ad47d469-4561-4234-bce2-820f08f58e7c",
                                "@id": "/file-formats/gvcf_gz/",
                                "principals_allowed": {
                                    "view": [
                                        "system.Authenticated"
                                    ],
                                    "edit": [
                                        "group.admin"
                                    ]
                                }
                            },
                            "file_size": 2200279777,
                            "@id": "/files-processed/GAPFIXEYX9Q1/",
                            "@type": [
                                "FileProcessed",
                                "File",
                                "Item"
                            ],
                            "workflow_run_inputs": [
                                {
                                    "@type": [
                                        "WorkflowRunAwsem",
                                        "WorkflowRun",
                                        "Item"
                                    ],
                                    "uuid": "59fc114b-ccd6-416d-9555-4d2270c4c3dd",
                                    "@id": "/workflow-runs-awsem/59fc114b-ccd6-416d-9555-4d2270c4c3dd/",
                                    "display_title": "workflow_gatk-CombineGVCFs v1.0.0 run 2022-04-29 19:55:36.043928",
                                    "status": "shared",
                                    "principals_allowed": {
                                        "view": [
                                            "system.Authenticated"
                                        ],
                                        "edit": [
                                            "group.admin"
                                        ]
                                    }
                                }
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
                "input_files": [
                    {
                        "value": {
                            "uuid": "6d199319-3719-4a42-8883-365072bc13b3",
                            "file_format": {
                                "uuid": "d13d06cf-218e-4f61-aaf0-91f226248b3c",
                                "display_title": "bam",
                                "@type": [
                                    "FileFormat",
                                    "Item"
                                ],
                                "@id": "/file-formats/bam/",
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
                            "display_title": "GAPFICEE9LEN.bam",
                            "file_size": 104992897560,
                            "@type": [
                                "FileProcessed",
                                "File",
                                "Item"
                            ],
                            "@id": "/files-processed/GAPFICEE9LEN/",
                            "status": "uploaded",
                            "workflow_run_outputs": [
                                {
                                    "status": "shared",
                                    "display_title": "workflow_sentieon_dedup-recal v1.0.0 run 2022-04-29 04:25:39.481922",
                                    "@type": [
                                        "WorkflowRunAwsem",
                                        "WorkflowRun",
                                        "Item"
                                    ],
                                    "@id": "/workflow-runs-awsem/25d04009-a2fe-481b-ada7-da5c1216d52e/",
                                    "uuid": "25d04009-a2fe-481b-ada7-da5c1216d52e",
                                    "principals_allowed": {
                                        "view": [
                                            "system.Authenticated"
                                        ],
                                        "edit": [
                                            "group.admin"
                                        ]
                                    }
                                }
                            ],
                            "quality_metric": {
                                "uuid": "23408f2f-13ca-49d6-b8bf-162623795dd6",
                                "overall_quality_status": "PASS",
                                "display_title": "QualityMetricBamqc from 2022-04-29",
                                "@type": [
                                    "QualityMetricBamqc",
                                    "QualityMetric",
                                    "Item"
                                ],
                                "status": "shared",
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
                            "uuid": "1936f246-22e1-45dc-bb5c-9cfd55537fe7",
                            "file_format": {
                                "uuid": "5ced774b-a73e-4d1b-8186-d7fbbde7a3c2",
                                "display_title": "fa",
                                "@type": [
                                    "FileFormat",
                                    "Item"
                                ],
                                "@id": "/file-formats/fa/",
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
                            "display_title": "GAPFIXRDPDK5.fa",
                            "file_size": 3263683042,
                            "@type": [
                                "FileReference",
                                "File",
                                "Item"
                            ],
                            "@id": "/files-reference/GAPFIXRDPDK5/",
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
                            "uuid": "1c07a3aa-e2a3-498c-b838-15991c4a2f28",
                            "file_format": {
                                "uuid": "0cd4e777-a596-4927-95c8-b07716121aa3",
                                "display_title": "txt",
                                "@type": [
                                    "FileFormat",
                                    "Item"
                                ],
                                "@id": "/file-formats/txt/",
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
                            "display_title": "GAPFIBGEOI72.txt",
                            "file_size": 7603,
                            "@type": [
                                "FileReference",
                                "File",
                                "Item"
                            ],
                            "@id": "/files-reference/GAPFIBGEOI72/",
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
        {
            "name": "workflow_gatk-HaplotypeCaller",
            "jobid": "yqu8bgzcBm7A",
            "shard": "2",
            "output": [
                {
                    "file": {
                        "@id": "/files-processed/GAPFINHTTKUZ/",
                        "status": "uploaded",
                        "display_title": "GAPFINHTTKUZ.gvcf.gz",
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
                "uuid": "3f8e7c4e-254b-4981-81c8-d54821b0676c",
                "@type": [
                    "WorkflowRunAwsem",
                    "WorkflowRun",
                    "Item"
                ],
                "display_title": "workflow_gatk-HaplotypeCaller v1.0.0 run 2022-04-29 17:11:05.391428",
                "status": "shared",
                "@id": "/workflow-runs-awsem/3f8e7c4e-254b-4981-81c8-d54821b0676c/",
                "output_files": [
                    {
                        "type": "Output processed file",
                        "value": {
                            "status": "uploaded",
                            "display_title": "GAPFINHTTKUZ.gvcf.gz",
                            "uuid": "ed25677e-f2d6-4429-b9d2-300a36cff6ed",
                            "file_format": {
                                "@type": [
                                    "FileFormat",
                                    "Item"
                                ],
                                "status": "shared",
                                "display_title": "gvcf_gz",
                                "uuid": "ad47d469-4561-4234-bce2-820f08f58e7c",
                                "@id": "/file-formats/gvcf_gz/",
                                "principals_allowed": {
                                    "view": [
                                        "system.Authenticated"
                                    ],
                                    "edit": [
                                        "group.admin"
                                    ]
                                }
                            },
                            "file_size": 2250854837,
                            "@id": "/files-processed/GAPFINHTTKUZ/",
                            "@type": [
                                "FileProcessed",
                                "File",
                                "Item"
                            ],
                            "workflow_run_inputs": [
                                {
                                    "@type": [
                                        "WorkflowRunAwsem",
                                        "WorkflowRun",
                                        "Item"
                                    ],
                                    "uuid": "59fc114b-ccd6-416d-9555-4d2270c4c3dd",
                                    "@id": "/workflow-runs-awsem/59fc114b-ccd6-416d-9555-4d2270c4c3dd/",
                                    "display_title": "workflow_gatk-CombineGVCFs v1.0.0 run 2022-04-29 19:55:36.043928",
                                    "status": "shared",
                                    "principals_allowed": {
                                        "view": [
                                            "system.Authenticated"
                                        ],
                                        "edit": [
                                            "group.admin"
                                        ]
                                    }
                                }
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
                "input_files": [
                    {
                        "value": {
                            "uuid": "222ce0eb-22f8-40e3-87d5-f2708ad18393",
                            "file_format": {
                                "uuid": "d13d06cf-218e-4f61-aaf0-91f226248b3c",
                                "display_title": "bam",
                                "@type": [
                                    "FileFormat",
                                    "Item"
                                ],
                                "@id": "/file-formats/bam/",
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
                            "display_title": "GAPFITNHTOZI.bam",
                            "file_size": 111610806810,
                            "@type": [
                                "FileProcessed",
                                "File",
                                "Item"
                            ],
                            "@id": "/files-processed/GAPFITNHTOZI/",
                            "status": "uploaded",
                            "workflow_run_outputs": [
                                {
                                    "status": "shared",
                                    "display_title": "workflow_sentieon_dedup-recal v1.0.0 run 2022-04-29 04:25:46.368031",
                                    "@type": [
                                        "WorkflowRunAwsem",
                                        "WorkflowRun",
                                        "Item"
                                    ],
                                    "@id": "/workflow-runs-awsem/d4b58584-ecc6-41ad-a0ce-81d4b600b033/",
                                    "uuid": "d4b58584-ecc6-41ad-a0ce-81d4b600b033",
                                    "principals_allowed": {
                                        "view": [
                                            "system.Authenticated"
                                        ],
                                        "edit": [
                                            "group.admin"
                                        ]
                                    }
                                }
                            ],
                            "quality_metric": {
                                "uuid": "5530ced5-5252-42f2-afde-0d14e30a669b",
                                "overall_quality_status": "PASS",
                                "display_title": "QualityMetricBamqc from 2022-04-29",
                                "@type": [
                                    "QualityMetricBamqc",
                                    "QualityMetric",
                                    "Item"
                                ],
                                "status": "shared",
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
                        "ordinal": 1,
                        "dimension": "0",
                        "workflow_argument_name": "input_bam"
                    },
                    {
                        "value": {
                            "uuid": "1936f246-22e1-45dc-bb5c-9cfd55537fe7",
                            "file_format": {
                                "uuid": "5ced774b-a73e-4d1b-8186-d7fbbde7a3c2",
                                "display_title": "fa",
                                "@type": [
                                    "FileFormat",
                                    "Item"
                                ],
                                "@id": "/file-formats/fa/",
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
                            "display_title": "GAPFIXRDPDK5.fa",
                            "file_size": 3263683042,
                            "@type": [
                                "FileReference",
                                "File",
                                "Item"
                            ],
                            "@id": "/files-reference/GAPFIXRDPDK5/",
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
                            "uuid": "1c07a3aa-e2a3-498c-b838-15991c4a2f28",
                            "file_format": {
                                "uuid": "0cd4e777-a596-4927-95c8-b07716121aa3",
                                "display_title": "txt",
                                "@type": [
                                    "FileFormat",
                                    "Item"
                                ],
                                "@id": "/file-formats/txt/",
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
                            "display_title": "GAPFIBGEOI72.txt",
                            "file_size": 7603,
                            "@type": [
                                "FileReference",
                                "File",
                                "Item"
                            ],
                            "@id": "/files-reference/GAPFIBGEOI72/",
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
        {
            "name": "workflow_granite-rckTar",
            "jobid": "a8o1XfOgCguR",
            "shard": "0",
            "output": [
                {
                    "file": {
                        "@id": "/files-processed/GAPFI7TBYWC7/",
                        "status": "uploaded",
                        "display_title": "GAPFI7TBYWC7.rck.tar",
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
                "uuid": "6fb5a7f0-2156-49e3-bf42-95f4e8decdde",
                "@type": [
                    "WorkflowRunAwsem",
                    "WorkflowRun",
                    "Item"
                ],
                "display_title": "workflow_granite-rckTar v1.0.0 run 2022-04-29 21:10:35.118284",
                "status": "shared",
                "@id": "/workflow-runs-awsem/6fb5a7f0-2156-49e3-bf42-95f4e8decdde/",
                "output_files": [
                    {
                        "type": "Output processed file",
                        "value": {
                            "status": "uploaded",
                            "display_title": "GAPFI7TBYWC7.rck.tar",
                            "uuid": "3e8a17d1-e07f-4226-bd6a-a4ca13606528",
                            "file_format": {
                                "@type": [
                                    "FileFormat",
                                    "Item"
                                ],
                                "status": "shared",
                                "display_title": "rck_tar",
                                "uuid": "39f836d8-bbb1-46c7-80d4-e321d4a44204",
                                "@id": "/file-formats/rck_tar/",
                                "principals_allowed": {
                                    "view": [
                                        "system.Authenticated"
                                    ],
                                    "edit": [
                                        "group.admin"
                                    ]
                                }
                            },
                            "file_size": 35891374080,
                            "@id": "/files-processed/GAPFI7TBYWC7/",
                            "@type": [
                                "FileProcessed",
                                "File",
                                "Item"
                            ],
                            "workflow_run_inputs": [
                                {
                                    "@type": [
                                        "WorkflowRunAwsem",
                                        "WorkflowRun",
                                        "Item"
                                    ],
                                    "uuid": "2160c911-2d1b-466b-9643-ed30c74228a8",
                                    "@id": "/workflow-runs-awsem/2160c911-2d1b-466b-9643-ed30c74228a8/",
                                    "display_title": "workflow_granite-novoCaller-rck-check v1.0.0 run 2022-04-30 02:55:36.042917",
                                    "status": "shared",
                                    "principals_allowed": {
                                        "view": [
                                            "system.Authenticated"
                                        ],
                                        "edit": [
                                            "group.admin"
                                        ]
                                    }
                                }
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
                "input_files": [
                    {
                        "value": {
                            "uuid": "90d5572a-3cb5-40bd-8cec-68346c28705b",
                            "file_format": {
                                "uuid": "20d4d3aa-5f1c-4b75-9e25-73f9f370fefa",
                                "display_title": "rck_gz",
                                "@type": [
                                    "FileFormat",
                                    "Item"
                                ],
                                "@id": "/file-formats/rck_gz/",
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
                            "display_title": "GAPFI9CNINA2.rck.gz",
                            "file_size": 11922164723,
                            "@type": [
                                "FileProcessed",
                                "File",
                                "Item"
                            ],
                            "@id": "/files-processed/GAPFI9CNINA2/",
                            "status": "uploaded",
                            "workflow_run_outputs": [
                                {
                                    "status": "shared",
                                    "display_title": "workflow_granite-mpileupCounts v1.0.0 run 2022-04-29 17:10:35.675189",
                                    "@type": [
                                        "WorkflowRunAwsem",
                                        "WorkflowRun",
                                        "Item"
                                    ],
                                    "@id": "/workflow-runs-awsem/d9b35c06-6911-4b67-ac04-395331a98e55/",
                                    "uuid": "d9b35c06-6911-4b67-ac04-395331a98e55",
                                    "principals_allowed": {
                                        "view": [
                                            "system.Authenticated"
                                        ],
                                        "edit": [
                                            "group.admin"
                                        ]
                                    }
                                }
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
                        "ordinal": 1,
                        "dimension": "0",
                        "workflow_argument_name": "input_rcks"
                    },
                    {
                        "value": {
                            "uuid": "76111407-5e86-48dd-bd13-f3a167638140",
                            "file_format": {
                                "uuid": "20d4d3aa-5f1c-4b75-9e25-73f9f370fefa",
                                "display_title": "rck_gz",
                                "@type": [
                                    "FileFormat",
                                    "Item"
                                ],
                                "@id": "/file-formats/rck_gz/",
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
                            "display_title": "GAPFID5AE9ME.rck.gz",
                            "file_size": 11874191792,
                            "@type": [
                                "FileProcessed",
                                "File",
                                "Item"
                            ],
                            "@id": "/files-processed/GAPFID5AE9ME/",
                            "status": "uploaded",
                            "workflow_run_outputs": [
                                {
                                    "status": "shared",
                                    "display_title": "workflow_granite-mpileupCounts v1.0.0 run 2022-04-29 17:10:38.581075",
                                    "@type": [
                                        "WorkflowRunAwsem",
                                        "WorkflowRun",
                                        "Item"
                                    ],
                                    "@id": "/workflow-runs-awsem/8bca34d8-54c4-4de8-9057-ffb868d44795/",
                                    "uuid": "8bca34d8-54c4-4de8-9057-ffb868d44795",
                                    "principals_allowed": {
                                        "view": [
                                            "system.Authenticated"
                                        ],
                                        "edit": [
                                            "group.admin"
                                        ]
                                    }
                                }
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
                        "ordinal": 2,
                        "dimension": "1",
                        "workflow_argument_name": "input_rcks"
                    },
                    {
                        "value": {
                            "uuid": "87e8832d-9ece-439a-8602-152b1ee74b0f",
                            "file_format": {
                                "uuid": "20d4d3aa-5f1c-4b75-9e25-73f9f370fefa",
                                "display_title": "rck_gz",
                                "@type": [
                                    "FileFormat",
                                    "Item"
                                ],
                                "@id": "/file-formats/rck_gz/",
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
                            "display_title": "GAPFI5T4QIBP.rck.gz",
                            "file_size": 12086253767,
                            "@type": [
                                "FileProcessed",
                                "File",
                                "Item"
                            ],
                            "@id": "/files-processed/GAPFI5T4QIBP/",
                            "status": "uploaded",
                            "workflow_run_outputs": [
                                {
                                    "status": "shared",
                                    "display_title": "workflow_granite-mpileupCounts v1.0.0 run 2022-04-29 17:10:45.405166",
                                    "@type": [
                                        "WorkflowRunAwsem",
                                        "WorkflowRun",
                                        "Item"
                                    ],
                                    "@id": "/workflow-runs-awsem/e93fc945-f186-41e0-a0c3-b19a007ce81c/",
                                    "uuid": "e93fc945-f186-41e0-a0c3-b19a007ce81c",
                                    "principals_allowed": {
                                        "view": [
                                            "system.Authenticated"
                                        ],
                                        "edit": [
                                            "group.admin"
                                        ]
                                    }
                                }
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
                        "ordinal": 3,
                        "dimension": "2",
                        "workflow_argument_name": "input_rcks"
                    }
                ],
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
        {
            "name": "workflow_gatk-CombineGVCFs",
            "jobid": "vWf0ouS1uBzP",
            "shard": "0",
            "output": [
                {
                    "file": {
                        "@id": "/files-processed/GAPFI4589EXS/",
                        "status": "uploaded",
                        "display_title": "GAPFI4589EXS.gvcf.gz",
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
                "uuid": "59fc114b-ccd6-416d-9555-4d2270c4c3dd",
                "@type": [
                    "WorkflowRunAwsem",
                    "WorkflowRun",
                    "Item"
                ],
                "display_title": "workflow_gatk-CombineGVCFs v1.0.0 run 2022-04-29 19:55:36.043928",
                "status": "shared",
                "@id": "/workflow-runs-awsem/59fc114b-ccd6-416d-9555-4d2270c4c3dd/",
                "output_files": [
                    {
                        "type": "Output processed file",
                        "value": {
                            "status": "uploaded",
                            "display_title": "GAPFI4589EXS.gvcf.gz",
                            "uuid": "2021801b-9f49-4fc9-9e86-9b8046edd5e9",
                            "file_format": {
                                "@type": [
                                    "FileFormat",
                                    "Item"
                                ],
                                "status": "shared",
                                "display_title": "gvcf_gz",
                                "uuid": "ad47d469-4561-4234-bce2-820f08f58e7c",
                                "@id": "/file-formats/gvcf_gz/",
                                "principals_allowed": {
                                    "view": [
                                        "system.Authenticated"
                                    ],
                                    "edit": [
                                        "group.admin"
                                    ]
                                }
                            },
                            "file_size": 6071718531,
                            "@id": "/files-processed/GAPFI4589EXS/",
                            "@type": [
                                "FileProcessed",
                                "File",
                                "Item"
                            ],
                            "workflow_run_inputs": [
                                {
                                    "@type": [
                                        "WorkflowRunAwsem",
                                        "WorkflowRun",
                                        "Item"
                                    ],
                                    "uuid": "3e3530ef-c67d-4708-be5f-84349f49b182",
                                    "@id": "/workflow-runs-awsem/3e3530ef-c67d-4708-be5f-84349f49b182/",
                                    "display_title": "workflow_gatk-GenotypeGVCFs-check v1.0.0 run 2022-04-29 21:10:40.235957",
                                    "status": "shared",
                                    "principals_allowed": {
                                        "view": [
                                            "system.Authenticated"
                                        ],
                                        "edit": [
                                            "group.admin"
                                        ]
                                    }
                                }
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
                "input_files": [
                    {
                        "value": {
                            "uuid": "1e51aea4-7fc1-4936-852a-83fbae9f34ff",
                            "file_format": {
                                "uuid": "ad47d469-4561-4234-bce2-820f08f58e7c",
                                "display_title": "gvcf_gz",
                                "@type": [
                                    "FileFormat",
                                    "Item"
                                ],
                                "@id": "/file-formats/gvcf_gz/",
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
                            "display_title": "GAPFIH71G455.gvcf.gz",
                            "file_size": 2212472843,
                            "@type": [
                                "FileProcessed",
                                "File",
                                "Item"
                            ],
                            "@id": "/files-processed/GAPFIH71G455/",
                            "status": "uploaded",
                            "workflow_run_outputs": [
                                {
                                    "status": "shared",
                                    "display_title": "workflow_gatk-HaplotypeCaller v1.0.0 run 2022-04-29 17:10:52.092723",
                                    "@type": [
                                        "WorkflowRunAwsem",
                                        "WorkflowRun",
                                        "Item"
                                    ],
                                    "@id": "/workflow-runs-awsem/d2063a22-99c7-420e-b179-6daedad12499/",
                                    "uuid": "d2063a22-99c7-420e-b179-6daedad12499",
                                    "principals_allowed": {
                                        "view": [
                                            "system.Authenticated"
                                        ],
                                        "edit": [
                                            "group.admin"
                                        ]
                                    }
                                }
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
                        "ordinal": 1,
                        "dimension": "0",
                        "workflow_argument_name": "input_gvcfs"
                    },
                    {
                        "value": {
                            "uuid": "1bb89ec3-12cd-46de-bbd7-7ba95db3fec6",
                            "file_format": {
                                "uuid": "ad47d469-4561-4234-bce2-820f08f58e7c",
                                "display_title": "gvcf_gz",
                                "@type": [
                                    "FileFormat",
                                    "Item"
                                ],
                                "@id": "/file-formats/gvcf_gz/",
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
                            "display_title": "GAPFIXEYX9Q1.gvcf.gz",
                            "file_size": 2200279777,
                            "@type": [
                                "FileProcessed",
                                "File",
                                "Item"
                            ],
                            "@id": "/files-processed/GAPFIXEYX9Q1/",
                            "status": "uploaded",
                            "workflow_run_outputs": [
                                {
                                    "status": "shared",
                                    "display_title": "workflow_gatk-HaplotypeCaller v1.0.0 run 2022-04-29 17:10:58.741225",
                                    "@type": [
                                        "WorkflowRunAwsem",
                                        "WorkflowRun",
                                        "Item"
                                    ],
                                    "@id": "/workflow-runs-awsem/a59335b9-d462-4578-b718-0fc54428cc77/",
                                    "uuid": "a59335b9-d462-4578-b718-0fc54428cc77",
                                    "principals_allowed": {
                                        "view": [
                                            "system.Authenticated"
                                        ],
                                        "edit": [
                                            "group.admin"
                                        ]
                                    }
                                }
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
                        "ordinal": 2,
                        "dimension": "1",
                        "workflow_argument_name": "input_gvcfs"
                    },
                    {
                        "value": {
                            "uuid": "ed25677e-f2d6-4429-b9d2-300a36cff6ed",
                            "file_format": {
                                "uuid": "ad47d469-4561-4234-bce2-820f08f58e7c",
                                "display_title": "gvcf_gz",
                                "@type": [
                                    "FileFormat",
                                    "Item"
                                ],
                                "@id": "/file-formats/gvcf_gz/",
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
                            "display_title": "GAPFINHTTKUZ.gvcf.gz",
                            "file_size": 2250854837,
                            "@type": [
                                "FileProcessed",
                                "File",
                                "Item"
                            ],
                            "@id": "/files-processed/GAPFINHTTKUZ/",
                            "status": "uploaded",
                            "workflow_run_outputs": [
                                {
                                    "status": "shared",
                                    "display_title": "workflow_gatk-HaplotypeCaller v1.0.0 run 2022-04-29 17:11:05.391428",
                                    "@type": [
                                        "WorkflowRunAwsem",
                                        "WorkflowRun",
                                        "Item"
                                    ],
                                    "@id": "/workflow-runs-awsem/3f8e7c4e-254b-4981-81c8-d54821b0676c/",
                                    "uuid": "3f8e7c4e-254b-4981-81c8-d54821b0676c",
                                    "principals_allowed": {
                                        "view": [
                                            "system.Authenticated"
                                        ],
                                        "edit": [
                                            "group.admin"
                                        ]
                                    }
                                }
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
                        "ordinal": 3,
                        "dimension": "2",
                        "workflow_argument_name": "input_gvcfs"
                    },
                    {
                        "value": {
                            "uuid": "1936f246-22e1-45dc-bb5c-9cfd55537fe7",
                            "file_format": {
                                "uuid": "5ced774b-a73e-4d1b-8186-d7fbbde7a3c2",
                                "display_title": "fa",
                                "@type": [
                                    "FileFormat",
                                    "Item"
                                ],
                                "@id": "/file-formats/fa/",
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
                            "display_title": "GAPFIXRDPDK5.fa",
                            "file_size": 3263683042,
                            "@type": [
                                "FileReference",
                                "File",
                                "Item"
                            ],
                            "@id": "/files-reference/GAPFIXRDPDK5/",
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
                            "uuid": "a1d504ee-a313-4064-b6ae-65fed9738980",
                            "file_format": {
                                "uuid": "0cd4e777-a596-4927-95c8-b07716121aa3",
                                "display_title": "txt",
                                "@type": [
                                    "FileFormat",
                                    "Item"
                                ],
                                "@id": "/file-formats/txt/",
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
                            "display_title": "GAPFIGJVJDUY.txt",
                            "file_size": 138,
                            "@type": [
                                "FileReference",
                                "File",
                                "Item"
                            ],
                            "@id": "/files-reference/GAPFIGJVJDUY/",
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
                        "workflow_argument_name": "chromosomes"
                    }
                ],
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
        {
            "name": "workflow_gatk-GenotypeGVCFs-check",
            "jobid": "yuiDWe4W2Wmr",
            "shard": "0",
            "output": [
                {
                    "file": {
                        "@id": "/files-processed/GAPFI6J5MLR9/",
                        "status": "uploaded",
                        "display_title": "GAPFI6J5MLR9.vcf.gz",
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
                "uuid": "3e3530ef-c67d-4708-be5f-84349f49b182",
                "@type": [
                    "WorkflowRunAwsem",
                    "WorkflowRun",
                    "Item"
                ],
                "display_title": "workflow_gatk-GenotypeGVCFs-check v1.0.0 run 2022-04-29 21:10:40.235957",
                "status": "shared",
                "@id": "/workflow-runs-awsem/3e3530ef-c67d-4708-be5f-84349f49b182/",
                "output_files": [
                    {
                        "type": "Output processed file",
                        "value": {
                            "status": "uploaded",
                            "display_title": "GAPFI6J5MLR9.vcf.gz",
                            "uuid": "a6c9f1f0-e52a-4c3b-bc91-047462bf4d88",
                            "file_format": {
                                "@type": [
                                    "FileFormat",
                                    "Item"
                                ],
                                "status": "shared",
                                "display_title": "vcf_gz",
                                "uuid": "1b8f525f-aecb-4211-9ae5-a2c998b05599",
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
                            "file_size": 449938897,
                            "@id": "/files-processed/GAPFI6J5MLR9/",
                            "@type": [
                                "FileProcessed",
                                "File",
                                "Item"
                            ],
                            "quality_metric": {
                                "uuid": "ede965e7-0c0f-4f7b-b7f8-2d47c2dbe36b",
                                "@type": [
                                    "QualityMetricQclist",
                                    "QualityMetric",
                                    "Item"
                                ],
                                "display_title": "QualityMetricQclist from 2022-04-29",
                                "@id": "/quality-metrics-qclist/ede965e7-0c0f-4f7b-b7f8-2d47c2dbe36b/",
                                "overall_quality_status": "PASS",
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
                            "workflow_run_inputs": [
                                {
                                    "@type": [
                                        "WorkflowRunAwsem",
                                        "WorkflowRun",
                                        "Item"
                                    ],
                                    "uuid": "6aea60a0-18c8-4e4d-9a1c-fd993346baf2",
                                    "@id": "/workflow-runs-awsem/6aea60a0-18c8-4e4d-9a1c-fd993346baf2/",
                                    "display_title": "workflow_samplegeno v1.0.0 run 2022-04-29 22:10:36.226203",
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
                                {
                                    "@type": [
                                        "WorkflowRunAwsem",
                                        "WorkflowRun",
                                        "Item"
                                    ],
                                    "uuid": "bf1f8c90-5f99-435f-85c9-52ac471de600",
                                    "@id": "/workflow-runs-awsem/bf1f8c90-5f99-435f-85c9-52ac471de600/",
                                    "display_title": "workflow_granite-qcVCF v1.0.0 run 2022-04-29 22:10:39.971610",
                                    "status": "shared",
                                    "principals_allowed": {
                                        "view": [
                                            "system.Authenticated"
                                        ],
                                        "edit": [
                                            "group.admin"
                                        ]
                                    }
                                }
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
                        "value_qc": "/quality-metrics-vcfcheck/3b0bfae1-55ca-4330-b1d2-2aefbc026767/",
                        "workflow_argument_name": "vcf-check"
                    }
                ],
                "input_files": [
                    {
                        "value": {
                            "uuid": "2021801b-9f49-4fc9-9e86-9b8046edd5e9",
                            "file_format": {
                                "uuid": "ad47d469-4561-4234-bce2-820f08f58e7c",
                                "display_title": "gvcf_gz",
                                "@type": [
                                    "FileFormat",
                                    "Item"
                                ],
                                "@id": "/file-formats/gvcf_gz/",
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
                            "display_title": "GAPFI4589EXS.gvcf.gz",
                            "file_size": 6071718531,
                            "@type": [
                                "FileProcessed",
                                "File",
                                "Item"
                            ],
                            "@id": "/files-processed/GAPFI4589EXS/",
                            "status": "uploaded",
                            "workflow_run_outputs": [
                                {
                                    "status": "shared",
                                    "display_title": "workflow_gatk-CombineGVCFs v1.0.0 run 2022-04-29 19:55:36.043928",
                                    "@type": [
                                        "WorkflowRunAwsem",
                                        "WorkflowRun",
                                        "Item"
                                    ],
                                    "@id": "/workflow-runs-awsem/59fc114b-ccd6-416d-9555-4d2270c4c3dd/",
                                    "uuid": "59fc114b-ccd6-416d-9555-4d2270c4c3dd",
                                    "principals_allowed": {
                                        "view": [
                                            "system.Authenticated"
                                        ],
                                        "edit": [
                                            "group.admin"
                                        ]
                                    }
                                }
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
                        "ordinal": 1,
                        "dimension": "0",
                        "workflow_argument_name": "input_gvcf"
                    },
                    {
                        "value": {
                            "uuid": "1936f246-22e1-45dc-bb5c-9cfd55537fe7",
                            "file_format": {
                                "uuid": "5ced774b-a73e-4d1b-8186-d7fbbde7a3c2",
                                "display_title": "fa",
                                "@type": [
                                    "FileFormat",
                                    "Item"
                                ],
                                "@id": "/file-formats/fa/",
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
                            "display_title": "GAPFIXRDPDK5.fa",
                            "file_size": 3263683042,
                            "@type": [
                                "FileReference",
                                "File",
                                "Item"
                            ],
                            "@id": "/files-reference/GAPFIXRDPDK5/",
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
                            "uuid": "a1d504ee-a313-4064-b6ae-65fed9738980",
                            "file_format": {
                                "uuid": "0cd4e777-a596-4927-95c8-b07716121aa3",
                                "display_title": "txt",
                                "@type": [
                                    "FileFormat",
                                    "Item"
                                ],
                                "@id": "/file-formats/txt/",
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
                            "display_title": "GAPFIGJVJDUY.txt",
                            "file_size": 138,
                            "@type": [
                                "FileReference",
                                "File",
                                "Item"
                            ],
                            "@id": "/files-reference/GAPFIGJVJDUY/",
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
                        "workflow_argument_name": "chromosomes"
                    },
                    {
                        "value": {
                            "uuid": "8ed35691-0af4-467a-adbc-81eb088549f0",
                            "file_format": {
                                "uuid": "1b8f525f-aecb-4211-9ae5-a2c998b05599",
                                "display_title": "vcf_gz",
                                "@type": [
                                    "FileFormat",
                                    "Item"
                                ],
                                "@id": "/file-formats/vcf_gz/",
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
                            "display_title": "GAPFI4LJRN98.vcf.gz",
                            "file_size": 1595848625,
                            "@type": [
                                "FileReference",
                                "File",
                                "Item"
                            ],
                            "@id": "/files-reference/GAPFI4LJRN98/",
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
                        "workflow_argument_name": "known-sites-snp"
                    }
                ],
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
        {
            "name": "workflow_samplegeno",
            "jobid": "sng5iNR61xlj",
            "shard": "0",
            "output": [
                {
                    "file": {
                        "@id": "/files-processed/GAPFI68EKBY2/",
                        "status": "uploaded",
                        "display_title": "GAPFI68EKBY2.vcf.gz",
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
                "uuid": "6aea60a0-18c8-4e4d-9a1c-fd993346baf2",
                "@type": [
                    "WorkflowRunAwsem",
                    "WorkflowRun",
                    "Item"
                ],
                "display_title": "workflow_samplegeno v1.0.0 run 2022-04-29 22:10:36.226203",
                "status": "shared",
                "@id": "/workflow-runs-awsem/6aea60a0-18c8-4e4d-9a1c-fd993346baf2/",
                "output_files": [
                    {
                        "type": "Output processed file",
                        "value": {
                            "status": "uploaded",
                            "display_title": "GAPFI68EKBY2.vcf.gz",
                            "uuid": "56c0a779-c771-4a67-acce-f7bbc2707d6e",
                            "file_format": {
                                "@type": [
                                    "FileFormat",
                                    "Item"
                                ],
                                "status": "shared",
                                "display_title": "vcf_gz",
                                "uuid": "1b8f525f-aecb-4211-9ae5-a2c998b05599",
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
                            "file_size": 565028521,
                            "@id": "/files-processed/GAPFI68EKBY2/",
                            "@type": [
                                "FileProcessed",
                                "File",
                                "Item"
                            ],
                            "quality_metric": {
                                "uuid": "367b0795-c6f2-4ce3-85e2-b63f4d1b1b4a",
                                "@type": [
                                    "QualityMetricVcfqc",
                                    "QualityMetric",
                                    "Item"
                                ],
                                "display_title": "QualityMetricVcfqc from 2022-04-29",
                                "@id": "/quality-metrics-vcfqc/367b0795-c6f2-4ce3-85e2-b63f4d1b1b4a/",
                                "overall_quality_status": "PASS",
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
                            "workflow_run_inputs": [
                                {
                                    "@type": [
                                        "WorkflowRunAwsem",
                                        "WorkflowRun",
                                        "Item"
                                    ],
                                    "uuid": "cf4811eb-3f1f-4951-8d84-00a2c7ffe352",
                                    "@id": "/workflow-runs-awsem/cf4811eb-3f1f-4951-8d84-00a2c7ffe352/",
                                    "display_title": "workflow_vep-annot-check v1.0.0 run 2022-04-29 22:40:46.334063",
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
                                {
                                    "@type": [
                                        "WorkflowRunAwsem",
                                        "WorkflowRun",
                                        "Item"
                                    ],
                                    "uuid": "856f03f2-c89b-4291-94a0-6aa036673de0",
                                    "@id": "/workflow-runs-awsem/856f03f2-c89b-4291-94a0-6aa036673de0/",
                                    "display_title": "workflow_granite-qcVCF v1.0.0 run 2022-04-29 22:40:34.865115",
                                    "status": "shared",
                                    "principals_allowed": {
                                        "view": [
                                            "system.Authenticated"
                                        ],
                                        "edit": [
                                            "group.admin"
                                        ]
                                    }
                                }
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
                "input_files": [
                    {
                        "value": {
                            "uuid": "a6c9f1f0-e52a-4c3b-bc91-047462bf4d88",
                            "file_format": {
                                "uuid": "1b8f525f-aecb-4211-9ae5-a2c998b05599",
                                "display_title": "vcf_gz",
                                "@type": [
                                    "FileFormat",
                                    "Item"
                                ],
                                "@id": "/file-formats/vcf_gz/",
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
                            "display_title": "GAPFI6J5MLR9.vcf.gz",
                            "file_size": 449938897,
                            "@type": [
                                "FileProcessed",
                                "File",
                                "Item"
                            ],
                            "@id": "/files-processed/GAPFI6J5MLR9/",
                            "status": "uploaded",
                            "workflow_run_outputs": [
                                {
                                    "status": "shared",
                                    "display_title": "workflow_gatk-GenotypeGVCFs-check v1.0.0 run 2022-04-29 21:10:40.235957",
                                    "@type": [
                                        "WorkflowRunAwsem",
                                        "WorkflowRun",
                                        "Item"
                                    ],
                                    "@id": "/workflow-runs-awsem/3e3530ef-c67d-4708-be5f-84349f49b182/",
                                    "uuid": "3e3530ef-c67d-4708-be5f-84349f49b182",
                                    "principals_allowed": {
                                        "view": [
                                            "system.Authenticated"
                                        ],
                                        "edit": [
                                            "group.admin"
                                        ]
                                    }
                                }
                            ],
                            "quality_metric": {
                                "uuid": "ede965e7-0c0f-4f7b-b7f8-2d47c2dbe36b",
                                "overall_quality_status": "PASS",
                                "display_title": "QualityMetricQclist from 2022-04-29",
                                "@type": [
                                    "QualityMetricQclist",
                                    "QualityMetric",
                                    "Item"
                                ],
                                "status": "shared",
                                "@id": "/quality-metrics-qclist/ede965e7-0c0f-4f7b-b7f8-2d47c2dbe36b/",
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
        {
            "name": "workflow_granite-qcVCF",
            "jobid": "M2ezVrAPnQrw",
            "shard": "0",
            "status": "completed",
            "dependencies": [
                "workflow_gatk-GenotypeGVCFs-check:0"
            ],
            "workflow_run": {
                "uuid": "bf1f8c90-5f99-435f-85c9-52ac471de600",
                "@type": [
                    "WorkflowRunAwsem",
                    "WorkflowRun",
                    "Item"
                ],
                "display_title": "workflow_granite-qcVCF v1.0.0 run 2022-04-29 22:10:39.971610",
                "status": "shared",
                "@id": "/workflow-runs-awsem/bf1f8c90-5f99-435f-85c9-52ac471de600/",
                "output_files": [
                    {
                        "type": "Output QC file",
                        "value_qc": "/quality-metrics-vcfqc/535b02f6-e5ff-4e1b-a4a4-20c2dc135a42/",
                        "workflow_argument_name": "qc_json"
                    },
                    {
                        "type": "Output QC file",
                        "value_qc": "/quality-metrics-vcfqc/535b02f6-e5ff-4e1b-a4a4-20c2dc135a42/",
                        "workflow_argument_name": "uniq_variants"
                    }
                ],
                "input_files": [
                    {
                        "value": {
                            "uuid": "a6c9f1f0-e52a-4c3b-bc91-047462bf4d88",
                            "file_format": {
                                "uuid": "1b8f525f-aecb-4211-9ae5-a2c998b05599",
                                "display_title": "vcf_gz",
                                "@type": [
                                    "FileFormat",
                                    "Item"
                                ],
                                "@id": "/file-formats/vcf_gz/",
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
                            "display_title": "GAPFI6J5MLR9.vcf.gz",
                            "file_size": 449938897,
                            "@type": [
                                "FileProcessed",
                                "File",
                                "Item"
                            ],
                            "@id": "/files-processed/GAPFI6J5MLR9/",
                            "status": "uploaded",
                            "workflow_run_outputs": [
                                {
                                    "status": "shared",
                                    "display_title": "workflow_gatk-GenotypeGVCFs-check v1.0.0 run 2022-04-29 21:10:40.235957",
                                    "@type": [
                                        "WorkflowRunAwsem",
                                        "WorkflowRun",
                                        "Item"
                                    ],
                                    "@id": "/workflow-runs-awsem/3e3530ef-c67d-4708-be5f-84349f49b182/",
                                    "uuid": "3e3530ef-c67d-4708-be5f-84349f49b182",
                                    "principals_allowed": {
                                        "view": [
                                            "system.Authenticated"
                                        ],
                                        "edit": [
                                            "group.admin"
                                        ]
                                    }
                                }
                            ],
                            "quality_metric": {
                                "uuid": "ede965e7-0c0f-4f7b-b7f8-2d47c2dbe36b",
                                "overall_quality_status": "PASS",
                                "display_title": "QualityMetricQclist from 2022-04-29",
                                "@type": [
                                    "QualityMetricQclist",
                                    "QualityMetric",
                                    "Item"
                                ],
                                "status": "shared",
                                "@id": "/quality-metrics-qclist/ede965e7-0c0f-4f7b-b7f8-2d47c2dbe36b/",
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
        {
            "name": "workflow_granite-qcVCF-1",
            "jobid": "R5varE174wYQ",
            "shard": "0",
            "status": "completed",
            "dependencies": [
                "workflow_samplegeno:0"
            ],
            "workflow_run": {
                "uuid": "856f03f2-c89b-4291-94a0-6aa036673de0",
                "@type": [
                    "WorkflowRunAwsem",
                    "WorkflowRun",
                    "Item"
                ],
                "display_title": "workflow_granite-qcVCF v1.0.0 run 2022-04-29 22:40:34.865115",
                "status": "shared",
                "@id": "/workflow-runs-awsem/856f03f2-c89b-4291-94a0-6aa036673de0/",
                "output_files": [
                    {
                        "type": "Output QC file",
                        "value_qc": "/quality-metrics-vcfqc/367b0795-c6f2-4ce3-85e2-b63f4d1b1b4a/",
                        "workflow_argument_name": "qc_json"
                    },
                    {
                        "type": "Output QC file",
                        "value_qc": "/quality-metrics-vcfqc/367b0795-c6f2-4ce3-85e2-b63f4d1b1b4a/",
                        "workflow_argument_name": "uniq_variants"
                    }
                ],
                "input_files": [
                    {
                        "value": {
                            "uuid": "56c0a779-c771-4a67-acce-f7bbc2707d6e",
                            "file_format": {
                                "uuid": "1b8f525f-aecb-4211-9ae5-a2c998b05599",
                                "display_title": "vcf_gz",
                                "@type": [
                                    "FileFormat",
                                    "Item"
                                ],
                                "@id": "/file-formats/vcf_gz/",
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
                            "display_title": "GAPFI68EKBY2.vcf.gz",
                            "file_size": 565028521,
                            "@type": [
                                "FileProcessed",
                                "File",
                                "Item"
                            ],
                            "@id": "/files-processed/GAPFI68EKBY2/",
                            "status": "uploaded",
                            "workflow_run_outputs": [
                                {
                                    "status": "shared",
                                    "display_title": "workflow_samplegeno v1.0.0 run 2022-04-29 22:10:36.226203",
                                    "@type": [
                                        "WorkflowRunAwsem",
                                        "WorkflowRun",
                                        "Item"
                                    ],
                                    "@id": "/workflow-runs-awsem/6aea60a0-18c8-4e4d-9a1c-fd993346baf2/",
                                    "uuid": "6aea60a0-18c8-4e4d-9a1c-fd993346baf2",
                                    "principals_allowed": {
                                        "view": [
                                            "system.Authenticated"
                                        ],
                                        "edit": [
                                            "group.admin"
                                        ]
                                    }
                                }
                            ],
                            "quality_metric": {
                                "uuid": "367b0795-c6f2-4ce3-85e2-b63f4d1b1b4a",
                                "overall_quality_status": "PASS",
                                "display_title": "QualityMetricVcfqc from 2022-04-29",
                                "@type": [
                                    "QualityMetricVcfqc",
                                    "QualityMetric",
                                    "Item"
                                ],
                                "status": "shared",
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
                    }
                ],
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
        {
            "name": "workflow_vep-annot-check",
            "jobid": "QfIHwC079y92",
            "shard": "0",
            "output": [
                {
                    "file": {
                        "@id": "/files-processed/GAPFIACVY8U8/",
                        "status": "uploaded",
                        "display_title": "GAPFIACVY8U8.vcf.gz",
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
                "uuid": "cf4811eb-3f1f-4951-8d84-00a2c7ffe352",
                "@type": [
                    "WorkflowRunAwsem",
                    "WorkflowRun",
                    "Item"
                ],
                "display_title": "workflow_vep-annot-check v1.0.0 run 2022-04-29 22:40:46.334063",
                "status": "shared",
                "@id": "/workflow-runs-awsem/cf4811eb-3f1f-4951-8d84-00a2c7ffe352/",
                "output_files": [
                    {
                        "type": "Output processed file",
                        "value": {
                            "status": "uploaded",
                            "display_title": "GAPFIACVY8U8.vcf.gz",
                            "uuid": "a7809e79-b980-4b7f-9e43-1c2a60959246",
                            "file_format": {
                                "@type": [
                                    "FileFormat",
                                    "Item"
                                ],
                                "status": "shared",
                                "display_title": "vcf_gz",
                                "uuid": "1b8f525f-aecb-4211-9ae5-a2c998b05599",
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
                            "file_size": 2727278155,
                            "@id": "/files-processed/GAPFIACVY8U8/",
                            "@type": [
                                "FileProcessed",
                                "File",
                                "Item"
                            ],
                            "quality_metric": {
                                "uuid": "c9df0265-50c5-4706-9327-86d9f18f8130",
                                "@type": [
                                    "QualityMetricQclist",
                                    "QualityMetric",
                                    "Item"
                                ],
                                "display_title": "QualityMetricQclist from 2022-04-30",
                                "@id": "/quality-metrics-qclist/c9df0265-50c5-4706-9327-86d9f18f8130/",
                                "overall_quality_status": "PASS",
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
                            "workflow_run_inputs": [
                                {
                                    "@type": [
                                        "WorkflowRunAwsem",
                                        "WorkflowRun",
                                        "Item"
                                    ],
                                    "uuid": "58210479-cf6c-40db-8a03-fbd2541be2c2",
                                    "@id": "/workflow-runs-awsem/58210479-cf6c-40db-8a03-fbd2541be2c2/",
                                    "display_title": "workflow_peddy v1.0.0 run 2022-04-30 02:10:35.255342",
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
                                {
                                    "@type": [
                                        "WorkflowRunAwsem",
                                        "WorkflowRun",
                                        "Item"
                                    ],
                                    "uuid": "64a59f36-a856-47e1-be09-d0c6b8694252",
                                    "@id": "/workflow-runs-awsem/64a59f36-a856-47e1-be09-d0c6b8694252/",
                                    "display_title": "workflow_granite-filtering-check v1.0.0 run 2022-04-30 02:10:40.339145",
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
                                {
                                    "@type": [
                                        "WorkflowRunAwsem",
                                        "WorkflowRun",
                                        "Item"
                                    ],
                                    "uuid": "eba22967-9efc-4071-a3df-fa5b55943db8",
                                    "@id": "/workflow-runs-awsem/eba22967-9efc-4071-a3df-fa5b55943db8/",
                                    "display_title": "workflow_granite-qcVCF v1.0.0 run 2022-04-30 02:40:35.197316",
                                    "status": "shared",
                                    "principals_allowed": {
                                        "view": [
                                            "system.Authenticated"
                                        ],
                                        "edit": [
                                            "group.admin"
                                        ]
                                    }
                                }
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
                        "value_qc": "/quality-metrics-vcfcheck/9e5392e5-0804-4db0-87a4-bedecd663a75/",
                        "workflow_argument_name": "annotated_vcf-check"
                    }
                ],
                "input_files": [
                    {
                        "value": {
                            "uuid": "56c0a779-c771-4a67-acce-f7bbc2707d6e",
                            "file_format": {
                                "uuid": "1b8f525f-aecb-4211-9ae5-a2c998b05599",
                                "display_title": "vcf_gz",
                                "@type": [
                                    "FileFormat",
                                    "Item"
                                ],
                                "@id": "/file-formats/vcf_gz/",
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
                            "display_title": "GAPFI68EKBY2.vcf.gz",
                            "file_size": 565028521,
                            "@type": [
                                "FileProcessed",
                                "File",
                                "Item"
                            ],
                            "@id": "/files-processed/GAPFI68EKBY2/",
                            "status": "uploaded",
                            "workflow_run_outputs": [
                                {
                                    "status": "shared",
                                    "display_title": "workflow_samplegeno v1.0.0 run 2022-04-29 22:10:36.226203",
                                    "@type": [
                                        "WorkflowRunAwsem",
                                        "WorkflowRun",
                                        "Item"
                                    ],
                                    "@id": "/workflow-runs-awsem/6aea60a0-18c8-4e4d-9a1c-fd993346baf2/",
                                    "uuid": "6aea60a0-18c8-4e4d-9a1c-fd993346baf2",
                                    "principals_allowed": {
                                        "view": [
                                            "system.Authenticated"
                                        ],
                                        "edit": [
                                            "group.admin"
                                        ]
                                    }
                                }
                            ],
                            "quality_metric": {
                                "uuid": "367b0795-c6f2-4ce3-85e2-b63f4d1b1b4a",
                                "overall_quality_status": "PASS",
                                "display_title": "QualityMetricVcfqc from 2022-04-29",
                                "@type": [
                                    "QualityMetricVcfqc",
                                    "QualityMetric",
                                    "Item"
                                ],
                                "status": "shared",
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
                            "uuid": "1936f246-22e1-45dc-bb5c-9cfd55537fe7",
                            "file_format": {
                                "uuid": "5ced774b-a73e-4d1b-8186-d7fbbde7a3c2",
                                "display_title": "fa",
                                "@type": [
                                    "FileFormat",
                                    "Item"
                                ],
                                "@id": "/file-formats/fa/",
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
                            "display_title": "GAPFIXRDPDK5.fa",
                            "file_size": 3263683042,
                            "@type": [
                                "FileReference",
                                "File",
                                "Item"
                            ],
                            "@id": "/files-reference/GAPFIXRDPDK5/",
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
                            "uuid": "1c07a3aa-e2a3-498c-b838-15991c4a2f28",
                            "file_format": {
                                "uuid": "0cd4e777-a596-4927-95c8-b07716121aa3",
                                "display_title": "txt",
                                "@type": [
                                    "FileFormat",
                                    "Item"
                                ],
                                "@id": "/file-formats/txt/",
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
                            "display_title": "GAPFIBGEOI72.txt",
                            "file_size": 7603,
                            "@type": [
                                "FileReference",
                                "File",
                                "Item"
                            ],
                            "@id": "/files-reference/GAPFIBGEOI72/",
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
                    },
                    {
                        "value": {
                            "uuid": "ea103486-b65a-4439-9d0b-1186f8e59388",
                            "file_format": {
                                "uuid": "d05f9688-0ee1-4a86-83f4-656e6e21352a",
                                "display_title": "vep_tar",
                                "@type": [
                                    "FileFormat",
                                    "Item"
                                ],
                                "@id": "/file-formats/vep_tar/",
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
                            "display_title": "GAPFIL8XMTIV.vep.tar.gz",
                            "file_size": 14459657412,
                            "@type": [
                                "FileReference",
                                "File",
                                "Item"
                            ],
                            "@id": "/files-reference/GAPFIL8XMTIV/",
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
                        "workflow_argument_name": "vep"
                    },
                    {
                        "value": {
                            "uuid": "7db786d5-13d2-4622-bdd2-99866036b9b9",
                            "file_format": {
                                "uuid": "1b8f525f-aecb-4211-9ae5-a2c998b05599",
                                "display_title": "vcf_gz",
                                "@type": [
                                    "FileFormat",
                                    "Item"
                                ],
                                "@id": "/file-formats/vcf_gz/",
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
                            "display_title": "GAPFI121RWQE.vcf.gz",
                            "file_size": 34029026,
                            "@type": [
                                "FileReference",
                                "File",
                                "Item"
                            ],
                            "@id": "/files-reference/GAPFI121RWQE/",
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
                        "workflow_argument_name": "clinvar"
                    },
                    {
                        "value": {
                            "uuid": "dc02df4c-49ac-4532-b85c-02800941aa44",
                            "file_format": {
                                "uuid": "65a2cca2-dae8-4ff2-ac8b-aa1e92f5416b",
                                "display_title": "dbnsfp_gz",
                                "@type": [
                                    "FileFormat",
                                    "Item"
                                ],
                                "@id": "/file-formats/dbnsfp_gz/",
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
                            "display_title": "GAPFIKJ66FKY.dbnsfp.gz",
                            "file_size": 32749109158,
                            "@type": [
                                "FileReference",
                                "File",
                                "Item"
                            ],
                            "@id": "/files-reference/GAPFIKJ66FKY/",
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
                        "workflow_argument_name": "dbnsfp"
                    },
                    {
                        "value": {
                            "uuid": "71a7d16b-8452-4266-ae80-bbede2e305e2",
                            "file_format": {
                                "uuid": "f2ec3b9f-a898-4e6c-8da5-734a7a6410b8",
                                "display_title": "tar_gz",
                                "@type": [
                                    "FileFormat",
                                    "Item"
                                ],
                                "@id": "/file-formats/tar_gz/",
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
                            "display_title": "GAPFI6BNNTKA.tar.gz",
                            "file_size": 1505157,
                            "@type": [
                                "FileReference",
                                "File",
                                "Item"
                            ],
                            "@id": "/files-reference/GAPFI6BNNTKA/",
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
                        "workflow_argument_name": "maxent"
                    },
                    {
                        "value": {
                            "uuid": "a35e580c-7579-4312-a3a1-66810e6d9366",
                            "file_format": {
                                "uuid": "1b8f525f-aecb-4211-9ae5-a2c998b05599",
                                "display_title": "vcf_gz",
                                "@type": [
                                    "FileFormat",
                                    "Item"
                                ],
                                "@id": "/file-formats/vcf_gz/",
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
                            "display_title": "GAPFISUOC64Q.vcf.gz",
                            "file_size": 28829788377,
                            "@type": [
                                "FileReference",
                                "File",
                                "Item"
                            ],
                            "@id": "/files-reference/GAPFISUOC64Q/",
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
                        "workflow_argument_name": "spliceai_snv"
                    },
                    {
                        "value": {
                            "uuid": "3b7c0c29-5ee2-47c8-95a8-d28e15d5de47",
                            "file_format": {
                                "uuid": "1b8f525f-aecb-4211-9ae5-a2c998b05599",
                                "display_title": "vcf_gz",
                                "@type": [
                                    "FileFormat",
                                    "Item"
                                ],
                                "@id": "/file-formats/vcf_gz/",
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
                            "display_title": "GAPFIZOPCWIU.vcf.gz",
                            "file_size": 69322106029,
                            "@type": [
                                "FileReference",
                                "File",
                                "Item"
                            ],
                            "@id": "/files-reference/GAPFIZOPCWIU/",
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
                        "workflow_argument_name": "spliceai_indel"
                    },
                    {
                        "value": {
                            "uuid": "52c6cbf6-ae94-4c10-ad03-26ed34f74a3e",
                            "file_format": {
                                "uuid": "1b8f525f-aecb-4211-9ae5-a2c998b05599",
                                "display_title": "vcf_gz",
                                "@type": [
                                    "FileFormat",
                                    "Item"
                                ],
                                "@id": "/file-formats/vcf_gz/",
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
                            "display_title": "GAPFIJOMA2Q8.vcf.gz",
                            "file_size": 56752948861,
                            "@type": [
                                "FileReference",
                                "File",
                                "Item"
                            ],
                            "@id": "/files-reference/GAPFIJOMA2Q8/",
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
                        "workflow_argument_name": "gnomad"
                    },
                    {
                        "value": {
                            "uuid": "dd6f0384-d0b5-47d6-99a8-395c0b72feed",
                            "file_format": {
                                "uuid": "1b8f525f-aecb-4211-9ae5-a2c998b05599",
                                "display_title": "vcf_gz",
                                "@type": [
                                    "FileFormat",
                                    "Item"
                                ],
                                "@id": "/file-formats/vcf_gz/",
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
                            "display_title": "GAPFIC5416E6.vcf.gz",
                            "file_size": 1461686984,
                            "@type": [
                                "FileReference",
                                "File",
                                "Item"
                            ],
                            "@id": "/files-reference/GAPFIC5416E6/",
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
                        "workflow_argument_name": "gnomad2"
                    },
                    {
                        "value": {
                            "uuid": "672de47f-d058-4dbd-9fc4-3e134cfe71d8",
                            "file_format": {
                                "uuid": "11ca3783-db6e-430e-997b-9cf0ca275814",
                                "display_title": "tsv_gz",
                                "@type": [
                                    "FileFormat",
                                    "Item"
                                ],
                                "@id": "/file-formats/tsv_gz/",
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
                            "display_title": "GAPFI566QQCV.tsv.gz",
                            "file_size": 86592987071,
                            "@type": [
                                "FileReference",
                                "File",
                                "Item"
                            ],
                            "@id": "/files-reference/GAPFI566QQCV/",
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
                        "workflow_argument_name": "CADD_snv"
                    },
                    {
                        "value": {
                            "uuid": "b9f123dd-be05-4a14-957a-5e1e5a5ce254",
                            "file_format": {
                                "uuid": "11ca3783-db6e-430e-997b-9cf0ca275814",
                                "display_title": "tsv_gz",
                                "@type": [
                                    "FileFormat",
                                    "Item"
                                ],
                                "@id": "/file-formats/tsv_gz/",
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
                            "display_title": "GAPFI1GC6AXF.tsv.gz",
                            "file_size": 1165363333,
                            "@type": [
                                "FileReference",
                                "File",
                                "Item"
                            ],
                            "@id": "/files-reference/GAPFI1GC6AXF/",
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
                        "workflow_argument_name": "CADD_indel"
                    },
                    {
                        "value": {
                            "uuid": "af93aecb-6b8e-4c8b-b159-eefb3f9d0ffb",
                            "file_format": {
                                "uuid": "33f30c42-d582-4163-af44-fecf586b9dd3",
                                "display_title": "BigWig",
                                "@type": [
                                    "FileFormat",
                                    "Item"
                                ],
                                "@id": "/file-formats/BigWig/",
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
                            "display_title": "GAPFIMQ7MHGA.bw",
                            "file_size": 9870053206,
                            "@type": [
                                "FileReference",
                                "File",
                                "Item"
                            ],
                            "@id": "/files-reference/GAPFIMQ7MHGA/",
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
                        "workflow_argument_name": "phylop100bw"
                    },
                    {
                        "value": {
                            "uuid": "f6809af1-f7b9-43c0-882a-16764ccc431d",
                            "file_format": {
                                "uuid": "33f30c42-d582-4163-af44-fecf586b9dd3",
                                "display_title": "BigWig",
                                "@type": [
                                    "FileFormat",
                                    "Item"
                                ],
                                "@id": "/file-formats/BigWig/",
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
                            "display_title": "GAPFI5MRTDLN.bw",
                            "file_size": 8400229101,
                            "@type": [
                                "FileReference",
                                "File",
                                "Item"
                            ],
                            "@id": "/files-reference/GAPFI5MRTDLN/",
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
                        "workflow_argument_name": "phylop30bw"
                    },
                    {
                        "value": {
                            "uuid": "19f03828-175b-4594-ba1a-52ddabcf640d",
                            "file_format": {
                                "uuid": "33f30c42-d582-4163-af44-fecf586b9dd3",
                                "display_title": "BigWig",
                                "@type": [
                                    "FileFormat",
                                    "Item"
                                ],
                                "@id": "/file-formats/BigWig/",
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
                            "display_title": "GAPFI6KXAQMV.bw",
                            "file_size": 5886377734,
                            "@type": [
                                "FileReference",
                                "File",
                                "Item"
                            ],
                            "@id": "/files-reference/GAPFI6KXAQMV/",
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
                        "workflow_argument_name": "phastc100bw"
                    }
                ],
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
        {
            "name": "workflow_peddy",
            "jobid": "PxpliDNZ3ili",
            "shard": "0",
            "status": "completed",
            "dependencies": [
                "workflow_vep-annot-check:0"
            ],
            "workflow_run": {
                "uuid": "58210479-cf6c-40db-8a03-fbd2541be2c2",
                "@type": [
                    "WorkflowRunAwsem",
                    "WorkflowRun",
                    "Item"
                ],
                "display_title": "workflow_peddy v1.0.0 run 2022-04-30 02:10:35.255342",
                "status": "shared",
                "@id": "/workflow-runs-awsem/58210479-cf6c-40db-8a03-fbd2541be2c2/",
                "output_files": [
                    {
                        "type": "Output QC file",
                        "value_qc": "/quality-metrics-peddyqc/6561d7cf-a5c1-4ada-9eab-9e1ba62b3699/",
                        "workflow_argument_name": "qc_json"
                    },
                    {
                        "type": "Output QC file",
                        "value_qc": "/quality-metrics-peddyqc/6561d7cf-a5c1-4ada-9eab-9e1ba62b3699/",
                        "workflow_argument_name": "qc_html"
                    }
                ],
                "input_files": [
                    {
                        "value": {
                            "uuid": "a7809e79-b980-4b7f-9e43-1c2a60959246",
                            "file_format": {
                                "uuid": "1b8f525f-aecb-4211-9ae5-a2c998b05599",
                                "display_title": "vcf_gz",
                                "@type": [
                                    "FileFormat",
                                    "Item"
                                ],
                                "@id": "/file-formats/vcf_gz/",
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
                            "display_title": "GAPFIACVY8U8.vcf.gz",
                            "file_size": 2727278155,
                            "@type": [
                                "FileProcessed",
                                "File",
                                "Item"
                            ],
                            "@id": "/files-processed/GAPFIACVY8U8/",
                            "status": "uploaded",
                            "workflow_run_outputs": [
                                {
                                    "status": "shared",
                                    "display_title": "workflow_vep-annot-check v1.0.0 run 2022-04-29 22:40:46.334063",
                                    "@type": [
                                        "WorkflowRunAwsem",
                                        "WorkflowRun",
                                        "Item"
                                    ],
                                    "@id": "/workflow-runs-awsem/cf4811eb-3f1f-4951-8d84-00a2c7ffe352/",
                                    "uuid": "cf4811eb-3f1f-4951-8d84-00a2c7ffe352",
                                    "principals_allowed": {
                                        "view": [
                                            "system.Authenticated"
                                        ],
                                        "edit": [
                                            "group.admin"
                                        ]
                                    }
                                }
                            ],
                            "quality_metric": {
                                "uuid": "c9df0265-50c5-4706-9327-86d9f18f8130",
                                "overall_quality_status": "PASS",
                                "display_title": "QualityMetricQclist from 2022-04-30",
                                "@type": [
                                    "QualityMetricQclist",
                                    "QualityMetric",
                                    "Item"
                                ],
                                "status": "shared",
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
                "uuid": "eba22967-9efc-4071-a3df-fa5b55943db8",
                "@type": [
                    "WorkflowRunAwsem",
                    "WorkflowRun",
                    "Item"
                ],
                "display_title": "workflow_granite-qcVCF v1.0.0 run 2022-04-30 02:40:35.197316",
                "status": "shared",
                "@id": "/workflow-runs-awsem/eba22967-9efc-4071-a3df-fa5b55943db8/",
                "output_files": [
                    {
                        "type": "Output QC file",
                        "value_qc": "/quality-metrics-vcfqc/1a6c85b3-2d60-4428-b449-0771abdf787a/",
                        "workflow_argument_name": "qc_json"
                    },
                    {
                        "type": "Output QC file",
                        "value_qc": "/quality-metrics-vcfqc/1a6c85b3-2d60-4428-b449-0771abdf787a/",
                        "workflow_argument_name": "uniq_variants"
                    }
                ],
                "input_files": [
                    {
                        "value": {
                            "uuid": "a7809e79-b980-4b7f-9e43-1c2a60959246",
                            "file_format": {
                                "uuid": "1b8f525f-aecb-4211-9ae5-a2c998b05599",
                                "display_title": "vcf_gz",
                                "@type": [
                                    "FileFormat",
                                    "Item"
                                ],
                                "@id": "/file-formats/vcf_gz/",
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
                            "display_title": "GAPFIACVY8U8.vcf.gz",
                            "file_size": 2727278155,
                            "@type": [
                                "FileProcessed",
                                "File",
                                "Item"
                            ],
                            "@id": "/files-processed/GAPFIACVY8U8/",
                            "status": "uploaded",
                            "workflow_run_outputs": [
                                {
                                    "status": "shared",
                                    "display_title": "workflow_vep-annot-check v1.0.0 run 2022-04-29 22:40:46.334063",
                                    "@type": [
                                        "WorkflowRunAwsem",
                                        "WorkflowRun",
                                        "Item"
                                    ],
                                    "@id": "/workflow-runs-awsem/cf4811eb-3f1f-4951-8d84-00a2c7ffe352/",
                                    "uuid": "cf4811eb-3f1f-4951-8d84-00a2c7ffe352",
                                    "principals_allowed": {
                                        "view": [
                                            "system.Authenticated"
                                        ],
                                        "edit": [
                                            "group.admin"
                                        ]
                                    }
                                }
                            ],
                            "quality_metric": {
                                "uuid": "c9df0265-50c5-4706-9327-86d9f18f8130",
                                "overall_quality_status": "PASS",
                                "display_title": "QualityMetricQclist from 2022-04-30",
                                "@type": [
                                    "QualityMetricQclist",
                                    "QualityMetric",
                                    "Item"
                                ],
                                "status": "shared",
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
        {
            "name": "workflow_granite-filtering-check",
            "jobid": "ndgL6ekz3yoL",
            "shard": "0",
            "output": [
                {
                    "file": {
                        "@id": "/files-processed/GAPFIF8PBOT6/",
                        "status": "uploaded",
                        "display_title": "GAPFIF8PBOT6.vcf.gz",
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
                "uuid": "64a59f36-a856-47e1-be09-d0c6b8694252",
                "@type": [
                    "WorkflowRunAwsem",
                    "WorkflowRun",
                    "Item"
                ],
                "display_title": "workflow_granite-filtering-check v1.0.0 run 2022-04-30 02:10:40.339145",
                "status": "shared",
                "@id": "/workflow-runs-awsem/64a59f36-a856-47e1-be09-d0c6b8694252/",
                "output_files": [
                    {
                        "type": "Output processed file",
                        "value": {
                            "status": "uploaded",
                            "display_title": "GAPFIF8PBOT6.vcf.gz",
                            "uuid": "c11cb753-5ae1-4298-b714-e30b67b46653",
                            "file_format": {
                                "@type": [
                                    "FileFormat",
                                    "Item"
                                ],
                                "status": "shared",
                                "display_title": "vcf_gz",
                                "uuid": "1b8f525f-aecb-4211-9ae5-a2c998b05599",
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
                            "file_size": 4212759,
                            "@id": "/files-processed/GAPFIF8PBOT6/",
                            "@type": [
                                "FileProcessed",
                                "File",
                                "Item"
                            ],
                            "quality_metric": {
                                "uuid": "22c5255f-ef08-4660-8524-887067eebb2e",
                                "@type": [
                                    "QualityMetricQclist",
                                    "QualityMetric",
                                    "Item"
                                ],
                                "display_title": "QualityMetricQclist from 2022-04-30",
                                "@id": "/quality-metrics-qclist/22c5255f-ef08-4660-8524-887067eebb2e/",
                                "overall_quality_status": "PASS",
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
                            "workflow_run_inputs": [
                                {
                                    "@type": [
                                        "WorkflowRunAwsem",
                                        "WorkflowRun",
                                        "Item"
                                    ],
                                    "uuid": "99c36be0-a667-456a-9b8c-b08bb3b4da17",
                                    "@id": "/workflow-runs-awsem/99c36be0-a667-456a-9b8c-b08bb3b4da17/",
                                    "display_title": "workflow_granite-qcVCF v1.0.0 run 2022-04-30 02:55:39.004849",
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
                                {
                                    "@type": [
                                        "WorkflowRunAwsem",
                                        "WorkflowRun",
                                        "Item"
                                    ],
                                    "uuid": "2160c911-2d1b-466b-9643-ed30c74228a8",
                                    "@id": "/workflow-runs-awsem/2160c911-2d1b-466b-9643-ed30c74228a8/",
                                    "display_title": "workflow_granite-novoCaller-rck-check v1.0.0 run 2022-04-30 02:55:36.042917",
                                    "status": "shared",
                                    "principals_allowed": {
                                        "view": [
                                            "system.Authenticated"
                                        ],
                                        "edit": [
                                            "group.admin"
                                        ]
                                    }
                                }
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
                        "value_qc": "/quality-metrics-vcfcheck/623843ad-9242-49b4-8df7-65bf4eb041e5/",
                        "workflow_argument_name": "merged_vcf-check"
                    }
                ],
                "input_files": [
                    {
                        "value": {
                            "uuid": "a7809e79-b980-4b7f-9e43-1c2a60959246",
                            "file_format": {
                                "uuid": "1b8f525f-aecb-4211-9ae5-a2c998b05599",
                                "display_title": "vcf_gz",
                                "@type": [
                                    "FileFormat",
                                    "Item"
                                ],
                                "@id": "/file-formats/vcf_gz/",
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
                            "display_title": "GAPFIACVY8U8.vcf.gz",
                            "file_size": 2727278155,
                            "@type": [
                                "FileProcessed",
                                "File",
                                "Item"
                            ],
                            "@id": "/files-processed/GAPFIACVY8U8/",
                            "status": "uploaded",
                            "workflow_run_outputs": [
                                {
                                    "status": "shared",
                                    "display_title": "workflow_vep-annot-check v1.0.0 run 2022-04-29 22:40:46.334063",
                                    "@type": [
                                        "WorkflowRunAwsem",
                                        "WorkflowRun",
                                        "Item"
                                    ],
                                    "@id": "/workflow-runs-awsem/cf4811eb-3f1f-4951-8d84-00a2c7ffe352/",
                                    "uuid": "cf4811eb-3f1f-4951-8d84-00a2c7ffe352",
                                    "principals_allowed": {
                                        "view": [
                                            "system.Authenticated"
                                        ],
                                        "edit": [
                                            "group.admin"
                                        ]
                                    }
                                }
                            ],
                            "quality_metric": {
                                "uuid": "c9df0265-50c5-4706-9327-86d9f18f8130",
                                "overall_quality_status": "PASS",
                                "display_title": "QualityMetricQclist from 2022-04-30",
                                "@type": [
                                    "QualityMetricQclist",
                                    "QualityMetric",
                                    "Item"
                                ],
                                "status": "shared",
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
                    },
                    {
                        "value": {
                            "uuid": "84f2bb24-edd7-459b-ab89-0a21866d7826",
                            "file_format": {
                                "uuid": "0cd4e777-a596-4927-95c8-b07716121aa3",
                                "display_title": "txt",
                                "@type": [
                                    "FileFormat",
                                    "Item"
                                ],
                                "@id": "/file-formats/txt/",
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
                            "display_title": "GAPFI5MKCART.txt",
                            "file_size": 349968,
                            "@type": [
                                "FileReference",
                                "File",
                                "Item"
                            ],
                            "@id": "/files-reference/GAPFI5MKCART/",
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
                        "workflow_argument_name": "genes"
                    }
                ],
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
        {
            "name": "workflow_granite-novoCaller-rck-check",
            "jobid": "xFRcGVgRfaTn",
            "shard": "0",
            "output": [
                {
                    "file": {
                        "@id": "/files-processed/GAPFIRZZWDQL/",
                        "status": "uploaded",
                        "display_title": "GAPFIRZZWDQL.vcf.gz",
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
                "uuid": "2160c911-2d1b-466b-9643-ed30c74228a8",
                "@type": [
                    "WorkflowRunAwsem",
                    "WorkflowRun",
                    "Item"
                ],
                "display_title": "workflow_granite-novoCaller-rck-check v1.0.0 run 2022-04-30 02:55:36.042917",
                "status": "shared",
                "@id": "/workflow-runs-awsem/2160c911-2d1b-466b-9643-ed30c74228a8/",
                "output_files": [
                    {
                        "type": "Output processed file",
                        "value": {
                            "status": "uploaded",
                            "display_title": "GAPFIRZZWDQL.vcf.gz",
                            "uuid": "0d5b70d8-3ab9-474b-92ff-0b41bfa1919b",
                            "file_format": {
                                "@type": [
                                    "FileFormat",
                                    "Item"
                                ],
                                "status": "shared",
                                "display_title": "vcf_gz",
                                "uuid": "1b8f525f-aecb-4211-9ae5-a2c998b05599",
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
                            "file_size": 4980651,
                            "@id": "/files-processed/GAPFIRZZWDQL/",
                            "@type": [
                                "FileProcessed",
                                "File",
                                "Item"
                            ],
                            "quality_metric": {
                                "uuid": "8c3fe2b7-5186-451d-b273-b775f65afdf4",
                                "@type": [
                                    "QualityMetricQclist",
                                    "QualityMetric",
                                    "Item"
                                ],
                                "display_title": "QualityMetricQclist from 2022-04-30",
                                "@id": "/quality-metrics-qclist/8c3fe2b7-5186-451d-b273-b775f65afdf4/",
                                "overall_quality_status": "PASS",
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
                            "workflow_run_inputs": [
                                {
                                    "@type": [
                                        "WorkflowRunAwsem",
                                        "WorkflowRun",
                                        "Item"
                                    ],
                                    "uuid": "31fad2bc-d98e-446e-8cc5-a695aee8ba47",
                                    "@id": "/workflow-runs-awsem/31fad2bc-d98e-446e-8cc5-a695aee8ba47/",
                                    "display_title": "workflow_granite-qcVCF v1.0.0 run 2022-04-30 05:10:33.627859",
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
                                {
                                    "@type": [
                                        "WorkflowRunAwsem",
                                        "WorkflowRun",
                                        "Item"
                                    ],
                                    "uuid": "e71195e4-f32c-4cf7-866b-15b522b3998c",
                                    "@id": "/workflow-runs-awsem/e71195e4-f32c-4cf7-866b-15b522b3998c/",
                                    "display_title": "workflow_granite-comHet-check v1.0.0 run 2022-04-30 05:10:39.280286",
                                    "status": "shared",
                                    "principals_allowed": {
                                        "view": [
                                            "system.Authenticated"
                                        ],
                                        "edit": [
                                            "group.admin"
                                        ]
                                    }
                                }
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
                        "value_qc": "/quality-metrics-vcfcheck/0ce4f49b-05dc-433e-b950-a16076912205/",
                        "workflow_argument_name": "novoCaller_vcf-check"
                    }
                ],
                "input_files": [
                    {
                        "value": {
                            "uuid": "c11cb753-5ae1-4298-b714-e30b67b46653",
                            "file_format": {
                                "uuid": "1b8f525f-aecb-4211-9ae5-a2c998b05599",
                                "display_title": "vcf_gz",
                                "@type": [
                                    "FileFormat",
                                    "Item"
                                ],
                                "@id": "/file-formats/vcf_gz/",
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
                            "display_title": "GAPFIF8PBOT6.vcf.gz",
                            "file_size": 4212759,
                            "@type": [
                                "FileProcessed",
                                "File",
                                "Item"
                            ],
                            "@id": "/files-processed/GAPFIF8PBOT6/",
                            "status": "uploaded",
                            "workflow_run_outputs": [
                                {
                                    "status": "shared",
                                    "display_title": "workflow_granite-filtering-check v1.0.0 run 2022-04-30 02:10:40.339145",
                                    "@type": [
                                        "WorkflowRunAwsem",
                                        "WorkflowRun",
                                        "Item"
                                    ],
                                    "@id": "/workflow-runs-awsem/64a59f36-a856-47e1-be09-d0c6b8694252/",
                                    "uuid": "64a59f36-a856-47e1-be09-d0c6b8694252",
                                    "principals_allowed": {
                                        "view": [
                                            "system.Authenticated"
                                        ],
                                        "edit": [
                                            "group.admin"
                                        ]
                                    }
                                }
                            ],
                            "quality_metric": {
                                "uuid": "22c5255f-ef08-4660-8524-887067eebb2e",
                                "overall_quality_status": "PASS",
                                "display_title": "QualityMetricQclist from 2022-04-30",
                                "@type": [
                                    "QualityMetricQclist",
                                    "QualityMetric",
                                    "Item"
                                ],
                                "status": "shared",
                                "@id": "/quality-metrics-qclist/22c5255f-ef08-4660-8524-887067eebb2e/",
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
                            "uuid": "eac862c0-8c87-4838-83cb-9a77412bff6f",
                            "file_format": {
                                "uuid": "39f836d8-bbb1-46c7-80d4-e321d4a44204",
                                "display_title": "rck_tar",
                                "@type": [
                                    "FileFormat",
                                    "Item"
                                ],
                                "@id": "/file-formats/rck_tar/",
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
                            "display_title": "GAPFIMO8Y4PZ.rck.tar",
                            "file_size": 209874647040,
                            "@type": [
                                "FileReference",
                                "File",
                                "Item"
                            ],
                            "@id": "/files-reference/GAPFIMO8Y4PZ/",
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
                            "uuid": "3e8a17d1-e07f-4226-bd6a-a4ca13606528",
                            "file_format": {
                                "uuid": "39f836d8-bbb1-46c7-80d4-e321d4a44204",
                                "display_title": "rck_tar",
                                "@type": [
                                    "FileFormat",
                                    "Item"
                                ],
                                "@id": "/file-formats/rck_tar/",
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
                            "display_title": "GAPFI7TBYWC7.rck.tar",
                            "file_size": 35891374080,
                            "@type": [
                                "FileProcessed",
                                "File",
                                "Item"
                            ],
                            "@id": "/files-processed/GAPFI7TBYWC7/",
                            "status": "uploaded",
                            "workflow_run_outputs": [
                                {
                                    "status": "shared",
                                    "display_title": "workflow_granite-rckTar v1.0.0 run 2022-04-29 21:10:35.118284",
                                    "@type": [
                                        "WorkflowRunAwsem",
                                        "WorkflowRun",
                                        "Item"
                                    ],
                                    "@id": "/workflow-runs-awsem/6fb5a7f0-2156-49e3-bf42-95f4e8decdde/",
                                    "uuid": "6fb5a7f0-2156-49e3-bf42-95f4e8decdde",
                                    "principals_allowed": {
                                        "view": [
                                            "system.Authenticated"
                                        ],
                                        "edit": [
                                            "group.admin"
                                        ]
                                    }
                                }
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
                        "ordinal": 1,
                        "dimension": "0",
                        "workflow_argument_name": "trio"
                    }
                ],
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
        {
            "name": "workflow_granite-qcVCF-3",
            "jobid": "RZbFVWSkL5EX",
            "shard": "0",
            "status": "completed",
            "dependencies": [
                "workflow_granite-filtering-check:0"
            ],
            "workflow_run": {
                "uuid": "99c36be0-a667-456a-9b8c-b08bb3b4da17",
                "@type": [
                    "WorkflowRunAwsem",
                    "WorkflowRun",
                    "Item"
                ],
                "display_title": "workflow_granite-qcVCF v1.0.0 run 2022-04-30 02:55:39.004849",
                "status": "shared",
                "@id": "/workflow-runs-awsem/99c36be0-a667-456a-9b8c-b08bb3b4da17/",
                "output_files": [
                    {
                        "type": "Output QC file",
                        "value_qc": "/quality-metrics-vcfqc/dd4ca4bd-746c-483e-8c49-0ff28d6e5aa3/",
                        "workflow_argument_name": "qc_json"
                    },
                    {
                        "type": "Output QC file",
                        "value_qc": "/quality-metrics-vcfqc/dd4ca4bd-746c-483e-8c49-0ff28d6e5aa3/",
                        "workflow_argument_name": "uniq_variants"
                    }
                ],
                "input_files": [
                    {
                        "value": {
                            "uuid": "c11cb753-5ae1-4298-b714-e30b67b46653",
                            "file_format": {
                                "uuid": "1b8f525f-aecb-4211-9ae5-a2c998b05599",
                                "display_title": "vcf_gz",
                                "@type": [
                                    "FileFormat",
                                    "Item"
                                ],
                                "@id": "/file-formats/vcf_gz/",
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
                            "display_title": "GAPFIF8PBOT6.vcf.gz",
                            "file_size": 4212759,
                            "@type": [
                                "FileProcessed",
                                "File",
                                "Item"
                            ],
                            "@id": "/files-processed/GAPFIF8PBOT6/",
                            "status": "uploaded",
                            "workflow_run_outputs": [
                                {
                                    "status": "shared",
                                    "display_title": "workflow_granite-filtering-check v1.0.0 run 2022-04-30 02:10:40.339145",
                                    "@type": [
                                        "WorkflowRunAwsem",
                                        "WorkflowRun",
                                        "Item"
                                    ],
                                    "@id": "/workflow-runs-awsem/64a59f36-a856-47e1-be09-d0c6b8694252/",
                                    "uuid": "64a59f36-a856-47e1-be09-d0c6b8694252",
                                    "principals_allowed": {
                                        "view": [
                                            "system.Authenticated"
                                        ],
                                        "edit": [
                                            "group.admin"
                                        ]
                                    }
                                }
                            ],
                            "quality_metric": {
                                "uuid": "22c5255f-ef08-4660-8524-887067eebb2e",
                                "overall_quality_status": "PASS",
                                "display_title": "QualityMetricQclist from 2022-04-30",
                                "@type": [
                                    "QualityMetricQclist",
                                    "QualityMetric",
                                    "Item"
                                ],
                                "status": "shared",
                                "@id": "/quality-metrics-qclist/22c5255f-ef08-4660-8524-887067eebb2e/",
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
        {
            "name": "workflow_granite-qcVCF-4",
            "jobid": "2QC54BLxxGcw",
            "shard": "0",
            "status": "completed",
            "dependencies": [
                "workflow_granite-novoCaller-rck-check:0"
            ],
            "workflow_run": {
                "uuid": "31fad2bc-d98e-446e-8cc5-a695aee8ba47",
                "@type": [
                    "WorkflowRunAwsem",
                    "WorkflowRun",
                    "Item"
                ],
                "display_title": "workflow_granite-qcVCF v1.0.0 run 2022-04-30 05:10:33.627859",
                "status": "shared",
                "@id": "/workflow-runs-awsem/31fad2bc-d98e-446e-8cc5-a695aee8ba47/",
                "output_files": [
                    {
                        "type": "Output QC file",
                        "value_qc": "/quality-metrics-vcfqc/8bd8d24f-e436-4e4b-92e3-b65932fd0b02/",
                        "workflow_argument_name": "qc_json"
                    },
                    {
                        "type": "Output QC file",
                        "value_qc": "/quality-metrics-vcfqc/8bd8d24f-e436-4e4b-92e3-b65932fd0b02/",
                        "workflow_argument_name": "uniq_variants"
                    }
                ],
                "input_files": [
                    {
                        "value": {
                            "uuid": "0d5b70d8-3ab9-474b-92ff-0b41bfa1919b",
                            "file_format": {
                                "uuid": "1b8f525f-aecb-4211-9ae5-a2c998b05599",
                                "display_title": "vcf_gz",
                                "@type": [
                                    "FileFormat",
                                    "Item"
                                ],
                                "@id": "/file-formats/vcf_gz/",
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
                            "display_title": "GAPFIRZZWDQL.vcf.gz",
                            "file_size": 4980651,
                            "@type": [
                                "FileProcessed",
                                "File",
                                "Item"
                            ],
                            "@id": "/files-processed/GAPFIRZZWDQL/",
                            "status": "uploaded",
                            "workflow_run_outputs": [
                                {
                                    "status": "shared",
                                    "display_title": "workflow_granite-novoCaller-rck-check v1.0.0 run 2022-04-30 02:55:36.042917",
                                    "@type": [
                                        "WorkflowRunAwsem",
                                        "WorkflowRun",
                                        "Item"
                                    ],
                                    "@id": "/workflow-runs-awsem/2160c911-2d1b-466b-9643-ed30c74228a8/",
                                    "uuid": "2160c911-2d1b-466b-9643-ed30c74228a8",
                                    "principals_allowed": {
                                        "view": [
                                            "system.Authenticated"
                                        ],
                                        "edit": [
                                            "group.admin"
                                        ]
                                    }
                                }
                            ],
                            "quality_metric": {
                                "uuid": "8c3fe2b7-5186-451d-b273-b775f65afdf4",
                                "overall_quality_status": "PASS",
                                "display_title": "QualityMetricQclist from 2022-04-30",
                                "@type": [
                                    "QualityMetricQclist",
                                    "QualityMetric",
                                    "Item"
                                ],
                                "status": "shared",
                                "@id": "/quality-metrics-qclist/8c3fe2b7-5186-451d-b273-b775f65afdf4/",
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
        {
            "name": "workflow_granite-comHet-check",
            "jobid": "oSRPGbXqqrmk",
            "shard": "0",
            "output": [
                {
                    "file": {
                        "@id": "/files-processed/GAPFIUXS6TY7/",
                        "status": "uploaded",
                        "display_title": "GAPFIUXS6TY7.vcf.gz",
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
                "uuid": "e71195e4-f32c-4cf7-866b-15b522b3998c",
                "@type": [
                    "WorkflowRunAwsem",
                    "WorkflowRun",
                    "Item"
                ],
                "display_title": "workflow_granite-comHet-check v1.0.0 run 2022-04-30 05:10:39.280286",
                "status": "shared",
                "@id": "/workflow-runs-awsem/e71195e4-f32c-4cf7-866b-15b522b3998c/",
                "output_files": [
                    {
                        "type": "Output processed file",
                        "value": {
                            "status": "uploaded",
                            "display_title": "GAPFIUXS6TY7.vcf.gz",
                            "uuid": "2bdf5b97-b382-4c11-a70a-b6a5210bf319",
                            "file_format": {
                                "@type": [
                                    "FileFormat",
                                    "Item"
                                ],
                                "status": "shared",
                                "display_title": "vcf_gz",
                                "uuid": "1b8f525f-aecb-4211-9ae5-a2c998b05599",
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
                            "@id": "/files-processed/GAPFIUXS6TY7/",
                            "@type": [
                                "FileProcessed",
                                "File",
                                "Item"
                            ],
                            "quality_metric": {
                                "uuid": "06a62061-7f6f-4e9e-995d-24c274509290",
                                "@type": [
                                    "QualityMetricQclist",
                                    "QualityMetric",
                                    "Item"
                                ],
                                "display_title": "QualityMetricQclist from 2022-04-30",
                                "@id": "/quality-metrics-qclist/06a62061-7f6f-4e9e-995d-24c274509290/",
                                "overall_quality_status": "PASS",
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
                            "workflow_run_inputs": [
                                {
                                    "@type": [
                                        "WorkflowRunAwsem",
                                        "WorkflowRun",
                                        "Item"
                                    ],
                                    "uuid": "703d75f8-4fdf-4cb4-a65b-6181e1079660",
                                    "@id": "/workflow-runs-awsem/703d75f8-4fdf-4cb4-a65b-6181e1079660/",
                                    "display_title": "workflow_dbSNP_ID_fixer-check v1.0.0 run 2022-04-30 05:40:37.109983",
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
                                {
                                    "@type": [
                                        "WorkflowRunAwsem",
                                        "WorkflowRun",
                                        "Item"
                                    ],
                                    "uuid": "dd927729-294a-4cff-bf20-115dc9561ff7",
                                    "@id": "/workflow-runs-awsem/dd927729-294a-4cff-bf20-115dc9561ff7/",
                                    "display_title": "workflow_granite-qcVCF v1.0.0 run 2022-04-30 05:40:39.370350",
                                    "status": "shared",
                                    "principals_allowed": {
                                        "view": [
                                            "system.Authenticated"
                                        ],
                                        "edit": [
                                            "group.admin"
                                        ]
                                    }
                                }
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
                        "value_qc": "/quality-metrics-cmphet/ef24dd65-a246-4a54-9150-5357a2c31ef5/",
                        "workflow_argument_name": "comHet_vcf-json"
                    },
                    {
                        "type": "Output QC file",
                        "value_qc": "/quality-metrics-vcfcheck/fc95bc98-e6eb-4168-9a71-90c4e3b2979b/",
                        "workflow_argument_name": "comHet_vcf-check"
                    }
                ],
                "input_files": [
                    {
                        "value": {
                            "uuid": "0d5b70d8-3ab9-474b-92ff-0b41bfa1919b",
                            "file_format": {
                                "uuid": "1b8f525f-aecb-4211-9ae5-a2c998b05599",
                                "display_title": "vcf_gz",
                                "@type": [
                                    "FileFormat",
                                    "Item"
                                ],
                                "@id": "/file-formats/vcf_gz/",
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
                            "display_title": "GAPFIRZZWDQL.vcf.gz",
                            "file_size": 4980651,
                            "@type": [
                                "FileProcessed",
                                "File",
                                "Item"
                            ],
                            "@id": "/files-processed/GAPFIRZZWDQL/",
                            "status": "uploaded",
                            "workflow_run_outputs": [
                                {
                                    "status": "shared",
                                    "display_title": "workflow_granite-novoCaller-rck-check v1.0.0 run 2022-04-30 02:55:36.042917",
                                    "@type": [
                                        "WorkflowRunAwsem",
                                        "WorkflowRun",
                                        "Item"
                                    ],
                                    "@id": "/workflow-runs-awsem/2160c911-2d1b-466b-9643-ed30c74228a8/",
                                    "uuid": "2160c911-2d1b-466b-9643-ed30c74228a8",
                                    "principals_allowed": {
                                        "view": [
                                            "system.Authenticated"
                                        ],
                                        "edit": [
                                            "group.admin"
                                        ]
                                    }
                                }
                            ],
                            "quality_metric": {
                                "uuid": "8c3fe2b7-5186-451d-b273-b775f65afdf4",
                                "overall_quality_status": "PASS",
                                "display_title": "QualityMetricQclist from 2022-04-30",
                                "@type": [
                                    "QualityMetricQclist",
                                    "QualityMetric",
                                    "Item"
                                ],
                                "status": "shared",
                                "@id": "/quality-metrics-qclist/8c3fe2b7-5186-451d-b273-b775f65afdf4/",
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
        {
            "name": "workflow_dbSNP_ID_fixer-check",
            "jobid": "vAjaUx5vdAgX",
            "shard": "0",
            "output": [
                {
                    "file": {
                        "@id": "/files-processed/GAPFI7UFWBGA/",
                        "status": "uploaded",
                        "display_title": "GAPFI7UFWBGA.vcf.gz",
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
                "uuid": "703d75f8-4fdf-4cb4-a65b-6181e1079660",
                "@type": [
                    "WorkflowRunAwsem",
                    "WorkflowRun",
                    "Item"
                ],
                "display_title": "workflow_dbSNP_ID_fixer-check v1.0.0 run 2022-04-30 05:40:37.109983",
                "status": "shared",
                "@id": "/workflow-runs-awsem/703d75f8-4fdf-4cb4-a65b-6181e1079660/",
                "output_files": [
                    {
                        "type": "Output processed file",
                        "value": {
                            "status": "uploaded",
                            "display_title": "GAPFI7UFWBGA.vcf.gz",
                            "uuid": "352d3ace-c687-41de-9027-db84bf8af10a",
                            "file_format": {
                                "@type": [
                                    "FileFormat",
                                    "Item"
                                ],
                                "status": "shared",
                                "display_title": "vcf_gz",
                                "uuid": "1b8f525f-aecb-4211-9ae5-a2c998b05599",
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
                            "file_size": 5033581,
                            "@id": "/files-processed/GAPFI7UFWBGA/",
                            "@type": [
                                "FileProcessed",
                                "File",
                                "Item"
                            ],
                            "quality_metric": {
                                "uuid": "ed1b017f-45f5-4609-9972-14991d203897",
                                "@type": [
                                    "QualityMetricQclist",
                                    "QualityMetric",
                                    "Item"
                                ],
                                "display_title": "QualityMetricQclist from 2022-04-30",
                                "@id": "/quality-metrics-qclist/ed1b017f-45f5-4609-9972-14991d203897/",
                                "overall_quality_status": "PASS",
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
                            "workflow_run_inputs": [
                                {
                                    "@type": [
                                        "WorkflowRunAwsem",
                                        "WorkflowRun",
                                        "Item"
                                    ],
                                    "uuid": "da4c3ef1-7cee-42cf-a6d1-ea60dbd60169",
                                    "@id": "/workflow-runs-awsem/da4c3ef1-7cee-42cf-a6d1-ea60dbd60169/",
                                    "display_title": "workflow_granite-qcVCF v1.0.0 run 2022-04-30 06:10:34.657719",
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
                                {
                                    "@type": [
                                        "WorkflowRunAwsem",
                                        "WorkflowRun",
                                        "Item"
                                    ],
                                    "uuid": "5df3ef23-0e93-4510-8ebb-63ebcc1214a7",
                                    "@id": "/workflow-runs-awsem/5df3ef23-0e93-4510-8ebb-63ebcc1214a7/",
                                    "display_title": "workflow_hg19lo_hgvsg-check v1.0.0 run 2022-04-30 06:10:40.434728",
                                    "status": "shared",
                                    "principals_allowed": {
                                        "view": [
                                            "system.Authenticated"
                                        ],
                                        "edit": [
                                            "group.admin"
                                        ]
                                    }
                                }
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
                        "value_qc": "/quality-metrics-vcfcheck/ef20bc31-5922-4b99-b910-aa7f9ef00f96/",
                        "workflow_argument_name": "vcf-check"
                    }
                ],
                "input_files": [
                    {
                        "value": {
                            "uuid": "2bdf5b97-b382-4c11-a70a-b6a5210bf319",
                            "file_format": {
                                "uuid": "1b8f525f-aecb-4211-9ae5-a2c998b05599",
                                "display_title": "vcf_gz",
                                "@type": [
                                    "FileFormat",
                                    "Item"
                                ],
                                "@id": "/file-formats/vcf_gz/",
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
                            "display_title": "GAPFIUXS6TY7.vcf.gz",
                            "file_size": 5015079,
                            "@type": [
                                "FileProcessed",
                                "File",
                                "Item"
                            ],
                            "@id": "/files-processed/GAPFIUXS6TY7/",
                            "status": "uploaded",
                            "workflow_run_outputs": [
                                {
                                    "status": "shared",
                                    "display_title": "workflow_granite-comHet-check v1.0.0 run 2022-04-30 05:10:39.280286",
                                    "@type": [
                                        "WorkflowRunAwsem",
                                        "WorkflowRun",
                                        "Item"
                                    ],
                                    "@id": "/workflow-runs-awsem/e71195e4-f32c-4cf7-866b-15b522b3998c/",
                                    "uuid": "e71195e4-f32c-4cf7-866b-15b522b3998c",
                                    "principals_allowed": {
                                        "view": [
                                            "system.Authenticated"
                                        ],
                                        "edit": [
                                            "group.admin"
                                        ]
                                    }
                                }
                            ],
                            "quality_metric": {
                                "uuid": "06a62061-7f6f-4e9e-995d-24c274509290",
                                "overall_quality_status": "PASS",
                                "display_title": "QualityMetricQclist from 2022-04-30",
                                "@type": [
                                    "QualityMetricQclist",
                                    "QualityMetric",
                                    "Item"
                                ],
                                "status": "shared",
                                "@id": "/quality-metrics-qclist/06a62061-7f6f-4e9e-995d-24c274509290/",
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
                            "uuid": "aa542c8e-b31c-4cff-b2d4-aa4037bb913c",
                            "file_format": {
                                "uuid": "1b8f525f-aecb-4211-9ae5-a2c998b05599",
                                "display_title": "vcf_gz",
                                "@type": [
                                    "FileFormat",
                                    "Item"
                                ],
                                "@id": "/file-formats/vcf_gz/",
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
                            "display_title": "GAPFIF4JKLTH.vcf.gz",
                            "file_size": 6596050744,
                            "@type": [
                                "FileReference",
                                "File",
                                "Item"
                            ],
                            "@id": "/files-reference/GAPFIF4JKLTH/",
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
                            "uuid": "1c07a3aa-e2a3-498c-b838-15991c4a2f28",
                            "file_format": {
                                "uuid": "0cd4e777-a596-4927-95c8-b07716121aa3",
                                "display_title": "txt",
                                "@type": [
                                    "FileFormat",
                                    "Item"
                                ],
                                "@id": "/file-formats/txt/",
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
                            "display_title": "GAPFIBGEOI72.txt",
                            "file_size": 7603,
                            "@type": [
                                "FileReference",
                                "File",
                                "Item"
                            ],
                            "@id": "/files-reference/GAPFIBGEOI72/",
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
        {
            "name": "workflow_granite-qcVCF-5",
            "jobid": "qyBOM5Uoyyoe",
            "shard": "0",
            "status": "completed",
            "dependencies": [
                "workflow_granite-comHet-check:0"
            ],
            "workflow_run": {
                "uuid": "dd927729-294a-4cff-bf20-115dc9561ff7",
                "@type": [
                    "WorkflowRunAwsem",
                    "WorkflowRun",
                    "Item"
                ],
                "display_title": "workflow_granite-qcVCF v1.0.0 run 2022-04-30 05:40:39.370350",
                "status": "shared",
                "@id": "/workflow-runs-awsem/dd927729-294a-4cff-bf20-115dc9561ff7/",
                "output_files": [
                    {
                        "type": "Output QC file",
                        "value_qc": "/quality-metrics-vcfqc/ff13b07a-d3e0-4a75-836f-837c79c116fc/",
                        "workflow_argument_name": "qc_json"
                    },
                    {
                        "type": "Output QC file",
                        "value_qc": "/quality-metrics-vcfqc/ff13b07a-d3e0-4a75-836f-837c79c116fc/",
                        "workflow_argument_name": "uniq_variants"
                    }
                ],
                "input_files": [
                    {
                        "value": {
                            "uuid": "2bdf5b97-b382-4c11-a70a-b6a5210bf319",
                            "file_format": {
                                "uuid": "1b8f525f-aecb-4211-9ae5-a2c998b05599",
                                "display_title": "vcf_gz",
                                "@type": [
                                    "FileFormat",
                                    "Item"
                                ],
                                "@id": "/file-formats/vcf_gz/",
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
                            "display_title": "GAPFIUXS6TY7.vcf.gz",
                            "file_size": 5015079,
                            "@type": [
                                "FileProcessed",
                                "File",
                                "Item"
                            ],
                            "@id": "/files-processed/GAPFIUXS6TY7/",
                            "status": "uploaded",
                            "workflow_run_outputs": [
                                {
                                    "status": "shared",
                                    "display_title": "workflow_granite-comHet-check v1.0.0 run 2022-04-30 05:10:39.280286",
                                    "@type": [
                                        "WorkflowRunAwsem",
                                        "WorkflowRun",
                                        "Item"
                                    ],
                                    "@id": "/workflow-runs-awsem/e71195e4-f32c-4cf7-866b-15b522b3998c/",
                                    "uuid": "e71195e4-f32c-4cf7-866b-15b522b3998c",
                                    "principals_allowed": {
                                        "view": [
                                            "system.Authenticated"
                                        ],
                                        "edit": [
                                            "group.admin"
                                        ]
                                    }
                                }
                            ],
                            "quality_metric": {
                                "uuid": "06a62061-7f6f-4e9e-995d-24c274509290",
                                "overall_quality_status": "PASS",
                                "display_title": "QualityMetricQclist from 2022-04-30",
                                "@type": [
                                    "QualityMetricQclist",
                                    "QualityMetric",
                                    "Item"
                                ],
                                "status": "shared",
                                "@id": "/quality-metrics-qclist/06a62061-7f6f-4e9e-995d-24c274509290/",
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
        {
            "name": "workflow_granite-qcVCF-6",
            "jobid": "au4qDeogNSxc",
            "shard": "0",
            "status": "completed",
            "dependencies": [
                "workflow_dbSNP_ID_fixer-check:0"
            ],
            "workflow_run": {
                "uuid": "da4c3ef1-7cee-42cf-a6d1-ea60dbd60169",
                "@type": [
                    "WorkflowRunAwsem",
                    "WorkflowRun",
                    "Item"
                ],
                "display_title": "workflow_granite-qcVCF v1.0.0 run 2022-04-30 06:10:34.657719",
                "status": "shared",
                "@id": "/workflow-runs-awsem/da4c3ef1-7cee-42cf-a6d1-ea60dbd60169/",
                "output_files": [
                    {
                        "type": "Output QC file",
                        "value_qc": "/quality-metrics-vcfqc/fddd9992-b13c-4844-9a30-2933f9fd909b/",
                        "workflow_argument_name": "qc_json"
                    },
                    {
                        "type": "Output QC file",
                        "value_qc": "/quality-metrics-vcfqc/fddd9992-b13c-4844-9a30-2933f9fd909b/",
                        "workflow_argument_name": "uniq_variants"
                    }
                ],
                "input_files": [
                    {
                        "value": {
                            "uuid": "352d3ace-c687-41de-9027-db84bf8af10a",
                            "file_format": {
                                "uuid": "1b8f525f-aecb-4211-9ae5-a2c998b05599",
                                "display_title": "vcf_gz",
                                "@type": [
                                    "FileFormat",
                                    "Item"
                                ],
                                "@id": "/file-formats/vcf_gz/",
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
                            "display_title": "GAPFI7UFWBGA.vcf.gz",
                            "file_size": 5033581,
                            "@type": [
                                "FileProcessed",
                                "File",
                                "Item"
                            ],
                            "@id": "/files-processed/GAPFI7UFWBGA/",
                            "status": "uploaded",
                            "workflow_run_outputs": [
                                {
                                    "status": "shared",
                                    "display_title": "workflow_dbSNP_ID_fixer-check v1.0.0 run 2022-04-30 05:40:37.109983",
                                    "@type": [
                                        "WorkflowRunAwsem",
                                        "WorkflowRun",
                                        "Item"
                                    ],
                                    "@id": "/workflow-runs-awsem/703d75f8-4fdf-4cb4-a65b-6181e1079660/",
                                    "uuid": "703d75f8-4fdf-4cb4-a65b-6181e1079660",
                                    "principals_allowed": {
                                        "view": [
                                            "system.Authenticated"
                                        ],
                                        "edit": [
                                            "group.admin"
                                        ]
                                    }
                                }
                            ],
                            "quality_metric": {
                                "uuid": "ed1b017f-45f5-4609-9972-14991d203897",
                                "overall_quality_status": "PASS",
                                "display_title": "QualityMetricQclist from 2022-04-30",
                                "@type": [
                                    "QualityMetricQclist",
                                    "QualityMetric",
                                    "Item"
                                ],
                                "status": "shared",
                                "@id": "/quality-metrics-qclist/ed1b017f-45f5-4609-9972-14991d203897/",
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
        {
            "name": "workflow_hg19lo_hgvsg-check",
            "jobid": "kZNfUWHW3HTK",
            "shard": "0",
            "output": [
                {
                    "file": {
                        "@id": "/files-processed/GAPFIRGHPIDQ/",
                        "status": "uploaded",
                        "display_title": "GAPFIRGHPIDQ.vcf.gz",
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
                "uuid": "5df3ef23-0e93-4510-8ebb-63ebcc1214a7",
                "@type": [
                    "WorkflowRunAwsem",
                    "WorkflowRun",
                    "Item"
                ],
                "display_title": "workflow_hg19lo_hgvsg-check v1.0.0 run 2022-04-30 06:10:40.434728",
                "status": "shared",
                "@id": "/workflow-runs-awsem/5df3ef23-0e93-4510-8ebb-63ebcc1214a7/",
                "output_files": [
                    {
                        "type": "Output processed file",
                        "value": {
                            "status": "uploaded",
                            "display_title": "GAPFIRGHPIDQ.vcf.gz",
                            "uuid": "77ae0d41-f922-4646-bee2-029deaefdf49",
                            "file_format": {
                                "@type": [
                                    "FileFormat",
                                    "Item"
                                ],
                                "status": "shared",
                                "display_title": "vcf_gz",
                                "uuid": "1b8f525f-aecb-4211-9ae5-a2c998b05599",
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
                            "file_size": 5196340,
                            "@id": "/files-processed/GAPFIRGHPIDQ/",
                            "@type": [
                                "FileProcessed",
                                "File",
                                "Item"
                            ],
                            "quality_metric": {
                                "uuid": "ac83094c-6bb2-4754-9573-ec6f9dc74ee5",
                                "@type": [
                                    "QualityMetricQclist",
                                    "QualityMetric",
                                    "Item"
                                ],
                                "display_title": "QualityMetricQclist from 2022-04-30",
                                "@id": "/quality-metrics-qclist/ac83094c-6bb2-4754-9573-ec6f9dc74ee5/",
                                "overall_quality_status": "PASS",
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
                            "workflow_run_inputs": [
                                {
                                    "@type": [
                                        "WorkflowRunAwsem",
                                        "WorkflowRun",
                                        "Item"
                                    ],
                                    "uuid": "b847a5ad-670e-4b3c-92be-a1d3e9951b99",
                                    "@id": "/workflow-runs-awsem/b847a5ad-670e-4b3c-92be-a1d3e9951b99/",
                                    "display_title": "workflow_granite-qcVCF v1.0.0 run 2022-04-30 06:40:35.011633",
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
                                {
                                    "@type": [
                                        "WorkflowRunAwsem",
                                        "WorkflowRun",
                                        "Item"
                                    ],
                                    "uuid": "106be8c3-5b02-4809-8205-4b7dae0fc375",
                                    "@id": "/workflow-runs-awsem/106be8c3-5b02-4809-8205-4b7dae0fc375/",
                                    "display_title": "bamsnap v1.0.0 run 2022-04-30 06:40:40.145843",
                                    "status": "shared",
                                    "principals_allowed": {
                                        "view": [
                                            "system.Authenticated"
                                        ],
                                        "edit": [
                                            "group.admin"
                                        ]
                                    }
                                }
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
                        "value_qc": "/quality-metrics-vcfcheck/72c24ef7-49bf-4e0c-9667-0a62f9f0397d/",
                        "workflow_argument_name": "vcf-check"
                    }
                ],
                "input_files": [
                    {
                        "value": {
                            "uuid": "352d3ace-c687-41de-9027-db84bf8af10a",
                            "file_format": {
                                "uuid": "1b8f525f-aecb-4211-9ae5-a2c998b05599",
                                "display_title": "vcf_gz",
                                "@type": [
                                    "FileFormat",
                                    "Item"
                                ],
                                "@id": "/file-formats/vcf_gz/",
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
                            "display_title": "GAPFI7UFWBGA.vcf.gz",
                            "file_size": 5033581,
                            "@type": [
                                "FileProcessed",
                                "File",
                                "Item"
                            ],
                            "@id": "/files-processed/GAPFI7UFWBGA/",
                            "status": "uploaded",
                            "workflow_run_outputs": [
                                {
                                    "status": "shared",
                                    "display_title": "workflow_dbSNP_ID_fixer-check v1.0.0 run 2022-04-30 05:40:37.109983",
                                    "@type": [
                                        "WorkflowRunAwsem",
                                        "WorkflowRun",
                                        "Item"
                                    ],
                                    "@id": "/workflow-runs-awsem/703d75f8-4fdf-4cb4-a65b-6181e1079660/",
                                    "uuid": "703d75f8-4fdf-4cb4-a65b-6181e1079660",
                                    "principals_allowed": {
                                        "view": [
                                            "system.Authenticated"
                                        ],
                                        "edit": [
                                            "group.admin"
                                        ]
                                    }
                                }
                            ],
                            "quality_metric": {
                                "uuid": "ed1b017f-45f5-4609-9972-14991d203897",
                                "overall_quality_status": "PASS",
                                "display_title": "QualityMetricQclist from 2022-04-30",
                                "@type": [
                                    "QualityMetricQclist",
                                    "QualityMetric",
                                    "Item"
                                ],
                                "status": "shared",
                                "@id": "/quality-metrics-qclist/ed1b017f-45f5-4609-9972-14991d203897/",
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
                            "file_format": {
                                "uuid": "dd1ef82d-da5e-4680-bd5c-cf471a87eb5b",
                                "display_title": "chain",
                                "@type": [
                                    "FileFormat",
                                    "Item"
                                ],
                                "@id": "/file-formats/chain/",
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
                            "display_title": "GAPFIYPTSAU8.chain.gz",
                            "file_size": 1246411,
                            "@type": [
                                "FileReference",
                                "File",
                                "Item"
                            ],
                            "@id": "/files-reference/GAPFIYPTSAU8/",
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
                        "workflow_argument_name": "chainfile"
                    }
                ],
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
        {
            "name": "workflow_granite-qcVCF-7",
            "jobid": "m0GqurQz0XA4",
            "shard": "0",
            "status": "completed",
            "dependencies": [
                "workflow_hg19lo_hgvsg-check:0"
            ],
            "workflow_run": {
                "uuid": "b847a5ad-670e-4b3c-92be-a1d3e9951b99",
                "@type": [
                    "WorkflowRunAwsem",
                    "WorkflowRun",
                    "Item"
                ],
                "display_title": "workflow_granite-qcVCF v1.0.0 run 2022-04-30 06:40:35.011633",
                "status": "shared",
                "@id": "/workflow-runs-awsem/b847a5ad-670e-4b3c-92be-a1d3e9951b99/",
                "output_files": [
                    {
                        "type": "Output QC file",
                        "value_qc": "/quality-metrics-vcfqc/866988a5-2aa3-4f27-a103-1d17b3dd0fcc/",
                        "workflow_argument_name": "qc_json"
                    },
                    {
                        "type": "Output QC file",
                        "value_qc": "/quality-metrics-vcfqc/866988a5-2aa3-4f27-a103-1d17b3dd0fcc/",
                        "workflow_argument_name": "uniq_variants"
                    }
                ],
                "input_files": [
                    {
                        "value": {
                            "uuid": "77ae0d41-f922-4646-bee2-029deaefdf49",
                            "file_format": {
                                "uuid": "1b8f525f-aecb-4211-9ae5-a2c998b05599",
                                "display_title": "vcf_gz",
                                "@type": [
                                    "FileFormat",
                                    "Item"
                                ],
                                "@id": "/file-formats/vcf_gz/",
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
                            "display_title": "GAPFIRGHPIDQ.vcf.gz",
                            "file_size": 5196340,
                            "@type": [
                                "FileProcessed",
                                "File",
                                "Item"
                            ],
                            "@id": "/files-processed/GAPFIRGHPIDQ/",
                            "status": "uploaded",
                            "workflow_run_outputs": [
                                {
                                    "status": "shared",
                                    "display_title": "workflow_hg19lo_hgvsg-check v1.0.0 run 2022-04-30 06:10:40.434728",
                                    "@type": [
                                        "WorkflowRunAwsem",
                                        "WorkflowRun",
                                        "Item"
                                    ],
                                    "@id": "/workflow-runs-awsem/5df3ef23-0e93-4510-8ebb-63ebcc1214a7/",
                                    "uuid": "5df3ef23-0e93-4510-8ebb-63ebcc1214a7",
                                    "principals_allowed": {
                                        "view": [
                                            "system.Authenticated"
                                        ],
                                        "edit": [
                                            "group.admin"
                                        ]
                                    }
                                }
                            ],
                            "quality_metric": {
                                "uuid": "ac83094c-6bb2-4754-9573-ec6f9dc74ee5",
                                "overall_quality_status": "PASS",
                                "display_title": "QualityMetricQclist from 2022-04-30",
                                "@type": [
                                    "QualityMetricQclist",
                                    "QualityMetric",
                                    "Item"
                                ],
                                "status": "shared",
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
                    }
                ],
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
        {
            "name": "bamsnap",
            "jobid": "79NRQiUCqvD9",
            "shard": "0",
            "status": "completed",
            "dependencies": [
                "workflow_hg19lo_hgvsg-check:0"
            ],
            "workflow_run": {
                "uuid": "106be8c3-5b02-4809-8205-4b7dae0fc375",
                "@type": [
                    "WorkflowRunAwsem",
                    "WorkflowRun",
                    "Item"
                ],
                "display_title": "bamsnap v1.0.0 run 2022-04-30 06:40:40.145843",
                "status": "shared",
                "@id": "/workflow-runs-awsem/106be8c3-5b02-4809-8205-4b7dae0fc375/",
                "output_files": [
                    {
                        "type": "Output QC file",
                        "workflow_argument_name": "bamsnap_images"
                    }
                ],
                "input_files": [
                    {
                        "value": {
                            "uuid": "676dd0c1-82c4-41be-9ae7-619ce47e158e",
                            "file_format": {
                                "uuid": "d13d06cf-218e-4f61-aaf0-91f226248b3c",
                                "display_title": "bam",
                                "@type": [
                                    "FileFormat",
                                    "Item"
                                ],
                                "@id": "/file-formats/bam/",
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
                            "display_title": "GAPFIMIARUOB.bam",
                            "file_size": 106616301305,
                            "@type": [
                                "FileProcessed",
                                "File",
                                "Item"
                            ],
                            "@id": "/files-processed/GAPFIMIARUOB/",
                            "status": "uploaded",
                            "workflow_run_outputs": [
                                {
                                    "status": "shared",
                                    "display_title": "workflow_sentieon_dedup-recal v1.0.0 run 2022-04-29 04:25:35.950498",
                                    "@type": [
                                        "WorkflowRunAwsem",
                                        "WorkflowRun",
                                        "Item"
                                    ],
                                    "@id": "/workflow-runs-awsem/784f3f5f-d3cf-432b-8c0f-3dcd957b2042/",
                                    "uuid": "784f3f5f-d3cf-432b-8c0f-3dcd957b2042",
                                    "principals_allowed": {
                                        "view": [
                                            "system.Authenticated"
                                        ],
                                        "edit": [
                                            "group.admin"
                                        ]
                                    }
                                }
                            ],
                            "quality_metric": {
                                "uuid": "b5978c20-271c-4ac4-8407-8b3fd3c0bb86",
                                "overall_quality_status": "PASS",
                                "display_title": "QualityMetricBamqc from 2022-04-29",
                                "@type": [
                                    "QualityMetricBamqc",
                                    "QualityMetric",
                                    "Item"
                                ],
                                "status": "shared",
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
                            "uuid": "6d199319-3719-4a42-8883-365072bc13b3",
                            "file_format": {
                                "uuid": "d13d06cf-218e-4f61-aaf0-91f226248b3c",
                                "display_title": "bam",
                                "@type": [
                                    "FileFormat",
                                    "Item"
                                ],
                                "@id": "/file-formats/bam/",
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
                            "display_title": "GAPFICEE9LEN.bam",
                            "file_size": 104992897560,
                            "@type": [
                                "FileProcessed",
                                "File",
                                "Item"
                            ],
                            "@id": "/files-processed/GAPFICEE9LEN/",
                            "status": "uploaded",
                            "workflow_run_outputs": [
                                {
                                    "status": "shared",
                                    "display_title": "workflow_sentieon_dedup-recal v1.0.0 run 2022-04-29 04:25:39.481922",
                                    "@type": [
                                        "WorkflowRunAwsem",
                                        "WorkflowRun",
                                        "Item"
                                    ],
                                    "@id": "/workflow-runs-awsem/25d04009-a2fe-481b-ada7-da5c1216d52e/",
                                    "uuid": "25d04009-a2fe-481b-ada7-da5c1216d52e",
                                    "principals_allowed": {
                                        "view": [
                                            "system.Authenticated"
                                        ],
                                        "edit": [
                                            "group.admin"
                                        ]
                                    }
                                }
                            ],
                            "quality_metric": {
                                "uuid": "23408f2f-13ca-49d6-b8bf-162623795dd6",
                                "overall_quality_status": "PASS",
                                "display_title": "QualityMetricBamqc from 2022-04-29",
                                "@type": [
                                    "QualityMetricBamqc",
                                    "QualityMetric",
                                    "Item"
                                ],
                                "status": "shared",
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
                            "uuid": "222ce0eb-22f8-40e3-87d5-f2708ad18393",
                            "file_format": {
                                "uuid": "d13d06cf-218e-4f61-aaf0-91f226248b3c",
                                "display_title": "bam",
                                "@type": [
                                    "FileFormat",
                                    "Item"
                                ],
                                "@id": "/file-formats/bam/",
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
                            "display_title": "GAPFITNHTOZI.bam",
                            "file_size": 111610806810,
                            "@type": [
                                "FileProcessed",
                                "File",
                                "Item"
                            ],
                            "@id": "/files-processed/GAPFITNHTOZI/",
                            "status": "uploaded",
                            "workflow_run_outputs": [
                                {
                                    "status": "shared",
                                    "display_title": "workflow_sentieon_dedup-recal v1.0.0 run 2022-04-29 04:25:46.368031",
                                    "@type": [
                                        "WorkflowRunAwsem",
                                        "WorkflowRun",
                                        "Item"
                                    ],
                                    "@id": "/workflow-runs-awsem/d4b58584-ecc6-41ad-a0ce-81d4b600b033/",
                                    "uuid": "d4b58584-ecc6-41ad-a0ce-81d4b600b033",
                                    "principals_allowed": {
                                        "view": [
                                            "system.Authenticated"
                                        ],
                                        "edit": [
                                            "group.admin"
                                        ]
                                    }
                                }
                            ],
                            "quality_metric": {
                                "uuid": "5530ced5-5252-42f2-afde-0d14e30a669b",
                                "overall_quality_status": "PASS",
                                "display_title": "QualityMetricBamqc from 2022-04-29",
                                "@type": [
                                    "QualityMetricBamqc",
                                    "QualityMetric",
                                    "Item"
                                ],
                                "status": "shared",
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
                            "uuid": "77ae0d41-f922-4646-bee2-029deaefdf49",
                            "file_format": {
                                "uuid": "1b8f525f-aecb-4211-9ae5-a2c998b05599",
                                "display_title": "vcf_gz",
                                "@type": [
                                    "FileFormat",
                                    "Item"
                                ],
                                "@id": "/file-formats/vcf_gz/",
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
                            "display_title": "GAPFIRGHPIDQ.vcf.gz",
                            "file_size": 5196340,
                            "@type": [
                                "FileProcessed",
                                "File",
                                "Item"
                            ],
                            "@id": "/files-processed/GAPFIRGHPIDQ/",
                            "status": "uploaded",
                            "workflow_run_outputs": [
                                {
                                    "status": "shared",
                                    "display_title": "workflow_hg19lo_hgvsg-check v1.0.0 run 2022-04-30 06:10:40.434728",
                                    "@type": [
                                        "WorkflowRunAwsem",
                                        "WorkflowRun",
                                        "Item"
                                    ],
                                    "@id": "/workflow-runs-awsem/5df3ef23-0e93-4510-8ebb-63ebcc1214a7/",
                                    "uuid": "5df3ef23-0e93-4510-8ebb-63ebcc1214a7",
                                    "principals_allowed": {
                                        "view": [
                                            "system.Authenticated"
                                        ],
                                        "edit": [
                                            "group.admin"
                                        ]
                                    }
                                }
                            ],
                            "quality_metric": {
                                "uuid": "ac83094c-6bb2-4754-9573-ec6f9dc74ee5",
                                "overall_quality_status": "PASS",
                                "display_title": "QualityMetricQclist from 2022-04-30",
                                "@type": [
                                    "QualityMetricQclist",
                                    "QualityMetric",
                                    "Item"
                                ],
                                "status": "shared",
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
                            "uuid": "1936f246-22e1-45dc-bb5c-9cfd55537fe7",
                            "file_format": {
                                "uuid": "5ced774b-a73e-4d1b-8186-d7fbbde7a3c2",
                                "display_title": "fa",
                                "@type": [
                                    "FileFormat",
                                    "Item"
                                ],
                                "@id": "/file-formats/fa/",
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
                            "display_title": "GAPFIXRDPDK5.fa",
                            "file_size": 3263683042,
                            "@type": [
                                "FileReference",
                                "File",
                                "Item"
                            ],
                            "@id": "/files-reference/GAPFIXRDPDK5/",
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
                        "workflow_argument_name": "ref"
                    }
                ],
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

export function transformMetaWorkflowRunToSteps (metaWorkflowRunItem) {
    // TODO
    const {
        workflow_runs = [],
        meta_workflow = {},
        // No longer used
        // input:  mwfrInputList = []
    } = metaWorkflowRunItem;

    const { workflows = [] } = meta_workflow;
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
            // Deep-copy (or selectively deep copy), else "input" list/object references from workflow
            // will be shared between different runs of same workflow.
            ...JSON.parse(JSON.stringify(workflowForRun)),
            ...workflowRun
        };
    });

    const incompleteSteps = combinedMWFRs.map(function(workflowRunObject){
        const {
            // This 'name' is same as workflow name, we don't use it because want unique name/identifier for each step.
            // name,
            workflow,
            workflow_run: {
                display_title,
                "@id": workflowRunAtID,
                input_files: wfrItemInputFileObjects,
                output_files: wfrItemOutputFileObjects,
                parameters: wfrItemInputParameters
            },
            input = [],
            output = []
        } = workflowRunObject;

        const inputFileObjectsGroupedByArgName  = _.groupBy(wfrItemInputFileObjects, "workflow_argument_name");
        const inputParametersGroupedByArgName   = _.groupBy(wfrItemInputParameters, "workflow_argument_name");
        const outputFileObjectsGroupedByArgName = _.groupBy(wfrItemOutputFileObjects, "workflow_argument_name");

        const initialStep = {
            // name,
            "name": workflowRunAtID,
            "meta": {
                "@id": workflowRunAtID,
                workflow,
                display_title,
                "analysis_types": "dummy analysis type",
            },
            "inputs": [],
            "outputs": []
        };


        input.forEach(function(wfrObjectInputObject){
            const {
                argument_name,
                argument_type,
                source: mwfrSourceStepName,
                source_argument_name,
                // files = [],
                // value: nonFileValue
            } = wfrObjectInputObject;

            // Each file contains "workflow_run_outputs" (WFR it came from) + "workflow_run_inputs" (WFR it going to) (if applicable)
            const filesForThisInput = inputFileObjectsGroupedByArgName[argument_name] || [];
            const filesLen = filesForThisInput.length;

            const parametersForThisInput = inputParametersGroupedByArgName[argument_name] || [];
            const paramsLen = parametersForThisInput.length;

            const initialSource = {
                "name": source_argument_name || argument_name
            };

            const initialSourceList = [];

            if (filesLen > 0) {
                filesForThisInput.forEach(function(fileObject){
                    const { value: fileItem } = fileObject;
                    const { "@id": fileAtID, workflow_run_outputs = [] } = fileItem || {};
                    const [ { "@id": outputOfWFRAtID } = {} ] = workflow_run_outputs;
                    const sourceObject = { ...initialSource, "for_file": fileAtID };
                    if (outputOfWFRAtID) {
                        sourceObject.step = outputOfWFRAtID;
                    }
                    initialSourceList.push(sourceObject);
                });
            } else {
                initialSourceList.push(initialSource);
            }

            const isParameter = argument_type === "parameter";

            let isReferenceFileInput = false;
            if (filesLen > 0) {
                isReferenceFileInput = _.every(filesForThisInput, function(fileObject){
                    const { value: fileItem } = fileObject;
                    const { "@type": fileAtType } = fileItem || {};
                    return fileAtType.indexOf("FileReference") > -1;
                });
            }

            const stepInputObject = {
                "name": argument_name,
                "source": initialSourceList,
                "meta": {
                    // TODO: Reconsider this evaluation of "global"
                    "global": !mwfrSourceStepName,
                    // TODO: It seems all MWFR output files provided are 'in-path' and we don't see the indirect files
                    // in the MWFR.workflow_runs.outputs. If this changes (or is currently inaccurate) maybe we can infer or
                    // have "in_path=false" added to those outputs and then enable the "Show Indirect Files" checkbox.
                    "in_path": true,
                    "type": (
                        // Don't need to set QC or report for input... I think...
                        isParameter ? "parameter"
                            : isReferenceFileInput ? "reference file"
                                : filesLen > 0 ? "data file"
                                    : null
                    ),
                    // "cardinality": // TODO maybe
                },
                "run_data": {
                    "type": isParameter ? "parameter" : "input"
                }
            };

            if (filesLen > 0) {
                stepInputObject.run_data.file = _.pluck(filesForThisInput, "value");
                stepInputObject.run_data.meta = filesForThisInput.map(function({ value, ...remainingProperties }){
                    return remainingProperties;
                });
            } else if (paramsLen > 0) { // WorkflowViz supports only 1 parameter per input argument at time being.
                const [ firstParameterObject ] = parametersForThisInput;
                const { value, ...remainingFirstParameterObjectProperties } = firstParameterObject;
                // We can have multiple values but only 1 'meta' object.
                stepInputObject.run_data.value = _.pluck(parametersForThisInput, "value");
                stepInputObject.run_data.meta = remainingFirstParameterObjectProperties;
            }

            initialStep.inputs.push(stepInputObject);
        });


        output.forEach(function(wfrOutputObject){

            const {
                argument_name,
                argument_type,
                //source: mwfrSourceStepName,
                source_argument_name,
                file,
                value: nonFileValue
            } = wfrOutputObject;

            // Each file contains "workflow_run_outputs" (WFR it came from) + "workflow_run_inputs" (WFR it going to) (if applicable)
            const [ outputFileObject ] = outputFileObjectsGroupedByArgName[argument_name] || [];

            const initialTargetList = [];
            const initialTarget = {
                "name": source_argument_name || argument_name
            };


            if (outputFileObject) {
                const { value: fileItem } = outputFileObject;
                const { "@id": fileAtID, workflow_run_inputs = [] } = fileItem || {};
                //const { "@id": outputOfWFRAtID } = workflow_run_output || {};
                if (workflow_run_inputs.length > 0){
                    workflow_run_inputs.forEach(function(inputOfWFR){
                        const { "@id": inputOfWFRAtID } = inputOfWFR || {};
                        // TODO: Exclude targets that aren't in MWFR.workflow_runs
                        const targetObject = {
                            ...initialTarget,
                            "for_file": fileAtID,
                            "step": inputOfWFRAtID
                        };
                        initialTargetList.push(targetObject);
                    });
                } else {
                    initialTargetList.push({ ...initialTarget, "for_file": fileAtID });
                }
            } else {
                initialTargetList.push(initialTarget);
            }

            // if (file) {
            //     const { "@id": fileAtID } = file || {};
            //     initialTargetList.push( { ...initialTarget, "for_file": fileAtID } );
            // } else {
            //     initialTargetList.push(initialTarget);
            // }


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

            if (outputFileObject) {
                stepOutputObject.run_data.file = [ outputFileObject.value ];
                stepOutputObject.run_data.meta = [ { "type": "Output processed file" } ];
            }

            // TODO handle 'nonFileValue' if needed.

            initialStep.outputs.push(stepOutputObject);

        });

        return initialStep;

    });

    return incompleteSteps;
}

/**
 * Converts all step names (and sources/targets' step names) to integers.
 *
 * @todo Improve if needed.
 * @todo Move into ReactWorkflowViz project.
 */
function identifiersToIntegers(steps){
    const nameDict = {};

    function convertNameToInt(name){
        let returnInt;
        const existingInt = nameDict[name];
        if (typeof existingInt === "undefined") {
            // Start count from 1.
            returnInt = nameDict[name] = Object.keys(nameDict).length + 1;
        } else {
            returnInt = existingInt;
        }
        return returnInt;
    }

    steps.forEach(function(step){
        const { name, inputs = [], outputs = [] } = step;
        step.name = convertNameToInt(name);
        inputs.forEach(function({ source = [] }){
            source.forEach(function(sourceEntry){
                if (!sourceEntry.step) return;
                sourceEntry.step = convertNameToInt(sourceEntry.step);
            });
        });
        outputs.forEach(function({ target = [] }){
            target.forEach(function(targetEntry){
                if (!targetEntry.step) return;
                targetEntry.step = convertNameToInt(targetEntry.step);
            });
        });

    });
    return steps;
}


function MetaWorkflowRunDataTransformer(props){
    const { context, children } = props;
    // TODO: parse context.workflow_runs, context.meta_workflow, context.input, etc...

    const steps = useMemo(function(){
        return identifiersToIntegers(transformMetaWorkflowRunToSteps(TEMPORARY_DUMMY_CONTEXT));
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
        this.onToggleIndirectFiles      = _.throttle(this.onToggleIndirectFiles.bind(this), 1000);
        this.onChangeRowSpacingType     = _.throttle(this.onChangeRowSpacingType.bind(this), 1000, { trailing : false });
        this.renderDetailPane = this.renderDetailPane.bind(this);
        this.renderNodeElement = this.renderNodeElement.bind(this);

        this.memoized = {
            parseAnalysisSteps : memoize(parseAnalysisSteps),
            checkIfIndirectOrReferenceNodesExist : memoize(checkIfIndirectOrReferenceNodesExist)
        };

        this.state = {
            'showParameters' : false,
            'showReferenceFiles' : false,
            'rowSpacingType' : 'compact',
            'showIndirectFiles': false
        };
    }


    parseAnalysisSteps(steps){
        const { showReferenceFiles, showParameters, showIndirectFiles } = this.state;
        const parsingOptions = { showReferenceFiles, showParameters, "showIndirectFiles": true };
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
            rowSpacingType,
            renderDetailPane: this.renderDetailPane,
            renderNodeElement: this.renderNodeElement
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

    onToggleIndirectFiles(){
        this.setState(function({ showIndirectFiles }){
            return { 'showIndirectFiles' : !showIndirectFiles };
        });
    }

    onChangeRowSpacingType(eventKey, evt){
        this.setState(function({ rowSpacingType }){
            if (eventKey === rowSpacingType) return null;
            return { 'rowSpacingType' : eventKey };
        });
    }

    renderNodeElement(node, graphProps){
        const { windowWidth, schemas } = this.props;
        return <WorkflowNodeElement {...graphProps} schemas={schemas} windowWidth={windowWidth} node={node}/>;
    }

    renderDetailPane(node, graphProps){
        const { context, schemas } = this.props;
        return <WorkflowDetailPane {...graphProps} {...{ context, node, schemas }} />;
    }

    render(){
        const { rowSpacingType, showParameters, showReferenceFiles, showIndirectFiles } = this.state;
        const { context, mounted, width, steps = [] } = this.props;
        const { anyIndirectPathIONodes, anyReferenceFileNodes } = this.memoized.checkIfIndirectOrReferenceNodesExist(context.steps);

        let body = null;
        if (!Array.isArray(steps) || !mounted) {
            body = null;
        } else {
            body = (
                <Graph { ...this.commonGraphProps() } />
            );
        }

        return (
            <div className="tabview-container-fullscreen-capable workflow-view-container workflow-viewing-detail">
                <h3 className="tab-section-title container-wide">
                    <span>Graph</span>
                    <WorkflowGraphSectionControls
                        {..._.pick(this.props, 'context', 'href', 'windowWidth')}
                        showChartType="detail"
                        rowSpacingType={rowSpacingType}
                        // Parameters are available but not visualized because of high number of them
                        // In future, need to adjust ReactWorkflowViz parsing code to re-use paramater nodes
                        // of same value and same/similar target, if possible.
                        // showParameters={showParameters}
                        showReferenceFiles={showReferenceFiles}
                        // `showIndirectFiles=false` doesn't currently work in parsing for MWFRs, needs research.
                        // showIndirectFiles={showIndirectFiles}
                        onRowSpacingTypeSelect={this.onChangeRowSpacingType}
                        // onToggleShowParameters={this.onToggleShowParameters}
                        onToggleReferenceFiles={this.onToggleReferenceFiles}
                        // onToggleIndirectFiles={this.onToggleIndirectFiles}
                        isReferenceFilesCheckboxDisabled={!anyReferenceFileNodes}
                    />
                </h3>
                <hr className="tab-section-title-horiz-divider"/>
                { body }
            </div>
        );

    }

}

