'use strict';

// Require all components to ensure javascript load ordering

/**
 * Here we import all of our Content Views (Page Views) and register them
 * to `globals.content_views` so that they may be picked up and routed to in
 * the root `App` component.
 *
 * Individual item-type-view files might themselves register a PageTitle panel view.
 */

import { content_views }                    from './globals';

import StaticPage                           from './static-pages/StaticPage';
import DirectoryPage                        from './static-pages/DirectoryPage';

import HomePage                             from './static-pages/HomePage';


import DefaultItemView                      from './item-pages/DefaultItemView';
import CaseView                             from './item-pages/CaseView';
import ReportView                           from './item-pages/ReportView';
import VariantSampleView                    from './item-pages/VariantSampleView';
import StructuralVariantSampleView          from './item-pages/StructuralVariantSampleView';
import IndividualView                       from './item-pages/IndividualView';
import FileProcessedView                    from './item-pages/FileProcessedView';
import SampleView                           from './item-pages/SampleView';
import HealthView                           from './item-pages/HealthView';
import UserView, { ImpersonateUserForm }    from './item-pages/UserView';
import SchemaView                           from './item-pages/SchemaView';
import FallbackView                         from './item-pages/FallbackView';
import DocumentView                         from './item-pages/DocumentView';
import MetaWorkflowRunView                  from './item-pages/MetaWorkflowRunView';
import StaticSectionView                    from './item-pages/StaticSectionView';
import CGAPSubmissionView                   from './forms/CGAPSubmissionView';
import SearchView                           from './browse/SearchView';
import ExcelSubmissionView                  from './forms/ExcelSubmissionView';

/**
 * These content_view.register actions occur in this index.js as otherwise
 * the item-type-view files might not be included in the compiled build.js
 * due to webpack/babel tree-shaking config/plugins.
 */
content_views.register(StaticPage,                  'StaticPage');
content_views.register(DirectoryPage,               'DirectoryPage');

content_views.register(HomePage,                    'HomePage');

content_views.register(DefaultItemView,             'Item');
content_views.register(CaseView,                    'Case');
content_views.register(SomaticAnalysisView,         'SomaticAnalysis');
content_views.register(ReportView,                  'Report');
content_views.register(VariantSampleView,           'VariantSample');
content_views.register(StructuralVariantSampleView, 'StructuralVariantSample');
content_views.register(IndividualView,              'Individual');
content_views.register(FileProcessedView,           'FileProcessed');
content_views.register(SampleView,                  'Sample');
content_views.register(MetaWorkflowRunView,         'MetaWorkflowRun');
content_views.register(HealthView,                  'Health');
content_views.register(DocumentView,                'Document');
content_views.register(DocumentView,                'Image');
content_views.register(SchemaView,                  'JSONSchema');
content_views.register(UserView,                    'User');
content_views.register(ImpersonateUserForm,         'User', 'impersonate-user');
content_views.register(StaticSectionView,           'StaticSection');

content_views.register(CGAPSubmissionView,          'Item', 'edit');
content_views.register(CGAPSubmissionView,          'Item', 'create');
content_views.register(CGAPSubmissionView,          'Item', 'clone');
content_views.register(CGAPSubmissionView,          'Search', 'add');
content_views.register(ExcelSubmissionView,         'IngestionSubmission', 'create');
content_views.register(ExcelSubmissionView,         'IngestionSubmissionSearchResults', 'add');

content_views.register(SearchView,                  'Search');
content_views.register(SearchView,                  'Search', 'selection');
content_views.register(SearchView,                  'Search', 'multiselect');


// Fallback for anything we haven't registered
content_views.fallback = function () {
    return FallbackView;
};

import App from './app';
import SomaticAnalysisView from './item-pages/SomaticAnalysisView';

export default App;
