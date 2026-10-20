import { CommentSection } from './CommentSection'

// Program-level comments (the program page's Comments tab).
export function ProgramComments({ programId }: { programId: string }) {
  return <CommentSection target={{ programId }} subject="program" />
}
