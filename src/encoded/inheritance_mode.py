class InheritanceModeError(Exception):
    pass


class InheritanceMode:

    EMPTY = '.'  # XXX: is this really what this is?

    CHROMOSOMES = [
        '1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12', '13', '14',
        '15', '16', '17', '18', '19', '20', '21', '22', 'X', 'Y', 'M'
    ]

    MALE = 'M'
    FEMALE = 'F'
    SEXES = [MALE, FEMALE]  # XXX: any additional?

    MOTHER = 'mother'
    FATHER = 'father'
    SELF = 'self'
    TRIO = [MOTHER, FATHER, SELF]

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

    @staticmethod
    def is_sex_chromosome(chrom):
        return chrom == 'X' or chrom == 'Y'

    @staticmethod
    def alleles_match(a1, a2, is_zero=False):
        """ Returns True if a1==a1 and additionally if a1==a2==0 if is_zero is True """
        if is_zero:
            return a1 == 0 and a2 == 0
        return a1 == a2

    @classmethod
    def is_multiallelic_site(cls, genotypes):
        """ Returns true of any genotype in the list of given genotypes has allele number 2 or greater

        :precondition: genotypes is list in format in example where all elements conform
        :param genotypes: a list of genotypes to analyze ex: ["0/0", "1/1"]
        :returns: True if multi-allelic site, False otherwise
        """
        if genotypes is None:
            raise InheritanceModeError('Passed None to is_multiallelic_site')
        for gt in genotypes:
            allele1, allele2 = gt.split('/')
            if allele1 == cls.EMPTY:
                continue
            elif int(allele1) > 1 or int(allele2) > 1:  # could fail here
                return True
        return False

    @classmethod
    def compute_genotype_label(cls, *, gt, sex, chrom):  # XXX: force keyword args for clarity
        """ Given the genotype, sex and chromosome determine the genotype label

        :param gt: single genotype to analyze ex: "0/0"
        :param sex: sex of person, 'M' or 'F' XXX: should others be included?
        :param chrom: chrom where genotype was observed
        :returns: genotype label
        """
        allele1, allele2 = gt.split('/')
        if sex not in cls.SEXES:
            raise InheritanceModeError('Bad sex given to compute_genotype_label: %s' % sex)
        if chrom not in cls.CHROMOSOMES:
            raise InheritanceModeError('Bad chromosome given to compute_genotype_label: %s' % chrom)

        # XXX: document what this is doing, refactor into descriptive helper method
        if allele1 == cls.EMPTY:
            if sex == cls.FEMALE and chrom == cls.MALE:
                return cls.GENOTYPE_LABEL_FEMALE_CHRY
            return cls.GENOTYPE_LABEL_DOT

        # cast to int since we no longer need strings ?
        try:
            allele1, allele2 = int(allele1), int(allele2)
        except ValueError as e:
            raise InheritanceModeError('Bad genotype given to compute_genotype_label: %s' % e)

        # XXX: document what this is doing, refactor into descriptive helper method
        if sex == cls.FEMALE and chrom == 'Y':
            if cls.alleles_match(allele1, allele2, is_zero=True):
                return cls.GENOTYPE_LABEL_FEMALE_CHRY
            return cls.GENOTYPE_LABEL_SEX_INCONSISTENT

        # XXX: document what this is doing, refactor into descriptive helper method
        if sex == cls.MALE and cls.is_sex_chromosome(chrom):
            if not cls.alleles_match(allele1, allele2):
                return cls.GENOTYPE_LABEL_SEX_INCONSISTENT
            if allele1 == 0:
                return cls.GENOTYPE_LABEL_0
            return cls.GENOTYPE_LABEL_M

        # XXX: document what this is doing, refactor into descriptive helper method
        if cls.alleles_match(allele1, allele2, is_zero=True):
            return cls.GENOTYPE_LABEL_00
        elif allele1 == 0:
            return cls.GENOTYPE_LABEL_0M
        elif allele1 == allele2:
            return cls.GENOTYPE_LABEL_MM

        return cls.GENOTYPE_LABEL_MN

    @classmethod
    def compute_family_genotype_labels(cls, genotypes, sexes, chrom):
        """ Computes family genotype labels for all keys present in genotypes. Assumes consistent
            structure amongst genotypes and sexes.

        :param genotypes: dictionary of role -> genotype mappings
        :param sexes: dictionary of role -> sex mappings
        :param chrom: relevant chromosome
        :returns: genotype_labels, dictionary of role -> list of genotype labels
        """
        genotype_labels = {}
        for role, genotype in genotypes.items():
            sex = sexes[role]
            genotype_labels[role] = [cls.compute_genotype_label(gt=genotype, sex=sex, chrom=chrom)]

        # handle multi-allelic site
        if cls.is_multiallelic_site(genotypes.values()):
            for role, labels in genotype_labels.items():
                if cls.GENOTYPE_LABEL_MN_KEYWORD not in labels:
                    labels.append(cls.GENOTYPE_LABEL_MN_ADDON)
        return genotype_labels

    @staticmethod
    def check_if_label_exists(label_to_find, labels_to_search):
        """ Helper for below method that checks if a given label exists in any sub lists """
        for labels in labels_to_search.values():
            if label_to_find in labels:
                return True
        return False

    @staticmethod
    def mother_father_ref_ref(mother_gt, father_gt):
        """ Returns true if both mother and father are ref/ref (0/0) """
        return mother_gt == '0/0' and father_gt == '0/0'

    @classmethod
    def compute_inheritance_mode_trio(cls, *, genotypes, genotype_labels, sexes, chrom, novoPP):
        """ Computes inheritence modes for the trio of 'self', 'mother', 'father'.

        :param genotypes: dictionary of role -> genotype mappings
        :param genotype_labels: dictionary of role -> genotype_label mappings
        :param sexes: dictionary of role -> sex mappings
        :param chrom: relevant chromosome
        :param novoPP: novoCaller post-posterior probability (likely de novo), takes precedence
        :returns: list of inheritance modes
        """
        # validate precondition
        for d in [genotypes, genotype_labels, sexes]:
            for role in cls.TRIO:
                assert role in d

        if (cls.check_if_label_exists(cls.GENOTYPE_LABEL_DOT, genotype_labels) or
                cls.is_multiallelic_site(genotypes.values()) or
                cls.check_if_label_exists(cls.GENOTYPE_LABEL_SEX_INCONSISTENT, genotype_labels)):
            return []

        # XXX: determine de novo (extract into helper?)
        if novoPP > 0.9:
            return [cls.INHMODE_LABEL_DE_NOVO_STRONG]
        if novoPP > 0.1:
            return [cls.INHMODE_LABEL_DE_NOVO_MEDIUM]
        if (cls.mother_father_ref_ref(genotypes[cls.MOTHER], genotypes[cls.FATHER]) and
                genotypes[cls.SELF] == '0/1' and chrom == 'autosome'):  # XXX: since when can chrom have value 'autosome'?
            return [cls.INHMODE_LABEL_DE_NOVO_WEAK]
        if (cls.mother_father_ref_ref(genotypes[cls.MOTHER], genotypes[cls.FATHER])
                and ((genotypes[cls.SELF] == '0/1' and sexes[cls.SELF] == cls.FEMALE and chrom == cls.MALE)
                     or (genotypes[cls.SELF] == '1/1' and sexes[cls.SELF] == cls.MALE and chrom != 'autosome'))):
            if novoPP == 0:
                return [cls.INHMODE_LABEL_DE_NOVO_WEAK]
            if novoPP == -1:
                return [cls.INHMODE_LABEL_DE_NOVO_CHRXY]
            raise ValueError("novoPP is different from 0 or -1 on sex chromosome: %s" % novoPP)

        # XXX: after the above, we should have some comments talking about what each of these
        # are doing (and potentially extract them out).
        if (genotypes[cls.MOTHER] == "0/0"
                and genotype_labels[cls.FATHER] == cls.GENOTYPE_LABEL_0M
                and genotypes[cls.SELF] == "0/1"):
            return [cls.INHMODE_DOMINANT_FATHER]

        if (genotypes[cls.MOTHER] == "0/1" and genotypes[cls.FATHER] == "0/0"
                and genotypes[cls.SELF] == "0/1"):
            return [cls.INHMODE_DOMINANT_MOTHER]

        if (genotypes[cls.MOTHER] == "0/1" and genotypes[cls.FATHER] == "0/1"
                and genotypes[cls.SELF] == "1/1"):
            return [cls.INHMODE_LABEL_RECESSIVE]

        if (genotypes[cls.MOTHER] == "0/1" and genotypes[cls.FATHER] == "0/0"
                and genotypes[cls.SELF] == "1/1" and sexes[cls.SELF] == cls.MALE and chrom == 'X'):
            return [cls.INHMODE_LABEL_X_LINKED_RECESSIVE_MOTHER, cls.INHMODE_LABEL_X_LINKED_DOMINANT_MOTHER]

        if (genotypes[cls.MOTHER] == "0/0" and genotype_labels[cls.FATHER] == cls.GENOTYPE_LABEL_M and
                chrom == 'X' and genotype_labels[cls.SELF] in [cls.GENOTYPE_LABEL_M, cls.GENOTYPE_LABEL_0M]):
            return [cls.INHMODE_LABEL_X_LINKED_DOMINANT_FATHER]

        if (genotype_labels[cls.FATHER] == cls.GENOTYPE_LABEL_M and
                chrom == 'Y' and genotype_labels[cls.SELF] == cls.GENOTYPE_LABEL_M):
            return [cls.INHMODE_LABEL_Y_LINKED]

        if (((genotypes[cls.MOTHER] == "0/1" and genotypes[cls.FATHER] == "0/0") or
             (genotypes[cls.MOTHER] == "0/0" and genotypes[cls.FATHER] == "0/1"))
                and genotypes[cls.SELF] == "1/1"):
            return [cls.INHMODE_LABEL_LOH]

        return []
