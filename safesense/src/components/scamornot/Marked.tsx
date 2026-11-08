import { splitMarks } from './evidence'

/** Text with the checked evidence marked like a soft highlighter. */
export function Marked({ text, marks }: { text: string; marks?: string[] }) {
  return (
    <>
      {splitMarks(text, marks).map((run, i) =>
        run.marked ? (
          <mark key={i} className="son-mark">
            {run.text}
          </mark>
        ) : (
          run.text
        ),
      )}
    </>
  )
}
