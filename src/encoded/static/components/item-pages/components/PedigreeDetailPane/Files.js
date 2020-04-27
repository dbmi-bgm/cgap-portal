import React from 'react';
import PropTypes from 'prop-types';
import { DragAndDropUploadFileUploadController } from '@hms-dbmi-bgm/shared-portal-components/es/components/forms/components/DragAndDropUpload';
import { _ } from 'underscore';

export class FileWrapper extends React.Component {
    static propTypes = {
        individual: PropTypes.object,
        haveEditPermission: PropTypes.bool,
        schemas: PropTypes.object
    }

    renderFieldsWithDocumentsOrImages() {
        const { schemas } = this.props;
        const { properties = {} } = schemas;

        // Isolate the field/property names of linkTos with type Document or Image
        const allProperties = _.keys(properties);
        const relevantFields = [];

        allProperties.forEach((property) => {
            const propertyFields = properties[property];
            const { type = null, linkTo = null, items = {} } = propertyFields;

            // If not an array, check linkTo directly from property data root
            if (type !== "array" &&
                (linkTo === "Document" || linkTo === "Image")
            ) {
                relevantFields.push(property);
            }
            // If an array, check the items field for linkTo data
            else if ( type === "array" &&
                (items["linkTo"] === "Document" || items["linkTo"] === "Image")
            ) {
                relevantFields.push(property);
            }
        });

        // Calculate JSX for these fields
        console.log("relevantFields", relevantFields);
        const elements = [];

        const { individual, haveEditPermission } = this.props;
        const { "@id": individualId, institution, project } = individual;

        relevantFields.forEach((property) => {
            const files = individual[property];

            // Check if the current individual has any items in the specified field
            if (files && files.length !== 0) {
                elements.push(
                    <FileArrayField fieldName={properties[property]["title"]} {...{ files, haveEditPermission,
                        individualId, institution, project }} />
                );
            }
        });
        return elements;
    }

    render() {
        return (
            <React.Fragment>
                { this.renderFieldsWithDocumentsOrImages() }
            </ React.Fragment>
        );
    }
}

class FileArrayField extends React.Component {
    static propTypes = {
        fieldName: PropTypes.string.isRequired,
        files: PropTypes.array.isRequired,
        individualId: PropTypes.string.isRequired,
        institution: PropTypes.object.isRequired,
        project: PropTypes.object.isRequired,
        haveEditPermission: PropTypes.bool,
        schemas: PropTypes.object.isRequired
    }

    render () {
        const { fieldName, files, individualId, haveEditPermission = false, institution, project } = this.props;

        const fieldType = files[0]["@type"][0];

        return (
            <div className="detail-row" data-describing={fieldName}>
                <label className="d-block">{fieldName}</label>
                <ul>
                    {
                        files.map((file) => <li key={file['@id']}><a href={file['@id']}>{file.display_title}</a></li>)
                    }
                </ul>
                { haveEditPermission ?
                    <DragAndDropUploadFileUploadController award={null} lab={null}
                        {...{ fieldName, fieldType, individualId, project, institution }} cls="btn btn-sm btn-outline-dark" /> : null }
            </div>
        );
    }
}