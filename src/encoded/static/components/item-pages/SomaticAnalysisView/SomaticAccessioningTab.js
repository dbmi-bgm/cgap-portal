import React, { useState, useMemo, useCallback, useEffect, useContext } from 'react';

export const SomaticAccessioningTab = React.memo(function AccessioningTab(props) {

    const { context, href } = props;

    return (
        <React.Fragment>
            <h1 className="row align-items-center">
                <div className="col">
                    <span className="text-300">Accessioning History</span>
                </div>
            </h1>
            <div className="tab-inner-container card">
                <div className="card-body">
                    This is the accessioning tab...
                </div>
            </div>
        </React.Fragment>
    );
});