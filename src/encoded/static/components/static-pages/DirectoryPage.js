'use strict';

import React from 'react';
import PropTypes from 'prop-types';
import _ from 'underscore';
import url from 'url';
import { console, object, ajax, navigate } from'./../util';
import StaticPage, { StaticEntry, parseSectionsContent } from './StaticPage';
import { NextPreviousPageSection } from './components';
import * as globals from './../globals';


export default class DirectoryPage extends React.Component {

    render(){
        var { context } = this.props;
        var atId = object.itemUtil.atId(context);
        var childrenHaveChildren = _.any(context.children || [], function(c){
            return c && c.children && c.children.length > 0;
        });
        return (
            <div className={"static-page static-directory-page" + (childrenHaveChildren ? " directory-page-of-directories" : " leaf-directory")} key="wrapper">
                { true ? <DirectoryBodyGrid {...this.props} childrenHaveChildren={childrenHaveChildren} /> : null }
                { !childrenHaveChildren ? <NextPreviousPageSection context={context} /> : null }
            </div>
        );
    }

}

globals.content_views.register(DirectoryPage, 'DirectoryPage');


export class DirectoryBodyGrid extends React.Component {

    constructor(props){
        super(props);
        this.renderGridItem = this.renderGridItem.bind(this);
    }

    renderGridItem(child, index, all){
        var childrenHaveChildren = this.props.childrenHaveChildren;
        var childPageCount = (child.children || []).length;
        var childID = object.itemUtil.atId(child);
        return (
            <div className={"grid-item col-xs-12 col-md-" + (childrenHaveChildren ? '4' : '12')} key={childID || child.name}>
                <a href={childID} className="inner">
                    <h3 className="text-300 mb-07 mt-07 title-link">{ child.display_title }</h3>
                    { !childrenHaveChildren && child.description ?
                        <div className="page-description">{ child.description }</div> : null
                    }
                    { childrenHaveChildren && childPageCount ? <h6 className="section-page-count mt-05 mb-05 text-400">{ childPageCount } Pages</h6> : null }
                </a>
            </div>
        );
    }

    render(){
        var { context, childrenHaveChildren } = this.props;
        var childrenToShow = _.filter(context.children || [], function(child){
            if (!child || !child['@id'] || !child.display_title) return false; // Shouldn't occur.
            if (!childrenHaveChildren && (child.content || []).length === 0){
                return false;
            }
            if (childrenHaveChildren && (child.children || []).length === 0 && (child.content || []).length === 0){
                return false;
            }
            return true;
        });
        return <div className={"row grid-of-sections" + (childrenHaveChildren ? ' with-sub-children' : '')} children={_.map(childrenToShow, this.renderGridItem)}/>;
    }

}