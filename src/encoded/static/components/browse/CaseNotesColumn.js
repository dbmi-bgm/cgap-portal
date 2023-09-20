/**
 * TODO:
 *   - Handle case where user deletes existing text, and saves it.
 *        - Should the note be removed?
 *        - Should the note's text simply be empty?
 *   - Handle latency of note item PATCH
 *        - datastore=database
 *        - Use local storage to cache the new string while server updates
 *        - Show warning detailing that it will take a few minutes to update
 *   - Show Red outline icon in the column header when changes are unsaved
 */

import React, { useState, useRef, forwardRef } from "react";
import { Popover, OverlayTrigger } from "react-bootstrap";
import { LocalizedTime } from "@hms-dbmi-bgm/shared-portal-components/es/components/ui/LocalizedTime";
import { ajax } from "@hms-dbmi-bgm/shared-portal-components/es/components/util";


const CaseNotesPopover = forwardRef(({
  note,
  lastSavedText,
  handleNoteSave,
  currentText,
  setCurrentText,
  buttonRef,
  ...popoverProps
}, ref) => {

  const prevDate = lastSavedText.date;
  const prevEditor = lastSavedText.user;

  return (
    <Popover data-popover-category="notes" placement="bottom" {...popoverProps} ref={ref}>
      <Popover.Title as="h3">Case Notes</Popover.Title>
      <Popover.Content>
        {
          lastSavedText.date ?
            <p className="last-saved small">
              Last Saved: <LocalizedTime 
                timestamp={prevDate} 
                formatType="date-time-sm" 
              /> { prevEditor && `by ${prevEditor}` }
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
          ref={buttonRef}
          onClick={() => handleNoteSave(currentText) }
          disabled={lastSavedText.text === currentText ? "disabled" : "" }
        >
          {
            // Prevent showing "Note saved..." message if no note exists
            lastSavedText.date ? 
              lastSavedText.text === currentText ? "Note saved - edit note to save again" : "Save Note"
              :
              "Save Note"
          }
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
  setCurrentText,
  buttonRef
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
        buttonRef={buttonRef}
      />
    }
  >
    <button className="case-notes-button">
      <i className={`icon text-larger icon-fw icon-sticky-note ${ lastSavedText.text === "" ? 'far' : 'fas' } text-muted`}></i>
      {
        currentText === lastSavedText.text ?
          null
          :
          <i
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
  // Initial state passed to children
  const [lastSavedText, setLastSavedText] = useState((newNote) => {
    
    // If new note information is being provided
    if (newNote) {
      return {
        text: newNote?.text ?? "",
        date: newNote?.date ?? null,
        user: newNote?.user ?? "",
        userId: newNote?.userId ?? ""
      }
    }
    // If there is a note item attached to this case with deleted status
    else if (result?.note?.status === "deleted") {
      return {
        text: "",
        date: null,
        user: "",
        userId: ""
      }
    } 

    // Otherwise return whatever is received from [result]
    return {
      text: result?.note?.note_text ?? "",
      date: result?.note?.last_text_edited?.date_text_edited ?? null,
      user: result?.note?.last_text_edited?.text_edited_by?.display_title ?? "",
      userId: result?.note?.last_text_edited?.text_edited_by?.uuid ?? ""
    }
  });

  const [currentText, setCurrentText] = useState(lastSavedText.text);
  
  // Create a ref to pass down to the "save" button
  const buttonRef = useRef(null);


  const caseID = result['@id'];
  const caseUUID = result.uuid;
  const noteID = result.note ? result.note['@id'] : "";

  /**
   * handleNoteSave executes a request to update the NOTE and CASE
   * associate with this component.
   * 
   * If there is no note attached to this case:
   *    - Executes a POST request for NOTE
   *    - Executes a PATCH request for CASE to link to NOTE
   * If there is an exisitng note:
   *    - Executes a PATCH request for NOTE to update the text
   * If there is an existing note AND [currentText] is the empty string
   *    - Executes a DELETE request for the NOTE item attached
   * 
   * Note: The save button who triggers this function is enabled iff
   * [currentText] !== [lastSavedText.text]
   */
  const handleNoteSave = () => {
    // Replace button text with loader until the request completes (re-render)
    buttonRef.current.innerHTML = `<i class="icon icon-spin icon-circle-notch fas" />`;

    /**
     * This the current text in the textarea input is not 
     * the empty string, which should be dealt with separately
     */
    if (currentText !== "") {

      let payload = {
        "note_text": currentText,
        "project": result.project['@id'],
        "institution": result.institution['@id']
      }
      
      /**
       * IF: the last saved text is the empty string, 
       * 1. POST a new note
       * 2. PATCH the corresponding case to link to the new note
      */
      if (noteID === "") {
        // 1.POST a new note
        ajax.promise("/notes-standard/", "POST", {}, JSON.stringify(payload)).then((res) => {
          // Save the note item into the corresponding project
          const newNoteId = res['@graph'][0]['@id'];

          if (!newNoteId) {
            throw new Error("No note-standard @ID returned.");
          }
          else {

            // 2. PATCH the corresponding case to link to the new note
            ajax.promise(caseID, "PATCH", {}, JSON.stringify({
              "note": "" + newNoteId
            })).then((patchRes) => {

              if (patchRes.status === "success") {

                // If the user has the same uuid (after extracting the uuid), don't change the user field
                const new_userId = res['@graph'][0]?.last_text_edited.text_edited_by.split("/")[2];
                let new_user = (lastSavedText.userId === new_userId) ? lastSavedText.user : "";

                setLastSavedText({
                  text: currentText,
                  date: res['@graph'][0].last_text_edited.date_text_edited,
                  user: new_user,
                  userId: new_userId
                });
              }
            });
          }
        }).catch((e) => {
          console.log("Error: ", e)
        })
      }
      // ELSE: There is alrady a Note item linked, so simply modify its
      // text and/or status
      else {
        ajax.promise(noteID, "PATCH", {}, JSON.stringify({
          "note_text": currentText,
          "status": "current"
        })).then((patchRes) => {
          if (patchRes.status === "success") {
            // If the user has the same uuid (after extracting the uuid), don't change the user field
            const new_userId = patchRes['@graph'][0].last_text_edited.text_edited_by.split("/")[2];
            let new_user = (lastSavedText.userId === new_userId) ? lastSavedText.user : "";

            setLastSavedText({
              text: patchRes['@graph'][0].note_text,
              date: patchRes['@graph'][0].last_text_edited.date_text_edited,
              user: new_user,
              userId: new_userId
            });
          }
        }).catch((e) => {
          console.log("Error: ", e);
        });
      }
    }
    /** 
     * [currentText] is the empty string and we should delete the note item
     * that is attached to this case item
     * 
     * TODO: remove the link to the note with [noteId] on the case
    */
    else {
      // DELETE request for the note
      /**
       * Currently (9/18/2023), I will "DELETE" the note attached,
       * setting the status to deleted, then making sure that no
       * note is shown
       */
      ajax.promise(noteID, "DELETE", {}, JSON.stringify()).then((deleteRes) => {
        if (deleteRes.status === "success") {
          // Replace button text with loader until the request completes (re-render)
          buttonRef.current.innerHTML = `Save Note`;
          setLastSavedText({
            text: "",
            date: "",
            user: "",
            userId: ""
          });
        }
      }).catch((e) => {
        console.log("Error: ", e);
      });
    }
  }

  return (
    <div className="case-notes">
      {/* Render Notes Button */}
      <CaseNotesButton
        note={result?.note}
        lastSavedText={lastSavedText}
        handleNoteSave={handleNoteSave}
        currentText={currentText}
        setCurrentText={setCurrentText}
        buttonRef={buttonRef}
      />
      {/* Render either empty string or note.note_text */}
      <p className="case-notes-text">{lastSavedText.text}</p> 
    </div>
  );
};