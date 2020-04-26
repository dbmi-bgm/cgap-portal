import React from 'react';
import PropTypes from 'prop-types';
import { DragAndDropUploadStandaloneController } from '@hms-dbmi-bgm/shared-portal-components/es/components/forms/components/DragAndDropUpload';


export class FileWrapper extends React.Component {
    static propTypes = {
        individual: PropTypes.object,
        haveEditPermission: PropTypes.bool
        // TODO: need to eventually pass down current user's associated lab/awards 
        // for submission of Document objects
    }

    render() {
        const { individual, haveEditPermission } = this.props;
        const { related_documents = [], images = [], "@id": individualId } = individual;

        return (
            <React.Fragment>
                { related_documents.length === 0 ? null :
                    <FileArrayField fieldName="Related Documents" files={related_documents}
                        {...{ haveEditPermission, individualId }} /> }
                { images.length === 0 ? null :
                    <FileArrayField fieldName="Images" files={images} 
                        {...{ haveEditPermission, individualId }} /> }
            </ React.Fragment>
        );
    }
}

class FileArrayField extends React.Component {
    static propTypes = {
        fieldName: PropTypes.string.isRequired,
        files: PropTypes.array.isRequired,
        individualId: PropTypes.string.isRequired,
        haveEditPermission: PropTypes.bool
    }

    render () {
        const { fieldName, files, haveEditPermission = false } = this.props;

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
                    <DragAndDropUploadStandaloneController
                        {...{ fieldName, fieldType }} cls="btn btn-sm btn-outline-dark" /> : null }
            </div>
        );
    }
}