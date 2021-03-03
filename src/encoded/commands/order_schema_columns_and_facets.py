import json
from math import inf
from os import walk, path, getcwd

'''
This script re-orders columns and (todo) facets
according to their 'order' to help visually see
the order without needing to copy-paste around
the columns and facets manually or launch the app server.

TODO: Potentially make into a git hook or build step or similar.
'''



def order_schema_columns_and_facets(schema):
    '''
    This assumes a schema which is already copied, if need be,
    and is _edited in place_.
    '''

    if "columns" in schema:
        # Re order these by their order.
        sorted_cols = sorted(
            schema["columns"].items(),
            key=lambda x: x[1].get("order", inf)
        )
        new_col_dict = {}
        for c in sorted_cols:
            new_col_dict[c[0]] = c[1]
        schema["columns"] = new_col_dict

    if "facets" in schema:
        schema_facets = schema["facets"].items()
        grouped_facets_by_grouping = {}
        ungrouped_facets = []
        for facet_tuple in schema_facets:
            facet_field_name, facet_definition = facet_tuple
            if "grouping" in facet_definition:
                grouped_facets_by_grouping[facet_definition["grouping"]] = grouped_facets_by_grouping.get(facet_definition["grouping"], [])
                grouped_facets_by_grouping[facet_definition["grouping"]].append(facet_tuple)
            else:
                ungrouped_facets.append(facet_tuple)

        # Remove groups with only 1 facet
        for group in grouped_facets_by_grouping.copy().items(): # group_name, grouped_facets
            if len(group[1]) == 1:
                # If is only facet in group, then move to ungrouped.
                ungrouped_facets.append(group[1][0])
                del grouped_facets_by_grouping[group[0]]

        # Sort groups' facets + generate 3-item tuples of group name, grouped facets, and order.
        ordered_group_tuples = []
        for group_name, grouped_facets in grouped_facets_by_grouping.items():
            grouped_facets.sort(key=lambda x: x[1].get("order", inf))
            min_order = min([ x[1].get("order", inf) for x in grouped_facets ])
            ordered_group_tuples.append((group_name, grouped_facets, min_order))

        ordered_group_tuples.sort(key=lambda x: x[2])
        ungrouped_facets.sort(key=lambda x: x[1].get("order", inf))

        # Merge facets back into single ordered list of facet tuples
        ordered_facets = []
        lenUngrp = len(ungrouped_facets)
        lenGrp = len(ordered_group_tuples)
        ptUngrp = 0
        ptGrp = 0

        while ptUngrp < lenUngrp or ptGrp < lenGrp:
            from_grp = False
            if ptUngrp == lenUngrp and ptGrp < lenGrp:
                from_grp = True
            elif ptUngrp < lenUngrp and ptGrp == lenGrp:
                pass
            elif ungrouped_facets[ptUngrp][1].get("order", inf) > ordered_group_tuples[ptGrp][2]:
                from_grp = True

            if not from_grp:
                ordered_facets.append(ungrouped_facets[ptUngrp])
                ptUngrp += 1
            else:
                for facet_tuple in ordered_group_tuples[ptGrp][1]:
                    ordered_facets.append(facet_tuple)
                ptGrp += 1
        
        # Update schema.facets (python3.6+ dict inserts are ordered)
        new_facet_dict = {}
        for facet_field, facet_definition in ordered_facets:
            new_facet_dict[facet_field] = facet_definition
        schema["facets"] = new_facet_dict

    return schema
    


def main():

    schemas_dir = path.abspath(path.join(path.dirname(path.realpath(__file__)), "./../schemas"))
    schema_filenames = []

    for root, dirs, files in walk(schemas_dir):
        for filename in files:
            if filename.endswith(".json"):
                schema_filenames.append(path.join(root, filename))

    for filename in schema_filenames:
        schema = None
        with open(filename) as fp:
            schema = json.load(fp)

        if "properties" not in schema:
            # Skip mixins and such
            continue

        schema = order_schema_columns_and_facets(schema)

        with open(filename, "w") as fp:
            json.dump(schema, fp, indent=4)
            # Newline at end of file
            fp.write("\n")

    print("Done.")


if __name__ == '__main__':
    main()
