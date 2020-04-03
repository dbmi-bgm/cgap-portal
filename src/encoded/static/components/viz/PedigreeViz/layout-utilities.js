import { getGraphHeight } from './layout-utilities-drawing';
import { getRelationships, isRelationship, numberToRomanNumeral, sortByAge, sortByGender } from './data-utilities';



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

    }

    return maxHeightIndexAssigned;
}



export function getMaxHeightIndex(objectGraph){
    return objectGraph.reduce(function(currMax, individual){
        if (individual._drawing.heightIndex > currMax){
            return individual._drawing.heightIndex;
        }
        return currMax;
    }, -1);
}



function countNodesInBetween(order, fromNode, toNode){
    const { orderByHeightIndex, seenOrderInIndex } = order;
    const { _drawing : { heightIndex } } = fromNode;
    const orderFrom = seenOrderInIndex[fromNode.id];
    const orderTo = seenOrderInIndex[toNode.id];
    let num = 0;
    const begin = Math.min(orderFrom, orderTo) + 1;
    const end = Math.max(orderFrom, orderTo) - 1;
    //console.log("XXX", begin, end, orderTo, orderFrom);
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

/**
 * Maybe can be repurposed and be made more accurate in future using posByHeightIndex.
 * Will return to later.
 * @deprecated
 */
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
        const orderedPartners = partners.slice().sort(sortByGender);

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
                    return sortByAge(a,b);
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
                    return sortByAge(a,b);
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
    const MIN_SPAN = 128; // maxHeightIndex[0] would be equivalent to a `MAX_SPAN`
    const spansByHeightIndex = [ MIN_SPAN ];
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

    function posByHIToOrderByHI(allNodes, posByHI){
        const orderByHeightIndex = [];
        const seenOrderInIndex = {};
        const seenPosInIndex = {};
        allNodes.forEach(function(node){
            const { _drawing: { heightIndex: hi }, id } = node;
            const pos = posByHI[hi][id];
            orderByHeightIndex[hi] = orderByHeightIndex[hi] || [];
            orderByHeightIndex[hi].push([ node, pos ]);
        });
        orderByHeightIndex.forEach(function(orderingForHI, hi){
            orderingForHI.sort(function([ nodeA, posA ], [ nodeB, posB ]){
                return posA - posB;
            });
            orderByHeightIndex[hi] = orderingForHI.map(function([ node, pos ], idxInRow){
                // Save final order to nodes so we don't need order object anymore (todo)
                seenOrderInIndex[node.id] = idxInRow;
                seenPosInIndex[node.id] = pos; // for debugging only rn past this
                return node;
            });
        });
        return { orderByHeightIndex, seenOrderInIndex, seenPosInIndex };
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
    // Sometimes same node has multiple aux relations, keep track to offset them; maybe need to group siblings later idk.
    const partnerNodeRelations = {};
    const auxRelationshipsWithoutSubtrees = []; // Most likely intra-family relationships; to be positioned in subsequent step.

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
                auxRelationshipsWithoutSubtrees.push(relQItem);
                console.warn("Could not find subtree for auxiliary relation, likely an intra-family relationship");
                return;
                //throw new Error("Could not find subtree for auxiliary relation");
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
    // Simply position them to the right of existing tree.
    let maxHorizPos = getMaxPos(posByHeightIndex) + MIN_SPAN;

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
        maxHorizPos = nextMaxHorizPos + MIN_SPAN;
        subtree.positionedIndividuals.forEach(function(pi){
            positionedIndividuals.push(pi);
        });

        subtree.positionedRelationships.forEach(function(pr){
            positionedRelationships.push(pr);
        });
    }

    if (positionedIndividuals.length !== graphSize) {
        // Shouldn't occur now..
        console.log(subtreeStack, graphSize, positionedIndividuals.length);
        throw new Error("Disconnected family tree or individuals found, check data.");
    }


    // TODO: Handle remaining auxiliary relationships, if any.
    // Add'l aux relationships are most likely intra-family marriage (no subtrees)
    // and just need to figure out where to put aux relation node.
    // Perhaps, since should be small #, could do this after converting to orderByHeightIndex & count intersections per option..

    // maybe: if (positionedRelationships.length !== relationships.length) {...}
    if (auxRelationshipsWithoutSubtrees.length > 0) {
        console.warn(
            `${auxRelationshipsWithoutSubtrees.length} auxiliary relationship nodes with ${relationships.length - positionedRelationships.length} not positioned.`,
            auxRelationshipsWithoutSubtrees
        );
        // TODO: (Re-)arrange relationship node to be in better place.
        // Idea 1: Try placing each relationship in different spots in order and testing crossings.
        // (1 by 1 or likely permutations? pro/con = speed/accuracy; need to try both and assess)
        auxRelationshipsWithoutSubtrees.forEach(function(relQItem){
            const [ relationshipNode, positionedPartnerNode, partnerNodeHorizPos, prevRelationshipHorizPos ] = relQItem;
            const { id: relID,_drawing: { heightIndex: relHeightIndex } } = relationshipNode;
            const { id: ppID, _drawing: { heightIndex: ppHeightIndex } } = positionedPartnerNode;
            const spanAtHeightIdx = spansByHeightIndex[ppHeightIndex];
            const toRight = prevRelationshipHorizPos < partnerNodeHorizPos ? 1 : -1;
            partnerNodeRelations[ppID] = partnerNodeRelations[ppID] || {
                parentless: 0,
                parentful: 0
            };
            partnerNodeRelations[ppID].parentful++;

            // TODO instead of trying to move relationship closer to other aux node,
            // try moving to other side of current node is on if it brings it closer to other partner(s).

            // TODO: Change intersection counting code to use position instead of order.
            // To avoid overhead of converting (and inaccuracy) _if_ we don't use some better idea.
            const origCrossings = countEdgeCrossings(posByHIToOrderByHI(
                positionedIndividuals.concat(positionedRelationships),
                posByHeightIndex
            ));

            const origPos = posByHeightIndex[relHeightIndex][relID];
            const newPos = (
                partnerNodeHorizPos +
                ((spanAtHeightIdx / 2) * partnerNodeRelations[ppID].parentful) * toRight
            );
            posByHeightIndex[relHeightIndex][relID] = newPos;

            const nextCrossings = countEdgeCrossings(posByHIToOrderByHI(
                positionedIndividuals.concat(positionedRelationships),
                posByHeightIndex
            ));

            if (nextCrossings >= origCrossings) { // Undo
                posByHeightIndex[relHeightIndex][relID] = origPos;
                partnerNodeRelations[ppID].parentful--;
            } else {
                console.info(`Changed ${relID} from ${origPos} to ${newPos}.`);
            }

        });
    }

    // Generate initial `orderByHeightIndex` from `posByHeightIndex`
    const { orderByHeightIndex, seenOrderInIndex, seenPosInIndex } = posByHIToOrderByHI(
        positionedIndividuals.concat(positionedRelationships),
        posByHeightIndex
    );


    // Assign generation+order -based-name & save final order to nodes so we don't need order object anymore (todo)
    const heightIndicesCount = orderByHeightIndex.length;
    orderByHeightIndex.forEach(function(nodesInRow, hi){
        const generationRomanNumeral = numberToRomanNumeral(heightIndicesCount - hi);
        nodesInRow.reduce(function(currNum, n){

            n._drawing.orderInHeightIndex = seenOrderInIndex[n.id];
            n._drawing.origPosInHeightIndex = seenPosInIndex[n.id]; // for debugging only rn past this

            if ( isRelationship(n) ) {
                // Don't increment or add to node.
                return currNum;
            }
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
