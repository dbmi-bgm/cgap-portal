'use strict';

import createReactClass from 'create-react-class';
import PropTypes from 'prop-types';

/* Written by Carl, used to test the homepage rendered by home.js
Specifically, test the creation of Accouncements and Getting Started entries,
making sure they collapse correctly, and test the fetchedParams used to build
the banner.*/

jest.autoMockOff();

// Fixes https://github.com/facebook/jest/issues/78
jest.dontMock('react');
jest.dontMock('underscore');

describe('Testing home.js', function() {
    var React, HomePage, testItem, TestUtils, page, data, _, banners, Wrapper, sinon, server;

    beforeAll(function() {
        React = require('react');
        TestUtils = require('react-dom/lib/ReactTestUtils');
        _ = require('underscore');
        HomePage = require('../static-pages/HomePage').default;

        sinon = require('sinon');
        server = sinon.fakeServer.create();
        
        server.respondWith(
            "GET",
            '/profiles/',
            [
                200, 
                { "Content-Type" : "application/json" },
                '<html></html>' // Don't actually need content JSON here for test.
            ]
        );

        Wrapper = createReactClass({
            render: function() {
                return (
                    <div>{this.props.children}</div>
                );
            }
        });
        page = TestUtils.renderIntoDocument(
            <Wrapper>
                <HomePage context={{ 'content' : [
                    {
                        "file": "/src/encoded/static/data/home/description.html",
                        "name": "home.introduction",
                        "award": {
                            "@id": "/awards/1U01CA200059-01/",
                            "display_title": "4D NUCLEOME NETWORK DATA COORDINATION AND INTEGRATION CENTER",
                            "link_id": "~awards~1U01CA200059-01~",
                            "uuid": "b0b9c607-f8b4-4f02-93f4-9895b461334b",
                            "principals_allowed": {
                                "view": [
                                    "system.Everyone"
                                ],
                                "edit": [
                                    "group.admin"
                                ],
                                "audit": [
                                    "system.Everyone"
                                ]
                            }
                        },
                        "title": "Introduction",
                        "status": "released",
                        "aliases": [],
                        "date_created": "2018-07-09T22:34:47.703286+00:00",
                        "section_type": "Page Section",
                        "schema_version": "2",
                        "@id": "/static-sections/10000000-0000-0000-0000-fffff1000000/",
                        "@type": [
                            "StaticSection",
                            "Item"
                        ],
                        "uuid": "10000000-0000-0000-0000-fffff1000000",
                        "external_references": [],
                        "display_title": "Introduction",
                        "link_id": "~static-sections~10000000-0000-0000-0000-fffff1000000~",
                        "principals_allowed": {
                            "view": [
                                "system.Everyone"
                            ],
                            "edit": [
                                "group.admin"
                            ],
                            "audit": [
                                "system.Everyone"
                            ]
                        },
                        "content": "<p>\nThe 4D Nucleome Data Portal hosts data generated by the 4DN Network and other reference nucleomics data sets.\nThe Portal is currently in pre-release as more data is being curated, and data processing and visualization tools are being incorporated.\nClick <a href=\"/browse/?type=ExperimentSetReplicate&experimentset_type=replicate\"><strong>Browse</strong></a> to see currently available data. \n</p>\n\n<p>\nThe 4DN program aims to understand the principles underlying nuclear organization in space and time, \nthe role nuclear organization plays in gene expression and cellular function, \nand how changes in nuclear organization affect normal development as well as various diseases. \nThe program is developing novel tools to explore the dynamic nuclear architecture and its role in gene expression programs,\nmodels to examine the relationship between nuclear organization and function,\nand reference maps of nuclear architecture in a variety of cells and tissues as a community resource.\n</p>",
                        "filetype": "html"
                    }
                 ] }} />
            </Wrapper>
        );
    });

    afterAll(function(){
        server.restore();
    });
    
    /*
    Banner not on homepage at moment.
    it('has one banner with three entries. Entry links are correct', function() {
        var banners = TestUtils.scryRenderedDOMComponentsWithClass(page, 'fourDN-banner');
        var bannerEntries = TestUtils.scryRenderedDOMComponentsWithClass(page, 'banner-entry');
        expect(banners.length).toEqual(1);
        expect(bannerEntries.length).toEqual(3);
        expect(bannerEntries[0].getAttribute('href')).toEqual('/browse/?type=ExperimentSetReplicate&experimentset_type=replicate&limit=all');
        expect(bannerEntries[1].getAttribute('href')).toEqual('/browse/?type=ExperimentSetReplicate&experimentset_type=replicate&limit=all');
        expect(bannerEntries[2].getAttribute('href')).toEqual('/search/?type=Biosource');
    });
    */

    it('has welcome, announcements headers', function() {
        var newsHeaders = TestUtils.scryRenderedDOMComponentsWithClass(page, "homepage-section-title");
        expect(newsHeaders.length).toEqual(2);
    });

});
