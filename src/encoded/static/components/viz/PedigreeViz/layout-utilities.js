import { getGraphHeight } from './layout-utilities-drawing';
import { getRelationships, isRelationship, numberToRomanNumeral } from './data-utilities';



/** Should already have relationships */
export function assignTreeHeightIndices(objectGraph, filterUnrelatedIndividuals = false){

    const unassignedIDs = new Set(objectGraph.map(function(og){
        return og.id;
    }));
    const visitedRelationships = new Set();
    let maxHeightIndexAssigned = 0;

    function performAssignments(q){
        while (q.length) {
            const individual = q.shift();
            const {
                _parentalRelationship = null,
                _maritalRelationships = [],
                _drawing : { heightIndex },
                id
            } = individual;

            if (!unassignedIDs.has(id)){
                continue;
            }
            unassignedIDs.delete(id);
            //individual._drawing = individual._drawing || {};
            //individual._drawing.heightIndex = heightIndex;

            maxHeightIndexAssigned = Math.max(maxHeightIndexAssigned, heightIndex);

            if (_parentalRelationship && !visitedRelationships.has(_parentalRelationship)){
                visitedRelationships.add(_parentalRelationship);
                _parentalRelationship._drawing = { heightIndex : heightIndex + 1 };
                _parentalRelationship.children.forEach(function(sibling){
                    if (sibling === individual || !unassignedIDs.has(sibling.id)) return;
                    sibling._drawing = { heightIndex }; // Same as that of individual
                    q.push(sibling);
                });
                _parentalRelationship.partners.forEach(function(parent){
                    if (!unassignedIDs.has(parent.id)) return;
                    parent._drawing = { heightIndex: heightIndex + 1 };
                    q.push(parent);
                });
            }

            _maritalRelationships.forEach(function(maritalRelationship){
                if (visitedRelationships.has(maritalRelationship)) return;
                visitedRelationships.add(maritalRelationship);
                maritalRelationship._drawing = { heightIndex }; // Same as that of individual
                maritalRelationship.children.forEach(function(child){
                    if (!unassignedIDs.has(child.id)) return;
                    child._drawing = { heightIndex: heightIndex - 1 };
                    q.push(child);
                });
                maritalRelationship.partners.forEach(function(partner){
                    if (partner === individual || !unassignedIDs.has(partner.id)) return;
                    partner._drawing = { heightIndex };
                    q.push(partner);
                });
            });

        }
    }

    // Assign to individuals starting from proband (1st item in list)
    // Handle any lingering-unattached-to-proband individuals by assigning them 0.
    while (unassignedIDs.size > 0){
        let nextUnassignedIndv;
        for (let i = 0; i < objectGraph.length; i++){
            if (unassignedIDs.has(objectGraph[i].id)){
                nextUnassignedIndv = objectGraph[i];
                break;
            }
        }
        nextUnassignedIndv._drawing = { heightIndex : 0 };
        performAssignments([ nextUnassignedIndv ]);
    }


    // Ensure each relationship is on same height index as lowest heightIndex of partners
    // Then that all children are at that index or lower.

    function moveLower(rel, maxHeightIdx = null, seen = null){
        if (!seen) seen = new Set();
        if (seen.has(rel)) return;
        seen.add(rel);
        if (!maxHeightIdx){
            let smallestHeightIndexOfPartners = Infinity;
            rel.partners.forEach(function(partner){
                smallestHeightIndexOfPartners = Math.min(smallestHeightIndexOfPartners, partner._drawing.heightIndex);
            });
            if (smallestHeightIndexOfPartners < rel._drawing.heightIndex){
                console.log("Moved relationship", rel, rel._drawing.heightIndex, smallestHeightIndexOfPartners);
                rel._drawing.heightIndex = smallestHeightIndexOfPartners;
            }

            maxHeightIdx = rel._drawing.heightIndex;
        } else {
            if (maxHeightIdx < rel._drawing.heightIndex){
                rel._drawing.heightIndex = maxHeightIdx;
            }
        }
        rel.children.forEach(function(child, idx){
            if (child._drawing.heightIndex >= maxHeightIdx){
                child._drawing.heightIndex = maxHeightIdx - 1;
                (child._maritalRelationships || []).forEach(function(mr){
                    moveLower(mr, maxHeightIdx - 1, new Set(seen));
                });
            }
        });

        rel.partners.forEach(function(partner){
            if (partner._parentReferences.length === 0 && partner._maritalRelationships.length === 1) {
                const maxChildHeightIndex = Math.max(...rel.children.map(function(ch){ return ch._drawing.heightIndex; }));
                if (maxChildHeightIndex < maxHeightIdx){
                    partner._drawing.heightIndex = maxHeightIdx;
                }
            }/*else if (partner._maritalRelationships.length > 1){
                (partner._maritalRelationships || []).forEach(function(mr){
                    moveLower(mr, maxHeightIdx - 1, new Set(seen));
                });
            }*/
        });
    }

    const relationships = [...visitedRelationships];
    relationships.forEach(function(rel){
        moveLower(rel);
        /*
        let smallestHeightIndexOfPartners = Infinity;
        rel.partners.forEach(function(partner){
            smallestHeightIndexOfPartners = Math.min(smallestHeightIndexOfPartners, partner._drawing.heightIndex);
        });

        console.log("Moving? relationship",
            rel.partners.map(function(p){ return p.name; }),
            rel.partners.map(function(p){ return p._drawing.heightIndex; }),
            rel.children.map(function(c){ return c.name; }),
            rel.children.map(function(c){ return c._drawing.heightIndex; }),
            rel._drawing.heightIndex //, smallestHeightIndexOfPartners
        );


        if (smallestHeightIndexOfPartners < rel._drawing.heightIndex){
            console.log("Moved relationship", rel, rel._drawing.heightIndex, smallestHeightIndexOfPartners);
            rel._drawing.heightIndex = smallestHeightIndexOfPartners;
        }

        rel.children.forEach(function(child, idx){
            if (child._drawing.heightIndex >= rel._drawing.heightIndex){
                child._drawing.heightIndex = rel._drawing.heightIndex - 1;
            }
        });

        rel.partners.forEach(function(partner){
            if (partner._parentReferences.length === 0 && partner._maritalRelationships.length === 1) {
                const maxChildHeightIndex = Math.max(...rel.children.map(function(ch){ return ch._drawing.heightIndex; }));
                if (maxChildHeightIndex < smallestHeightIndexOfPartners){
                    partner._drawing.heightIndex = smallestHeightIndexOfPartners;
                }
            }
        });
        */
    });

    // while (q.length) {
    //     const { individual, heightIndex } = q.shift();
    //     const { _parentReferences = [], _childReferences = [], id } = individual;
    //     if (visited[id]){
    //         continue;
    //     }
    //     individual._drawing = individual._drawing || {};
    //     individual._drawing.heightIndex = heightIndex;
    //     visited[id] = true;
    //     const parentHeightIndex = heightIndex + 1;
    //     const childHeightIndex = heightIndex - 1;
    //     _childReferences.forEach(function(child, childIndex){
    //         /*
    //         let nextXIndex;
    //         if (parent.gender === 'male'){
    //             nextXIndex = -1;
    //         } else if (parent.gender === 'female'){
    //             nextXIndex = 1;
    //         }
    //         */
    //         q.push({ 'individual': child, 'heightIndex': childHeightIndex });
    //     });
    //     _parentReferences.forEach(function(parent, parentIndex){
    //         /*
    //         let nextXIndex;
    //         if (parent.gender === 'male'){
    //             nextXIndex = -1;
    //         } else if (parent.gender === 'female'){
    //             nextXIndex = 1;
    //         }
    //         */
    //         q.push({ 'individual': parent, 'heightIndex': parentHeightIndex });
    //     });
    //
    // }


    // Shift heightIndices so 0 is smallest.
    let smallestHeightIndex = 0;
    objectGraph.forEach(function(indv){
        smallestHeightIndex = Math.min(smallestHeightIndex, indv._drawing.heightIndex);
    });

    if (smallestHeightIndex !== 0){ // adjust so starts w 0
        const diff = 0 - smallestHeightIndex;
        maxHeightIndexAssigned += diff;
        objectGraph.forEach(function(indv){
            indv._drawing.heightIndex += diff;
        });
        relationships.forEach(function(rel){
            rel._drawing.heightIndex += diff;
        });

        console.log("SMALHEIGHTDIF", smallestHeightIndex, diff, maxHeightIndexAssigned);
    }

    return maxHeightIndexAssigned;
}


/** Individuals with no parents defined */
export function getParentlessIndividuals(objectGraph){
    return objectGraph.filter(function(individual){
        if (!individual.parents || individual.parents.length === 0){
            return true;
        }
        return false;
    }).sort(function(a,b){
        if (a.gender === 'male' && b.gender !== 'male') return -1;
        if (a.gender !== 'male' && b.gender === 'male') return 1;
        return 0;
    });
}

/** Individuals with no children defined */
export function getChildlessIndividuals(objectGraph){
    return objectGraph.filter(function(individual){
        if (!individual.children || individual.children.length === 0){
            return true;
        }
        return false;
    });
}

export function indvListToMap(list){
    const idMap = {};
    list.forEach(function(indv){
        idMap[indv.id] = indv;
    });
    return idMap;
}

/**
 * Must have `_drawing.heightIndex` already.
 * @deprecated
 */
export function getParentlessPartners(objectGraph, memoized = {}){
    const rootlessPartners = {};
    const idMap = (memoized.indvListToMap || indvListToMap)(objectGraph);
    const parentlessIndividuals = (memoized.getParentlessIndividuals || getParentlessIndividuals)(objectGraph);
    parentlessIndividuals.forEach(function(parentlessIndv){
        const { _childReferences, _drawing } = parentlessIndv;
        const otherParentIDSet = _childReferences.reduce(function(allParentIDs, child){
            child._parentReferences.forEach(function(parent){
                if (parent.id !== parentlessIndv.id){
                    allParentIDs.add(parent.id);
                }
            });
            return allParentIDs;
        }, new Set());
        const otherParents = [...otherParentIDSet].map(function(pID){ return idMap[pID]; });
        const otherParentsHeightIndices = otherParents.map(function(oP){ return oP._drawing.heightIndex; });
        for (let i = 0; i < otherParentsHeightIndices.length; i++){
            if (otherParents[i]._drawing.heightIndex !== _drawing.heightIndex){
                return; // continue/skip for ordering purposes
            }
        }

        otherParents.forEach(function(oP){
            const { _parentReferences } = oP;
            if (_parentReferences.length > 0){
                rootlessPartners[oP.id] = rootlessPartners[oP.id] || [];
                rootlessPartners[oP.id].push(parentlessIndv);
            }
        });

    });
    // TODO: ensure it works
    return rootlessPartners;
}

export function getChildlessSiblings(leafIndividuals){
    const leafSiblings = {};
    const seen = {};
    leafIndividuals.forEach(function(indv){
        const { id, _parentalRelationship = null } = indv;
        if (seen[id]) return;
        if (_parentalRelationship && _parentalRelationship.children.length >= 2){
            leafSiblings[id] = [];
            _parentalRelationship.children.forEach(function(sibling){
                if (sibling.id === id || sibling._maritalRelationships.length > 0) return;
                leafSiblings[id].push(sibling);
                seen[sibling.id] = true;
            });
        }
    });
    return leafSiblings;
}


export function permutateArray(arr, from = 0, permutations = []){
    const len = arr.length;
    if (from === len - 1) {
        permutations.push(arr.slice(0));
        return permutations;
    }

    for (let i = from; i < len; i++) {
        // Swap
        let temp = arr[i];
        arr[i] = arr[from];
        arr[from] = temp;
        // Recurse
        permutateArray(arr, from + 1, permutations);
        // Reverse
        temp = arr[i];
        arr[i] = arr[from];
        arr[from] = temp;
    }

    return permutations;
}

export function flattenBuckets(arr){
    return arr.reduce(function(retList, itemOrList, idx){
        if (Array.isArray(itemOrList)){
            return retList.concat(itemOrList);
        }
        retList.push(itemOrList);
        return retList;
    }, []);
}

export function permutate2DArray1Dimension(arr){
    return permutateArray(arr).map(flattenBuckets);
}

export function computePossibleParentlessPermutations(objectGraph, skip={}){
    const parentlessIndividuals = getParentlessIndividuals(objectGraph);
    const seen = {};
    const buckets = [];
    console.log("PARENTLESSINDVDS", parentlessIndividuals);
    parentlessIndividuals.forEach(function(indv){
        if (seen[indv.id] || skip[indv.id]) return;
        const nextBucket = [];
        nextBucket.push(indv);
        seen[indv.id] = true;

        // grouping: place parents which are only connected to the same relationship in the same bucket
        if (indv._maritalRelationships.length === 1 && !seen[indv._maritalRelationships[0].id] && !skip[indv._maritalRelationships[0].id]){
            const otherPartners = indv._maritalRelationships[0].partners.filter(function(partner){
                return partner.id !== indv.id && partner._parentReferences.length === 0 && partner._maritalRelationships.length === 1;
            });
            if (otherPartners.length + 1 === indv._maritalRelationships[0].partners.length){
                nextBucket.push(indv._maritalRelationships[0]);
                seen[indv._maritalRelationships.id] = true;
                otherPartners.forEach(function(oP){
                    if (!seen[oP.id]){
                        if (oP._parentReferences.length === 0 && oP._maritalRelationships.length === 1){
                            nextBucket.push(oP);
                            seen[oP.id] = true;
                        }
                    }
                });
            }
        }

        buckets.push(nextBucket);
    });

    console.log("ROOTBUCKETS", buckets);

    return permutate2DArray1Dimension(buckets);
}



export function computePossibleChildlessPermutations(objectGraph, skip={}){
    const leafIndividuals = getChildlessIndividuals(objectGraph);
    const leafSiblingsObj = getChildlessSiblings(leafIndividuals);
    const idMap = indvListToMap(objectGraph);
    const seen = {};
    const buckets = [];


    Object.keys(leafSiblingsObj).forEach(function(leafIndvID){
        const siblings = leafSiblingsObj[leafIndvID];
        const bucket = [ idMap[leafIndvID], ...siblings ];
        buckets.push(bucket);
        bucket.forEach(function(indv){
            seen[indv.id] = true;
        });
    });

    leafIndividuals.forEach(function(indv){
        if (seen[indv.id] || skip[indv.id]) return;
        buckets.push([indv]);
    });

    console.log("LEAF BUCKETS", buckets);

    return permutate2DArray1Dimension(buckets);
}


export function getMaxHeightIndex(objectGraph){
    return objectGraph.reduce(function(currMax, individual){
        if (individual._drawing.heightIndex > currMax){
            return individual._drawing.heightIndex;
        }
        return currMax;
    }, -1);
}



/** NOT USED **/
function initOrderingSimple(objectGraph, memoized = {}){

    const q = [objectGraph[0]];

    const orderByHeightIndex = []; // 2D arr
    const maxHeightIndex = (memoized.getMaxHeightIndex || getMaxHeightIndex)(objectGraph);
    for (let i = 0; i <= maxHeightIndex; i++){
        orderByHeightIndex[i] = [];
    }

    function addToQ(indv){
        q.unshift(indv);
    }

    const orderAssignedDebugList = [];

    function assignOrder(node){
        const { id, _drawing : { heightIndex } } = node;
        const orderAssignedInIndex = orderByHeightIndex[heightIndex].length;
        seenOrderInIndex[id] = orderAssignedInIndex;
        orderByHeightIndex[heightIndex].push(node);
        orderAssignedDebugList.push({ 'id': node.id, 'h' : heightIndex, 'o' : orderAssignedInIndex });
        //console.log("DIRECT", direction, stack, id, heightIndex, orderAssignedInIndex, q.map(function(item){ return item.id; }));
    }

    const seenOrderInIndex = {};
    const seenIndvs = [];
    // eslint-disable-next-line no-constant-condition
    while (true){
        while (q.length){
            const node = q.pop();
            const {
                id,
                _drawing : { heightIndex },
                _maritalRelationships = [],
                _parentalRelationship = null,
                children = [],
                partners = []
            } = node;

            if (typeof seenOrderInIndex[id] !== "undefined") continue;

            assignOrder(node);

            if (isRelationship(node)){
                //(partners || []).forEach(addToQ);
                //(children || []).forEach(addToQ);
            } else {
                seenIndvs.push(node);

                (_maritalRelationships || []).forEach(function(mr){
                    const { children: mrChildren } = mr;
                    addToQ(mr);
                    mrChildren.forEach(addToQ);
                });

                const { id: parentID, partners: parentPartners = [] } = _parentalRelationship || {};
                if (parentPartners.length > 0){
                    addToQ(parentPartners[0]);
                }
                if (parentID){
                    addToQ(_parentalRelationship);
                }
                if (parentPartners.length > 1){
                    parentPartners.slice(1).forEach(addToQ);
                }
            }
        }
        if (seenIndvs.length === objectGraph.length){
            break;
        } else {
            // Have Individuals not connected to proband
            console.error("Unconnected individuals found", seenOrderInIndex, objectGraph);
            for (let i = 0; i < objectGraph.length; i++){
                if (typeof seenOrderInIndex[objectGraph[i].id] === 'undefined'){
                    q.push(objectGraph[i]);
                    break;
                }
            }
        }
    }

    console.log("ORDER ASSIGNMENTS", orderAssignedDebugList);

    return { orderByHeightIndex, seenOrderInIndex };
}

/** NOT USED **/
function divideIntoBuckets(rowOfNodes = []){
    const buckets = [];
    const seenIDs = {};
    let heightIndex = null;

    function isParentlessWithOneRelationship(partner){
        const sameIndex = partner._drawing.heightIndex === heightIndex;
        const noParents = (partner._parentReferences || []).length === 0;
        const singleRelationship = partner._maritalRelationships.length === 1;
        return sameIndex && noParents && singleRelationship;
    }

    rowOfNodes.forEach(function(node){
        const {
            id,
            _drawing : { heightIndex: hi },
            partners,
            children,
            _maritalRelationships = [],
            _parentalRelationship = null,
            _parentReferences = []
        } = node;
        if (seenIDs[id]) return;
        seenIDs[id] = true;
        if (heightIndex === null){
            heightIndex = hi;
        }
        const currBucket = [node];
        if (isRelationship(node)){
            // Group partner with relationship node if same heightIndex and no other relationships on partner
            const parentlessSinglePartners = (partners || []).filter(isParentlessWithOneRelationship);
            parentlessSinglePartners.forEach(function(partner, i){
                if (i === 0){
                    currBucket.unshift(partner);
                } else {
                    currBucket.push(partner);
                }
                seenIDs[partner.id] = true;
            });
        } else {
            // Group partner with relationship node if same heightIndex and no other relationships on partner
            if (_maritalRelationships.length === 1 && _parentReferences.length === 0 && _maritalRelationships[0]._drawing.heightIndex === heightIndex){
                currBucket.push(_maritalRelationships[0]);
                seenIDs[_maritalRelationships[0].id] = true;
                const parentlessSinglePartners = (_maritalRelationships[0].partners || []).filter(isParentlessWithOneRelationship);
                parentlessSinglePartners.forEach(function(partner, i){
                    if (partner.id === id) return; // Is self, skip
                    currBucket.push(partner);
                    seenIDs[partner.id] = true;
                });
            }
            // Group siblings w.o. relationships
            if (_parentalRelationship && _maritalRelationships.length === 0){
                const relationlessSiblings = (_parentalRelationship.children || []).filter(function(child){
                    if (child.id === id) return false; // Is self, skip
                    if (child._drawing.heightIndex === heightIndex && (child._maritalRelationships || []).length === 0){
                        return true;
                    }
                    return false;
                });
                relationlessSiblings.forEach(function(child){
                    currBucket.push(child);
                    seenIDs[child.id] = true;
                });
            }
        }
        buckets.push(currBucket);
    });
    console.log('BUCKETS', buckets);
    return buckets;
}

/** NOT USED - TOO UNPERFORMANT - O(n!) **/
function createOrderingPermutations(order, memoized = {}){
    const { orderByHeightIndex } = order;
    const orderByHeightIndexPermutations = orderByHeightIndex.map(function(nodesInrow, heightIndex){
        return permutate2DArray1Dimension(divideIntoBuckets(nodesInrow));
    });
    const orderingPermutations = [];
    const totalCountPermutations = orderByHeightIndexPermutations.reduce(function(m, permutationsOfRow){
        return m * permutationsOfRow.length;
    }, 1);

    const counters = orderByHeightIndexPermutations.map(function(){
        return 0;
    });

    function incrementCounters(){
        let currHeightIndex = counters.length - 1;
        while (currHeightIndex >= 0){
            counters[currHeightIndex]++;
            if (counters[currHeightIndex] >= orderByHeightIndexPermutations[currHeightIndex].length){
                counters[currHeightIndex] = 0;
                currHeightIndex--;
            } else {
                break;
            }
        }
    }

    var i, hi;
    for (i = 0; i < totalCountPermutations; i++){
        const orderingPermutation = orderByHeightIndexPermutations.map(function(){ return []; });
        for (hi = 0; hi < orderByHeightIndexPermutations.length; hi++){
            orderingPermutation[hi] = orderByHeightIndexPermutations[hi][counters[hi]];
        }
        orderingPermutations.push(orderingPermutation);
        incrementCounters();
    }

    return orderingPermutations.map(function(orderByHeightIndex2){
        const seenOrderInIndex = {};
        orderByHeightIndex2.forEach(function(rowOfNodes){
            rowOfNodes.forEach(function(node, orderPos){
                seenOrderInIndex[node.id] = orderPos;
            });
        });
        return {
            orderByHeightIndex: orderByHeightIndex2,
            seenOrderInIndex
        };
    });
}



function initOrdering(objectGraph, startIndividuals = null, direction = "children", stack = false, memoized = {}){
    const q = startIndividuals.slice(0);
    if (!stack){
        q.reverse();
    }

    const orderByHeightIndex = []; // 2D
    const maxHeightIndex = (memoized.getMaxHeightIndex || getMaxHeightIndex)(objectGraph);
    for (let i = 0; i <= maxHeightIndex; i++){
        orderByHeightIndex[i] = [];
    }

    function addToQ(indv){
        if (stack){
            q.push(indv);
        } else {
            q.unshift(indv);
        }
    }

    function countAncestors(indvNode){
        const seenA = {};
        const aQ = [indvNode];
        let count = 0;
        while (aQ.length){
            const currA = aQ.pop();
            if (seenA[currA.id]) continue;
            if (currA._parentalRelationship){
                currA._parentalRelationship.partners.forEach(function(p){
                    aQ.unshift(p);
                });
            }
            count++;
        }
        return count;
    }

    function sortByAncestorCount(a,b){
        const count = countAncestors(b) - countAncestors(a);
        if (count !== 0) return count;
        if (a.gender === 'male') return -1;
        if (b.gender === 'male') return 1;
        return 0;
    }

    function countDescendants(indvNode){
        const seenD = {};
        const dQ = [indvNode];
        let count = 0;
        while (dQ.length){
            const currD = dQ.pop();
            if (seenD[currD.id]) continue;
            (currD._maritalRelationships || []).forEach(function(mr){
                (mr.children || []).forEach(function(child){
                    dQ.unshift(child);
                });
            });
            count++;
        }
        return count;
    }

    function sortByDescendantCount(a,b){
        return countDescendants(b) - countDescendants(a);
    }

    const orderAssignedDebugList = [];

    function assignOrder(node){
        const { id, _drawing : { heightIndex } } = node;
        const orderAssignedInIndex = orderByHeightIndex[heightIndex].length;
        seenOrderInIndex[id] = orderAssignedInIndex;
        orderByHeightIndex[heightIndex].push(node);
        orderAssignedDebugList.push({ 'id': node.name || node.id, 'h' : heightIndex, 'o' : orderAssignedInIndex });
        //console.log("DIRECT", direction, stack, id, heightIndex, orderAssignedInIndex, q.map(function(item){ return item.id; }));
    }

    const seenOrderInIndex = {};
    const seenIndvs = [];
    // eslint-disable-next-line no-constant-condition
    while (true){
        while (q.length){
            const node = q.pop();
            const {
                id,
                _drawing : { heightIndex },
                _maritalRelationships = [],
                _parentalRelationship = null,
                children = [],
                partners = []
            } = node;

            if (typeof seenOrderInIndex[id] !== "undefined") continue;

            assignOrder(node);

            if (isRelationship(node)){
                if (direction === "parents" && partners){
                    partners.sort(sortByAncestorCount).sort(sortPartnersByGender).forEach(addToQ);
                } else if (direction === "children" && children){
                    children.sort(sortByDescendantCount).forEach(addToQ);
                }
            } else {
                seenIndvs.push(node);
                if (direction === "parents" && _parentalRelationship){
                    const [ firstParentPartner, ...otherParentPartners ] = (_parentalRelationship.partners || [])
                        .sort(sortByAncestorCount)
                        .sort(sortPartnersByGender);
                    if (firstParentPartner){
                        addToQ(firstParentPartner);
                    }
                    addToQ(_parentalRelationship);
                    otherParentPartners.forEach(addToQ);

                } else if (direction === "children" && _maritalRelationships){
                    _maritalRelationships.forEach(addToQ);
                }
            }

        }
        if (seenIndvs.length === objectGraph.length){
            break;
        } else {
            // Have Individuals not connected to proband
            console.error("Unconnected individuals found", seenOrderInIndex, objectGraph);
            for (let i = 0; i < objectGraph.length; i++){
                if (typeof seenOrderInIndex[objectGraph[i].id] === 'undefined'){
                    q.push(objectGraph[i]);
                    break;
                }
            }
        }
    }

    //console.log("ORDER ASSIGNMENTS", direction, stack, orderAssignedDebugList, startIndividuals);

    return { orderByHeightIndex, seenOrderInIndex };
}


function countNodesInBetween(order, fromNode, toNode){
    const { orderByHeightIndex, seenOrderInIndex } = order;
    const { _drawing : { heightIndex } } = fromNode;
    const orderFrom = seenOrderInIndex[fromNode.id];
    const orderTo = seenOrderInIndex[toNode.id];
    let num = 0;
    const begin = Math.min(orderFrom, orderTo) + 1;
    const end = Math.max(orderFrom, orderTo) - 1;
    console.log("XXX", begin, end, orderTo, orderFrom);
    for (let ord = begin; ord <= end; ord++){
        const node = orderByHeightIndex[heightIndex][ord];
        //console.log('IN BETWEEN', node);
        num += 2; // A node in between - count 3x
        if (isRelationship(node)){
            //if (node.partners.indexOf(fromNode) > -1 || node.partners.indexOf(toNode) > -1){
            //    continue;
            //}
            node.partners.forEach(function(partner){
                if (partner === toNode || partner === fromNode) return;
                if (partner._drawing.heightIndex !== heightIndex){
                    // Line going up - count add'l intersection
                    num++;
                    return;
                }
                const partnerOrder = seenOrderInIndex[partner.id];
                if (partnerOrder === orderFrom || partnerOrder === orderTo){
                    return; // Is self
                }
                if (partnerOrder < (begin - 1) || partnerOrder > (end + 1)){
                    num += 2;
                } else {
                    num++;
                }
            });
            continue;
        }
        //num += (node._maritalRelationships || []).length;
        if (node._parentalRelationship){
            if (node._parentalRelationship.children.indexOf(fromNode) > -1 || node._parentalRelationship.children.indexOf(toNode) > -1){
                continue;
            }
            num++;
            const parentOrder = seenOrderInIndex[node._parentalRelationship.id];
            if (parentOrder >= (begin - 1) || parentOrder <= (end + 1)){
                num++;
                continue;
            }
        }
    }

    //if (fromNode.id === "/individuals/GAPIDYEKPPCK/" || toNode.id === "/individuals/GAPIDYEKPPCK/"){
    //    console.log(fromNode, toNode, begin, end, num, orderByHeightIndex[heightIndex]);
    //}

    return num;
}

function countEdgeCrossingInstance(order, fromNode, toNode){
    const { orderByHeightIndex, seenOrderInIndex } = order;
    const orderFrom = seenOrderInIndex[fromNode.id];
    const orderTo = seenOrderInIndex[toNode.id];
    if (typeof orderFrom !== "number" || typeof orderTo !== "number") {
        console.warn(`No order set for either ${fromNode.id} or ${toNode.id}, counting as 0 crossings.`);
        return 0;
    }
    const orderLow = Math.min(orderFrom, orderTo);
    const orderHigh = Math.max(orderFrom, orderTo);
    const hiFrom = fromNode._drawing.heightIndex;
    const hiTo = toNode._drawing.heightIndex;

    let crossings = 0;

    if (hiFrom === hiTo){
        //crossings += (Math.abs(orderFrom - orderTo) - 1) * 2;
        crossings += countNodesInBetween(order, fromNode, toNode);
        return crossings;
    }

    function checkAndCount(node){
        if (fromNode === node || node === toNode) return;
        crossings++;
        if (seenOrderInIndex[node.id] < orderHigh && seenOrderInIndex[node.id] > orderLow){
            crossings++;
        }
    }

    const subsequentSiblingsInIndex = orderByHeightIndex[hiFrom].slice(orderLow + 1, orderHigh + 1);
    subsequentSiblingsInIndex.forEach(function(siblingInIndex){
        const { id, partners, children, _maritalRelationships, _parentalRelationship } = siblingInIndex;
        if (isRelationship(siblingInIndex)) {
            //if (partners.indexOf(fromNode) === -1){
            //    crossings++;
            //}
            if (hiTo < hiFrom){
                children.forEach(function(child){
                    if (fromNode === child || child === toNode) return;
                    crossings++;
                    if (seenOrderInIndex[node.id] < orderHigh && seenOrderInIndex[node.id] > orderLow){
                        crossings++;
                    }
                });
            }
        } else {
            if (hiTo > hiFrom){
                if (_parentalRelationship){
                    if (_parentalRelationship !== toNode && _parentalRelationship !== fromNode){
                        crossings += 2;
                    }
                    if (seenOrderInIndex[_parentalRelationship.id] < orderHigh && seenOrderInIndex[_parentalRelationship.id] > orderLow){
                        crossings++;
                    }
                }
            }
        }
    });

    return crossings;
}

function countEdgeCrossings(order){
    const { orderByHeightIndex, seenOrderInIndex } = order;
    let crossings = 0;

    const seenFrom = {};

    orderByHeightIndex.forEach(function(nodesInRow, hi){ // going up
        nodesInRow.forEach(function(node, indexInRow){ // left to right
            const { id, partners, children, _maritalRelationships, _parentalRelationship } = node;
            //if (!seenFrom[id]) seenFrom[id] = new Set();
            if (isRelationship(node)) {
                if (indexInRow === 0) {
                    crossings += 10;
                }
                partners.forEach(function(indv){
                    //if (seenFrom[indv.id] && seenFrom[indv.id].has(id)) {
                    //    return;
                    //}
                    crossings += countEdgeCrossingInstance(order, node, indv);
                    //seenFrom[id].add(indv.id);
                });
                /*
                children.forEach(function(indv){
                    if (seenFrom[indv.id] && seenFrom[indv.id].has(id)) {
                        return;
                    }
                    crossings += countEdgeCrossingInstance(order, node, indv);
                    seenFrom[id].add(indv.id);
                });
                */
            } else {
                /*
                _maritalRelationships.forEach(function(mr){
                    if (seenFrom[mr.id] && seenFrom[mr.id].has(id)) {
                        return;
                    }
                    crossings += countEdgeCrossingInstance(order, node, mr);
                    seenFrom[id].add(mr.id);
                });
                */
                if (_parentalRelationship && (!seenFrom[_parentalRelationship.id] || !seenFrom[_parentalRelationship.id].has(id))){
                    crossings += countEdgeCrossingInstance(order, node, _parentalRelationship);
                    //seenFrom[id].add(_parentalRelationship.id);
                    //(_parentalRelationship.children || []).forEach(function(sibling){
                    //    crossings += countEdgeCrossingInstance(order, node, sibling);
                    //});
                }
            }
        });
    });

    return crossings;
}




function buildAncestralPositions(spansByHeightIndex, q, seenDirectInRelation = {}, auxRelationsToConnect = {}){
    const posByHeightIndex = [];
    const positionedIndividuals = [];
    const positionedRelationships = [];
    const qAuxRelationships = [];

    // Create initial family tree heuristically off of proband without taking into account indirect relationships
    // eslint-disable-next-line no-constant-condition
    while (true) {
        const [ currNode, horizPos, prevHorizPos ] = q.shift() || [];
        if (typeof currNode === "undefined") {
            break;
        }
        const {
            id,
            _drawing : { heightIndex },
            // Present on individual nodes:
            _maritalRelationships = [],
            _parentalRelationship = null,
            // Present on relationship nodes:
            children = [],
            partners = null
        } = currNode;
        if (seenDirectInRelation[id]) {
            continue;
        }
        if (typeof posByHeightIndex[heightIndex] === "undefined") {
            posByHeightIndex[heightIndex] = {};
        }
        // If individual, add parent relationship to q & continue.
        // Skip queuing external marital relationships for now.
        if (!Array.isArray(partners)) {

            if (_parentalRelationship && !seenDirectInRelation[_parentalRelationship.id]) {
                q.push([ _parentalRelationship, horizPos, prevHorizPos ]);
                // const { id: prID, _drawing : { heightIndex: prHI } } = _parentalRelationship;
                // posByHeightIndex[prHI] = { [prID]: horizPos };
            } else {
                // Skip unless parent relationship has been assigned and we are adding its children _or_ has no parent -
                seenDirectInRelation[id] = true;
                positionedIndividuals.push(currNode);
                posByHeightIndex[heightIndex][id] = horizPos;

                if (Array.isArray(_maritalRelationships)) {
                    // Added to secondary 'qAuxRelationships' queue - where horizPos will be treated differently.
                    _maritalRelationships.forEach(function(relationship){
                        if (!seenDirectInRelation[relationship.id]) {
                            qAuxRelationships.push([
                                relationship,
                                currNode,
                                horizPos,
                                prevHorizPos
                            ]);
                        }
                    });
                }

            }
            continue;
        }

        // Else if relationship:
        seenDirectInRelation[id] = true;
        positionedRelationships.push(currNode);
        posByHeightIndex[heightIndex][id] = horizPos;

        // Add M + F heuristically. We use sort fxn in case 3+ ppl in relationship for some reason.
        const orderedPartners = partners.slice().sort(sortPartnersByGender);

        // If we are connecting at this relationship to a parent subtree,
        // we don't care as much about ordering the relationship partners,
        // so sort them by how close they are to target/previous partner in
        // parent subtree instead.
        if (typeof auxRelationsToConnect[id] !== "undefined") {
            console.log("CONNECT!", auxRelationsToConnect[id], auxRelationsToConnect[id][0] === currNode, currNode);
            const [ , positionedPartnerNode, partnerNodeHorizPos, prevRelationshipHorizPos ] = auxRelationsToConnect[id];
            const toRight = prevRelationshipHorizPos < partnerNodeHorizPos ? 1 : -1;
            orderedPartners.sort(function(a,b){
                if (positionedPartnerNode === a) {
                    return -toRight;
                }
                if (positionedPartnerNode === b) {
                    return toRight;
                }
                return 0;
            });
            delete auxRelationsToConnect[id]; // not really necessary
        }

        orderedPartners.forEach(function(p, i){
            q.push([
                p,
                i === 0 ? (horizPos - spansByHeightIndex[heightIndex]) : (horizPos + (spansByHeightIndex[heightIndex] * i)),
                horizPos
            ]);
        });

        const orderedChildrenByAge = children.slice()
            .sort(function(a,b){

                if (typeof a.age === "number" && typeof b.age === "number" && a.age !== b.age) {
                    return sortChildrenByAge(a,b);
                }

                // Sort by distance to already-drawn marital partners first.
                // This is used as fallback in case ages aren't present or something to reduce line distances.
                let aDist = Infinity;
                let bDist = Infinity;
                let aMarPos = null;
                let bMarPos = null;
                var i;
                for (i = 0; i < (a._maritalRelationships || []).length; i++) {
                    if (typeof posByHeightIndex[a._maritalRelationships[i]._drawing.heightIndex][a._maritalRelationships[i].id] === "number") {
                        aMarPos = posByHeightIndex[a._maritalRelationships[i]._drawing.heightIndex][a._maritalRelationships[i].id];
                        aDist = aMarPos - horizPos;
                        break;
                    }
                }
                for (i = 0; i < (b._maritalRelationships || []).length; i++) {
                    if (typeof posByHeightIndex[b._maritalRelationships[i]._drawing.heightIndex][b._maritalRelationships[i].id] === "number") {
                        bMarPos = posByHeightIndex[b._maritalRelationships[i]._drawing.heightIndex][b._maritalRelationships[i].id];
                        bDist = bMarPos - horizPos;
                        break;
                    }
                }
                console.log('sorty', a.id, b.id, aMarPos, bMarPos, aDist, bDist);
                if (aDist === bDist){
                    // Most likely Infinity for both, default to age in case one does not have it defined (else is 0).
                    return sortChildrenByAge(a,b);
                    //return 0;
                }
                if (aDist < bDist) {
                    if (aMarPos > horizPos) {
                        return 1;
                    } else {
                        return -1;
                    }
                } else {
                    if (bMarPos > horizPos) {
                        return -1;
                    } else {
                        return 1;
                    }
                }
            });

        let incr = 0;
        const incrIncr = Math.floor((spansByHeightIndex[heightIndex] / 2) / orderedChildrenByAge.length) - 1;
        orderedChildrenByAge.forEach(function(c){
            q.push([ c, horizPos + incr, prevHorizPos ]);
            incr += incrIncr; // previously 4
        });

    }

    return {
        posByHeightIndex,
        positionedIndividuals,
        positionedRelationships,
        qAuxRelationships,
        seenDirectInRelation
    };
}

function collectTerminalChildrenFromRelationship(relationshipNode){
    let allChildren = [];
    const { children: rChildren = [] } = relationshipNode || {};
    rChildren.forEach(function(childNode){
        if (childNode._maritalRelationships.length === 0) {
            allChildren.push(childNode);
            return;
        }
        childNode._maritalRelationships.map(collectTerminalChildrenFromRelationship).forEach(function(childCollection){
            allChildren = allChildren.concat(childCollection);
        });
    });
    return allChildren;
}


export function orderObjectGraph(objectGraph, relationships = null, maxHeightIndex = null) {

    //return orderObjectGraph2(...arguments);

    // = 128 as last elem in arr (maxHeightIndex)
    // then quadruple to front until first elem/index (0)
    const spansByHeightIndex = [ 128 ];
    for (let i = maxHeightIndex - 1; i >= 0; i--){
        spansByHeightIndex.unshift(spansByHeightIndex[0] * 4);
    }

    /* Get boundary in defined direction of tree positions */
    function getMaxPos(posByHI, dir = 1) {
        let maxV = 0;
        posByHI.forEach(function(posMap){
            Object.keys(posMap).forEach(function(k){
                if (dir === 1) {
                    maxV = Math.max(maxV, posMap[k]);
                } else {
                    maxV = Math.min(maxV, posMap[k]);
                }
            });
        });
        return maxV;
    }

    const {
        posByHeightIndex,
        positionedIndividuals,
        positionedRelationships,
        seenDirectInRelation,
        qAuxRelationships,
    } = buildAncestralPositions(
        spansByHeightIndex,
        [  [ objectGraph[0], 0, 0 ]  ] // Assume first node/indv in objectGraph is the proband.
    );

    const graphSize = objectGraph.length;
    const allSeen = { ...seenDirectInRelation };
    const subtrees = [];
    const auxRelationsToMakeSubtreesFor = {}; // We delete from this once connected-to, as a sort of unordered queue.
    qAuxRelationships.forEach(function(qARItem){
        auxRelationsToMakeSubtreesFor[qARItem[0].id] = qARItem;
    });

    const skippedAuxRelationships = new Set();

    // eslint-disable-next-line no-constant-condition
    while (true){

        // Order creation of subtrees by auxiliary relations to facilitate connecting (~BFS)
        // back subtrees to parent subtree in order in case multiple layers of auxiliary relations/subtrees
        let nextAuxRelationship = qAuxRelationships.find(function([ rNode ]){
            return !!(auxRelationsToMakeSubtreesFor[rNode.id]);
        }) || null;

        if (nextAuxRelationship === null) {
            for (let i = 0; i < subtrees.length; i++) {
                nextAuxRelationship = subtrees[i].qAuxRelationships.find(function([ rNode ]){
                    return !!(auxRelationsToMakeSubtreesFor[rNode.id] && !skippedAuxRelationships.has(rNode));
                }) || null;
                if (nextAuxRelationship !== null) {
                    break;
                }
            }
        }

        let nextChildrenSet;
        let nextChildrenSetCount;
        if (nextAuxRelationship === null) {
            const positionedIndvCount = positionedIndividuals.length + subtrees.reduce(function(m,s){ return m + s.positionedIndividuals.length; }, 0);
            const positionedRelCount = positionedRelationships.length + subtrees.reduce(function(m,s){ return m + s.positionedRelationships.length; }, 0);
            console.info("No more auxiliary relationships remaining.");
            console.log("Total individual count vs positioned individual count:", graphSize, positionedIndvCount);
            console.log("Total relationship count vs positioned relationship count:", relationships.length, positionedRelCount);

            if (positionedIndvCount === graphSize) {
                break; // Exit while loop,  handle remaining aux (intra-family) relationships later
            }

            console.info("Positioning remaining individuals...");
            nextChildrenSet = objectGraph;
            nextChildrenSetCount = graphSize;
        } else {
            nextChildrenSet = collectTerminalChildrenFromRelationship(nextAuxRelationship[0]);
            nextChildrenSetCount = nextChildrenSet.length;
            if (nextChildrenSetCount === 0) {
                // Will be excluded for now at least.
                console.error("Could not find any children for relationship, check source data", nextAuxRelationship);
                skippedAuxRelationships.add(nextAuxRelationship[0]);
                continue;
            }
        }

        console.log('AAA', nextAuxRelationship, nextChildrenSet);

        let nodeAtLowestHI = null;
        for (let i = 0; i < nextChildrenSetCount; i++) {
            if (allSeen[nextChildrenSet[i].id]) {
                continue;
            }
            if (nodeAtLowestHI === null) {
                nodeAtLowestHI = nextChildrenSet[i];
            } else if (nextChildrenSet[i]._drawing.heightIndex < nodeAtLowestHI._drawing.heightIndex) {
                nodeAtLowestHI = nextChildrenSet[i];
            }
        }

        if (nodeAtLowestHI === null) {
            console.warn("Could not find any more unpositioned children for relationship, likely tree has been created and this is secondary relation", nextAuxRelationship);
            skippedAuxRelationships.add(nextAuxRelationship[0]);
            continue;
        }

        const subtree = buildAncestralPositions(
            spansByHeightIndex,
            [   [  nodeAtLowestHI, 0, 0  ]   ],
            allSeen,
            auxRelationsToMakeSubtreesFor
        );
        subtree.qAuxRelationships.forEach(function(qARItem){
            // Append subtree object to this.
            // If present, we will add to its subtree.posByHeightIndex rather than primary one.
            qARItem = [ ...qARItem, subtree ];
            auxRelationsToMakeSubtreesFor[qARItem[0].id] = qARItem;
        });
        subtrees.push(subtree);
    }

    const subtreeStack = [ ...subtrees ];
    const nodePositionScaleDiviser = spansByHeightIndex[0] * 2; // TODO: reconsider this diviser
    const partnerNodeRelations = {}; // Sometimes same node has multiple aux relations, keep track to offset them; maybe need to group siblings later idk.

    [{  // Simulate primary tree as subtree to allow final iteration/merge into primary `posByHeightIndex`.
        posByHeightIndex,
        positionedIndividuals,
        positionedRelationships,
        qAuxRelationships
    }].concat(subtrees).reverse().forEach(function(treeWithAuxRelations, i, allSubTreesReversed){
        treeWithAuxRelations.qAuxRelationships.forEach(function(relQItem){
            const [ relationshipNode, positionedPartnerNode, partnerNodeHorizPos, prevRelationshipHorizPos ] = relQItem;
            const currIdxInStack = subtrees.length - i;
            const subtreesCreatedAfterThisRelationship = subtreeStack.slice(currIdxInStack);
            const subtreeAtRelationIdx = currIdxInStack + subtreesCreatedAfterThisRelationship.findIndex(function(subtree){
                return subtree.positionedRelationships.indexOf(relationshipNode) > -1;
            });

            if (subtreeAtRelationIdx < 0 || typeof subtreeAtRelationIdx !== "number" || isNaN(subtreeAtRelationIdx)) {
                throw new Error("Could not find subtree for auxiliary relation");
            }
            const { _drawing : { heightIndex: relationshipHeightIndex } } = relationshipNode;
            const { id: ppID, _drawing: { heightIndex: ppHeightIndex } } = positionedPartnerNode;

            const subtreeAtRelation = subtreeStack[subtreeAtRelationIdx];
            subtreeStack.splice(subtreeAtRelationIdx, 1);


            partnerNodeRelations[ppID] = partnerNodeRelations[ppID] || {
                parentless: 0,
                parentful: 0
            };

            // Hmm maybe should use partner node height index instd of relationshipHeightIndex.. to be considered

            const subtreeHasParents = !!(subtreeAtRelation.posByHeightIndex[ppHeightIndex + 1]);
            if (subtreeHasParents) {
                partnerNodeRelations[ppID].parentful++;
            } else {
                partnerNodeRelations[ppID].parentless++;
            }

            const spanAtHeightIdx = spansByHeightIndex[ppHeightIndex];
            const toRight = prevRelationshipHorizPos < partnerNodeHorizPos ? 1 : -1;
            const connectionPos = (
                partnerNodeHorizPos +
                (
                    (   // heuristic optimization - if subtree has no parents greater than curr generation, compactify a bit
                        subtreeHasParents ?
                            ((spanAtHeightIdx / 2) * partnerNodeRelations[ppID].parentful)
                            :
                            partnerNodeRelations[ppID].parentless
                    ) *
                    //(spanAtHeightIdx / (subtreeHasParents ? 2 : 8)) *
                    // to left or
                    toRight
                )
            );

            console.log('SUBTREE', connectionPos, nodePositionScaleDiviser, spanAtHeightIdx, relationshipNode, subtreeAtRelation);

            let boundaryOffset = -getMaxPos(subtreeAtRelation.posByHeightIndex, -toRight); // Opp. end of parent
            boundaryOffset = boundaryOffset > 0 ? Math.ceil(boundaryOffset) : Math.floor(boundaryOffset);
            console.log("BND", boundaryOffset, ppID);
            // Position subtree nodes relative to connectionPos
            subtreeAtRelation.posByHeightIndex.forEach(function(nodePosForHeightIndex, hi){
                Object.keys(nodePosForHeightIndex).forEach(function(nodeID){
                    treeWithAuxRelations.posByHeightIndex[hi] = treeWithAuxRelations.posByHeightIndex[hi] || {};
                    treeWithAuxRelations.posByHeightIndex[hi][nodeID] = (
                        connectionPos + (
                            (boundaryOffset + nodePosForHeightIndex[nodeID]) /
                            (nodePositionScaleDiviser * (subtreeHasParents ? 1 : 32)) // heuristic opt cont'd
                        )
                    );
                });
            });

            subtreeAtRelation.positionedIndividuals.forEach(function(pi){
                // Don't concat, since .positionedIndividuals here might refer to outer-scope `positionedIndividuals`
                treeWithAuxRelations.positionedIndividuals.push(pi);
            });

            subtreeAtRelation.positionedRelationships.forEach(function(pr){
                treeWithAuxRelations.positionedRelationships.push(pr);
            });

        });
    });


    // Handle remaining (disconnected) tree fragments/individuals
    let maxHorizPos = getMaxPos(posByHeightIndex) + 128;
    console.log("TREES", subtreeStack);
    while (typeof subtreeStack[0] !== "undefined"){
        const subtree = subtreeStack.shift(); // We'll be a queue now.
        let minOffset = -getMaxPos(subtree.posByHeightIndex, -1);
        minOffset = minOffset < 0 ? Math.floor(minOffset) : Math.ceil(minOffset);
        let nextMaxHorizPos = maxHorizPos;
        // Position subtree nodes relative to maxHorizPos
        subtree.posByHeightIndex.forEach(function(nodePosForHeightIndex, hi){
            Object.keys(nodePosForHeightIndex).forEach(function(nodeID){
                posByHeightIndex[hi] = posByHeightIndex[hi] || {};
                posByHeightIndex[hi][nodeID] = (
                    maxHorizPos + ((minOffset + nodePosForHeightIndex[nodeID]) / nodePositionScaleDiviser)
                );
                nextMaxHorizPos = Math.max(nextMaxHorizPos, Math.ceil(posByHeightIndex[hi][nodeID]));
            });
        });
        maxHorizPos = nextMaxHorizPos + 128;
        subtree.positionedIndividuals.forEach(function(pi){
            positionedIndividuals.push(pi);
        });

        subtree.positionedRelationships.forEach(function(pr){
            positionedRelationships.push(pr);
        });
    }

    // TODO: Handle remaining auxiliary relationships, if any.
    // Add'l aux relationships are most likely intra-family marriage (no subtrees)
    // and just need to figure out where to put aux relation node.
    // Perhaps, since should be small #, could do this after converting to orderByHeightIndex & count intersections per option..

    if (subtreeStack.length > 0 || positionedIndividuals.length !== graphSize) {
        console.log(subtreeStack, graphSize, positionedIndividuals.length);
        throw new Error("Disconnected family tree or individuals found, check data.");
    }


    // Generate initial `orderByHeightIndex` from `posByHeightIndex`
    const orderByHeightIndex = [];
    const seenOrderInIndex = {};
    const seenPosInIndex = {};
    positionedIndividuals.concat(positionedRelationships).forEach(function(node){
        const { _drawing: { heightIndex: hi }, id } = node;
        const pos = posByHeightIndex[hi][id];
        orderByHeightIndex[hi] = orderByHeightIndex[hi] || [];
        orderByHeightIndex[hi].push([ node, pos ]);
    });
    orderByHeightIndex.forEach(function(orderingForHI, hi){
        orderingForHI.sort(function([ nodeA, posA ], [ nodeB, posB ]){
            return posA - posB;
        });
        orderByHeightIndex[hi] = orderingForHI.map(function([ node, pos ], idxInRow){
            // Save final order to nodes so we don't need order object anymore (todo)
            node._drawing.orderInHeightIndex = seenOrderInIndex[node.id] = idxInRow;
            node._drawing.origPosInHeightIndex = seenPosInIndex[node.id] = pos; // for debugging only rn past this
            return node;
        });
    });

    console.log("SPANS", maxHeightIndex, spansByHeightIndex, posByHeightIndex, orderByHeightIndex);

    // const initialCrossings = countEdgeCrossings({ orderByHeightIndex, seenOrderInIndex });

    // Assign generation+order -based-name
    const heightIndicesCount = orderByHeightIndex.length;
    orderByHeightIndex.forEach(function(nodesInRow, hi){
        const generationRomanNumeral = numberToRomanNumeral(heightIndicesCount - hi);
        nodesInRow.reduce(function(currNum, n){
            if ( isRelationship(n) ) return currNum;
            n.orderBasedName = "" + generationRomanNumeral + " – " + currNum;
            if (n.isProband) {
                // Append "p" if proband
                n.orderBasedName += "p";
            }
            currNum++;
            return currNum;
        }, 1);
    });

    return {
        orderByHeightIndex,
        seenOrderInIndex,
        objectGraph: positionedIndividuals,
        relationships: positionedRelationships
    };
}

/** @deprecated */
export function orderObjectGraph2(objectGraph, relationships = null){
    const rootPermutations = computePossibleParentlessPermutations(objectGraph);
    const leafPermutations = computePossibleChildlessPermutations(objectGraph);

    let bestOrder = null;
    let bestCrossings = Infinity;
    let i;

    //const orderingInitial = initOrderingSimple(objectGraph, memoized);
    //const orderingPermutations = createOrderingPermutations(orderingInitial);
    //const orderingPermutationsLen = orderingPermutations.length;


    console.log(
        'PERMUTATIONS',
        leafPermutations,
        rootPermutations,
        //orderingInitial,
        //orderingPermutations
    );

    function checkCrossings(order){
        const edgeCrossings = countEdgeCrossings(order);
        //console.log("ORDER", order, edgeCrossings);
        if (edgeCrossings < bestCrossings){
            bestOrder = order;//copyOrder(order, objectGraph, memoized);
            bestCrossings = edgeCrossings;
            //console.log("ISBEST");
        }
    }

    //for (i = 0; i < orderingPermutationsLen; i++){
    //    checkCrossings(orderingPermutations[i]);
    //    if (bestCrossings === 0) break;
    //}

    //const probandBasedOrdering = initOrderingSimple(objectGraph, memoized);
    //checkCrossings(probandBasedOrdering);

    if (bestCrossings !== 0){
        for (i = 0; i < rootPermutations.length; i++){
            const orderBFS = initOrdering(objectGraph, rootPermutations[i], "children", false);
            checkCrossings(orderBFS);
            if (bestCrossings === 0) break;
            const orderDFS = initOrdering(objectGraph, rootPermutations[i], "children", true);
            checkCrossings(orderDFS);
            if (bestCrossings === 0) break;
        }
    }

    if (bestCrossings !== 0){
        for (i = 0; i < leafPermutations.length; i++){
            const orderBFS = initOrdering(objectGraph, leafPermutations[i], "parents", false);
            checkCrossings(orderBFS);
            if (bestCrossings === 0) break;
            const orderDFS = initOrdering(objectGraph, leafPermutations[i], "parents", true);
            checkCrossings(orderDFS);
            if (bestCrossings === 0) break;
        }
    }

    console.log("BEST ORDER1", Object.assign({}, bestOrder), bestCrossings, objectGraph);

    improveOrder(bestOrder, bestCrossings);
    heuristicallyAdjustOrder(bestOrder);

    // Save final order to nodes so we don't need order object anymore
    const { seenOrderInIndex, orderByHeightIndex } = bestOrder;
    objectGraph.forEach(function(indv){
        indv._drawing.orderInHeightIndex = seenOrderInIndex[indv.id];
    });
    relationships = relationships || getRelationships(objectGraph);
    relationships.forEach(function(r){
        r._drawing.orderInHeightIndex = seenOrderInIndex[r.id];
    });

    // Assign order-based-name
    const heightIndicesCount = orderByHeightIndex.length;
    orderByHeightIndex.forEach(function(nodesInRow, hi){
        const generationRomanNumeral = numberToRomanNumeral(heightIndicesCount - hi);
        nodesInRow.reduce(function(currNum, n){
            if ( isRelationship(n) ) return currNum;
            n.orderBasedName = "" + generationRomanNumeral + " – " + currNum;
            if (n.isProband) {
                // Append "p" if proband
                n.orderBasedName += "p";
            }
            currNum++;
            return currNum;
        }, 1);
    });

    console.log("BEST ORDER2", bestOrder, bestCrossings, objectGraph);

    return { objectGraph, relationships, ...bestOrder };
}

function swapOrder(row, seenOrderInIndex, i1, i2){
    const temp = row[i1];
    row[i1] = row[i2];
    row[i2] = temp;
    seenOrderInIndex[row[i1].id] = i1;
    seenOrderInIndex[row[i2].id] = i2;
}

function improveOrder(order, initCrossings){
    const { orderByHeightIndex, seenOrderInIndex } = order;

    let bestCrossings = initCrossings;
    let iterations = 0;
    let improved = true;

    while (improved){
        iterations++;
        if (iterations > 5) break;
        improved = false;
        orderByHeightIndex.forEach(function(nodesInRow, hi){
            const rowLen = nodesInRow.length;
            let i, nextCrossings;
            for (i = 1; i < rowLen; i++){
                swapOrder(nodesInRow, seenOrderInIndex, i, i - 1);
                nextCrossings = countEdgeCrossings(order);
                //console.log(nextCrossings, bestCrossings);
                if (nextCrossings < bestCrossings){
                    bestCrossings = nextCrossings;
                    //console.log("swapped", hi, i, i-1, seenOrderInIndex, orderByHeightIndex);
                    improved = true;
                } else {
                    swapOrder(nodesInRow, seenOrderInIndex, i, i - 1);
                    if (i - 2 >= 0){
                        swapOrder(nodesInRow, seenOrderInIndex, i, i - 2);
                        nextCrossings = countEdgeCrossings(order);
                        if (nextCrossings < bestCrossings){
                            bestCrossings = nextCrossings;
                            //console.log("swapped", hi, i, i-2, seenOrderInIndex, orderByHeightIndex);
                            improved = true;
                        } else {
                            swapOrder(nodesInRow, seenOrderInIndex, i, i - 2);
                        }
                    }
                }
            }
        });

    }
}

function sortChildrenByAge(a,b){
    if (a.isProband) return -1;
    if (b.isProband) return 1;
    return (b.age || 0) - (a.age || 0);
}

function sortPartnersByGender(a,b) {
    const { gender: gA } = a, { gender: gB } = b;
    if (gA === "male" && gB !== "male") {
        return -1;
    }
    if (gB === "male" && gA !== "male") {
        return 1;
    }
    return 0;
}

function heuristicallyAdjustOrder(order){
    const { orderByHeightIndex, seenOrderInIndex } = order;

    orderByHeightIndex.forEach(function(nodesInRow, hi){
        const rowLen = nodesInRow.length;
        // Swap parents so male is first, if next to each other and no parents on at least 1.
        for (let i = 0; i < rowLen; i++){
            const nodeSet = nodesInRow.slice(i, i+3);
            if (nodeSet.length < 3) continue;
            const [ leftNode, centerNode, rightNode ] = nodeSet;
            if (leftNode.gender === "male" || isRelationship(leftNode)){
                continue;
            }
            if (rightNode.gender !== "male" || isRelationship(rightNode)){
                continue;
            }
            if (leftNode._maritalRelationships.length > 1 || rightNode._maritalRelationships.length > 1){
                continue;
            }
            if (leftNode._parentalRelationship && rightNode._parentalRelationship){
                continue;
            }
            if (!isRelationship(centerNode) || centerNode.partners.indexOf(leftNode) === -1 || centerNode.partners.indexOf(rightNode) === -1){
                continue;
            }
            swapOrder(nodesInRow, seenOrderInIndex, i, i+2);
        }

        // Sort adjacent childless children
        const groups = [];
        let currGroup = [];
        let currGroupStartIdx = null;
        for (let i = 0; i < rowLen; i++){
            const node = nodesInRow[i];
            if (currGroup.length === 0){
                if (isRelationship(node)) continue;
                if (!node._parentalRelationship) continue;
                if (node._maritalRelationships.length > 0) continue;
                currGroup.push(node);
                currGroupStartIdx = i;
                continue;
            }
            if (isRelationship(node) ||
                !node._parentalRelationship ||
                node._parentalRelationship !== currGroup[0]._parentalRelationship ||
                node._maritalRelationships.length > 0
            ){
                if (currGroup.length > 1){
                    groups.push([currGroup, currGroupStartIdx ]);
                }
                currGroup = [];
                currGroupStartIdx = null;
                i--;
                continue;
            }
            currGroup.push(node);
        }
        if (currGroup.length > 1){
            groups.push([currGroup, currGroupStartIdx ]);
        }
        //console.log("GROUPS", groups);
        groups.forEach(function([ nodeSet, startIdx ]){
            const nodesLen = nodeSet.length;
            const nextSet = nodeSet.sort(sortChildrenByAge);
            nodesInRow.splice(startIdx, nodesLen, ...nextSet);
        });
    });
}


export function positionObjectGraph(objectGraph, order, dims, memoized = {}){
    const { orderByHeightIndex, seenOrderInIndex } = order;
    const graphHeight = (memoized.getGraphHeight || getGraphHeight)(orderByHeightIndex, dims);
    //const relationships = (memoized.getRelationships || getRelationships)(objectGraph);
    const yCoordByHeightIndex = orderByHeightIndex.map(function(indvsInRow, heightIndex){
        return graphHeight - (
            (dims.graphPadding * 2)
            + (heightIndex * dims.individualHeight)
            + (heightIndex * dims.individualYSpacing)
            + (dims.individualHeight / 2)
        );
    });
    const relativeMidpoint = Math.floor(dims.individualWidth / 2);
    const idMap = {};

    function slideChildren(children, diff, seenIndvs=null, skipPRs=null){
        const q = [...children];
        const seen = (seenIndvs && Object.assign({}, seenIndvs)) || {};
        //const seenPRs = (skipPRs && Object.assign({}, skipPRs)) || {};
        while (q.length){
            const child = q.shift();
            const { id, _drawing, _parentalRelationship, children } = child;
            if (seen[id]) continue;
            seen[id] = true;
            _drawing.xCoord += diff;
            console.log("SLID", id, child.name, diff, _drawing.xCoord);
            /*
            if (_parentalRelationship && !seenPRs[_parentalRelationship.id]){
                if (typeof _parentalRelationship._drawing.xCoord === 'number' && !seenPRs[_parentalRelationship.id]){
                    _parentalRelationship._drawing.xCoord += diff;
                    console.log("SLID", _parentalRelationship.id, diff, _parentalRelationship._drawing.xCoord);
                }
                seenPRs[_parentalRelationship.id] = true;
            }
            */
            // Right-er sibling-level nodes
            const orderPlace = seenOrderInIndex[id];
            orderByHeightIndex[_drawing.heightIndex].slice(orderPlace + 1).forEach(function(ch){
                q.push(ch);
            });
            // Own children
            if (isRelationship(child)){
                (children || []).forEach(function(ch){
                    q.push(ch);
                });
            }
        }
        return seen;
    }

    function boundsOfNodes(nodes){
        const xCoords = nodes.map(function(node){
            return node._drawing.xCoord;
        });
        if (xCoords.length === 1){
            console.log('MEDX', xCoords);
            return [ xCoords[0], xCoords[0] ];
        }
        console.log('MED', xCoords);
        const lowXBound = Math.min(...xCoords);
        const highXBound = Math.max(...xCoords);
        return [ lowXBound, highXBound ];
    }

    function calculateMedianOfNodes(nodes){
        const [ lowXBound, highXBound ] = boundsOfNodes(nodes);
        if (lowXBound === highXBound) return lowXBound;
        return Math.floor((lowXBound + highXBound) / 2);
    }

    // Init coords
    orderByHeightIndex.forEach(function(nodesInRow, hi){
        if (orderByHeightIndex[hi].length === 0) return;
        //const [ firstIndv, ...remainingIndvs ] = individualsInRow;

        nodesInRow.reduce(function(prevNode, currNode){
            const { _maritalRelationships, _drawing, children, id, name } = currNode;
            idMap[id] = currNode;
            let offsetFromPrevNode = null;
            if (prevNode === null){
                _drawing.xCoord = relativeMidpoint;
                offsetFromPrevNode = _drawing.xCoord; // + dims.individualWidth + dims.individualXSpacing;
                console.log('DDD2', name, relativeMidpoint, currNode);
            } else {

                offsetFromPrevNode = prevNode._drawing.xCoord + dims.individualWidth + dims.individualXSpacing;
                _drawing.xCoord = offsetFromPrevNode;

                if (isRelationship(currNode)){
                    const childrenWithAssignedXCoord = children.filter(function(c){
                        return typeof c._drawing.xCoord === 'number';
                    });
                    if (childrenWithAssignedXCoord.length !== children.length){
                        console.error("Some children of " + ( name || id ) + " have not been assigned positions yet:", children.slice());
                    }
                    const childrenMedian = calculateMedianOfNodes(childrenWithAssignedXCoord);
                    if (_drawing.xCoord < childrenMedian){
                        console.log("MOVING RELATIONSHIP", currNode, "TO", childrenMedian);
                        // Move left partner up also if no other assigned relationships at same height indx

                        // Maybe wrap in this if needed later..
                        //if (!prevNode._parentalRelationship) { }

                        let isPartner = false;
                        let otherAssignedCount = 0;
                        if (Array.isArray(prevNode._maritalRelationships)){
                            for (var i = 0; i < prevNode._maritalRelationships.length; i++){
                                if (prevNode._maritalRelationships[i] === currNode) {
                                    isPartner = true;
                                } else if (typeof prevNode._maritalRelationships[i]._drawing.xCoord === 'number' && prevNode._maritalRelationships[i]._drawing.heightIndex === hi) {
                                    otherAssignedCount++;
                                    break;
                                }
                            }
                        }
                        if (isPartner && otherAssignedCount === 0){
                            const diff = childrenMedian - _drawing.xCoord;
                            console.log("MOVING RELATIONSHIP PARTNER", prevNode, "BY", diff);
                            prevNode._drawing.xCoord += diff;
                        }
                        _drawing.xCoord = childrenMedian;
                    } else {
                        // Move children up
                        const diff = _drawing.xCoord - childrenMedian;
                        console.log("SLIDING CHILDREN OF", currNode, "BY", diff);
                        slideChildren(children, diff, null, null);
                    }
                }

                console.log('DDD3', name, _drawing.xCoord, offsetFromPrevNode, prevNode);
            }

            // Set yCoord
            _drawing.yCoord = yCoordByHeightIndex[_drawing.heightIndex];

            return currNode;
        }, null);

        /*
        nodesInRow.forEach(function(individual){
            const { _childReferences, _maritalRelationships, _drawing, id } = individual;
            const commonRowMaritalRelationships = _maritalRelationships.filter(function(mr){
                return mr._drawing.heightIndex === _drawing.heightIndex;
            });
            if (commonRowMaritalRelationships.length === 2){
                // Move to middle if directly in between 2 other individuals (relationships)
                const [ mr1, mr2 ] = commonRowMaritalRelationships;
                let maxXOffset = 0;
                commonRowMaritalRelationships.forEach(function(mr){
                    const orders = mr.partners.map(function(p){ return seenOrderInIndex[p.id]; });
                    maxXOffset = Math.max(maxXOffset, Math.max(...orders) - seenOrderInIndex[id], seenOrderInIndex[id] - Math.min(...orders));
                });
                if (maxXOffset === 1){
                    _drawing.xCoord = Math.floor((mr1._drawing.xCoord + mr2._drawing.xCoord) / 2);
                }
            }
        });
        */

    });

    // Re-align to left edge if needed -
    let smallestXCoord = Infinity;
    objectGraph.forEach(function(indv){
        smallestXCoord = Math.min(smallestXCoord, indv._drawing.xCoord);
    });
    if (smallestXCoord > relativeMidpoint){
        const diff = relativeMidpoint - smallestXCoord;
        const seenPRs = new Set();
        objectGraph.forEach(function(indv){
            indv._drawing.xCoord += diff;
            if (indv._parentalRelationship && !seenPRs.has(indv._parentalRelationship)){
                indv._parentalRelationship._drawing.xCoord += diff;
                seenPRs.add(indv._parentalRelationship);
            }
        });
    }
}
