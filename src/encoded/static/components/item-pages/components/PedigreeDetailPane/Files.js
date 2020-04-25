import React from 'react';
import PropTypes from 'prop-types';
import { DragAndDropUploadStandaloneController } from '@hms-dbmi-bgm/shared-portal-components/es/components/forms/components/DragAndDropUpload';


export class FileWrapper extends React.Component {
    static propTypes = {
        individual: PropTypes.object
    }

    render() {
        const { individual } = this.props;
        const { related_documents = [], images = [] } = individual;
        console.log(related_documents, images);
        return (
            <React.Fragment>
                { related_documents.length === 0 ? null :
                    <FileArrayField fieldName="Related Documents" files={ related_documents }/> }
                { images.length === 0 ? null :
                    <FileArrayField fieldName="Images" files={ images } /> }
            </ React.Fragment>
        );
    }
}

class FileArrayField extends React.Component {
    static propTypes = {
        fieldName: PropTypes.string
    }

    render () {
        const { fieldName, files } = this.props;
        return (
            <div className="detail-row" data-describing={fieldName}>
                <label className="d-block">{fieldName}</label>
                <ul>
                    {
                        files.map((file) => <li key={file['@id']}><a href={file['@id']}>{file.display_title}</a></li>)
                    }
                </ul>
                <DragAndDropUploadStandaloneController />
            </div>
        );
    }
}

// export class Files extends React.Component {



//     render() {

        
//         return (
//             // <DragAndDropUploadStandaloneController />

//             <div className="detail-row" data-describing="files">
//                 <label className="d-block">Files</label>
//                 {/* { haveEditPermission ?
//                     <textarea value={notes} onChange={this.onChange} className={notesChanged ? "has-changed" : null}/>
//                     :
//                     <p className="read-only-notes">{ notes }</p>
//                 }
//                 { haveEditPermission && notesChanged ?
//                     <div className="save-btn-container">
//                         <button type="button" disabled={isSaving} className="btn btn-sm btn-success mt-02 mr-05" onClick={this.onSave}
//                             data-tip="It may take a couple of minutes for changes to take effect">
//                             { isSaving ?
//                                 <React.Fragment>
//                                     <i className="icon icon-circle-notch fas icon-spin mr-08"/>
//                                     Saving
//                                 </React.Fragment>
//                                 : "Save" }
//                         </button>
//                         <button type="button" disabled={isSaving} className="btn btn-sm btn-outline-dark mt-02" onClick={this.onReset}>
//                             Reset
//                         </button>
//                     </div>
//                     : null } */}
//             </div>
//         );
//     }
// }