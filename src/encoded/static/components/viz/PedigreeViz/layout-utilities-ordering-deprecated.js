

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

export function permutate2DArray1Dimension(arr){
    return permutateArray(arr).map(flattenBuckets);
}

function improveOrder(order, initCrossings){
    const { orderByHeightIndex, seenOrderInIndex } = order;

    let bestCrossings = initCrossings;
    let iterations = 0;
    let improved = true;

    while (improved){
        iterations++;
        if (iterations > 10) break;
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

function swapOrder(row, seenOrderInIndex, i1, i2){
    const temp = row[i1];
    row[i1] = row[i2];
    row[i2] = temp;
    seenOrderInIndex[row[i1].id] = i1;
    seenOrderInIndex[row[i2].id] = i2;
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
