import argparse
import logging

from encoded.util import open_json_file


log = logging.getLogger(__name__)


def run_compare_inserts(original_path, new_path, identifier_key, ignore_fields=None):
    """Open insert files and compare them.

    :param original_path: Path to original inserts file
    :type original_path: str
    :param new_path: Path to new inserts file
    :type new_path: str
    :param identifier_key: The top-level key on the insert that serves
        as the unique identifier
    :type identifier_key: str
    :param ignore_fields: Top-level keys on the inserts to exclude from
        the comparison
    :type ignore_fields: list(str)
    """
    original_inserts = open_json_file(original_path)
    new_inserts = open_json_file(new_path)
    if original_inserts and new_inserts:
        compare_inserts(
            original_inserts, new_inserts, identifier_key, ignore_fields=ignore_fields
        )


def compare_inserts(original, new, identifier_key, ignore_fields=None):
    """Compare two sets of inserts.

    :param original: Initial inserts to compare against new inserts
    :type original: list(dict)
    :param new: New inserts to compare
    :type new: list(dict)
    :param identifier_key: The top-level key on the insert that serves
        as the unique identifier
    :type identifier_key: str
    :param ignore_fields: Top-level keys on the inserts to exclude from
        the comparison
    :type ignore_fields: list(str)
    """
    created = []
    deleted = []
    modified = []
    identical = []
    original_key_mapping = map_inserts_to_key(original, identifier_key)
    new_key_mapping = map_inserts_to_key(new, identifier_key)
    original_to_new_mapping = {}
    for identifier, original_idx in original_key_mapping.items():
        new_idx = new_key_mapping.get(identifier)
        if new_idx is None:
            deleted.append(identifier)
        else:
            original_to_new_mapping[original_idx] = new_idx
            del new_key_mapping[identifier]
    original_key_mapping.clear()
    log.info("%s inserts have been deleted", len(deleted))
    log.debug(
        "Inserts with following identifiers have been deleted:\t%s",
        deleted,
    )
    for identifier in new_key_mapping:
        created.append(identifier)
    new_key_mapping.clear()
    log.info("%s inserts are new", len(created))
    log.debug(
        "Inserts with following identifiers were created:\t%s",
        created,
    )
    for original_idx, new_idx in original_to_new_mapping.items():
        original_insert = original[original_idx]
        new_insert = new[new_idx]
        if are_identical(original_insert, new_insert, ignore_fields=ignore_fields):
            identical.append(original_insert.get(identifier_key))
        else:
            modified.append((original_idx, new_idx))
    original_to_new_mapping.clear()
    log.info("%s inserts are identical", len(identical))
    log.info("%s inserts are modified", len(modified))
    if log.isEnabledFor(logging.DEBUG):
        for original_idx, new_idx in modified:
            original_insert = original[original_idx]
            new_insert = new[new_idx]
            identifier = original_insert.get(identifier_key)
            deleted_fields = []
            created_fields = []
            modified_fields = []
            for key, value in original_insert.items():
                if ignore_fields and key in ignore_fields:
                    continue
                new_value = new_insert.get(key)
                if new_value is None:
                    deleted_fields.append(key)
                elif not are_identical(new_value, value):
                    modified_fields.append(key)
            for key, value in new_insert.items():
                original_value = original_insert.get(key)
                if original_value is None:
                    created_fields.append(key)
            if deleted_fields:
                log.debug(
                    "%s field(s) were deleted for %s:\t%s",
                    len(deleted_fields),
                    identifier,
                    deleted_fields,
                )
            if created_fields:
                log.debug(
                    "%s field(s) were created for %s:\t%s",
                    len(created_fields),
                    identifier,
                    created_fields,
                )
            if modified_fields:
                log.debug(
                    "%s field(s) were modified for %s:\t%s",
                    len(modified_fields),
                    identifier,
                    modified_fields,
                )


def map_inserts_to_key(inserts, key):
    """Create mapping of insert key value to insert indices.

    E.g. inserts of [{"foo": "bar"}, {"foo": "bur"}] will result in
    mapping dict of {"bar": 0, "bur": 1}.

    We assume the key value is a unique identifier to each insert.

    :param inserts: Inserts for which to generate mapping
    :type inserts: list(dict)
    :param key: Key used to map insert values
    :type key: str
    :returns: Mapping of key values to insert indices
    :rtype: dict
    """
    result = {}
    missing_key = 0
    for idx, insert in enumerate(inserts):
        key_value = insert.get(key)
        if key_value is None:
            missing_key += 1
            continue
        result[key_value] = idx
    log.info("%s inserts did not have the identifying key", missing_key)
    return result


def are_identical(item_1, item_2, ignore_fields=None):
    """Recursively determine if two items are identical and log
    accordingly.

    :param item_1: First object
    :type item_1: object
    :param item_2: Second object
    :type item_2: object
    :param ignore_fields: Fields to ignore when comparing items
    :type ignore_fields: list(str) or None
    :returns: True if two items are identical outside of ignored fields,
        False otherwise
    :rtype: bool
    """
    result = True
    if type(item_1) == type(item_2):
        if isinstance(item_1, list):
            if len(item_1) == len(item_2):
                for i in range(len(item_1)):
                    for j in range(len(item_1)):
                        sub_result = are_identical(item_1[i], item_2[j])
                        if sub_result is True:
                            break
                    if sub_result is False:
                        result = False
                        break
            else:
                result = False
        elif isinstance(item_1, dict):
            if len(item_1) == len(item_2):
                for key, value in item_1.items():
                    if ignore_fields and key in ignore_fields:
                        continue
                    if key in item_2:
                        item_2_value = item_2.get(key)
                        if not are_identical(value, item_2_value):
                            result = False
                            break
                    else:
                        result = False
                        break
            else:
                result = False
        elif item_1 != item_2:
            result = False
    else:
        result = False
    return result


def configure_logs(log_file, log_level):
    """Set up logging for insert comparison.

    Configure separate from the main project's log file/style as we
    assume script is run locally by developer.

    :param log_file: Path to log file to write
    :type log_file: str or None
    :param log_level: Level to log at (DEBUG or INFO)
    :type log_level: str
    """
    log.propagate = False
    if args.log_file:
        log.addHandler(logging.FileHandler(args.log_file, mode="w"))
    else:
        log.addHandler(logging.StreamHandler())
    log.setLevel(getattr(logging, args.log_level.upper())


def main():
    """Parse args, configure logging, and run the script.

    Configure logging here separate from the main project's log file/
    style as we assume script is run locally by developer.
    """
    parser = argparse.ArgumentParser(description="Compare inserts")
    parser.add_argument("original_inserts", help="Path to original inserts file")
    parser.add_argument("new_inserts", help="Path to new inserts file")
    parser.add_argument(
        "identifer_key",
        help="Identifying field for inserts (should be unique for each insert",
    )
    parser.add_argument("--log_file", "-f", help="Path to logging file")
    parser.add_argument("--log_level", "-l", default="info", choices=["debug", "info"])
    parser.add_argument(
        "--ignore_fields",
        "-i",
        action="append",
        help="Fields to ignore for comparisons",
    )
    args = parser.parse_args()
    configure_logs(args.log_file, args.log_level)
    run_compare_inserts(
        args.original_inserts,
        args.new_inserts,
        args.identifer_key,
        ignore_fields=args.ignore_fields,
    )


if __name__ == "__main__":
    main()
