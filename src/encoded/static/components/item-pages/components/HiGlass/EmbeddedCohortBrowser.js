"use strict";

import React, { useRef, useEffect } from "react";

import { HiGlassAjaxLoadContainer } from "./HiGlassAjaxLoadContainer";

export const EmbeddedCohortBrowser = React.memo(function EmbeddedCohortBrowser(
  props
) {
  const { cohortVcfLocation, cohortDensityBwLocation } = props;
  const higlassContainerRef = useRef(null);

  return (
    <div className="row">
      <div className="col-12">
        <HiGlassAjaxLoadContainer
          cohortVcfLocation={cohortVcfLocation}
          cohortDensityBwLocation={cohortDensityBwLocation}
          ref={higlassContainerRef}
          requestingTab="cohort"
        />
      </div>
    </div>
  );
});
