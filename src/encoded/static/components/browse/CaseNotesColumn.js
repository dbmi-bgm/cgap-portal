import React, { useState, memo } from "react";

/**
 * @param {Object} result
 * @param {Object} result.note - the notes returned as a result
 */
export const CaseNotesColumn = ({ note }) => {
  const [isSaved, setIsSaved] = useState(true);
  const [noteText, setNoteText] = useState(note.note_text ?? "no notes");
  return (
    <div className="d-flex flex-row">
      <div>
        <button>
          <i className="icon text-larger icon-fw icon-sticky-note far text-muted"></i>
        </button>
      </div>
      <div>{noteText}</div>
    </div>
  );
};
