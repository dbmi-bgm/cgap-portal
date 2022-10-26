export const CHROMS = [
  {
    name: "chr1",
    order: 1,
    length: 248956422,
    cumPos: 0,
  },
  {
    name: "chr2",
    order: 2,
    length: 242193529,
    cumPos: 248956422,
  },
  {
    name: "chr3",
    order: 3,
    length: 198295559,
    cumPos: 491149951,
  },
  {
    name: "chr4",
    order: 4,
    length: 190214555,
    cumPos: 689445510,
  },
  {
    name: "chr5",
    order: 5,
    length: 181538259,
    cumPos: 879660065,
  },
  {
    name: "chr6",
    order: 6,
    length: 170805979,
    cumPos: 1061198324,
  },
  {
    name: "chr7",
    order: 7,
    length: 159345973,
    cumPos: 1232004303,
  },
  {
    name: "chr8",
    order: 8,
    length: 145138636,
    cumPos: 1391350276,
  },
  {
    name: "chr9",
    order: 9,
    length: 138394717,
    cumPos: 1536488912,
  },
  {
    name: "chr10",
    order: 10,
    length: 133797422,
    cumPos: 1674883629,
  },
  {
    name: "chr11",
    order: 11,
    length: 135086622,
    cumPos: 1808681051,
  },
  {
    name: "chr12",
    order: 12,
    length: 133275309,
    cumPos: 1943767673,
  },
  {
    name: "chr13",
    order: 13,
    length: 114364328,
    cumPos: 2077042982,
  },
  {
    name: "chr14",
    order: 14,
    length: 107043718,
    cumPos: 2191407310,
  },
  {
    name: "chr15",
    order: 15,
    length: 101991189,
    cumPos: 2298451028,
  },
  {
    name: "chr16",
    order: 16,
    length: 90338345,
    cumPos: 2400442217,
  },
  {
    name: "chr17",
    order: 17,
    length: 83257441,
    cumPos: 2490780562,
  },
  {
    name: "chr18",
    order: 18,
    length: 80373285,
    cumPos: 2574038003,
  },
  {
    name: "chr19",
    order: 19,
    length: 58617616,
    cumPos: 2654411288,
  },
  {
    name: "chr20",
    order: 20,
    length: 64444167,
    cumPos: 2713028904,
  },
  {
    name: "chr21",
    order: 21,
    length: 46709983,
    cumPos: 2777473071,
  },
  {
    name: "chr22",
    order: 22,
    length: 50818468,
    cumPos: 2824183054,
  },
  {
    name: "chrX",
    order: 23,
    length: 156040895,
    cumPos: 2875001522,
  },
  {
    name: "chrY",
    order: 24,
    length: 57227415,
    cumPos: 3031042417,
  },
];

export const chromNameToOrder = (chrName) => {
  const chr = CHROMS.filter((v) => v["name"] === chrName);
  return chr[0]["order"];
};

export const chr2Abs = (chrName, pos) => {
  const chr = CHROMS.filter((v) => v["name"] === chrName);
  return chr[0]["cumPos"] + Math.min(pos, chr[0]["length"]);
};
