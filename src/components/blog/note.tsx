import type { ReactElement, ReactNode } from "react";

interface NoteProps {
  children?: ReactNode;
}

export const Note = ({ children }: NoteProps): ReactElement => (
  <div className="blog-note" role="note">
    {children}
  </div>
);
