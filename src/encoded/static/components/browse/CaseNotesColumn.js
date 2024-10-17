import React, { useState, forwardRef } from "react";
import { Popover, OverlayTrigger } from "react-bootstrap";
import { LocalizedTime } from "@hms-dbmi-bgm/shared-portal-components/es/components/ui/LocalizedTime";
import { ajax } from "@hms-dbmi-bgm/shared-portal-components/es/components/util";

/**
 * React-Boostrap (v1.6.7, Bootstrap 4.6 syntax) Popover component containing
 * the main user actions, such as the "save" button and the textarea element 
 * where users add note text.
 */
const CaseNotesPopover = forwardRef(({
  note,
  lastSavedText,
  handleNoteSave,
  currentText,
  setCurrentText,
  ...popoverProps
}, ref) => {

  const [isLoading, setIsLoading] = useState(false);

  // Information on the previous note, defaults to null.
  const prevDate = lastSavedText.date;
  const prevEditor = lastSavedText.user;

  return (
    <Popover 
      data-popover-category="notes"  
      ref={ref}
      {...popoverProps}
    >
      <Popover.Header as="h3">Case Notes</Popover.Header>
      <Popover.Body>
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
          className="btn btn-primary me-04 w-100"
          onClick={() => { setIsLoading(true); handleNoteSave() } }
          // If text is modified or loading disable 
          disabled={ lastSavedText.text === currentText || isLoading ? "disabled" : "" }
        >
          {
            // Show spinner icon when note is modified and save is loading
            (lastSavedText.text !== currentText) && (isLoading === true) ?
              <i className="icon icon-spin icon-circle-notch fas" />
              :
              // Show "Save Note" on unsaved changes OR no previous note exists
              lastSavedText.date ? 
                lastSavedText.text === currentText ? "Note saved - edit note to save again" : "Save Note"
                :
                "Save Note"
          }
        </button>
        { lastSavedText.error && <p className="text-danger error">{lastSavedText.error}</p> }
        { lastSavedText.warning && <p className="small warning">{lastSavedText.warning}</p> }
      </Popover.Body>
    </Popover>
  )
});

/**
 * React-Boostrap (v1.6.7, Bootstrap 4.6 syntax) Overlay Trigger component.
 * This component serves as the button for toggling the [CaseNotesPopover].
 * Shows red indicator when [currentText] === [lastSavedText.text]
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
    rootClose
    placement="bottom"
    flip={true}
    overlay={
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
 * @param {Object} result the current search result that corresponds to this
 * case (the row whose render method calls this component)
 * 
 * Note: Items with no link to a note item (no "note" field in [result]) set
 * [lastSavedText] to the empty string by default.
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
        userId: newNote?.userId ?? "",
        warning: newNote?.warningText
      }
    }
    // If there is a note item attached to this case with deleted status
    else if (result?.note?.status === "deleted") {
      return {
        text: "",
        date: null,
        user: "",
        userId: "",
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
  
  const caseID = result['@id'];
  const noteID = result.note ? result.note['@id'] : "";

  const warningText = "It may take some time for changes to be reflected. Please refresh or search again in a few minutes.";
  const errorText = "An error has occurred. Please try again or contact an administrator."

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
        ajax.promise("/notes-standard", "POST", {}, JSON.stringify(payload)).then((res) => {
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
                  userId: new_userId,
                  warning: warningText
                });
              }
              return res
            });
          }
        }).catch((e) => {
          console.log(e);

          setLastSavedText({
            ...lastSavedText,
            warning: "",
            error: errorText
          });
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
              userId: new_userId,
              warning: warningText
            });
          }
          return patchRes
        }).catch((e) => {
          console.log(e);

          setLastSavedText({
            ...lastSavedText,
            warning: "",
            error: errorText
          });
        });
      }
    }
    /** 
     * [currentText] is the empty string and we should delete the note item
     * that is attached to this case item
    */
    else {
      /**
       * Send DELETE request for the note attached, setting the status
       * to "deleted", then making sure that no note is shown on rerender
       */
      ajax.promise(noteID, "DELETE", {}, JSON.stringify()).then((deleteRes) => {
        if (deleteRes.status === "success") {
          setLastSavedText({
            text: "",
            date: "",
            user: "",
            userId: "",
            warning: warningText
          });
        }
      }).catch((e) => {
        console.log(e);

        setLastSavedText({
          ...lastSavedText,
          warning: "",
          error: errorText
        });
      });
    }
  }

  return (
    <div className="case-notes">
      <CaseNotesButton
        note={result?.note}
        lastSavedText={lastSavedText}
        handleNoteSave={handleNoteSave}
        currentText={currentText}
        setCurrentText={setCurrentText}
      />
      <p className="case-notes-text">{lastSavedText.text}</p> 
    </div>
  );
};