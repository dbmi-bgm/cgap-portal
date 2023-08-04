import React, { useState, forwardRef } from "react";
import { Popover, OverlayTrigger } from "react-bootstrap";

const handleNoteTextChange = (e) => {
  console.log(e.target.value);
}


const CaseNotesPopover = forwardRef((props, ref) => {
  const [lastSavedText, setLastSavedText] = useState(props.note.note_text || "No text yet");

  return (
    <Popover className="w-[400px]" placement="bottom" {...props} ref={ref}>
      <Popover.Title as="h3">Case Notes</Popover.Title>
      <Popover.Content>
        <textarea 
          className="form-control" 
          rows={5} 
          defaultValue={props.note.note_text || ""}
          onChange={(e) => handleNoteTextChange(e)}
        ></textarea>
        <button type="button" className="btn btn-primary mr-04 w-100">
            Save
        </button>
      </Popover.Content>
    </Popover>
  )
});

/**
 * 
 * @param {} param0 
 * @returns 
 */
const CaseNotesButton = ({note, hasNote, isSaved, setIsSaved}) => (
  <OverlayTrigger trigger="click" placement="bottom" overlay={<CaseNotesPopover note={note} />}>
    <button className="case-notes-button">
      <i className={`icon text-larger icon-fw icon-sticky-note ${ hasNote ? 'fas' : 'far' } text-muted`}></i>
      {!isSaved && <i
        className="status-indicator-dot"
        data-status={"note-dot-unsaved"}
        data-tip={"Unsaved changes on this note."}
        data-html
      />}
    </button>
  </OverlayTrigger>
);


/**
 * @param {Object} result
 * @param {Object} result.note - the notes returned as a result
 */
export const CaseNotesColumn = ({ note }) => {
  const [hasNote, setHasNote] = useState(note != null) // is the note field defined?
  const [isSaved, setIsSaved] = useState(false);

  // const [noteText, setNoteText] = useState(note.note_text ?? "no notes");
  return (
    <div className="case-notes">
      <CaseNotesButton note={note} hasNote={hasNote} isSaved={isSaved} setIsSaved={setIsSaved} />
      <p className="case-notes-text">{note.note_text || ""}</p>
    </div>
  );
};

/**
 * - Saved empty string should be considered a non-comment
 * - There needs to be a way to pass information up to the CaseID column
 * 
 * 
 * 
 */