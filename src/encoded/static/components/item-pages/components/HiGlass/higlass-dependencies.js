'use strict';

/** This file should be loaded via `import()` to be code-split into separate bundle. */

import { HiGlassComponent } from 'higlass/dist/hglib';
// import from just 'higlass-register' itself don't work, should update its package.json to have `"module": "src/index.js",` (or 'esm' or w/e it is) for that.
import { default as higlassRegister } from 'higlass-register/dist/higlass-register';
import { default as SequenceTrack } from 'higlass-sequence/es/SequenceTrack';
import { default as TranscriptsTrack } from 'higlass-transcripts/es/TranscriptsTrack';
import { default as ClinvarTrack } from 'higlass-clinvar/es/ClinvarTrack';
import { default as TextTrack } from 'higlass-text/es/TextTrack';
import { default as OrthologsTrack } from 'higlass-orthologs/es/OrthologsTrack';
import { default as PileupTrack } from 'higlass-pileup/es/PileupTrack';
import { default as GnomadTrack } from 'higlass-gnomad/es/GnomadTrack';
import { default as SvTrack } from 'higlass-sv/es/SvTrack';
import { default as GeneralVcfTrack } from 'higlass-general-vcf/es/GeneralVcfTrack';
import { default as CohortTrack } from 'higlass-cohort/es/CohortTrack';
import { default as GeneListTrack } from 'higlass-cohort/es/GeneListTrack';
import { default as BigwigDataFetcher } from 'higlass-bigwig-datafetcher/es/BigwigDataFetcher';

export {
    HiGlassComponent,
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
};
