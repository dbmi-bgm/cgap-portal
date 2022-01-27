"use strict";

import React, { useRef, useEffect } from "react";
import _ from "underscore";
import { ajax } from '@hms-dbmi-bgm/shared-portal-components/es/components/util';

import { HiGlassAjaxLoadContainer } from "./HiGlassAjaxLoadContainer";


export class GeneSearchBar extends React.PureComponent {
  constructor(props) {
      super(props);
      const { higlassContainer } = props;
      this.higlassContainer = higlassContainer;
      
      this.state = {
          results : [],
          currentTextValue : props.value || "",
          loading: false, // starts out by loading base RequestURL
          error: null,
          info: null,
      };

      this.currentRequest = null;
      this.onLoadData = _.debounce(this.onLoadData.bind(this), 500, false);
      this.handleResultClick = this.handleResultClick.bind(this);
  }

  componentDidUpdate(pastProps, pastState){
      
  }

  updateCurrentSearchTerm(evt) {
    const val = evt.target.value;
    this.setState({
      currentTextValue: val
    }, () => {
      this.onLoadData();
    });
    
  }

  constructFetchURL(){
    const { currentTextValue } = this.state;
    const url = "https://cgap-higlass.com/api/v1/suggest/?d=gene_annotation_hg38&ac=" + encodeURIComponent(currentTextValue);
    return url;
  }

  onLoadData(){
    this.setState({ loading: true }, () => {

      if (this.currentRequest) {
        // if there's already a request running, abort it
        this.currentRequest.abort && this.currentRequest.abort();
      }

      // Don't load anything, if there is only one letter
      if(this.state.currentTextValue.length <= 1){
        this.setState({
          currentTextValue: this.state.currentTextValue,
          loading: false,
          results: [],
          error: null,
          info: null,
        });
        return;
      }
  
      const requestInThisScope = this.currentRequest = ajax.load(this.constructFetchURL(), (response) => {
          if (requestInThisScope !== this.currentRequest) {
              return false; // some other request has been fired; cancel this one
          }
          this.currentRequest = null;
          console.log(response)
  
          if (!response) {
              this.setState({ loading: false, results: [], error: "Could not get a response from server. Check network and try again.", info: null });
              return;
          }

          if (Object.keys(response).length === 0) {
            this.setState({ loading: false, results: [], error: null, info: "We could not find any matching genes." });
            return;
          }
          if(this.state.loading){
            this.setState({ loading: false, results: response, error: null , info: null});
          }
          
      }, "GET", (response, xhr) => {
        const { results = [], error = null } = response;
        this.setState({ loading: false, results, error: error || "Something went wrong while searching for matching genes.", info: null });
    });

    });

  }

  handleResultClick(evt, geneName){
    evt.preventDefault();
    if(this.higlassContainer && this.higlassContainer.current){
      const hgc = this.higlassContainer.current.getHiGlassComponent();
      const viewconf = hgc.api.getViewConfig();
      const viewId = viewconf.views[0].uid;
      hgc.api.zoomToGene(viewId, geneName, 2000, 2000);
    }
  }

  render() {
      
      const { results = [], loading, error, info } = this.state;

      const icon = loading ? "icon icon-spinner icon-spin fas" : "icon icon-search fas";

      return (
        <div>
          
          <div className="input-group">
            <div className="input-group-prepend">
              <span className="input-group-text" id="basic-addon1"><i className={icon}/></span>
            </div>
            <input type="text" onChange={evt => this.updateCurrentSearchTerm(evt)} className="form-control" placeholder="Jump to gene" aria-label="Jump to gene" aria-describedby="basic-addon1" />
          </div>
          <GeneSearchResult results={results} error={error} info={info} handleResultClick={this.handleResultClick} />

          
        </div>
      );
  }
}


export const GeneSearchResult = React.memo(function GeneSearchResult(props){

  const { results, error, info, handleResultClick } = props;

  if(error){
    return <div><i className="icon icon-exclamation-triangle fas text-warning ml-5 mr-1"></i>{error}</div>;
  }
  else if(info){
    return <div><i className="icon icon-info-circle fas text-info ml-5 mr-1"></i>{info}</div>;
  }

  const resultsFormatted = results.map((result, i) => {
    const style = i === 0 ? "ml-5" : "";
    return <div className="mr-3"><a href="#" onClick={(evt) => handleResultClick(evt, result.geneName)} className={style} key={i}>{result.geneName}</a></div>;
  });

  return (
    <div className="d-flex flex-row bd-highlight">
      {resultsFormatted}
    </div>
  );
  
  
});


export class EmbeddedCohortBrowserUnit extends React.PureComponent {

  constructor(props) {
    super(props);

    const { cohortVcfLocation, cohortDensityBwLocation, higlassContainerCohort, higlassContainerAnnotation } = props;
    this.cohortVcfLocation = cohortVcfLocation;
    this.cohortDensityBwLocation = cohortDensityBwLocation;
    this.higlassContainerCohort = higlassContainerCohort;
    this.higlassContainerAnnotation = higlassContainerAnnotation;

    this.state = {
        activeTab: "cohort"
    };

    this.handleTabClick = this.handleTabClick.bind(this);

    
  }

  handleTabClick(evt, target){
    evt.preventDefault();
    this.setState({
      activeTab: target
    }, () => {
      if(target === "cohort"){
        const hgc = this.higlassContainerCohort.current.getHiGlassComponent();
        if(hgc){
          // Force Higlass to repaint. Without this the tracks can be positioned incorrectly
          hgc.boundRefreshView();
        }
      }else{
        const hga = this.higlassContainerAnnotation.current.getHiGlassComponent();
        const hgc = this.higlassContainerCohort.current.getHiGlassComponent();
        if(hga){
          // Force Higlass to repaint. Without this the tracks can be positioned incorrectly
          //hga.boundRefreshView();
        }
        const viewconfCohort = hgc.api.getViewConfig();
        const xDomain = viewconfCohort.views[0].initialXDomain;
        const viewconfAnnot = hga.api.getViewConfig();
        viewconfAnnot.views[0].initialXDomain = [xDomain[0] - 100000, xDomain[1] + 100000 ];
        viewconfAnnot.views[1].initialXDomain = xDomain;
        viewconfAnnot.views[1].tracks.top.forEach(track => {
          if(track.type === "horizontal-transcripts"){
            track.options["startCollapsed"] = true;
          }
        })
        // let firstViewLoc = hgc.api.getLocation(viewconfCohort.views[0].uid);
        // hga.api.zoomTo(
        //   viewconfAnnot.views[1].uid,
        //   firstViewLoc["xDomain"][0],
        //   firstViewLoc["xDomain"][1],
        //   firstViewLoc["yDomain"][0],
        //   firstViewLoc["yDomain"][1]
        // );
        hga.api.setViewConfig(viewconfAnnot).then(() => {
          hga.boundRefreshView();
          //hga.forceRefreshView();
          this.setState(this.state);
        });
      }
    });
  }



  render() {
    const variantPositionAbsCoord = 20000;
    return (
    <div>
      <ul className="nav nav-tabs" role="tablist">
        <li className="nav-item">
          <a className={this.state.activeTab === "cohort" ? "nav-link active" : "nav-link"}  onClick={(evt) => this.handleTabClick(evt, "cohort")}  href="#">Cohort Browser</a>
        </li>
        <li className="nav-item">
          <a className={this.state.activeTab === "annotation" ? "nav-link active" : "nav-link"} onClick={(evt) => this.handleTabClick(evt, "annotation")}  href="#">Annotation Browser</a>
        </li>
      </ul>
      <div className="tab-content" id="cohortTabContent">
        <div className={this.state.activeTab === "cohort" ? "tab-pane fade show active" : "tab-pane fade"} role="tabpanel">
          <div className="row mt-3">
            <div className="col-12">
              <GeneSearchBar higlassContainer={this.higlassContainerCohort} />
            </div>
          </div>
          <div className="row">
            <div className="col-12">
              <HiGlassAjaxLoadContainer
                cohortVcfLocation={this.cohortVcfLocation}
                cohortDensityBwLocation={this.cohortDensityBwLocation}
                ref={this.higlassContainerCohort}
                requestingTab="cohort"
              />
            </div>
          </div>
        </div>
        <div className={this.state.activeTab === "annotation" ? "tab-pane fade show active" : "tab-pane fade"} role="tabpanel">
          <div className="row mt-3">
            <div className="col-12">
            <HiGlassAjaxLoadContainer 
              variantPositionAbsCoord={variantPositionAbsCoord} 
              ref={this.higlassContainerAnnotation} 
              requestingTab="annotation" />
            </div>
          </div>
        </div>
      </div>
      
    </div>
  );
  }
}

export const EmbeddedCohortBrowser = React.memo(function EmbeddedCohortBrowser(
  props
) {
  const { cohortVcfLocation, cohortDensityBwLocation } = props;
  const higlassContainerCohort = useRef(null);
  const higlassContainerAnnotation = useRef(null);

  return (
    <EmbeddedCohortBrowserUnit 
      cohortVcfLocation={cohortVcfLocation} 
      cohortDensityBwLocation={cohortDensityBwLocation} 
      higlassContainerCohort={higlassContainerCohort}
      higlassContainerAnnotation={higlassContainerAnnotation} />
  );
});


