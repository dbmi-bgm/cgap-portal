class InheritanceMode:

    EMPTY = '.'

    # Genotype labels
    GENOTYPE_LABEL_DOT = "Missing"
    GENOTYPE_LABEL_00 = "Homozygus reference"
    GENOTYPE_LABEL_0M = "Heterozygous"
    GENOTYPE_LABEL_MM = "Homozygus alternate"
    GENOTYPE_LABEL_MN_KEYWORD = "multiallelic"
    GENOTYPE_LABEL_MN = "Heterozygous alt/alt -  %s" % GENOTYPE_LABEL_MN_KEYWORD
    GENOTYPE_LABEL_MN_ADDON = " (%s in family)" % GENOTYPE_LABEL_MN_KEYWORD
    GENOTYPE_LABEL_0 = "Hemizygous reference"
    GENOTYPE_LABEL_M = "Hemizygous alternate"
    GENOTYPE_LABEL_FEMALE_CHRY = "-"
    GENOTYPE_LABEL_SEX_INCONSISTENT = "False"

    # Inheritance Mode labels
    INHMODE_LABEL_DE_NOVO_STRONG = "de novo (strong)"
    INHMODE_LABEL_DE_NOVO_MEDIUM = "de novo (medium)"
    INHMODE_LABEL_DE_NOVO_WEAK = "de novo (weak)"
    INHMODE_LABEL_DE_NOVO_CHRXY = "de novo (chrXY)"
    INHMODE_DOMINANT_FATHER = "Dominant (paternal)"
    INHMODE_DOMINANT_MOTHER = "Dominant (maternal)"
    INHMODE_LABEL_RECESSIVE = "Recessive"
    INHMODE_LABEL_X_LINKED_RECESSIVE_MOTHER = "X-linked recessive (Maternal)"
    INHMODE_LABEL_X_LINKED_DOMINANT_MOTHER = "X-linked dominant (Maternal)"
    INHMODE_LABEL_X_LINKED_DOMINANT_FATHER = "X-linked dominant (Paternal)"
    INHMODE_LABEL_Y_LINKED = "Y-linked dominant"
    INHMODE_LABEL_LOH = "Loss of heteozyogousity"

    INHMODE_LABEL_NONE_DOT = "Low relevance, missing call(s) in family"
    INHMODE_LABEL_NONE_MN = "Low relevance, multiallelic site family"
    INHMODE_LABEL_NONE_SEX_INCONSISTENT = "Low relevance, mismatching chrXY genotype(s)"
    INHMODE_LABEL_NONE_LOWDEPTH = "Low relevance, low depth"
    INHMODE_LABEL_NONE_HOMOZYGOUS_PARENT = "Low relevance, homozygous in a parent"
    INHMODE_LABEL_NONE_BOTH_PARENTS = "Low relevance, present in both parent(s)"
    INHMODE_LABEL_NONE_OTHER = "Low relevance, other"

    @classmethod
    def is_multiallelic_site(cls, genotypes):
        """ Returns true of any genotype in the list of given genotypes has allele number 2 or greater

        :param genotypes: a list of genotypes to analyze ex: ["0/0", "1/1"]
        :returns: True if multiallelic site, False otherwise
        """
        for gt in genotypes:
            allele1, allele2 = gt.split('/')
            if allele1 == cls.EMPTY:
                continue
            elif int(allele1) > 1 or int(allele2) > 1:
                return True
        return False

    @classmethod
    def select_genotype_label(cls, gt, sex, chrom):
        """ Given the genotype, sex and chromosome determine the genotype label

        :param gt: single genotype to analyze ex: "0/0"
        :param sex: sex of person, 'M' or 'F' XXX: should others be included?
        :param chrom: chrom where genotype was observed
        :returns: genotype label
        """
        allele1, allele2 = gt.split('/')

        # XXX: document what this is doing, refactor into descriptive helper method
        if allele1 == cls.EMPTY:
            if sex == 'F' and chrom == 'Y':
                return cls.GENOTYPE_LABEL_FEMALE_CHRY
            return cls.GENOTYPE_LABEL_DOT

        # cast to int since we no longer need strings ?
        allele1, allele2 = int(allele1), int(allele2)

        # XXX: document what this is doing, refactor into descriptive helper method
        if sex == 'F' and chrom == 'Y':
            if allele1 == 0 and allele2 == 0:
                return cls.GENOTYPE_LABEL_FEMALE_CHRY
            return cls.GENOTYPE_LABEL_SEX_INCONSISTENT

        # XXX: document what this is doing, refactor into descriptive helper method
        if sex == "male" and chrom in ['X', 'Y']:
            if allele1 != allele2:
                return cls.GENOTYPE_LABEL_SEX_INCONSISTENT
            if allele1 == 0:
                return cls.GENOTYPE_LABEL_0
            return cls.GENOTYPE_LABEL_M

        # XXX: document what this is doing, refactor into descriptive helper method
        if allele1 == 0 and allele2 == 0:
            return cls.GENOTYPE_LABEL_00
        if allele1 == 0:
            return cls.GENOTYPE_LABEL_0M
        if allele1 == allele2:
            return cls.GENOTYPE_LABEL_MM

        return cls.GENOTYPE_LABEL_MN
