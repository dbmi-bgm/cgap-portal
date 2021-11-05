import React from 'react';
import PropTypes from 'prop-types';
import memoize from 'memoize-one';
import _ from 'underscore';
import { DragAndDropFileUploadController } from '@hms-dbmi-bgm/shared-portal-components/es/components/forms/components/DragAndDropUpload';



export class FileWrapper extends React.PureComponent {

    static propTypes = {
        "individual": PropTypes.object.isRequired,
        "haveEditPermission": PropTypes.bool,
        "schemas": PropTypes.object
    };

    static findFieldsWithDocumentsOrImages(indvSchema){
        const { properties = {} } = indvSchema || {};
        // Isolate the field/property names of linkTos with type Document or Image
        const allProperties = _.keys(properties);
        const relevantFields = []; // If need to bundle more properties, see https://github.com/dbmi-bgm/cgap-portal/pull/236 for potential implementation notes

        allProperties.forEach(function(property){
            const propertyFields = properties[property];
            const { type = null, linkTo = null, items = {} } = propertyFields;

            // If not an array, check linkTo directly from property data root
            if (type !== "array" && (linkTo === "Document" || linkTo === "Image")) {
                relevantFields.push({ property, "linkToItemType": linkTo });
            }

            // If an array, check the items field for linkTo data
            else if (type === "array" && (items["linkTo"] === "Document" || items["linkTo"] === "Image")) {
                relevantFields.push({ property, "linkToItemType": items["linkTo"] });
            }

        });
        return relevantFields;
    }

    constructor() {
        super();
        this.memoized = {
            findFieldsWithDocumentsOrImages: memoize(FileWrapper.findFieldsWithDocumentsOrImages)
        };
    }

    render() {
        const { individual, haveEditPermission, schemas } = this.props;
        const {
            Individual: indvSchema = null,
            Document: docSchema = null,
            Image: imageSchema = null
        } = schemas || {};
        const { properties: indvProperties = {} } = indvSchema || {};
        const { "@id": individualId, institution, project } = individual;
        const fieldsToRender = this.memoized.findFieldsWithDocumentsOrImages(indvSchema);

        return fieldsToRender.map(function({ property, linkToItemType }){
            const files = individual[property];
            // Pass the correct schema for this particular type of file (Image OR Document)
            const fileSchema = (linkToItemType === "Document") ? docSchema : imageSchema;
            return (
                <FileArrayField {...{ files, haveEditPermission, individualId, institution, project, fileSchema }} key={property}
                    fieldType={property} fieldName={linkToItemType} fieldDisplayTitle={indvProperties[property]["title"]} />
            );
        });
    }
}

function FileArrayField (props) {
    const { fieldDisplayTitle, fieldName, fieldType, files, individualId, haveEditPermission = false, institution, project, fileSchema } = props;
    return (
        <div className="detail-row" data-describing={fieldDisplayTitle}>
            <label className="d-block">{fieldDisplayTitle}</label>
            <ul className="mb-05">
                { files.map(function({ "@id" : fileID, display_title: fileDisplayTitle }){
                    return (
                        <li key={fileID}>
                            <a href={fileID}>{ fileDisplayTitle }</a>
                        </li>
                    );
                }) }
            </ul>
            { haveEditPermission ?
                <DragAndDropFileUploadController {...{ fieldDisplayTitle, fieldType, fieldName, individualId, project, institution, fileSchema, files }}
                    award={null} lab={null} multiselect cls="btn btn-sm btn-outline-dark mt-05"
                    requestVerificationMsg={<span>I certify that my file(s) do not contain <a href="https://www.hipaajournal.com/considered-phi-hipaa/" target="_blank" rel="noreferrer">Personal Health Information</a></span>}/>
                : null }
        </div>
    );
}
FileArrayField.propTypes = {
    "fieldDisplayTitle": PropTypes.string.isRequired,
    "fieldName": PropTypes.string.isRequired,
    "fieldType": PropTypes.string.isRequired,
    "individualId": PropTypes.string.isRequired,
    "institution": PropTypes.object.isRequired,
    "project": PropTypes.object.isRequired,
    "files": PropTypes.array,
    "haveEditPermission": PropTypes.bool,
    "fileSchema": PropTypes.object.isRequired
};
FileArrayField.defaultProps = {
    files: []
};