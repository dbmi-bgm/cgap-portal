import React from 'react';
import PropTypes from 'prop-types';
import memoize from 'memoize-one';
import { _ } from 'underscore';
import { DragAndDropFileUploadController } from '@hms-dbmi-bgm/shared-portal-components/es/components/forms/components/DragAndDropUpload';

export class FileWrapper extends React.Component {
    static propTypes = {
        individual: PropTypes.object,
        haveEditPermission: PropTypes.bool,
        indvSchema: PropTypes.object,
        docSchema: PropTypes.object,
        imageSchema: PropTypes.object
    }

    constructor() {
        super();

        this.findFieldsWithDocumentsOrImages = this.findFieldsWithDocumentsOrImages.bind(this);
        this.memoized = {
            fileFields : memoize(this.findFieldsWithDocumentsOrImages)
        };
    }

    findFieldsWithDocumentsOrImages() {  // Q: Does it make sense to memoize this?
        const { indvSchema } = this.props;
        const { properties = {} } = indvSchema;

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
                relevantFields.push({ [property] : linkTo });
            }
            // If an array, check the items field for linkTo data
            else if ( type === "array" &&
                (items["linkTo"] === "Document" || items["linkTo"] === "Image")
            ) {
                relevantFields.push({ [property]: items["linkTo"] });
            }
        });
        console.log("relevantFields", relevantFields);
        return relevantFields;
    }

    render() {
        const { individual, haveEditPermission, docSchema, imageSchema, indvSchema } = this.props; 
        const { properties = {} } = indvSchema;
        const { "@id": individualId, institution, project } = individual;

        const fieldsToRender = this.memoized.fileFields();

        return (
            <React.Fragment>
                { fieldsToRender.map((obj) => {
                    const property = _.keys(obj)[0];
                    const files = individual[property];

                    // Pass the correct schema for this particular type of file (Image OR Document)
                    let fileSchema;
                    const fieldName = obj[property];
                    if (fieldName === "Document") { fileSchema = docSchema; }
                    else { fileSchema = imageSchema; }

                    return <FileArrayField key={property} fieldType={property} fieldDisplayTitle={properties[property]["title"]} {...{ files, haveEditPermission,
                        individualId, institution, project, fileSchema, fieldName }} />;
                }) }
            </ React.Fragment>
        );
    }
}

class FileArrayField extends React.Component {
    static propTypes = {
        fieldDisplayTitle: PropTypes.string.isRequired,
        fieldName: PropTypes.string.isRequired,
        fieldType: PropTypes.string.isRequired,
        individualId: PropTypes.string.isRequired,
        institution: PropTypes.object.isRequired,
        project: PropTypes.object.isRequired,
        files: PropTypes.array,
        haveEditPermission: PropTypes.bool,
        fileSchema: PropTypes.object.isRequired
    }

    static defaultProps = {
        files: []
    }

    render() {
        const { fieldDisplayTitle, fieldName, fieldType, files, individualId, haveEditPermission = false, institution, project, fileSchema } = this.props;

        return (
            <div className="detail-row" data-describing={fieldDisplayTitle}>
                <label className="d-block">{fieldDisplayTitle}</label>
                <ul>
                    {
                        files.map((file) => <li key={file['@id']}><a href={file['@id']}>{file.display_title}</a></li>)
                    }
                </ul>
                { haveEditPermission ?
                    <DragAndDropFileUploadController award={null} lab={null}
                        {...{ fieldDisplayTitle, fieldType, fieldName, individualId, project, institution, fileSchema, files }} cls="btn btn-sm btn-outline-dark" /> : null }
            </div>
        );
    }
}