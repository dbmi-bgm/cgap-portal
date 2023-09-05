/**
 * TODO:
 *   - Handle case where user deletes existing text, and saves it.
 *        - Should the note be removed?
 *        - Should the note's text simply be empty?
 *   - Handle latency of note item PATCH
 *        - Use local storage to cache the new string while server updates
 *        - Show warning detailing that it will take a few minutes to update
 *   - Show Red outline icon in the column header when changes are unsaved
 */

import React, { useState, useRef, useEffect, forwardRef } from "react";
import { Popover, OverlayTrigger } from "react-bootstrap";
import { LocalizedTime } from "@hms-dbmi-bgm/shared-portal-components/es/components/ui/LocalizedTime";
import { ajax } from "@hms-dbmi-bgm/shared-portal-components/es/components/util";


const CaseNotesPopover = forwardRef(({
  note,
  lastSavedText,
  handleNoteSave,
  currentText,
  setCurrentText,
  ...popoverProps
}, ref) => {

  // Information about last saved note
  const last_text_edited = note?.last_text_edited ?? null;
  const text_edited_by = last_text_edited?.text_edited_by ?? null;
  const prevDate = last_text_edited?.date_text_edited ?? "";
  const prevEditor = text_edited_by?.display_title ?? "";
  
  return (
    <Popover data-popover-category="notes" placement="bottom" {...popoverProps} ref={ref}>
      <Popover.Title as="h3">Case Notes</Popover.Title>
      <Popover.Content>
        {
          last_text_edited ?
            <p className="last-saved small">
              Last Saved: <LocalizedTime 
                timestamp={prevDate} 
                formatType="date-time-sm" 
              /> by {prevEditor}
            </p>
            :
            null
        }
        <textarea 
          className="form-control" 
          rows={5} 
          defaultValue={currentText}
          onChange={(e) => setCurrentText(e.target.value)}
        ></textarea>
        <button 
          type="button" 
          className="btn btn-primary mr-04 w-100"
          onClick={() => handleNoteSave(currentText) }
          disabled={lastSavedText === currentText ? "disabled" : "" }
        >
          {lastSavedText === currentText ? "Note saved - edit note to save again" : "Save Note" }
        </button>
      </Popover.Content>
    </Popover>
  )
});

/**
 * Button for toggling the Case Notes Popover
 */
const CaseNotesButton = ({
  note, 
  lastSavedText, 
  handleNoteSave, 
  currentText, 
  setCurrentText
}) => (
  <OverlayTrigger 
    trigger="click"  
    placement="bottom"
    rootClose
    overlay={ // Pass Popover as overlay
      <CaseNotesPopover
        note={note}
        lastSavedText={lastSavedText}
        handleNoteSave={handleNoteSave}
        currentText={currentText}
        setCurrentText={setCurrentText}
      />
    }
  >
    <button className="case-notes-button">
      <i className={`icon text-larger icon-fw icon-sticky-note ${ lastSavedText === "" ? 'far' : 'fas' } text-muted`}></i>
      {
        currentText !== lastSavedText && <i
          className="status-indicator-dot"
          data-status={"note-dot-unsaved"}
          data-tip={"Unsaved changes on this note."}
          data-html
        />
      }
    </button>
  </OverlayTrigger>
);


/**
 * Top-level component for rendering the Case Notes column. Props passed down 
 * from columnExtensionMap.
 * @param {Object} result the current result that this column cell belongs to
 * 
 * Note: Items with no link to a note item (no "note" field in [result]) set
 * [lastSavedText] to the empty string.
 */
export const CaseNotesColumn = ({ result }) => {
  const [lastSavedText, setLastSavedText] = useState(result?.note?.note_text ?? "");
  const [currentText, setCurrentText] = useState(lastSavedText);

  const caseID = result['@id'];
  const noteID = result?.note ? result.note['@id'] : "";

  /**
   * Function for patching the note item for using the current value 
   * in the textarea box, and triggering the rerender of the component.
   */
  const handleNoteSave = () => {
    /**
     * There are three cases to consider:
     * 1. No note has NOT been added, thus there is nothing to render
     * 2. A note has been added, but it is currently the empty string
     *    - When a user attempts to PATCH a note with an empty string, 
     *      the existing note should be modified instead of deleting
     *      the attached note altogether.
     * 3. A note has been added, and it has text.
     */

    // if (currentText !== "") {
      let payload = {
        "note_text": currentText,
        "project": result.project['@id'],
        "institution": result.institution['@id']
      }
      
      /**
       * IF: the last saved text is the empty string, POST a new note and
       * PATCH it to this case
      */
      if (noteID === "") {
        ajax.promise("/notes-standard/", "POST", {}, JSON.stringify(payload)).then((res) => {
          // Save the note item into the corresponding project
          const newNoteId = res['@graph'][0]['@id'];

          if (!newNoteId) {
            throw new Error("No note-standard @ID returned.");
          }
          else {
            // Patch the current case to link to this note item
            ajax.promise(caseID, "PATCH", {}, JSON.stringify({
              "note": "" + newNoteId
            })).then((res) => {
              if (res.status === "success") {
                setLastSavedText(currentText)
              }
            });
          }
        }).catch((e) => {
          console.log("Error: ", e)
        })
      }
      // ELSE: There is alrady a Note item linked, so simply modify its text
      else {
        ajax.promise(noteID, "PATCH", {}, JSON.stringify({
          "note_text": currentText
        })).then((res) => {
          if (res.status === "success") {
            setLastSavedText(currentText)
          }
        }).catch((e) => {
          console.log("Error: ", e);
        });
      }
    // }
  }

  return (
    <div className="case-notes">
      {/* Render Notes Button */}
      <CaseNotesButton
        note={result.note}
        lastSavedText={lastSavedText}
        handleNoteSave={handleNoteSave}
        currentText={currentText}
        setCurrentText={setCurrentText}
      />
      {/* Render either empty string or note.note_text */}
      <p className="case-notes-text">{lastSavedText}</p> 
    </div>
  );
};