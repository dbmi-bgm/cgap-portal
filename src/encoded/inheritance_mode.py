import structlog


log = structlog.getLogger(__name__)


class InheritanceModeError(Exception):
    """ To be thrown if an error is raised in this code """
    pass


class InheritanceMode:

    MISSING = '.'

    AUTOSOME = 'autosome'
    MITOCHONDRIAL = 'M'
    CHROMOSOMES = [
        '1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12', '13', '14', '15', '16', '17', '18', '19', '20',
        '21', AUTOSOME, 'X', 'Y', MITOCHONDRIAL
    ]

    MALE = 'M'
    FEMALE = 'F'
    SEXES = [MALE, FEMALE]

    MOTHER = 'mother'
    FATHER = 'father'
    SELF = 'proband'
    TRIO = [MOTHER, FATHER, SELF]

    # Genotype labels
    GENOTYPE_LABEL_DOT = "Missing"
    GENOTYPE_LABEL_00 = "Homozygous reference"
    GENOTYPE_LABEL_0M = "Heterozygous"
    GENOTYPE_LABEL_MM = "Homozygous alternate"
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
    INHMODE_LABEL_RECESSIVE = "Homozygous recessive"
    INHMODE_LABEL_X_LINKED_RECESSIVE_MOTHER = "X-linked recessive (Maternal)"
    INHMODE_LABEL_X_LINKED_DOMINANT_MOTHER = "X-linked dominant (Maternal)"
    INHMODE_LABEL_X_LINKED_DOMINANT_FATHER = "X-linked dominant (Paternal)"
    INHMODE_LABEL_Y_LINKED = "Y-linked dominant"
    INHMODE_LABEL_LOH = "Loss of Heterozygosity"

    INHMODE_LABEL_SV_DE_NOVO = "Possibly de novo"

    INHMODE_LABEL_NONE_DOT = "Low relevance, missing call(s) in family"
    INHMODE_LABEL_NONE_MN = "Low relevance, multiallelic site family"
    INHMODE_LABEL_NONE_SEX_INCONSISTENT = "Low relevance, mismatching chrXY genotype(s)"
    INHMODE_LABEL_NONE_LOWDEPTH = "Low relevance, low depth"
    INHMODE_LABEL_NONE_HOMOZYGOUS_PARENT = "Low relevance, homozygous in a parent"
    INHMODE_LABEL_NONE_BOTH_PARENTS = "Low relevance, present in both parent(s)"
    INHMODE_LABEL_NONE_OTHER = "Low relevance, other"

    # value related constants
    DE_NOVO_STRONG_CUTOFF = .9
    DE_NOVO_MEDIUM_CUTOFF = .1

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
    def compute_inheritance_mode_trio(
        cls, *, genotypes, genotype_labels, sexes, chrom, novoPP,
        structural_variant=False
    ):
        """ Computes inheritence modes for the trio of 'self', 'mother', 'father'.

        Note: No NovoCaller for SVs, so all SV de novo calls are weak
        and solely based on genotype.

        :param genotypes: dictionary of role -> genotype mappings
        :param genotype_labels: dictionary of role -> genotype_label mappings
        :param sexes: dictionary of role -> sex mappings
        :param chrom: relevant chromosome
        :param novoPP: novoCaller post-posterior probability (likely de novo), takes precedence
        :param structural_variant: boolean True for SVs
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
        if novoPP > cls.DE_NOVO_STRONG_CUTOFF:
            return [cls.INHMODE_LABEL_DE_NOVO_STRONG]

        # De novo medium candidate
        if novoPP > cls.DE_NOVO_MEDIUM_CUTOFF:
            return [cls.INHMODE_LABEL_DE_NOVO_MEDIUM]

        # De novo weak candidate
        if novoPP > 0 and ((cls.mother_father_ref_ref(genotypes[cls.MOTHER], genotypes[cls.FATHER]) and
                genotypes[cls.SELF] == '0/1' and chrom == cls.AUTOSOME)):
            return [cls.INHMODE_LABEL_DE_NOVO_WEAK]

        # And de novo chrXY
        if (cls.mother_father_ref_ref(genotypes[cls.MOTHER], genotypes[cls.FATHER])
                and ((genotypes[cls.SELF] == '0/1' and sexes[cls.SELF] == cls.FEMALE and chrom == 'X')
                     or (genotypes[cls.SELF] == '1/1' and sexes[cls.SELF] == cls.MALE and chrom != cls.AUTOSOME))):
            if novoPP > 0:
                raise ValueError("novoPP is different from 0 or -1 on sex chromosome: %s" % novoPP)
            if novoPP == -1 and not structural_variant:
                return [cls.INHMODE_LABEL_DE_NOVO_CHRXY]

        # SV likely de novo (no novoPP, so based solely on genotypes)
        if (
                structural_variant
                and cls.mother_father_ref_ref(
                    genotypes[cls.MOTHER], genotypes[cls.FATHER]
                )
                and (genotypes[cls.SELF] in ["0/1", "1/1"])
        ):
            return [cls.INHMODE_LABEL_SV_DE_NOVO]
                
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

        if genotypes[cls.MOTHER] == "1/1" or (
                genotypes[cls.FATHER] == "1/1" and genotype_labels[cls.FATHER][0] != cls.GENOTYPE_LABEL_M):
            return [cls.INHMODE_LABEL_NONE_HOMOZYGOUS_PARENT]

        if ((genotypes[cls.MOTHER] == "1/1" or genotypes[cls.MOTHER] == "0/1") and
                (genotypes[cls.FATHER] == "1/1" or genotypes[cls.FATHER] == "0/1")):
            return [cls.INHMODE_LABEL_NONE_BOTH_PARENTS]
        return [cls.INHMODE_LABEL_NONE_OTHER]

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
    def build_genotype_label_structure(genotype_labels, sample_ids):
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
                'labels': labels,
                'sample_id': sample_ids.get(role)
            })
        return structured_labels

    @classmethod
    def compute_inheritance_modes(
        cls, variant_sample, chrom=None, structural_variant=False
    ):
        """ Computes inheritance modes given a variant_sample.
            Intended to perform: variant_sample.update(new_fields) with result of this method.

            Adds the following 2 fields to variant_sample given the complete information:
                1. genotype_labels
                2. inheritance_modes

        Note: Only difference for SVs is in inheritance mode
        calculation. Genotype labels identical to those for SNVs.
        """
        sample_geno = variant_sample.get('samplegeno', [])
        if not sample_geno:
            return {}
        try:
            sample_ids = {s["samplegeno_role"]: s["samplegeno_sampleid"] for s in sample_geno}
            genotypes = {s["samplegeno_role"]: s["samplegeno_numgt"] for s in sample_geno}
            sexes = {s["samplegeno_role"]: s["samplegeno_sex"] for s in sample_geno}
            chrom = chrom if chrom else variant_sample.get('variant', {}).get('CHROM')  # attempt to get from variant
            cmphet = variant_sample.get("cmphet")
            novoPP = variant_sample.get("novoPP", -1)
        except Exception as e:
            log.info('Was not able to extract inheritance modes - the required fields do not exist!'
                      '\n%s\n%s\n%s' % (sample_geno, variant_sample, e))
            return {}

        # exclude mitochondrial variants
        if chrom == cls.MITOCHONDRIAL:
            return {}
        elif chrom not in ['X', 'Y']:
            chrom = cls.AUTOSOME

        if cls.SELF not in genotypes:
            raise InheritanceModeError('Role "proband" not present in genotypes: %s' % genotypes)

        genotype_labels = cls.compute_family_genotype_labels(genotypes, sexes, chrom)
        inheritance_modes = cls.compute_inheritance_mode_trio(
            genotypes=genotypes,
            genotype_labels=genotype_labels,
            sexes=sexes, 
            chrom=chrom, 
            novoPP=novoPP,
            structural_variant=structural_variant,
        )
        inheritance_modes += cls.compute_cmphet_inheritance_modes(cmphet)
        if len(inheritance_modes) == 0:
            inheritance_modes = cls.inheritance_modes_other_labels(genotypes, genotype_labels)

        new_fields = {
            'genotype_labels': cls.build_genotype_label_structure(genotype_labels, sample_ids),
            'inheritance_modes': inheritance_modes
        }

        return new_fields
