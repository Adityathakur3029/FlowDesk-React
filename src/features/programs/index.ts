// Public entry of the programs feature: other features import from here only.
// No pages or components here: ProgramPage imports @/features/tasks, whose task page imports this file,
// so exporting it would create an import cycle.
export { useProgram } from './api'
