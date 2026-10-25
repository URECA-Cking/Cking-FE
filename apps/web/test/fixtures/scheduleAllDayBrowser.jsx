import { createRoot } from 'react-dom/client'
import ScheduleEditorSheet from '../../src/components/creator/ScheduleEditorSheet.jsx'
import ToastContext from '../../src/context/toastContext.js'

window.renderEditor = (schedule) => createRoot(document.getElementById('root')).render(
  <ToastContext.Provider value={() => {}}>
    <ScheduleEditorSheet open onClose={() => {}} schedule={schedule} onSaved={(saved) => window.saved.push(saved)} />
  </ToastContext.Provider>,
)
