//'use strict';

import React from 'react';
import PropTypes from 'prop-types';
import _ from 'underscore';
import memoize from 'memoize-one';
import { console, object, ajax, isServerSide } from '@hms-dbmi-bgm/shared-portal-components/es/components/util';
import { requestAnimationFrame } from '@hms-dbmi-bgm/shared-portal-components/es/components/viz/utilities';
import { PackageLockLoader } from './../../../util/package-lock-loader';


/**
 * Helper function to test if an Item is a HiglassViewConfig Item.
 * To be used by Components such as BasicStaticSectionBody to determine
 * what time of view to render.
 */
export function isHiglassViewConfigItem(context){
    if (!context) return false;
    if (Array.isArray(context['@type'])){
        // Ideal case is that @type is present. However it may not be embedded in all cases.
        return context['@type'].indexOf('HiglassViewConfig') > -1;
    }
    // Fallback test in case @type is not present;
    const itemAtId = object.itemUtil.atId(context);
    if (!itemAtId || itemAtId[0] !== '/') return false;
    const pathPartForType = itemAtId.slice(1).split('/', 1)[0];
    return pathPartForType === 'higlass-view-configs';
}


/**
 * Functional component to display loading indicator.
 *
 * @param {{ icon: string, title: JSX.Element|string }} props Props passed into this Component.
 */
export function HiGlassLoadingIndicator(props) {
    const { icon, title } = props;
    return (
        <React.Fragment>
            <h3>
                <i className={"icon icon-lg icon-" + (icon || "tv fas")}/>
            </h3>
            { title || "Initializing" }
        </React.Fragment>
    );
}

let higlassDependencies = null;

// /** Loaded upon componentDidMount; HiGlassComponent is not supported server-side. */
// let HiGlassComponent = null;
// let higlassRegister = null;

export class HiGlassPlainContainer extends React.PureComponent {

    static correctTrackDimensions(hiGlassComponent){
        requestAnimationFrame(()=>{
            _.forEach(hiGlassComponent.tiledPlots, (tp) => tp && tp.measureSize());
        });
    }

    static propTypes = {
        'viewConfig' : PropTypes.object.isRequired,
        'isValidating' : PropTypes.bool,
        'height' : PropTypes.number,
        'mountDelay' : PropTypes.number.isRequired,
        'onViewConfigUpdated': PropTypes.func
    };

    static defaultProps = {
        'options' : { 'bounded' : false },
        'isValidating' : false,
        'disabled' : false,
        'height' : 600,
        'viewConfig' : null,
        'mountDelay' : 500,
        'placeholder' : <HiGlassLoadingIndicator/>,
    };

    constructor(props){
        super(props);
        this.correctTrackDimensions = this.correctTrackDimensions.bind(this);
        this.getHiGlassComponent = this.getHiGlassComponent.bind(this);

        this.state = {
            'mounted' : false,
            'mountCount' : 0,
            'hasRuntimeError' : false,
            'higlassInitialized' : false
        };

        this.hgcRef = React.createRef();
        
    }

    componentDidMount(){
        const { mountDelay, onViewConfigUpdated } = this.props;
        const finish = () => {
            this.setState(function(currState){
                return {
                    'mounted' : true,
                    'mountCount' : currState.mountCount + 1
                };
            }, () => {

                setTimeout(()=>{
                    this.setState({ "higlassInitialized": true }, ()=>{
                        setTimeout(this.correctTrackDimensions, 500);
                        if (onViewConfigUpdated && typeof onViewConfigUpdated === 'function') {
                            const hgc = this.getHiGlassComponent();
                            if (hgc) {
                                hgc.api.on("viewConfig", onViewConfigUpdated);
                            }
                        }
                    });
                }, 500);

            });
        };

        setTimeout(()=>{ // Allow tab CSS transition to finish (the render afterwards lags browser a little bit).

            if (!higlassDependencies) {
                window.fetch = window.fetch || ajax.fetchPolyfill; // Browser compatibility polyfill

                // Load in HiGlass libraries as separate JS file due to large size.
                import(
                    /* webpackChunkName: "higlass-dependencies" */
                    'higlass-dependencies'
                ).then((loadedDeps) =>{
                    higlassDependencies = loadedDeps;
                    const {
                        higlassRegister,
                        SequenceTrack,
                        TranscriptsTrack,
                        ClinvarTrack,
                        TextTrack,
                        OrthologsTrack,
                        PileupTrack,
                        GnomadTrack,
                        SvTrack,
                        GeneralVcfTrack,
                        CohortTrack,
                        GeneListTrack,
                        BigwigDataFetcher
                    } = higlassDependencies;

                    higlassRegister({
                        name: 'SequenceTrack',
                        track: SequenceTrack,
                        config: SequenceTrack.config,
                    });
                    higlassRegister({
                        name: 'TranscriptsTrack',
                        track: TranscriptsTrack,
                        config: TranscriptsTrack.config,
                    });
                    higlassRegister({
                        name: 'ClinvarTrack',
                        track: ClinvarTrack,
                        config: ClinvarTrack.config,
                    });
                    higlassRegister({
                        name: 'TextTrack',
                        track: TextTrack,
                        config: TextTrack.config,
                    });
                    higlassRegister({
                        name: 'OrthologsTrack',
                        track: OrthologsTrack,
                        config: OrthologsTrack.config,
                    });
                    higlassRegister({
                        name: 'PileupTrack',
                        track: PileupTrack,
                        config: PileupTrack.config,
                    });
                    higlassRegister({
                        name: 'GnomadTrack',
                        track: GnomadTrack,
                        config: GnomadTrack.config,
                    });
                    higlassRegister({
                        name: 'SvTrack',
                        track: SvTrack,
                        config: SvTrack.config,
                    });
                    higlassRegister({
                        name: 'GeneralVcfTrack',
                        track: GeneralVcfTrack,
                        config: GeneralVcfTrack.config,
                    });
                    higlassRegister({
                        name: 'CohortTrack',
                        track: CohortTrack,
                        config: CohortTrack.config,
                    });
                    higlassRegister({
                        name: 'GeneListTrack',
                        track: GeneListTrack,
                        config: GeneListTrack.config,
                    });
                    higlassRegister(
                      {
                        dataFetcher: BigwigDataFetcher,
                        config: BigwigDataFetcher.config,
                      },
                      { pluginType: "dataFetcher" }
                    );

                    finish();
                });

            } else {
                finish();
            }

        }, mountDelay);

    }

    correctTrackDimensions(){
        var hgc = this.getHiGlassComponent();
        if (hgc){
            //HiGlassPlainContainer.correctTrackDimensions(hgc);
        } else {
            console.error('NO HGC');
        }
    }

    componentWillUnmount(){
        this.setState({ 'mounted' : false });
    }

    componentDidCatch(){
        this.setState({ 'hasRuntimeError' : true });
    }

    getHiGlassComponent(){
        return (this && this.hgcRef && this.hgcRef.current) || null;
    }

    /**
     * This returns the viewconfig currently stored in PlainContainer _state_.
     * We should adjust this to instead return `JSON.parse(hgc.api.exportViewConfigAsString())`,
     * most likely, to be of any use because HiGlassComponent keeps its own representation of the
     * viewConfig.
     *
     * @todo Change to the above once needed. Don't rely on until then.
     */
    getCurrentViewConfig(){
        const hgc = this.getHiGlassComponent();
        const { state: { viewConfig = null } = {} } = hgc || {};
        return viewConfig;
    }

    render(){
        return (
            <PackageLockLoader>
                <HiGlassPlainContainerBody {...this.props} {...this.state} ref={this.hgcRef} />
            </PackageLockLoader>
        );
    }
}


/**
 * Attention! this function works if only process.env.NODE_ENV is set
 * @todo remove this function when HiGlass works correctly under <StrictMode> in React 18
 */
const isDevelopmentEnv = memoize(function () {
    try {
        return (process.env.NODE_ENV === 'development') || (process.env.NODE_ENV === 'quick') || false;
    } catch {
        return false;
    }
});
/**
 * @todo remove this function when HiGlass works correctly under <StrictMode> in React 18
 */
const getReactVersion = memoize(function () {
    try {
        return parseInt((React.version || '-1').split('.')[0]);
    } catch {
        return -1;
    }
});


const HiGlassPlainContainerBody = React.forwardRef(function HiGlassPlainContainerBody(props, ref){
    const { viewConfig, options, hasRuntimeError, disabled, isValidating, mounted, higlassInitialized, width, height, mountCount, placeholder, style, className, packageLockJson } = props;
    const outerKey = "mount-number-" + mountCount;
    const { dependencies: { higlass : { version: higlassVersionUsed = null } = {} } = {} } = packageLockJson || {};
    const { HiGlassComponent } = higlassDependencies || {};

    let hiGlassInstance = null;
    const placeholderStyle = { width: width || null };
    if (isValidating || !mounted || higlassVersionUsed === null){ // Still loading/initializing...
        if (typeof height === 'number' && height >= 140){
            placeholderStyle.height = height;
            placeholderStyle.paddingTop = (height / 2) - 40;
        }
        hiGlassInstance = <div className="text-center" style={placeholderStyle} key={outerKey}>{ placeholder }</div>;
    } else if (disabled) {
        hiGlassInstance = (
            <div className="text-center" key={outerKey} style={placeholderStyle}>
                <h4 className="text-400">Not Available</h4>
            </div>
        );
    } else if (hasRuntimeError) {
        hiGlassInstance = (
            <div className="text-center" key={outerKey} style={placeholderStyle}>
                <h4 className="text-400">Runtime Error</h4>
                {isDevelopmentEnv() && getReactVersion() >= 18 ? <div>HiGlass may not render correctly under StrictMode in React 18 and later.</div> : null}
            </div>
        );
    } else {
        /**
         * Fade in div element containing HiGlassComponent after HiGlass initiates & loads in first tile etc. (about 500ms).
         * For prettiness only.
         */
        const instanceContainerRefFunction = function(element){
            if (!element) return;
            setTimeout(function(){
                requestAnimationFrame(function(){
                    element.style.transition = null; // Use transition as defined in stylesheet
                    element.style.opacity = 1;
                });
            }, 500);
        };
        hiGlassInstance = (
            <div key={outerKey} className="higlass-instance" style={{ 'transition' : 'none', 'height' : '100%', 'width' : width || null }} ref={instanceContainerRefFunction}>
                <HiGlassComponent {...{ options, viewConfig, width, height, ref }} />
            </div>
        );
    }


    /**
     * TODO: Some state + UI functions to make higlass view full screen.
     * Should try to make as common as possible between one for workflow tab & this. Won't be 100% compatible since adjust workflow detail tab inner elem styles, but maybe some common func for at least width, height, etc.
     */
    return (
        <div className={"higlass-view-container" + (className ? ' ' + className : '')} style={style}>
            { higlassVersionUsed === null ? null : <link type="text/css" rel="stylesheet" href={`https://unpkg.com/higlass@${higlassVersionUsed}/dist/hglib.css`} crossOrigin="true" /> }
            <div className="higlass-wrapper">{ hiGlassInstance }</div>
        </div>
    );

});
