class InheritanceModeError(Exception):
    pass


class InheritanceMode:

    MISSING = '.'  # XXX: is this really what this is? Should it be called 'dot'?

    AUTOSOME = 'autosome'
    CHROMOSOMES = [
        AUTOSOME, 'X', 'Y', 'M'
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
    INHMODE_LABEL_LOH = "Loss of Heteozyogousity"

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
    def is_homozygous(a1, a2, is_reference=False):
        """ Returns True if a1==a1 and additionally if a1==a2==0 if is_zero is True """
        if is_reference:
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
            if allele1 == cls.MISSING:
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

        # distinguish between missing genotype in ChrY for a female, which is okay, vs any
        # other site which indicates a low quality position
        if allele1 == cls.MISSING:
            if sex == cls.FEMALE and chrom == 'Y':
                return cls.GENOTYPE_LABEL_FEMALE_CHRY
            return cls.GENOTYPE_LABEL_DOT

        # cast to int since we no longer need strings ?
        try:
            allele1, allele2 = int(allele1), int(allele2)
        except ValueError as e:
            raise InheritanceModeError('Bad genotype given to compute_genotype_label: %s' % e)

        # Female variants in chrY should be 0/0 or ./. otherwise bad site
        if sex == cls.FEMALE and chrom == 'Y':
            if cls.is_homozygous(allele1, allele2, is_reference=True):
                return cls.GENOTYPE_LABEL_FEMALE_CHRY
            return cls.GENOTYPE_LABEL_SEX_INCONSISTENT

        # Handle male chrXY
        if sex == cls.MALE and cls.is_sex_chromosome(chrom):
            if not cls.is_homozygous(allele1, allele2):
                return cls.GENOTYPE_LABEL_SEX_INCONSISTENT
            if allele1 == 0:
                return cls.GENOTYPE_LABEL_0
            return cls.GENOTYPE_LABEL_M

        # Handle diploid
        if cls.is_homozygous(allele1, allele2, is_reference=True):
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
                if role not in d:
                    return []

        if (cls.check_if_label_exists(cls.GENOTYPE_LABEL_DOT, genotype_labels) or
                cls.is_multiallelic_site(genotypes.values()) or
                cls.check_if_label_exists(cls.GENOTYPE_LABEL_SEX_INCONSISTENT, genotype_labels)):
            return []

        # De novo strong candidate
        if novoPP > 0.9:
            return [cls.INHMODE_LABEL_DE_NOVO_STRONG]

        # De novo medium candidate
        if novoPP > 0.1:
            return [cls.INHMODE_LABEL_DE_NOVO_MEDIUM]

        # De novo weak candidate
        if (cls.mother_father_ref_ref(genotypes[cls.MOTHER], genotypes[cls.FATHER]) and
                genotypes[cls.SELF] == '0/1' and chrom == cls.AUTOSOME):
            return [cls.INHMODE_LABEL_DE_NOVO_WEAK]

        # And de novo chrXY
        if (cls.mother_father_ref_ref(genotypes[cls.MOTHER], genotypes[cls.FATHER])
                and ((genotypes[cls.SELF] == '0/1' and sexes[cls.SELF] == cls.FEMALE and chrom == cls.MALE)
                     or (genotypes[cls.SELF] == '1/1' and sexes[cls.SELF] == cls.MALE and chrom != 'autosome'))):
            if novoPP == 0:
                return [cls.INHMODE_LABEL_DE_NOVO_WEAK]
            if novoPP == -1:
                return [cls.INHMODE_LABEL_DE_NOVO_CHRXY]
            raise ValueError("novoPP is different from 0 or -1 on sex chromosome: %s" % novoPP)

        # If not a de novo, assign inheritance mode based solely on genotypes (from GATK)
        if (genotypes[cls.MOTHER] == "0/0"
                and genotype_labels[cls.FATHER][0] == cls.GENOTYPE_LABEL_0M
                and genotypes[cls.SELF] == "0/1"):
            return [cls.INHMODE_DOMINANT_FATHER]

        if (genotypes[cls.MOTHER] == "0/1" and genotypes[cls.FATHER] == "0/0"
                and genotypes[cls.SELF] == "0/1"):
            return [cls.INHMODE_DOMINANT_MOTHER]

        if (genotypes[cls.MOTHER] == "0/1" and genotypes[cls.FATHER] == "0/1"
                and genotypes[cls.SELF] == "1/1"):
            return [cls.INHMODE_LABEL_RECESSIVE]

        # Inherited variants on sex chromosomes
        if (genotypes[cls.MOTHER] == "0/1" and genotypes[cls.FATHER] == "0/0"
                and genotypes[cls.SELF] == "1/1" and sexes[cls.SELF] == cls.MALE and chrom == 'X'):
            return [cls.INHMODE_LABEL_X_LINKED_RECESSIVE_MOTHER, cls.INHMODE_LABEL_X_LINKED_DOMINANT_MOTHER]

        # bug here?
        if (genotypes[cls.MOTHER] == "0/0" and genotype_labels[cls.FATHER][0] == cls.GENOTYPE_LABEL_M and
                chrom == 'X' and genotype_labels[cls.SELF][0] in [cls.GENOTYPE_LABEL_M, cls.GENOTYPE_LABEL_0M]):
            return [cls.INHMODE_LABEL_X_LINKED_DOMINANT_FATHER]

        if (genotype_labels[cls.FATHER][0] == cls.GENOTYPE_LABEL_M and
                chrom == 'Y' and genotype_labels[cls.SELF][0] == cls.GENOTYPE_LABEL_M):
            return [cls.INHMODE_LABEL_Y_LINKED]

        # Check for loss of heterozygosity
        if (((genotypes[cls.MOTHER] == "0/1" and genotypes[cls.FATHER] == "0/0") or
             (genotypes[cls.MOTHER] == "0/0" and genotypes[cls.FATHER] == "0/1"))
                and genotypes[cls.SELF] == "1/1"):
            return [cls.INHMODE_LABEL_LOH]

        return []

    @classmethod
    def inheritance_modes_other_labels(cls, genotypes, genotype_labels):
        """ Gives an inheritance mode where there would otherwise be None in an attempt to give
            some additional information

            :param genotypes: dictionary of role -> genotype mappings
            :param genotype_labels: dictionary of role -> genotype_label mappings
        """
        for d in [genotypes, genotype_labels]:
            for role in cls.TRIO:
                if role not in d:
                    return []

        if cls.check_if_label_exists(cls.GENOTYPE_LABEL_DOT, genotype_labels):
            return [cls.INHMODE_LABEL_NONE_DOT]
        if cls.is_multiallelic_site(genotypes.values()):
            return [cls.INHMODE_LABEL_NONE_MN]
        if cls.check_if_label_exists(cls.GENOTYPE_LABEL_SEX_INCONSISTENT, genotype_labels):
            return [cls.INHMODE_LABEL_NONE_SEX_INCONSISTENT]

        # XXX: This is wrong (missing a condition) - how to make it right?
        if genotypes[cls.MOTHER] == "1/1" or (
                genotypes[cls.FATHER] == "1/1" and genotype_labels[cls.FATHER][0] != cls.GENOTYPE_LABEL_M):
            return [cls.INHMODE_LABEL_NONE_HOMOZYGOUS_PARENT]

        # XXX: INHMODE_LABEL_NONE_BOTH_PARENTS should take precedence over INHMODE_LABEL_NONE_HOMOZYGOUS_PARENT
        # based on csv tests
        # but this precedence is relied upon in other rows ...
        if ((genotypes[cls.MOTHER] == "1/1" or genotypes[cls.MOTHER] == "0/1") and
                (genotypes[cls.FATHER] == "1/1" or genotypes[cls.FATHER] == "0/1")):
            return [cls.INHMODE_LABEL_NONE_BOTH_PARENTS]

    @staticmethod
    def compute_cmphet_inheritance_modes(cmphet):
        """ Collects and summarizes Compound het caller results """
        inheritance_modes_set = set()
        inheritance_modes = []
        if cmphet is not None:
            for entry in cmphet:
                phase = entry.get('comhet_phase')
                impact = entry.get('comhet_impact_gene')
                s = 'Compound Het (%s/%s)' % (phase, impact.lower())
                inheritance_modes_set.add(s)
            inheritance_modes = list(inheritance_modes_set)
            inheritance_modes.sort()
        return inheritance_modes

    @staticmethod
    def build_genotype_label_structure(genotype_labels):
        """ Converts the genotype_labels structure into a consistent structure that can be used
            in our item ecosystem.

            :param genotype_labels: dictionary role -> labels mapping
            :returns: list of dictionaries with structure:
                [{
                    'role': <role>,
                    'labels': <labels>
                }]
        """
        structured_labels = []
        for role, labels in genotype_labels.items():
            structured_labels.append({
                'role': role,
                'labels': labels
            })
        return structured_labels

    @classmethod
    def compute_inheritance_modes(cls, variant_sample):
        """ Computes inheritance modes given a variant_sample.
            Intended to perform: variant_sample.update(new_fields) with result of this method.

            Adds the following 2 fields to variant_sample given the complete information:
                1. genotype_labels
                2. inheritance_modes
        """
        sample_geno = variant_sample.get('samplegeno', [])
        genotypes = {s["samplegeno_role"]: s["samplegeno_numgt"] for s in sample_geno}
        sexes = {s["samplegeno_role"]: s["samplegeno_sex"] for s in sample_geno}
        chrom = variant_sample.get('variant', {}).get('CHROM')
        cmphet = variant_sample.get("cmphet")
        novoPP = variant_sample.get("novoPP", -1)

        if chrom not in ['X', 'Y']:
            chrom = cls.AUTOSOME  # XXX: so chrom is one of ['X', 'Y', 'autosome'] ?

        if cls.SELF not in genotypes:
            raise InheritanceModeError('Role "self" not present in genotypes: %s' % genotypes)

        genotype_labels = cls.compute_family_genotype_labels(genotypes, sexes, chrom)
        inheritance_modes = cls.compute_inheritance_mode_trio(genotypes=genotypes,
                                                              genotype_labels=genotype_labels,
                                                              sexes=sexes, chrom=chrom, novoPP=novoPP)
        inheritance_modes += cls.compute_cmphet_inheritance_modes(cmphet)
        if len(inheritance_modes) == 0:
            inheritance_modes = cls.inheritance_modes_other_labels(genotypes, genotype_labels)

        new_fields = {
            'genotype_labels': cls.build_genotype_label_structure(genotype_labels),
            'inheritance_modes': inheritance_modes
        }

        return new_fields
