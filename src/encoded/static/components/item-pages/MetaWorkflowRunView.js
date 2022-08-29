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
                        "uuid": "90d5572a-3cb5-40bd-8cec-68346c28705b",
                        "status": "uploaded",
                        "@id": "/files-processed/GAPFI9CNINA2/",
                        "display_title": "GAPFI9CNINA2.rck.gz",
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
                "display_title": "workflow_granite-mpileupCounts v1.0.0 run 2022-04-29 17:10:35.675189",
                "status": "shared",
                "@type": [
                    "WorkflowRunAwsem",
                    "WorkflowRun",
                    "Item"
                ],
                "uuid": "d9b35c06-6911-4b67-ac04-395331a98e55",
                "@id": "/workflow-runs-awsem/d9b35c06-6911-4b67-ac04-395331a98e55/",
                "output_files": [
                    {
                        "value": {
                            "uuid": "90d5572a-3cb5-40bd-8cec-68346c28705b",
                            "status": "uploaded",
                            "@type": [
                                "FileProcessed",
                                "File",
                                "Item"
                            ],
                            "display_title": "GAPFI9CNINA2.rck.gz",
                            "@id": "/files-processed/GAPFI9CNINA2/",
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
                            },
                            "workflow_run_inputs": [
                                {
                                    "display_title": "workflow_granite-rckTar v1.0.0 run 2022-04-29 21:10:35.118284",
                                    "@id": "/workflow-runs-awsem/6fb5a7f0-2156-49e3-bf42-95f4e8decdde/",
                                    "status": "shared",
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
                                    }
                                }
                            ]
                        }
                    }
                ],
                "input_files": [
                    {
                        "value": {
                            "uuid": "676dd0c1-82c4-41be-9ae7-619ce47e158e",
                            "@type": [
                                "FileProcessed",
                                "File",
                                "Item"
                            ],
                            "status": "uploaded",
                            "@id": "/files-processed/GAPFIMIARUOB/",
                            "display_title": "GAPFIMIARUOB.bam",
                            "workflow_run_inputs": [
                                {
                                    "@type": [
                                        "WorkflowRunAwsem",
                                        "WorkflowRun",
                                        "Item"
                                    ],
                                    "display_title": "workflow_granite-mpileupCounts v1.0.0 run 2022-04-29 17:10:35.675189",
                                    "@id": "/workflow-runs-awsem/d9b35c06-6911-4b67-ac04-395331a98e55/",
                                    "status": "shared",
                                    "uuid": "d9b35c06-6911-4b67-ac04-395331a98e55",
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
                                    "display_title": "workflow_gatk-HaplotypeCaller v1.0.0 run 2022-04-29 17:10:52.092723",
                                    "@id": "/workflow-runs-awsem/d2063a22-99c7-420e-b179-6daedad12499/",
                                    "status": "shared",
                                    "uuid": "d2063a22-99c7-420e-b179-6daedad12499",
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
                                    "display_title": "cgap-bamqc v1.0.0 run 2022-04-29 09:10:34.237529",
                                    "@id": "/workflow-runs-awsem/332fdc52-268c-41ad-a408-a0def871afe9/",
                                    "status": "shared",
                                    "uuid": "332fdc52-268c-41ad-a408-a0def871afe9",
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
                                    "display_title": "bamsnap v1.0.0 run 2022-04-30 06:40:40.145843",
                                    "@id": "/workflow-runs-awsem/106be8c3-5b02-4809-8205-4b7dae0fc375/",
                                    "status": "shared",
                                    "uuid": "106be8c3-5b02-4809-8205-4b7dae0fc375",
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
                                    "display_title": "workflow_manta_vcf-check v1.0.0 run 2022-05-03 13:27:54.696531",
                                    "@id": "/workflow-runs-awsem/a535c8dd-bb2d-4ef3-9f39-c09ed7679043/",
                                    "status": "shared",
                                    "uuid": "a535c8dd-bb2d-4ef3-9f39-c09ed7679043",
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
                                    "display_title": "workflow_manta_vcf-check v1.0.0 run 2022-06-14 15:25:38.395763",
                                    "@id": "/workflow-runs-awsem/faddea10-4887-41ae-906c-f3709be988d6/",
                                    "status": "shared",
                                    "uuid": "faddea10-4887-41ae-906c-f3709be988d6",
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
                                    "display_title": "workflow_manta_vcf-check v1.0.0 run 2022-06-14 20:40:38.996289",
                                    "@id": "/workflow-runs-awsem/1b859a33-6e53-41ca-92fc-ab391a832fdf/",
                                    "status": "shared",
                                    "uuid": "1b859a33-6e53-41ca-92fc-ab391a832fdf",
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
                                    "display_title": "workflow_manta_vcf-check v1.0.0 run 2022-06-28 14:40:37.869039",
                                    "@id": "/workflow-runs-awsem/72b695ed-074c-4d4f-b338-17f4ebd93167/",
                                    "status": "shared",
                                    "uuid": "72b695ed-074c-4d4f-b338-17f4ebd93167",
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
                                    "display_title": "workflow_manta_vcf-check v1.0.0 run 2022-06-30 21:25:38.318616",
                                    "@id": "/workflow-runs-awsem/4ba17f94-6a12-4890-b9e2-db7c2b9a4506/",
                                    "status": "shared",
                                    "uuid": "4ba17f94-6a12-4890-b9e2-db7c2b9a4506",
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
                                    "display_title": "workflow_manta_vcf-check v1.0.0 run 2022-06-30 19:10:43.701945",
                                    "@id": "/workflow-runs-awsem/b0f2cd76-015b-4449-ba5e-f92194729143/",
                                    "status": "shared",
                                    "uuid": "b0f2cd76-015b-4449-ba5e-f92194729143",
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
                                    "display_title": "workflow_manta_vcf-check v1.0.0 run 2022-07-05 18:40:37.676855",
                                    "@id": "/workflow-runs-awsem/68209cd5-987b-47e0-a719-682a2700d340/",
                                    "status": "shared",
                                    "uuid": "68209cd5-987b-47e0-a719-682a2700d340",
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
                            },
                            "workflow_run_outputs": [
                                {
                                    "display_title": "workflow_sentieon_dedup-recal v1.0.0 run 2022-04-29 04:25:35.950498",
                                    "@type": [
                                        "WorkflowRunAwsem",
                                        "WorkflowRun",
                                        "Item"
                                    ],
                                    "status": "shared",
                                    "uuid": "784f3f5f-d3cf-432b-8c0f-3dcd957b2042",
                                    "@id": "/workflow-runs-awsem/784f3f5f-d3cf-432b-8c0f-3dcd957b2042/",
                                    "principals_allowed": {
                                        "view": [
                                            "system.Authenticated"
                                        ],
                                        "edit": [
                                            "group.admin"
                                        ]
                                    }
                                }
                            ]
                        }
                    },
                    {
                        "value": {
                            "uuid": "1936f246-22e1-45dc-bb5c-9cfd55537fe7",
                            "@type": [
                                "FileReference",
                                "File",
                                "Item"
                            ],
                            "status": "uploaded",
                            "@id": "/files-reference/GAPFIXRDPDK5/",
                            "display_title": "GAPFIXRDPDK5.fa",
                            "principals_allowed": {
                                "view": [
                                    "editor_for.12a92962-8265-4fc0-b2f8-cf14f05db58b",
                                    "group.admin",
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
                        "value": {
                            "uuid": "1c07a3aa-e2a3-498c-b838-15991c4a2f28",
                            "@type": [
                                "FileReference",
                                "File",
                                "Item"
                            ],
                            "status": "uploaded",
                            "@id": "/files-reference/GAPFIBGEOI72/",
                            "display_title": "GAPFIBGEOI72.txt",
                            "principals_allowed": {
                                "view": [
                                    "editor_for.12a92962-8265-4fc0-b2f8-cf14f05db58b",
                                    "group.admin",
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
                        "uuid": "76111407-5e86-48dd-bd13-f3a167638140",
                        "status": "uploaded",
                        "@id": "/files-processed/GAPFID5AE9ME/",
                        "display_title": "GAPFID5AE9ME.rck.gz",
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
                "display_title": "workflow_granite-mpileupCounts v1.0.0 run 2022-04-29 17:10:38.581075",
                "status": "shared",
                "@type": [
                    "WorkflowRunAwsem",
                    "WorkflowRun",
                    "Item"
                ],
                "uuid": "8bca34d8-54c4-4de8-9057-ffb868d44795",
                "@id": "/workflow-runs-awsem/8bca34d8-54c4-4de8-9057-ffb868d44795/",
                "output_files": [
                    {
                        "value": {
                            "uuid": "76111407-5e86-48dd-bd13-f3a167638140",
                            "status": "uploaded",
                            "@type": [
                                "FileProcessed",
                                "File",
                                "Item"
                            ],
                            "display_title": "GAPFID5AE9ME.rck.gz",
                            "@id": "/files-processed/GAPFID5AE9ME/",
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
                            },
                            "workflow_run_inputs": [
                                {
                                    "display_title": "workflow_granite-rckTar v1.0.0 run 2022-04-29 21:10:35.118284",
                                    "@id": "/workflow-runs-awsem/6fb5a7f0-2156-49e3-bf42-95f4e8decdde/",
                                    "status": "shared",
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
                                    }
                                }
                            ]
                        }
                    }
                ],
                "input_files": [
                    {
                        "value": {
                            "uuid": "6d199319-3719-4a42-8883-365072bc13b3",
                            "@type": [
                                "FileProcessed",
                                "File",
                                "Item"
                            ],
                            "status": "uploaded",
                            "@id": "/files-processed/GAPFICEE9LEN/",
                            "display_title": "GAPFICEE9LEN.bam",
                            "workflow_run_inputs": [
                                {
                                    "@type": [
                                        "WorkflowRunAwsem",
                                        "WorkflowRun",
                                        "Item"
                                    ],
                                    "display_title": "cgap-bamqc v1.0.0 run 2022-04-29 09:10:37.940754",
                                    "@id": "/workflow-runs-awsem/a3c19fdd-436c-40bd-a3e6-9cc5e93c0da5/",
                                    "status": "shared",
                                    "uuid": "a3c19fdd-436c-40bd-a3e6-9cc5e93c0da5",
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
                                    "display_title": "workflow_granite-mpileupCounts v1.0.0 run 2022-04-29 17:10:38.581075",
                                    "@id": "/workflow-runs-awsem/8bca34d8-54c4-4de8-9057-ffb868d44795/",
                                    "status": "shared",
                                    "uuid": "8bca34d8-54c4-4de8-9057-ffb868d44795",
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
                                    "display_title": "workflow_gatk-HaplotypeCaller v1.0.0 run 2022-04-29 17:10:58.741225",
                                    "@id": "/workflow-runs-awsem/a59335b9-d462-4578-b718-0fc54428cc77/",
                                    "status": "shared",
                                    "uuid": "a59335b9-d462-4578-b718-0fc54428cc77",
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
                                    "display_title": "bamsnap v1.0.0 run 2022-04-30 06:40:40.145843",
                                    "@id": "/workflow-runs-awsem/106be8c3-5b02-4809-8205-4b7dae0fc375/",
                                    "status": "shared",
                                    "uuid": "106be8c3-5b02-4809-8205-4b7dae0fc375",
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
                                    "display_title": "workflow_manta_vcf-check v1.0.0 run 2022-05-03 13:27:54.696531",
                                    "@id": "/workflow-runs-awsem/a535c8dd-bb2d-4ef3-9f39-c09ed7679043/",
                                    "status": "shared",
                                    "uuid": "a535c8dd-bb2d-4ef3-9f39-c09ed7679043",
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
                                    "display_title": "workflow_manta_vcf-check v1.0.0 run 2022-06-14 15:25:38.395763",
                                    "@id": "/workflow-runs-awsem/faddea10-4887-41ae-906c-f3709be988d6/",
                                    "status": "shared",
                                    "uuid": "faddea10-4887-41ae-906c-f3709be988d6",
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
                                    "display_title": "workflow_manta_vcf-check v1.0.0 run 2022-06-14 20:40:38.996289",
                                    "@id": "/workflow-runs-awsem/1b859a33-6e53-41ca-92fc-ab391a832fdf/",
                                    "status": "shared",
                                    "uuid": "1b859a33-6e53-41ca-92fc-ab391a832fdf",
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
                                    "display_title": "workflow_manta_vcf-check v1.0.0 run 2022-06-28 14:40:37.869039",
                                    "@id": "/workflow-runs-awsem/72b695ed-074c-4d4f-b338-17f4ebd93167/",
                                    "status": "shared",
                                    "uuid": "72b695ed-074c-4d4f-b338-17f4ebd93167",
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
                                    "display_title": "workflow_manta_vcf-check v1.0.0 run 2022-06-30 21:25:38.318616",
                                    "@id": "/workflow-runs-awsem/4ba17f94-6a12-4890-b9e2-db7c2b9a4506/",
                                    "status": "shared",
                                    "uuid": "4ba17f94-6a12-4890-b9e2-db7c2b9a4506",
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
                                    "display_title": "workflow_manta_vcf-check v1.0.0 run 2022-06-30 19:10:43.701945",
                                    "@id": "/workflow-runs-awsem/b0f2cd76-015b-4449-ba5e-f92194729143/",
                                    "status": "shared",
                                    "uuid": "b0f2cd76-015b-4449-ba5e-f92194729143",
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
                                    "display_title": "workflow_manta_vcf-check v1.0.0 run 2022-07-05 18:40:37.676855",
                                    "@id": "/workflow-runs-awsem/68209cd5-987b-47e0-a719-682a2700d340/",
                                    "status": "shared",
                                    "uuid": "68209cd5-987b-47e0-a719-682a2700d340",
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
                            },
                            "workflow_run_outputs": [
                                {
                                    "display_title": "workflow_sentieon_dedup-recal v1.0.0 run 2022-04-29 04:25:39.481922",
                                    "@type": [
                                        "WorkflowRunAwsem",
                                        "WorkflowRun",
                                        "Item"
                                    ],
                                    "status": "shared",
                                    "uuid": "25d04009-a2fe-481b-ada7-da5c1216d52e",
                                    "@id": "/workflow-runs-awsem/25d04009-a2fe-481b-ada7-da5c1216d52e/",
                                    "principals_allowed": {
                                        "view": [
                                            "system.Authenticated"
                                        ],
                                        "edit": [
                                            "group.admin"
                                        ]
                                    }
                                }
                            ]
                        }
                    },
                    {
                        "value": {
                            "uuid": "1936f246-22e1-45dc-bb5c-9cfd55537fe7",
                            "@type": [
                                "FileReference",
                                "File",
                                "Item"
                            ],
                            "status": "uploaded",
                            "@id": "/files-reference/GAPFIXRDPDK5/",
                            "display_title": "GAPFIXRDPDK5.fa",
                            "principals_allowed": {
                                "view": [
                                    "editor_for.12a92962-8265-4fc0-b2f8-cf14f05db58b",
                                    "group.admin",
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
                        "value": {
                            "uuid": "1c07a3aa-e2a3-498c-b838-15991c4a2f28",
                            "@type": [
                                "FileReference",
                                "File",
                                "Item"
                            ],
                            "status": "uploaded",
                            "@id": "/files-reference/GAPFIBGEOI72/",
                            "display_title": "GAPFIBGEOI72.txt",
                            "principals_allowed": {
                                "view": [
                                    "editor_for.12a92962-8265-4fc0-b2f8-cf14f05db58b",
                                    "group.admin",
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
                        "uuid": "87e8832d-9ece-439a-8602-152b1ee74b0f",
                        "status": "uploaded",
                        "@id": "/files-processed/GAPFI5T4QIBP/",
                        "display_title": "GAPFI5T4QIBP.rck.gz",
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
                "display_title": "workflow_granite-mpileupCounts v1.0.0 run 2022-04-29 17:10:45.405166",
                "status": "shared",
                "@type": [
                    "WorkflowRunAwsem",
                    "WorkflowRun",
                    "Item"
                ],
                "uuid": "e93fc945-f186-41e0-a0c3-b19a007ce81c",
                "@id": "/workflow-runs-awsem/e93fc945-f186-41e0-a0c3-b19a007ce81c/",
                "output_files": [
                    {
                        "value": {
                            "uuid": "87e8832d-9ece-439a-8602-152b1ee74b0f",
                            "status": "uploaded",
                            "@type": [
                                "FileProcessed",
                                "File",
                                "Item"
                            ],
                            "display_title": "GAPFI5T4QIBP.rck.gz",
                            "@id": "/files-processed/GAPFI5T4QIBP/",
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
                            },
                            "workflow_run_inputs": [
                                {
                                    "display_title": "workflow_granite-rckTar v1.0.0 run 2022-04-29 21:10:35.118284",
                                    "@id": "/workflow-runs-awsem/6fb5a7f0-2156-49e3-bf42-95f4e8decdde/",
                                    "status": "shared",
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
                                    }
                                }
                            ]
                        }
                    }
                ],
                "input_files": [
                    {
                        "value": {
                            "uuid": "222ce0eb-22f8-40e3-87d5-f2708ad18393",
                            "@type": [
                                "FileProcessed",
                                "File",
                                "Item"
                            ],
                            "status": "uploaded",
                            "@id": "/files-processed/GAPFITNHTOZI/",
                            "display_title": "GAPFITNHTOZI.bam",
                            "workflow_run_inputs": [
                                {
                                    "@type": [
                                        "WorkflowRunAwsem",
                                        "WorkflowRun",
                                        "Item"
                                    ],
                                    "display_title": "workflow_granite-mpileupCounts v1.0.0 run 2022-04-29 17:10:45.405166",
                                    "@id": "/workflow-runs-awsem/e93fc945-f186-41e0-a0c3-b19a007ce81c/",
                                    "status": "shared",
                                    "uuid": "e93fc945-f186-41e0-a0c3-b19a007ce81c",
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
                                    "display_title": "cgap-bamqc v1.0.0 run 2022-04-29 09:25:33.654107",
                                    "@id": "/workflow-runs-awsem/c2a9ad6c-2bc9-489a-a7bd-6358b8ede373/",
                                    "status": "shared",
                                    "uuid": "c2a9ad6c-2bc9-489a-a7bd-6358b8ede373",
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
                                    "display_title": "workflow_gatk-HaplotypeCaller v1.0.0 run 2022-04-29 17:11:05.391428",
                                    "@id": "/workflow-runs-awsem/3f8e7c4e-254b-4981-81c8-d54821b0676c/",
                                    "status": "shared",
                                    "uuid": "3f8e7c4e-254b-4981-81c8-d54821b0676c",
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
                                    "display_title": "bamsnap v1.0.0 run 2022-04-30 06:40:40.145843",
                                    "@id": "/workflow-runs-awsem/106be8c3-5b02-4809-8205-4b7dae0fc375/",
                                    "status": "shared",
                                    "uuid": "106be8c3-5b02-4809-8205-4b7dae0fc375",
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
                                    "display_title": "workflow_manta_vcf-check v1.0.0 run 2022-05-03 13:27:54.696531",
                                    "@id": "/workflow-runs-awsem/a535c8dd-bb2d-4ef3-9f39-c09ed7679043/",
                                    "status": "shared",
                                    "uuid": "a535c8dd-bb2d-4ef3-9f39-c09ed7679043",
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
                                    "display_title": "workflow_manta_vcf-check v1.0.0 run 2022-06-14 15:25:38.395763",
                                    "@id": "/workflow-runs-awsem/faddea10-4887-41ae-906c-f3709be988d6/",
                                    "status": "shared",
                                    "uuid": "faddea10-4887-41ae-906c-f3709be988d6",
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
                                    "display_title": "workflow_manta_vcf-check v1.0.0 run 2022-06-14 20:40:38.996289",
                                    "@id": "/workflow-runs-awsem/1b859a33-6e53-41ca-92fc-ab391a832fdf/",
                                    "status": "shared",
                                    "uuid": "1b859a33-6e53-41ca-92fc-ab391a832fdf",
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
                                    "display_title": "workflow_manta_vcf-check v1.0.0 run 2022-06-28 14:40:37.869039",
                                    "@id": "/workflow-runs-awsem/72b695ed-074c-4d4f-b338-17f4ebd93167/",
                                    "status": "shared",
                                    "uuid": "72b695ed-074c-4d4f-b338-17f4ebd93167",
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
                                    "display_title": "workflow_manta_vcf-check v1.0.0 run 2022-06-30 21:25:38.318616",
                                    "@id": "/workflow-runs-awsem/4ba17f94-6a12-4890-b9e2-db7c2b9a4506/",
                                    "status": "shared",
                                    "uuid": "4ba17f94-6a12-4890-b9e2-db7c2b9a4506",
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
                                    "display_title": "workflow_manta_vcf-check v1.0.0 run 2022-06-30 19:10:43.701945",
                                    "@id": "/workflow-runs-awsem/b0f2cd76-015b-4449-ba5e-f92194729143/",
                                    "status": "shared",
                                    "uuid": "b0f2cd76-015b-4449-ba5e-f92194729143",
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
                                    "display_title": "workflow_manta_vcf-check v1.0.0 run 2022-07-05 18:40:37.676855",
                                    "@id": "/workflow-runs-awsem/68209cd5-987b-47e0-a719-682a2700d340/",
                                    "status": "shared",
                                    "uuid": "68209cd5-987b-47e0-a719-682a2700d340",
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
                            },
                            "workflow_run_outputs": [
                                {
                                    "display_title": "workflow_sentieon_dedup-recal v1.0.0 run 2022-04-29 04:25:46.368031",
                                    "@type": [
                                        "WorkflowRunAwsem",
                                        "WorkflowRun",
                                        "Item"
                                    ],
                                    "status": "shared",
                                    "uuid": "d4b58584-ecc6-41ad-a0ce-81d4b600b033",
                                    "@id": "/workflow-runs-awsem/d4b58584-ecc6-41ad-a0ce-81d4b600b033/",
                                    "principals_allowed": {
                                        "view": [
                                            "system.Authenticated"
                                        ],
                                        "edit": [
                                            "group.admin"
                                        ]
                                    }
                                }
                            ]
                        }
                    },
                    {
                        "value": {
                            "uuid": "1936f246-22e1-45dc-bb5c-9cfd55537fe7",
                            "@type": [
                                "FileReference",
                                "File",
                                "Item"
                            ],
                            "status": "uploaded",
                            "@id": "/files-reference/GAPFIXRDPDK5/",
                            "display_title": "GAPFIXRDPDK5.fa",
                            "principals_allowed": {
                                "view": [
                                    "editor_for.12a92962-8265-4fc0-b2f8-cf14f05db58b",
                                    "group.admin",
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
                        "value": {
                            "uuid": "1c07a3aa-e2a3-498c-b838-15991c4a2f28",
                            "@type": [
                                "FileReference",
                                "File",
                                "Item"
                            ],
                            "status": "uploaded",
                            "@id": "/files-reference/GAPFIBGEOI72/",
                            "display_title": "GAPFIBGEOI72.txt",
                            "principals_allowed": {
                                "view": [
                                    "editor_for.12a92962-8265-4fc0-b2f8-cf14f05db58b",
                                    "group.admin",
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
                        "uuid": "1e51aea4-7fc1-4936-852a-83fbae9f34ff",
                        "status": "uploaded",
                        "@id": "/files-processed/GAPFIH71G455/",
                        "display_title": "GAPFIH71G455.gvcf.gz",
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
                "display_title": "workflow_gatk-HaplotypeCaller v1.0.0 run 2022-04-29 17:10:52.092723",
                "status": "shared",
                "@type": [
                    "WorkflowRunAwsem",
                    "WorkflowRun",
                    "Item"
                ],
                "uuid": "d2063a22-99c7-420e-b179-6daedad12499",
                "@id": "/workflow-runs-awsem/d2063a22-99c7-420e-b179-6daedad12499/",
                "output_files": [
                    {
                        "value": {
                            "uuid": "1e51aea4-7fc1-4936-852a-83fbae9f34ff",
                            "status": "uploaded",
                            "@type": [
                                "FileProcessed",
                                "File",
                                "Item"
                            ],
                            "display_title": "GAPFIH71G455.gvcf.gz",
                            "@id": "/files-processed/GAPFIH71G455/",
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
                            },
                            "workflow_run_inputs": [
                                {
                                    "display_title": "workflow_gatk-CombineGVCFs v1.0.0 run 2022-04-29 19:55:36.043928",
                                    "@id": "/workflow-runs-awsem/59fc114b-ccd6-416d-9555-4d2270c4c3dd/",
                                    "status": "shared",
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
                                    }
                                }
                            ]
                        }
                    }
                ],
                "input_files": [
                    {
                        "value": {
                            "uuid": "676dd0c1-82c4-41be-9ae7-619ce47e158e",
                            "@type": [
                                "FileProcessed",
                                "File",
                                "Item"
                            ],
                            "status": "uploaded",
                            "@id": "/files-processed/GAPFIMIARUOB/",
                            "display_title": "GAPFIMIARUOB.bam",
                            "workflow_run_inputs": [
                                {
                                    "@type": [
                                        "WorkflowRunAwsem",
                                        "WorkflowRun",
                                        "Item"
                                    ],
                                    "display_title": "workflow_granite-mpileupCounts v1.0.0 run 2022-04-29 17:10:35.675189",
                                    "@id": "/workflow-runs-awsem/d9b35c06-6911-4b67-ac04-395331a98e55/",
                                    "status": "shared",
                                    "uuid": "d9b35c06-6911-4b67-ac04-395331a98e55",
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
                                    "display_title": "workflow_gatk-HaplotypeCaller v1.0.0 run 2022-04-29 17:10:52.092723",
                                    "@id": "/workflow-runs-awsem/d2063a22-99c7-420e-b179-6daedad12499/",
                                    "status": "shared",
                                    "uuid": "d2063a22-99c7-420e-b179-6daedad12499",
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
                                    "display_title": "cgap-bamqc v1.0.0 run 2022-04-29 09:10:34.237529",
                                    "@id": "/workflow-runs-awsem/332fdc52-268c-41ad-a408-a0def871afe9/",
                                    "status": "shared",
                                    "uuid": "332fdc52-268c-41ad-a408-a0def871afe9",
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
                                    "display_title": "bamsnap v1.0.0 run 2022-04-30 06:40:40.145843",
                                    "@id": "/workflow-runs-awsem/106be8c3-5b02-4809-8205-4b7dae0fc375/",
                                    "status": "shared",
                                    "uuid": "106be8c3-5b02-4809-8205-4b7dae0fc375",
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
                                    "display_title": "workflow_manta_vcf-check v1.0.0 run 2022-05-03 13:27:54.696531",
                                    "@id": "/workflow-runs-awsem/a535c8dd-bb2d-4ef3-9f39-c09ed7679043/",
                                    "status": "shared",
                                    "uuid": "a535c8dd-bb2d-4ef3-9f39-c09ed7679043",
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
                                    "display_title": "workflow_manta_vcf-check v1.0.0 run 2022-06-14 15:25:38.395763",
                                    "@id": "/workflow-runs-awsem/faddea10-4887-41ae-906c-f3709be988d6/",
                                    "status": "shared",
                                    "uuid": "faddea10-4887-41ae-906c-f3709be988d6",
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
                                    "display_title": "workflow_manta_vcf-check v1.0.0 run 2022-06-14 20:40:38.996289",
                                    "@id": "/workflow-runs-awsem/1b859a33-6e53-41ca-92fc-ab391a832fdf/",
                                    "status": "shared",
                                    "uuid": "1b859a33-6e53-41ca-92fc-ab391a832fdf",
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
                                    "display_title": "workflow_manta_vcf-check v1.0.0 run 2022-06-28 14:40:37.869039",
                                    "@id": "/workflow-runs-awsem/72b695ed-074c-4d4f-b338-17f4ebd93167/",
                                    "status": "shared",
                                    "uuid": "72b695ed-074c-4d4f-b338-17f4ebd93167",
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
                                    "display_title": "workflow_manta_vcf-check v1.0.0 run 2022-06-30 21:25:38.318616",
                                    "@id": "/workflow-runs-awsem/4ba17f94-6a12-4890-b9e2-db7c2b9a4506/",
                                    "status": "shared",
                                    "uuid": "4ba17f94-6a12-4890-b9e2-db7c2b9a4506",
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
                                    "display_title": "workflow_manta_vcf-check v1.0.0 run 2022-06-30 19:10:43.701945",
                                    "@id": "/workflow-runs-awsem/b0f2cd76-015b-4449-ba5e-f92194729143/",
                                    "status": "shared",
                                    "uuid": "b0f2cd76-015b-4449-ba5e-f92194729143",
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
                                    "display_title": "workflow_manta_vcf-check v1.0.0 run 2022-07-05 18:40:37.676855",
                                    "@id": "/workflow-runs-awsem/68209cd5-987b-47e0-a719-682a2700d340/",
                                    "status": "shared",
                                    "uuid": "68209cd5-987b-47e0-a719-682a2700d340",
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
                            },
                            "workflow_run_outputs": [
                                {
                                    "display_title": "workflow_sentieon_dedup-recal v1.0.0 run 2022-04-29 04:25:35.950498",
                                    "@type": [
                                        "WorkflowRunAwsem",
                                        "WorkflowRun",
                                        "Item"
                                    ],
                                    "status": "shared",
                                    "uuid": "784f3f5f-d3cf-432b-8c0f-3dcd957b2042",
                                    "@id": "/workflow-runs-awsem/784f3f5f-d3cf-432b-8c0f-3dcd957b2042/",
                                    "principals_allowed": {
                                        "view": [
                                            "system.Authenticated"
                                        ],
                                        "edit": [
                                            "group.admin"
                                        ]
                                    }
                                }
                            ]
                        }
                    },
                    {
                        "value": {
                            "uuid": "1936f246-22e1-45dc-bb5c-9cfd55537fe7",
                            "@type": [
                                "FileReference",
                                "File",
                                "Item"
                            ],
                            "status": "uploaded",
                            "@id": "/files-reference/GAPFIXRDPDK5/",
                            "display_title": "GAPFIXRDPDK5.fa",
                            "principals_allowed": {
                                "view": [
                                    "editor_for.12a92962-8265-4fc0-b2f8-cf14f05db58b",
                                    "group.admin",
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
                        "value": {
                            "uuid": "1c07a3aa-e2a3-498c-b838-15991c4a2f28",
                            "@type": [
                                "FileReference",
                                "File",
                                "Item"
                            ],
                            "status": "uploaded",
                            "@id": "/files-reference/GAPFIBGEOI72/",
                            "display_title": "GAPFIBGEOI72.txt",
                            "principals_allowed": {
                                "view": [
                                    "editor_for.12a92962-8265-4fc0-b2f8-cf14f05db58b",
                                    "group.admin",
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
                        "uuid": "1bb89ec3-12cd-46de-bbd7-7ba95db3fec6",
                        "status": "uploaded",
                        "@id": "/files-processed/GAPFIXEYX9Q1/",
                        "display_title": "GAPFIXEYX9Q1.gvcf.gz",
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
                "display_title": "workflow_gatk-HaplotypeCaller v1.0.0 run 2022-04-29 17:10:58.741225",
                "status": "shared",
                "@type": [
                    "WorkflowRunAwsem",
                    "WorkflowRun",
                    "Item"
                ],
                "uuid": "a59335b9-d462-4578-b718-0fc54428cc77",
                "@id": "/workflow-runs-awsem/a59335b9-d462-4578-b718-0fc54428cc77/",
                "output_files": [
                    {
                        "value": {
                            "uuid": "1bb89ec3-12cd-46de-bbd7-7ba95db3fec6",
                            "status": "uploaded",
                            "@type": [
                                "FileProcessed",
                                "File",
                                "Item"
                            ],
                            "display_title": "GAPFIXEYX9Q1.gvcf.gz",
                            "@id": "/files-processed/GAPFIXEYX9Q1/",
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
                            },
                            "workflow_run_inputs": [
                                {
                                    "display_title": "workflow_gatk-CombineGVCFs v1.0.0 run 2022-04-29 19:55:36.043928",
                                    "@id": "/workflow-runs-awsem/59fc114b-ccd6-416d-9555-4d2270c4c3dd/",
                                    "status": "shared",
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
                                    }
                                }
                            ]
                        }
                    }
                ],
                "input_files": [
                    {
                        "value": {
                            "uuid": "6d199319-3719-4a42-8883-365072bc13b3",
                            "@type": [
                                "FileProcessed",
                                "File",
                                "Item"
                            ],
                            "status": "uploaded",
                            "@id": "/files-processed/GAPFICEE9LEN/",
                            "display_title": "GAPFICEE9LEN.bam",
                            "workflow_run_inputs": [
                                {
                                    "@type": [
                                        "WorkflowRunAwsem",
                                        "WorkflowRun",
                                        "Item"
                                    ],
                                    "display_title": "cgap-bamqc v1.0.0 run 2022-04-29 09:10:37.940754",
                                    "@id": "/workflow-runs-awsem/a3c19fdd-436c-40bd-a3e6-9cc5e93c0da5/",
                                    "status": "shared",
                                    "uuid": "a3c19fdd-436c-40bd-a3e6-9cc5e93c0da5",
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
                                    "display_title": "workflow_granite-mpileupCounts v1.0.0 run 2022-04-29 17:10:38.581075",
                                    "@id": "/workflow-runs-awsem/8bca34d8-54c4-4de8-9057-ffb868d44795/",
                                    "status": "shared",
                                    "uuid": "8bca34d8-54c4-4de8-9057-ffb868d44795",
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
                                    "display_title": "workflow_gatk-HaplotypeCaller v1.0.0 run 2022-04-29 17:10:58.741225",
                                    "@id": "/workflow-runs-awsem/a59335b9-d462-4578-b718-0fc54428cc77/",
                                    "status": "shared",
                                    "uuid": "a59335b9-d462-4578-b718-0fc54428cc77",
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
                                    "display_title": "bamsnap v1.0.0 run 2022-04-30 06:40:40.145843",
                                    "@id": "/workflow-runs-awsem/106be8c3-5b02-4809-8205-4b7dae0fc375/",
                                    "status": "shared",
                                    "uuid": "106be8c3-5b02-4809-8205-4b7dae0fc375",
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
                                    "display_title": "workflow_manta_vcf-check v1.0.0 run 2022-05-03 13:27:54.696531",
                                    "@id": "/workflow-runs-awsem/a535c8dd-bb2d-4ef3-9f39-c09ed7679043/",
                                    "status": "shared",
                                    "uuid": "a535c8dd-bb2d-4ef3-9f39-c09ed7679043",
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
                                    "display_title": "workflow_manta_vcf-check v1.0.0 run 2022-06-14 15:25:38.395763",
                                    "@id": "/workflow-runs-awsem/faddea10-4887-41ae-906c-f3709be988d6/",
                                    "status": "shared",
                                    "uuid": "faddea10-4887-41ae-906c-f3709be988d6",
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
                                    "display_title": "workflow_manta_vcf-check v1.0.0 run 2022-06-14 20:40:38.996289",
                                    "@id": "/workflow-runs-awsem/1b859a33-6e53-41ca-92fc-ab391a832fdf/",
                                    "status": "shared",
                                    "uuid": "1b859a33-6e53-41ca-92fc-ab391a832fdf",
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
                                    "display_title": "workflow_manta_vcf-check v1.0.0 run 2022-06-28 14:40:37.869039",
                                    "@id": "/workflow-runs-awsem/72b695ed-074c-4d4f-b338-17f4ebd93167/",
                                    "status": "shared",
                                    "uuid": "72b695ed-074c-4d4f-b338-17f4ebd93167",
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
                                    "display_title": "workflow_manta_vcf-check v1.0.0 run 2022-06-30 21:25:38.318616",
                                    "@id": "/workflow-runs-awsem/4ba17f94-6a12-4890-b9e2-db7c2b9a4506/",
                                    "status": "shared",
                                    "uuid": "4ba17f94-6a12-4890-b9e2-db7c2b9a4506",
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
                                    "display_title": "workflow_manta_vcf-check v1.0.0 run 2022-06-30 19:10:43.701945",
                                    "@id": "/workflow-runs-awsem/b0f2cd76-015b-4449-ba5e-f92194729143/",
                                    "status": "shared",
                                    "uuid": "b0f2cd76-015b-4449-ba5e-f92194729143",
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
                                    "display_title": "workflow_manta_vcf-check v1.0.0 run 2022-07-05 18:40:37.676855",
                                    "@id": "/workflow-runs-awsem/68209cd5-987b-47e0-a719-682a2700d340/",
                                    "status": "shared",
                                    "uuid": "68209cd5-987b-47e0-a719-682a2700d340",
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
                            },
                            "workflow_run_outputs": [
                                {
                                    "display_title": "workflow_sentieon_dedup-recal v1.0.0 run 2022-04-29 04:25:39.481922",
                                    "@type": [
                                        "WorkflowRunAwsem",
                                        "WorkflowRun",
                                        "Item"
                                    ],
                                    "status": "shared",
                                    "uuid": "25d04009-a2fe-481b-ada7-da5c1216d52e",
                                    "@id": "/workflow-runs-awsem/25d04009-a2fe-481b-ada7-da5c1216d52e/",
                                    "principals_allowed": {
                                        "view": [
                                            "system.Authenticated"
                                        ],
                                        "edit": [
                                            "group.admin"
                                        ]
                                    }
                                }
                            ]
                        }
                    },
                    {
                        "value": {
                            "uuid": "1936f246-22e1-45dc-bb5c-9cfd55537fe7",
                            "@type": [
                                "FileReference",
                                "File",
                                "Item"
                            ],
                            "status": "uploaded",
                            "@id": "/files-reference/GAPFIXRDPDK5/",
                            "display_title": "GAPFIXRDPDK5.fa",
                            "principals_allowed": {
                                "view": [
                                    "editor_for.12a92962-8265-4fc0-b2f8-cf14f05db58b",
                                    "group.admin",
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
                        "value": {
                            "uuid": "1c07a3aa-e2a3-498c-b838-15991c4a2f28",
                            "@type": [
                                "FileReference",
                                "File",
                                "Item"
                            ],
                            "status": "uploaded",
                            "@id": "/files-reference/GAPFIBGEOI72/",
                            "display_title": "GAPFIBGEOI72.txt",
                            "principals_allowed": {
                                "view": [
                                    "editor_for.12a92962-8265-4fc0-b2f8-cf14f05db58b",
                                    "group.admin",
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
                        "uuid": "ed25677e-f2d6-4429-b9d2-300a36cff6ed",
                        "status": "uploaded",
                        "@id": "/files-processed/GAPFINHTTKUZ/",
                        "display_title": "GAPFINHTTKUZ.gvcf.gz",
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
                "display_title": "workflow_gatk-HaplotypeCaller v1.0.0 run 2022-04-29 17:11:05.391428",
                "status": "shared",
                "@type": [
                    "WorkflowRunAwsem",
                    "WorkflowRun",
                    "Item"
                ],
                "uuid": "3f8e7c4e-254b-4981-81c8-d54821b0676c",
                "@id": "/workflow-runs-awsem/3f8e7c4e-254b-4981-81c8-d54821b0676c/",
                "output_files": [
                    {
                        "value": {
                            "uuid": "ed25677e-f2d6-4429-b9d2-300a36cff6ed",
                            "status": "uploaded",
                            "@type": [
                                "FileProcessed",
                                "File",
                                "Item"
                            ],
                            "display_title": "GAPFINHTTKUZ.gvcf.gz",
                            "@id": "/files-processed/GAPFINHTTKUZ/",
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
                            },
                            "workflow_run_inputs": [
                                {
                                    "display_title": "workflow_gatk-CombineGVCFs v1.0.0 run 2022-04-29 19:55:36.043928",
                                    "@id": "/workflow-runs-awsem/59fc114b-ccd6-416d-9555-4d2270c4c3dd/",
                                    "status": "shared",
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
                                    }
                                }
                            ]
                        }
                    }
                ],
                "input_files": [
                    {
                        "value": {
                            "uuid": "222ce0eb-22f8-40e3-87d5-f2708ad18393",
                            "@type": [
                                "FileProcessed",
                                "File",
                                "Item"
                            ],
                            "status": "uploaded",
                            "@id": "/files-processed/GAPFITNHTOZI/",
                            "display_title": "GAPFITNHTOZI.bam",
                            "workflow_run_inputs": [
                                {
                                    "@type": [
                                        "WorkflowRunAwsem",
                                        "WorkflowRun",
                                        "Item"
                                    ],
                                    "display_title": "workflow_granite-mpileupCounts v1.0.0 run 2022-04-29 17:10:45.405166",
                                    "@id": "/workflow-runs-awsem/e93fc945-f186-41e0-a0c3-b19a007ce81c/",
                                    "status": "shared",
                                    "uuid": "e93fc945-f186-41e0-a0c3-b19a007ce81c",
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
                                    "display_title": "cgap-bamqc v1.0.0 run 2022-04-29 09:25:33.654107",
                                    "@id": "/workflow-runs-awsem/c2a9ad6c-2bc9-489a-a7bd-6358b8ede373/",
                                    "status": "shared",
                                    "uuid": "c2a9ad6c-2bc9-489a-a7bd-6358b8ede373",
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
                                    "display_title": "workflow_gatk-HaplotypeCaller v1.0.0 run 2022-04-29 17:11:05.391428",
                                    "@id": "/workflow-runs-awsem/3f8e7c4e-254b-4981-81c8-d54821b0676c/",
                                    "status": "shared",
                                    "uuid": "3f8e7c4e-254b-4981-81c8-d54821b0676c",
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
                                    "display_title": "bamsnap v1.0.0 run 2022-04-30 06:40:40.145843",
                                    "@id": "/workflow-runs-awsem/106be8c3-5b02-4809-8205-4b7dae0fc375/",
                                    "status": "shared",
                                    "uuid": "106be8c3-5b02-4809-8205-4b7dae0fc375",
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
                                    "display_title": "workflow_manta_vcf-check v1.0.0 run 2022-05-03 13:27:54.696531",
                                    "@id": "/workflow-runs-awsem/a535c8dd-bb2d-4ef3-9f39-c09ed7679043/",
                                    "status": "shared",
                                    "uuid": "a535c8dd-bb2d-4ef3-9f39-c09ed7679043",
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
                                    "display_title": "workflow_manta_vcf-check v1.0.0 run 2022-06-14 15:25:38.395763",
                                    "@id": "/workflow-runs-awsem/faddea10-4887-41ae-906c-f3709be988d6/",
                                    "status": "shared",
                                    "uuid": "faddea10-4887-41ae-906c-f3709be988d6",
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
                                    "display_title": "workflow_manta_vcf-check v1.0.0 run 2022-06-14 20:40:38.996289",
                                    "@id": "/workflow-runs-awsem/1b859a33-6e53-41ca-92fc-ab391a832fdf/",
                                    "status": "shared",
                                    "uuid": "1b859a33-6e53-41ca-92fc-ab391a832fdf",
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
                                    "display_title": "workflow_manta_vcf-check v1.0.0 run 2022-06-28 14:40:37.869039",
                                    "@id": "/workflow-runs-awsem/72b695ed-074c-4d4f-b338-17f4ebd93167/",
                                    "status": "shared",
                                    "uuid": "72b695ed-074c-4d4f-b338-17f4ebd93167",
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
                                    "display_title": "workflow_manta_vcf-check v1.0.0 run 2022-06-30 21:25:38.318616",
                                    "@id": "/workflow-runs-awsem/4ba17f94-6a12-4890-b9e2-db7c2b9a4506/",
                                    "status": "shared",
                                    "uuid": "4ba17f94-6a12-4890-b9e2-db7c2b9a4506",
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
                                    "display_title": "workflow_manta_vcf-check v1.0.0 run 2022-06-30 19:10:43.701945",
                                    "@id": "/workflow-runs-awsem/b0f2cd76-015b-4449-ba5e-f92194729143/",
                                    "status": "shared",
                                    "uuid": "b0f2cd76-015b-4449-ba5e-f92194729143",
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
                                    "display_title": "workflow_manta_vcf-check v1.0.0 run 2022-07-05 18:40:37.676855",
                                    "@id": "/workflow-runs-awsem/68209cd5-987b-47e0-a719-682a2700d340/",
                                    "status": "shared",
                                    "uuid": "68209cd5-987b-47e0-a719-682a2700d340",
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
                            },
                            "workflow_run_outputs": [
                                {
                                    "display_title": "workflow_sentieon_dedup-recal v1.0.0 run 2022-04-29 04:25:46.368031",
                                    "@type": [
                                        "WorkflowRunAwsem",
                                        "WorkflowRun",
                                        "Item"
                                    ],
                                    "status": "shared",
                                    "uuid": "d4b58584-ecc6-41ad-a0ce-81d4b600b033",
                                    "@id": "/workflow-runs-awsem/d4b58584-ecc6-41ad-a0ce-81d4b600b033/",
                                    "principals_allowed": {
                                        "view": [
                                            "system.Authenticated"
                                        ],
                                        "edit": [
                                            "group.admin"
                                        ]
                                    }
                                }
                            ]
                        }
                    },
                    {
                        "value": {
                            "uuid": "1936f246-22e1-45dc-bb5c-9cfd55537fe7",
                            "@type": [
                                "FileReference",
                                "File",
                                "Item"
                            ],
                            "status": "uploaded",
                            "@id": "/files-reference/GAPFIXRDPDK5/",
                            "display_title": "GAPFIXRDPDK5.fa",
                            "principals_allowed": {
                                "view": [
                                    "editor_for.12a92962-8265-4fc0-b2f8-cf14f05db58b",
                                    "group.admin",
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
                        "value": {
                            "uuid": "1c07a3aa-e2a3-498c-b838-15991c4a2f28",
                            "@type": [
                                "FileReference",
                                "File",
                                "Item"
                            ],
                            "status": "uploaded",
                            "@id": "/files-reference/GAPFIBGEOI72/",
                            "display_title": "GAPFIBGEOI72.txt",
                            "principals_allowed": {
                                "view": [
                                    "editor_for.12a92962-8265-4fc0-b2f8-cf14f05db58b",
                                    "group.admin",
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
                        "uuid": "3e8a17d1-e07f-4226-bd6a-a4ca13606528",
                        "status": "uploaded",
                        "@id": "/files-processed/GAPFI7TBYWC7/",
                        "display_title": "GAPFI7TBYWC7.rck.tar",
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
                "display_title": "workflow_granite-rckTar v1.0.0 run 2022-04-29 21:10:35.118284",
                "status": "shared",
                "@type": [
                    "WorkflowRunAwsem",
                    "WorkflowRun",
                    "Item"
                ],
                "uuid": "6fb5a7f0-2156-49e3-bf42-95f4e8decdde",
                "@id": "/workflow-runs-awsem/6fb5a7f0-2156-49e3-bf42-95f4e8decdde/",
                "output_files": [
                    {
                        "value": {
                            "uuid": "3e8a17d1-e07f-4226-bd6a-a4ca13606528",
                            "status": "uploaded",
                            "@type": [
                                "FileProcessed",
                                "File",
                                "Item"
                            ],
                            "display_title": "GAPFI7TBYWC7.rck.tar",
                            "@id": "/files-processed/GAPFI7TBYWC7/",
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
                            },
                            "workflow_run_inputs": [
                                {
                                    "display_title": "workflow_granite-novoCaller-rck-check v1.0.0 run 2022-04-30 02:55:36.042917",
                                    "@id": "/workflow-runs-awsem/2160c911-2d1b-466b-9643-ed30c74228a8/",
                                    "status": "shared",
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
                                    }
                                }
                            ]
                        }
                    }
                ],
                "input_files": [
                    {
                        "value": {
                            "uuid": "90d5572a-3cb5-40bd-8cec-68346c28705b",
                            "@type": [
                                "FileProcessed",
                                "File",
                                "Item"
                            ],
                            "status": "uploaded",
                            "@id": "/files-processed/GAPFI9CNINA2/",
                            "display_title": "GAPFI9CNINA2.rck.gz",
                            "workflow_run_inputs": [
                                {
                                    "@type": [
                                        "WorkflowRunAwsem",
                                        "WorkflowRun",
                                        "Item"
                                    ],
                                    "display_title": "workflow_granite-rckTar v1.0.0 run 2022-04-29 21:10:35.118284",
                                    "@id": "/workflow-runs-awsem/6fb5a7f0-2156-49e3-bf42-95f4e8decdde/",
                                    "status": "shared",
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
                            },
                            "workflow_run_outputs": [
                                {
                                    "display_title": "workflow_granite-mpileupCounts v1.0.0 run 2022-04-29 17:10:35.675189",
                                    "@type": [
                                        "WorkflowRunAwsem",
                                        "WorkflowRun",
                                        "Item"
                                    ],
                                    "status": "shared",
                                    "uuid": "d9b35c06-6911-4b67-ac04-395331a98e55",
                                    "@id": "/workflow-runs-awsem/d9b35c06-6911-4b67-ac04-395331a98e55/",
                                    "principals_allowed": {
                                        "view": [
                                            "system.Authenticated"
                                        ],
                                        "edit": [
                                            "group.admin"
                                        ]
                                    }
                                }
                            ]
                        }
                    },
                    {
                        "value": {
                            "uuid": "76111407-5e86-48dd-bd13-f3a167638140",
                            "@type": [
                                "FileProcessed",
                                "File",
                                "Item"
                            ],
                            "status": "uploaded",
                            "@id": "/files-processed/GAPFID5AE9ME/",
                            "display_title": "GAPFID5AE9ME.rck.gz",
                            "workflow_run_inputs": [
                                {
                                    "@type": [
                                        "WorkflowRunAwsem",
                                        "WorkflowRun",
                                        "Item"
                                    ],
                                    "display_title": "workflow_granite-rckTar v1.0.0 run 2022-04-29 21:10:35.118284",
                                    "@id": "/workflow-runs-awsem/6fb5a7f0-2156-49e3-bf42-95f4e8decdde/",
                                    "status": "shared",
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
                            },
                            "workflow_run_outputs": [
                                {
                                    "display_title": "workflow_granite-mpileupCounts v1.0.0 run 2022-04-29 17:10:38.581075",
                                    "@type": [
                                        "WorkflowRunAwsem",
                                        "WorkflowRun",
                                        "Item"
                                    ],
                                    "status": "shared",
                                    "uuid": "8bca34d8-54c4-4de8-9057-ffb868d44795",
                                    "@id": "/workflow-runs-awsem/8bca34d8-54c4-4de8-9057-ffb868d44795/",
                                    "principals_allowed": {
                                        "view": [
                                            "system.Authenticated"
                                        ],
                                        "edit": [
                                            "group.admin"
                                        ]
                                    }
                                }
                            ]
                        }
                    },
                    {
                        "value": {
                            "uuid": "87e8832d-9ece-439a-8602-152b1ee74b0f",
                            "@type": [
                                "FileProcessed",
                                "File",
                                "Item"
                            ],
                            "status": "uploaded",
                            "@id": "/files-processed/GAPFI5T4QIBP/",
                            "display_title": "GAPFI5T4QIBP.rck.gz",
                            "workflow_run_inputs": [
                                {
                                    "@type": [
                                        "WorkflowRunAwsem",
                                        "WorkflowRun",
                                        "Item"
                                    ],
                                    "display_title": "workflow_granite-rckTar v1.0.0 run 2022-04-29 21:10:35.118284",
                                    "@id": "/workflow-runs-awsem/6fb5a7f0-2156-49e3-bf42-95f4e8decdde/",
                                    "status": "shared",
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
                            },
                            "workflow_run_outputs": [
                                {
                                    "display_title": "workflow_granite-mpileupCounts v1.0.0 run 2022-04-29 17:10:45.405166",
                                    "@type": [
                                        "WorkflowRunAwsem",
                                        "WorkflowRun",
                                        "Item"
                                    ],
                                    "status": "shared",
                                    "uuid": "e93fc945-f186-41e0-a0c3-b19a007ce81c",
                                    "@id": "/workflow-runs-awsem/e93fc945-f186-41e0-a0c3-b19a007ce81c/",
                                    "principals_allowed": {
                                        "view": [
                                            "system.Authenticated"
                                        ],
                                        "edit": [
                                            "group.admin"
                                        ]
                                    }
                                }
                            ]
                        }
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
                        "uuid": "2021801b-9f49-4fc9-9e86-9b8046edd5e9",
                        "status": "uploaded",
                        "@id": "/files-processed/GAPFI4589EXS/",
                        "display_title": "GAPFI4589EXS.gvcf.gz",
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
                "display_title": "workflow_gatk-CombineGVCFs v1.0.0 run 2022-04-29 19:55:36.043928",
                "status": "shared",
                "@type": [
                    "WorkflowRunAwsem",
                    "WorkflowRun",
                    "Item"
                ],
                "uuid": "59fc114b-ccd6-416d-9555-4d2270c4c3dd",
                "@id": "/workflow-runs-awsem/59fc114b-ccd6-416d-9555-4d2270c4c3dd/",
                "output_files": [
                    {
                        "value": {
                            "uuid": "2021801b-9f49-4fc9-9e86-9b8046edd5e9",
                            "status": "uploaded",
                            "@type": [
                                "FileProcessed",
                                "File",
                                "Item"
                            ],
                            "display_title": "GAPFI4589EXS.gvcf.gz",
                            "@id": "/files-processed/GAPFI4589EXS/",
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
                            },
                            "workflow_run_inputs": [
                                {
                                    "display_title": "workflow_gatk-GenotypeGVCFs-check v1.0.0 run 2022-04-29 21:10:40.235957",
                                    "@id": "/workflow-runs-awsem/3e3530ef-c67d-4708-be5f-84349f49b182/",
                                    "status": "shared",
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
                                    }
                                }
                            ]
                        }
                    }
                ],
                "input_files": [
                    {
                        "value": {
                            "uuid": "1e51aea4-7fc1-4936-852a-83fbae9f34ff",
                            "@type": [
                                "FileProcessed",
                                "File",
                                "Item"
                            ],
                            "status": "uploaded",
                            "@id": "/files-processed/GAPFIH71G455/",
                            "display_title": "GAPFIH71G455.gvcf.gz",
                            "workflow_run_inputs": [
                                {
                                    "@type": [
                                        "WorkflowRunAwsem",
                                        "WorkflowRun",
                                        "Item"
                                    ],
                                    "display_title": "workflow_gatk-CombineGVCFs v1.0.0 run 2022-04-29 19:55:36.043928",
                                    "@id": "/workflow-runs-awsem/59fc114b-ccd6-416d-9555-4d2270c4c3dd/",
                                    "status": "shared",
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
                            },
                            "workflow_run_outputs": [
                                {
                                    "display_title": "workflow_gatk-HaplotypeCaller v1.0.0 run 2022-04-29 17:10:52.092723",
                                    "@type": [
                                        "WorkflowRunAwsem",
                                        "WorkflowRun",
                                        "Item"
                                    ],
                                    "status": "shared",
                                    "uuid": "d2063a22-99c7-420e-b179-6daedad12499",
                                    "@id": "/workflow-runs-awsem/d2063a22-99c7-420e-b179-6daedad12499/",
                                    "principals_allowed": {
                                        "view": [
                                            "system.Authenticated"
                                        ],
                                        "edit": [
                                            "group.admin"
                                        ]
                                    }
                                }
                            ]
                        }
                    },
                    {
                        "value": {
                            "uuid": "1bb89ec3-12cd-46de-bbd7-7ba95db3fec6",
                            "@type": [
                                "FileProcessed",
                                "File",
                                "Item"
                            ],
                            "status": "uploaded",
                            "@id": "/files-processed/GAPFIXEYX9Q1/",
                            "display_title": "GAPFIXEYX9Q1.gvcf.gz",
                            "workflow_run_inputs": [
                                {
                                    "@type": [
                                        "WorkflowRunAwsem",
                                        "WorkflowRun",
                                        "Item"
                                    ],
                                    "display_title": "workflow_gatk-CombineGVCFs v1.0.0 run 2022-04-29 19:55:36.043928",
                                    "@id": "/workflow-runs-awsem/59fc114b-ccd6-416d-9555-4d2270c4c3dd/",
                                    "status": "shared",
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
                            },
                            "workflow_run_outputs": [
                                {
                                    "display_title": "workflow_gatk-HaplotypeCaller v1.0.0 run 2022-04-29 17:10:58.741225",
                                    "@type": [
                                        "WorkflowRunAwsem",
                                        "WorkflowRun",
                                        "Item"
                                    ],
                                    "status": "shared",
                                    "uuid": "a59335b9-d462-4578-b718-0fc54428cc77",
                                    "@id": "/workflow-runs-awsem/a59335b9-d462-4578-b718-0fc54428cc77/",
                                    "principals_allowed": {
                                        "view": [
                                            "system.Authenticated"
                                        ],
                                        "edit": [
                                            "group.admin"
                                        ]
                                    }
                                }
                            ]
                        }
                    },
                    {
                        "value": {
                            "uuid": "ed25677e-f2d6-4429-b9d2-300a36cff6ed",
                            "@type": [
                                "FileProcessed",
                                "File",
                                "Item"
                            ],
                            "status": "uploaded",
                            "@id": "/files-processed/GAPFINHTTKUZ/",
                            "display_title": "GAPFINHTTKUZ.gvcf.gz",
                            "workflow_run_inputs": [
                                {
                                    "@type": [
                                        "WorkflowRunAwsem",
                                        "WorkflowRun",
                                        "Item"
                                    ],
                                    "display_title": "workflow_gatk-CombineGVCFs v1.0.0 run 2022-04-29 19:55:36.043928",
                                    "@id": "/workflow-runs-awsem/59fc114b-ccd6-416d-9555-4d2270c4c3dd/",
                                    "status": "shared",
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
                            },
                            "workflow_run_outputs": [
                                {
                                    "display_title": "workflow_gatk-HaplotypeCaller v1.0.0 run 2022-04-29 17:11:05.391428",
                                    "@type": [
                                        "WorkflowRunAwsem",
                                        "WorkflowRun",
                                        "Item"
                                    ],
                                    "status": "shared",
                                    "uuid": "3f8e7c4e-254b-4981-81c8-d54821b0676c",
                                    "@id": "/workflow-runs-awsem/3f8e7c4e-254b-4981-81c8-d54821b0676c/",
                                    "principals_allowed": {
                                        "view": [
                                            "system.Authenticated"
                                        ],
                                        "edit": [
                                            "group.admin"
                                        ]
                                    }
                                }
                            ]
                        }
                    },
                    {
                        "value": {
                            "uuid": "1936f246-22e1-45dc-bb5c-9cfd55537fe7",
                            "@type": [
                                "FileReference",
                                "File",
                                "Item"
                            ],
                            "status": "uploaded",
                            "@id": "/files-reference/GAPFIXRDPDK5/",
                            "display_title": "GAPFIXRDPDK5.fa",
                            "principals_allowed": {
                                "view": [
                                    "editor_for.12a92962-8265-4fc0-b2f8-cf14f05db58b",
                                    "group.admin",
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
                        "value": {
                            "uuid": "a1d504ee-a313-4064-b6ae-65fed9738980",
                            "@type": [
                                "FileReference",
                                "File",
                                "Item"
                            ],
                            "status": "uploaded",
                            "@id": "/files-reference/GAPFIGJVJDUY/",
                            "display_title": "GAPFIGJVJDUY.txt",
                            "principals_allowed": {
                                "view": [
                                    "editor_for.12a92962-8265-4fc0-b2f8-cf14f05db58b",
                                    "group.admin",
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
                        "uuid": "a6c9f1f0-e52a-4c3b-bc91-047462bf4d88",
                        "status": "uploaded",
                        "@id": "/files-processed/GAPFI6J5MLR9/",
                        "display_title": "GAPFI6J5MLR9.vcf.gz",
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
                "display_title": "workflow_gatk-GenotypeGVCFs-check v1.0.0 run 2022-04-29 21:10:40.235957",
                "status": "shared",
                "@type": [
                    "WorkflowRunAwsem",
                    "WorkflowRun",
                    "Item"
                ],
                "uuid": "3e3530ef-c67d-4708-be5f-84349f49b182",
                "@id": "/workflow-runs-awsem/3e3530ef-c67d-4708-be5f-84349f49b182/",
                "output_files": [
                    {
                        "value": {
                            "uuid": "a6c9f1f0-e52a-4c3b-bc91-047462bf4d88",
                            "status": "uploaded",
                            "@type": [
                                "FileProcessed",
                                "File",
                                "Item"
                            ],
                            "display_title": "GAPFI6J5MLR9.vcf.gz",
                            "@id": "/files-processed/GAPFI6J5MLR9/",
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
                            "principals_allowed": {
                                "view": [
                                    "editor_for.12a92962-8265-4fc0-b2f8-cf14f05db58b",
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
                            "workflow_run_inputs": [
                                {
                                    "display_title": "workflow_samplegeno v1.0.0 run 2022-04-29 22:10:36.226203",
                                    "@id": "/workflow-runs-awsem/6aea60a0-18c8-4e4d-9a1c-fd993346baf2/",
                                    "status": "shared",
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
                                    }
                                },
                                {
                                    "display_title": "workflow_granite-qcVCF v1.0.0 run 2022-04-29 22:10:39.971610",
                                    "@id": "/workflow-runs-awsem/bf1f8c90-5f99-435f-85c9-52ac471de600/",
                                    "status": "shared",
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
                                    }
                                }
                            ]
                        }
                    },
                    {}
                ],
                "input_files": [
                    {
                        "value": {
                            "uuid": "2021801b-9f49-4fc9-9e86-9b8046edd5e9",
                            "@type": [
                                "FileProcessed",
                                "File",
                                "Item"
                            ],
                            "status": "uploaded",
                            "@id": "/files-processed/GAPFI4589EXS/",
                            "display_title": "GAPFI4589EXS.gvcf.gz",
                            "workflow_run_inputs": [
                                {
                                    "@type": [
                                        "WorkflowRunAwsem",
                                        "WorkflowRun",
                                        "Item"
                                    ],
                                    "display_title": "workflow_gatk-GenotypeGVCFs-check v1.0.0 run 2022-04-29 21:10:40.235957",
                                    "@id": "/workflow-runs-awsem/3e3530ef-c67d-4708-be5f-84349f49b182/",
                                    "status": "shared",
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
                            "principals_allowed": {
                                "view": [
                                    "editor_for.12a92962-8265-4fc0-b2f8-cf14f05db58b",
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
                            "workflow_run_outputs": [
                                {
                                    "display_title": "workflow_gatk-CombineGVCFs v1.0.0 run 2022-04-29 19:55:36.043928",
                                    "@type": [
                                        "WorkflowRunAwsem",
                                        "WorkflowRun",
                                        "Item"
                                    ],
                                    "status": "shared",
                                    "uuid": "59fc114b-ccd6-416d-9555-4d2270c4c3dd",
                                    "@id": "/workflow-runs-awsem/59fc114b-ccd6-416d-9555-4d2270c4c3dd/",
                                    "principals_allowed": {
                                        "view": [
                                            "system.Authenticated"
                                        ],
                                        "edit": [
                                            "group.admin"
                                        ]
                                    }
                                }
                            ]
                        }
                    },
                    {
                        "value": {
                            "uuid": "1936f246-22e1-45dc-bb5c-9cfd55537fe7",
                            "@type": [
                                "FileReference",
                                "File",
                                "Item"
                            ],
                            "status": "uploaded",
                            "@id": "/files-reference/GAPFIXRDPDK5/",
                            "display_title": "GAPFIXRDPDK5.fa",
                            "principals_allowed": {
                                "view": [
                                    "editor_for.12a92962-8265-4fc0-b2f8-cf14f05db58b",
                                    "group.admin",
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
                        "value": {
                            "uuid": "a1d504ee-a313-4064-b6ae-65fed9738980",
                            "@type": [
                                "FileReference",
                                "File",
                                "Item"
                            ],
                            "status": "uploaded",
                            "@id": "/files-reference/GAPFIGJVJDUY/",
                            "display_title": "GAPFIGJVJDUY.txt",
                            "principals_allowed": {
                                "view": [
                                    "editor_for.12a92962-8265-4fc0-b2f8-cf14f05db58b",
                                    "group.admin",
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
                        "value": {
                            "uuid": "8ed35691-0af4-467a-adbc-81eb088549f0",
                            "@type": [
                                "FileReference",
                                "File",
                                "Item"
                            ],
                            "status": "uploaded",
                            "@id": "/files-reference/GAPFI4LJRN98/",
                            "display_title": "GAPFI4LJRN98.vcf.gz",
                            "principals_allowed": {
                                "view": [
                                    "editor_for.12a92962-8265-4fc0-b2f8-cf14f05db58b",
                                    "group.admin",
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
                        "uuid": "56c0a779-c771-4a67-acce-f7bbc2707d6e",
                        "status": "uploaded",
                        "@id": "/files-processed/GAPFI68EKBY2/",
                        "display_title": "GAPFI68EKBY2.vcf.gz",
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
                "display_title": "workflow_samplegeno v1.0.0 run 2022-04-29 22:10:36.226203",
                "status": "shared",
                "@type": [
                    "WorkflowRunAwsem",
                    "WorkflowRun",
                    "Item"
                ],
                "uuid": "6aea60a0-18c8-4e4d-9a1c-fd993346baf2",
                "@id": "/workflow-runs-awsem/6aea60a0-18c8-4e4d-9a1c-fd993346baf2/",
                "output_files": [
                    {
                        "value": {
                            "uuid": "56c0a779-c771-4a67-acce-f7bbc2707d6e",
                            "status": "uploaded",
                            "@type": [
                                "FileProcessed",
                                "File",
                                "Item"
                            ],
                            "display_title": "GAPFI68EKBY2.vcf.gz",
                            "@id": "/files-processed/GAPFI68EKBY2/",
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
                            "principals_allowed": {
                                "view": [
                                    "editor_for.12a92962-8265-4fc0-b2f8-cf14f05db58b",
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
                            "workflow_run_inputs": [
                                {
                                    "display_title": "workflow_vep-annot-check v1.0.0 run 2022-04-29 22:40:46.334063",
                                    "@id": "/workflow-runs-awsem/cf4811eb-3f1f-4951-8d84-00a2c7ffe352/",
                                    "status": "shared",
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
                                    }
                                },
                                {
                                    "display_title": "workflow_granite-qcVCF v1.0.0 run 2022-04-29 22:40:34.865115",
                                    "@id": "/workflow-runs-awsem/856f03f2-c89b-4291-94a0-6aa036673de0/",
                                    "status": "shared",
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
                                    }
                                }
                            ]
                        }
                    }
                ],
                "input_files": [
                    {
                        "value": {
                            "uuid": "a6c9f1f0-e52a-4c3b-bc91-047462bf4d88",
                            "@type": [
                                "FileProcessed",
                                "File",
                                "Item"
                            ],
                            "status": "uploaded",
                            "@id": "/files-processed/GAPFI6J5MLR9/",
                            "display_title": "GAPFI6J5MLR9.vcf.gz",
                            "workflow_run_inputs": [
                                {
                                    "@type": [
                                        "WorkflowRunAwsem",
                                        "WorkflowRun",
                                        "Item"
                                    ],
                                    "display_title": "workflow_samplegeno v1.0.0 run 2022-04-29 22:10:36.226203",
                                    "@id": "/workflow-runs-awsem/6aea60a0-18c8-4e4d-9a1c-fd993346baf2/",
                                    "status": "shared",
                                    "uuid": "6aea60a0-18c8-4e4d-9a1c-fd993346baf2",
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
                                    "display_title": "workflow_granite-qcVCF v1.0.0 run 2022-04-29 22:10:39.971610",
                                    "@id": "/workflow-runs-awsem/bf1f8c90-5f99-435f-85c9-52ac471de600/",
                                    "status": "shared",
                                    "uuid": "bf1f8c90-5f99-435f-85c9-52ac471de600",
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
                            },
                            "workflow_run_outputs": [
                                {
                                    "display_title": "workflow_gatk-GenotypeGVCFs-check v1.0.0 run 2022-04-29 21:10:40.235957",
                                    "@type": [
                                        "WorkflowRunAwsem",
                                        "WorkflowRun",
                                        "Item"
                                    ],
                                    "status": "shared",
                                    "uuid": "3e3530ef-c67d-4708-be5f-84349f49b182",
                                    "@id": "/workflow-runs-awsem/3e3530ef-c67d-4708-be5f-84349f49b182/",
                                    "principals_allowed": {
                                        "view": [
                                            "system.Authenticated"
                                        ],
                                        "edit": [
                                            "group.admin"
                                        ]
                                    }
                                }
                            ]
                        }
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
                "display_title": "workflow_granite-qcVCF v1.0.0 run 2022-04-29 22:10:39.971610",
                "status": "shared",
                "@type": [
                    "WorkflowRunAwsem",
                    "WorkflowRun",
                    "Item"
                ],
                "uuid": "bf1f8c90-5f99-435f-85c9-52ac471de600",
                "@id": "/workflow-runs-awsem/bf1f8c90-5f99-435f-85c9-52ac471de600/",
                "output_files": [
                    {},
                    {}
                ],
                "input_files": [
                    {
                        "value": {
                            "uuid": "a6c9f1f0-e52a-4c3b-bc91-047462bf4d88",
                            "@type": [
                                "FileProcessed",
                                "File",
                                "Item"
                            ],
                            "status": "uploaded",
                            "@id": "/files-processed/GAPFI6J5MLR9/",
                            "display_title": "GAPFI6J5MLR9.vcf.gz",
                            "workflow_run_inputs": [
                                {
                                    "@type": [
                                        "WorkflowRunAwsem",
                                        "WorkflowRun",
                                        "Item"
                                    ],
                                    "display_title": "workflow_samplegeno v1.0.0 run 2022-04-29 22:10:36.226203",
                                    "@id": "/workflow-runs-awsem/6aea60a0-18c8-4e4d-9a1c-fd993346baf2/",
                                    "status": "shared",
                                    "uuid": "6aea60a0-18c8-4e4d-9a1c-fd993346baf2",
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
                                    "display_title": "workflow_granite-qcVCF v1.0.0 run 2022-04-29 22:10:39.971610",
                                    "@id": "/workflow-runs-awsem/bf1f8c90-5f99-435f-85c9-52ac471de600/",
                                    "status": "shared",
                                    "uuid": "bf1f8c90-5f99-435f-85c9-52ac471de600",
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
                            },
                            "workflow_run_outputs": [
                                {
                                    "display_title": "workflow_gatk-GenotypeGVCFs-check v1.0.0 run 2022-04-29 21:10:40.235957",
                                    "@type": [
                                        "WorkflowRunAwsem",
                                        "WorkflowRun",
                                        "Item"
                                    ],
                                    "status": "shared",
                                    "uuid": "3e3530ef-c67d-4708-be5f-84349f49b182",
                                    "@id": "/workflow-runs-awsem/3e3530ef-c67d-4708-be5f-84349f49b182/",
                                    "principals_allowed": {
                                        "view": [
                                            "system.Authenticated"
                                        ],
                                        "edit": [
                                            "group.admin"
                                        ]
                                    }
                                }
                            ]
                        }
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
                "display_title": "workflow_granite-qcVCF v1.0.0 run 2022-04-29 22:40:34.865115",
                "status": "shared",
                "@type": [
                    "WorkflowRunAwsem",
                    "WorkflowRun",
                    "Item"
                ],
                "uuid": "856f03f2-c89b-4291-94a0-6aa036673de0",
                "@id": "/workflow-runs-awsem/856f03f2-c89b-4291-94a0-6aa036673de0/",
                "output_files": [
                    {},
                    {}
                ],
                "input_files": [
                    {
                        "value": {
                            "uuid": "56c0a779-c771-4a67-acce-f7bbc2707d6e",
                            "@type": [
                                "FileProcessed",
                                "File",
                                "Item"
                            ],
                            "status": "uploaded",
                            "@id": "/files-processed/GAPFI68EKBY2/",
                            "display_title": "GAPFI68EKBY2.vcf.gz",
                            "workflow_run_inputs": [
                                {
                                    "@type": [
                                        "WorkflowRunAwsem",
                                        "WorkflowRun",
                                        "Item"
                                    ],
                                    "display_title": "workflow_vep-annot-check v1.0.0 run 2022-04-29 22:40:46.334063",
                                    "@id": "/workflow-runs-awsem/cf4811eb-3f1f-4951-8d84-00a2c7ffe352/",
                                    "status": "shared",
                                    "uuid": "cf4811eb-3f1f-4951-8d84-00a2c7ffe352",
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
                                    "display_title": "workflow_granite-qcVCF v1.0.0 run 2022-04-29 22:40:34.865115",
                                    "@id": "/workflow-runs-awsem/856f03f2-c89b-4291-94a0-6aa036673de0/",
                                    "status": "shared",
                                    "uuid": "856f03f2-c89b-4291-94a0-6aa036673de0",
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
                            },
                            "workflow_run_outputs": [
                                {
                                    "display_title": "workflow_samplegeno v1.0.0 run 2022-04-29 22:10:36.226203",
                                    "@type": [
                                        "WorkflowRunAwsem",
                                        "WorkflowRun",
                                        "Item"
                                    ],
                                    "status": "shared",
                                    "uuid": "6aea60a0-18c8-4e4d-9a1c-fd993346baf2",
                                    "@id": "/workflow-runs-awsem/6aea60a0-18c8-4e4d-9a1c-fd993346baf2/",
                                    "principals_allowed": {
                                        "view": [
                                            "system.Authenticated"
                                        ],
                                        "edit": [
                                            "group.admin"
                                        ]
                                    }
                                }
                            ]
                        }
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
                        "uuid": "a7809e79-b980-4b7f-9e43-1c2a60959246",
                        "status": "uploaded",
                        "@id": "/files-processed/GAPFIACVY8U8/",
                        "display_title": "GAPFIACVY8U8.vcf.gz",
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
                "display_title": "workflow_vep-annot-check v1.0.0 run 2022-04-29 22:40:46.334063",
                "status": "shared",
                "@type": [
                    "WorkflowRunAwsem",
                    "WorkflowRun",
                    "Item"
                ],
                "uuid": "cf4811eb-3f1f-4951-8d84-00a2c7ffe352",
                "@id": "/workflow-runs-awsem/cf4811eb-3f1f-4951-8d84-00a2c7ffe352/",
                "output_files": [
                    {
                        "value": {
                            "uuid": "a7809e79-b980-4b7f-9e43-1c2a60959246",
                            "status": "uploaded",
                            "@type": [
                                "FileProcessed",
                                "File",
                                "Item"
                            ],
                            "display_title": "GAPFIACVY8U8.vcf.gz",
                            "@id": "/files-processed/GAPFIACVY8U8/",
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
                            "principals_allowed": {
                                "view": [
                                    "editor_for.12a92962-8265-4fc0-b2f8-cf14f05db58b",
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
                            "workflow_run_inputs": [
                                {
                                    "display_title": "workflow_peddy v1.0.0 run 2022-04-30 02:10:35.255342",
                                    "@id": "/workflow-runs-awsem/58210479-cf6c-40db-8a03-fbd2541be2c2/",
                                    "status": "shared",
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
                                    }
                                },
                                {
                                    "display_title": "workflow_granite-filtering-check v1.0.0 run 2022-04-30 02:10:40.339145",
                                    "@id": "/workflow-runs-awsem/64a59f36-a856-47e1-be09-d0c6b8694252/",
                                    "status": "shared",
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
                                    }
                                },
                                {
                                    "display_title": "workflow_granite-qcVCF v1.0.0 run 2022-04-30 02:40:35.197316",
                                    "@id": "/workflow-runs-awsem/eba22967-9efc-4071-a3df-fa5b55943db8/",
                                    "status": "shared",
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
                                    }
                                }
                            ]
                        }
                    },
                    {}
                ],
                "input_files": [
                    {
                        "value": {
                            "uuid": "56c0a779-c771-4a67-acce-f7bbc2707d6e",
                            "@type": [
                                "FileProcessed",
                                "File",
                                "Item"
                            ],
                            "status": "uploaded",
                            "@id": "/files-processed/GAPFI68EKBY2/",
                            "display_title": "GAPFI68EKBY2.vcf.gz",
                            "workflow_run_inputs": [
                                {
                                    "@type": [
                                        "WorkflowRunAwsem",
                                        "WorkflowRun",
                                        "Item"
                                    ],
                                    "display_title": "workflow_vep-annot-check v1.0.0 run 2022-04-29 22:40:46.334063",
                                    "@id": "/workflow-runs-awsem/cf4811eb-3f1f-4951-8d84-00a2c7ffe352/",
                                    "status": "shared",
                                    "uuid": "cf4811eb-3f1f-4951-8d84-00a2c7ffe352",
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
                                    "display_title": "workflow_granite-qcVCF v1.0.0 run 2022-04-29 22:40:34.865115",
                                    "@id": "/workflow-runs-awsem/856f03f2-c89b-4291-94a0-6aa036673de0/",
                                    "status": "shared",
                                    "uuid": "856f03f2-c89b-4291-94a0-6aa036673de0",
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
                            },
                            "workflow_run_outputs": [
                                {
                                    "display_title": "workflow_samplegeno v1.0.0 run 2022-04-29 22:10:36.226203",
                                    "@type": [
                                        "WorkflowRunAwsem",
                                        "WorkflowRun",
                                        "Item"
                                    ],
                                    "status": "shared",
                                    "uuid": "6aea60a0-18c8-4e4d-9a1c-fd993346baf2",
                                    "@id": "/workflow-runs-awsem/6aea60a0-18c8-4e4d-9a1c-fd993346baf2/",
                                    "principals_allowed": {
                                        "view": [
                                            "system.Authenticated"
                                        ],
                                        "edit": [
                                            "group.admin"
                                        ]
                                    }
                                }
                            ]
                        }
                    },
                    {
                        "value": {
                            "uuid": "1936f246-22e1-45dc-bb5c-9cfd55537fe7",
                            "@type": [
                                "FileReference",
                                "File",
                                "Item"
                            ],
                            "status": "uploaded",
                            "@id": "/files-reference/GAPFIXRDPDK5/",
                            "display_title": "GAPFIXRDPDK5.fa",
                            "principals_allowed": {
                                "view": [
                                    "editor_for.12a92962-8265-4fc0-b2f8-cf14f05db58b",
                                    "group.admin",
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
                        "value": {
                            "uuid": "1c07a3aa-e2a3-498c-b838-15991c4a2f28",
                            "@type": [
                                "FileReference",
                                "File",
                                "Item"
                            ],
                            "status": "uploaded",
                            "@id": "/files-reference/GAPFIBGEOI72/",
                            "display_title": "GAPFIBGEOI72.txt",
                            "principals_allowed": {
                                "view": [
                                    "editor_for.12a92962-8265-4fc0-b2f8-cf14f05db58b",
                                    "group.admin",
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
                        "value": {
                            "uuid": "ea103486-b65a-4439-9d0b-1186f8e59388",
                            "@type": [
                                "FileReference",
                                "File",
                                "Item"
                            ],
                            "status": "uploaded",
                            "@id": "/files-reference/GAPFIL8XMTIV/",
                            "display_title": "GAPFIL8XMTIV.vep.tar.gz",
                            "principals_allowed": {
                                "view": [
                                    "editor_for.12a92962-8265-4fc0-b2f8-cf14f05db58b",
                                    "group.admin",
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
                        "value": {
                            "uuid": "7db786d5-13d2-4622-bdd2-99866036b9b9",
                            "@type": [
                                "FileReference",
                                "File",
                                "Item"
                            ],
                            "status": "uploaded",
                            "@id": "/files-reference/GAPFI121RWQE/",
                            "display_title": "GAPFI121RWQE.vcf.gz",
                            "principals_allowed": {
                                "view": [
                                    "editor_for.12a92962-8265-4fc0-b2f8-cf14f05db58b",
                                    "group.admin",
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
                        "value": {
                            "uuid": "dc02df4c-49ac-4532-b85c-02800941aa44",
                            "@type": [
                                "FileReference",
                                "File",
                                "Item"
                            ],
                            "status": "uploaded",
                            "@id": "/files-reference/GAPFIKJ66FKY/",
                            "display_title": "GAPFIKJ66FKY.dbnsfp.gz",
                            "principals_allowed": {
                                "view": [
                                    "editor_for.12a92962-8265-4fc0-b2f8-cf14f05db58b",
                                    "group.admin",
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
                        "value": {
                            "uuid": "71a7d16b-8452-4266-ae80-bbede2e305e2",
                            "@type": [
                                "FileReference",
                                "File",
                                "Item"
                            ],
                            "status": "uploaded",
                            "@id": "/files-reference/GAPFI6BNNTKA/",
                            "display_title": "GAPFI6BNNTKA.tar.gz",
                            "principals_allowed": {
                                "view": [
                                    "editor_for.12a92962-8265-4fc0-b2f8-cf14f05db58b",
                                    "group.admin",
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
                        "value": {
                            "uuid": "a35e580c-7579-4312-a3a1-66810e6d9366",
                            "@type": [
                                "FileReference",
                                "File",
                                "Item"
                            ],
                            "status": "uploaded",
                            "@id": "/files-reference/GAPFISUOC64Q/",
                            "display_title": "GAPFISUOC64Q.vcf.gz",
                            "principals_allowed": {
                                "view": [
                                    "editor_for.12a92962-8265-4fc0-b2f8-cf14f05db58b",
                                    "group.admin",
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
                        "value": {
                            "uuid": "3b7c0c29-5ee2-47c8-95a8-d28e15d5de47",
                            "@type": [
                                "FileReference",
                                "File",
                                "Item"
                            ],
                            "status": "uploaded",
                            "@id": "/files-reference/GAPFIZOPCWIU/",
                            "display_title": "GAPFIZOPCWIU.vcf.gz",
                            "principals_allowed": {
                                "view": [
                                    "editor_for.12a92962-8265-4fc0-b2f8-cf14f05db58b",
                                    "group.admin",
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
                        "value": {
                            "uuid": "52c6cbf6-ae94-4c10-ad03-26ed34f74a3e",
                            "@type": [
                                "FileReference",
                                "File",
                                "Item"
                            ],
                            "status": "uploaded",
                            "@id": "/files-reference/GAPFIJOMA2Q8/",
                            "display_title": "GAPFIJOMA2Q8.vcf.gz",
                            "principals_allowed": {
                                "view": [
                                    "editor_for.12a92962-8265-4fc0-b2f8-cf14f05db58b",
                                    "group.admin",
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
                        "value": {
                            "uuid": "dd6f0384-d0b5-47d6-99a8-395c0b72feed",
                            "@type": [
                                "FileReference",
                                "File",
                                "Item"
                            ],
                            "status": "uploaded",
                            "@id": "/files-reference/GAPFIC5416E6/",
                            "display_title": "GAPFIC5416E6.vcf.gz",
                            "principals_allowed": {
                                "view": [
                                    "editor_for.12a92962-8265-4fc0-b2f8-cf14f05db58b",
                                    "group.admin",
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
                        "value": {
                            "uuid": "672de47f-d058-4dbd-9fc4-3e134cfe71d8",
                            "@type": [
                                "FileReference",
                                "File",
                                "Item"
                            ],
                            "status": "uploaded",
                            "@id": "/files-reference/GAPFI566QQCV/",
                            "display_title": "GAPFI566QQCV.tsv.gz",
                            "principals_allowed": {
                                "view": [
                                    "editor_for.12a92962-8265-4fc0-b2f8-cf14f05db58b",
                                    "group.admin",
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
                        "value": {
                            "uuid": "b9f123dd-be05-4a14-957a-5e1e5a5ce254",
                            "@type": [
                                "FileReference",
                                "File",
                                "Item"
                            ],
                            "status": "uploaded",
                            "@id": "/files-reference/GAPFI1GC6AXF/",
                            "display_title": "GAPFI1GC6AXF.tsv.gz",
                            "principals_allowed": {
                                "view": [
                                    "editor_for.12a92962-8265-4fc0-b2f8-cf14f05db58b",
                                    "group.admin",
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
                        "value": {
                            "uuid": "af93aecb-6b8e-4c8b-b159-eefb3f9d0ffb",
                            "@type": [
                                "FileReference",
                                "File",
                                "Item"
                            ],
                            "status": "uploaded",
                            "@id": "/files-reference/GAPFIMQ7MHGA/",
                            "display_title": "GAPFIMQ7MHGA.bw",
                            "principals_allowed": {
                                "view": [
                                    "editor_for.12a92962-8265-4fc0-b2f8-cf14f05db58b",
                                    "group.admin",
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
                        "value": {
                            "uuid": "f6809af1-f7b9-43c0-882a-16764ccc431d",
                            "@type": [
                                "FileReference",
                                "File",
                                "Item"
                            ],
                            "status": "uploaded",
                            "@id": "/files-reference/GAPFI5MRTDLN/",
                            "display_title": "GAPFI5MRTDLN.bw",
                            "principals_allowed": {
                                "view": [
                                    "editor_for.12a92962-8265-4fc0-b2f8-cf14f05db58b",
                                    "group.admin",
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
                        "value": {
                            "uuid": "19f03828-175b-4594-ba1a-52ddabcf640d",
                            "@type": [
                                "FileReference",
                                "File",
                                "Item"
                            ],
                            "status": "uploaded",
                            "@id": "/files-reference/GAPFI6KXAQMV/",
                            "display_title": "GAPFI6KXAQMV.bw",
                            "principals_allowed": {
                                "view": [
                                    "editor_for.12a92962-8265-4fc0-b2f8-cf14f05db58b",
                                    "group.admin",
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
                "display_title": "workflow_peddy v1.0.0 run 2022-04-30 02:10:35.255342",
                "status": "shared",
                "@type": [
                    "WorkflowRunAwsem",
                    "WorkflowRun",
                    "Item"
                ],
                "uuid": "58210479-cf6c-40db-8a03-fbd2541be2c2",
                "@id": "/workflow-runs-awsem/58210479-cf6c-40db-8a03-fbd2541be2c2/",
                "output_files": [
                    {},
                    {}
                ],
                "input_files": [
                    {
                        "value": {
                            "uuid": "a7809e79-b980-4b7f-9e43-1c2a60959246",
                            "@type": [
                                "FileProcessed",
                                "File",
                                "Item"
                            ],
                            "status": "uploaded",
                            "@id": "/files-processed/GAPFIACVY8U8/",
                            "display_title": "GAPFIACVY8U8.vcf.gz",
                            "workflow_run_inputs": [
                                {
                                    "@type": [
                                        "WorkflowRunAwsem",
                                        "WorkflowRun",
                                        "Item"
                                    ],
                                    "display_title": "workflow_peddy v1.0.0 run 2022-04-30 02:10:35.255342",
                                    "@id": "/workflow-runs-awsem/58210479-cf6c-40db-8a03-fbd2541be2c2/",
                                    "status": "shared",
                                    "uuid": "58210479-cf6c-40db-8a03-fbd2541be2c2",
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
                                    "display_title": "workflow_granite-filtering-check v1.0.0 run 2022-04-30 02:10:40.339145",
                                    "@id": "/workflow-runs-awsem/64a59f36-a856-47e1-be09-d0c6b8694252/",
                                    "status": "shared",
                                    "uuid": "64a59f36-a856-47e1-be09-d0c6b8694252",
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
                                    "display_title": "workflow_granite-qcVCF v1.0.0 run 2022-04-30 02:40:35.197316",
                                    "@id": "/workflow-runs-awsem/eba22967-9efc-4071-a3df-fa5b55943db8/",
                                    "status": "shared",
                                    "uuid": "eba22967-9efc-4071-a3df-fa5b55943db8",
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
                            },
                            "workflow_run_outputs": [
                                {
                                    "display_title": "workflow_vep-annot-check v1.0.0 run 2022-04-29 22:40:46.334063",
                                    "@type": [
                                        "WorkflowRunAwsem",
                                        "WorkflowRun",
                                        "Item"
                                    ],
                                    "status": "shared",
                                    "uuid": "cf4811eb-3f1f-4951-8d84-00a2c7ffe352",
                                    "@id": "/workflow-runs-awsem/cf4811eb-3f1f-4951-8d84-00a2c7ffe352/",
                                    "principals_allowed": {
                                        "view": [
                                            "system.Authenticated"
                                        ],
                                        "edit": [
                                            "group.admin"
                                        ]
                                    }
                                }
                            ]
                        }
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
                "display_title": "workflow_granite-qcVCF v1.0.0 run 2022-04-30 02:40:35.197316",
                "status": "shared",
                "@type": [
                    "WorkflowRunAwsem",
                    "WorkflowRun",
                    "Item"
                ],
                "uuid": "eba22967-9efc-4071-a3df-fa5b55943db8",
                "@id": "/workflow-runs-awsem/eba22967-9efc-4071-a3df-fa5b55943db8/",
                "output_files": [
                    {},
                    {}
                ],
                "input_files": [
                    {
                        "value": {
                            "uuid": "a7809e79-b980-4b7f-9e43-1c2a60959246",
                            "@type": [
                                "FileProcessed",
                                "File",
                                "Item"
                            ],
                            "status": "uploaded",
                            "@id": "/files-processed/GAPFIACVY8U8/",
                            "display_title": "GAPFIACVY8U8.vcf.gz",
                            "workflow_run_inputs": [
                                {
                                    "@type": [
                                        "WorkflowRunAwsem",
                                        "WorkflowRun",
                                        "Item"
                                    ],
                                    "display_title": "workflow_peddy v1.0.0 run 2022-04-30 02:10:35.255342",
                                    "@id": "/workflow-runs-awsem/58210479-cf6c-40db-8a03-fbd2541be2c2/",
                                    "status": "shared",
                                    "uuid": "58210479-cf6c-40db-8a03-fbd2541be2c2",
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
                                    "display_title": "workflow_granite-filtering-check v1.0.0 run 2022-04-30 02:10:40.339145",
                                    "@id": "/workflow-runs-awsem/64a59f36-a856-47e1-be09-d0c6b8694252/",
                                    "status": "shared",
                                    "uuid": "64a59f36-a856-47e1-be09-d0c6b8694252",
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
                                    "display_title": "workflow_granite-qcVCF v1.0.0 run 2022-04-30 02:40:35.197316",
                                    "@id": "/workflow-runs-awsem/eba22967-9efc-4071-a3df-fa5b55943db8/",
                                    "status": "shared",
                                    "uuid": "eba22967-9efc-4071-a3df-fa5b55943db8",
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
                            },
                            "workflow_run_outputs": [
                                {
                                    "display_title": "workflow_vep-annot-check v1.0.0 run 2022-04-29 22:40:46.334063",
                                    "@type": [
                                        "WorkflowRunAwsem",
                                        "WorkflowRun",
                                        "Item"
                                    ],
                                    "status": "shared",
                                    "uuid": "cf4811eb-3f1f-4951-8d84-00a2c7ffe352",
                                    "@id": "/workflow-runs-awsem/cf4811eb-3f1f-4951-8d84-00a2c7ffe352/",
                                    "principals_allowed": {
                                        "view": [
                                            "system.Authenticated"
                                        ],
                                        "edit": [
                                            "group.admin"
                                        ]
                                    }
                                }
                            ]
                        }
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
                        "uuid": "c11cb753-5ae1-4298-b714-e30b67b46653",
                        "status": "uploaded",
                        "@id": "/files-processed/GAPFIF8PBOT6/",
                        "display_title": "GAPFIF8PBOT6.vcf.gz",
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
                "display_title": "workflow_granite-filtering-check v1.0.0 run 2022-04-30 02:10:40.339145",
                "status": "shared",
                "@type": [
                    "WorkflowRunAwsem",
                    "WorkflowRun",
                    "Item"
                ],
                "uuid": "64a59f36-a856-47e1-be09-d0c6b8694252",
                "@id": "/workflow-runs-awsem/64a59f36-a856-47e1-be09-d0c6b8694252/",
                "output_files": [
                    {
                        "value": {
                            "uuid": "c11cb753-5ae1-4298-b714-e30b67b46653",
                            "status": "uploaded",
                            "@type": [
                                "FileProcessed",
                                "File",
                                "Item"
                            ],
                            "display_title": "GAPFIF8PBOT6.vcf.gz",
                            "@id": "/files-processed/GAPFIF8PBOT6/",
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
                            "principals_allowed": {
                                "view": [
                                    "editor_for.12a92962-8265-4fc0-b2f8-cf14f05db58b",
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
                            "workflow_run_inputs": [
                                {
                                    "display_title": "workflow_granite-qcVCF v1.0.0 run 2022-04-30 02:55:39.004849",
                                    "@id": "/workflow-runs-awsem/99c36be0-a667-456a-9b8c-b08bb3b4da17/",
                                    "status": "shared",
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
                                    }
                                },
                                {
                                    "display_title": "workflow_granite-novoCaller-rck-check v1.0.0 run 2022-04-30 02:55:36.042917",
                                    "@id": "/workflow-runs-awsem/2160c911-2d1b-466b-9643-ed30c74228a8/",
                                    "status": "shared",
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
                                    }
                                }
                            ]
                        }
                    },
                    {}
                ],
                "input_files": [
                    {
                        "value": {
                            "uuid": "a7809e79-b980-4b7f-9e43-1c2a60959246",
                            "@type": [
                                "FileProcessed",
                                "File",
                                "Item"
                            ],
                            "status": "uploaded",
                            "@id": "/files-processed/GAPFIACVY8U8/",
                            "display_title": "GAPFIACVY8U8.vcf.gz",
                            "workflow_run_inputs": [
                                {
                                    "@type": [
                                        "WorkflowRunAwsem",
                                        "WorkflowRun",
                                        "Item"
                                    ],
                                    "display_title": "workflow_peddy v1.0.0 run 2022-04-30 02:10:35.255342",
                                    "@id": "/workflow-runs-awsem/58210479-cf6c-40db-8a03-fbd2541be2c2/",
                                    "status": "shared",
                                    "uuid": "58210479-cf6c-40db-8a03-fbd2541be2c2",
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
                                    "display_title": "workflow_granite-filtering-check v1.0.0 run 2022-04-30 02:10:40.339145",
                                    "@id": "/workflow-runs-awsem/64a59f36-a856-47e1-be09-d0c6b8694252/",
                                    "status": "shared",
                                    "uuid": "64a59f36-a856-47e1-be09-d0c6b8694252",
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
                                    "display_title": "workflow_granite-qcVCF v1.0.0 run 2022-04-30 02:40:35.197316",
                                    "@id": "/workflow-runs-awsem/eba22967-9efc-4071-a3df-fa5b55943db8/",
                                    "status": "shared",
                                    "uuid": "eba22967-9efc-4071-a3df-fa5b55943db8",
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
                            },
                            "workflow_run_outputs": [
                                {
                                    "display_title": "workflow_vep-annot-check v1.0.0 run 2022-04-29 22:40:46.334063",
                                    "@type": [
                                        "WorkflowRunAwsem",
                                        "WorkflowRun",
                                        "Item"
                                    ],
                                    "status": "shared",
                                    "uuid": "cf4811eb-3f1f-4951-8d84-00a2c7ffe352",
                                    "@id": "/workflow-runs-awsem/cf4811eb-3f1f-4951-8d84-00a2c7ffe352/",
                                    "principals_allowed": {
                                        "view": [
                                            "system.Authenticated"
                                        ],
                                        "edit": [
                                            "group.admin"
                                        ]
                                    }
                                }
                            ]
                        }
                    },
                    {
                        "value": {
                            "uuid": "84f2bb24-edd7-459b-ab89-0a21866d7826",
                            "@type": [
                                "FileReference",
                                "File",
                                "Item"
                            ],
                            "status": "uploaded",
                            "@id": "/files-reference/GAPFI5MKCART/",
                            "display_title": "GAPFI5MKCART.txt",
                            "principals_allowed": {
                                "view": [
                                    "editor_for.12a92962-8265-4fc0-b2f8-cf14f05db58b",
                                    "group.admin",
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
                        "uuid": "0d5b70d8-3ab9-474b-92ff-0b41bfa1919b",
                        "status": "uploaded",
                        "@id": "/files-processed/GAPFIRZZWDQL/",
                        "display_title": "GAPFIRZZWDQL.vcf.gz",
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
                "display_title": "workflow_granite-novoCaller-rck-check v1.0.0 run 2022-04-30 02:55:36.042917",
                "status": "shared",
                "@type": [
                    "WorkflowRunAwsem",
                    "WorkflowRun",
                    "Item"
                ],
                "uuid": "2160c911-2d1b-466b-9643-ed30c74228a8",
                "@id": "/workflow-runs-awsem/2160c911-2d1b-466b-9643-ed30c74228a8/",
                "output_files": [
                    {
                        "value": {
                            "uuid": "0d5b70d8-3ab9-474b-92ff-0b41bfa1919b",
                            "status": "uploaded",
                            "@type": [
                                "FileProcessed",
                                "File",
                                "Item"
                            ],
                            "display_title": "GAPFIRZZWDQL.vcf.gz",
                            "@id": "/files-processed/GAPFIRZZWDQL/",
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
                            "principals_allowed": {
                                "view": [
                                    "editor_for.12a92962-8265-4fc0-b2f8-cf14f05db58b",
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
                            "workflow_run_inputs": [
                                {
                                    "display_title": "workflow_granite-qcVCF v1.0.0 run 2022-04-30 05:10:33.627859",
                                    "@id": "/workflow-runs-awsem/31fad2bc-d98e-446e-8cc5-a695aee8ba47/",
                                    "status": "shared",
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
                                    }
                                },
                                {
                                    "display_title": "workflow_granite-comHet-check v1.0.0 run 2022-04-30 05:10:39.280286",
                                    "@id": "/workflow-runs-awsem/e71195e4-f32c-4cf7-866b-15b522b3998c/",
                                    "status": "shared",
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
                                    }
                                }
                            ]
                        }
                    },
                    {}
                ],
                "input_files": [
                    {
                        "value": {
                            "uuid": "c11cb753-5ae1-4298-b714-e30b67b46653",
                            "@type": [
                                "FileProcessed",
                                "File",
                                "Item"
                            ],
                            "status": "uploaded",
                            "@id": "/files-processed/GAPFIF8PBOT6/",
                            "display_title": "GAPFIF8PBOT6.vcf.gz",
                            "workflow_run_inputs": [
                                {
                                    "@type": [
                                        "WorkflowRunAwsem",
                                        "WorkflowRun",
                                        "Item"
                                    ],
                                    "display_title": "workflow_granite-qcVCF v1.0.0 run 2022-04-30 02:55:39.004849",
                                    "@id": "/workflow-runs-awsem/99c36be0-a667-456a-9b8c-b08bb3b4da17/",
                                    "status": "shared",
                                    "uuid": "99c36be0-a667-456a-9b8c-b08bb3b4da17",
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
                                    "display_title": "workflow_granite-novoCaller-rck-check v1.0.0 run 2022-04-30 02:55:36.042917",
                                    "@id": "/workflow-runs-awsem/2160c911-2d1b-466b-9643-ed30c74228a8/",
                                    "status": "shared",
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
                            "principals_allowed": {
                                "view": [
                                    "editor_for.12a92962-8265-4fc0-b2f8-cf14f05db58b",
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
                            "workflow_run_outputs": [
                                {
                                    "display_title": "workflow_granite-filtering-check v1.0.0 run 2022-04-30 02:10:40.339145",
                                    "@type": [
                                        "WorkflowRunAwsem",
                                        "WorkflowRun",
                                        "Item"
                                    ],
                                    "status": "shared",
                                    "uuid": "64a59f36-a856-47e1-be09-d0c6b8694252",
                                    "@id": "/workflow-runs-awsem/64a59f36-a856-47e1-be09-d0c6b8694252/",
                                    "principals_allowed": {
                                        "view": [
                                            "system.Authenticated"
                                        ],
                                        "edit": [
                                            "group.admin"
                                        ]
                                    }
                                }
                            ]
                        }
                    },
                    {
                        "value": {
                            "uuid": "eac862c0-8c87-4838-83cb-9a77412bff6f",
                            "@type": [
                                "FileReference",
                                "File",
                                "Item"
                            ],
                            "status": "uploaded",
                            "@id": "/files-reference/GAPFIMO8Y4PZ/",
                            "display_title": "GAPFIMO8Y4PZ.rck.tar",
                            "principals_allowed": {
                                "view": [
                                    "editor_for.12a92962-8265-4fc0-b2f8-cf14f05db58b",
                                    "group.admin",
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
                        "value": {
                            "uuid": "3e8a17d1-e07f-4226-bd6a-a4ca13606528",
                            "@type": [
                                "FileProcessed",
                                "File",
                                "Item"
                            ],
                            "status": "uploaded",
                            "@id": "/files-processed/GAPFI7TBYWC7/",
                            "display_title": "GAPFI7TBYWC7.rck.tar",
                            "workflow_run_inputs": [
                                {
                                    "@type": [
                                        "WorkflowRunAwsem",
                                        "WorkflowRun",
                                        "Item"
                                    ],
                                    "display_title": "workflow_granite-novoCaller-rck-check v1.0.0 run 2022-04-30 02:55:36.042917",
                                    "@id": "/workflow-runs-awsem/2160c911-2d1b-466b-9643-ed30c74228a8/",
                                    "status": "shared",
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
                            "principals_allowed": {
                                "view": [
                                    "editor_for.12a92962-8265-4fc0-b2f8-cf14f05db58b",
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
                            "workflow_run_outputs": [
                                {
                                    "display_title": "workflow_granite-rckTar v1.0.0 run 2022-04-29 21:10:35.118284",
                                    "@type": [
                                        "WorkflowRunAwsem",
                                        "WorkflowRun",
                                        "Item"
                                    ],
                                    "status": "shared",
                                    "uuid": "6fb5a7f0-2156-49e3-bf42-95f4e8decdde",
                                    "@id": "/workflow-runs-awsem/6fb5a7f0-2156-49e3-bf42-95f4e8decdde/",
                                    "principals_allowed": {
                                        "view": [
                                            "system.Authenticated"
                                        ],
                                        "edit": [
                                            "group.admin"
                                        ]
                                    }
                                }
                            ]
                        }
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
                "display_title": "workflow_granite-qcVCF v1.0.0 run 2022-04-30 02:55:39.004849",
                "status": "shared",
                "@type": [
                    "WorkflowRunAwsem",
                    "WorkflowRun",
                    "Item"
                ],
                "uuid": "99c36be0-a667-456a-9b8c-b08bb3b4da17",
                "@id": "/workflow-runs-awsem/99c36be0-a667-456a-9b8c-b08bb3b4da17/",
                "output_files": [
                    {},
                    {}
                ],
                "input_files": [
                    {
                        "value": {
                            "uuid": "c11cb753-5ae1-4298-b714-e30b67b46653",
                            "@type": [
                                "FileProcessed",
                                "File",
                                "Item"
                            ],
                            "status": "uploaded",
                            "@id": "/files-processed/GAPFIF8PBOT6/",
                            "display_title": "GAPFIF8PBOT6.vcf.gz",
                            "workflow_run_inputs": [
                                {
                                    "@type": [
                                        "WorkflowRunAwsem",
                                        "WorkflowRun",
                                        "Item"
                                    ],
                                    "display_title": "workflow_granite-qcVCF v1.0.0 run 2022-04-30 02:55:39.004849",
                                    "@id": "/workflow-runs-awsem/99c36be0-a667-456a-9b8c-b08bb3b4da17/",
                                    "status": "shared",
                                    "uuid": "99c36be0-a667-456a-9b8c-b08bb3b4da17",
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
                                    "display_title": "workflow_granite-novoCaller-rck-check v1.0.0 run 2022-04-30 02:55:36.042917",
                                    "@id": "/workflow-runs-awsem/2160c911-2d1b-466b-9643-ed30c74228a8/",
                                    "status": "shared",
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
                            "principals_allowed": {
                                "view": [
                                    "editor_for.12a92962-8265-4fc0-b2f8-cf14f05db58b",
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
                            "workflow_run_outputs": [
                                {
                                    "display_title": "workflow_granite-filtering-check v1.0.0 run 2022-04-30 02:10:40.339145",
                                    "@type": [
                                        "WorkflowRunAwsem",
                                        "WorkflowRun",
                                        "Item"
                                    ],
                                    "status": "shared",
                                    "uuid": "64a59f36-a856-47e1-be09-d0c6b8694252",
                                    "@id": "/workflow-runs-awsem/64a59f36-a856-47e1-be09-d0c6b8694252/",
                                    "principals_allowed": {
                                        "view": [
                                            "system.Authenticated"
                                        ],
                                        "edit": [
                                            "group.admin"
                                        ]
                                    }
                                }
                            ]
                        }
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
                "display_title": "workflow_granite-qcVCF v1.0.0 run 2022-04-30 05:10:33.627859",
                "status": "shared",
                "@type": [
                    "WorkflowRunAwsem",
                    "WorkflowRun",
                    "Item"
                ],
                "uuid": "31fad2bc-d98e-446e-8cc5-a695aee8ba47",
                "@id": "/workflow-runs-awsem/31fad2bc-d98e-446e-8cc5-a695aee8ba47/",
                "output_files": [
                    {},
                    {}
                ],
                "input_files": [
                    {
                        "value": {
                            "uuid": "0d5b70d8-3ab9-474b-92ff-0b41bfa1919b",
                            "@type": [
                                "FileProcessed",
                                "File",
                                "Item"
                            ],
                            "status": "uploaded",
                            "@id": "/files-processed/GAPFIRZZWDQL/",
                            "display_title": "GAPFIRZZWDQL.vcf.gz",
                            "workflow_run_inputs": [
                                {
                                    "@type": [
                                        "WorkflowRunAwsem",
                                        "WorkflowRun",
                                        "Item"
                                    ],
                                    "display_title": "workflow_granite-qcVCF v1.0.0 run 2022-04-30 05:10:33.627859",
                                    "@id": "/workflow-runs-awsem/31fad2bc-d98e-446e-8cc5-a695aee8ba47/",
                                    "status": "shared",
                                    "uuid": "31fad2bc-d98e-446e-8cc5-a695aee8ba47",
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
                                    "display_title": "workflow_granite-comHet-check v1.0.0 run 2022-04-30 05:10:39.280286",
                                    "@id": "/workflow-runs-awsem/e71195e4-f32c-4cf7-866b-15b522b3998c/",
                                    "status": "shared",
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
                            "principals_allowed": {
                                "view": [
                                    "editor_for.12a92962-8265-4fc0-b2f8-cf14f05db58b",
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
                            "workflow_run_outputs": [
                                {
                                    "display_title": "workflow_granite-novoCaller-rck-check v1.0.0 run 2022-04-30 02:55:36.042917",
                                    "@type": [
                                        "WorkflowRunAwsem",
                                        "WorkflowRun",
                                        "Item"
                                    ],
                                    "status": "shared",
                                    "uuid": "2160c911-2d1b-466b-9643-ed30c74228a8",
                                    "@id": "/workflow-runs-awsem/2160c911-2d1b-466b-9643-ed30c74228a8/",
                                    "principals_allowed": {
                                        "view": [
                                            "system.Authenticated"
                                        ],
                                        "edit": [
                                            "group.admin"
                                        ]
                                    }
                                }
                            ]
                        }
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
                        "uuid": "2bdf5b97-b382-4c11-a70a-b6a5210bf319",
                        "status": "uploaded",
                        "@id": "/files-processed/GAPFIUXS6TY7/",
                        "display_title": "GAPFIUXS6TY7.vcf.gz",
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
                "display_title": "workflow_granite-comHet-check v1.0.0 run 2022-04-30 05:10:39.280286",
                "status": "shared",
                "@type": [
                    "WorkflowRunAwsem",
                    "WorkflowRun",
                    "Item"
                ],
                "uuid": "e71195e4-f32c-4cf7-866b-15b522b3998c",
                "@id": "/workflow-runs-awsem/e71195e4-f32c-4cf7-866b-15b522b3998c/",
                "output_files": [
                    {
                        "value": {
                            "uuid": "2bdf5b97-b382-4c11-a70a-b6a5210bf319",
                            "status": "uploaded",
                            "@type": [
                                "FileProcessed",
                                "File",
                                "Item"
                            ],
                            "display_title": "GAPFIUXS6TY7.vcf.gz",
                            "@id": "/files-processed/GAPFIUXS6TY7/",
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
                            "principals_allowed": {
                                "view": [
                                    "editor_for.12a92962-8265-4fc0-b2f8-cf14f05db58b",
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
                            "workflow_run_inputs": [
                                {
                                    "display_title": "workflow_dbSNP_ID_fixer-check v1.0.0 run 2022-04-30 05:40:37.109983",
                                    "@id": "/workflow-runs-awsem/703d75f8-4fdf-4cb4-a65b-6181e1079660/",
                                    "status": "shared",
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
                                    }
                                },
                                {
                                    "display_title": "workflow_granite-qcVCF v1.0.0 run 2022-04-30 05:40:39.370350",
                                    "@id": "/workflow-runs-awsem/dd927729-294a-4cff-bf20-115dc9561ff7/",
                                    "status": "shared",
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
                                    }
                                }
                            ]
                        }
                    },
                    {},
                    {}
                ],
                "input_files": [
                    {
                        "value": {
                            "uuid": "0d5b70d8-3ab9-474b-92ff-0b41bfa1919b",
                            "@type": [
                                "FileProcessed",
                                "File",
                                "Item"
                            ],
                            "status": "uploaded",
                            "@id": "/files-processed/GAPFIRZZWDQL/",
                            "display_title": "GAPFIRZZWDQL.vcf.gz",
                            "workflow_run_inputs": [
                                {
                                    "@type": [
                                        "WorkflowRunAwsem",
                                        "WorkflowRun",
                                        "Item"
                                    ],
                                    "display_title": "workflow_granite-qcVCF v1.0.0 run 2022-04-30 05:10:33.627859",
                                    "@id": "/workflow-runs-awsem/31fad2bc-d98e-446e-8cc5-a695aee8ba47/",
                                    "status": "shared",
                                    "uuid": "31fad2bc-d98e-446e-8cc5-a695aee8ba47",
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
                                    "display_title": "workflow_granite-comHet-check v1.0.0 run 2022-04-30 05:10:39.280286",
                                    "@id": "/workflow-runs-awsem/e71195e4-f32c-4cf7-866b-15b522b3998c/",
                                    "status": "shared",
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
                            "principals_allowed": {
                                "view": [
                                    "editor_for.12a92962-8265-4fc0-b2f8-cf14f05db58b",
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
                            "workflow_run_outputs": [
                                {
                                    "display_title": "workflow_granite-novoCaller-rck-check v1.0.0 run 2022-04-30 02:55:36.042917",
                                    "@type": [
                                        "WorkflowRunAwsem",
                                        "WorkflowRun",
                                        "Item"
                                    ],
                                    "status": "shared",
                                    "uuid": "2160c911-2d1b-466b-9643-ed30c74228a8",
                                    "@id": "/workflow-runs-awsem/2160c911-2d1b-466b-9643-ed30c74228a8/",
                                    "principals_allowed": {
                                        "view": [
                                            "system.Authenticated"
                                        ],
                                        "edit": [
                                            "group.admin"
                                        ]
                                    }
                                }
                            ]
                        }
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
                        "uuid": "352d3ace-c687-41de-9027-db84bf8af10a",
                        "status": "uploaded",
                        "@id": "/files-processed/GAPFI7UFWBGA/",
                        "display_title": "GAPFI7UFWBGA.vcf.gz",
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
                "display_title": "workflow_dbSNP_ID_fixer-check v1.0.0 run 2022-04-30 05:40:37.109983",
                "status": "shared",
                "@type": [
                    "WorkflowRunAwsem",
                    "WorkflowRun",
                    "Item"
                ],
                "uuid": "703d75f8-4fdf-4cb4-a65b-6181e1079660",
                "@id": "/workflow-runs-awsem/703d75f8-4fdf-4cb4-a65b-6181e1079660/",
                "output_files": [
                    {
                        "value": {
                            "uuid": "352d3ace-c687-41de-9027-db84bf8af10a",
                            "status": "uploaded",
                            "@type": [
                                "FileProcessed",
                                "File",
                                "Item"
                            ],
                            "display_title": "GAPFI7UFWBGA.vcf.gz",
                            "@id": "/files-processed/GAPFI7UFWBGA/",
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
                            "principals_allowed": {
                                "view": [
                                    "editor_for.12a92962-8265-4fc0-b2f8-cf14f05db58b",
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
                            "workflow_run_inputs": [
                                {
                                    "display_title": "workflow_granite-qcVCF v1.0.0 run 2022-04-30 06:10:34.657719",
                                    "@id": "/workflow-runs-awsem/da4c3ef1-7cee-42cf-a6d1-ea60dbd60169/",
                                    "status": "shared",
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
                                    }
                                },
                                {
                                    "display_title": "workflow_hg19lo_hgvsg-check v1.0.0 run 2022-04-30 06:10:40.434728",
                                    "@id": "/workflow-runs-awsem/5df3ef23-0e93-4510-8ebb-63ebcc1214a7/",
                                    "status": "shared",
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
                                    }
                                }
                            ]
                        }
                    },
                    {}
                ],
                "input_files": [
                    {
                        "value": {
                            "uuid": "2bdf5b97-b382-4c11-a70a-b6a5210bf319",
                            "@type": [
                                "FileProcessed",
                                "File",
                                "Item"
                            ],
                            "status": "uploaded",
                            "@id": "/files-processed/GAPFIUXS6TY7/",
                            "display_title": "GAPFIUXS6TY7.vcf.gz",
                            "workflow_run_inputs": [
                                {
                                    "@type": [
                                        "WorkflowRunAwsem",
                                        "WorkflowRun",
                                        "Item"
                                    ],
                                    "display_title": "workflow_dbSNP_ID_fixer-check v1.0.0 run 2022-04-30 05:40:37.109983",
                                    "@id": "/workflow-runs-awsem/703d75f8-4fdf-4cb4-a65b-6181e1079660/",
                                    "status": "shared",
                                    "uuid": "703d75f8-4fdf-4cb4-a65b-6181e1079660",
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
                                    "display_title": "workflow_granite-qcVCF v1.0.0 run 2022-04-30 05:40:39.370350",
                                    "@id": "/workflow-runs-awsem/dd927729-294a-4cff-bf20-115dc9561ff7/",
                                    "status": "shared",
                                    "uuid": "dd927729-294a-4cff-bf20-115dc9561ff7",
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
                            },
                            "workflow_run_outputs": [
                                {
                                    "display_title": "workflow_granite-comHet-check v1.0.0 run 2022-04-30 05:10:39.280286",
                                    "@type": [
                                        "WorkflowRunAwsem",
                                        "WorkflowRun",
                                        "Item"
                                    ],
                                    "status": "shared",
                                    "uuid": "e71195e4-f32c-4cf7-866b-15b522b3998c",
                                    "@id": "/workflow-runs-awsem/e71195e4-f32c-4cf7-866b-15b522b3998c/",
                                    "principals_allowed": {
                                        "view": [
                                            "system.Authenticated"
                                        ],
                                        "edit": [
                                            "group.admin"
                                        ]
                                    }
                                }
                            ]
                        }
                    },
                    {
                        "value": {
                            "uuid": "aa542c8e-b31c-4cff-b2d4-aa4037bb913c",
                            "@type": [
                                "FileReference",
                                "File",
                                "Item"
                            ],
                            "status": "uploaded",
                            "@id": "/files-reference/GAPFIF4JKLTH/",
                            "display_title": "GAPFIF4JKLTH.vcf.gz",
                            "principals_allowed": {
                                "view": [
                                    "editor_for.12a92962-8265-4fc0-b2f8-cf14f05db58b",
                                    "group.admin",
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
                        "value": {
                            "uuid": "1c07a3aa-e2a3-498c-b838-15991c4a2f28",
                            "@type": [
                                "FileReference",
                                "File",
                                "Item"
                            ],
                            "status": "uploaded",
                            "@id": "/files-reference/GAPFIBGEOI72/",
                            "display_title": "GAPFIBGEOI72.txt",
                            "principals_allowed": {
                                "view": [
                                    "editor_for.12a92962-8265-4fc0-b2f8-cf14f05db58b",
                                    "group.admin",
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
                "display_title": "workflow_granite-qcVCF v1.0.0 run 2022-04-30 05:40:39.370350",
                "status": "shared",
                "@type": [
                    "WorkflowRunAwsem",
                    "WorkflowRun",
                    "Item"
                ],
                "uuid": "dd927729-294a-4cff-bf20-115dc9561ff7",
                "@id": "/workflow-runs-awsem/dd927729-294a-4cff-bf20-115dc9561ff7/",
                "output_files": [
                    {},
                    {}
                ],
                "input_files": [
                    {
                        "value": {
                            "uuid": "2bdf5b97-b382-4c11-a70a-b6a5210bf319",
                            "@type": [
                                "FileProcessed",
                                "File",
                                "Item"
                            ],
                            "status": "uploaded",
                            "@id": "/files-processed/GAPFIUXS6TY7/",
                            "display_title": "GAPFIUXS6TY7.vcf.gz",
                            "workflow_run_inputs": [
                                {
                                    "@type": [
                                        "WorkflowRunAwsem",
                                        "WorkflowRun",
                                        "Item"
                                    ],
                                    "display_title": "workflow_dbSNP_ID_fixer-check v1.0.0 run 2022-04-30 05:40:37.109983",
                                    "@id": "/workflow-runs-awsem/703d75f8-4fdf-4cb4-a65b-6181e1079660/",
                                    "status": "shared",
                                    "uuid": "703d75f8-4fdf-4cb4-a65b-6181e1079660",
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
                                    "display_title": "workflow_granite-qcVCF v1.0.0 run 2022-04-30 05:40:39.370350",
                                    "@id": "/workflow-runs-awsem/dd927729-294a-4cff-bf20-115dc9561ff7/",
                                    "status": "shared",
                                    "uuid": "dd927729-294a-4cff-bf20-115dc9561ff7",
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
                            },
                            "workflow_run_outputs": [
                                {
                                    "display_title": "workflow_granite-comHet-check v1.0.0 run 2022-04-30 05:10:39.280286",
                                    "@type": [
                                        "WorkflowRunAwsem",
                                        "WorkflowRun",
                                        "Item"
                                    ],
                                    "status": "shared",
                                    "uuid": "e71195e4-f32c-4cf7-866b-15b522b3998c",
                                    "@id": "/workflow-runs-awsem/e71195e4-f32c-4cf7-866b-15b522b3998c/",
                                    "principals_allowed": {
                                        "view": [
                                            "system.Authenticated"
                                        ],
                                        "edit": [
                                            "group.admin"
                                        ]
                                    }
                                }
                            ]
                        }
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
                "display_title": "workflow_granite-qcVCF v1.0.0 run 2022-04-30 06:10:34.657719",
                "status": "shared",
                "@type": [
                    "WorkflowRunAwsem",
                    "WorkflowRun",
                    "Item"
                ],
                "uuid": "da4c3ef1-7cee-42cf-a6d1-ea60dbd60169",
                "@id": "/workflow-runs-awsem/da4c3ef1-7cee-42cf-a6d1-ea60dbd60169/",
                "output_files": [
                    {},
                    {}
                ],
                "input_files": [
                    {
                        "value": {
                            "uuid": "352d3ace-c687-41de-9027-db84bf8af10a",
                            "@type": [
                                "FileProcessed",
                                "File",
                                "Item"
                            ],
                            "status": "uploaded",
                            "@id": "/files-processed/GAPFI7UFWBGA/",
                            "display_title": "GAPFI7UFWBGA.vcf.gz",
                            "workflow_run_inputs": [
                                {
                                    "@type": [
                                        "WorkflowRunAwsem",
                                        "WorkflowRun",
                                        "Item"
                                    ],
                                    "display_title": "workflow_granite-qcVCF v1.0.0 run 2022-04-30 06:10:34.657719",
                                    "@id": "/workflow-runs-awsem/da4c3ef1-7cee-42cf-a6d1-ea60dbd60169/",
                                    "status": "shared",
                                    "uuid": "da4c3ef1-7cee-42cf-a6d1-ea60dbd60169",
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
                                    "display_title": "workflow_hg19lo_hgvsg-check v1.0.0 run 2022-04-30 06:10:40.434728",
                                    "@id": "/workflow-runs-awsem/5df3ef23-0e93-4510-8ebb-63ebcc1214a7/",
                                    "status": "shared",
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
                            "principals_allowed": {
                                "view": [
                                    "editor_for.12a92962-8265-4fc0-b2f8-cf14f05db58b",
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
                            "workflow_run_outputs": [
                                {
                                    "display_title": "workflow_dbSNP_ID_fixer-check v1.0.0 run 2022-04-30 05:40:37.109983",
                                    "@type": [
                                        "WorkflowRunAwsem",
                                        "WorkflowRun",
                                        "Item"
                                    ],
                                    "status": "shared",
                                    "uuid": "703d75f8-4fdf-4cb4-a65b-6181e1079660",
                                    "@id": "/workflow-runs-awsem/703d75f8-4fdf-4cb4-a65b-6181e1079660/",
                                    "principals_allowed": {
                                        "view": [
                                            "system.Authenticated"
                                        ],
                                        "edit": [
                                            "group.admin"
                                        ]
                                    }
                                }
                            ]
                        }
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
                        "uuid": "77ae0d41-f922-4646-bee2-029deaefdf49",
                        "status": "uploaded",
                        "@id": "/files-processed/GAPFIRGHPIDQ/",
                        "display_title": "GAPFIRGHPIDQ.vcf.gz",
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
                "display_title": "workflow_hg19lo_hgvsg-check v1.0.0 run 2022-04-30 06:10:40.434728",
                "status": "shared",
                "@type": [
                    "WorkflowRunAwsem",
                    "WorkflowRun",
                    "Item"
                ],
                "uuid": "5df3ef23-0e93-4510-8ebb-63ebcc1214a7",
                "@id": "/workflow-runs-awsem/5df3ef23-0e93-4510-8ebb-63ebcc1214a7/",
                "output_files": [
                    {
                        "value": {
                            "uuid": "77ae0d41-f922-4646-bee2-029deaefdf49",
                            "status": "uploaded",
                            "@type": [
                                "FileProcessed",
                                "File",
                                "Item"
                            ],
                            "display_title": "GAPFIRGHPIDQ.vcf.gz",
                            "@id": "/files-processed/GAPFIRGHPIDQ/",
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
                            "principals_allowed": {
                                "view": [
                                    "editor_for.12a92962-8265-4fc0-b2f8-cf14f05db58b",
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
                            "workflow_run_inputs": [
                                {
                                    "display_title": "workflow_granite-qcVCF v1.0.0 run 2022-04-30 06:40:35.011633",
                                    "@id": "/workflow-runs-awsem/b847a5ad-670e-4b3c-92be-a1d3e9951b99/",
                                    "status": "shared",
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
                                    }
                                },
                                {
                                    "display_title": "bamsnap v1.0.0 run 2022-04-30 06:40:40.145843",
                                    "@id": "/workflow-runs-awsem/106be8c3-5b02-4809-8205-4b7dae0fc375/",
                                    "status": "shared",
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
                                    }
                                }
                            ]
                        }
                    },
                    {}
                ],
                "input_files": [
                    {
                        "value": {
                            "uuid": "352d3ace-c687-41de-9027-db84bf8af10a",
                            "@type": [
                                "FileProcessed",
                                "File",
                                "Item"
                            ],
                            "status": "uploaded",
                            "@id": "/files-processed/GAPFI7UFWBGA/",
                            "display_title": "GAPFI7UFWBGA.vcf.gz",
                            "workflow_run_inputs": [
                                {
                                    "@type": [
                                        "WorkflowRunAwsem",
                                        "WorkflowRun",
                                        "Item"
                                    ],
                                    "display_title": "workflow_granite-qcVCF v1.0.0 run 2022-04-30 06:10:34.657719",
                                    "@id": "/workflow-runs-awsem/da4c3ef1-7cee-42cf-a6d1-ea60dbd60169/",
                                    "status": "shared",
                                    "uuid": "da4c3ef1-7cee-42cf-a6d1-ea60dbd60169",
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
                                    "display_title": "workflow_hg19lo_hgvsg-check v1.0.0 run 2022-04-30 06:10:40.434728",
                                    "@id": "/workflow-runs-awsem/5df3ef23-0e93-4510-8ebb-63ebcc1214a7/",
                                    "status": "shared",
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
                            "principals_allowed": {
                                "view": [
                                    "editor_for.12a92962-8265-4fc0-b2f8-cf14f05db58b",
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
                            "workflow_run_outputs": [
                                {
                                    "display_title": "workflow_dbSNP_ID_fixer-check v1.0.0 run 2022-04-30 05:40:37.109983",
                                    "@type": [
                                        "WorkflowRunAwsem",
                                        "WorkflowRun",
                                        "Item"
                                    ],
                                    "status": "shared",
                                    "uuid": "703d75f8-4fdf-4cb4-a65b-6181e1079660",
                                    "@id": "/workflow-runs-awsem/703d75f8-4fdf-4cb4-a65b-6181e1079660/",
                                    "principals_allowed": {
                                        "view": [
                                            "system.Authenticated"
                                        ],
                                        "edit": [
                                            "group.admin"
                                        ]
                                    }
                                }
                            ]
                        }
                    },
                    {
                        "value": {
                            "uuid": "297c872a-5b6b-4fc3-83d3-f4a853f8805c",
                            "@type": [
                                "FileReference",
                                "File",
                                "Item"
                            ],
                            "status": "uploaded",
                            "@id": "/files-reference/GAPFIYPTSAU8/",
                            "display_title": "GAPFIYPTSAU8.chain.gz",
                            "principals_allowed": {
                                "view": [
                                    "editor_for.12a92962-8265-4fc0-b2f8-cf14f05db58b",
                                    "group.admin",
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
                "display_title": "workflow_granite-qcVCF v1.0.0 run 2022-04-30 06:40:35.011633",
                "status": "shared",
                "@type": [
                    "WorkflowRunAwsem",
                    "WorkflowRun",
                    "Item"
                ],
                "uuid": "b847a5ad-670e-4b3c-92be-a1d3e9951b99",
                "@id": "/workflow-runs-awsem/b847a5ad-670e-4b3c-92be-a1d3e9951b99/",
                "output_files": [
                    {},
                    {}
                ],
                "input_files": [
                    {
                        "value": {
                            "uuid": "77ae0d41-f922-4646-bee2-029deaefdf49",
                            "@type": [
                                "FileProcessed",
                                "File",
                                "Item"
                            ],
                            "status": "uploaded",
                            "@id": "/files-processed/GAPFIRGHPIDQ/",
                            "display_title": "GAPFIRGHPIDQ.vcf.gz",
                            "workflow_run_inputs": [
                                {
                                    "@type": [
                                        "WorkflowRunAwsem",
                                        "WorkflowRun",
                                        "Item"
                                    ],
                                    "display_title": "workflow_granite-qcVCF v1.0.0 run 2022-04-30 06:40:35.011633",
                                    "@id": "/workflow-runs-awsem/b847a5ad-670e-4b3c-92be-a1d3e9951b99/",
                                    "status": "shared",
                                    "uuid": "b847a5ad-670e-4b3c-92be-a1d3e9951b99",
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
                                    "display_title": "bamsnap v1.0.0 run 2022-04-30 06:40:40.145843",
                                    "@id": "/workflow-runs-awsem/106be8c3-5b02-4809-8205-4b7dae0fc375/",
                                    "status": "shared",
                                    "uuid": "106be8c3-5b02-4809-8205-4b7dae0fc375",
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
                            },
                            "workflow_run_outputs": [
                                {
                                    "display_title": "workflow_hg19lo_hgvsg-check v1.0.0 run 2022-04-30 06:10:40.434728",
                                    "@type": [
                                        "WorkflowRunAwsem",
                                        "WorkflowRun",
                                        "Item"
                                    ],
                                    "status": "shared",
                                    "uuid": "5df3ef23-0e93-4510-8ebb-63ebcc1214a7",
                                    "@id": "/workflow-runs-awsem/5df3ef23-0e93-4510-8ebb-63ebcc1214a7/",
                                    "principals_allowed": {
                                        "view": [
                                            "system.Authenticated"
                                        ],
                                        "edit": [
                                            "group.admin"
                                        ]
                                    }
                                }
                            ]
                        }
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
                "display_title": "bamsnap v1.0.0 run 2022-04-30 06:40:40.145843",
                "status": "shared",
                "@type": [
                    "WorkflowRunAwsem",
                    "WorkflowRun",
                    "Item"
                ],
                "uuid": "106be8c3-5b02-4809-8205-4b7dae0fc375",
                "@id": "/workflow-runs-awsem/106be8c3-5b02-4809-8205-4b7dae0fc375/",
                "output_files": [
                    {}
                ],
                "input_files": [
                    {
                        "value": {
                            "uuid": "676dd0c1-82c4-41be-9ae7-619ce47e158e",
                            "@type": [
                                "FileProcessed",
                                "File",
                                "Item"
                            ],
                            "status": "uploaded",
                            "@id": "/files-processed/GAPFIMIARUOB/",
                            "display_title": "GAPFIMIARUOB.bam",
                            "workflow_run_inputs": [
                                {
                                    "@type": [
                                        "WorkflowRunAwsem",
                                        "WorkflowRun",
                                        "Item"
                                    ],
                                    "display_title": "workflow_granite-mpileupCounts v1.0.0 run 2022-04-29 17:10:35.675189",
                                    "@id": "/workflow-runs-awsem/d9b35c06-6911-4b67-ac04-395331a98e55/",
                                    "status": "shared",
                                    "uuid": "d9b35c06-6911-4b67-ac04-395331a98e55",
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
                                    "display_title": "workflow_gatk-HaplotypeCaller v1.0.0 run 2022-04-29 17:10:52.092723",
                                    "@id": "/workflow-runs-awsem/d2063a22-99c7-420e-b179-6daedad12499/",
                                    "status": "shared",
                                    "uuid": "d2063a22-99c7-420e-b179-6daedad12499",
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
                                    "display_title": "cgap-bamqc v1.0.0 run 2022-04-29 09:10:34.237529",
                                    "@id": "/workflow-runs-awsem/332fdc52-268c-41ad-a408-a0def871afe9/",
                                    "status": "shared",
                                    "uuid": "332fdc52-268c-41ad-a408-a0def871afe9",
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
                                    "display_title": "bamsnap v1.0.0 run 2022-04-30 06:40:40.145843",
                                    "@id": "/workflow-runs-awsem/106be8c3-5b02-4809-8205-4b7dae0fc375/",
                                    "status": "shared",
                                    "uuid": "106be8c3-5b02-4809-8205-4b7dae0fc375",
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
                                    "display_title": "workflow_manta_vcf-check v1.0.0 run 2022-05-03 13:27:54.696531",
                                    "@id": "/workflow-runs-awsem/a535c8dd-bb2d-4ef3-9f39-c09ed7679043/",
                                    "status": "shared",
                                    "uuid": "a535c8dd-bb2d-4ef3-9f39-c09ed7679043",
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
                                    "display_title": "workflow_manta_vcf-check v1.0.0 run 2022-06-14 15:25:38.395763",
                                    "@id": "/workflow-runs-awsem/faddea10-4887-41ae-906c-f3709be988d6/",
                                    "status": "shared",
                                    "uuid": "faddea10-4887-41ae-906c-f3709be988d6",
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
                                    "display_title": "workflow_manta_vcf-check v1.0.0 run 2022-06-14 20:40:38.996289",
                                    "@id": "/workflow-runs-awsem/1b859a33-6e53-41ca-92fc-ab391a832fdf/",
                                    "status": "shared",
                                    "uuid": "1b859a33-6e53-41ca-92fc-ab391a832fdf",
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
                                    "display_title": "workflow_manta_vcf-check v1.0.0 run 2022-06-28 14:40:37.869039",
                                    "@id": "/workflow-runs-awsem/72b695ed-074c-4d4f-b338-17f4ebd93167/",
                                    "status": "shared",
                                    "uuid": "72b695ed-074c-4d4f-b338-17f4ebd93167",
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
                                    "display_title": "workflow_manta_vcf-check v1.0.0 run 2022-06-30 21:25:38.318616",
                                    "@id": "/workflow-runs-awsem/4ba17f94-6a12-4890-b9e2-db7c2b9a4506/",
                                    "status": "shared",
                                    "uuid": "4ba17f94-6a12-4890-b9e2-db7c2b9a4506",
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
                                    "display_title": "workflow_manta_vcf-check v1.0.0 run 2022-06-30 19:10:43.701945",
                                    "@id": "/workflow-runs-awsem/b0f2cd76-015b-4449-ba5e-f92194729143/",
                                    "status": "shared",
                                    "uuid": "b0f2cd76-015b-4449-ba5e-f92194729143",
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
                                    "display_title": "workflow_manta_vcf-check v1.0.0 run 2022-07-05 18:40:37.676855",
                                    "@id": "/workflow-runs-awsem/68209cd5-987b-47e0-a719-682a2700d340/",
                                    "status": "shared",
                                    "uuid": "68209cd5-987b-47e0-a719-682a2700d340",
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
                            },
                            "workflow_run_outputs": [
                                {
                                    "display_title": "workflow_sentieon_dedup-recal v1.0.0 run 2022-04-29 04:25:35.950498",
                                    "@type": [
                                        "WorkflowRunAwsem",
                                        "WorkflowRun",
                                        "Item"
                                    ],
                                    "status": "shared",
                                    "uuid": "784f3f5f-d3cf-432b-8c0f-3dcd957b2042",
                                    "@id": "/workflow-runs-awsem/784f3f5f-d3cf-432b-8c0f-3dcd957b2042/",
                                    "principals_allowed": {
                                        "view": [
                                            "system.Authenticated"
                                        ],
                                        "edit": [
                                            "group.admin"
                                        ]
                                    }
                                }
                            ]
                        }
                    },
                    {
                        "value": {
                            "uuid": "6d199319-3719-4a42-8883-365072bc13b3",
                            "@type": [
                                "FileProcessed",
                                "File",
                                "Item"
                            ],
                            "status": "uploaded",
                            "@id": "/files-processed/GAPFICEE9LEN/",
                            "display_title": "GAPFICEE9LEN.bam",
                            "workflow_run_inputs": [
                                {
                                    "@type": [
                                        "WorkflowRunAwsem",
                                        "WorkflowRun",
                                        "Item"
                                    ],
                                    "display_title": "cgap-bamqc v1.0.0 run 2022-04-29 09:10:37.940754",
                                    "@id": "/workflow-runs-awsem/a3c19fdd-436c-40bd-a3e6-9cc5e93c0da5/",
                                    "status": "shared",
                                    "uuid": "a3c19fdd-436c-40bd-a3e6-9cc5e93c0da5",
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
                                    "display_title": "workflow_granite-mpileupCounts v1.0.0 run 2022-04-29 17:10:38.581075",
                                    "@id": "/workflow-runs-awsem/8bca34d8-54c4-4de8-9057-ffb868d44795/",
                                    "status": "shared",
                                    "uuid": "8bca34d8-54c4-4de8-9057-ffb868d44795",
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
                                    "display_title": "workflow_gatk-HaplotypeCaller v1.0.0 run 2022-04-29 17:10:58.741225",
                                    "@id": "/workflow-runs-awsem/a59335b9-d462-4578-b718-0fc54428cc77/",
                                    "status": "shared",
                                    "uuid": "a59335b9-d462-4578-b718-0fc54428cc77",
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
                                    "display_title": "bamsnap v1.0.0 run 2022-04-30 06:40:40.145843",
                                    "@id": "/workflow-runs-awsem/106be8c3-5b02-4809-8205-4b7dae0fc375/",
                                    "status": "shared",
                                    "uuid": "106be8c3-5b02-4809-8205-4b7dae0fc375",
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
                                    "display_title": "workflow_manta_vcf-check v1.0.0 run 2022-05-03 13:27:54.696531",
                                    "@id": "/workflow-runs-awsem/a535c8dd-bb2d-4ef3-9f39-c09ed7679043/",
                                    "status": "shared",
                                    "uuid": "a535c8dd-bb2d-4ef3-9f39-c09ed7679043",
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
                                    "display_title": "workflow_manta_vcf-check v1.0.0 run 2022-06-14 15:25:38.395763",
                                    "@id": "/workflow-runs-awsem/faddea10-4887-41ae-906c-f3709be988d6/",
                                    "status": "shared",
                                    "uuid": "faddea10-4887-41ae-906c-f3709be988d6",
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
                                    "display_title": "workflow_manta_vcf-check v1.0.0 run 2022-06-14 20:40:38.996289",
                                    "@id": "/workflow-runs-awsem/1b859a33-6e53-41ca-92fc-ab391a832fdf/",
                                    "status": "shared",
                                    "uuid": "1b859a33-6e53-41ca-92fc-ab391a832fdf",
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
                                    "display_title": "workflow_manta_vcf-check v1.0.0 run 2022-06-28 14:40:37.869039",
                                    "@id": "/workflow-runs-awsem/72b695ed-074c-4d4f-b338-17f4ebd93167/",
                                    "status": "shared",
                                    "uuid": "72b695ed-074c-4d4f-b338-17f4ebd93167",
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
                                    "display_title": "workflow_manta_vcf-check v1.0.0 run 2022-06-30 21:25:38.318616",
                                    "@id": "/workflow-runs-awsem/4ba17f94-6a12-4890-b9e2-db7c2b9a4506/",
                                    "status": "shared",
                                    "uuid": "4ba17f94-6a12-4890-b9e2-db7c2b9a4506",
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
                                    "display_title": "workflow_manta_vcf-check v1.0.0 run 2022-06-30 19:10:43.701945",
                                    "@id": "/workflow-runs-awsem/b0f2cd76-015b-4449-ba5e-f92194729143/",
                                    "status": "shared",
                                    "uuid": "b0f2cd76-015b-4449-ba5e-f92194729143",
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
                                    "display_title": "workflow_manta_vcf-check v1.0.0 run 2022-07-05 18:40:37.676855",
                                    "@id": "/workflow-runs-awsem/68209cd5-987b-47e0-a719-682a2700d340/",
                                    "status": "shared",
                                    "uuid": "68209cd5-987b-47e0-a719-682a2700d340",
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
                            },
                            "workflow_run_outputs": [
                                {
                                    "display_title": "workflow_sentieon_dedup-recal v1.0.0 run 2022-04-29 04:25:39.481922",
                                    "@type": [
                                        "WorkflowRunAwsem",
                                        "WorkflowRun",
                                        "Item"
                                    ],
                                    "status": "shared",
                                    "uuid": "25d04009-a2fe-481b-ada7-da5c1216d52e",
                                    "@id": "/workflow-runs-awsem/25d04009-a2fe-481b-ada7-da5c1216d52e/",
                                    "principals_allowed": {
                                        "view": [
                                            "system.Authenticated"
                                        ],
                                        "edit": [
                                            "group.admin"
                                        ]
                                    }
                                }
                            ]
                        }
                    },
                    {
                        "value": {
                            "uuid": "222ce0eb-22f8-40e3-87d5-f2708ad18393",
                            "@type": [
                                "FileProcessed",
                                "File",
                                "Item"
                            ],
                            "status": "uploaded",
                            "@id": "/files-processed/GAPFITNHTOZI/",
                            "display_title": "GAPFITNHTOZI.bam",
                            "workflow_run_inputs": [
                                {
                                    "@type": [
                                        "WorkflowRunAwsem",
                                        "WorkflowRun",
                                        "Item"
                                    ],
                                    "display_title": "workflow_granite-mpileupCounts v1.0.0 run 2022-04-29 17:10:45.405166",
                                    "@id": "/workflow-runs-awsem/e93fc945-f186-41e0-a0c3-b19a007ce81c/",
                                    "status": "shared",
                                    "uuid": "e93fc945-f186-41e0-a0c3-b19a007ce81c",
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
                                    "display_title": "cgap-bamqc v1.0.0 run 2022-04-29 09:25:33.654107",
                                    "@id": "/workflow-runs-awsem/c2a9ad6c-2bc9-489a-a7bd-6358b8ede373/",
                                    "status": "shared",
                                    "uuid": "c2a9ad6c-2bc9-489a-a7bd-6358b8ede373",
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
                                    "display_title": "workflow_gatk-HaplotypeCaller v1.0.0 run 2022-04-29 17:11:05.391428",
                                    "@id": "/workflow-runs-awsem/3f8e7c4e-254b-4981-81c8-d54821b0676c/",
                                    "status": "shared",
                                    "uuid": "3f8e7c4e-254b-4981-81c8-d54821b0676c",
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
                                    "display_title": "bamsnap v1.0.0 run 2022-04-30 06:40:40.145843",
                                    "@id": "/workflow-runs-awsem/106be8c3-5b02-4809-8205-4b7dae0fc375/",
                                    "status": "shared",
                                    "uuid": "106be8c3-5b02-4809-8205-4b7dae0fc375",
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
                                    "display_title": "workflow_manta_vcf-check v1.0.0 run 2022-05-03 13:27:54.696531",
                                    "@id": "/workflow-runs-awsem/a535c8dd-bb2d-4ef3-9f39-c09ed7679043/",
                                    "status": "shared",
                                    "uuid": "a535c8dd-bb2d-4ef3-9f39-c09ed7679043",
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
                                    "display_title": "workflow_manta_vcf-check v1.0.0 run 2022-06-14 15:25:38.395763",
                                    "@id": "/workflow-runs-awsem/faddea10-4887-41ae-906c-f3709be988d6/",
                                    "status": "shared",
                                    "uuid": "faddea10-4887-41ae-906c-f3709be988d6",
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
                                    "display_title": "workflow_manta_vcf-check v1.0.0 run 2022-06-14 20:40:38.996289",
                                    "@id": "/workflow-runs-awsem/1b859a33-6e53-41ca-92fc-ab391a832fdf/",
                                    "status": "shared",
                                    "uuid": "1b859a33-6e53-41ca-92fc-ab391a832fdf",
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
                                    "display_title": "workflow_manta_vcf-check v1.0.0 run 2022-06-28 14:40:37.869039",
                                    "@id": "/workflow-runs-awsem/72b695ed-074c-4d4f-b338-17f4ebd93167/",
                                    "status": "shared",
                                    "uuid": "72b695ed-074c-4d4f-b338-17f4ebd93167",
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
                                    "display_title": "workflow_manta_vcf-check v1.0.0 run 2022-06-30 21:25:38.318616",
                                    "@id": "/workflow-runs-awsem/4ba17f94-6a12-4890-b9e2-db7c2b9a4506/",
                                    "status": "shared",
                                    "uuid": "4ba17f94-6a12-4890-b9e2-db7c2b9a4506",
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
                                    "display_title": "workflow_manta_vcf-check v1.0.0 run 2022-06-30 19:10:43.701945",
                                    "@id": "/workflow-runs-awsem/b0f2cd76-015b-4449-ba5e-f92194729143/",
                                    "status": "shared",
                                    "uuid": "b0f2cd76-015b-4449-ba5e-f92194729143",
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
                                    "display_title": "workflow_manta_vcf-check v1.0.0 run 2022-07-05 18:40:37.676855",
                                    "@id": "/workflow-runs-awsem/68209cd5-987b-47e0-a719-682a2700d340/",
                                    "status": "shared",
                                    "uuid": "68209cd5-987b-47e0-a719-682a2700d340",
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
                            },
                            "workflow_run_outputs": [
                                {
                                    "display_title": "workflow_sentieon_dedup-recal v1.0.0 run 2022-04-29 04:25:46.368031",
                                    "@type": [
                                        "WorkflowRunAwsem",
                                        "WorkflowRun",
                                        "Item"
                                    ],
                                    "status": "shared",
                                    "uuid": "d4b58584-ecc6-41ad-a0ce-81d4b600b033",
                                    "@id": "/workflow-runs-awsem/d4b58584-ecc6-41ad-a0ce-81d4b600b033/",
                                    "principals_allowed": {
                                        "view": [
                                            "system.Authenticated"
                                        ],
                                        "edit": [
                                            "group.admin"
                                        ]
                                    }
                                }
                            ]
                        }
                    },
                    {
                        "value": {
                            "uuid": "77ae0d41-f922-4646-bee2-029deaefdf49",
                            "@type": [
                                "FileProcessed",
                                "File",
                                "Item"
                            ],
                            "status": "uploaded",
                            "@id": "/files-processed/GAPFIRGHPIDQ/",
                            "display_title": "GAPFIRGHPIDQ.vcf.gz",
                            "workflow_run_inputs": [
                                {
                                    "@type": [
                                        "WorkflowRunAwsem",
                                        "WorkflowRun",
                                        "Item"
                                    ],
                                    "display_title": "workflow_granite-qcVCF v1.0.0 run 2022-04-30 06:40:35.011633",
                                    "@id": "/workflow-runs-awsem/b847a5ad-670e-4b3c-92be-a1d3e9951b99/",
                                    "status": "shared",
                                    "uuid": "b847a5ad-670e-4b3c-92be-a1d3e9951b99",
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
                                    "display_title": "bamsnap v1.0.0 run 2022-04-30 06:40:40.145843",
                                    "@id": "/workflow-runs-awsem/106be8c3-5b02-4809-8205-4b7dae0fc375/",
                                    "status": "shared",
                                    "uuid": "106be8c3-5b02-4809-8205-4b7dae0fc375",
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
                            },
                            "workflow_run_outputs": [
                                {
                                    "display_title": "workflow_hg19lo_hgvsg-check v1.0.0 run 2022-04-30 06:10:40.434728",
                                    "@type": [
                                        "WorkflowRunAwsem",
                                        "WorkflowRun",
                                        "Item"
                                    ],
                                    "status": "shared",
                                    "uuid": "5df3ef23-0e93-4510-8ebb-63ebcc1214a7",
                                    "@id": "/workflow-runs-awsem/5df3ef23-0e93-4510-8ebb-63ebcc1214a7/",
                                    "principals_allowed": {
                                        "view": [
                                            "system.Authenticated"
                                        ],
                                        "edit": [
                                            "group.admin"
                                        ]
                                    }
                                }
                            ]
                        }
                    },
                    {
                        "value": {
                            "uuid": "1936f246-22e1-45dc-bb5c-9cfd55537fe7",
                            "@type": [
                                "FileReference",
                                "File",
                                "Item"
                            ],
                            "status": "uploaded",
                            "@id": "/files-reference/GAPFIXRDPDK5/",
                            "display_title": "GAPFIXRDPDK5.fa",
                            "principals_allowed": {
                                "view": [
                                    "editor_for.12a92962-8265-4fc0-b2f8-cf14f05db58b",
                                    "group.admin",
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
                source: mwfrSourceStepName,
                source_argument_name,
                // files = [],
                value: nonFileValue
            } = wfrObjectInputObject;

            // Each file contains "workflow_run_outputs" (WFR it came from) + "workflow_run_inputs" (WFR it going to) (if applicable)
            const filesForThisInput = inputFileObjectsGroupedByArgName[argument_name] || [];
            const filesLen = filesForThisInput.length;

            const initialSource = {
                "name": source_argument_name || argument_name
            };

            // if (wfrSourceStepName) {
            //     // TODO Make it workflow_run @id....
            //     initialSource.step = wfrSourceStepName;
            //     // Maybe include later if needed:
            //     // initialSource.workflow = workflowAtID;
            // }

            const initialSourceList = [];

            if (filesLen > 0) {
                filesForThisInput.forEach(function(fileObject){
                    const { value: fileItem } = fileObject;
                    const { "@id": fileAtID, workflow_run_output } = fileItem || {};
                    const { "@id": outputOfWFRAtID } = workflow_run_output || {};
                    const sourceObject = { ...initialSource, "for_file": fileAtID };
                    if (outputOfWFRAtID) {
                        sourceObject.step = outputOfWFRAtID;
                    }
                    initialSourceList.push(sourceObject);
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
                    // TODO: Reconsider this evaluation of "global"
                    "global": !mwfrSourceStepName,
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
            } else if (typeof nonFileValue !== "undefined") {
                stepInputObject.run_data.value = [ nonFileValue ];
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
                value: nonFileValue
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

            // TODO handle 'nonFileValue' if needed.

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

