## Annotation Browser

The portal features a built-in annotation brower that visualizes the reference sequence, gene transcripts, entries in the ClinVar database, orthologous amino acids and gnomAD allele frequencies around a location of interest (an identified variant). It is based on [HiGlass](https://higlass.io) and allows genome-wide zooming and panning.

The example below shows a 60bp window around the location chr9:110,697,334.

![annotation-browser-zoomed-in](https://user-images.githubusercontent.com/53857412/105904276-ee4fe280-5fee-11eb-9ba3-d14d15354e19.png)

A zoomed-out view spanning three exons of this gene is shown below. The striped, vertical line indicates the original location of interest.

![annotation-browser-zoomed-in png](https://user-images.githubusercontent.com/53857412/105895866-138b2380-5fe4-11eb-9be1-227961b92f28.png)

As shown in the example above, the annotation browser has a top and a bottom view. Both views can be individually panned and zoomed. The top view is a gene annotation track which serves as an overview and shows where in the gene the variant is located. It can also be used to quickly look at neighboring genes. The gray rectangle indicates the extent of the detailed bottom view. The rectangle itself can be panned and resized, which is a convenient way of changing the location and extent of the bottom view.

The bottom view shows several tracks that can assist with the interpretation of variants:

- The sequence track shows the reference sequence (hg38). The nucleotides are only visible when sufficiently zoomed in.
- The transcripts track shows gene transcripts (exons, introns, UTRs) as defined in the GENCODE gene set. When sufficiently zoomed in, the transcribed amino acids are displayed. Hovering over the amino acids shows information about some of its properties.
- The ClinVar track show variants reported in the ClinVar database, together with their clinical significance. Hovering over the data points displays the location, type and ClinVar review status of the variant.
- The orthologous amino acids track shows how conserved a location is accross species. When sufficiently zoomed in, the track displays the protein sequence of each species. Grayed out letters indicate that there is a mismatch between the human and the species sequence. Grayed out dashes show a deletion in the species sequence, orange bars indicate an insertion (hovering over these bars shows the inserted sequence). The data for this track comes from Ensembl. In the case that Ensembl does not contain data for a particluar gene and species, the corresponding row will be gray.
- The gnomAD track displays allele frequencies of variants observed in the gnomAD database on a logarithmic scale. Hovering over the variants displays additional information (type, location, allele count, allele frequency, allele number). This track only shows variants that passed the variant quality filters applied by gnomAD.


## BAM file viewer

The portal includes an efficient, interactive BAM file viewer based on HiGlass. 

![bam-file-viewer](https://user-images.githubusercontent.com/53857412/106038633-2fef9480-60a6-11eb-8383-75409f4fa32e.png)

As in the Annotation Browser, the display contains a gene annotation track that serves as an overview of where we are in genome. The bottom view shows the reference sequence and canonical transcripts at the location of interest. BAM files of multiple family members can be browsed at once. Hovering over reads or the coverage track of a BAM file displays additional information. The color scheme of the BAM file tracks correspond to the color scheme of the reference sequence, so that the variants can be easily classified. The BAM file viewer displays variants, insertions, deletetions and soft/hard clipped reads.