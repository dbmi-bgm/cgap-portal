
import React, { useState, useMemo, useCallback, useEffect, useContext } from 'react';

export const SomaticBioinformaticsTab = React.memo(function SomaticBioinformaticsTab(props) {
    const {
        context,
        href
    } = props;

    return (
        <React.Fragment>
            <h1 className="text-300">Bioinformatics Analysis</h1>
            <div className="tab-inner-container card">
                <h4 className="card-header section-header py-3">Sample Quality Control Metrics (QC)</h4>
                <div className="card-body">
                    / / TODO: Bioinfo Stats Table goes here
                </div>
            </div>
            <div className="tab-inner-container card">
                <h4 className="card-header section-header py-3">Analysis Generated Files</h4>
                <div className="card-body">
                    / / TODO: Files and Provenance Links Table goes here
                </div>
            </div>
        </React.Fragment>
    );
});