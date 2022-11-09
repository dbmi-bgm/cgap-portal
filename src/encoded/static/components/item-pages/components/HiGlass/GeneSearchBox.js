"use strict";

import React, { useRef, useEffect } from "react";
import _ from "underscore";
import { ajax } from "@hms-dbmi-bgm/shared-portal-components/es/components/util";

export class GeneSearchBox extends React.PureComponent {
  constructor(props) {
    super(props);
    const { higlassContainer } = props;
    this.higlassContainer = higlassContainer;

    this.state = {
      results: [],
      currentTextValue: props.value || "",
      loading: false, // starts out by loading base RequestURL
      error: null,
      info: null,
    };

    this.currentRequest = null;
    this.onLoadData = _.debounce(this.onLoadData.bind(this), 500, false);
    this.handleResultClick = this.handleResultClick.bind(this);
  }

  updateCurrentSearchTerm(evt) {
    const val = evt.target.value;
    this.setState(
      {
        currentTextValue: val,
      },
      () => {
        this.onLoadData();
      }
    );
  }

  constructFetchURL() {
    const { currentTextValue } = this.state;
    const url =
      "https://cgap-higlass.com/api/v1/suggest/?d=gene_annotation_hg38&ac=" +
      encodeURIComponent(currentTextValue);
    return url;
  }

  onLoadData() {
    this.setState({ loading: true }, () => {
      if (this.currentRequest) {
        // if there's already a request running, abort it
        this.currentRequest.abort && this.currentRequest.abort();
      }

      // Don't load anything, if there is only one letter
      if (this.state.currentTextValue.length <= 1) {
        this.setState({
          currentTextValue: this.state.currentTextValue,
          loading: false,
          results: [],
          error: null,
          info: null,
        });
        return;
      }

      const requestInThisScope = (this.currentRequest = ajax.load(
        this.constructFetchURL(),
        (response) => {
          if (requestInThisScope !== this.currentRequest) {
            return false; // some other request has been fired; cancel this one
          }
          this.currentRequest = null;

          if (!response) {
            this.setState({
              loading: false,
              results: [],
              error:
                "Could not get a response from server. Check network and try again.",
              info: null,
            });
            return;
          }

          if (Object.keys(response).length === 0) {
            this.setState({
              loading: false,
              results: [],
              error: null,
              info: "We could not find any matching genes.",
            });
            return;
          }
          if (this.state.loading) {
            this.setState({
              loading: false,
              results: response,
              error: null,
              info: null,
            });
          }
        },
        "GET",
        (response, xhr) => {
          const { results = [], error = null } = response;
          this.setState({
            loading: false,
            results,
            error:
              error ||
              "Something went wrong while searching for matching genes.",
            info: null,
          });
        }
      ));
    });
  }

  handleResultClick(evt, geneName) {
    evt.preventDefault();
    if (this.higlassContainer && this.higlassContainer.current) {
      const hgc = this.higlassContainer.current.getHiGlassComponent();
      const viewconf = hgc.api.getViewConfig();
      const viewId = viewconf.views[0].uid;
      hgc.api.zoomToGene(viewId, geneName, 2000, 2000);
    }
  }

  render() {
    const { results = [], loading, error, info } = this.state;

    const icon = loading
      ? "icon icon-spinner icon-spin fas"
      : "icon icon-search fas";

    return (
      <React.Fragment>
        <div className="input-group">
          <div className="input-group-prepend">
            <span className="input-group-text" id="search-for-gene-addon">
              <i className={icon} />
            </span>
          </div>
          <input
            type="text"
            onChange={(evt) => this.updateCurrentSearchTerm(evt)}
            className="form-control"
            placeholder="Search for gene"
            aria-label="Search for gene"
            aria-describedby="search-for-gene-addon"
          />
        </div>
        <GeneSearchResult
          results={results}
          error={error}
          info={info}
          handleResultClick={this.handleResultClick}
        />
      </React.Fragment>
    );
  }
}

const GeneSearchResult = React.memo(function GeneSearchResult(props) {
  const { results, error, info, handleResultClick } = props;

  if (error) {
    return (
      <div className="text-smaller">
        <i className="icon icon-exclamation-triangle fas text-warning ml-05 mr-05"></i>
        {error}
      </div>
    );
  } else if (info) {
    return (
      <div className="text-smaller">
        <i className="icon icon-info-circle fas text-secondary ml-05 mr-05"></i>
        {info}
      </div>
    );
  }

  const resultsFormatted = results.map((result, i) => {
    if (i >= 6) {
      return;
    }

    return (
      <div className="mr-1" key={result.geneName}>
        <small>
          <a
            href="#"
            onClick={(evt) => handleResultClick(evt, result.geneName)}
          >
            {result.geneName}
          </a>
        </small>
      </div>
    );
  });

  return (
    <div className="d-flex flex-row flex-wrap bd-highlight">
      {resultsFormatted}
    </div>
  );
});
