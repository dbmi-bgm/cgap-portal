'use strict';

import React from 'react';
import _ from 'underscore';
import ReactTooltip from 'react-tooltip';
import { object, ajax } from '@hms-dbmi-bgm/shared-portal-components/es/components/util';
import { ClinicianNotes } from './ClinicianNotes';
import { FileWrapper } from './Files';


export function getIndividualDisplayTitle(individual){
    const { name, id, data : { individualItem = null } } = individual;
    const { display_title } = individualItem || {};
    return display_title || name || id;
}

/**
 * At some point, will likely make into class component
 * and add methods to save/load things such as clinician notes.
 */
export class IndividualBody extends React.PureComponent {

    constructor(props){
        super(props);
        this.loadIndividual = this.loadIndividual.bind(this);
        this.state = {
            loadedIndividual: null,
            isLoadingIndividual: false,
            timestamp: 0
        };
        this.currRequest = null;
    }

    componentDidMount(){
        this.loadIndividual();
    }

    componentWillUnmount(){
        this.currRequest && this.currRequest.abort && this.currRequest.abort();
    }

    componentDidUpdate(pastProps){
        const { selectedNode, session } = this.props;
        if (pastProps.selectedNode !== selectedNode || session !== pastProps.session){
            this.loadIndividual({ loadedIndividual: null });
        }
    }

    loadIndividual(extraStateChange){
        const { selectedNode = {} } = this.props;
        const { data : { individualItem = null } } = selectedNode;
        const { '@id' : id } = individualItem || {};
        if (!id) {
            console.error("Couldnt get ID of individual");
            return;
        }
        let ourRequest = null;
        const timestamp = parseInt(Date.now());
        const cb = (res, xhr) => {
            if (xhr.status === 0 || ourRequest !== this.currRequest){
                return; // Aborted, skip state change.
            }
            this.currRequest = null;
            if (!res || res['@id'] !== id){
                // Error, maybe no permissions
                this.setState({ loadedIndividual : null, isLoadingIndividual: false });
                return;
            }
            this.setState({
                loadedIndividual : res,
                isLoadingIndividual: false,
                timestamp
            });
        };

        this.setState({ ...extraStateChange, isLoadingIndividual : true }, ()=>{
            this.currRequest && this.currRequest.abort && this.currRequest.abort();
            ourRequest = this.currRequest = ajax.load(id + "?ts=" + timestamp, cb, 'GET', cb);
        });
    }

    render(){
        const {
            selectedNode: individual,
            onNodeClick,
            onClose,
            diseaseToIndex,
            session,
            href,
            schemas
        } = this.props;
        const {
            isLoadingIndividual,
            loadedIndividual: loadedIndividualItem,
            timestamp
        } = this.state;
        const {
            id, name,
            data: { individualItem = {} } = {},
            _parentReferences: parents = [],
            _childReferences: children = []
        } = individual;

        // This should be same as "id" but we grab from here to be sure isn't dummy data.
        const {
            '@id' : individualID,
            ancestry,
            phenotypic_features = [],
            disorders = [],
            actions = []
        } = loadedIndividualItem || individualItem;

        const haveEditPermission = session && individualID && _.any(actions, { "name" : "edit" });

        let showTitle = getIndividualDisplayTitle(individual);
        if (individualID) {
            showTitle = <a href={individualID} className="link-underline-hover">{ showTitle }</a>;
        }

        let editLink;
        if (haveEditPermission){
            editLink = individualID + "?currentAction=edit";
            if (href){
                editLink += "&callbackHref=" + encodeURIComponent(href);
            }
        }

        console.log("INDV", loadedIndividualItem, individualItem);

        return (
            <div className="detail-pane-inner">

                <div className="title-box">
                    <div className="label-row row">
                        <div className="col">
                            <label>Individual</label>
                        </div>
                        <div className="col-auto buttons-col">
                            { editLink ?
                                <a href={editLink} className="d-block edit-btn">
                                    <i className="icon icon-pencil-alt fas clickable" />
                                </a>
                                : isLoadingIndividual ?
                                    <i className="icon icon-circle-notch icon-spin fas d-block me-15" />
                                    : null }
                            { onClose ? <i className="icon icon-times fas clickable d-block" onClick={onClose}/> : null }
                        </div>
                    </div>
                    <h3>{ showTitle }</h3>
                </div>

                <div className="details">
                    { ancestry ?
                        <InlineDetailRow label="Ancestry" value={ancestry.join(" • ")} />
                        : null }
                    <Disorders {...{ disorders }} diseaseToIndex={diseaseToIndex} />
                    <PhenotypicFeatures features={phenotypic_features} diseaseToIndex={diseaseToIndex} />
                    <ClinicianNotes individual={loadedIndividualItem || individualItem} haveEditPermission={haveEditPermission} />
                    <FileWrapper individual={loadedIndividualItem || individualItem } {...{ haveEditPermission, schemas }} />
                    {/*
                    <div className="detail-row row" data-describing="parents">
                        <div className="col-12">
                            <label>Parents</label>
                            { !parents.length ? <div><em>None</em></div>
                                : <PartnersLinks onNodeClick={onNodeClick} partners={parents}/>
                            }
                        </div>
                    </div>
                    <div className="detail-row" data-describing="children">
                        <label>Children</label>
                        { !children.length ? <div><em>None</em></div>
                            : <PartnersLinks onNodeClick={onNodeClick} partners={children}/>
                        }
                    </div>
                    */}
                </div>
            </div>
        );
    }
}

function InlineDetailRow({ property, label, value }){
    return (
        <div className="detail-row row" data-describing={property || label}>
            <div className="col-6">
                <label className="mb-0">{ label || property }</label>
            </div>
            <div className="col-6">
                <span className="value">{ value }</span>
            </div>
        </div>
    );
}


function PhenotypicFeatures({ features, diseaseToIndex }){
    const renderedFeatures = features.map(function(feature, idx){
        const {
            phenotypic_feature : {
                '@id' : featureID,
                display_title: title
            },
            onset_age: onsetAge = null,
            onset_age_units: onsetAgeUnits = null
        } = feature;
        const diseaseIndex = diseaseToIndex[title] || -1;
        return (
            <DiseaseListItem key={featureID}
                {...{ onsetAge, onsetAgeUnits, featureID, title, diseaseIndex }} />
        );
    });

    return (
        <DiseaseList diseaseListItems={renderedFeatures} diseaseType="Phenotypic Features"/>
    );
}


function Disorders({ disorders, diseaseToIndex }){
    const renderedDisorders = disorders.map(function(disorder, idx){
        const {
            disorder : {
                '@id' : featureID,
                display_title: title
            },
            onset_age: onsetAge = null,
            onset_age_units: onsetAgeUnits = null
        } = disorder;
        const diseaseIndex = diseaseToIndex[title] || -1;
        return (
            <DiseaseListItem key={featureID}
                {...{ onsetAge, onsetAgeUnits, featureID, title, diseaseIndex }} />
        );
    });

    return (
        <DiseaseList diseaseListItems={renderedDisorders} diseaseType="Disorders"/>
    );
}

function DiseaseList({ diseaseListItems, diseaseType }) {
    return (
        <div className="detail-row diseases" data-describing="diseases">
            <label className="d-block">{diseaseType}</label>
            { diseaseListItems.length > 0 ? diseaseListItems
                : <em>None</em> }
        </div>
    );
}

function DiseaseListItem(props) {
    const { featureID, diseaseIndex, title, onsetAge, onsetAgeUnits } = props;

    return (
        <div className="detail-row-list-item disease" key={featureID}>
            <div className="legend-patch" data-disease-index={diseaseIndex} />
            <span className="title text-truncate text-capitalize"><a href={featureID} className="link-underline-hover">{ title }</a></span>
            { onsetAge !== null && onsetAgeUnits !== null ? (
                <span className="onset" data-tip="Age of onset">
                    <small> @ </small>
                    { "" + onsetAge + " " + onsetAgeUnits + (onsetAge > 1 ? "s" : "") }
                </span>
            ) : null }
        </div>
    );
}