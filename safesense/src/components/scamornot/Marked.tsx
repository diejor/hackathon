import { Fragment } from 'react'
import { splitMarks } from './evidence'

/**
 * Text with the checked evidence marked like a soft highlighter. The <wbr> on each side lets a long web
 * address wrap around the mark instead of splitting the marked part.
 */
export function Marked({ text, marks }: { text: string; marks?: string[] }) {
  return (
    <>
      {splitMarks(text, marks).map((run, i) =>
        run.marked ? (
          <Fragment key={i}>
            <wbr />
            <mark className="son-mark">{run.text}</mark>
            <wbr />
          </Fragment>
        ) : (
          run.text
        ),
      )}
    </>
  )
}
