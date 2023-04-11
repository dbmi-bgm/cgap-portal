import {
    object,
    ajax,
} from '@hms-dbmi-bgm/shared-portal-components/es/components/util';
import { console } from '@hms-dbmi-bgm/shared-portal-components/es/components/util';
import { CHROMS, chr2Abs } from './chrom-utils';

export const parseVcfRecord = (vcfRecord, availableTests, availableMasks) => {
    const info = vcfRecord['INFO'];
    const posAbs = chr2Abs(vcfRecord.CHROM, +vcfRecord.POS);

    const parsedResult = {
        id: vcfRecord.ID[0],
        chrom: vcfRecord.CHROM,
        start: vcfRecord.POS,
        end: info.END[0],
        geneName: info.SYMBOL[0],
        info: info,
        posAbs: posAbs,
    };

    //availableTests - List of statistical tests to display
    availableMasks.forEach((maskName) => {
        availableTests.forEach((testName) => {
            const currentName = `MASK_${maskName}_${testName}`;
            // We need to set a negative number here, so that the sorting works. This will be replaces with "-" in the display
            parsedResult[currentName] = info[currentName]
                ? info[currentName][0]
                : -1;
        });
    });

    return parsedResult;
};

export const parseLocation = (str) => {
    const chromNames = CHROMS.map((c) => c.name);
    if (str.includes(':')) {
        const ss = str.split(':').filter((n) => n); // remove empty elements
        if (ss.length === 1 && chromNames.includes(ss[0])) {
            const chrName = ss[0];
            return chr2Abs(chrName, 0);
        } else if (
            ss.length > 1 &&
            chromNames.includes(ss[0]) &&
            parseInt(ss[1], 10)
        ) {
            const chrName = ss[0];
            const pos = parseInt(ss[1], 10);
            return chr2Abs(chrName, pos);
        }
    } else if (chromNames.includes(str)) {
        return chr2Abs(str, 0);
    }

    return null;
};

export const getGeneLists = (callback) => {
    const fallbackCallback = (errResp, xhr) => {
        // Error callback
        console.warn(errResp);
    };
    ajax.load(
        '/search/?type=GeneList&format=json',
        (resp) => {
            const geneList = {};
            resp['@graph'].forEach((gl) => {
                geneList[gl['title']] = gl['genes'].map(
                    (gene) => gene['@id'].split('/')[2]
                );
            });
            callback(geneList);
        },
        'GET',
        fallbackCallback
    );
};
