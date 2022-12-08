/**
 * Much of this code was inspired by https://www.npmjs.com/package/react-lite-youtube-embed
 *
 * @TODO: Review the security policy update that to allows requests to Youtube, etc. and get this working.
 * @TODO: Complete styling for lazy loader... also WHY is it loading even though state has not told it to yet?
 */

import { patchedConsoleInstance as console } from "@hms-dbmi-bgm/shared-portal-components/es/components/util/patched-console";
import React from "react";
import PropTypes from "prop-types";
import _ from "underscore";


const YOUTUBE_BASE_URL = "https://www.youtube-nocookie.com"; // By default, using the URL that doesn't store cookies (sorry, Goog)
const YT_IMG_URL = "https://i.ytimg.com"; // Youtube's thumbnail image server (probably does store cookies, but no alts)


export class YoutubeVideoEmbed extends React.Component {
    constructor(props) {
        super(props);

        this.state = {
            showVideo: false,
            preconnected: false
        };

        _.bindAll(this, ["showIframe", "preconnectToYoutube", "getIframeJSX"]);
    }

    showIframe() {
        const { showVideo } = this.state;

        if (!showVideo) {
            this.setState({ showVideo: true });
        }
    }

    preconnectToYoutube() {
        const { preconnected } = this.state;

        if (!preconnected) {
            this.setState({ preconnected: true });
        }
    }

    getIframeJSX() {
        const {
            videoID,
            videoTitle,
            isPlaylist,
            shouldAutoplay,
        } = this.props;

        const {
            showVideo
        } = this.state;

        // Be extra careful with this, since it's going raw into the iframe SRC
        const embedID = encodeURIComponent(videoID);

        // Lazy loading video as playlist or individual
        const autoplay = shouldAutoplay || (!shouldAutoplay && showVideo) ? "1" : "0";
        const videoEmbedURL = isPlaylist ?
            `${YOUTUBE_BASE_URL}/embed/videoseries?autoplay=${autoplay}&list=${embedID}`:
            `${YOUTUBE_BASE_URL}/embed/${embedID}?autoplay=${autoplay}&state=1`;

        console.log("YoutubeVideoEmbed", videoEmbedURL);

        return (
            <iframe
                src={videoEmbedURL}
                title={videoTitle}
                width="560" // not really in use
                height="315" // not really in use
                frameBorder="0"
                allow={`accelerometer;${shouldAutoplay ? " autoplay;": ""} encrypted-media; gyroscope; picture-in-picture`}
                allowFullScreen
            >
            </iframe>
        );
    }

    render() {
        const {
            videoID,
            videoTitle,
            isPlaylist,
            shouldAutoplay,
            posterSize,
            aspectHeight,
            aspectWidth
        } = this.props;

        console.log("YoutubeVideoEmbed does exist");

        const {
            showVideo,
            preconnected
        } = this.state;

        if (!videoID) {
            console.error("YoutubeVideoEmbed component must have an embedID.");
            return null;
        }

        // Calculate aspect ratio
        const aspectRatio = `${(aspectHeight / aspectWidth) * 100}%`;
        const embedWrapperStyle = {
            '--aspect-ratio': aspectRatio,
            paddingBottom: aspectRatio
        };

        if (shouldAutoplay) {
            // Just render the video in the iFrame immediately
            return (
                <div className="youtube-embed-lazyload-poster"
                    style={embedWrapperStyle}>
                    {this.getIframeJSX()}
                </div>
            );
        }

        // Ensure this fits in a URL
        const embedID = encodeURIComponent(videoID);

        // Loading webp image, for speed and progressiveness of loading
        const posterURL = !isPlaylist ?
            `${YT_IMG_URL}/vi_webp/${embedID}/${posterSize}.webp`:
            `${YT_IMG_URL}/vi_webp/${playlistCoverID}/${posterSize}.webp`;

        embedWrapperStyle.backgroundImage = `url(${posterURL})`;
        return (
            <React.Fragment>
                {/* Pre-loading the image URL */}
                <link rel="preload" href={posterURL} as="image"/>

                {/* Warm up the connection with the video host URL */}
                { preconnected && <link rel="preconnect" href={YOUTUBE_BASE_URL} />}

                <div
                    className="youtube-embed-lazyload-poster"
                    onPointerOver={this.preconnectToYoutube}
                    onClick={this.showIframe}
                    data-title={videoTitle}
                    style={embedWrapperStyle}
                >
                    <button
                        type="button"
                        className="youtube-embed-fake-play-btn"
                    >
                        <i className="icon icon-play fas"></i>
                    </button>
                    {
                        showVideo ? this.getIframeJSX(): null
                    }
                </div>
            </React.Fragment>
        );
    }
}

YoutubeVideoEmbed.defaultProps = {
    videoID: null,                      // The embed's id
    videoTitle: "CGAP Video Content",   // What is the video's title? (For accessibility purposes)
    posterSize: "hqdefault",            // What size image should lazy load before the video? See below for options
    aspectHeight: 9,                    // Self-explanatory
    aspectWidth: 16,                    // Self-explanatory
    shouldAutoplay: false,              // Should the video autoplay by default?
    isPlaylist: false,                  // Is the youtube video's ID an embedded playlist?
};

YoutubeVideoEmbed.propTypes = {
    videoID: PropTypes.string.isRequired,
    videoTitle: PropTypes.string.isRequired,
    posterSize: PropTypes.oneOf(["default", "mqdefault", "hqdefault", "sddefault", "maxresdefault"]).isRequired,
    aspectHeight: PropTypes.number,
    aspectWidth: PropTypes.number,
    shouldAutoplay: PropTypes.bool,
    isPlaylist: PropTypes.bool,
};