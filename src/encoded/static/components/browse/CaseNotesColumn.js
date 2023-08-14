import React, { useState, useRef, useEffect, forwardRef } from "react";
import { Popover, OverlayTrigger } from "react-bootstrap";
import { LocalizedTime } from "@hms-dbmi-bgm/shared-portal-components/es/components/ui/LocalizedTime";


const CaseNotesPopover = forwardRef(({
  note,
  lastSavedText,
  setLastSavedText,
  currentText,
  setCurrentText,
  ...popoverProps
}, ref) => {
  // Track whether changes have been made to the original text 
  // (AKA text shown at the beginning of the session)
  // 
  // TODO: this does not need to rerender the component, since changes to lastSavedText will already do so.
  // It will only occur once. Use a ref to keep this from running more than once?
  // const [originalText, setButtonText] = useState("Save Note");


  // Pull out information about previous 
  const { date_text_edited, text_edited_by } = note.last_text_edited;
  const prevDate = date_text_edited;
  const prevEditor = text_edited_by.display_title;
  
  return (
    <Popover data-popover-category="notes" placement="bottom" {...popoverProps} ref={ref}>
      <Popover.Title as="h3">Case Notes</Popover.Title>
      <Popover.Content>
        <p className="last-saved small">Last Saved: <LocalizedTime timestamp={prevDate} formatType="date-time-sm" /> by {prevEditor}</p>
        <textarea 
          className="form-control" 
          rows={5} 
          defaultValue={currentText}
          onChange={(e) => setCurrentText(e.target.value)}
        ></textarea>
        <button 
          type="button" 
          className="btn btn-primary mr-04 w-100"
          onClick={() => setLastSavedText(currentText) }
          disabled={lastSavedText === currentText ? "disabled" : "" }
        >
          {lastSavedText === currentText ? "Note saved - edit note to save again" : "Save Note" }
        </button>
      </Popover.Content>
    </Popover>
  )
});

const CaseNotesButton = ({note, lastSavedText,setLastSavedText,currentText,setCurrentText}) => (
  <OverlayTrigger 
    trigger="click"  
    placement="bottom"
    rootClose
    overlay={ // Pass Popover as overlay
      <CaseNotesPopover
        note={note}
        lastSavedText={lastSavedText}
        setLastSavedText={setLastSavedText}
        currentText={currentText}
        setCurrentText={setCurrentText}
      />
    }
  >
    <button className="case-notes-button">
      <i className={`icon text-larger icon-fw icon-sticky-note ${ lastSavedText === "" ? 'far' : 'fas' } text-muted`}></i>
      {currentText !== lastSavedText && <i
        className="status-indicator-dot"
        data-status={"note-dot-unsaved"}
        data-tip={"Unsaved changes on this note."}
        data-html
      />}
    </button>
  </OverlayTrigger>
);


/**
 * Top-level component.
 * @param {Object} result
 * @param {Object} result.note - the notes returned as a result
 */
export const CaseNotesColumn = ({ note }) => {
  const [lastSavedText, setLastSavedText] = useState(note == null ? "" : note.note_text);
  const [currentText, setCurrentText] = useState(lastSavedText);
  
  console.log(note, note.last_text_edited);
  return (
    <div className="case-notes">
      {/* Render Notes Button */}
      <CaseNotesButton
        note={note}
        lastSavedText={lastSavedText}
        setLastSavedText={setLastSavedText}
        currentText={currentText}
        setCurrentText={setCurrentText}
      />
      {/* Render either empty string or note.note_text */}
      <p className="case-notes-text">{lastSavedText}</p> 
    </div>
  );
};