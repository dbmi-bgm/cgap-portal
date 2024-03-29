## Ontologies and Connections

Currently the portal uses two formal ontologies as the source for two different item types - Disorders and Phenotypes.

### Disorders

**Disorders** are imported from the Monarch Disease Ontology, **MONDO**.

MONDO aims to harmonize disease definitions across the world as a logic-based structure for unifying multiple [disease resources](https://mondo.monarchinitiative.org/pages/sources/) - including Online Mendelian Interitance in Man (OMIM) and  Orphanet that are focused largely on rare genetic disorders.  Information on the [Monarch Initiative](https://monarchinitiative.org/).

Information about available formats, versions and downloads of the Ontology are available on [GitHub](https://github.com/monarch-initiative/mondo)

**Disorder Items** on the portal contain the following information that is obtained from the ontology file.

* Name of the Disorder
* MONDO identifier for the Disorder
* Disorder definition
* Synonyms
* A URI i.e. link to the ontology term
* Direct Parent Disorders - see below
* Database cross references
* alternative_ids - these refer to Disorder terms that have been obsoleted and for which this Disorder may be a possible suggested replacement for the obsolete term.

Additional Information that can currently be directly associated with Disorder Items include:
* manually curated database cross references
* comments

Associations to other Items such as *Phenotypes* or *Genes* is implemented through an **Evidence** item (see below).


### Phenotypes

**Phenotypes** are imported from the Human Phenotype Ontology, **HPO**.

The Human Phenotype Ontology (HPO) provides a standardized vocabulary of phenotypic abnormalities encountered in human disease.  Information about the [HPO project](https://hpo.jax.org/).

The current versions of the HPO are avalilable [here](https://hpo.jax.org/app/download/ontology).

**Phenotype Items** on the portal contain the following information that is obtained from the ontology file.

* Name of the Phenotype
* HPO identifier for the phenotype
* Phenotype definition
* Synonyms
* A URI i.e. link to the ontology term
* Direct Parent Phenotype - see below
* Database cross references
* suggested replacements - these refer to Phenotype items that have been obsoleted and for which the linked Phenotype may be a possible suggested replacement for the obsolete term.
* category - a higher level Phenotype that categorizes this Phenotype eg. *HP:0003549: Abnormality of connective tissue*


Additional Information that can currently be directly associated with Disorder Items include:
* comments

Associations to other Items such as *Disorders* is implemented through an **Evidence** item (see below).

### Making links between Items based on supporting evidence

Associations between different items such as *Disorders* and *Phenotypes* can be made that include supporting evidence information.

Generally the associations are made using specified inputs and the fields of information about the association may vary depending on which Items are being linked.  Therefore, derivative Evidence Items that have specific fields to capture the information about the associations.  A basic item for an associations has links to the 2 Items being associated - one specified as the subject_item and the other as the object_item.  Many associations may logically fall into the subject-object relationship pattern (although the initial implementations may depend on the datasource), and once a directionality has been established ingestion of new data should follow the same convention, which may require an inversion of the relationship name. and specification of subject_item and object_item different than that used in the source.  The default relationship name is 'associated_with', which does not have a directionality of association.

When items are linked through an Association Item then reverse links are made that allow each of the Items to know about the other.  Then the fields of the association object can be used as filters to only return the relevant associated Items in searches.

**Disorder-Phenotype Associations**

These associations are made by the [HPO project](https://hpo.jax.org/) and provided in a file of [HPOA annotations](https://hpo.jax.org/app/download/annotation).  Currently the predominant sources of the annotations are OMIM, Orphanet and Decipher but other sources and manually curated annotations are being continuously added to the datasource.

The format of the input file is described [here](https://hpo.jax.org/app/help/annotations)

The fields of the linking item for Disorders to Phenotypes include:

* The database ID for the disorder as used in the HPO annotation file - this can be helpful to identify the source of the information i.e. OMIM, Orphanet ...
* Attribution for the source of the annotation eg. a PMID or clinician ID
* Curation history - when and by whom the annotation was created and modified
* A standardized evidence code for the association
  * **IEA - inferred from electronic annotation** eg. associations parsed from the clinical features section of OMIM
  * **PCS - published clinical study** which should have a specific publication identifier referenced in the attribution field or traceable author statement
  * **ICE - individual clinical experience** is appropriate for disorders with limited amount of published data and should be attributed to the person or center making the annotation.
  * **TAS - traceable author statement** is used for associations from reviews or only refers to an original publication
* Aspect that can be one of P (Phenotypic abnormality), I (inheritance), C (onset and clinical course) or M (modifier).
* Additional optional information that can assist in evaluating the association.
  * a term or value with information on frequency of the association
  * information on onset
  * if the association is sex-specific, which sex is affected
  * modifier - a term from the clinical modifier sub-ontology

**Gene-Disorder Associations**

The source of the associations between human Genes and Disorders will be obtained from the [Monarch Initiative](https://monarchinitiative.org/).   The associations available from Monarch that were originally imported from the [OMIM](https://www.omim.org/) datasource will be used to populate the portal's Evidence items for this type of association. The source file that includes this information is `gene_disease.9606.tsv.gz` found in this [directory](https://archive.monarchinitiative.org/latest/tsv/gene_associations/)
