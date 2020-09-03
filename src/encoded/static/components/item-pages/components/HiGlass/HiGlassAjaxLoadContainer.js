'use strict';

import React from 'react';
import _ from 'underscore';
import memoize from 'memoize-one';
import { console, object, ajax } from '@hms-dbmi-bgm/shared-portal-components/es/components/util';
import { HiGlassPlainContainer, HiGlassLoadingIndicator } from './HiGlassPlainContainer';


/**
 * Accepts `higlassItem` (HiglassViewConfig Item JSON) as a prop and loads in the full
 * representation from `higlassItem.@id` if `higlassItem.viewconfig` is not present before
 * instantiating a HiGlassPlainContainer.
 */
export class HiGlassAjaxLoadContainer extends React.PureComponent {


    constructor(props){
        super(props);
        console.log("PROPS",props)
        this.getFullHiglassItem = this.getFullHiglassItem.bind(this);

        this.state = {
            'loading': false,
            'higlassItem' : null,
            'variantPositionAbsCoord' : props.variantPositionAbsCoord ? props.variantPositionAbsCoord : null
        };
        this.containerRef = React.createRef();
    }

    componentDidMount(){
        if (!this.state.higlassItem) {
            this.getFullHiglassItem();
        }
    }

    componentDidUpdate(pastProps){
        // After updating the component, load the new higlass component if it changed.
        // if (pastProps.higlassItem !== this.props.higlassItem){
        //     if (this.props.higlassItem.viewconfig){
        //         this.setState({ 'higlassItem' : this.props.higlassItem });
        //     } else {
        //         this.getFullHiglassItem();
        //     }
        // }
    }

    /**
     * Retrieve the HiGlass Component, if it exists.
     *
     * @returns {object} The result of getHiGlassComponent on the HiGlass container. Or null if it doesn't exist.
     */
    getHiGlassComponent(){
        return (this.containerRef && this.containerRef.current && this.containerRef.current.getHiGlassComponent()) || null;
    }

    /**
    * Makes an AJAX call to get the Higlass viewconfig resource.
    */
    getFullHiglassItem(){
        // Use the @id to make an AJAX request to get the HiGlass Item.
        this.setState({ 'loading': true }, ()=>{

            const fallbackCallback = (errResp, xhr) => {
                // Error callback
                console.warn(errResp);
            };

            const { variantPositionAbsCoord } = this.state;
            console.log("variantPositionAbsCoord",variantPositionAbsCoord)
        
            const payload = {
                'viewconfig_uuid' : "00000000-1111-0000-1111-000000000000", // Default CGAP viewconf
                'variant_pos_abs' : variantPositionAbsCoord
            };

            console.log("payload",payload)
        
            ajax.load(
                "/get_higlass_viewconf/",
                (resp) => {
                    const higlassItem = {
                        viewconfig:  resp.viewconfig
                    }
                    this.setState({ 'higlassItem' : higlassItem,'loading': false });
                },
                'POST',
                fallbackCallback,
                JSON.stringify(payload)
            );


        });
    }


    render(){
        const { higlassItem, loading } = this.state;
        let { height } = this.props;

        //if height not defined by container then use instance defined value
        if (!height && higlassItem && higlassItem.instance_height && higlassItem.instance_height > 0) {
            height = higlassItem.instance_height;
        }

        // Use the height to make placeholder message when loading.
        var placeholderStyle = { "height" : height || 600 };
        if (placeholderStyle.height >= 140) {
            placeholderStyle.paddingTop = (placeholderStyle.height / 2) - 40;
        }

        // If we're loading, show a loading screen
        if (loading){
            return <div className="text-center" style={placeholderStyle}><HiGlassLoadingIndicator title="Loading" /></div>;
        }

        // Raise an error if there is no viewconfig
        if (!higlassItem || !higlassItem.viewconfig) {
            return (
                <div className="text-center" style={placeholderStyle}>
                    <HiGlassLoadingIndicator icon="exclamation-triangle" title="No HiGlass content found. Please go back or try again later." />
                </div>
            );
        }

        // Scale the higlass config so it fits the given container.
        const adjustedViewconfig = object.deepClone(higlassItem.viewconfig);
        // Pass the viewconfig to the HiGlassPlainContainer
        return <HiGlassPlainContainer {..._.omit(this.props, 'higlassItem', 'height')} viewConfig={adjustedViewconfig} ref={this.containerRef} height={height} />;
    }
}
